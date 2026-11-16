-- Home-Services Directory: admin-curated providers, committee suggestions and resident ratings.
CREATE TABLE public.home_services_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL,
  service_type text NOT NULL,
  phone text NOT NULL,
  area text,
  notes text,
  origin text NOT NULL,
  status text NOT NULL,
  review_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  archived_at timestamptz,
  archived_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT home_services_providers_name_check
    CHECK (char_length(name) BETWEEN 1 AND 120 AND name = btrim(name)),
  CONSTRAINT home_services_providers_type_check CHECK (service_type IN (
    'plumber', 'electrician', 'carpenter', 'painter', 'pest_control', 'appliance_repair',
    'cleaning', 'other'
  )),
  CONSTRAINT home_services_providers_phone_check CHECK (phone ~ '^\+?[0-9][0-9 -]{4,18}[0-9]$'),
  CONSTRAINT home_services_providers_area_check
    CHECK (area IS NULL OR (char_length(area) BETWEEN 1 AND 120 AND area = btrim(area))),
  CONSTRAINT home_services_providers_notes_check
    CHECK (notes IS NULL OR (char_length(notes) BETWEEN 1 AND 500 AND notes = btrim(notes))),
  CONSTRAINT home_services_providers_origin_check CHECK (origin IN ('admin', 'suggestion')),
  CONSTRAINT home_services_providers_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT home_services_providers_review_check CHECK (
    (origin = 'admin' AND status = 'approved' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (origin = 'suggestion' AND status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (origin = 'suggestion' AND status IN ('approved', 'rejected')
      AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  ),
  CONSTRAINT home_services_providers_reason_check CHECK (
    review_reason IS NULL OR (status = 'rejected'
      AND char_length(review_reason) BETWEEN 1 AND 300 AND review_reason = btrim(review_reason))
  ),
  CONSTRAINT home_services_providers_archive_check CHECK (
    (archived_at IS NULL) = (archived_by IS NULL) AND (archived_at IS NULL OR status = 'approved')
  ),
  CONSTRAINT home_services_providers_version_check CHECK (version >= 1),
  CONSTRAINT home_services_providers_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT home_services_providers_actor_request_key UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX home_services_providers_listing_idx
  ON public.home_services_providers (society_id, status, service_type, lower(name));
CREATE INDEX home_services_providers_created_by_idx ON public.home_services_providers (created_by);
CREATE INDEX home_services_providers_updated_by_idx ON public.home_services_providers (updated_by);
CREATE INDEX home_services_providers_reviewed_by_idx ON public.home_services_providers (reviewed_by);
CREATE INDEX home_services_providers_archived_by_idx ON public.home_services_providers (archived_by);

-- One rating per resident per provider. A hidden comment stays hidden through later edits
-- until an administrator shows it again; the stars always count. Hidden comment text is
-- returned only to administrators and its author; committee members see only that it is hidden.
CREATE TABLE public.home_services_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL,
  rated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  stars smallint NOT NULL,
  comment text,
  comment_hidden_at timestamptz,
  comment_hidden_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT home_services_ratings_stars_check CHECK (stars BETWEEN 1 AND 5),
  CONSTRAINT home_services_ratings_comment_check
    CHECK (comment IS NULL OR (char_length(comment) BETWEEN 1 AND 500 AND comment = btrim(comment))),
  CONSTRAINT home_services_ratings_hidden_check
    CHECK ((comment_hidden_at IS NULL) = (comment_hidden_by IS NULL)),
  CONSTRAINT home_services_ratings_provider_same_society_fkey
    FOREIGN KEY (society_id, provider_id)
    REFERENCES public.home_services_providers (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT home_services_ratings_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT home_services_ratings_one_per_resident_key UNIQUE (society_id, provider_id, rated_by)
);
CREATE INDEX home_services_ratings_provider_idx
  ON public.home_services_ratings (society_id, provider_id, updated_at DESC);
CREATE INDEX home_services_ratings_rated_by_idx ON public.home_services_ratings (rated_by);
CREATE INDEX home_services_ratings_hidden_by_idx ON public.home_services_ratings (comment_hidden_by);
CREATE INDEX home_services_ratings_recent_comment_idx
  ON public.home_services_ratings (society_id, updated_at DESC) WHERE comment IS NOT NULL;

ALTER TABLE public.home_services_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_services_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.home_services_providers, public.home_services_ratings
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY home_services_providers_no_direct_access ON public.home_services_providers
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY home_services_ratings_no_direct_access ON public.home_services_ratings
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER home_services_providers_no_delete BEFORE DELETE ON public.home_services_providers
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER home_services_providers_no_truncate BEFORE TRUNCATE ON public.home_services_providers
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER home_services_ratings_no_delete BEFORE DELETE ON public.home_services_ratings
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER home_services_ratings_no_truncate BEFORE TRUNCATE ON public.home_services_ratings
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.home_services_provider_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.society_id <> OLD.society_id OR NEW.origin <> OLD.origin
    OR NEW.created_by <> OLD.created_by
  THEN
    RAISE EXCEPTION 'A provider cannot move society or change its origin.' USING ERRCODE = '23514';
  END IF;
  IF OLD.status <> 'pending' AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'A reviewed provider cannot change its review result.' USING ERRCODE = '23514';
  END IF;
  IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    RAISE EXCEPTION 'An archived provider cannot be restored.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.home_services_provider_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER home_services_providers_guard BEFORE UPDATE ON public.home_services_providers
  FOR EACH ROW EXECUTE FUNCTION private.home_services_provider_guard();

CREATE FUNCTION private.home_services_rating_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.society_id <> OLD.society_id OR NEW.provider_id <> OLD.provider_id
    OR NEW.rated_by <> OLD.rated_by)
  THEN
    RAISE EXCEPTION 'A rating cannot move to another provider or person.' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM public.home_services_providers AS provider
    WHERE provider.society_id = NEW.society_id AND provider.id = NEW.provider_id
      AND provider.status = 'approved' AND provider.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Only listed providers can be rated.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.home_services_rating_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER home_services_ratings_guard BEFORE INSERT OR UPDATE ON public.home_services_ratings
  FOR EACH ROW EXECUTE FUNCTION private.home_services_rating_guard();

CREATE FUNCTION private.home_services_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'home_services')
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Home services access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.home_services_authorize(uuid, text[], boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.home_services_write_begin(p_society_id uuid, p_roles text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.home_services_authorize(p_society_id, p_roles, true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.home_services_authorize(p_society_id, p_roles, true);
END;
$$;
REVOKE ALL ON FUNCTION private.home_services_write_begin(uuid, text[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.home_services_audit(
  p_society_id uuid, p_actor_role text, p_action text, p_entity_type text, p_entity_id uuid,
  p_after jsonb, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), p_actor_role, 'home_services.' || p_action, p_entity_type,
    p_entity_id::text, p_after, p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.home_services_audit(uuid, text, text, text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.home_services_clean(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT NULLIF(btrim(COALESCE(p_value, '')), '')
$$;
REVOKE ALL ON FUNCTION private.home_services_clean(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.home_services_check_provider(
  p_name text, p_service_type text, p_phone text, p_area text, p_notes text
)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_name IS NULL OR char_length(p_name) > 120
    OR p_service_type IS NULL OR p_service_type NOT IN (
      'plumber', 'electrician', 'carpenter', 'painter', 'pest_control', 'appliance_repair',
      'cleaning', 'other'
    )
    OR p_phone IS NULL OR p_phone !~ '^\+?[0-9][0-9 -]{4,18}[0-9]$'
    OR (p_area IS NOT NULL AND char_length(p_area) > 120)
    OR (p_notes IS NOT NULL AND char_length(p_notes) > 500)
  THEN
    RAISE EXCEPTION 'Enter a name up to 120 characters, a service type, a valid phone number, an area up to 120 characters and notes up to 500.'
      USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.home_services_check_provider(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Caps every fan-out so a society with many administrators cannot turn one suggestion
-- into an unbounded burst of notifications.
CREATE FUNCTION private.home_services_notify_admins(
  p_society_id uuid, p_title text, p_body text, p_entity_id uuid, p_request_id text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  recipient uuid;
  sent integer := 0;
BEGIN
  FOR recipient IN SELECT membership.user_id FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id AND membership.status = 'active'
      AND membership.user_id IS NOT NULL AND 'admin' = ANY(membership.roles)
      AND membership.user_id IS DISTINCT FROM auth.uid()
    ORDER BY membership.created_at, membership.user_id
    LIMIT 20
  LOOP
    PERFORM private.create_notification(p_society_id, recipient, 'home_services_suggestion',
      p_title, p_body, 'home_services_admin', p_entity_id, p_request_id);
    sent := sent + 1;
  END LOOP;
  RETURN sent;
END;
$$;
REVOKE ALL ON FUNCTION private.home_services_notify_admins(uuid, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.home_services_provider_json(
  p_provider public.home_services_providers, p_management boolean
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p_provider.id,
    'name', p_provider.name,
    'service_type', p_provider.service_type,
    'phone', p_provider.phone,
    'area', p_provider.area,
    'notes', p_provider.notes,
    'average_stars', stats.average_stars,
    'rating_count', stats.rating_count,
    'my_stars', (
      SELECT mine.stars FROM public.home_services_ratings AS mine
      WHERE mine.society_id = p_provider.society_id AND mine.provider_id = p_provider.id
        AND mine.rated_by = auth.uid()
    )
  ) || CASE WHEN p_management THEN jsonb_build_object(
    'status', p_provider.status,
    'origin', p_provider.origin,
    'suggested_by_name', CASE WHEN p_provider.origin = 'suggestion' THEN (
      SELECT profile.full_name FROM public.profiles AS profile WHERE profile.id = p_provider.created_by
    ) END,
    'review_reason', p_provider.review_reason,
    'reviewed_at', p_provider.reviewed_at,
    'archived_at', p_provider.archived_at,
    'created_at', p_provider.created_at,
    'version', p_provider.version
  ) ELSE '{}'::jsonb END
  FROM (
    SELECT round(avg(rating.stars)::numeric, 1) AS average_stars, count(*)::integer AS rating_count
    FROM public.home_services_ratings AS rating
    WHERE rating.society_id = p_provider.society_id AND rating.provider_id = p_provider.id
  ) AS stats
$$;
REVOKE ALL ON FUNCTION private.home_services_provider_json(public.home_services_providers, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.home_services_provider_save(
  p_society_id uuid, p_provider_id uuid, p_name text, p_service_type text, p_phone text,
  p_area text, p_notes text, p_expected_version integer, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  provider public.home_services_providers;
  clean_name text := private.home_services_clean(p_name);
  clean_phone text := private.home_services_clean(p_phone);
  clean_area text := private.home_services_clean(p_area);
  clean_notes text := private.home_services_clean(p_notes);
BEGIN
  PERFORM private.home_services_write_begin(p_society_id, ARRAY['admin']::text[]);
  PERFORM private.home_services_check_provider(clean_name, p_service_type, clean_phone, clean_area,
    clean_notes);
  IF p_provider_id IS NULL THEN
    IF p_client_request_id IS NULL THEN
      RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.home_services_providers (
      society_id, name, service_type, phone, area, notes, origin, status, client_request_id,
      created_by, updated_by
    ) VALUES (
      p_society_id, clean_name, p_service_type, clean_phone, clean_area, clean_notes, 'admin',
      'approved', p_client_request_id, auth.uid(), auth.uid()
    )
    ON CONFLICT ON CONSTRAINT home_services_providers_actor_request_key DO NOTHING
    RETURNING * INTO provider;
    -- A retried or concurrent request with the same client id returns the original provider.
    IF NOT FOUND THEN
      SELECT * INTO STRICT provider FROM public.home_services_providers
        WHERE society_id = p_society_id AND created_by = auth.uid()
          AND client_request_id = p_client_request_id;
      RETURN provider.id;
    END IF;
    PERFORM private.home_services_audit(p_society_id, 'admin', 'provider.create',
      'home_services_provider', provider.id,
      jsonb_build_object('name', provider.name, 'service_type', provider.service_type), p_request_id);
    RETURN provider.id;
  END IF;
  SELECT * INTO provider FROM public.home_services_providers
    WHERE society_id = p_society_id AND id = p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provider not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR provider.version <> p_expected_version THEN
    RAISE EXCEPTION 'This provider changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF provider.archived_at IS NOT NULL OR provider.status = 'rejected' THEN
    RAISE EXCEPTION 'Archived or rejected providers cannot be edited.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.home_services_providers
  SET name = clean_name, service_type = p_service_type, phone = clean_phone, area = clean_area,
    notes = clean_notes, version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = provider.id RETURNING * INTO provider;
  PERFORM private.home_services_audit(p_society_id, 'admin', 'provider.update',
    'home_services_provider', provider.id,
    jsonb_build_object('name', provider.name, 'service_type', provider.service_type,
      'version', provider.version), p_request_id);
  RETURN provider.id;
END;
$$;

CREATE FUNCTION public.home_services_provider_suggest(
  p_society_id uuid, p_name text, p_service_type text, p_phone text, p_area text, p_notes text,
  p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  provider public.home_services_providers;
  clean_name text := private.home_services_clean(p_name);
  clean_phone text := private.home_services_clean(p_phone);
  clean_area text := private.home_services_clean(p_area);
  clean_notes text := private.home_services_clean(p_notes);
BEGIN
  PERFORM private.home_services_write_begin(p_society_id, ARRAY['committee']::text[]);
  PERFORM private.home_services_check_provider(clean_name, p_service_type, clean_phone, clean_area,
    clean_notes);
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'A request identifier is required.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.home_services_providers (
    society_id, name, service_type, phone, area, notes, origin, status, client_request_id,
    created_by, updated_by
  ) VALUES (
    p_society_id, clean_name, p_service_type, clean_phone, clean_area, clean_notes, 'suggestion',
    'pending', p_client_request_id, auth.uid(), auth.uid()
  )
  ON CONFLICT ON CONSTRAINT home_services_providers_actor_request_key DO NOTHING
  RETURNING * INTO provider;
  -- A retried or concurrent request with the same client id returns the original suggestion.
  IF NOT FOUND THEN
    SELECT * INTO STRICT provider FROM public.home_services_providers
      WHERE society_id = p_society_id AND created_by = auth.uid()
        AND client_request_id = p_client_request_id;
    RETURN provider.id;
  END IF;
  PERFORM private.home_services_audit(p_society_id, 'committee', 'provider.suggest',
    'home_services_provider', provider.id,
    jsonb_build_object('name', provider.name, 'service_type', provider.service_type), p_request_id);
  PERFORM private.home_services_notify_admins(p_society_id, 'Home service provider suggested',
    left('A committee member suggested ' || provider.name || '. Review it before residents can see it.', 300),
    provider.id, p_request_id);
  RETURN provider.id;
END;
$$;

CREATE FUNCTION public.home_services_suggestion_review(
  p_society_id uuid, p_provider_id uuid, p_approve boolean, p_reason text,
  p_expected_version integer, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  provider public.home_services_providers;
  clean_reason text := private.home_services_clean(p_reason);
BEGIN
  PERFORM private.home_services_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_approve IS NULL OR (clean_reason IS NOT NULL AND (p_approve OR char_length(clean_reason) > 300))
  THEN
    RAISE EXCEPTION 'Choose approve or reject; a rejection reason can be up to 300 characters.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO provider FROM public.home_services_providers
    WHERE society_id = p_society_id AND id = p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provider not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR provider.version <> p_expected_version THEN
    RAISE EXCEPTION 'This suggestion changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF provider.status <> 'pending' THEN
    RAISE EXCEPTION 'This suggestion has already been reviewed.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.home_services_providers
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    review_reason = clean_reason, reviewed_at = clock_timestamp(), reviewed_by = auth.uid(),
    version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = provider.id RETURNING * INTO provider;
  PERFORM private.home_services_audit(p_society_id, 'admin',
    CASE WHEN p_approve THEN 'suggestion.approve' ELSE 'suggestion.reject' END,
    'home_services_provider', provider.id,
    jsonb_build_object('name', provider.name, 'reason', clean_reason), p_request_id);
  IF provider.created_by IS DISTINCT FROM auth.uid() AND EXISTS (
    SELECT 1 FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id AND membership.user_id = provider.created_by
      AND membership.status = 'active'
  ) THEN
    PERFORM private.create_notification(p_society_id, provider.created_by,
      CASE WHEN p_approve THEN 'home_services_suggestion_approved'
        ELSE 'home_services_suggestion_rejected' END,
      CASE WHEN p_approve THEN 'Suggestion approved' ELSE 'Suggestion not approved' END,
      left(CASE WHEN p_approve THEN provider.name || ' is now listed for residents.'
        ELSE provider.name || ' was not added to the directory.'
          || COALESCE(' Reason: ' || clean_reason, '') END, 300),
      'home_services_admin', provider.id, p_request_id);
  END IF;
END;
$$;

CREATE FUNCTION public.home_services_provider_archive(
  p_society_id uuid, p_provider_id uuid, p_expected_version integer, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  provider public.home_services_providers;
BEGIN
  PERFORM private.home_services_write_begin(p_society_id, ARRAY['admin']::text[]);
  SELECT * INTO provider FROM public.home_services_providers
    WHERE society_id = p_society_id AND id = p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provider not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR provider.version <> p_expected_version THEN
    RAISE EXCEPTION 'This provider changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
  IF provider.status <> 'approved' OR provider.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only a listed provider can be archived.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.home_services_providers
  SET archived_at = clock_timestamp(), archived_by = auth.uid(), version = version + 1,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = provider.id;
  PERFORM private.home_services_audit(p_society_id, 'admin', 'provider.archive',
    'home_services_provider', provider.id, jsonb_build_object('name', provider.name), p_request_id);
END;
$$;

CREATE FUNCTION public.home_services_rating_save(
  p_society_id uuid, p_provider_id uuid, p_stars integer, p_comment text, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  rating_id uuid;
  rating_stars smallint;
  has_comment boolean;
  clean_comment text := private.home_services_clean(p_comment);
  was_new boolean;
BEGIN
  PERFORM private.home_services_write_begin(p_society_id, ARRAY['resident']::text[]);
  IF p_stars IS NULL OR p_stars NOT BETWEEN 1 AND 5
    OR (clean_comment IS NOT NULL AND char_length(clean_comment) > 500)
  THEN
    RAISE EXCEPTION 'Choose 1 to 5 stars and keep the comment within 500 characters.'
      USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.home_services_providers
    WHERE society_id = p_society_id AND id = p_provider_id AND status = 'approved'
      AND archived_at IS NULL
    FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provider not found.' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.home_services_ratings (society_id, provider_id, rated_by, stars, comment)
  VALUES (p_society_id, p_provider_id, auth.uid(), p_stars, clean_comment)
  ON CONFLICT ON CONSTRAINT home_services_ratings_one_per_resident_key DO UPDATE
  SET stars = EXCLUDED.stars, comment = EXCLUDED.comment, updated_at = clock_timestamp()
  -- xmax is zero only for a freshly inserted row, so concurrent first ratings log one create.
  RETURNING id, stars, comment IS NOT NULL, (xmax = 0)
    INTO rating_id, rating_stars, has_comment, was_new;
  PERFORM private.home_services_audit(p_society_id, 'resident',
    CASE WHEN was_new THEN 'rating.create' ELSE 'rating.update' END,
    'home_services_rating', rating_id,
    jsonb_build_object('provider_id', p_provider_id, 'stars', rating_stars,
      'has_comment', has_comment), p_request_id);
  RETURN rating_id;
END;
$$;

CREATE FUNCTION public.home_services_comment_visibility_set(
  p_society_id uuid, p_rating_id uuid, p_hidden boolean, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  rating public.home_services_ratings;
BEGIN
  PERFORM private.home_services_write_begin(p_society_id, ARRAY['admin']::text[]);
  IF p_hidden IS NULL THEN
    RAISE EXCEPTION 'Choose whether to hide or show the comment.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO rating FROM public.home_services_ratings
    WHERE society_id = p_society_id AND id = p_rating_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rating not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_hidden AND rating.comment IS NULL THEN
    RAISE EXCEPTION 'This rating has no comment to hide.' USING ERRCODE = '22023';
  END IF;
  IF p_hidden = (rating.comment_hidden_at IS NOT NULL) THEN
    RAISE EXCEPTION 'The comment is already in that state.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.home_services_ratings
  SET comment_hidden_at = CASE WHEN p_hidden THEN clock_timestamp() END,
    comment_hidden_by = CASE WHEN p_hidden THEN auth.uid() END
  WHERE id = rating.id;
  PERFORM private.home_services_audit(p_society_id, 'admin',
    CASE WHEN p_hidden THEN 'comment.hide' ELSE 'comment.show' END,
    'home_services_rating', rating.id,
    jsonb_build_object('provider_id', rating.provider_id), p_request_id);
END;
$$;

-- Residents see approved, active providers only; pending, rejected and archived records stay
-- with management.
CREATE FUNCTION public.home_services_directory(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.home_services_authorize(p_society_id,
    ARRAY['admin', 'committee', 'resident']::text[], false);
  RETURN jsonb_build_object(
    'can_rate', private.has_role(p_society_id, ARRAY['resident']::text[]),
    'providers', COALESCE((
      SELECT jsonb_agg(private.home_services_provider_json(provider, false)
        ORDER BY lower(provider.name), provider.id)
      FROM (
        SELECT * FROM public.home_services_providers AS item
        WHERE item.society_id = p_society_id AND item.status = 'approved'
          AND item.archived_at IS NULL
        ORDER BY lower(item.name), item.id LIMIT 500
      ) AS provider
    ), '[]'::jsonb),
    'truncated', EXISTS (
      SELECT 1 FROM public.home_services_providers AS item
      WHERE item.society_id = p_society_id AND item.status = 'approved'
        AND item.archived_at IS NULL
      OFFSET 500
    )
  );
END;
$$;

CREATE FUNCTION public.home_services_provider_detail(p_society_id uuid, p_provider_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  provider public.home_services_providers;
  management boolean;
  manager boolean;
  can_rate boolean;
BEGIN
  PERFORM private.home_services_authorize(p_society_id,
    ARRAY['admin', 'committee', 'resident']::text[], false);
  management := private.has_role(p_society_id, ARRAY['admin', 'committee']::text[]);
  manager := private.has_role(p_society_id, ARRAY['admin']::text[]);
  can_rate := private.has_role(p_society_id, ARRAY['resident']::text[]);
  SELECT * INTO provider FROM public.home_services_providers
    WHERE society_id = p_society_id AND id = p_provider_id
      AND (management OR (status = 'approved' AND archived_at IS NULL));
  IF NOT FOUND THEN RAISE EXCEPTION 'Provider not found.' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'provider', private.home_services_provider_json(provider, false),
    'is_listed', provider.status = 'approved' AND provider.archived_at IS NULL,
    'can_rate', can_rate AND provider.status = 'approved' AND provider.archived_at IS NULL,
    'can_moderate', manager,
    'my_rating', (
      SELECT jsonb_build_object('id', mine.id, 'stars', mine.stars, 'comment', mine.comment,
        'comment_hidden', mine.comment_hidden_at IS NOT NULL, 'updated_at', mine.updated_at)
      FROM public.home_services_ratings AS mine
      WHERE mine.society_id = p_society_id AND mine.provider_id = provider.id
        AND mine.rated_by = auth.uid()
    ),
    'comments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rating.id, 'stars', rating.stars,
        'comment', CASE WHEN rating.comment_hidden_at IS NULL OR manager
          OR rating.rated_by = auth.uid() THEN rating.comment END,
        'comment_hidden', rating.comment_hidden_at IS NOT NULL,
        'rater_name', CASE WHEN management THEN (
          SELECT profile.full_name FROM public.profiles AS profile WHERE profile.id = rating.rated_by
        ) END,
        'is_mine', rating.rated_by = auth.uid(),
        'updated_at', rating.updated_at
      ) ORDER BY rating.updated_at DESC, rating.id)
      FROM (
        SELECT * FROM public.home_services_ratings AS item
        WHERE item.society_id = p_society_id AND item.provider_id = provider.id
          AND item.comment IS NOT NULL
          AND (management OR item.comment_hidden_at IS NULL OR item.rated_by = auth.uid())
        ORDER BY item.updated_at DESC, item.id LIMIT 50
      ) AS rating
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.home_services_admin_workspace(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  manager boolean;
BEGIN
  PERFORM private.home_services_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  manager := private.has_role(p_society_id, ARRAY['admin']::text[]);
  RETURN jsonb_build_object(
    'can_manage', manager,
    'can_suggest', private.has_role(p_society_id, ARRAY['committee']::text[]),
    'providers', COALESCE((
      SELECT jsonb_agg(private.home_services_provider_json(provider, true)
        ORDER BY provider.status <> 'pending', provider.archived_at IS NOT NULL,
          lower(provider.name), provider.id)
      FROM (
        SELECT * FROM public.home_services_providers AS item
        WHERE item.society_id = p_society_id
        ORDER BY item.status <> 'pending', item.archived_at IS NOT NULL, lower(item.name), item.id
        LIMIT 500
      ) AS provider
    ), '[]'::jsonb),
    'truncated', EXISTS (
      SELECT 1 FROM public.home_services_providers AS item
      WHERE item.society_id = p_society_id OFFSET 500
    ),
    'comments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rating.id, 'provider_id', rating.provider_id, 'provider_name', provider.name,
        'stars', rating.stars,
        'comment', CASE WHEN rating.comment_hidden_at IS NULL OR manager THEN rating.comment END,
        'comment_hidden', rating.comment_hidden_at IS NOT NULL,
        'rater_name', (
          SELECT profile.full_name FROM public.profiles AS profile WHERE profile.id = rating.rated_by
        ),
        'updated_at', rating.updated_at
      ) ORDER BY rating.updated_at DESC, rating.id)
      FROM (
        SELECT * FROM public.home_services_ratings AS item
        WHERE item.society_id = p_society_id AND item.comment IS NOT NULL
        ORDER BY item.updated_at DESC, item.id LIMIT 100
      ) AS rating
      JOIN public.home_services_providers AS provider
        ON provider.society_id = rating.society_id AND provider.id = rating.provider_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.home_services_provider_save(uuid, uuid, text, text, text, text, text, integer, uuid, text),
  public.home_services_provider_suggest(uuid, text, text, text, text, text, uuid, text),
  public.home_services_suggestion_review(uuid, uuid, boolean, text, integer, text),
  public.home_services_provider_archive(uuid, uuid, integer, text),
  public.home_services_rating_save(uuid, uuid, integer, text, text),
  public.home_services_comment_visibility_set(uuid, uuid, boolean, text),
  public.home_services_directory(uuid),
  public.home_services_provider_detail(uuid, uuid),
  public.home_services_admin_workspace(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.home_services_provider_save(uuid, uuid, text, text, text, text, text, integer, uuid, text),
  public.home_services_provider_suggest(uuid, text, text, text, text, text, uuid, text),
  public.home_services_suggestion_review(uuid, uuid, boolean, text, integer, text),
  public.home_services_provider_archive(uuid, uuid, integer, text),
  public.home_services_rating_save(uuid, uuid, integer, text, text),
  public.home_services_comment_visibility_set(uuid, uuid, boolean, text),
  public.home_services_directory(uuid),
  public.home_services_provider_detail(uuid, uuid),
  public.home_services_admin_workspace(uuid)
  TO authenticated;
