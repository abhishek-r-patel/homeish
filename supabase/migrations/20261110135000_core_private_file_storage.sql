INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('visitor-photos', 'visitor-photos', false, 5242880,
    ARRAY['image/jpeg', 'image/png']),
  ('delivery-photos', 'delivery-photos', false, 5242880,
    ARRAY['image/jpeg', 'image/png']),
  ('request-files', 'request-files', false, 5242880,
    ARRAY['image/jpeg', 'image/png', 'application/pdf']),
  ('payment-proofs', 'payment-proofs', false, 5242880,
    ARRAY['image/jpeg', 'image/png']),
  ('society-assets', 'society-assets', false, 5242880,
    ARRAY['image/jpeg', 'image/png', 'application/pdf']);

CREATE OR REPLACE FUNCTION private.file_society_id(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  first_segment text := pg_catalog.split_part(p_name, '/', 1);
BEGIN
  IF first_segment !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RETURN NULL;
  END IF;
  RETURN first_segment::uuid;
END;
$$;

REVOKE ALL ON FUNCTION private.file_society_id(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.file_society_id(text)
  TO authenticated, service_role;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY homeish_files_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    CASE bucket_id
      WHEN 'visitor-photos' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee', 'guard']::text[]
        )
      WHEN 'delivery-photos' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee', 'guard']::text[]
        )
      WHEN 'request-files' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
        )
      WHEN 'payment-proofs' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
        )
      WHEN 'society-assets' THEN
        private.is_member(private.file_society_id(name))
        OR private.is_developer()
      ELSE false
    END
  );

CREATE POLICY homeish_files_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    CASE bucket_id
      WHEN 'visitor-photos' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'guard']::text[]
        )
      WHEN 'delivery-photos' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'guard']::text[]
        )
      WHEN 'request-files' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
        )
      WHEN 'payment-proofs' THEN
        private.has_role(
          private.file_society_id(name),
          ARRAY['admin', 'committee']::text[]
        )
      WHEN 'society-assets' THEN
        private.has_role(private.file_society_id(name), ARRAY['admin']::text[])
        OR private.is_developer()
      ELSE false
    END
  );

CREATE POLICY homeish_files_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'society-assets'
    AND (
      private.has_role(private.file_society_id(name), ARRAY['admin']::text[])
      OR private.is_developer()
    )
  )
  WITH CHECK (
    bucket_id = 'society-assets'
    AND (
      private.has_role(private.file_society_id(name), ARRAY['admin']::text[])
      OR private.is_developer()
    )
  );

CREATE POLICY homeish_files_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'society-assets'
    AND (
      private.has_role(private.file_society_id(name), ARRAY['admin']::text[])
      OR private.is_developer()
    )
  );

CREATE OR REPLACE FUNCTION public.developer_update_society_logo(
  p_society_id uuid,
  p_logo_path text,
  p_request_id text
)
RETURNS public.societies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  before_row public.societies;
  after_row public.societies;
BEGIN
  IF NOT private.is_developer() THEN
    RAISE EXCEPTION 'Developer access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_logo_path IS NOT NULL AND (
    p_logo_path !~ (
      '^' || p_society_id::text ||
      '/logos/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-' ||
      '[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
    )
  ) THEN
    RAISE EXCEPTION 'The logo path is invalid.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO before_row
  FROM public.societies
  WHERE id = p_society_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The society was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.societies
  SET logo_path = p_logo_path,
      updated_by = current_user_id
  WHERE id = p_society_id
  RETURNING * INTO after_row;

  IF before_row.logo_path IS DISTINCT FROM after_row.logo_path THEN
    INSERT INTO public.audit_logs (
      society_id,
      actor_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      "before",
      "after",
      request_id
    )
    VALUES (
      p_society_id,
      current_user_id,
      'developer',
      'developer.societies.logo.update',
      'society',
      p_society_id::text,
      pg_catalog.jsonb_build_object('logo_path', before_row.logo_path),
      pg_catalog.jsonb_build_object('logo_path', after_row.logo_path),
      p_request_id
    );
  END IF;
  RETURN after_row;
END
$$;

REVOKE ALL ON FUNCTION public.developer_update_society_logo(uuid, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.developer_update_society_logo(uuid, text, text)
  TO authenticated;
