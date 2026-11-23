-- Keep P46 dispute upload checks independent from invoker table privileges.
CREATE FUNCTION private.poll_election_dispute_file_insert_allowed(
  p_path text
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.poll_election_dispute_file_scope(p_path) IS NOT NULL
    AND split_part(p_path, '/', 5) = auth.uid()::text
    AND private.module_enabled(
      private.poll_election_dispute_file_scope(p_path), 'poll'
    )
    AND EXISTS (
      SELECT 1 FROM public.poll_election_voters AS voter
      WHERE voter.society_id = private.poll_election_dispute_file_scope(p_path)
        AND voter.election_id::text = split_part(p_path, '/', 3)
        AND voter.user_id = auth.uid()
        AND voter.removed_at IS NULL
    )
$$;
REVOKE ALL ON FUNCTION private.poll_election_dispute_file_insert_allowed(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.poll_election_dispute_file_insert_allowed(text)
  TO authenticated;

DROP POLICY poll_dispute_files_insert ON storage.objects;
CREATE POLICY poll_dispute_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'poll-dispute-files'
    AND private.poll_election_dispute_file_insert_allowed(name)
  );
