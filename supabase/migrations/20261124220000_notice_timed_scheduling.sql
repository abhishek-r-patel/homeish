-- Owner-reviewed P53 timed schedules: automatic read reconciliation and daily alert catch-up.
ALTER TABLE public.notices ALTER COLUMN scheduled_for TYPE timestamptz
  USING scheduled_for::timestamp AT TIME ZONE 'Asia/Kolkata';
ALTER TABLE public.notices ADD COLUMN scheduled_notified_at timestamptz;
-- The old publishing job already notified these notices; do not replay their alerts.
UPDATE public.notices SET scheduled_notified_at = published_at
  WHERE status = 'published' AND scheduled_for IS NOT NULL;
CREATE INDEX notices_scheduled_alerts_idx ON public.notices(society_id, scheduled_for)
  WHERE status = 'published' AND scheduled_for IS NOT NULL AND scheduled_notified_at IS NULL;

DROP FUNCTION private.notice_schedule_validate(date, timestamptz);
CREATE FUNCTION private.notice_schedule_validate(p_scheduled_for timestamptz, p_expires_at timestamptz)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF p_scheduled_for IS NOT NULL AND p_scheduled_for <= clock_timestamp() THEN
    RAISE EXCEPTION 'Choose a future posting date and time.' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= COALESCE(p_scheduled_for, clock_timestamp()) THEN
    RAISE EXCEPTION 'The notice expiry must be after it is posted.' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.notice_schedule_validate(timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

-- Explicit intent means a missing timestamp can never turn a schedule into a draft.
DROP FUNCTION public.notice_draft_save(uuid, uuid, text, text, text, uuid[], boolean, timestamptz, jsonb, date, timestamptz, uuid, text);
CREATE FUNCTION public.notice_draft_save(
  p_society_id uuid, p_notice_id uuid, p_title text, p_body text, p_audience text,
  p_block_ids uuid[], p_pinned boolean, p_expires_at timestamptz, p_attachment jsonb,
  p_scheduled_for timestamptz, p_expected_updated_at timestamptz, p_client_request_id uuid,
  p_request_trace text, p_post_mode text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  notice_row public.notices;
  attachment jsonb := p_attachment;
  next_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT private.module_enabled(p_society_id, 'notice') OR NOT private.society_writable(p_society_id) THEN
    RAISE EXCEPTION 'Notice changes are not allowed.' USING ERRCODE = '42501';
  END IF;
  IF p_post_mode IS NULL OR p_post_mode NOT IN ('draft', 'schedule')
    OR (p_post_mode = 'schedule' AND p_scheduled_for IS NULL)
    OR (p_post_mode = 'draft' AND p_scheduled_for IS NOT NULL) THEN
    RAISE EXCEPTION 'Choose a posting date and time for a schedule.' USING ERRCODE = '22023';
  END IF;
  next_status := CASE WHEN p_post_mode = 'schedule' THEN 'scheduled' ELSE 'draft' END;
  IF p_notice_id IS NULL THEN
    IF p_client_request_id IS NULL OR p_pinned IS NULL THEN
      RAISE EXCEPTION 'The notice details are invalid.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO notice_row FROM public.notices
      WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
    IF FOUND THEN RETURN private.notice_json(notice_row); END IF;
  ELSE
    notice_row := private.notice_for_update(p_society_id, p_notice_id);
    IF notice_row.status NOT IN ('draft', 'scheduled') THEN
      RAISE EXCEPTION 'Only a draft or scheduled notice can be changed here.' USING ERRCODE = '23505', HINT = 'invalid_state';
    END IF;
    IF p_expected_updated_at IS NULL OR notice_row.updated_at <> p_expected_updated_at THEN
      RAISE EXCEPTION 'The notice changed in another session.' USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;
    IF p_pinned IS NULL THEN RAISE EXCEPTION 'The notice details are invalid.' USING ERRCODE = '22023'; END IF;
    IF attachment IS NOT NULL AND attachment->>'path' = notice_row.attachment_path THEN
      attachment := jsonb_build_object('path', notice_row.attachment_path,
        'content_type', notice_row.attachment_content_type, 'size_bytes', notice_row.attachment_size_bytes::text);
    END IF;
  END IF;
  PERFORM private.notice_validate(p_society_id, p_title, p_body, p_audience, p_block_ids, attachment);
  PERFORM private.notice_schedule_validate(p_scheduled_for, p_expires_at);
  IF p_notice_id IS NULL THEN
    INSERT INTO public.notices(society_id, created_by, updated_by, title, body, audience, pinned,
      expires_at, status, scheduled_for, published_at, attachment_path, attachment_content_type,
      attachment_size_bytes, client_request_id)
    VALUES (p_society_id, auth.uid(), auth.uid(), btrim(p_title), btrim(p_body), p_audience,
      p_pinned, p_expires_at, next_status, p_scheduled_for, NULL, attachment->>'path',
      attachment->>'content_type', (attachment->>'size_bytes')::integer, p_client_request_id)
    RETURNING * INTO notice_row;
  ELSE
    UPDATE public.notices SET title = btrim(p_title), body = btrim(p_body), audience = p_audience,
      pinned = p_pinned, expires_at = p_expires_at, status = next_status, scheduled_for = p_scheduled_for,
      attachment_path = attachment->>'path', attachment_content_type = attachment->>'content_type',
      attachment_size_bytes = (attachment->>'size_bytes')::integer
    WHERE society_id = p_society_id AND id = p_notice_id RETURNING * INTO notice_row;
    DELETE FROM public.notice_blocks WHERE society_id = p_society_id AND notice_id = p_notice_id;
  END IF;
  INSERT INTO public.notice_blocks(society_id, notice_id, block_id)
    SELECT DISTINCT p_society_id, notice_row.id, block_id FROM unnest(COALESCE(p_block_ids, ARRAY[]::uuid[])) AS block_id;
  PERFORM private.core_toolkit_audit(p_society_id,
    CASE WHEN p_notice_id IS NULL THEN 'notice.draft_create' ELSE 'notice.draft_update' END,
    'notice', notice_row.id::text, NULL,
    jsonb_build_object('status', next_status, 'scheduled_for', p_scheduled_for), p_request_trace);
  RETURN private.notice_json(notice_row);
END;
$$;
REVOKE ALL ON FUNCTION public.notice_draft_save(uuid, uuid, text, text, text, uuid[], boolean,
  timestamptz, jsonb, timestamptz, timestamptz, uuid, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.notice_draft_save(uuid, uuid, text, text, text, uuid[], boolean,
  timestamptz, jsonb, timestamptz, timestamptz, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notice_draft_publish(
  p_society_id uuid, p_notice_id uuid, p_expected_updated_at timestamptz, p_request_trace text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE notice_row public.notices;
BEGIN
  notice_row := private.notice_for_update(p_society_id, p_notice_id);
  IF notice_row.status NOT IN ('draft', 'scheduled') THEN
    RAISE EXCEPTION 'Only a planned notice can be posted.' USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  IF p_expected_updated_at IS NULL OR notice_row.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'The notice changed in another session.' USING ERRCODE = '23505', HINT = 'stale_record';
  END IF;
  IF notice_row.expires_at IS NOT NULL AND notice_row.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Choose a future expiry before publishing.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.notices SET status = 'published', published_at = clock_timestamp(),
    scheduled_notified_at = CASE WHEN scheduled_for IS NOT NULL THEN clock_timestamp() END
    WHERE society_id = p_society_id AND id = p_notice_id RETURNING * INTO notice_row;
  PERFORM private.notice_publish_effects(notice_row, notice_row.scheduled_for IS NOT NULL, p_request_trace);
  RETURN private.notice_json(notice_row);
END;
$$;

CREATE FUNCTION private.notice_reconcile_due(p_society_id uuid, p_cutoff timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE notice_row public.notices;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'notice') OR NOT private.society_writable(p_society_id) THEN RETURN; END IF;
  FOR notice_row IN SELECT * FROM public.notices
    WHERE society_id = p_society_id AND status = 'scheduled' AND scheduled_for <= p_cutoff
    ORDER BY scheduled_for, id FOR UPDATE
  LOOP
    UPDATE public.notices SET status = 'published', published_at = scheduled_for
      WHERE society_id = p_society_id AND id = notice_row.id;
    INSERT INTO public.audit_logs(society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id)
      VALUES (p_society_id, NULL, 'system', 'notice.publish', 'notice', notice_row.id::text,
        jsonb_build_object('scheduled', true, 'published_at', notice_row.scheduled_for),
        'notice-schedule-' || notice_row.id::text);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.notice_reconcile_due(uuid, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.notice_reconcile_on_read(p_society_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee', 'resident']::text[])
    OR NOT private.module_enabled(p_society_id, 'notice') THEN
    RAISE EXCEPTION 'Notices are not available.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.notice_reconcile_due(p_society_id, clock_timestamp());
END;
$$;
REVOKE ALL ON FUNCTION private.notice_reconcile_on_read(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Keep the existing audience, pagination and read-receipt contracts behind private wrappers.
ALTER FUNCTION public.notice_list(uuid, text, integer, integer) SET SCHEMA private;
ALTER FUNCTION private.notice_list(uuid, text, integer, integer) RENAME TO notice_list_records;
REVOKE ALL ON FUNCTION private.notice_list_records(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.notice_list(p_society_id uuid, p_view text DEFAULT 'current', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.notice_reconcile_on_read(p_society_id);
  RETURN private.notice_list_records(p_society_id, p_view, p_limit, p_offset);
END;
$$;
ALTER FUNCTION public.notice_get(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION private.notice_get(uuid, uuid) RENAME TO notice_get_record;
REVOKE ALL ON FUNCTION private.notice_get_record(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.notice_get(p_society_id uuid, p_notice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Preserve the existing not-found response for users outside the society.
  IF private.has_role(p_society_id, ARRAY['admin', 'committee', 'resident']::text[]) THEN
    PERFORM private.notice_reconcile_on_read(p_society_id);
  END IF;
  RETURN private.notice_get_record(p_society_id, p_notice_id);
END;
$$;
REVOKE ALL ON FUNCTION public.notice_list(uuid, text, integer, integer), public.notice_get(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.notice_list(uuid, text, integer, integer), public.notice_get(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notice_scheduled_publish_run(p_society_id uuid, p_today date, p_request_trace text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  notice_row public.notices;
  recipient record;
  notified_count integer := 0;
  cutoff timestamptz;
BEGIN
  IF p_society_id IS NULL OR p_today IS NULL OR p_today > private.communication_today() THEN
    RAISE EXCEPTION 'The scheduled notice run is invalid.' USING ERRCODE = '22023';
  END IF;
  IF NOT private.module_enabled(p_society_id, 'notice') OR NOT private.society_writable(p_society_id) THEN RETURN 0; END IF;
  cutoff := LEAST(clock_timestamp(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  PERFORM private.notice_reconcile_due(p_society_id, cutoff);
  FOR notice_row IN SELECT * FROM public.notices
    WHERE society_id = p_society_id AND status = 'published' AND scheduled_for <= cutoff
      AND scheduled_notified_at IS NULL ORDER BY scheduled_for, id FOR UPDATE SKIP LOCKED
  LOOP
    IF notice_row.expires_at IS NULL OR notice_row.expires_at > clock_timestamp() THEN
      FOR recipient IN SELECT membership.user_id FROM public.memberships AS membership
        WHERE membership.society_id = p_society_id AND membership.status = 'active'
          AND membership.user_id IS NOT NULL AND membership.user_id <> notice_row.created_by
          AND membership.roles @> ARRAY['resident']::text[]
          AND private.notice_audience_includes(p_society_id, notice_row.id, notice_row.audience, membership.user_id)
      LOOP
        PERFORM private.create_notification(p_society_id, recipient.user_id, 'notice_published',
          CASE WHEN notice_row.pinned THEN 'Important notice' ELSE 'New notice' END,
          left(notice_row.title, 300), 'notice', notice_row.id, p_request_trace);
      END LOOP;
      notified_count := notified_count + 1;
    END IF;
    UPDATE public.notices SET scheduled_notified_at = clock_timestamp()
      WHERE society_id = p_society_id AND id = notice_row.id;
  END LOOP;
  RETURN notified_count;
END;
$$;
