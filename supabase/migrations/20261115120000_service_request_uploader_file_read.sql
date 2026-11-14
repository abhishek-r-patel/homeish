-- Service request photos: let the uploader read their own not-yet-attached photo so the
-- create operation can verify its type and size before saving the request.
CREATE POLICY service_request_files_uploader_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'request-files'
    AND private.module_enabled(
      private.file_society_id(name), 'service_request'
    )
    AND private.has_role(
      private.file_society_id(name), ARRAY['admin', 'resident']::text[]
    )
    AND private.is_service_request_file_owner(name)
  );
