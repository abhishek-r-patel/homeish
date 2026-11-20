-- Owner-reviewed P53 access: admin-only official plans/contact writes and reviewed committee proposals.
CREATE FUNCTION private.communication_admin_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.core_toolkit_authorize(NEW.society_id, ARRAY['admin']::text[], true);
  IF TG_TABLE_NAME = 'notice_plans' AND NOT private.module_enabled(NEW.society_id, 'notice') THEN
    RAISE EXCEPTION 'Notices are not available.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.communication_admin_write() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER member_contact_logs_admin_write BEFORE INSERT OR UPDATE ON public.member_contact_logs
  FOR EACH ROW EXECUTE FUNCTION private.communication_admin_write();
CREATE TRIGGER notice_plans_admin_write BEFORE INSERT OR UPDATE ON public.notice_plans
  FOR EACH ROW EXECUTE FUNCTION private.communication_admin_write();

CREATE TABLE public.notice_plan_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  notice_id uuid NOT NULL,
  prepared_by text CHECK (prepared_by IS NULL OR (prepared_by = btrim(prepared_by) AND char_length(prepared_by) BETWEEN 1 AND 80)),
  display_location text CHECK (display_location IS NULL OR (display_location = btrim(display_location) AND char_length(display_location) BETWEEN 1 AND 120)),
  priority text CHECK (priority IN ('high', 'medium', 'low')),
  next_action text CHECK (next_action IS NULL OR (next_action = btrim(next_action) AND char_length(next_action) BETWEEN 1 AND 200)),
  next_action_on date,
  base_plan_updated_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  proposed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  client_request_id uuid NOT NULL,
  UNIQUE (society_id, id),
  UNIQUE (society_id, proposed_by, client_request_id),
  FOREIGN KEY (society_id, notice_id) REFERENCES public.notices(society_id, id) ON DELETE RESTRICT,
  CHECK (next_action_on IS NULL OR next_action IS NOT NULL),
  CHECK ((status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status <> 'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX notice_plan_proposals_notice_idx ON public.notice_plan_proposals(society_id, notice_id, created_at DESC);
CREATE INDEX notice_plan_proposals_proposed_by_idx ON public.notice_plan_proposals(proposed_by);
CREATE INDEX notice_plan_proposals_reviewed_by_idx ON public.notice_plan_proposals(reviewed_by);
ALTER TABLE public.notice_plan_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notice_plan_proposals FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY notice_plan_proposals_no_direct_access ON public.notice_plan_proposals
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER notice_plan_proposals_reject_delete BEFORE DELETE ON public.notice_plan_proposals
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER notice_plan_proposals_reject_truncate BEFORE TRUNCATE ON public.notice_plan_proposals
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.notice_plan_proposal_preserve()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status <> 'pending'
    OR (to_jsonb(NEW) - ARRAY['status', 'reviewed_by', 'reviewed_at'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'reviewed_by', 'reviewed_at']) THEN
    RAISE EXCEPTION 'Proposal content and review history cannot be changed.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.notice_plan_proposal_preserve() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER notice_plan_proposal_preserve BEFORE UPDATE ON public.notice_plan_proposals
  FOR EACH ROW EXECUTE FUNCTION private.notice_plan_proposal_preserve();

CREATE FUNCTION private.notice_plan_proposal_json(p_proposal public.notice_plan_proposals)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (to_jsonb(p_proposal) - 'client_request_id' - 'base_plan_updated_at')
    || jsonb_build_object('proposed_by_name', private.core_toolkit_person(p_proposal.proposed_by))
$$;
REVOKE ALL ON FUNCTION private.notice_plan_proposal_json(public.notice_plan_proposals)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.notice_plan_proposals_get(p_society_id uuid, p_notice_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.core_toolkit_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  IF NOT private.module_enabled(p_society_id, 'notice') THEN
    RAISE EXCEPTION 'Notices are not available.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notices WHERE society_id = p_society_id AND id = p_notice_id) THEN
    RAISE EXCEPTION 'Notice not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(private.notice_plan_proposal_json(proposal) ORDER BY proposal.created_at DESC, proposal.id)
    FROM (SELECT * FROM public.notice_plan_proposals
      WHERE society_id = p_society_id AND notice_id = p_notice_id ORDER BY created_at DESC, id LIMIT 100) AS proposal), '[]'::jsonb);
END;
$$;

CREATE FUNCTION public.notice_plan_proposal_save(
  p_society_id uuid, p_notice_id uuid, p_values jsonb, p_client_request_id uuid, p_request_trace text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  proposal public.notice_plan_proposals;
  plan_updated_at timestamptz;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['committee']::text[]);
  IF NOT private.module_enabled(p_society_id, 'notice') THEN
    RAISE EXCEPTION 'Notices are not available.' USING ERRCODE = '42501';
  END IF;
  IF p_client_request_id IS NULL OR p_values IS NULL OR jsonb_typeof(p_values) <> 'object'
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_values) AS key
      WHERE key NOT IN ('prepared_by', 'display_location', 'priority', 'next_action', 'next_action_on')) THEN
    RAISE EXCEPTION 'The proposal is invalid.' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.notices WHERE society_id = p_society_id AND id = p_notice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Notice not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO proposal FROM public.notice_plan_proposals
    WHERE society_id = p_society_id AND proposed_by = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN private.notice_plan_proposal_json(proposal); END IF;
  SELECT updated_at INTO plan_updated_at FROM public.notice_plans
    WHERE society_id = p_society_id AND notice_id = p_notice_id;
  INSERT INTO public.notice_plan_proposals (
    society_id, notice_id, prepared_by, display_location, priority, next_action, next_action_on,
    base_plan_updated_at, proposed_by, client_request_id
  ) VALUES (
    p_society_id, p_notice_id,
    private.core_toolkit_clean_text(p_values->>'prepared_by', 80, 'prepared by', false),
    private.core_toolkit_clean_text(p_values->>'display_location', 120, 'display location', false),
    NULLIF(p_values->>'priority', ''),
    private.core_toolkit_clean_text(p_values->>'next_action', 200, 'next action', false),
    NULLIF(p_values->>'next_action_on', '')::date,
    plan_updated_at, auth.uid(), p_client_request_id
  ) RETURNING * INTO proposal;
  PERFORM private.core_toolkit_audit(
    p_society_id, 'notice.plan_propose', 'notice_plan_proposal', proposal.id::text,
    NULL, jsonb_build_object('notice_id', p_notice_id), p_request_trace
  );
  RETURN private.notice_plan_proposal_json(proposal);
END;
$$;

CREATE FUNCTION public.notice_plan_proposal_review(
  p_society_id uuid, p_proposal_id uuid, p_accept boolean, p_request_trace text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  proposal public.notice_plan_proposals;
  plan_updated_at timestamptz;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF NOT private.module_enabled(p_society_id, 'notice') THEN
    RAISE EXCEPTION 'Notices are not available.' USING ERRCODE = '42501';
  END IF;
  IF p_accept IS NULL THEN RAISE EXCEPTION 'Choose a review action.' USING ERRCODE = '22023'; END IF;
  -- All planning writes lock the notice before the proposal to avoid conflicting lock orders.
  PERFORM 1 FROM public.notices AS notice JOIN public.notice_plan_proposals AS candidate
    ON candidate.society_id = notice.society_id AND candidate.notice_id = notice.id
    WHERE candidate.society_id = p_society_id AND candidate.id = p_proposal_id FOR UPDATE OF notice;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO proposal FROM public.notice_plan_proposals
    WHERE society_id = p_society_id AND id = p_proposal_id FOR UPDATE;
  IF proposal.status = (CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END) THEN
    RETURN private.notice_plan_proposal_json(proposal);
  END IF;
  IF proposal.status <> 'pending' THEN
    RAISE EXCEPTION 'This proposal was already reviewed.' USING ERRCODE = '23505', HINT = 'invalid_state';
  END IF;
  IF p_accept THEN
    SELECT updated_at INTO plan_updated_at FROM public.notice_plans
      WHERE society_id = p_society_id AND notice_id = proposal.notice_id;
    IF plan_updated_at IS DISTINCT FROM proposal.base_plan_updated_at THEN
      RAISE EXCEPTION 'The official plan changed. Request a fresh proposal.'
        USING ERRCODE = '23505', HINT = 'stale_record';
    END IF;
    PERFORM public.notice_plan_save(p_society_id, proposal.notice_id, proposal.prepared_by,
      proposal.display_location, proposal.priority, proposal.next_action, proposal.next_action_on, p_request_trace);
  END IF;
  UPDATE public.notice_plan_proposals SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
    reviewed_by = auth.uid(), reviewed_at = clock_timestamp()
    WHERE society_id = p_society_id AND id = p_proposal_id RETURNING * INTO proposal;
  PERFORM private.core_toolkit_audit(
    p_society_id, CASE WHEN p_accept THEN 'notice.plan_accept' ELSE 'notice.plan_reject' END,
    'notice_plan_proposal', proposal.id::text, NULL,
    jsonb_build_object('notice_id', proposal.notice_id, 'status', proposal.status), p_request_trace
  );
  RETURN private.notice_plan_proposal_json(proposal);
END;
$$;
REVOKE ALL ON FUNCTION public.notice_plan_proposals_get(uuid, uuid),
  public.notice_plan_proposal_save(uuid, uuid, jsonb, uuid, text),
  public.notice_plan_proposal_review(uuid, uuid, boolean, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.notice_plan_proposals_get(uuid, uuid),
  public.notice_plan_proposal_save(uuid, uuid, jsonb, uuid, text),
  public.notice_plan_proposal_review(uuid, uuid, boolean, text) TO authenticated;
