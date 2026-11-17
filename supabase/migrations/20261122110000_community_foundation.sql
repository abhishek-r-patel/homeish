-- Resident Community & Marketplace (D-64): tenant-scoped schema, private photo bucket, shared helpers
-- and the final public RPC signatures (bodies are filled in by the following migrations).
CREATE TABLE public.community_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT community_groups_name_check CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT community_groups_description_check CHECK (
    description IS NULL OR (description = btrim(description) AND char_length(description) BETWEEN 1 AND 500)
  ),
  CONSTRAINT community_groups_status_check CHECK (status IN ('active', 'archived')),
  CONSTRAINT community_groups_version_check CHECK (version >= 1),
  CONSTRAINT community_groups_society_id_id_key UNIQUE (society_id, id)
);
CREATE UNIQUE INDEX community_groups_active_name_key
  ON public.community_groups (society_id, lower(name)) WHERE status = 'active';
CREATE INDEX community_groups_created_by_idx ON public.community_groups (created_by);
CREATE INDEX community_groups_updated_by_idx ON public.community_groups (updated_by);

CREATE TABLE public.community_group_members (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  group_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT community_group_members_pkey PRIMARY KEY (society_id, group_id, membership_id),
  CONSTRAINT community_group_members_group_fkey
    FOREIGN KEY (society_id, group_id) REFERENCES public.community_groups (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT community_group_members_membership_fkey
    FOREIGN KEY (society_id, membership_id) REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX community_group_members_membership_idx
  ON public.community_group_members (society_id, membership_id);

CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  group_id uuid NOT NULL,
  author_membership_id uuid NOT NULL,
  author_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  author_name text NOT NULL,
  author_unit_label text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  moderation_reason text,
  moderated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  moderated_at timestamptz,
  status_changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT community_posts_author_name_check CHECK (char_length(author_name) BETWEEN 1 AND 120),
  CONSTRAINT community_posts_author_unit_label_check CHECK (
    author_unit_label IS NULL OR char_length(author_unit_label) BETWEEN 1 AND 100
  ),
  CONSTRAINT community_posts_body_check CHECK (body = btrim(body) AND char_length(body) BETWEEN 1 AND 4000),
  CONSTRAINT community_posts_status_check CHECK (
    status IN ('pending', 'approved', 'rejected', 'hidden', 'removed', 'withdrawn')
  ),
  CONSTRAINT community_posts_reason_check CHECK (
    (moderation_reason IS NULL OR char_length(moderation_reason) BETWEEN 1 AND 500)
    AND (status NOT IN ('rejected', 'removed') OR moderation_reason IS NOT NULL)
  ),
  CONSTRAINT community_posts_version_check CHECK (version >= 1),
  CONSTRAINT community_posts_group_fkey
    FOREIGN KEY (society_id, group_id) REFERENCES public.community_groups (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT community_posts_author_membership_fkey
    FOREIGN KEY (society_id, author_membership_id) REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT community_posts_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT community_posts_client_request_key UNIQUE (society_id, author_user_id, client_request_id)
);
CREATE INDEX community_posts_group_feed_idx ON public.community_posts (society_id, group_id, status, created_at DESC);
CREATE INDEX community_posts_status_idx ON public.community_posts (society_id, status, created_at DESC);
CREATE INDEX community_posts_author_membership_idx ON public.community_posts (society_id, author_membership_id);
CREATE INDEX community_posts_author_user_idx ON public.community_posts (author_user_id);
CREATE INDEX community_posts_moderated_by_idx ON public.community_posts (moderated_by);
CREATE INDEX community_posts_retention_idx ON public.community_posts (status, status_changed_at)
  WHERE status IN ('rejected', 'removed', 'withdrawn');

CREATE TABLE public.community_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  author_membership_id uuid NOT NULL,
  author_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  author_name text NOT NULL,
  author_unit_label text,
  listing_type text NOT NULL,
  title text NOT NULL,
  description text,
  price_paise bigint,
  contact_phone text,
  status text NOT NULL DEFAULT 'pending',
  moderation_reason text,
  moderated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  moderated_at timestamptz,
  status_changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  expires_at timestamptz,
  closed_at timestamptz,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT community_listings_author_name_check CHECK (char_length(author_name) BETWEEN 1 AND 120),
  CONSTRAINT community_listings_author_unit_label_check CHECK (
    author_unit_label IS NULL OR char_length(author_unit_label) BETWEEN 1 AND 100
  ),
  CONSTRAINT community_listings_type_check CHECK (listing_type IN ('sale', 'give_away', 'wanted', 'lost', 'found')),
  CONSTRAINT community_listings_title_check CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT community_listings_description_check CHECK (
    description IS NULL OR (description = btrim(description) AND char_length(description) BETWEEN 1 AND 4000)
  ),
  CONSTRAINT community_listings_price_check CHECK (
    price_paise IS NULL OR (listing_type = 'sale' AND price_paise BETWEEN 0 AND 1000000000)
  ),
  CONSTRAINT community_listings_contact_phone_check CHECK (
    contact_phone IS NULL OR contact_phone ~ '^[0-9+ ]{8,16}$'
  ),
  CONSTRAINT community_listings_status_check CHECK (
    status IN ('pending', 'approved', 'rejected', 'hidden', 'removed', 'withdrawn')
  ),
  CONSTRAINT community_listings_reason_check CHECK (
    (moderation_reason IS NULL OR char_length(moderation_reason) BETWEEN 1 AND 500)
    AND (status NOT IN ('rejected', 'removed') OR moderation_reason IS NOT NULL)
  ),
  CONSTRAINT community_listings_approval_check CHECK (
    (approved_at IS NULL) = (expires_at IS NULL)
    AND (status <> 'approved' OR approved_at IS NOT NULL)
    AND (closed_at IS NULL OR approved_at IS NOT NULL)
  ),
  CONSTRAINT community_listings_version_check CHECK (version >= 1),
  CONSTRAINT community_listings_author_membership_fkey
    FOREIGN KEY (society_id, author_membership_id) REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT community_listings_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT community_listings_client_request_key UNIQUE (society_id, author_user_id, client_request_id)
);
CREATE INDEX community_listings_market_idx
  ON public.community_listings (society_id, status, approved_at DESC);
CREATE INDEX community_listings_author_membership_idx
  ON public.community_listings (society_id, author_membership_id);
CREATE INDEX community_listings_author_user_idx ON public.community_listings (author_user_id);
CREATE INDEX community_listings_moderated_by_idx ON public.community_listings (moderated_by);
CREATE INDEX community_listings_retention_idx ON public.community_listings (status, status_changed_at)
  WHERE status IN ('rejected', 'removed', 'withdrawn');

CREATE TABLE public.community_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  post_id uuid,
  listing_id uuid,
  author_membership_id uuid NOT NULL,
  author_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  author_name text NOT NULL,
  author_unit_label text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'visible',
  moderation_reason text,
  moderated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  moderated_at timestamptz,
  status_changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT community_replies_parent_check CHECK (num_nonnulls(post_id, listing_id) = 1),
  CONSTRAINT community_replies_author_name_check CHECK (char_length(author_name) BETWEEN 1 AND 120),
  CONSTRAINT community_replies_author_unit_label_check CHECK (
    author_unit_label IS NULL OR char_length(author_unit_label) BETWEEN 1 AND 100
  ),
  CONSTRAINT community_replies_body_check CHECK (body = btrim(body) AND char_length(body) BETWEEN 1 AND 2000),
  CONSTRAINT community_replies_status_check CHECK (status IN ('visible', 'hidden', 'removed')),
  CONSTRAINT community_replies_reason_check CHECK (
    (moderation_reason IS NULL OR char_length(moderation_reason) BETWEEN 1 AND 500)
    AND (status <> 'removed' OR moderation_reason IS NOT NULL)
  ),
  CONSTRAINT community_replies_post_fkey
    FOREIGN KEY (society_id, post_id) REFERENCES public.community_posts (society_id, id) ON DELETE CASCADE,
  CONSTRAINT community_replies_listing_fkey
    FOREIGN KEY (society_id, listing_id) REFERENCES public.community_listings (society_id, id) ON DELETE CASCADE,
  CONSTRAINT community_replies_author_membership_fkey
    FOREIGN KEY (society_id, author_membership_id) REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT community_replies_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT community_replies_client_request_key UNIQUE (society_id, author_user_id, client_request_id)
);
CREATE INDEX community_replies_post_idx ON public.community_replies (society_id, post_id, created_at);
CREATE INDEX community_replies_listing_idx ON public.community_replies (society_id, listing_id, created_at);
CREATE INDEX community_replies_author_membership_idx
  ON public.community_replies (society_id, author_membership_id);
CREATE INDEX community_replies_author_user_idx ON public.community_replies (author_user_id);
CREATE INDEX community_replies_moderated_by_idx ON public.community_replies (moderated_by);
CREATE INDEX community_replies_status_idx ON public.community_replies (society_id, status, created_at DESC);
CREATE INDEX community_replies_retention_idx ON public.community_replies (status_changed_at)
  WHERE status = 'removed';

CREATE TABLE public.community_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  post_id uuid,
  listing_id uuid,
  storage_path text NOT NULL,
  position smallint NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT community_photos_parent_check CHECK (num_nonnulls(post_id, listing_id) = 1),
  CONSTRAINT community_photos_position_check CHECK (position BETWEEN 1 AND 3),
  CONSTRAINT community_photos_path_check CHECK (
    char_length(storage_path) <= 200 AND split_part(storage_path, '/', 1) = society_id::text
  ),
  CONSTRAINT community_photos_post_fkey
    FOREIGN KEY (society_id, post_id) REFERENCES public.community_posts (society_id, id) ON DELETE CASCADE,
  CONSTRAINT community_photos_listing_fkey
    FOREIGN KEY (society_id, listing_id) REFERENCES public.community_listings (society_id, id) ON DELETE CASCADE,
  CONSTRAINT community_photos_storage_path_key UNIQUE (storage_path),
  CONSTRAINT community_photos_post_position_key UNIQUE (society_id, post_id, position),
  CONSTRAINT community_photos_listing_position_key UNIQUE (society_id, listing_id, position)
);
CREATE INDEX community_photos_created_by_idx ON public.community_photos (created_by);

CREATE TABLE public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  target_type text NOT NULL,
  post_id uuid,
  listing_id uuid,
  reply_id uuid,
  target_id uuid GENERATED ALWAYS AS (COALESCE(post_id, listing_id, reply_id)) STORED,
  reporter_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  reporter_unit_id uuid NOT NULL,
  reason text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  CONSTRAINT community_reports_target_check CHECK (
    (target_type = 'post' AND post_id IS NOT NULL AND listing_id IS NULL AND reply_id IS NULL)
    OR (target_type = 'listing' AND listing_id IS NOT NULL AND post_id IS NULL AND reply_id IS NULL)
    OR (target_type = 'reply' AND reply_id IS NOT NULL AND post_id IS NULL AND listing_id IS NULL)
  ),
  CONSTRAINT community_reports_reason_check CHECK (reason IN ('spam', 'offensive', 'scam', 'other')),
  CONSTRAINT community_reports_note_check CHECK (
    note IS NULL OR (note = btrim(note) AND char_length(note) BETWEEN 1 AND 500)
  ),
  CONSTRAINT community_reports_status_check CHECK (
    (status = 'open' AND resolved_by IS NULL AND resolved_at IS NULL)
    OR (status IN ('dismissed', 'actioned') AND resolved_at IS NOT NULL)
  ),
  CONSTRAINT community_reports_post_fkey
    FOREIGN KEY (society_id, post_id) REFERENCES public.community_posts (society_id, id) ON DELETE CASCADE,
  CONSTRAINT community_reports_listing_fkey
    FOREIGN KEY (society_id, listing_id) REFERENCES public.community_listings (society_id, id) ON DELETE CASCADE,
  CONSTRAINT community_reports_reply_fkey
    FOREIGN KEY (society_id, reply_id) REFERENCES public.community_replies (society_id, id) ON DELETE CASCADE,
  CONSTRAINT community_reports_reporter_unit_fkey
    FOREIGN KEY (society_id, reporter_unit_id) REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT community_reports_user_key UNIQUE (society_id, target_type, target_id, reporter_user_id),
  CONSTRAINT community_reports_unit_key UNIQUE (society_id, target_type, target_id, reporter_unit_id)
);
CREATE INDEX community_reports_post_idx ON public.community_reports (society_id, post_id);
CREATE INDEX community_reports_listing_idx ON public.community_reports (society_id, listing_id);
CREATE INDEX community_reports_reply_idx ON public.community_reports (society_id, reply_id);
CREATE INDEX community_reports_reporter_unit_idx ON public.community_reports (society_id, reporter_unit_id);
CREATE INDEX community_reports_reporter_user_idx ON public.community_reports (reporter_user_id);
CREATE INDEX community_reports_resolved_by_idx ON public.community_reports (resolved_by);

CREATE TABLE public.community_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL,
  duration text NOT NULL,
  muted_until timestamptz,
  reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lifted_at timestamptz,
  lifted_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT community_mutes_duration_check CHECK (
    (duration IN ('7d', '30d') AND muted_until IS NOT NULL)
    OR (duration = 'until_lifted' AND muted_until IS NULL)
  ),
  CONSTRAINT community_mutes_reason_check CHECK (reason = btrim(reason) AND char_length(reason) BETWEEN 1 AND 500),
  CONSTRAINT community_mutes_lifted_check CHECK (lifted_by IS NULL OR lifted_at IS NOT NULL),
  CONSTRAINT community_mutes_membership_fkey
    FOREIGN KEY (society_id, membership_id) REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX community_mutes_membership_idx ON public.community_mutes (society_id, membership_id, created_at DESC);
CREATE UNIQUE INDEX community_mutes_one_active_key
  ON public.community_mutes (society_id, membership_id) WHERE lifted_at IS NULL;
CREATE INDEX community_mutes_created_by_idx ON public.community_mutes (created_by);
CREATE INDEX community_mutes_lifted_by_idx ON public.community_mutes (lifted_by);

CREATE TABLE public.community_preferences (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL,
  new_listing_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT community_preferences_pkey PRIMARY KEY (society_id, membership_id),
  CONSTRAINT community_preferences_membership_fkey
    FOREIGN KEY (society_id, membership_id) REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT
);

ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.community_groups, public.community_group_members, public.community_posts,
  public.community_listings, public.community_replies, public.community_photos, public.community_reports,
  public.community_mutes, public.community_preferences
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY community_groups_no_direct_access ON public.community_groups
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY community_group_members_no_direct_access ON public.community_group_members
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY community_posts_no_direct_access ON public.community_posts
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY community_listings_no_direct_access ON public.community_listings
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY community_replies_no_direct_access ON public.community_replies
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY community_photos_no_direct_access ON public.community_photos
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY community_reports_no_direct_access ON public.community_reports
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY community_mutes_no_direct_access ON public.community_mutes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY community_preferences_no_direct_access ON public.community_preferences
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Integrity guards: tenant, identity and authorship never move; photos and reports keep their target.
CREATE FUNCTION private.community_content_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.society_id IS DISTINCT FROM OLD.society_id OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.author_membership_id IS DISTINCT FROM OLD.author_membership_id
    OR NEW.author_user_id IS DISTINCT FROM OLD.author_user_id
    OR NEW.client_request_id IS DISTINCT FROM OLD.client_request_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Community content identity cannot change.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.community_content_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER community_posts_guard BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION private.community_content_guard();
CREATE TRIGGER community_listings_guard BEFORE UPDATE ON public.community_listings
  FOR EACH ROW EXECUTE FUNCTION private.community_content_guard();
CREATE TRIGGER community_replies_guard BEFORE UPDATE ON public.community_replies
  FOR EACH ROW EXECUTE FUNCTION private.community_content_guard();

CREATE FUNCTION private.community_target_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'community_photos' THEN
    RAISE EXCEPTION 'Community photos cannot be changed; replace them instead.' USING ERRCODE = '55000';
  END IF;
  IF NEW.society_id IS DISTINCT FROM OLD.society_id OR NEW.id IS DISTINCT FROM OLD.id
    -- target_id is a generated column and is still NULL in BEFORE UPDATE triggers.
    OR NEW.target_type IS DISTINCT FROM OLD.target_type OR NEW.post_id IS DISTINCT FROM OLD.post_id
    OR NEW.listing_id IS DISTINCT FROM OLD.listing_id OR NEW.reply_id IS DISTINCT FROM OLD.reply_id
    OR NEW.reporter_user_id IS DISTINCT FROM OLD.reporter_user_id
    OR NEW.reporter_unit_id IS DISTINCT FROM OLD.reporter_unit_id
    OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.note IS DISTINCT FROM OLD.note
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'A community report can only be resolved.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.community_target_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER community_photos_guard BEFORE UPDATE ON public.community_photos
  FOR EACH ROW EXECUTE FUNCTION private.community_target_guard();
CREATE TRIGGER community_reports_guard BEFORE UPDATE ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION private.community_target_guard();

CREATE FUNCTION private.community_reject_truncate()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Community records cannot be truncated.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.community_reject_truncate() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER community_groups_no_truncate BEFORE TRUNCATE ON public.community_groups
  FOR EACH STATEMENT EXECUTE FUNCTION private.community_reject_truncate();
CREATE TRIGGER community_group_members_no_truncate BEFORE TRUNCATE ON public.community_group_members
  FOR EACH STATEMENT EXECUTE FUNCTION private.community_reject_truncate();
CREATE TRIGGER community_posts_no_truncate BEFORE TRUNCATE ON public.community_posts
  FOR EACH STATEMENT EXECUTE FUNCTION private.community_reject_truncate();
CREATE TRIGGER community_listings_no_truncate BEFORE TRUNCATE ON public.community_listings
  FOR EACH STATEMENT EXECUTE FUNCTION private.community_reject_truncate();
CREATE TRIGGER community_replies_no_truncate BEFORE TRUNCATE ON public.community_replies
  FOR EACH STATEMENT EXECUTE FUNCTION private.community_reject_truncate();
CREATE TRIGGER community_photos_no_truncate BEFORE TRUNCATE ON public.community_photos
  FOR EACH STATEMENT EXECUTE FUNCTION private.community_reject_truncate();
CREATE TRIGGER community_reports_no_truncate BEFORE TRUNCATE ON public.community_reports
  FOR EACH STATEMENT EXECUTE FUNCTION private.community_reject_truncate();
CREATE TRIGGER community_mutes_no_truncate BEFORE TRUNCATE ON public.community_mutes
  FOR EACH STATEMENT EXECUTE FUNCTION private.community_reject_truncate();
CREATE TRIGGER community_preferences_no_truncate BEFORE TRUNCATE ON public.community_preferences
  FOR EACH STATEMENT EXECUTE FUNCTION private.community_reject_truncate();

-- Membership helpers. A participant is an active member with role `resident` who actively occupies an
-- active unit (D-64 §1); the "flat" of a member is their first such unit by label.
CREATE FUNCTION private.community_unit_label(p_society_id uuid, p_unit_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT left(COALESCE(block.name || '-', '') || unit.number, 100)
  FROM public.units AS unit
  LEFT JOIN public.blocks AS block ON block.society_id = unit.society_id AND block.id = unit.block_id
  WHERE unit.society_id = p_society_id AND unit.id = p_unit_id
$$;
REVOKE ALL ON FUNCTION private.community_unit_label(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_member_unit(p_society_id uuid, p_membership_id uuid)
RETURNS TABLE (unit_id uuid, label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT unit.id, left(COALESCE(block.name || '-', '') || unit.number, 100) AS label
  FROM public.unit_occupants AS occupant
  JOIN public.units AS unit
    ON unit.society_id = occupant.society_id AND unit.id = occupant.unit_id AND unit.active
  LEFT JOIN public.blocks AS block ON block.society_id = unit.society_id AND block.id = unit.block_id
  WHERE occupant.society_id = p_society_id AND occupant.membership_id = p_membership_id
    AND occupant.status = 'active'
  ORDER BY 2, unit.id
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.community_member_unit(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_my_membership(p_society_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT membership.id FROM public.memberships AS membership
  WHERE membership.society_id = p_society_id AND membership.user_id = auth.uid()
    AND membership.status = 'active'
$$;
REVOKE ALL ON FUNCTION private.community_my_membership(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_is_participant(p_society_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships AS membership
    JOIN public.unit_occupants AS occupant
      ON occupant.society_id = membership.society_id AND occupant.membership_id = membership.id
      AND occupant.status = 'active'
    JOIN public.units AS unit
      ON unit.society_id = occupant.society_id AND unit.id = occupant.unit_id AND unit.active
    WHERE membership.society_id = p_society_id AND membership.user_id = auth.uid()
      AND membership.status = 'active' AND 'resident' = ANY (membership.roles)
  )
$$;
REVOKE ALL ON FUNCTION private.community_is_participant(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Modes: 'participant' (resident occupant), 'admin', or 'reader' (either). Authorisation always runs before
-- any argument is inspected, so outsiders get 42501 regardless of their input.
CREATE FUNCTION private.community_authorize(p_society_id uuid, p_mode text, p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL
    OR p_society_id IS NULL
    OR NOT private.module_enabled(p_society_id, 'community')
    OR NOT EXISTS (SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived')
    OR (p_write AND NOT private.society_writable(p_society_id))
    OR NOT (
      (p_mode IN ('admin', 'reader') AND private.has_role(p_society_id, ARRAY['admin']::text[]))
      OR (p_mode IN ('participant', 'reader') AND private.community_is_participant(p_society_id))
    )
  THEN
    RAISE EXCEPTION 'Community access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.community_authorize(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_write_begin(p_society_id uuid, p_mode text, p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, p_mode, true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.community_authorize(p_society_id, p_mode, true);
  IF p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'The request id is invalid.' USING ERRCODE = '22023';
  END IF;
  SET LOCAL lock_timeout = '5s';
END;
$$;
REVOKE ALL ON FUNCTION private.community_write_begin(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Audit rows never carry post, listing or reply text (D-64 §8).
CREATE FUNCTION private.community_audit(
  p_society_id uuid, p_actor_role text, p_action text, p_entity_type text, p_entity_id uuid,
  p_after jsonb, p_request_id text, p_reason text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", reason, request_id
  ) VALUES (
    p_society_id, auth.uid(), CASE WHEN auth.uid() IS NULL THEN 'system' ELSE p_actor_role END,
    'community.' || p_action, p_entity_type, p_entity_id::text, p_after, left(p_reason, 500), p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.community_audit(uuid, text, text, text, uuid, jsonb, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Active mute = not lifted and not yet ended.
CREATE FUNCTION private.community_active_mute(p_society_id uuid, p_membership_id uuid)
RETURNS public.community_mutes LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT mute.* FROM public.community_mutes AS mute
  WHERE mute.society_id = p_society_id AND mute.membership_id = p_membership_id
    AND mute.lifted_at IS NULL AND (mute.muted_until IS NULL OR mute.muted_until > clock_timestamp())
  ORDER BY mute.created_at DESC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.community_active_mute(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_assert_not_muted(p_society_id uuid, p_membership_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_mute public.community_mutes;
BEGIN
  v_mute := private.community_active_mute(p_society_id, p_membership_id);
  IF v_mute.id IS NOT NULL THEN
    RAISE EXCEPTION 'community_muted' USING ERRCODE = 'P0001',
      DETAIL = CASE WHEN v_mute.muted_until IS NULL
        THEN 'You are muted in Community until lifted by the admin.'
        ELSE 'You are muted in Community until '
          || to_char(v_mute.muted_until AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY, HH24:MI') || ' IST.' END;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.community_assert_not_muted(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Notifications only reach active members; a departed author is silently skipped.
CREATE FUNCTION private.community_notify_user(
  p_society_id uuid, p_user_id uuid, p_type text, p_title text, p_body text,
  p_entity_type text, p_entity_id uuid, p_request_id text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE society_id = p_society_id AND user_id = p_user_id AND status = 'active'
  ) THEN
    RETURN 0;
  END IF;
  PERFORM private.create_notification(p_society_id, p_user_id, p_type, left(p_title, 120), left(p_body, 300),
    p_entity_type, p_entity_id, p_request_id);
  RETURN 1;
END;
$$;
REVOKE ALL ON FUNCTION private.community_notify_user(uuid, uuid, text, text, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_notify_admins(
  p_society_id uuid, p_type text, p_title text, p_body text, p_entity_id uuid, p_request_id text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid;
  v_sent integer := 0;
BEGIN
  FOR v_user IN
    SELECT membership.user_id FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id AND membership.status = 'active'
      AND membership.user_id IS NOT NULL AND 'admin' = ANY (membership.roles)
      AND membership.user_id IS DISTINCT FROM auth.uid()
    ORDER BY membership.user_id
    LIMIT 50
  LOOP
    PERFORM private.create_notification(p_society_id, v_user, p_type, left(p_title, 120), left(p_body, 300),
      'community_admin', p_entity_id, p_request_id);
    v_sent := v_sent + 1;
  END LOOP;
  RETURN v_sent;
END;
$$;
REVOKE ALL ON FUNCTION private.community_notify_admins(uuid, text, text, text, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Photo paths: <society>/<uploader>/<uuid>.(jpg|png). Insert needs a writable, unmuted participant
-- uploading into their own folder; read is the uploader, an admin, or a participant who can see the
-- attached approved item (group members only for posts).
CREATE FUNCTION private.community_file_access(p_path text, p_for_insert boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_society uuid;
  v_uploader uuid;
  v_photo public.community_photos;
  v_membership uuid;
BEGIN
  IF p_path IS NULL OR p_path !~ (
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$'
  ) THEN RETURN false; END IF;
  v_society := split_part(p_path, '/', 1)::uuid;
  v_uploader := split_part(p_path, '/', 2)::uuid;
  IF auth.uid() IS NULL OR NOT private.module_enabled(v_society, 'community')
    OR NOT private.is_member(v_society)
    OR NOT EXISTS (SELECT 1 FROM public.societies WHERE id = v_society AND status <> 'archived')
  THEN RETURN false; END IF;
  v_membership := private.community_my_membership(v_society);
  SELECT * INTO v_photo FROM public.community_photos AS photo WHERE photo.storage_path = p_path;
  IF p_for_insert THEN
    RETURN v_photo.id IS NULL AND v_uploader = auth.uid()
      AND private.society_writable(v_society)
      AND private.community_is_participant(v_society)
      AND (private.community_active_mute(v_society, v_membership)).id IS NULL;
  END IF;
  IF v_uploader = auth.uid() OR private.has_role(v_society, ARRAY['admin']::text[]) THEN
    RETURN true;
  END IF;
  IF v_photo.id IS NULL OR v_photo.society_id <> v_society OR NOT private.community_is_participant(v_society) THEN
    RETURN false;
  END IF;
  IF v_photo.listing_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.community_listings AS listing
      WHERE listing.society_id = v_society AND listing.id = v_photo.listing_id AND listing.status = 'approved'
    );
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.community_posts AS post
    JOIN public.community_groups AS grp
      ON grp.society_id = post.society_id AND grp.id = post.group_id AND grp.status = 'active'
    JOIN public.community_group_members AS member
      ON member.society_id = post.society_id AND member.group_id = post.group_id
      AND member.membership_id = v_membership
    WHERE post.society_id = v_society AND post.id = v_photo.post_id AND post.status = 'approved'
  );
END;
$$;
REVOKE ALL ON FUNCTION private.community_file_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.community_file_access(text, boolean) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('community-photos', 'community-photos', false, 5242880, ARRAY['image/jpeg', 'image/png']::text[]);
CREATE POLICY community_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community-photos' AND private.community_file_access(name, false));
CREATE POLICY community_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-photos' AND private.community_file_access(name, true));

-- Public signatures and ACLs are fixed here; later migrations replace the bodies.
CREATE FUNCTION public.community_photo_upload_path(p_society_id uuid, p_content_type text, p_size_bytes integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_group_join(p_society_id uuid, p_group_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_group_leave(p_society_id uuid, p_group_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_post_create(
  p_society_id uuid, p_group_id uuid, p_client_request_id uuid, p_body text, p_photo_paths text[],
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_post_update(
  p_society_id uuid, p_post_id uuid, p_expected_version integer, p_body text, p_photo_paths text[],
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_post_withdraw(p_society_id uuid, p_post_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_listing_create(
  p_society_id uuid, p_client_request_id uuid, p_listing jsonb, p_photo_paths text[], p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_listing_update(
  p_society_id uuid, p_listing_id uuid, p_expected_version integer, p_listing jsonb, p_photo_paths text[],
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_listing_withdraw(p_society_id uuid, p_listing_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_listing_close(p_society_id uuid, p_listing_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_listing_renew(p_society_id uuid, p_listing_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_reply_create(
  p_society_id uuid, p_target_type text, p_target_id uuid, p_client_request_id uuid, p_body text,
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_reply_delete(p_society_id uuid, p_reply_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_report(
  p_society_id uuid, p_target_type text, p_target_id uuid, p_reason text, p_note text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_preferences_set(
  p_society_id uuid, p_new_listing_alerts boolean, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_group_save(
  p_society_id uuid, p_group_id uuid, p_expected_version integer, p_name text, p_description text,
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_group_archive(
  p_society_id uuid, p_group_id uuid, p_expected_version integer, p_archived boolean, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_moderate(
  p_society_id uuid, p_target_type text, p_target_id uuid, p_action text, p_reason text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_mute(
  p_society_id uuid, p_membership_id uuid, p_duration text, p_reason text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_unmute(p_society_id uuid, p_membership_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', true);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_home(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', false);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_group_feed(
  p_society_id uuid, p_group_id uuid, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'reader', false);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_post_get(p_society_id uuid, p_post_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'reader', false);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_marketplace(
  p_society_id uuid, p_type text, p_search text, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'reader', false);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_listing_get(p_society_id uuid, p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'reader', false);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_my_items(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', false);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_admin_queue(
  p_society_id uuid, p_queue text, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', false);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_admin_item_get(p_society_id uuid, p_target_type text, p_target_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', false);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_admin_groups(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', false);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_admin_mutes(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', false);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_member_options(p_society_id uuid, p_search text, p_limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', false);
  RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001';
END;
$$;
CREATE FUNCTION public.community_photo_access(p_society_id uuid, p_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'reader', false);
  RETURN split_part(COALESCE(p_path, ''), '/', 1) = p_society_id::text
    AND COALESCE(private.community_file_access(p_path, false), false);
END;
$$;
CREATE FUNCTION public.community_retention_files_list(p_today date)
RETURNS TABLE (bucket text, path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  RETURN;
END;
$$;
CREATE FUNCTION public.community_retention_run(p_today date, p_request_trace text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('postsDeleted', 0, 'listingsDeleted', 0, 'repliesDeleted', 0);
END;
$$;

REVOKE ALL ON FUNCTION
  public.community_photo_upload_path(uuid, text, integer),
  public.community_group_join(uuid, uuid, text),
  public.community_group_leave(uuid, uuid, text),
  public.community_post_create(uuid, uuid, uuid, text, text[], text),
  public.community_post_update(uuid, uuid, integer, text, text[], text),
  public.community_post_withdraw(uuid, uuid, text),
  public.community_listing_create(uuid, uuid, jsonb, text[], text),
  public.community_listing_update(uuid, uuid, integer, jsonb, text[], text),
  public.community_listing_withdraw(uuid, uuid, text),
  public.community_listing_close(uuid, uuid, text),
  public.community_listing_renew(uuid, uuid, text),
  public.community_reply_create(uuid, text, uuid, uuid, text, text),
  public.community_reply_delete(uuid, uuid, text),
  public.community_report(uuid, text, uuid, text, text, text),
  public.community_preferences_set(uuid, boolean, text),
  public.community_group_save(uuid, uuid, integer, text, text, text),
  public.community_group_archive(uuid, uuid, integer, boolean, text),
  public.community_moderate(uuid, text, uuid, text, text, text),
  public.community_mute(uuid, uuid, text, text, text),
  public.community_unmute(uuid, uuid, text),
  public.community_home(uuid),
  public.community_group_feed(uuid, uuid, integer, integer),
  public.community_post_get(uuid, uuid),
  public.community_marketplace(uuid, text, text, integer, integer),
  public.community_listing_get(uuid, uuid),
  public.community_my_items(uuid),
  public.community_admin_queue(uuid, text, integer, integer),
  public.community_admin_item_get(uuid, text, uuid),
  public.community_admin_groups(uuid),
  public.community_admin_mutes(uuid),
  public.community_member_options(uuid, text, integer),
  public.community_photo_access(uuid, text),
  public.community_retention_files_list(date),
  public.community_retention_run(date, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.community_photo_upload_path(uuid, text, integer),
  public.community_group_join(uuid, uuid, text),
  public.community_group_leave(uuid, uuid, text),
  public.community_post_create(uuid, uuid, uuid, text, text[], text),
  public.community_post_update(uuid, uuid, integer, text, text[], text),
  public.community_post_withdraw(uuid, uuid, text),
  public.community_listing_create(uuid, uuid, jsonb, text[], text),
  public.community_listing_update(uuid, uuid, integer, jsonb, text[], text),
  public.community_listing_withdraw(uuid, uuid, text),
  public.community_listing_close(uuid, uuid, text),
  public.community_listing_renew(uuid, uuid, text),
  public.community_reply_create(uuid, text, uuid, uuid, text, text),
  public.community_reply_delete(uuid, uuid, text),
  public.community_report(uuid, text, uuid, text, text, text),
  public.community_preferences_set(uuid, boolean, text),
  public.community_group_save(uuid, uuid, integer, text, text, text),
  public.community_group_archive(uuid, uuid, integer, boolean, text),
  public.community_moderate(uuid, text, uuid, text, text, text),
  public.community_mute(uuid, uuid, text, text, text),
  public.community_unmute(uuid, uuid, text),
  public.community_home(uuid),
  public.community_group_feed(uuid, uuid, integer, integer),
  public.community_post_get(uuid, uuid),
  public.community_marketplace(uuid, text, text, integer, integer),
  public.community_listing_get(uuid, uuid),
  public.community_my_items(uuid),
  public.community_admin_queue(uuid, text, integer, integer),
  public.community_admin_item_get(uuid, text, uuid),
  public.community_admin_groups(uuid),
  public.community_admin_mutes(uuid),
  public.community_member_options(uuid, text, integer),
  public.community_photo_access(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION
  public.community_retention_files_list(date),
  public.community_retention_run(date, text)
  TO service_role;
