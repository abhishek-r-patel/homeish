-- Resident Community & Marketplace (D-64): participant writes — photos, groups, posts, listings, replies,
-- reports and alert preferences. Every write authorises first, then validates, then audits without body text.

-- Caller's author snapshot: name from the profile and the flat label of their first occupied unit.
CREATE FUNCTION private.community_author(
  p_society_id uuid, OUT membership_id uuid, OUT author_name text, OUT unit_id uuid, OUT unit_label text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  membership_id := private.community_my_membership(p_society_id);
  SELECT left(COALESCE(NULLIF(btrim(profile.full_name), ''), 'Resident'), 120) INTO author_name
  FROM public.profiles AS profile WHERE profile.id = auth.uid();
  author_name := COALESCE(author_name, 'Resident');
  SELECT member_unit.unit_id, member_unit.label INTO unit_id, unit_label
  FROM private.community_member_unit(p_society_id, membership_id) AS member_unit;
END;
$$;
REVOKE ALL ON FUNCTION private.community_author(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_is_group_member(p_society_id uuid, p_group_id uuid, p_membership_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_group_members AS member
    WHERE member.society_id = p_society_id AND member.group_id = p_group_id
      AND member.membership_id = p_membership_id
  )
$$;
REVOKE ALL ON FUNCTION private.community_is_group_member(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_listing_expired(p_listing public.community_listings)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT p_listing.expires_at IS NOT NULL AND p_listing.expires_at <= clock_timestamp()
$$;
REVOKE ALL ON FUNCTION private.community_listing_expired(public.community_listings)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_validate_request(p_client_request_id uuid)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'The client request id is required.' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.community_validate_request(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Photos are always given as the full ordered set for the item; existing rows are replaced.
CREATE FUNCTION private.community_attach_photos(
  p_society_id uuid, p_post_id uuid, p_listing_id uuid, p_paths text[]
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  paths text[] := COALESCE(p_paths, ARRAY[]::text[]);
  photo_path text;
  photo_position integer := 0;
  object_metadata jsonb;
BEGIN
  IF cardinality(paths) > 3 OR array_position(paths, NULL) IS NOT NULL
    OR (SELECT count(DISTINCT item) FROM unnest(paths) AS item) <> cardinality(paths)
  THEN
    RAISE EXCEPTION 'community_photo_invalid' USING ERRCODE = 'P0001',
      DETAIL = 'Attach up to 3 different photos.';
  END IF;
  FOREACH photo_path IN ARRAY paths LOOP
    IF photo_path !~ (
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
        '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
        '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$')
      OR split_part(photo_path, '/', 1) <> p_society_id::text
      OR split_part(photo_path, '/', 2) <> auth.uid()::text
    THEN
      RAISE EXCEPTION 'community_photo_invalid' USING ERRCODE = 'P0001',
        DETAIL = 'Upload the photos again.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.community_photos AS photo
      WHERE photo.storage_path = photo_path
        AND (photo.post_id IS DISTINCT FROM p_post_id OR photo.listing_id IS DISTINCT FROM p_listing_id)
    ) THEN
      RAISE EXCEPTION 'community_photo_invalid' USING ERRCODE = 'P0001',
        DETAIL = 'A photo is already attached to another post or listing.';
    END IF;
    SELECT object.metadata INTO object_metadata FROM storage.objects AS object
      WHERE object.bucket_id = 'community-photos' AND object.name = photo_path
        -- New uploads must be fresh so the 1-day orphan clean-up cannot delete a file being attached;
        -- photos already on this item keep their age.
        AND (object.created_at > clock_timestamp() - interval '24 hours'
          OR EXISTS (
            SELECT 1 FROM public.community_photos AS photo
            WHERE photo.storage_path = photo_path
              AND photo.post_id IS NOT DISTINCT FROM p_post_id
              AND photo.listing_id IS NOT DISTINCT FROM p_listing_id
          ));
    IF NOT FOUND THEN
      RAISE EXCEPTION 'community_photo_invalid' USING ERRCODE = 'P0001',
        DETAIL = 'A photo upload is missing or expired. Upload the photo again.';
    END IF;
    IF NOT (
        (COALESCE(object_metadata ->> 'mimetype', '') = 'image/jpeg' AND right(photo_path, 4) = '.jpg')
        OR (COALESCE(object_metadata ->> 'mimetype', '') = 'image/png' AND right(photo_path, 4) = '.png')
      )
      OR (CASE WHEN COALESCE(object_metadata ->> 'size', '') ~ '^[0-9]{1,8}$'
        THEN (object_metadata ->> 'size')::integer NOT BETWEEN 1 AND 5242880 ELSE true END)
    THEN
      RAISE EXCEPTION 'community_photo_invalid' USING ERRCODE = 'P0001',
        DETAIL = 'Use JPG or PNG photos up to 5 MiB.';
    END IF;
  END LOOP;
  DELETE FROM public.community_photos AS photo
  WHERE photo.society_id = p_society_id
    AND ((p_post_id IS NOT NULL AND photo.post_id = p_post_id)
      OR (p_listing_id IS NOT NULL AND photo.listing_id = p_listing_id));
  FOREACH photo_path IN ARRAY paths LOOP
    photo_position := photo_position + 1;
    INSERT INTO public.community_photos (society_id, post_id, listing_id, storage_path, position, created_by)
    VALUES (p_society_id, p_post_id, p_listing_id, photo_path, photo_position, auth.uid());
  END LOOP;
  RETURN cardinality(paths);
END;
$$;
REVOKE ALL ON FUNCTION private.community_attach_photos(uuid, uuid, uuid, text[])
  FROM PUBLIC, anon, authenticated, service_role;

-- Listing payload: {listingType, title, description|null, pricePaise|null, contactPhone|null}; anything
-- else is a bad argument.
CREATE FUNCTION private.community_parse_listing(p_listing jsonb)
RETURNS public.community_listings LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  result public.community_listings;
  bad boolean := false;
BEGIN
  IF p_listing IS NULL OR jsonb_typeof(p_listing) <> 'object'
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_listing) AS item
      WHERE item NOT IN ('listingType', 'title', 'description', 'pricePaise', 'contactPhone')
    )
    OR jsonb_typeof(p_listing -> 'listingType') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_listing -> 'title') IS DISTINCT FROM 'string'
    OR COALESCE(jsonb_typeof(p_listing -> 'description'), 'null') NOT IN ('string', 'null')
    OR COALESCE(jsonb_typeof(p_listing -> 'pricePaise'), 'null') NOT IN ('number', 'null')
    OR COALESCE(jsonb_typeof(p_listing -> 'contactPhone'), 'null') NOT IN ('string', 'null')
  THEN
    bad := true;
  ELSE
    result.listing_type := p_listing ->> 'listingType';
    result.title := btrim(p_listing ->> 'title');
    result.description := NULLIF(btrim(COALESCE(p_listing ->> 'description', '')), '');
    result.contact_phone := NULLIF(btrim(COALESCE(p_listing ->> 'contactPhone', '')), '');
    IF jsonb_typeof(p_listing -> 'pricePaise') = 'number' THEN
      IF (p_listing ->> 'pricePaise') !~ '^[0-9]{1,10}$' THEN
        bad := true;
      ELSE
        result.price_paise := (p_listing ->> 'pricePaise')::bigint;
      END IF;
    END IF;
    bad := bad
      OR result.listing_type NOT IN ('sale', 'give_away', 'wanted', 'lost', 'found')
      OR char_length(result.title) NOT BETWEEN 1 AND 120
      OR COALESCE(char_length(result.description), 0) > 4000
      OR (result.price_paise IS NOT NULL
        AND (result.listing_type <> 'sale' OR result.price_paise NOT BETWEEN 0 AND 1000000000))
      OR (result.contact_phone IS NOT NULL AND result.contact_phone !~ '^[0-9+ ]{8,16}$');
  END IF;
  IF bad THEN
    RAISE EXCEPTION 'Give a listing type, a title up to 120 characters, a description up to 4000 characters, a price only for items for sale and an 8 to 16 digit phone number.'
      USING ERRCODE = '22023';
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION private.community_parse_listing(jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.community_photo_upload_path(
  p_society_id uuid, p_content_type text, p_size_bytes integer
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  path text;
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', true);
  IF p_content_type IS NULL OR p_content_type NOT IN ('image/jpeg', 'image/png')
    OR p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 5242880
  THEN RAISE EXCEPTION 'Use a JPG or PNG photo up to 5 MiB.' USING ERRCODE = '22023'; END IF;
  PERFORM private.community_assert_not_muted(p_society_id, private.community_my_membership(p_society_id));
  path := p_society_id::text || '/' || auth.uid()::text || '/' || gen_random_uuid()::text
    || CASE p_content_type WHEN 'image/jpeg' THEN '.jpg' ELSE '.png' END;
  IF NOT COALESCE(private.community_file_access(path, true), false) THEN
    RAISE EXCEPTION 'Community photo upload is not available.' USING ERRCODE = '42501';
  END IF;
  RETURN path;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_group_join(p_society_id uuid, p_group_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  grp public.community_groups;
  membership uuid;
  inserted integer;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  SELECT * INTO grp FROM public.community_groups
    WHERE society_id = p_society_id AND id = p_group_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The group was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF grp.status <> 'active' THEN
    RAISE EXCEPTION 'community_group_archived' USING ERRCODE = 'P0001', DETAIL = 'This group is archived.';
  END IF;
  membership := private.community_my_membership(p_society_id);
  INSERT INTO public.community_group_members (society_id, group_id, membership_id)
  VALUES (p_society_id, p_group_id, membership) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted > 0 THEN
    PERFORM private.community_audit(p_society_id, 'resident', 'group.join', 'community_group', p_group_id,
      jsonb_build_object('membership_id', membership), p_request_id);
  END IF;
  RETURN jsonb_build_object('groupId', p_group_id, 'joined', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_group_leave(p_society_id uuid, p_group_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  membership uuid;
  deleted integer;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  IF NOT EXISTS (SELECT 1 FROM public.community_groups WHERE society_id = p_society_id AND id = p_group_id) THEN
    RAISE EXCEPTION 'The group was not found.' USING ERRCODE = 'P0002';
  END IF;
  membership := private.community_my_membership(p_society_id);
  DELETE FROM public.community_group_members
  WHERE society_id = p_society_id AND group_id = p_group_id AND membership_id = membership;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  IF deleted > 0 THEN
    PERFORM private.community_audit(p_society_id, 'resident', 'group.leave', 'community_group', p_group_id,
      jsonb_build_object('membership_id', membership), p_request_id);
  END IF;
  RETURN jsonb_build_object('groupId', p_group_id, 'joined', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_post_create(
  p_society_id uuid, p_group_id uuid, p_client_request_id uuid, p_body text, p_photo_paths text[],
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_body text := btrim(COALESCE(p_body, ''));
  grp public.community_groups;
  author record;
  post public.community_posts;
  photo_count integer;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  PERFORM private.community_validate_request(p_client_request_id);
  IF char_length(clean_body) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Write a post of up to 4000 characters.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('community-create:' || auth.uid()::text, 0));
  SELECT * INTO post FROM public.community_posts
    WHERE society_id = p_society_id AND author_user_id = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('postId', post.id, 'status', post.status);
  END IF;
  SELECT * INTO grp FROM public.community_groups
    WHERE society_id = p_society_id AND id = p_group_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The group was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF grp.status <> 'active' THEN
    RAISE EXCEPTION 'community_group_archived' USING ERRCODE = 'P0001', DETAIL = 'This group is archived.';
  END IF;
  SELECT * INTO author FROM private.community_author(p_society_id);
  IF NOT private.community_is_group_member(p_society_id, p_group_id, author.membership_id) THEN
    RAISE EXCEPTION 'community_not_member' USING ERRCODE = 'P0001', DETAIL = 'Join the group to post in it.';
  END IF;
  PERFORM private.community_assert_not_muted(p_society_id, author.membership_id);
  INSERT INTO public.community_posts (
    society_id, group_id, author_membership_id, author_user_id, author_name, author_unit_label, body,
    client_request_id
  ) VALUES (
    p_society_id, p_group_id, author.membership_id, auth.uid(), author.author_name, author.unit_label,
    clean_body, p_client_request_id
  ) RETURNING * INTO post;
  photo_count := private.community_attach_photos(p_society_id, post.id, NULL, p_photo_paths);
  PERFORM private.community_audit(p_society_id, 'resident', 'post.create', 'community_post', post.id,
    jsonb_build_object('group_id', p_group_id, 'status', post.status, 'photo_count', photo_count), p_request_id);
  PERFORM private.community_notify_admins(p_society_id, 'community_pending', 'Community post waiting for review',
    'A resident posted in ' || grp.name || '. Review it before it is shown.', post.id, p_request_id);
  RETURN jsonb_build_object('postId', post.id, 'status', post.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_post_update(
  p_society_id uuid, p_post_id uuid, p_expected_version integer, p_body text, p_photo_paths text[],
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_body text := btrim(COALESCE(p_body, ''));
  post public.community_posts;
  photo_count integer;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  IF p_expected_version IS NULL OR char_length(clean_body) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Write a post of up to 4000 characters.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO post FROM public.community_posts
    WHERE society_id = p_society_id AND id = p_post_id AND author_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The post was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF post.version <> p_expected_version THEN
    RAISE EXCEPTION 'The post changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  IF post.status <> 'pending' THEN
    RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only posts waiting for review can be edited.';
  END IF;
  PERFORM private.community_assert_not_muted(p_society_id, post.author_membership_id);
  UPDATE public.community_posts
  SET body = clean_body, updated_at = clock_timestamp(), version = version + 1
  WHERE society_id = p_society_id AND id = p_post_id
  RETURNING * INTO post;
  IF p_photo_paths IS NOT NULL THEN
    photo_count := private.community_attach_photos(p_society_id, post.id, NULL, p_photo_paths);
  END IF;
  PERFORM private.community_audit(p_society_id, 'resident', 'post.update', 'community_post', post.id,
    jsonb_build_object('version', post.version, 'photo_count', photo_count), p_request_id);
  RETURN jsonb_build_object('postId', post.id, 'version', post.version);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_post_withdraw(p_society_id uuid, p_post_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  post public.community_posts;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  SELECT * INTO post FROM public.community_posts
    WHERE society_id = p_society_id AND id = p_post_id AND author_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The post was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF post.status NOT IN ('pending', 'approved', 'hidden') THEN
    RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'This post can no longer be deleted.';
  END IF;
  UPDATE public.community_posts
  SET status = 'withdrawn', status_changed_at = clock_timestamp(), updated_at = clock_timestamp(),
    version = version + 1
  WHERE society_id = p_society_id AND id = p_post_id
  RETURNING * INTO post;
  PERFORM private.community_audit(p_society_id, 'resident', 'post.withdraw', 'community_post', post.id,
    jsonb_build_object('status', post.status), p_request_id);
  RETURN jsonb_build_object('postId', post.id, 'status', post.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_listing_create(
  p_society_id uuid, p_client_request_id uuid, p_listing jsonb, p_photo_paths text[], p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  parsed public.community_listings;
  author record;
  listing public.community_listings;
  photo_count integer;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  PERFORM private.community_validate_request(p_client_request_id);
  parsed := private.community_parse_listing(p_listing);
  PERFORM pg_advisory_xact_lock(hashtextextended('community-create:' || auth.uid()::text, 0));
  SELECT * INTO listing FROM public.community_listings
    WHERE society_id = p_society_id AND author_user_id = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('listingId', listing.id, 'status', listing.status);
  END IF;
  SELECT * INTO author FROM private.community_author(p_society_id);
  PERFORM private.community_assert_not_muted(p_society_id, author.membership_id);
  INSERT INTO public.community_listings (
    society_id, author_membership_id, author_user_id, author_name, author_unit_label, listing_type, title,
    description, price_paise, contact_phone, client_request_id
  ) VALUES (
    p_society_id, author.membership_id, auth.uid(), author.author_name, author.unit_label, parsed.listing_type,
    parsed.title, parsed.description, parsed.price_paise, parsed.contact_phone, p_client_request_id
  ) RETURNING * INTO listing;
  photo_count := private.community_attach_photos(p_society_id, NULL, listing.id, p_photo_paths);
  PERFORM private.community_audit(p_society_id, 'resident', 'listing.create', 'community_listing', listing.id,
    jsonb_build_object('listing_type', listing.listing_type, 'status', listing.status,
      'has_price', listing.price_paise IS NOT NULL, 'shares_phone', listing.contact_phone IS NOT NULL,
      'photo_count', photo_count), p_request_id);
  PERFORM private.community_notify_admins(p_society_id, 'community_pending', 'Listing waiting for review',
    'A resident added a marketplace listing. Review it before it is shown.', listing.id, p_request_id);
  RETURN jsonb_build_object('listingId', listing.id, 'status', listing.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_listing_update(
  p_society_id uuid, p_listing_id uuid, p_expected_version integer, p_listing jsonb, p_photo_paths text[],
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  parsed public.community_listings;
  listing public.community_listings;
  photo_count integer;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'The listing version is required.' USING ERRCODE = '22023';
  END IF;
  parsed := private.community_parse_listing(p_listing);
  SELECT * INTO listing FROM public.community_listings
    WHERE society_id = p_society_id AND id = p_listing_id AND author_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The listing was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF listing.version <> p_expected_version THEN
    RAISE EXCEPTION 'The listing changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  IF listing.status <> 'pending' THEN
    RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only listings waiting for review can be edited.';
  END IF;
  PERFORM private.community_assert_not_muted(p_society_id, listing.author_membership_id);
  UPDATE public.community_listings
  SET listing_type = parsed.listing_type, title = parsed.title, description = parsed.description,
    price_paise = parsed.price_paise, contact_phone = parsed.contact_phone,
    updated_at = clock_timestamp(), version = version + 1
  WHERE society_id = p_society_id AND id = p_listing_id
  RETURNING * INTO listing;
  IF p_photo_paths IS NOT NULL THEN
    photo_count := private.community_attach_photos(p_society_id, NULL, listing.id, p_photo_paths);
  END IF;
  PERFORM private.community_audit(p_society_id, 'resident', 'listing.update', 'community_listing', listing.id,
    jsonb_build_object('version', listing.version, 'listing_type', listing.listing_type,
      'photo_count', photo_count), p_request_id);
  RETURN jsonb_build_object('listingId', listing.id, 'version', listing.version);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_listing_withdraw(p_society_id uuid, p_listing_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  listing public.community_listings;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  SELECT * INTO listing FROM public.community_listings
    WHERE society_id = p_society_id AND id = p_listing_id AND author_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The listing was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF listing.status NOT IN ('pending', 'approved', 'hidden') THEN
    RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'This listing can no longer be deleted.';
  END IF;
  UPDATE public.community_listings
  SET status = 'withdrawn', status_changed_at = clock_timestamp(), updated_at = clock_timestamp(),
    version = version + 1
  WHERE society_id = p_society_id AND id = p_listing_id
  RETURNING * INTO listing;
  PERFORM private.community_audit(p_society_id, 'resident', 'listing.withdraw', 'community_listing', listing.id,
    jsonb_build_object('status', listing.status), p_request_id);
  RETURN jsonb_build_object('listingId', listing.id, 'status', listing.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_listing_close(p_society_id uuid, p_listing_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  listing public.community_listings;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  SELECT * INTO listing FROM public.community_listings
    WHERE society_id = p_society_id AND id = p_listing_id AND author_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The listing was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF listing.status <> 'approved' OR listing.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only open, approved listings can be closed.';
  END IF;
  UPDATE public.community_listings
  SET closed_at = clock_timestamp(), updated_at = clock_timestamp(), version = version + 1
  WHERE society_id = p_society_id AND id = p_listing_id
  RETURNING * INTO listing;
  PERFORM private.community_audit(p_society_id, 'resident', 'listing.close', 'community_listing', listing.id,
    jsonb_build_object('closed_at', listing.closed_at), p_request_id);
  RETURN jsonb_build_object('listingId', listing.id, 'closedAt', listing.closed_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_listing_renew(p_society_id uuid, p_listing_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  listing public.community_listings;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  SELECT * INTO listing FROM public.community_listings
    WHERE society_id = p_society_id AND id = p_listing_id AND author_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The listing was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF listing.status <> 'approved' OR listing.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'Only approved listings that are not closed can be renewed.';
  END IF;
  UPDATE public.community_listings
  SET expires_at = clock_timestamp() + interval '30 days', updated_at = clock_timestamp(), version = version + 1
  WHERE society_id = p_society_id AND id = p_listing_id
  RETURNING * INTO listing;
  PERFORM private.community_audit(p_society_id, 'resident', 'listing.renew', 'community_listing', listing.id,
    jsonb_build_object('expires_at', listing.expires_at), p_request_id);
  RETURN jsonb_build_object('listingId', listing.id, 'expiresAt', listing.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_reply_create(
  p_society_id uuid, p_target_type text, p_target_id uuid, p_client_request_id uuid, p_body text,
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_body text := btrim(COALESCE(p_body, ''));
  author record;
  post public.community_posts;
  listing public.community_listings;
  reply public.community_replies;
  owner_id uuid;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  PERFORM private.community_validate_request(p_client_request_id);
  IF p_target_type IS NULL OR p_target_type NOT IN ('post', 'listing')
    OR char_length(clean_body) NOT BETWEEN 1 AND 2000
  THEN
    RAISE EXCEPTION 'Write a reply of up to 2000 characters.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('community-create:' || auth.uid()::text, 0));
  SELECT * INTO reply FROM public.community_replies
    WHERE society_id = p_society_id AND author_user_id = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('replyId', reply.id);
  END IF;
  SELECT * INTO author FROM private.community_author(p_society_id);
  IF p_target_type = 'post' THEN
    SELECT * INTO post FROM public.community_posts
      WHERE society_id = p_society_id AND id = p_target_id FOR KEY SHARE;
    IF NOT FOUND OR (post.status <> 'approved' AND post.author_user_id IS DISTINCT FROM auth.uid())
      OR NOT EXISTS (SELECT 1 FROM public.community_groups
        WHERE society_id = p_society_id AND id = post.group_id AND status = 'active')
    THEN
      RAISE EXCEPTION 'The post was not found.' USING ERRCODE = 'P0002';
    END IF;
    IF NOT private.community_is_group_member(p_society_id, post.group_id, author.membership_id) THEN
      RAISE EXCEPTION 'community_not_member' USING ERRCODE = 'P0001', DETAIL = 'Join the group to reply.';
    END IF;
    IF post.status <> 'approved' THEN
      RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001',
        DETAIL = 'Replies open once the post is approved.';
    END IF;
    owner_id := post.author_user_id;
  ELSE
    SELECT * INTO listing FROM public.community_listings
      WHERE society_id = p_society_id AND id = p_target_id FOR KEY SHARE;
    IF NOT FOUND OR (listing.status <> 'approved' AND listing.author_user_id IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION 'The listing was not found.' USING ERRCODE = 'P0002';
    END IF;
    IF listing.status <> 'approved' OR listing.closed_at IS NOT NULL
      OR private.community_listing_expired(listing)
    THEN
      RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001',
        DETAIL = 'Replies are open only on approved listings that are not closed or expired.';
    END IF;
    owner_id := listing.author_user_id;
  END IF;
  PERFORM private.community_assert_not_muted(p_society_id, author.membership_id);
  INSERT INTO public.community_replies (
    society_id, post_id, listing_id, author_membership_id, author_user_id, author_name, author_unit_label,
    body, client_request_id
  ) VALUES (
    p_society_id, post.id, listing.id, author.membership_id, auth.uid(), author.author_name,
    author.unit_label, clean_body, p_client_request_id
  ) RETURNING * INTO reply;
  PERFORM private.community_audit(p_society_id, 'resident', 'reply.create', 'community_reply', reply.id,
    jsonb_build_object('target_type', p_target_type, 'target_id', p_target_id), p_request_id);
  IF owner_id IS DISTINCT FROM auth.uid() THEN
    IF p_target_type = 'post' THEN
      PERFORM private.community_notify_user(p_society_id, owner_id, 'community_reply', 'New reply to your post',
        author.author_name || ' replied to your community post.', 'community_post', post.id, p_request_id);
    ELSE
      PERFORM private.community_notify_user(p_society_id, owner_id, 'community_reply',
        'New reply to your listing',
        author.author_name || ' replied to your listing "' || left(listing.title, 120) || '".',
        'community_listing', listing.id, p_request_id);
    END IF;
  END IF;
  RETURN jsonb_build_object('replyId', reply.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_reply_delete(p_society_id uuid, p_reply_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  reply public.community_replies;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  SELECT * INTO reply FROM public.community_replies
    WHERE society_id = p_society_id AND id = p_reply_id AND author_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The reply was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF reply.status = 'removed' THEN
    RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'This reply was already removed.';
  END IF;
  UPDATE public.community_replies
  SET status = 'removed', moderation_reason = 'Deleted by author', moderated_by = auth.uid(),
    moderated_at = clock_timestamp(), status_changed_at = clock_timestamp()
  WHERE society_id = p_society_id AND id = p_reply_id;
  UPDATE public.community_reports
  SET status = 'dismissed', resolved_by = auth.uid(), resolved_at = clock_timestamp()
  WHERE society_id = p_society_id AND reply_id = p_reply_id AND status = 'open';
  PERFORM private.community_audit(p_society_id, 'resident', 'reply.delete', 'community_reply', reply.id,
    jsonb_build_object('status', 'removed'), p_request_id);
  RETURN jsonb_build_object('deleted', true);
END;
$$;

-- Reports count distinct flats; the third flat hides the item until an admin reviews it.
CREATE OR REPLACE FUNCTION public.community_report(
  p_society_id uuid, p_target_type text, p_target_id uuid, p_reason text, p_note text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  reporter record;
  post public.community_posts;
  listing public.community_listings;
  reply public.community_replies;
  owner_id uuid;
  report_id uuid;
  flats integer;
  hidden boolean := false;
  entity_type text;
  entity_id uuid;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  IF p_target_type IS NULL OR p_target_type NOT IN ('post', 'listing', 'reply')
    OR p_reason IS NULL OR p_reason NOT IN ('spam', 'offensive', 'scam', 'other')
    OR COALESCE(char_length(clean_note), 0) > 500
  THEN
    RAISE EXCEPTION 'Choose a reason and keep the note to 500 characters.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO reporter FROM private.community_author(p_society_id);
  IF p_target_type = 'reply' THEN
    SELECT * INTO reply FROM public.community_replies
      WHERE society_id = p_society_id AND id = p_target_id FOR UPDATE;
    IF NOT FOUND OR reply.status <> 'visible' THEN
      RAISE EXCEPTION 'The reply was not found.' USING ERRCODE = 'P0002';
    END IF;
    owner_id := reply.author_user_id;
    IF reply.post_id IS NOT NULL THEN
      SELECT * INTO post FROM public.community_posts WHERE society_id = p_society_id AND id = reply.post_id;
      entity_type := 'community_post';
      entity_id := post.id;
    ELSE
      SELECT * INTO listing FROM public.community_listings WHERE society_id = p_society_id AND id = reply.listing_id;
      entity_type := 'community_listing';
      entity_id := listing.id;
    END IF;
  ELSIF p_target_type = 'post' THEN
    SELECT * INTO post FROM public.community_posts WHERE society_id = p_society_id AND id = p_target_id FOR UPDATE;
    owner_id := post.author_user_id;
    entity_type := 'community_post';
    entity_id := post.id;
  ELSE
    SELECT * INTO listing FROM public.community_listings
      WHERE society_id = p_society_id AND id = p_target_id FOR UPDATE;
    owner_id := listing.author_user_id;
    entity_type := 'community_listing';
    entity_id := listing.id;
  END IF;
  -- The item (or the reply's parent) must be approved and visible to the reporter.
  IF (post.id IS NOT NULL AND (post.status <> 'approved'
        OR NOT EXISTS (SELECT 1 FROM public.community_groups
          WHERE society_id = p_society_id AND id = post.group_id AND status = 'active')
        OR NOT private.community_is_group_member(p_society_id, post.group_id, reporter.membership_id)))
    OR (listing.id IS NOT NULL AND listing.status <> 'approved')
    OR (post.id IS NULL AND listing.id IS NULL)
  THEN
    RAISE EXCEPTION 'The item was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF owner_id = auth.uid() THEN
    RAISE EXCEPTION 'community_own_item' USING ERRCODE = 'P0001', DETAIL = 'You cannot report your own item.';
  END IF;
  IF reporter.unit_id IS NULL THEN
    RAISE EXCEPTION 'Community access is not available.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.community_reports AS report
    WHERE report.society_id = p_society_id AND report.target_type = p_target_type
      AND report.target_id = p_target_id
      AND (report.reporter_user_id = auth.uid() OR report.reporter_unit_id = reporter.unit_id)
  ) THEN
    RAISE EXCEPTION 'community_already_reported' USING ERRCODE = 'P0001',
      DETAIL = 'You or someone in your flat already reported this.';
  END IF;
  INSERT INTO public.community_reports (
    society_id, target_type, post_id, listing_id, reply_id, reporter_user_id, reporter_unit_id, reason, note
  ) VALUES (
    p_society_id, p_target_type,
    CASE WHEN p_target_type = 'post' THEN p_target_id END,
    CASE WHEN p_target_type = 'listing' THEN p_target_id END,
    CASE WHEN p_target_type = 'reply' THEN p_target_id END,
    auth.uid(), reporter.unit_id, p_reason, clean_note
  ) RETURNING id INTO report_id;
  SELECT count(DISTINCT report.reporter_unit_id) INTO flats FROM public.community_reports AS report
    WHERE report.society_id = p_society_id AND report.target_type = p_target_type
      AND report.target_id = p_target_id AND report.status = 'open';
  IF flats >= 3 THEN
    hidden := true;
    IF p_target_type = 'post' THEN
      UPDATE public.community_posts
      SET status = 'hidden', status_changed_at = clock_timestamp(), updated_at = clock_timestamp(),
        version = version + 1
      WHERE society_id = p_society_id AND id = p_target_id;
    ELSIF p_target_type = 'listing' THEN
      UPDATE public.community_listings
      SET status = 'hidden', status_changed_at = clock_timestamp(), updated_at = clock_timestamp(),
        version = version + 1
      WHERE society_id = p_society_id AND id = p_target_id;
    ELSE
      UPDATE public.community_replies
      SET status = 'hidden', status_changed_at = clock_timestamp()
      WHERE society_id = p_society_id AND id = p_target_id;
    END IF;
  END IF;
  PERFORM private.community_audit(p_society_id, 'resident', 'report.create', 'community_' || p_target_type,
    p_target_id, jsonb_build_object('report_id', report_id, 'reason', p_reason, 'flats', flats,
      'hidden', hidden), p_request_id);
  IF hidden THEN
    PERFORM private.community_notify_user(p_society_id, owner_id, 'community_hidden',
      'Your ' || p_target_type || ' was hidden',
      'Several flats reported your ' || p_target_type || '. It is hidden until the admin reviews it.',
      entity_type, entity_id, p_request_id);
    PERFORM private.community_notify_admins(p_society_id, 'community_hidden', 'Community item hidden after reports',
      'A ' || p_target_type || ' was reported by 3 flats and is hidden until you review it.',
      p_target_id, p_request_id);
  END IF;
  RETURN jsonb_build_object('reportId', report_id, 'hidden', hidden);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_preferences_set(
  p_society_id uuid, p_new_listing_alerts boolean, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  membership uuid;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'participant', p_request_id);
  IF p_new_listing_alerts IS NULL THEN
    RAISE EXCEPTION 'Choose whether to get new listing alerts.' USING ERRCODE = '22023';
  END IF;
  membership := private.community_my_membership(p_society_id);
  INSERT INTO public.community_preferences (society_id, membership_id, new_listing_alerts)
  VALUES (p_society_id, membership, p_new_listing_alerts)
  ON CONFLICT (society_id, membership_id) DO UPDATE
    SET new_listing_alerts = EXCLUDED.new_listing_alerts, updated_at = clock_timestamp();
  PERFORM private.community_audit(p_society_id, 'resident', 'preferences.update', 'community_preferences',
    membership, jsonb_build_object('new_listing_alerts', p_new_listing_alerts), p_request_id);
  RETURN jsonb_build_object('newListingAlerts', p_new_listing_alerts);
END;
$$;
