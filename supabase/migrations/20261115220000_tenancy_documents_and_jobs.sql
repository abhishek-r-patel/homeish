-- Issue authoritative private NOCs and maintain tenancy reminders and file retention.
ALTER TABLE public.tenancy_moves
  ADD COLUMN noc_prepared_at timestamptz,
  ADD COLUMN noc_prepared_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  ADD COLUMN noc_prepared_path text,
  ADD COLUMN noc_prepared_snapshot jsonb,
  ADD COLUMN noc_artifact_verified_at timestamptz,
  ADD COLUMN last_expiry_reminder_days integer CHECK (last_expiry_reminder_days IN (30, 7, 0)),
  ADD CONSTRAINT tenancy_moves_noc_preparation_check CHECK (
    (noc_prepared_at IS NULL AND noc_prepared_by IS NULL
      AND noc_prepared_path IS NULL AND noc_prepared_snapshot IS NULL
      AND noc_artifact_verified_at IS NULL)
    OR (kind = 'move_out' AND status = 'completed' AND noc_prepared_at IS NOT NULL
      AND noc_prepared_by IS NOT NULL AND noc_prepared_path IS NOT NULL
      AND noc_prepared_snapshot IS NOT NULL
      AND jsonb_typeof(noc_prepared_snapshot) = 'object')
  );
CREATE INDEX tenancy_moves_noc_prepared_by_idx ON public.tenancy_moves (noc_prepared_by);
CREATE INDEX tenancy_moves_expiry_idx
  ON public.tenancy_moves (society_id, agreement_expires_on, id)
  WHERE kind = 'move_in' AND status = 'completed';

CREATE FUNCTION private.tenancy_noc_deadline(p_move public.tenancy_moves)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (occupant.ended_at + interval '1 year') AT TIME ZONE society.timezone
  FROM public.unit_occupants AS occupant
  JOIN public.societies AS society ON society.id = occupant.society_id
  WHERE occupant.society_id = p_move.society_id AND occupant.id = p_move.occupancy_id
    AND occupant.unit_id = p_move.unit_id AND occupant.membership_id = p_move.tenant_membership_id
    AND occupant.relationship = 'tenant' AND occupant.status = 'ended'
    AND p_move.kind = 'move_out' AND p_move.status = 'completed'
$$;
REVOKE ALL ON FUNCTION private.tenancy_noc_deadline(public.tenancy_moves)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.tenancy_noc_prepare(
  p_society_id uuid, p_move_id uuid, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move public.tenancy_moves;
  document public.tenancy_documents;
  dues jsonb;
  society_timezone text;
  prepared_now timestamptz := clock_timestamp();
  snapshot jsonb;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  PERFORM 1 FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'tenancy' FOR SHARE;
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  SELECT * INTO move FROM public.tenancy_moves
    WHERE society_id = p_society_id AND id = p_move_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Move request not found.' USING ERRCODE = 'P0002'; END IF;
  prepared_now := clock_timestamp();
  IF private.tenancy_noc_deadline(move) IS NULL
    OR private.tenancy_noc_deadline(move) <= prepared_now
  THEN RAISE EXCEPTION 'A NOC is only available within one year of completed move-out.' USING ERRCODE = '23514'; END IF;
  SELECT * INTO document FROM public.tenancy_documents
    WHERE society_id = p_society_id AND move_id = p_move_id AND kind = 'noc';
  IF FOUND THEN
    IF document.deleted_at IS NOT NULL OR document.purge_after <= prepared_now THEN
      RAISE EXCEPTION 'The NOC retention period has ended.' USING ERRCODE = '23514';
    END IF;
    RETURN jsonb_build_object('status', 'issued', 'document_id', document.id, 'path', document.path);
  END IF;
  dues := private.tenancy_dues(p_society_id, move.unit_id, true);
  prepared_now := clock_timestamp();
  IF private.tenancy_noc_deadline(move) <= prepared_now THEN
    RAISE EXCEPTION 'The NOC retention period has ended.' USING ERRCODE = '23514';
  END IF;
  IF dues ->> 'status' = 'pending' THEN
    RAISE EXCEPTION 'Clear outstanding unit dues before issuing a NOC.' USING ERRCODE = '23514';
  END IF;
  SELECT timezone INTO society_timezone FROM public.societies WHERE id = p_society_id;
  IF move.noc_prepared_by = auth.uid()
    AND move.noc_prepared_at > prepared_now - interval '10 minutes'
    AND (move.noc_prepared_at AT TIME ZONE society_timezone)::date =
      (prepared_now AT TIME ZONE society_timezone)::date
    AND move.noc_prepared_snapshot -> 'dues' ->> 'status' = dues ->> 'status'
  THEN
    RETURN jsonb_build_object('status', 'prepared', 'path', move.noc_prepared_path,
      'expected_version', move.version, 'snapshot', move.noc_prepared_snapshot);
  END IF;
  PERFORM private.tenancy_assert_version(move.version, p_expected_version);
  IF move.noc_prepared_by IS NOT NULL AND move.noc_prepared_by <> auth.uid()
    AND move.noc_prepared_at > prepared_now - interval '10 minutes'
  THEN RAISE EXCEPTION 'Another administrator is preparing this NOC. Refresh and retry.' USING ERRCODE = '23505'; END IF;
  SELECT jsonb_build_object(
    'society_name', society.name, 'tenant_name', tenant.full_name,
    'unit_number', unit.number, 'move_date', occupant.ended_at,
    'issuer_name', issuer.full_name, 'issued_at', prepared_now,
    'timezone', society.timezone, 'dues', dues
  ) INTO snapshot
  FROM public.societies AS society
  JOIN public.units AS unit ON unit.society_id = society.id AND unit.id = move.unit_id
  JOIN public.unit_occupants AS occupant ON occupant.society_id = society.id AND occupant.id = move.occupancy_id
  JOIN public.memberships AS membership ON membership.society_id = society.id AND membership.id = move.tenant_membership_id
  JOIN public.profiles AS tenant ON tenant.id = membership.user_id
  JOIN public.profiles AS issuer ON issuer.id = auth.uid()
  WHERE society.id = p_society_id;
  IF snapshot IS NULL THEN RAISE EXCEPTION 'The NOC identity snapshot is unavailable.' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.tenancy_moves
  SET noc_prepared_at = prepared_now, noc_prepared_by = auth.uid(),
    noc_prepared_path = p_society_id::text || '/moves/' || p_move_id::text || '/noc/' || gen_random_uuid()::text || '.pdf',
    noc_prepared_snapshot = snapshot, noc_artifact_verified_at = NULL, version = version + 1,
    updated_at = prepared_now, updated_by = auth.uid()
  WHERE id = p_move_id RETURNING * INTO move;
  INSERT INTO public.audit_logs (society_id, actor_id, actor_role, action, entity_type, entity_id, request_id)
  VALUES (p_society_id, auth.uid(), 'admin', 'tenancy.noc.prepare', 'tenancy_move', move.id::text, p_request_id);
  RETURN jsonb_build_object('status', 'prepared', 'path', move.noc_prepared_path,
    'expected_version', move.version, 'snapshot', move.noc_prepared_snapshot);
END;
$$;

CREATE FUNCTION public.tenancy_noc_attest(
  p_society_id uuid, p_move_id uuid, p_issuer_id uuid, p_path text,
  p_expected_version integer, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move public.tenancy_moves;
  verified_now timestamptz;
  society_timezone text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid NOC request trace.' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  IF NOT private.module_enabled(p_society_id, 'tenancy') OR NOT private.society_writable(p_society_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.memberships AS membership
      JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE membership.society_id = p_society_id AND membership.user_id = p_issuer_id
        AND membership.status = 'active' AND 'admin' = ANY(membership.roles) AND profile.status = 'active'
    )
  THEN RAISE EXCEPTION 'NOC issuer is not available.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO move FROM public.tenancy_moves
    WHERE society_id = p_society_id AND id = p_move_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Move request not found.' USING ERRCODE = 'P0002'; END IF;
  PERFORM private.tenancy_assert_version(move.version, p_expected_version);
  verified_now := clock_timestamp();
  SELECT timezone INTO society_timezone FROM public.societies WHERE id = p_society_id;
  IF move.noc_prepared_by IS DISTINCT FROM p_issuer_id
    OR move.noc_prepared_path IS DISTINCT FROM p_path
    OR move.noc_prepared_at IS NULL OR move.noc_prepared_at <= verified_now - interval '10 minutes'
    OR (move.noc_prepared_at AT TIME ZONE society_timezone)::date <>
      (verified_now AT TIME ZONE society_timezone)::date
    OR private.tenancy_noc_deadline(move) IS NULL
    OR private.tenancy_noc_deadline(move) <= verified_now
  THEN RAISE EXCEPTION 'The NOC preparation changed or expired.' USING ERRCODE = '23505'; END IF;
  UPDATE public.tenancy_moves SET noc_artifact_verified_at = verified_now WHERE id = p_move_id;
  INSERT INTO public.audit_logs (society_id, actor_id, actor_role, action, entity_type, entity_id, request_id)
  VALUES (p_society_id, p_issuer_id, 'admin', 'tenancy.noc.verify', 'tenancy_move', p_move_id::text, p_request_id);
END;
$$;

CREATE FUNCTION public.tenancy_noc_issue(
  p_society_id uuid, p_move_id uuid, p_path text, p_expected_version integer, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move public.tenancy_moves;
  document_id uuid;
  deadline timestamptz;
  dues jsonb;
  object_metadata jsonb;
  society_timezone text;
  issued_now timestamptz := clock_timestamp();
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  PERFORM 1 FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'tenancy' FOR SHARE;
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  SELECT * INTO move FROM public.tenancy_moves
    WHERE society_id = p_society_id AND id = p_move_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Move request not found.' USING ERRCODE = 'P0002'; END IF;
  issued_now := clock_timestamp();
  deadline := private.tenancy_noc_deadline(move);
  IF deadline IS NULL OR deadline <= issued_now THEN
    RAISE EXCEPTION 'The NOC retention period has ended or move-out is incomplete.' USING ERRCODE = '23514';
  END IF;
  SELECT id INTO document_id FROM public.tenancy_documents
    WHERE society_id = p_society_id AND move_id = p_move_id AND kind = 'noc'
      AND path = p_path AND deleted_at IS NULL AND purge_after > issued_now;
  IF FOUND THEN RETURN document_id; END IF;
  PERFORM private.tenancy_assert_version(move.version, p_expected_version);
  dues := private.tenancy_dues(p_society_id, move.unit_id, true);
  issued_now := clock_timestamp();
  IF deadline <= issued_now THEN
    RAISE EXCEPTION 'The NOC retention period has ended.' USING ERRCODE = '23514';
  END IF;
  SELECT timezone INTO society_timezone FROM public.societies WHERE id = p_society_id;
  IF move.noc_prepared_by IS DISTINCT FROM auth.uid() OR move.noc_prepared_path IS DISTINCT FROM p_path
    OR move.noc_prepared_at IS NULL OR move.noc_prepared_at <= issued_now - interval '10 minutes'
    OR (move.noc_prepared_at AT TIME ZONE society_timezone)::date <>
      (issued_now AT TIME ZONE society_timezone)::date
  THEN RAISE EXCEPTION 'Refresh and prepare the NOC again before issuing it.' USING ERRCODE = '23505'; END IF;
  IF dues ->> 'status' = 'pending' THEN
    RAISE EXCEPTION 'Clear outstanding unit dues before issuing a NOC.' USING ERRCODE = '23514';
  END IF;
  IF dues ->> 'status' IS DISTINCT FROM move.noc_prepared_snapshot -> 'dues' ->> 'status' THEN
    RAISE EXCEPTION 'Billing availability changed. Refresh and prepare a new NOC.' USING ERRCODE = '23505';
  END IF;
  SELECT metadata INTO object_metadata FROM storage.objects
    WHERE bucket_id = 'tenancy-files' AND name = p_path;
  IF NOT FOUND OR object_metadata ->> 'mimetype' IS DISTINCT FROM 'application/pdf'
    OR COALESCE(object_metadata ->> 'size', '') !~ '^[0-9]{1,8}$'
  THEN RAISE EXCEPTION 'Upload the prepared NOC PDF before issuing it.' USING ERRCODE = '22023'; END IF;
  IF (object_metadata ->> 'size')::integer NOT BETWEEN 1 AND 5242880 THEN
    RAISE EXCEPTION 'The NOC PDF is too large.' USING ERRCODE = '22023';
  END IF;
  IF move.noc_artifact_verified_at IS NULL THEN
    RAISE EXCEPTION 'The approved NOC PDF must be verified by the server before issuance.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.tenancy_documents (
    society_id, move_id, kind, path, content_type, size_bytes, dues_status,
    dues_checked_at, purge_after, created_by
  ) VALUES (
    p_society_id, p_move_id, 'noc', p_path, 'application/pdf',
    (object_metadata ->> 'size')::integer, dues ->> 'status',
    (move.noc_prepared_snapshot -> 'dues' ->> 'checked_at')::timestamptz, deadline, auth.uid()
  ) RETURNING id INTO document_id;
  UPDATE public.tenancy_moves
  SET noc_prepared_at = NULL, noc_prepared_by = NULL, noc_prepared_path = NULL,
    noc_prepared_snapshot = NULL, noc_artifact_verified_at = NULL, version = version + 1,
    updated_at = issued_now, updated_by = auth.uid()
  WHERE id = p_move_id;
  PERFORM private.tenancy_event(p_move_id, 'noc_issued', NULL, p_request_id);
  RETURN document_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.tenancy_file_access(p_path text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_society_id uuid;
  target_move_id uuid;
  file_kind text;
  move public.tenancy_moves;
BEGIN
  IF p_path IS NULL OR p_path !~ (
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/moves/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/(rental_agreement|police_verification|noc)/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|pdf)$'
  ) THEN RETURN false; END IF;
  target_society_id := split_part(p_path, '/', 1)::uuid;
  target_move_id := split_part(p_path, '/', 3)::uuid;
  file_kind := split_part(p_path, '/', 4);
  IF auth.uid() IS NULL OR NOT private.module_enabled(target_society_id, 'tenancy')
    OR NOT private.is_member(target_society_id)
    OR NOT EXISTS (SELECT 1 FROM public.societies WHERE id = target_society_id AND status <> 'archived')
    OR NOT private.tenancy_can_read_move(target_society_id, target_move_id)
  THEN RETURN false; END IF;
  SELECT * INTO move FROM public.tenancy_moves AS item
    WHERE item.society_id = target_society_id AND item.id = target_move_id;
  IF p_write THEN
    RETURN private.society_writable(target_society_id) AND (
      (file_kind <> 'noc' AND move.kind = 'move_in'
        AND move.status IN ('awaiting_consent', 'pending_review', 'approved')
        AND EXISTS (
          SELECT 1 FROM public.unit_occupants AS occupant
          WHERE occupant.society_id = target_society_id AND occupant.id = move.occupancy_id
            AND occupant.unit_id = move.unit_id AND occupant.membership_id = move.tenant_membership_id
            AND occupant.status <> 'ended'
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.tenancy_documents AS document
          WHERE document.society_id = target_society_id AND document.move_id = target_move_id AND document.kind = file_kind
        ))
      OR (file_kind = 'noc' AND p_path = move.noc_prepared_path
        AND move.noc_prepared_by = auth.uid()
        AND move.noc_prepared_at > clock_timestamp() - interval '10 minutes'
        AND private.has_role(target_society_id, ARRAY['admin']::text[])
        AND private.tenancy_noc_deadline(move) > clock_timestamp()
        AND NOT EXISTS (
          SELECT 1 FROM public.tenancy_documents AS document
          WHERE document.society_id = target_society_id AND document.move_id = target_move_id AND document.kind = 'noc'
        ))
    );
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.tenancy_documents AS document
    WHERE document.society_id = target_society_id AND document.move_id = target_move_id AND document.path = p_path
      AND document.deleted_at IS NULL AND (document.purge_after IS NULL OR document.purge_after > clock_timestamp())
  ) OR private.tenancy_file_access(p_path, true);
END;
$$;

CREATE FUNCTION public.tenancy_reminders_run(p_society_id uuid, p_request_trace text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move public.tenancy_moves;
  today date;
  days_remaining integer;
  due_threshold integer;
  recipient record;
  sent integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid reminder trace.' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  IF NOT private.module_enabled(p_society_id, 'tenancy') OR NOT private.society_writable(p_society_id) THEN RETURN 0; END IF;
  today := private.housekeeping_local_date(p_society_id);
  FOR move IN SELECT candidate.* FROM public.tenancy_moves AS candidate
    JOIN public.unit_occupants AS occupant
      ON occupant.society_id = candidate.society_id AND occupant.id = candidate.occupancy_id
    WHERE candidate.society_id = p_society_id AND candidate.kind = 'move_in'
      AND candidate.status = 'completed' AND occupant.status = 'active'
    ORDER BY candidate.id FOR UPDATE OF candidate
  LOOP
    days_remaining := move.agreement_expires_on - today;
    SELECT min(threshold) INTO due_threshold FROM unnest(ARRAY[30, 7, 0]) AS threshold
      WHERE threshold >= days_remaining;
    IF due_threshold IS NULL OR
      (move.last_expiry_reminder_days IS NOT NULL AND move.last_expiry_reminder_days <= due_threshold)
    THEN CONTINUE; END IF;
    UPDATE public.tenancy_moves SET last_expiry_reminder_days = due_threshold WHERE id = move.id;
    FOR recipient IN SELECT DISTINCT membership.user_id, 'admin' = ANY(membership.roles) AS is_admin
      FROM public.memberships AS membership
      WHERE membership.society_id = p_society_id AND membership.status = 'active' AND membership.user_id IS NOT NULL
        AND ('admin' = ANY(membership.roles) OR (
          'resident' = ANY(membership.roles) AND EXISTS (
            SELECT 1 FROM public.unit_occupants AS owner
            WHERE owner.society_id = p_society_id AND owner.unit_id = move.unit_id
              AND owner.membership_id = membership.id AND owner.relationship = 'owner' AND owner.status = 'active'
          )
        ))
    LOOP
      PERFORM private.create_notification(p_society_id, recipient.user_id, 'tenancy_expiry',
        CASE WHEN due_threshold = 0 THEN 'Rental agreement expired' ELSE 'Rental agreement expiry reminder' END,
        'Review the rental agreement expiry date in Move-in / Move-out.',
        CASE WHEN recipient.is_admin THEN 'tenancy_admin' ELSE 'tenancy_move' END, move.id, p_request_trace);
      sent := sent + 1;
    END LOOP;
  END LOOP;
  RETURN sent;
END;
$$;

CREATE FUNCTION public.tenancy_proof_upload_path(
  p_society_id uuid, p_move_id uuid, p_kind text, p_content_type text, p_size_bytes integer
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  path text;
  extension text;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin', 'resident']::text[], true);
  IF p_kind IS NULL OR p_kind NOT IN ('rental_agreement', 'police_verification')
    OR p_content_type IS NULL OR p_content_type NOT IN ('application/pdf', 'image/jpeg', 'image/png')
    OR p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 5242880
  THEN RAISE EXCEPTION 'Use a PDF, JPG or PNG tenant proof up to 5 MiB.' USING ERRCODE = '22023'; END IF;
  extension := CASE p_content_type WHEN 'application/pdf' THEN '.pdf' WHEN 'image/jpeg' THEN '.jpg' ELSE '.png' END;
  path := p_society_id::text || '/moves/' || p_move_id::text || '/' || p_kind || '/' || gen_random_uuid()::text || extension;
  IF NOT COALESCE(private.tenancy_file_access(path, true), false) THEN
    RAISE EXCEPTION 'Move request not found or proof already attached.' USING ERRCODE = 'P0002';
  END IF;
  RETURN path;
END;
$$;

CREATE FUNCTION public.tenancy_retention_files_list(p_today date)
RETURNS TABLE(bucket text, path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutoff timestamptz;
  target_society_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR NOT isfinite(p_today) THEN
    RAISE EXCEPTION 'A retention date is required.' USING ERRCODE = '22023';
  END IF;
  cutoff := LEAST(clock_timestamp(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  -- Wait for already-running attachments, then recheck in the fresh RETURN QUERY snapshot.
  FOR target_society_id IN
    SELECT DISTINCT society.id FROM storage.objects AS object
    JOIN public.societies AS society ON society.id::text = split_part(object.name, '/', 1)
    WHERE object.bucket_id = 'tenancy-files' AND object.created_at <= cutoff - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM public.tenancy_documents AS document WHERE document.path = object.name)
    ORDER BY society.id
  LOOP
    PERFORM 1 FROM public.societies WHERE id = target_society_id FOR KEY SHARE;
    PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || target_society_id::text, 0));
  END LOOP;
  RETURN QUERY
    SELECT 'tenancy-files'::text, object.name FROM storage.objects AS object
    WHERE object.bucket_id = 'tenancy-files' AND (
      EXISTS (SELECT 1 FROM public.tenancy_documents AS document WHERE document.path = object.name
        AND (document.deleted_at IS NOT NULL OR document.purge_after <= cutoff))
      OR (object.created_at <= cutoff - interval '24 hours' AND NOT EXISTS (
        SELECT 1 FROM public.tenancy_documents AS document WHERE document.path = object.name
      ))
    ) ORDER BY object.name;
END;
$$;

CREATE FUNCTION public.tenancy_retention_run(p_today date, p_request_trace text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutoff timestamptz;
  document_count integer;
  preparation_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR NOT isfinite(p_today) OR p_request_trace IS NULL
    OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN RAISE EXCEPTION 'Invalid retention arguments.' USING ERRCODE = '22023'; END IF;
  cutoff := LEAST(clock_timestamp(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  UPDATE public.tenancy_documents AS document SET deleted_at = clock_timestamp()
  WHERE document.deleted_at IS NULL AND document.purge_after <= cutoff
    AND NOT EXISTS (
      SELECT 1 FROM storage.objects AS object WHERE object.bucket_id = 'tenancy-files' AND object.name = document.path
    );
  GET DIAGNOSTICS document_count = ROW_COUNT;
  UPDATE public.tenancy_moves SET noc_prepared_at = NULL, noc_prepared_by = NULL,
    noc_prepared_path = NULL, noc_prepared_snapshot = NULL, noc_artifact_verified_at = NULL
  WHERE noc_prepared_at <= cutoff - interval '10 minutes';
  GET DIAGNOSTICS preparation_count = ROW_COUNT;
  RETURN jsonb_build_object('documents_deleted', document_count, 'preparations_cleared', preparation_count);
END;
$$;

REVOKE ALL ON FUNCTION public.tenancy_noc_prepare(uuid, uuid, integer, text),
  public.tenancy_noc_issue(uuid, uuid, text, integer, text),
  public.tenancy_proof_upload_path(uuid, uuid, text, text, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenancy_noc_prepare(uuid, uuid, integer, text),
  public.tenancy_noc_issue(uuid, uuid, text, integer, text),
  public.tenancy_proof_upload_path(uuid, uuid, text, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.tenancy_reminders_run(uuid, text),
  public.tenancy_noc_attest(uuid, uuid, uuid, text, integer, text),
  public.tenancy_retention_files_list(date), public.tenancy_retention_run(date, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenancy_reminders_run(uuid, text),
  public.tenancy_noc_attest(uuid, uuid, uuid, text, integer, text),
  public.tenancy_retention_files_list(date), public.tenancy_retention_run(date, text) TO service_role;
