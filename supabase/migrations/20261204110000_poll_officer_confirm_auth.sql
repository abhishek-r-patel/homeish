-- Authorize returning officers before validating their P46 conflict confirmation.
CREATE OR REPLACE FUNCTION public.poll_election_officer_confirm(
  p_society_id uuid, p_election_id uuid, p_confirmation text,
  p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE officer_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'poll') THEN
    RAISE EXCEPTION 'Returning officer access is not available.'
      USING ERRCODE = '42501';
  END IF;
  SELECT officer.id INTO officer_id
  FROM public.poll_election_officers AS officer
  WHERE officer.society_id = p_society_id
    AND officer.election_id = p_election_id AND officer.revoked_at IS NULL
    AND (
      (
        officer.profile_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.memberships AS membership
          WHERE membership.society_id = officer.society_id
            AND membership.user_id = auth.uid()
            AND membership.status = 'active'
        )
      )
      OR (
        officer.invited_email IS NOT NULL
        AND lower(auth.jwt() ->> 'email') = lower(officer.invited_email)
      )
    ) FOR UPDATE;
  IF officer_id IS NULL THEN
    RAISE EXCEPTION 'Returning officer access is not available.' USING ERRCODE = '42501';
  END IF;
  IF p_confirmation IS NULL OR p_confirmation <>
    'I am not a candidate and have no conflict of interest'
  THEN
    RAISE EXCEPTION 'Confirm that you have no conflict and are not a candidate.'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.poll_election_nominations
    WHERE society_id = p_society_id AND election_id = p_election_id
      AND candidate_user_id = auth.uid() AND status <> 'withdrawn'
  ) THEN
    RAISE EXCEPTION 'A candidate cannot confirm as returning officer.'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.poll_election_officers SET
    accepted_at = COALESCE(accepted_at, clock_timestamp()),
    conflict_confirmed_at = COALESCE(conflict_confirmed_at, clock_timestamp()),
    invited_user_id = CASE WHEN profile_id IS NULL THEN auth.uid()
      ELSE invited_user_id END
  WHERE society_id = p_society_id AND id = officer_id;
  PERFORM private.poll_audit(
    p_society_id, 'official_election.officer.confirm', 'poll_election',
    p_election_id, jsonb_build_object('confirmation', p_confirmation),
    p_request_trace
  );
  RETURN officer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.poll_election_officer_confirm(
  uuid, uuid, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poll_election_officer_confirm(
  uuid, uuid, text, text
) TO authenticated;
