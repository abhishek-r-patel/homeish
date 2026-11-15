-- P19 document repository: admin-managed folders, audience-scoped and unit-issued documents,
-- archived-never-deleted versions, private files and audited short-lived download links.

CREATE TABLE public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 80),
  audience text NOT NULL CHECK (audience IN ('all_residents', 'owners_only', 'committee_admins')),
  system_key text CHECK (system_key IN ('bylaws', 'minutes', 'audit_reports', 'circulars', 'nocs')),
  sort_order integer NOT NULL DEFAULT 100 CHECK (sort_order BETWEEN 0 AND 100000),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  archived_at timestamptz,
  archived_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT document_folders_creator_check CHECK (created_by IS NOT NULL OR system_key IS NOT NULL),
  CONSTRAINT document_folders_archive_check CHECK ((archived_at IS NULL) = (archived_by IS NULL)),
  UNIQUE (society_id, id),
  UNIQUE (society_id, system_key)
);
CREATE UNIQUE INDEX document_folders_active_name_idx
  ON public.document_folders (society_id, lower(name)) WHERE archived_at IS NULL;
CREATE INDEX document_folders_order_idx ON public.document_folders (society_id, sort_order, id);
CREATE INDEX document_folders_created_by_idx ON public.document_folders (created_by);
CREATE INDEX document_folders_updated_by_idx ON public.document_folders (updated_by);
CREATE INDEX document_folders_archived_by_idx ON public.document_folders (archived_by);

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  folder_id uuid,
  unit_id uuid,
  unit_audience text CHECK (unit_audience IN ('all_occupants', 'owners_only')),
  title text NOT NULL CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 120),
  description text CHECK (
    description IS NULL OR (description = btrim(description) AND char_length(description) BETWEEN 1 AND 500)
  ),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  archived_at timestamptz,
  archived_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT documents_target_check CHECK (
    (folder_id IS NULL) <> (unit_id IS NULL) AND (unit_id IS NULL) = (unit_audience IS NULL)
  ),
  CONSTRAINT documents_archive_check CHECK ((archived_at IS NULL) = (archived_by IS NULL)),
  CONSTRAINT documents_folder_fkey FOREIGN KEY (society_id, folder_id)
    REFERENCES public.document_folders (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT documents_unit_fkey FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX documents_folder_idx ON public.documents (society_id, folder_id, updated_at DESC, id);
CREATE INDEX documents_unit_idx ON public.documents (society_id, unit_id, updated_at DESC, id);
CREATE INDEX documents_created_by_idx ON public.documents (created_by);
CREATE INDEX documents_updated_by_idx ON public.documents (updated_by);
CREATE INDEX documents_archived_by_idx ON public.documents (archived_by);

CREATE TABLE public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  document_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number >= 1),
  path text NOT NULL UNIQUE CHECK (char_length(path) BETWEEN 1 AND 500),
  file_name text NOT NULL CHECK (file_name = btrim(file_name) AND char_length(file_name) BETWEEN 1 AND 200),
  content_type text NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  note text CHECK (note IS NULL OR (note = btrim(note) AND char_length(note) BETWEEN 1 AND 500)),
  archived_at timestamptz,
  archived_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT document_versions_archive_check CHECK ((archived_at IS NULL) = (archived_by IS NULL)),
  CONSTRAINT document_versions_document_fkey FOREIGN KEY (society_id, document_id)
    REFERENCES public.documents (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, document_id, version_number)
);
CREATE INDEX document_versions_created_by_idx ON public.document_versions (created_by);
CREATE INDEX document_versions_archived_by_idx ON public.document_versions (archived_by);

-- Versions are immutable records; only their archive markers may change.
CREATE FUNCTION private.document_version_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (NEW.id, NEW.society_id, NEW.document_id, NEW.version_number, NEW.path, NEW.file_name,
      NEW.content_type, NEW.size_bytes, NEW.note, NEW.created_at, NEW.created_by)
    IS DISTINCT FROM
     (OLD.id, OLD.society_id, OLD.document_id, OLD.version_number, OLD.path, OLD.file_name,
      OLD.content_type, OLD.size_bytes, OLD.note, OLD.created_at, OLD.created_by)
  THEN
    RAISE EXCEPTION 'Document versions cannot be changed; upload a new version instead.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.document_version_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER document_versions_immutable BEFORE UPDATE ON public.document_versions
  FOR EACH ROW EXECUTE FUNCTION private.document_version_guard();

CREATE TRIGGER document_folders_no_delete BEFORE DELETE ON public.document_folders
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER document_folders_no_truncate BEFORE TRUNCATE ON public.document_folders
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER documents_no_delete BEFORE DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER documents_no_truncate BEFORE TRUNCATE ON public.documents
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER document_versions_no_delete BEFORE DELETE ON public.document_versions
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER document_versions_no_truncate BEFORE TRUNCATE ON public.document_versions
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

-- Audience helpers take the user explicitly so notification fan-out reuses the same rules.
CREATE FUNCTION private.document_available(p_society_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.module_enabled(p_society_id, 'document')
    AND EXISTS (SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived')
$$;

CREATE FUNCTION private.document_user_has_role(p_society_id uuid, p_user_id uuid, p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id AND membership.user_id = p_user_id
      AND membership.status = 'active' AND membership.roles && p_roles
  )
$$;

CREATE FUNCTION private.document_user_is_owner(p_society_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_society_id AND occupant.relationship = 'owner'
      AND occupant.status = 'active' AND membership.status = 'active'
      AND membership.user_id = p_user_id AND 'resident' = ANY(membership.roles)
  )
$$;

-- Audience membership only (no staff shortcut): used for notification recipients.
CREATE FUNCTION private.document_in_folder_audience(p_society_id uuid, p_user_id uuid, p_audience text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE p_audience
    WHEN 'all_residents' THEN private.document_user_has_role(p_society_id, p_user_id, ARRAY['resident']::text[])
    WHEN 'owners_only' THEN private.document_user_is_owner(p_society_id, p_user_id)
    WHEN 'committee_admins' THEN private.document_user_has_role(p_society_id, p_user_id, ARRAY['admin', 'committee']::text[])
    ELSE false
  END
$$;

CREATE FUNCTION private.document_in_unit_audience(
  p_society_id uuid, p_user_id uuid, p_unit_id uuid, p_unit_audience text
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user_id IS NOT NULL AND p_unit_audience IN ('all_occupants', 'owners_only') AND EXISTS (
    SELECT 1 FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_society_id AND occupant.unit_id = p_unit_id
      AND occupant.status = 'active' AND membership.status = 'active'
      AND membership.user_id = p_user_id AND 'resident' = ANY(membership.roles)
      AND (p_unit_audience = 'all_occupants' OR occupant.relationship = 'owner')
  )
$$;

CREATE FUNCTION private.document_user_is_staff(p_society_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.document_user_has_role(p_society_id, p_user_id, ARRAY['admin', 'committee']::text[])
$$;

CREATE FUNCTION private.document_user_can_see_folder(p_society_id uuid, p_user_id uuid, p_folder_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.document_available(p_society_id) AND EXISTS (
    SELECT 1 FROM public.document_folders AS folder
    WHERE folder.society_id = p_society_id AND folder.id = p_folder_id
      AND (
        private.document_user_is_staff(p_society_id, p_user_id)
        OR (folder.archived_at IS NULL
          AND private.document_in_folder_audience(p_society_id, p_user_id, folder.audience))
      )
  )
$$;

CREATE FUNCTION private.document_user_can_see(p_society_id uuid, p_user_id uuid, p_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.document_available(p_society_id) AND EXISTS (
    SELECT 1 FROM public.documents AS document
    LEFT JOIN public.document_folders AS folder
      ON folder.society_id = document.society_id AND folder.id = document.folder_id
    WHERE document.society_id = p_society_id AND document.id = p_document_id
      AND (
        private.document_user_is_staff(p_society_id, p_user_id)
        OR (document.archived_at IS NULL AND (
          (document.folder_id IS NOT NULL AND folder.archived_at IS NULL
            AND private.document_in_folder_audience(p_society_id, p_user_id, folder.audience))
          OR (document.unit_id IS NOT NULL
            AND private.document_in_unit_audience(p_society_id, p_user_id, document.unit_id, document.unit_audience))
        ))
      )
  )
$$;

CREATE FUNCTION private.document_current_version_id(p_society_id uuid, p_document_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT version.id FROM public.document_versions AS version
  WHERE version.society_id = p_society_id AND version.document_id = p_document_id
    AND version.archived_at IS NULL
  ORDER BY version.version_number DESC LIMIT 1
$$;

-- Residents see only the current version; admins and committee see the full history.
CREATE FUNCTION private.document_user_can_see_version(p_society_id uuid, p_user_id uuid, p_version_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_versions AS version
    WHERE version.society_id = p_society_id AND version.id = p_version_id
      AND private.document_user_can_see(p_society_id, p_user_id, version.document_id)
      AND (
        private.document_user_is_staff(p_society_id, p_user_id)
        OR version.id = private.document_current_version_id(p_society_id, version.document_id)
      )
  )
$$;

REVOKE ALL ON FUNCTION private.document_available(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.document_user_has_role(uuid, uuid, text[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.document_user_is_owner(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.document_in_folder_audience(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.document_in_unit_audience(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.document_user_is_staff(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.document_user_can_see_folder(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.document_user_can_see(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.document_current_version_id(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.document_user_can_see_version(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
-- All reads and writes go through the audited RPCs below; the tables are never exposed directly.
REVOKE ALL ON public.document_folders, public.documents, public.document_versions
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY document_folders_no_direct_access ON public.document_folders
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY documents_no_direct_access ON public.documents
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY document_versions_no_direct_access ON public.document_versions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE FUNCTION private.document_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'document')
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived')
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Document access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.document_authorize(uuid, text[], boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_lock_writer(p_society_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.document_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.document_authorize(p_society_id, ARRAY['admin']::text[], true);
END;
$$;
REVOKE ALL ON FUNCTION private.document_lock_writer(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_assert_version(p_actual integer, p_expected integer, p_label text)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF p_expected IS NULL OR p_expected < 1 THEN
    RAISE EXCEPTION 'A current version is required.' USING ERRCODE = '22023';
  END IF;
  IF p_actual <> p_expected THEN
    RAISE EXCEPTION 'This % changed. Refresh before trying again.', p_label USING ERRCODE = '40001';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.document_assert_version(integer, integer, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_audit(
  p_society_id uuid, p_action text, p_entity_type text, p_entity_id uuid, p_after jsonb, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(),
    CASE WHEN private.has_role(p_society_id, ARRAY['admin']::text[]) THEN 'admin'
      WHEN private.has_role(p_society_id, ARRAY['committee']::text[]) THEN 'committee'
      ELSE 'resident' END,
    p_action, p_entity_type, p_entity_id::text, p_after, p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.document_audit(uuid, text, text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Bounded, per-society fan-out to the document's audience (never other societies, never the actor).
CREATE FUNCTION private.document_notify(
  p_society_id uuid, p_document_id uuid, p_title text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  document public.documents;
  folder_audience text;
  recipient record;
BEGIN
  SELECT * INTO STRICT document FROM public.documents
    WHERE society_id = p_society_id AND id = p_document_id;
  IF document.archived_at IS NOT NULL THEN RETURN; END IF;
  IF document.folder_id IS NOT NULL THEN
    SELECT CASE WHEN folder.archived_at IS NULL THEN folder.audience END INTO folder_audience
    FROM public.document_folders AS folder
    WHERE folder.society_id = p_society_id AND folder.id = document.folder_id;
    IF folder_audience IS NULL THEN RETURN; END IF;
  END IF;
  FOR recipient IN
    SELECT membership.user_id
    FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id
      AND membership.status = 'active'
      AND membership.user_id IS NOT NULL
      AND membership.user_id IS DISTINCT FROM auth.uid()
      AND CASE WHEN document.folder_id IS NOT NULL
        THEN private.document_in_folder_audience(p_society_id, membership.user_id, folder_audience)
        ELSE private.document_in_unit_audience(
          p_society_id, membership.user_id, document.unit_id, document.unit_audience)
      END
    ORDER BY membership.id
    LIMIT 5000
  LOOP
    PERFORM private.create_notification(
      p_society_id, recipient.user_id, 'document_published', p_title,
      pg_catalog.left(document.title, 300),
      CASE WHEN folder_audience = 'committee_admins' THEN 'document_admin' ELSE 'document' END,
      document.id, p_request_id
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.document_notify(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Seed the five standard folders the first time the module is enabled for a society.
-- A trigger (not lazy creation on read) keeps reads side-effect free and works for every
-- enable path; system_key keeps renamed or archived defaults from ever being re-created.
CREATE FUNCTION private.document_seed_folders(p_society_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.document_folders WHERE society_id = p_society_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.document_folders (society_id, name, audience, system_key, sort_order)
  SELECT p_society_id, seed.name, seed.audience, seed.system_key, seed.sort_order
  FROM (VALUES
    ('Bylaws', 'all_residents', 'bylaws', 10),
    ('Minutes', 'all_residents', 'minutes', 20),
    ('Audit reports', 'owners_only', 'audit_reports', 30),
    ('Circulars', 'all_residents', 'circulars', 40),
    ('NOCs', 'all_residents', 'nocs', 50)
  ) AS seed(name, audience, system_key, sort_order)
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION private.document_seed_folders(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_seed_folders_on_enable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.module_key = 'document' AND NEW.enabled AND (TG_OP = 'INSERT' OR NOT OLD.enabled) THEN
    PERFORM private.document_seed_folders(NEW.society_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.document_seed_folders_on_enable()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER module_configs_document_seed_folders
  AFTER INSERT OR UPDATE OF enabled ON public.module_configs
  FOR EACH ROW EXECUTE FUNCTION private.document_seed_folders_on_enable();

SELECT private.document_seed_folders(config.society_id)
FROM public.module_configs AS config
WHERE config.module_key = 'document' AND config.enabled;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('document-files', 'document-files', false, 5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']);

-- Uploads: admins only. Reads: a visible version whose download was audited in the last
-- five minutes, so every signed link is tied to an audit row.
CREATE FUNCTION private.document_file_access(p_path text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_society_id uuid;
  target_version_id uuid;
BEGIN
  IF p_path IS NULL OR p_path !~ (
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/documents/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png)$'
  ) OR auth.uid() IS NULL THEN RETURN false; END IF;
  target_society_id := split_part(p_path, '/', 1)::uuid;
  IF NOT private.document_available(target_society_id) THEN RETURN false; END IF;
  IF p_write THEN
    RETURN private.has_role(target_society_id, ARRAY['admin']::text[])
      AND private.society_writable(target_society_id)
      AND NOT EXISTS (SELECT 1 FROM public.document_versions WHERE path = p_path);
  END IF;
  SELECT version.id INTO target_version_id FROM public.document_versions AS version
    WHERE version.society_id = target_society_id AND version.path = p_path;
  RETURN target_version_id IS NOT NULL
    AND private.document_user_can_see_version(target_society_id, auth.uid(), target_version_id)
    AND EXISTS (
      SELECT 1 FROM public.audit_logs AS audit
      WHERE audit.society_id = target_society_id AND audit.entity_type = 'document_version'
        AND audit.entity_id = target_version_id::text AND audit.action = 'document.download'
        AND audit.actor_id = auth.uid() AND audit.created_at > clock_timestamp() - interval '5 minutes'
    );
END;
$$;
REVOKE ALL ON FUNCTION private.document_file_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.document_file_access(text, boolean) TO authenticated;
CREATE POLICY document_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'document-files' AND private.document_file_access(name, false));
CREATE POLICY document_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'document-files' AND private.document_file_access(name, true));

-- Validate a freshly uploaded object before a version row points at it.
CREATE FUNCTION private.document_uploaded_file(p_society_id uuid, p_path text)
RETURNS TABLE (content_type text, size_bytes integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  object_metadata jsonb;
BEGIN
  IF p_path IS NULL OR split_part(p_path, '/', 1) <> p_society_id::text
    OR NOT private.document_file_access(p_path, true)
  THEN
    RAISE EXCEPTION 'The uploaded file is not available.' USING ERRCODE = '22023';
  END IF;
  SELECT object.metadata INTO object_metadata FROM storage.objects AS object
    WHERE object.bucket_id = 'document-files' AND object.name = p_path
      AND object.created_at > clock_timestamp() - interval '24 hours';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Uploaded file not found or the upload expired. Upload it again.' USING ERRCODE = 'P0002';
  END IF;
  content_type := object_metadata ->> 'mimetype';
  IF COALESCE(object_metadata ->> 'size', '') !~ '^[0-9]{1,8}$' THEN
    RAISE EXCEPTION 'The uploaded file size is invalid.' USING ERRCODE = '22023';
  END IF;
  size_bytes := (object_metadata ->> 'size')::integer;
  IF size_bytes NOT BETWEEN 1 AND 5242880 OR content_type IS NULL OR NOT (
    (content_type = 'application/pdf' AND right(p_path, 4) = '.pdf')
    OR (content_type = 'image/jpeg' AND right(p_path, 4) = '.jpg')
    OR (content_type = 'image/png' AND right(p_path, 4) = '.png')
  ) THEN
    RAISE EXCEPTION 'Use a PDF, JPG or PNG up to 5 MiB.' USING ERRCODE = '22023';
  END IF;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION private.document_uploaded_file(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_clean_text(p_value text, p_max integer, p_label text, p_required boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  cleaned text := NULLIF(btrim(COALESCE(p_value, '')), '');
BEGIN
  IF cleaned IS NULL AND p_required THEN
    RAISE EXCEPTION 'Enter a %.', p_label USING ERRCODE = '22023';
  END IF;
  IF char_length(cleaned) > p_max THEN
    RAISE EXCEPTION 'Keep the % to % characters.', p_label, p_max USING ERRCODE = '22023';
  END IF;
  RETURN cleaned;
END;
$$;
REVOKE ALL ON FUNCTION private.document_clean_text(text, integer, text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_folder_json(p_folder public.document_folders, p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p_folder.id, 'name', p_folder.name, 'audience', p_folder.audience,
    'system_key', p_folder.system_key, 'sort_order', p_folder.sort_order,
    'version', p_folder.version, 'archived_at', p_folder.archived_at,
    'updated_at', p_folder.updated_at,
    'document_count', (
      SELECT count(*) FROM public.documents AS document
      WHERE document.society_id = p_folder.society_id AND document.folder_id = p_folder.id
        AND document.archived_at IS NULL
        AND private.document_user_can_see(p_folder.society_id, p_user_id, document.id)
    )
  )
$$;
REVOKE ALL ON FUNCTION private.document_folder_json(public.document_folders, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_unit_json(p_society_id uuid, p_unit_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', unit.id, 'number', unit.number, 'block_name', block.name)
  FROM public.units AS unit
  LEFT JOIN public.blocks AS block ON block.society_id = unit.society_id AND block.id = unit.block_id
  WHERE unit.society_id = p_society_id AND unit.id = p_unit_id
$$;
REVOKE ALL ON FUNCTION private.document_unit_json(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_version_json(p_version public.document_versions)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p_version.id, 'version_number', p_version.version_number,
    'file_name', p_version.file_name, 'content_type', p_version.content_type,
    'size_bytes', p_version.size_bytes, 'note', p_version.note,
    'archived_at', p_version.archived_at, 'created_at', p_version.created_at
  )
$$;
REVOKE ALL ON FUNCTION private.document_version_json(public.document_versions)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.document_json(p_document public.documents, p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p_document.id, 'folder_id', p_document.folder_id, 'unit_id', p_document.unit_id,
    'unit_audience', p_document.unit_audience, 'title', p_document.title,
    'description', p_document.description, 'version', p_document.version,
    'archived_at', p_document.archived_at, 'created_at', p_document.created_at,
    'updated_at', p_document.updated_at,
    'unit', CASE WHEN p_document.unit_id IS NULL THEN NULL
      ELSE private.document_unit_json(p_document.society_id, p_document.unit_id) END,
    'current_version', (
      SELECT private.document_version_json(version) FROM public.document_versions AS version
      WHERE version.society_id = p_document.society_id
        AND version.id = private.document_current_version_id(p_document.society_id, p_document.id)
    ),
    'version_count', CASE WHEN private.document_user_is_staff(p_document.society_id, p_user_id) THEN (
      SELECT count(*) FROM public.document_versions AS version
      WHERE version.society_id = p_document.society_id AND version.document_id = p_document.id
    ) END
  )
$$;
REVOKE ALL ON FUNCTION private.document_json(public.documents, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.document_folder_save(
  p_society_id uuid, p_folder_id uuid, p_name text, p_audience text,
  p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  folder public.document_folders;
  clean_name text;
  previous_audience text;
BEGIN
  PERFORM private.document_lock_writer(p_society_id);
  clean_name := private.document_clean_text(p_name, 80, 'folder name', true);
  IF p_audience IS NULL OR p_audience NOT IN ('all_residents', 'owners_only', 'committee_admins') THEN
    RAISE EXCEPTION 'Choose who can see this folder.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('document_folders:' || p_society_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.document_folders
    WHERE society_id = p_society_id AND archived_at IS NULL AND lower(name) = lower(clean_name)
      AND id IS DISTINCT FROM p_folder_id
  ) THEN
    RAISE EXCEPTION 'A folder with this name already exists.' USING ERRCODE = '23514';
  END IF;
  IF p_folder_id IS NULL THEN
    IF (SELECT count(*) FROM public.document_folders
        WHERE society_id = p_society_id AND archived_at IS NULL) >= 50 THEN
      RAISE EXCEPTION 'A society can have up to 50 active folders. Archive one first.' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.document_folders (society_id, name, audience, sort_order, created_by, updated_by)
    VALUES (
      p_society_id, clean_name, p_audience,
      LEAST(COALESCE((SELECT max(sort_order) FROM public.document_folders WHERE society_id = p_society_id), 0) + 10, 100000),
      auth.uid(), auth.uid()
    )
    RETURNING * INTO folder;
    PERFORM private.document_audit(p_society_id, 'document.folder_create', 'document_folder', folder.id,
      jsonb_build_object('name', folder.name, 'audience', folder.audience), p_request_id);
  ELSE
    SELECT * INTO folder FROM public.document_folders
      WHERE society_id = p_society_id AND id = p_folder_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Folder not found.' USING ERRCODE = 'P0002'; END IF;
    PERFORM private.document_assert_version(folder.version, p_expected_version, 'folder');
    IF folder.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Restore this folder before editing it.' USING ERRCODE = '23514';
    END IF;
    previous_audience := folder.audience;
    UPDATE public.document_folders
    SET name = clean_name, audience = p_audience, version = version + 1,
      updated_at = clock_timestamp(), updated_by = auth.uid()
    WHERE id = folder.id
    RETURNING * INTO folder;
    PERFORM private.document_audit(p_society_id, 'document.folder_update', 'document_folder', folder.id,
      jsonb_build_object('name', folder.name, 'audience', folder.audience,
        'previous_audience', previous_audience), p_request_id);
  END IF;
  RETURN private.document_folder_json(folder, auth.uid());
END;
$$;

CREATE FUNCTION public.document_folder_set_archived(
  p_society_id uuid, p_folder_id uuid, p_archived boolean, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  folder public.document_folders;
BEGIN
  PERFORM private.document_lock_writer(p_society_id);
  IF p_archived IS NULL THEN RAISE EXCEPTION 'Choose archive or restore.' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('document_folders:' || p_society_id::text, 0));
  SELECT * INTO folder FROM public.document_folders
    WHERE society_id = p_society_id AND id = p_folder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Folder not found.' USING ERRCODE = 'P0002'; END IF;
  PERFORM private.document_assert_version(folder.version, p_expected_version, 'folder');
  IF (folder.archived_at IS NOT NULL) = p_archived THEN
    RAISE EXCEPTION 'This folder is already %.', CASE WHEN p_archived THEN 'archived' ELSE 'active' END
      USING ERRCODE = '23514';
  END IF;
  IF NOT p_archived AND EXISTS (
    SELECT 1 FROM public.document_folders
    WHERE society_id = p_society_id AND archived_at IS NULL AND lower(name) = lower(folder.name)
  ) THEN
    RAISE EXCEPTION 'Another active folder uses this name. Rename it first.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.document_folders
  SET archived_at = CASE WHEN p_archived THEN clock_timestamp() END,
    archived_by = CASE WHEN p_archived THEN auth.uid() END,
    version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = folder.id
  RETURNING * INTO folder;
  PERFORM private.document_audit(p_society_id,
    CASE WHEN p_archived THEN 'document.folder_archive' ELSE 'document.folder_restore' END,
    'document_folder', folder.id, jsonb_build_object('name', folder.name), p_request_id);
  RETURN private.document_folder_json(folder, auth.uid());
END;
$$;

CREATE FUNCTION public.document_create(
  p_society_id uuid, p_folder_id uuid, p_unit_id uuid, p_unit_audience text,
  p_title text, p_description text, p_path text, p_file_name text,
  p_client_request_id uuid, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  document public.documents;
  clean_title text;
  clean_description text;
  clean_file_name text;
  upload record;
BEGIN
  PERFORM private.document_lock_writer(p_society_id);
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO document FROM public.documents
    WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN private.document_json(document, auth.uid()); END IF;

  clean_title := private.document_clean_text(p_title, 120, 'title', true);
  clean_description := private.document_clean_text(p_description, 500, 'description', false);
  clean_file_name := private.document_clean_text(p_file_name, 200, 'file name', true);
  IF (p_folder_id IS NULL) = (p_unit_id IS NULL) THEN
    RAISE EXCEPTION 'Choose a folder or a unit for this document.' USING ERRCODE = '22023';
  END IF;
  IF p_folder_id IS NOT NULL THEN
    IF p_unit_audience IS NOT NULL THEN
      RAISE EXCEPTION 'Folder documents use the folder audience.' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.document_folders
      WHERE society_id = p_society_id AND id = p_folder_id AND archived_at IS NULL FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Folder not found or archived.' USING ERRCODE = 'P0002'; END IF;
  ELSE
    IF p_unit_audience IS NULL OR p_unit_audience NOT IN ('all_occupants', 'owners_only') THEN
      RAISE EXCEPTION 'Choose who in the unit can see this document.' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.units
      WHERE society_id = p_society_id AND id = p_unit_id AND active FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002'; END IF;
  END IF;
  SELECT * INTO upload FROM private.document_uploaded_file(p_society_id, p_path);

  INSERT INTO public.documents (
    society_id, folder_id, unit_id, unit_audience, title, description,
    client_request_id, created_by, updated_by
  ) VALUES (
    p_society_id, p_folder_id, p_unit_id, p_unit_audience, clean_title, clean_description,
    p_client_request_id, auth.uid(), auth.uid()
  ) RETURNING * INTO document;
  INSERT INTO public.document_versions (
    society_id, document_id, version_number, path, file_name, content_type, size_bytes, created_by
  ) VALUES (
    p_society_id, document.id, 1, p_path, clean_file_name, upload.content_type, upload.size_bytes, auth.uid()
  );
  PERFORM private.document_audit(p_society_id, 'document.create', 'document', document.id,
    jsonb_build_object('folder_id', document.folder_id, 'unit_id', document.unit_id,
      'unit_audience', document.unit_audience, 'title', document.title, 'version_number', 1),
    p_request_id);
  PERFORM private.document_notify(p_society_id, document.id, 'New document', p_request_id);
  RETURN private.document_json(document, auth.uid());
END;
$$;

CREATE FUNCTION public.document_version_add(
  p_society_id uuid, p_document_id uuid, p_path text, p_file_name text, p_note text,
  p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  document public.documents;
  clean_file_name text;
  clean_note text;
  next_number integer;
  upload record;
BEGIN
  PERFORM private.document_lock_writer(p_society_id);
  SELECT * INTO document FROM public.documents
    WHERE society_id = p_society_id AND id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.document_versions
    WHERE society_id = p_society_id AND document_id = p_document_id AND path = p_path
  ) THEN
    RETURN private.document_json(document, auth.uid());
  END IF;
  PERFORM private.document_assert_version(document.version, p_expected_version, 'document');
  IF document.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Restore this document before adding a version.' USING ERRCODE = '23514';
  END IF;
  clean_file_name := private.document_clean_text(p_file_name, 200, 'file name', true);
  clean_note := private.document_clean_text(p_note, 500, 'version note', false);
  SELECT * INTO upload FROM private.document_uploaded_file(p_society_id, p_path);
  SELECT COALESCE(max(version_number), 0) + 1 INTO next_number FROM public.document_versions
    WHERE society_id = p_society_id AND document_id = p_document_id;
  INSERT INTO public.document_versions (
    society_id, document_id, version_number, path, file_name, content_type, size_bytes, note, created_by
  ) VALUES (
    p_society_id, p_document_id, next_number, p_path, clean_file_name,
    upload.content_type, upload.size_bytes, clean_note, auth.uid()
  );
  UPDATE public.documents
  SET version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = p_document_id
  RETURNING * INTO document;
  PERFORM private.document_audit(p_society_id, 'document.version_add', 'document', document.id,
    jsonb_build_object('version_number', next_number), p_request_id);
  PERFORM private.document_notify(p_society_id, document.id, 'Document updated', p_request_id);
  RETURN private.document_json(document, auth.uid());
END;
$$;

CREATE FUNCTION public.document_update(
  p_society_id uuid, p_document_id uuid, p_title text, p_description text, p_unit_audience text,
  p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  document public.documents;
  clean_title text;
  clean_description text;
BEGIN
  PERFORM private.document_lock_writer(p_society_id);
  SELECT * INTO document FROM public.documents
    WHERE society_id = p_society_id AND id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002'; END IF;
  PERFORM private.document_assert_version(document.version, p_expected_version, 'document');
  IF document.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Restore this document before editing it.' USING ERRCODE = '23514';
  END IF;
  clean_title := private.document_clean_text(p_title, 120, 'title', true);
  clean_description := private.document_clean_text(p_description, 500, 'description', false);
  IF (document.unit_id IS NULL) <> (p_unit_audience IS NULL)
    OR (p_unit_audience IS NOT NULL AND p_unit_audience NOT IN ('all_occupants', 'owners_only'))
  THEN
    RAISE EXCEPTION 'Choose who in the unit can see this document.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.documents
  SET title = clean_title, description = clean_description, unit_audience = p_unit_audience,
    version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = p_document_id
  RETURNING * INTO document;
  PERFORM private.document_audit(p_society_id, 'document.update', 'document', document.id,
    jsonb_build_object('title', document.title, 'unit_audience', document.unit_audience), p_request_id);
  RETURN private.document_json(document, auth.uid());
END;
$$;

CREATE FUNCTION public.document_set_archived(
  p_society_id uuid, p_document_id uuid, p_archived boolean, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  document public.documents;
BEGIN
  PERFORM private.document_lock_writer(p_society_id);
  IF p_archived IS NULL THEN RAISE EXCEPTION 'Choose archive or restore.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO document FROM public.documents
    WHERE society_id = p_society_id AND id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002'; END IF;
  PERFORM private.document_assert_version(document.version, p_expected_version, 'document');
  IF (document.archived_at IS NOT NULL) = p_archived THEN
    RAISE EXCEPTION 'This document is already %.', CASE WHEN p_archived THEN 'archived' ELSE 'active' END
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.documents
  SET archived_at = CASE WHEN p_archived THEN clock_timestamp() END,
    archived_by = CASE WHEN p_archived THEN auth.uid() END,
    version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = p_document_id
  RETURNING * INTO document;
  PERFORM private.document_audit(p_society_id,
    CASE WHEN p_archived THEN 'document.archive' ELSE 'document.restore' END,
    'document', document.id, jsonb_build_object('title', document.title), p_request_id);
  RETURN private.document_json(document, auth.uid());
END;
$$;

CREATE FUNCTION public.document_version_set_archived(
  p_society_id uuid, p_version_id uuid, p_archived boolean, p_expected_version integer, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  document public.documents;
  version_row public.document_versions;
BEGIN
  PERFORM private.document_lock_writer(p_society_id);
  IF p_archived IS NULL THEN RAISE EXCEPTION 'Choose archive or restore.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO version_row FROM public.document_versions
    WHERE society_id = p_society_id AND id = p_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO STRICT document FROM public.documents
    WHERE society_id = p_society_id AND id = version_row.document_id FOR UPDATE;
  SELECT * INTO STRICT version_row FROM public.document_versions WHERE id = p_version_id FOR UPDATE;
  PERFORM private.document_assert_version(document.version, p_expected_version, 'document');
  IF (version_row.archived_at IS NOT NULL) = p_archived THEN
    RAISE EXCEPTION 'This version is already %.', CASE WHEN p_archived THEN 'archived' ELSE 'active' END
      USING ERRCODE = '23514';
  END IF;
  IF p_archived AND NOT EXISTS (
    SELECT 1 FROM public.document_versions
    WHERE society_id = p_society_id AND document_id = document.id
      AND archived_at IS NULL AND id <> p_version_id
  ) THEN
    RAISE EXCEPTION 'This is the only active version. Upload a new version or archive the whole document.'
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.document_versions
  SET archived_at = CASE WHEN p_archived THEN clock_timestamp() END,
    archived_by = CASE WHEN p_archived THEN auth.uid() END
  WHERE id = p_version_id;
  UPDATE public.documents
  SET version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = document.id
  RETURNING * INTO document;
  PERFORM private.document_audit(p_society_id,
    CASE WHEN p_archived THEN 'document.version_archive' ELSE 'document.version_restore' END,
    'document_version', p_version_id,
    jsonb_build_object('document_id', document.id, 'version_number', version_row.version_number),
    p_request_id);
  RETURN private.document_json(document, auth.uid());
END;
$$;

CREATE FUNCTION public.document_workspace_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_staff boolean;
BEGIN
  PERFORM private.document_authorize(p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false);
  is_staff := private.document_user_is_staff(p_society_id, auth.uid());
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[]),
    'is_staff', is_staff,
    'writable', private.society_writable(p_society_id),
    'tenancy_enabled', private.module_enabled(p_society_id, 'tenancy'),
    'folders', COALESCE((
      SELECT jsonb_agg(private.document_folder_json(folder, auth.uid()) ORDER BY folder.archived_at NULLS FIRST, folder.sort_order, folder.id)
      FROM public.document_folders AS folder
      WHERE folder.society_id = p_society_id
        AND private.document_user_can_see_folder(p_society_id, auth.uid(), folder.id)
    ), '[]'::jsonb),
    'units', COALESCE((
      SELECT jsonb_agg(item.unit ORDER BY item.block_name NULLS FIRST, item.number, item.id)
      FROM (
        SELECT unit.id, unit.number, block.name AS block_name,
          jsonb_build_object('id', unit.id, 'number', unit.number, 'block_name', block.name,
            'relationship', (
              SELECT occupant.relationship FROM public.unit_occupants AS occupant
              JOIN public.memberships AS membership
                ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
              WHERE occupant.society_id = p_society_id AND occupant.unit_id = unit.id
                AND occupant.status = 'active' AND membership.status = 'active'
                AND membership.user_id = auth.uid()
              ORDER BY occupant.relationship = 'owner' DESC LIMIT 1
            )) AS unit
        FROM public.units AS unit
        LEFT JOIN public.blocks AS block ON block.society_id = unit.society_id AND block.id = unit.block_id
        WHERE unit.society_id = p_society_id AND unit.active
          AND (is_staff OR private.document_in_unit_audience(p_society_id, auth.uid(), unit.id, 'all_occupants'))
        ORDER BY block.name NULLS FIRST, unit.number, unit.id
        LIMIT 3000
      ) AS item
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.document_list(
  p_society_id uuid, p_folder_id uuid, p_unit_id uuid, p_include_archived boolean,
  p_limit integer DEFAULT 25, p_offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_staff boolean;
  show_archived boolean;
  folder public.document_folders;
  nocs jsonb := '[]'::jsonb;
BEGIN
  PERFORM private.document_authorize(p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false);
  IF (p_folder_id IS NULL) = (p_unit_id IS NULL) THEN
    RAISE EXCEPTION 'Choose a folder or a unit.' USING ERRCODE = '22023';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Choose a valid page.' USING ERRCODE = '22023';
  END IF;
  is_staff := private.document_user_is_staff(p_society_id, auth.uid());
  show_archived := is_staff AND COALESCE(p_include_archived, false);
  IF p_folder_id IS NOT NULL THEN
    IF NOT private.document_user_can_see_folder(p_society_id, auth.uid(), p_folder_id) THEN
      RAISE EXCEPTION 'Folder not found.' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO STRICT folder FROM public.document_folders WHERE society_id = p_society_id AND id = p_folder_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.units WHERE society_id = p_society_id AND id = p_unit_id)
      OR NOT (is_staff OR private.document_in_unit_audience(p_society_id, auth.uid(), p_unit_id, 'all_occupants'))
    THEN
      RAISE EXCEPTION 'Unit not found.' USING ERRCODE = 'P0002';
    END IF;
    -- Tenancy NOCs are shown read-only by reference, using tenancy's own read rule.
    IF private.module_enabled(p_society_id, 'tenancy') THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', noc.id, 'move_id', noc.move_id, 'path', noc.path,
          'content_type', noc.content_type, 'size_bytes', noc.size_bytes, 'created_at', noc.created_at
        ) ORDER BY noc.created_at DESC, noc.id), '[]'::jsonb)
      INTO nocs
      FROM (
        SELECT tenancy_document.* FROM public.tenancy_documents AS tenancy_document
        JOIN public.tenancy_moves AS move
          ON move.society_id = tenancy_document.society_id AND move.id = tenancy_document.move_id
        WHERE tenancy_document.society_id = p_society_id AND move.unit_id = p_unit_id
          AND tenancy_document.kind = 'noc' AND tenancy_document.deleted_at IS NULL
          AND (tenancy_document.purge_after IS NULL OR tenancy_document.purge_after > clock_timestamp())
          AND private.tenancy_can_read_move(p_society_id, move.id)
        ORDER BY tenancy_document.created_at DESC
        LIMIT 50
      ) AS noc;
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'folder', CASE WHEN p_folder_id IS NULL THEN NULL ELSE private.document_folder_json(folder, auth.uid()) END,
    'unit', CASE WHEN p_unit_id IS NULL THEN NULL ELSE private.document_unit_json(p_society_id, p_unit_id) END,
    'total', (
      SELECT count(*) FROM public.documents AS document
      WHERE document.society_id = p_society_id
        AND document.folder_id IS NOT DISTINCT FROM p_folder_id
        AND document.unit_id IS NOT DISTINCT FROM p_unit_id
        AND (show_archived OR document.archived_at IS NULL)
        AND private.document_user_can_see(p_society_id, auth.uid(), document.id)
    ),
    'items', COALESCE((
      SELECT jsonb_agg(private.document_json(page, auth.uid()) ORDER BY page.updated_at DESC, page.id)
      FROM (
        SELECT document.* FROM public.documents AS document
        WHERE document.society_id = p_society_id
          AND document.folder_id IS NOT DISTINCT FROM p_folder_id
          AND document.unit_id IS NOT DISTINCT FROM p_unit_id
          AND (show_archived OR document.archived_at IS NULL)
          AND private.document_user_can_see(p_society_id, auth.uid(), document.id)
        ORDER BY document.updated_at DESC, document.id
        LIMIT p_limit OFFSET p_offset
      ) AS page
    ), '[]'::jsonb),
    'tenancy_nocs', nocs
  );
END;
$$;

CREATE FUNCTION public.document_get(p_society_id uuid, p_document_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  document public.documents;
BEGIN
  PERFORM private.document_authorize(p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false);
  IF NOT private.document_user_can_see(p_society_id, auth.uid(), p_document_id) THEN
    RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO STRICT document FROM public.documents WHERE society_id = p_society_id AND id = p_document_id;
  RETURN jsonb_build_object(
    'document', private.document_json(document, auth.uid()),
    'folder', (
      SELECT private.document_folder_json(folder, auth.uid()) FROM public.document_folders AS folder
      WHERE folder.society_id = p_society_id AND folder.id = document.folder_id
    ),
    'versions', COALESCE((
      SELECT jsonb_agg(private.document_version_json(version) ORDER BY version.version_number DESC)
      FROM public.document_versions AS version
      WHERE version.society_id = p_society_id AND version.document_id = document.id
        AND private.document_user_can_see_version(p_society_id, auth.uid(), version.id)
    ), '[]'::jsonb)
  );
END;
$$;

-- Issuing a download link is an audited event; the storage read policy requires this audit row.
CREATE FUNCTION public.document_download_issue(p_society_id uuid, p_version_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  version_row public.document_versions;
BEGIN
  PERFORM private.document_authorize(p_society_id, ARRAY['admin', 'committee', 'resident']::text[], false);
  IF NOT private.document_user_can_see_version(p_society_id, auth.uid(), p_version_id) THEN
    RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO STRICT version_row FROM public.document_versions
    WHERE society_id = p_society_id AND id = p_version_id;
  PERFORM private.document_audit(p_society_id, 'document.download', 'document_version', version_row.id,
    jsonb_build_object('document_id', version_row.document_id, 'version_number', version_row.version_number),
    p_request_id);
  RETURN jsonb_build_object(
    'path', version_row.path, 'file_name', version_row.file_name, 'content_type', version_row.content_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.document_folder_save(uuid, uuid, text, text, integer, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.document_folder_set_archived(uuid, uuid, boolean, integer, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.document_create(uuid, uuid, uuid, text, text, text, text, text, uuid, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.document_version_add(uuid, uuid, text, text, text, integer, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.document_update(uuid, uuid, text, text, text, integer, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.document_set_archived(uuid, uuid, boolean, integer, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.document_version_set_archived(uuid, uuid, boolean, integer, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.document_workspace_get(uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.document_list(uuid, uuid, uuid, boolean, integer, integer) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.document_get(uuid, uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.document_download_issue(uuid, uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.document_folder_save(uuid, uuid, text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_folder_set_archived(uuid, uuid, boolean, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_create(uuid, uuid, uuid, text, text, text, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_version_add(uuid, uuid, text, text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_update(uuid, uuid, text, text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_set_archived(uuid, uuid, boolean, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_version_set_archived(uuid, uuid, boolean, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_workspace_get(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_list(uuid, uuid, uuid, boolean, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_get(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_download_issue(uuid, uuid, text) TO authenticated;

-- List admin uploads that were never attached to a version within the 24-hour upload window.
CREATE FUNCTION public.document_retention_files_list(p_today date)
RETURNS TABLE(bucket text, path text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutoff timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR NOT isfinite(p_today) THEN
    RAISE EXCEPTION 'A retention date is required.' USING ERRCODE = '22023';
  END IF;
  cutoff := LEAST(clock_timestamp(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  RETURN QUERY
    SELECT 'document-files'::text, object.name FROM storage.objects AS object
    WHERE object.bucket_id = 'document-files'
      AND object.created_at <= cutoff - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.document_versions AS version WHERE version.path = object.name
      )
    ORDER BY object.name;
END;
$$;
REVOKE ALL ON FUNCTION public.document_retention_files_list(date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.document_retention_files_list(date) TO service_role;
