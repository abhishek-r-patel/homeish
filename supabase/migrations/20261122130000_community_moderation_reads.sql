-- Resident Community & Marketplace (D-64): admin moderation, groups and mutes, read models and retention.

CREATE FUNCTION private.community_page(p_limit integer, p_offset integer, p_max integer, OUT lim integer, OUT off integer)
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  lim := COALESCE(p_limit, 20);
  off := COALESCE(p_offset, 0);
  IF lim NOT BETWEEN 1 AND p_max OR off < 0 THEN
    RAISE EXCEPTION 'Choose a page size from 1 to % and a non-negative offset.', p_max USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.community_page(integer, integer, integer) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_search_pattern(p_search text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  clean text := NULLIF(btrim(COALESCE(p_search, '')), '');
BEGIN
  IF clean IS NULL THEN RETURN NULL; END IF;
  IF char_length(clean) > 100 THEN
    RAISE EXCEPTION 'Search with up to 100 characters.' USING ERRCODE = '22023';
  END IF;
  RETURN '%' || replace(replace(replace(clean, '\', '\\'), '%', '\%'), '_', '\_') || '%';
END;
$$;
REVOKE ALL ON FUNCTION private.community_search_pattern(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_photos_json(p_society_id uuid, p_post_id uuid, p_listing_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', photo.id, 'path', photo.storage_path,
    'position', photo.position) ORDER BY photo.position), '[]'::jsonb)
  FROM public.community_photos AS photo
  WHERE photo.society_id = p_society_id
    AND ((p_post_id IS NOT NULL AND photo.post_id = p_post_id)
      OR (p_listing_id IS NOT NULL AND photo.listing_id = p_listing_id))
$$;
REVOKE ALL ON FUNCTION private.community_photos_json(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_mute_json(p_mute public.community_mutes)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_mute.id IS NULL THEN NULL ELSE jsonb_build_object(
    'muteId', p_mute.id, 'duration', p_mute.duration, 'mutedUntil', p_mute.muted_until,
    'untilLifted', p_mute.muted_until IS NULL, 'reason', p_mute.reason, 'createdAt', p_mute.created_at
  ) END
$$;
REVOKE ALL ON FUNCTION private.community_mute_json(public.community_mutes)
  FROM PUBLIC, anon, authenticated, service_role;

-- Replies a reader may see: everything for admins; otherwise visible ones plus the reader's own hidden ones.
CREATE FUNCTION private.community_replies_json(p_society_id uuid, p_post_id uuid, p_listing_id uuid, p_admin boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', reply.id, 'body', reply.body, 'authorName', reply.author_name,
      'authorUnitLabel', reply.author_unit_label, 'createdAt', reply.created_at,
      'mine', reply.author_user_id = auth.uid(), 'status', reply.status,
      'reportedByMe', EXISTS (
        SELECT 1 FROM public.community_reports AS report
        WHERE report.society_id = reply.society_id AND report.reply_id = reply.id
          AND report.reporter_user_id = auth.uid()
      )
    ) ORDER BY reply.created_at, reply.id), '[]'::jsonb)
  FROM (
    SELECT * FROM public.community_replies AS candidate
    WHERE candidate.society_id = p_society_id
      AND ((p_post_id IS NOT NULL AND candidate.post_id = p_post_id)
        OR (p_listing_id IS NOT NULL AND candidate.listing_id = p_listing_id))
      AND (p_admin OR candidate.status = 'visible'
        OR (candidate.status = 'hidden' AND candidate.author_user_id = auth.uid()))
    ORDER BY candidate.created_at, candidate.id
    LIMIT 500
  ) AS reply
$$;
REVOKE ALL ON FUNCTION private.community_replies_json(uuid, uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_new_listing_alert_cap()
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT 2000 $$;
REVOKE ALL ON FUNCTION private.community_new_listing_alert_cap() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.community_group_save(
  p_society_id uuid, p_group_id uuid, p_expected_version integer, p_name text, p_description text,
  p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_name text := btrim(COALESCE(p_name, ''));
  clean_description text := NULLIF(btrim(COALESCE(p_description, '')), '');
  grp public.community_groups;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'admin', p_request_id);
  IF char_length(clean_name) NOT BETWEEN 1 AND 80 OR COALESCE(char_length(clean_description), 0) > 500
    OR (p_group_id IS NOT NULL AND p_expected_version IS NULL)
  THEN
    RAISE EXCEPTION 'Give the group a name up to 80 characters and a description up to 500 characters.'
      USING ERRCODE = '22023';
  END IF;
  IF p_group_id IS NOT NULL THEN
    SELECT * INTO grp FROM public.community_groups WHERE society_id = p_society_id AND id = p_group_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The group was not found.' USING ERRCODE = 'P0002';
    END IF;
    IF grp.version <> p_expected_version THEN
      RAISE EXCEPTION 'The group changed. Reload and try again.' USING ERRCODE = '40001';
    END IF;
    IF grp.status <> 'active' THEN
      RAISE EXCEPTION 'community_group_archived' USING ERRCODE = 'P0001',
        DETAIL = 'Restore the group before renaming it.';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.community_groups AS other
    WHERE other.society_id = p_society_id AND other.status = 'active'
      AND lower(other.name) = lower(clean_name) AND other.id IS DISTINCT FROM p_group_id
  ) THEN
    RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'A group with this name already exists.';
  END IF;
  IF p_group_id IS NULL THEN
    INSERT INTO public.community_groups (society_id, name, description, created_by, updated_by)
    VALUES (p_society_id, clean_name, clean_description, auth.uid(), auth.uid())
    RETURNING * INTO grp;
    PERFORM private.community_audit(p_society_id, 'admin', 'group.create', 'community_group', grp.id,
      jsonb_build_object('name', grp.name, 'version', grp.version), p_request_id);
  ELSE
    UPDATE public.community_groups
    SET name = clean_name, description = clean_description, updated_by = auth.uid(),
      updated_at = clock_timestamp(), version = version + 1
    WHERE society_id = p_society_id AND id = p_group_id
    RETURNING * INTO grp;
    PERFORM private.community_audit(p_society_id, 'admin', 'group.update', 'community_group', grp.id,
      jsonb_build_object('name', grp.name, 'version', grp.version), p_request_id);
  END IF;
  RETURN jsonb_build_object('groupId', grp.id, 'version', grp.version);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_group_archive(
  p_society_id uuid, p_group_id uuid, p_expected_version integer, p_archived boolean, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  grp public.community_groups;
  next_status text;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'admin', p_request_id);
  IF p_expected_version IS NULL OR p_archived IS NULL THEN
    RAISE EXCEPTION 'Give the group version and whether to archive it.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO grp FROM public.community_groups WHERE society_id = p_society_id AND id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The group was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF grp.version <> p_expected_version THEN
    RAISE EXCEPTION 'The group changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  next_status := CASE WHEN p_archived THEN 'archived' ELSE 'active' END;
  IF grp.status = next_status THEN
    RETURN jsonb_build_object('groupId', grp.id, 'version', grp.version, 'status', grp.status);
  END IF;
  IF next_status = 'active' AND EXISTS (
    SELECT 1 FROM public.community_groups AS other
    WHERE other.society_id = p_society_id AND other.status = 'active'
      AND lower(other.name) = lower(grp.name) AND other.id <> grp.id
  ) THEN
    RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'An active group already uses this name. Rename one of them first.';
  END IF;
  UPDATE public.community_groups
  SET status = next_status, updated_by = auth.uid(), updated_at = clock_timestamp(), version = version + 1
  WHERE society_id = p_society_id AND id = p_group_id
  RETURNING * INTO grp;
  PERFORM private.community_audit(p_society_id, 'admin', CASE WHEN p_archived THEN 'group.archive'
    ELSE 'group.restore' END, 'community_group', grp.id,
    jsonb_build_object('status', grp.status, 'version', grp.version), p_request_id);
  RETURN jsonb_build_object('groupId', grp.id, 'version', grp.version, 'status', grp.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_moderate(
  p_society_id uuid, p_target_type text, p_target_id uuid, p_action text, p_reason text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  post public.community_posts;
  listing public.community_listings;
  reply public.community_replies;
  current_status text;
  next_status text;
  owner_id uuid;
  entity_type text;
  entity_id uuid;
  label text;
  reports_resolved integer := 0;
  alerts_total integer := 0;
  alerts_sent integer := 0;
  alert_cap integer := private.community_new_listing_alert_cap();
  recipient uuid;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'admin', p_request_id);
  IF p_target_type IS NULL OR p_target_type NOT IN ('post', 'listing', 'reply')
    OR p_action IS NULL OR p_action NOT IN ('approve', 'reject', 'remove', 'restore')
    OR (p_target_type = 'reply' AND p_action IN ('approve', 'reject'))
    OR (p_action IN ('reject', 'remove') AND (clean_reason IS NULL OR char_length(clean_reason) > 500))
  THEN
    RAISE EXCEPTION 'Choose a valid action and give a reason up to 500 characters when rejecting or removing.'
      USING ERRCODE = '22023';
  END IF;
  IF p_target_type = 'post' THEN
    SELECT * INTO post FROM public.community_posts WHERE society_id = p_society_id AND id = p_target_id FOR UPDATE;
    current_status := post.status;
    owner_id := post.author_user_id;
    entity_type := 'community_post';
    entity_id := post.id;
    label := 'post';
  ELSIF p_target_type = 'listing' THEN
    SELECT * INTO listing FROM public.community_listings
      WHERE society_id = p_society_id AND id = p_target_id FOR UPDATE;
    current_status := listing.status;
    owner_id := listing.author_user_id;
    entity_type := 'community_listing';
    entity_id := listing.id;
    label := 'listing';
  ELSE
    SELECT * INTO reply FROM public.community_replies
      WHERE society_id = p_society_id AND id = p_target_id FOR UPDATE;
    current_status := reply.status;
    owner_id := reply.author_user_id;
    entity_type := CASE WHEN reply.post_id IS NOT NULL THEN 'community_post' ELSE 'community_listing' END;
    entity_id := COALESCE(reply.post_id, reply.listing_id);
    label := 'reply';
  END IF;
  IF current_status IS NULL THEN
    RAISE EXCEPTION 'The item was not found.' USING ERRCODE = 'P0002';
  END IF;
  next_status := CASE
    WHEN p_action = 'approve' AND current_status = 'pending' THEN 'approved'
    WHEN p_action = 'reject' AND current_status = 'pending' THEN 'rejected'
    WHEN p_action = 'remove' AND current_status IN ('approved', 'hidden', 'visible') THEN 'removed'
    WHEN p_action = 'restore' AND current_status = 'hidden' THEN
      CASE WHEN p_target_type = 'reply' THEN 'visible' ELSE 'approved' END
  END;
  IF next_status IS NULL THEN
    RAISE EXCEPTION 'community_invalid_state' USING ERRCODE = 'P0001',
      DETAIL = 'This ' || label || ' cannot be ' || CASE p_action WHEN 'approve' THEN 'approved'
        WHEN 'reject' THEN 'rejected' WHEN 'remove' THEN 'removed' ELSE 'restored' END || ' now.';
  END IF;
  IF p_target_type = 'post' THEN
    UPDATE public.community_posts
    SET status = next_status,
      moderation_reason = CASE WHEN next_status IN ('rejected', 'removed') THEN clean_reason END,
      moderated_by = auth.uid(), moderated_at = clock_timestamp(), status_changed_at = clock_timestamp(),
      updated_at = clock_timestamp(), version = version + 1
    WHERE society_id = p_society_id AND id = p_target_id;
  ELSIF p_target_type = 'listing' THEN
    UPDATE public.community_listings
    SET status = next_status,
      moderation_reason = CASE WHEN next_status IN ('rejected', 'removed') THEN clean_reason END,
      moderated_by = auth.uid(), moderated_at = clock_timestamp(), status_changed_at = clock_timestamp(),
      approved_at = CASE WHEN p_action = 'approve' THEN clock_timestamp() ELSE approved_at END,
      expires_at = CASE WHEN p_action = 'approve' THEN clock_timestamp() + interval '30 days' ELSE expires_at END,
      updated_at = clock_timestamp(), version = version + 1
    WHERE society_id = p_society_id AND id = p_target_id;
  ELSE
    UPDATE public.community_replies
    SET status = next_status,
      moderation_reason = CASE WHEN next_status = 'removed' THEN clean_reason END,
      moderated_by = auth.uid(), moderated_at = clock_timestamp(), status_changed_at = clock_timestamp()
    WHERE society_id = p_society_id AND id = p_target_id;
  END IF;
  IF p_action IN ('remove', 'restore') THEN
    UPDATE public.community_reports AS report
    SET status = CASE WHEN p_action = 'remove' THEN 'actioned' ELSE 'dismissed' END,
      resolved_by = auth.uid(), resolved_at = clock_timestamp()
    WHERE report.society_id = p_society_id AND report.target_type = p_target_type
      AND report.target_id = p_target_id AND report.status = 'open';
    GET DIAGNOSTICS reports_resolved = ROW_COUNT;
  END IF;
  IF p_action = 'approve' THEN
    PERFORM private.community_notify_user(p_society_id, owner_id, 'community_approved',
      'Your ' || label || ' was approved',
      CASE WHEN p_target_type = 'listing' THEN 'Your listing "' || left(listing.title, 120) || '" is now live.'
        ELSE 'Your community post is now visible to the group.' END,
      entity_type, entity_id, p_request_id);
  ELSIF p_action IN ('reject', 'remove') THEN
    PERFORM private.community_notify_user(p_society_id, owner_id,
      CASE WHEN p_action = 'reject' THEN 'community_rejected' ELSE 'community_removed' END,
      'Your ' || label || ' was ' || CASE WHEN p_action = 'reject' THEN 'not approved' ELSE 'removed' END,
      'Reason: ' || left(clean_reason, 280), entity_type, entity_id, p_request_id);
  END IF;
  IF p_action = 'approve' AND p_target_type = 'listing' THEN
    SELECT count(*) INTO alerts_total FROM public.memberships AS membership
    LEFT JOIN public.community_preferences AS preference
      ON preference.society_id = membership.society_id AND preference.membership_id = membership.id
    WHERE membership.society_id = p_society_id AND membership.status = 'active'
      AND membership.user_id IS NOT NULL AND 'resident' = ANY (membership.roles)
      AND COALESCE(preference.new_listing_alerts, true)
      AND membership.id <> listing.author_membership_id AND membership.user_id <> listing.author_user_id;
    FOR recipient IN
      SELECT membership.user_id FROM public.memberships AS membership
      LEFT JOIN public.community_preferences AS preference
        ON preference.society_id = membership.society_id AND preference.membership_id = membership.id
      WHERE membership.society_id = p_society_id AND membership.status = 'active'
        AND membership.user_id IS NOT NULL AND 'resident' = ANY (membership.roles)
        AND COALESCE(preference.new_listing_alerts, true)
        AND membership.id <> listing.author_membership_id AND membership.user_id <> listing.author_user_id
      ORDER BY membership.created_at, membership.id
      LIMIT alert_cap
    LOOP
      PERFORM private.create_notification(p_society_id, recipient, 'community_new_listing',
        left('New listing: ' || listing.title, 120),
        left(listing.author_name || COALESCE(' (' || listing.author_unit_label || ')', '')
          || ' posted a new marketplace listing.', 300),
        'community_listing', listing.id, p_request_id);
      alerts_sent := alerts_sent + 1;
    END LOOP;
    IF alerts_total > alert_cap THEN
      RAISE LOG 'community_moderate: listing % dropped % new-listing alerts over cap %',
        listing.id, alerts_total - alert_cap, alert_cap;
    END IF;
  END IF;
  PERFORM private.community_audit(p_society_id, 'admin', p_target_type || '.' || p_action,
    'community_' || p_target_type, p_target_id,
    jsonb_build_object('from_status', current_status, 'status', next_status,
      'reports_resolved', reports_resolved, 'alerts_sent', alerts_sent,
      'alerts_dropped', GREATEST(alerts_total - alert_cap, 0)),
    p_request_id, clean_reason);
  RETURN jsonb_build_object('targetId', p_target_id, 'status', next_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_mute(
  p_society_id uuid, p_membership_id uuid, p_duration text, p_reason text, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  clean_reason text := btrim(COALESCE(p_reason, ''));
  target public.memberships;
  mute public.community_mutes;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'admin', p_request_id);
  IF p_duration IS NULL OR p_duration NOT IN ('7d', '30d', 'until_lifted')
    OR char_length(clean_reason) NOT BETWEEN 1 AND 500
  THEN
    RAISE EXCEPTION 'Choose 7 days, 30 days or until lifted, and give a reason up to 500 characters.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target FROM public.memberships
    WHERE society_id = p_society_id AND id = p_membership_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The member was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF target.status <> 'active' OR NOT ('resident' = ANY (target.roles)) OR target.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Only another active resident can be muted.' USING ERRCODE = '22023';
  END IF;
  -- Serialise mute changes per member so parallel mutes cannot collide on the one-active-mute index.
  PERFORM pg_advisory_xact_lock(hashtextextended('community-mute:' || p_membership_id::text, 0));
  UPDATE public.community_mutes
  SET lifted_at = clock_timestamp(), lifted_by = auth.uid()
  WHERE society_id = p_society_id AND membership_id = p_membership_id AND lifted_at IS NULL;
  INSERT INTO public.community_mutes (society_id, membership_id, duration, muted_until, reason, created_by)
  VALUES (p_society_id, p_membership_id, p_duration,
    CASE p_duration WHEN '7d' THEN clock_timestamp() + interval '7 days'
      WHEN '30d' THEN clock_timestamp() + interval '30 days' END,
    clean_reason, auth.uid())
  RETURNING * INTO mute;
  PERFORM private.community_audit(p_society_id, 'admin', 'member.mute', 'community_mute', mute.id,
    jsonb_build_object('membership_id', p_membership_id, 'duration', mute.duration,
      'muted_until', mute.muted_until), p_request_id, clean_reason);
  PERFORM private.community_notify_user(p_society_id, target.user_id, 'community_muted',
    'You are muted in Community',
    CASE WHEN mute.muted_until IS NULL THEN 'You can read Community but cannot post or reply until the admin lifts the mute.'
      ELSE 'You can read Community but cannot post or reply until '
        || to_char(mute.muted_until AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY, HH24:MI') || ' IST.' END,
    NULL, NULL, p_request_id);
  RETURN jsonb_build_object('muteId', mute.id, 'mutedUntil', mute.muted_until);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_unmute(p_society_id uuid, p_membership_id uuid, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target public.memberships;
  active_mute public.community_mutes;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'admin', p_request_id);
  SELECT * INTO target FROM public.memberships WHERE society_id = p_society_id AND id = p_membership_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The member was not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('community-mute:' || p_membership_id::text, 0));
  active_mute := private.community_active_mute(p_society_id, p_membership_id);
  UPDATE public.community_mutes
  SET lifted_at = clock_timestamp(), lifted_by = auth.uid()
  WHERE society_id = p_society_id AND membership_id = p_membership_id AND lifted_at IS NULL;
  IF active_mute.id IS NULL THEN
    RETURN jsonb_build_object('lifted', false);
  END IF;
  PERFORM private.community_audit(p_society_id, 'admin', 'member.unmute', 'community_mute', active_mute.id,
    jsonb_build_object('membership_id', p_membership_id), p_request_id);
  PERFORM private.community_notify_user(p_society_id, target.user_id, 'community_unmuted',
    'Your Community mute was lifted', 'You can post and reply in Community again.', NULL, NULL, p_request_id);
  RETURN jsonb_build_object('lifted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_home(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  membership uuid;
  mute public.community_mutes;
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', false);
  membership := private.community_my_membership(p_society_id);
  mute := private.community_active_mute(p_society_id, membership);
  RETURN jsonb_build_object(
    'groups', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', grp.id, 'name', grp.name, 'description', grp.description,
        'memberCount', (SELECT count(*) FROM public.community_group_members AS member
          JOIN public.memberships AS m ON m.society_id = member.society_id AND m.id = member.membership_id
            AND m.status = 'active'
          WHERE member.society_id = grp.society_id AND member.group_id = grp.id),
        'joined', private.community_is_group_member(p_society_id, grp.id, membership),
        'latestPostAt', (SELECT max(post.created_at) FROM public.community_posts AS post
          WHERE post.society_id = grp.society_id AND post.group_id = grp.id AND post.status = 'approved')
      ) ORDER BY lower(grp.name), grp.id)
      FROM public.community_groups AS grp
      WHERE grp.society_id = p_society_id AND grp.status = 'active'
    ), '[]'::jsonb),
    'myMute', CASE WHEN mute.id IS NULL THEN NULL ELSE jsonb_build_object(
      'mutedUntil', mute.muted_until, 'untilLifted', mute.muted_until IS NULL, 'reason', mute.reason) END,
    'preferences', jsonb_build_object('newListingAlerts', COALESCE((
      SELECT preference.new_listing_alerts FROM public.community_preferences AS preference
      WHERE preference.society_id = p_society_id AND preference.membership_id = membership), true))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.community_group_feed(
  p_society_id uuid, p_group_id uuid, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  page record;
  grp public.community_groups;
  membership uuid;
  is_admin boolean;
  joined boolean;
  total integer;
  items jsonb;
BEGIN
  PERFORM private.community_authorize(p_society_id, 'reader', false);
  SELECT * INTO page FROM private.community_page(p_limit, p_offset, 100);
  SELECT * INTO grp FROM public.community_groups WHERE society_id = p_society_id AND id = p_group_id;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  membership := private.community_my_membership(p_society_id);
  joined := private.community_is_group_member(p_society_id, p_group_id, membership);
  IF grp.id IS NULL OR (NOT is_admin AND grp.status <> 'active') THEN
    RAISE EXCEPTION 'The group was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT is_admin AND NOT joined THEN
    RAISE EXCEPTION 'community_not_member' USING ERRCODE = 'P0001', DETAIL = 'Join the group to see its posts.';
  END IF;
  SELECT count(*) INTO total FROM public.community_posts AS post
    WHERE post.society_id = p_society_id AND post.group_id = p_group_id
      AND (post.status = 'approved' OR (post.author_user_id = auth.uid() AND post.status IN ('pending', 'hidden')));
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', post.id, 'body', post.body, 'authorName', post.author_name,
      'authorUnitLabel', post.author_unit_label, 'createdAt', post.created_at, 'status', post.status,
      'version', post.version,
      'photoPaths', COALESCE((SELECT jsonb_agg(photo.storage_path ORDER BY photo.position)
        FROM public.community_photos AS photo
        WHERE photo.society_id = post.society_id AND photo.post_id = post.id), '[]'::jsonb),
      'replyCount', (SELECT count(*) FROM public.community_replies AS reply
        WHERE reply.society_id = post.society_id AND reply.post_id = post.id AND reply.status = 'visible'),
      'mine', post.author_user_id = auth.uid()
    ) ORDER BY post.created_at DESC, post.id DESC), '[]'::jsonb) INTO items
  FROM (
    SELECT * FROM public.community_posts AS candidate
    WHERE candidate.society_id = p_society_id AND candidate.group_id = p_group_id
      AND (candidate.status = 'approved'
        OR (candidate.author_user_id = auth.uid() AND candidate.status IN ('pending', 'hidden')))
    ORDER BY candidate.created_at DESC, candidate.id DESC
    LIMIT page.lim OFFSET page.off
  ) AS post;
  RETURN jsonb_build_object(
    'group', jsonb_build_object('id', grp.id, 'name', grp.name, 'description', grp.description,
      'status', grp.status, 'joined', joined,
      'memberCount', (SELECT count(*) FROM public.community_group_members AS member
        WHERE member.society_id = p_society_id AND member.group_id = p_group_id)),
    'items', items, 'total', total);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_post_get(p_society_id uuid, p_post_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  post public.community_posts;
  grp public.community_groups;
  is_admin boolean;
  mine boolean;
  membership uuid;
  joined boolean;
BEGIN
  PERFORM private.community_authorize(p_society_id, 'reader', false);
  SELECT * INTO post FROM public.community_posts WHERE society_id = p_society_id AND id = p_post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The post was not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO grp FROM public.community_groups WHERE society_id = p_society_id AND id = post.group_id;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  mine := post.author_user_id = auth.uid();
  membership := private.community_my_membership(p_society_id);
  joined := private.community_is_group_member(p_society_id, post.group_id, membership);
  IF NOT is_admin AND NOT mine THEN
    IF post.status <> 'approved' OR grp.status <> 'active' THEN
      RAISE EXCEPTION 'The post was not found.' USING ERRCODE = 'P0002';
    END IF;
    IF NOT joined THEN
      RAISE EXCEPTION 'community_not_member' USING ERRCODE = 'P0001', DETAIL = 'Join the group to see this post.';
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'post', jsonb_build_object('id', post.id, 'groupId', grp.id, 'groupName', grp.name,
      'groupStatus', grp.status, 'body', post.body, 'authorName', post.author_name,
      'authorUnitLabel', post.author_unit_label, 'createdAt', post.created_at, 'updatedAt', post.updated_at,
      'status', post.status, 'version', post.version, 'mine', mine,
      'moderationReason', CASE WHEN mine OR is_admin THEN post.moderation_reason END),
    'photos', private.community_photos_json(p_society_id, post.id, NULL),
    'replies', private.community_replies_json(p_society_id, post.id, NULL, is_admin),
    'canReply', post.status = 'approved' AND grp.status = 'active' AND joined
      AND private.community_is_participant(p_society_id)
      AND private.society_writable(p_society_id)
      AND (private.community_active_mute(p_society_id, membership)).id IS NULL,
    'reportedByMe', EXISTS (SELECT 1 FROM public.community_reports AS report
      WHERE report.society_id = p_society_id AND report.post_id = post.id
        AND report.reporter_user_id = auth.uid()));
END;
$$;

CREATE OR REPLACE FUNCTION public.community_marketplace(
  p_society_id uuid, p_type text, p_search text, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  page record;
  pattern text;
  total integer;
  items jsonb;
BEGIN
  PERFORM private.community_authorize(p_society_id, 'reader', false);
  SELECT * INTO page FROM private.community_page(p_limit, p_offset, 100);
  IF p_type IS NOT NULL AND p_type NOT IN ('sale', 'give_away', 'wanted', 'lost', 'found') THEN
    RAISE EXCEPTION 'Choose a valid listing type.' USING ERRCODE = '22023';
  END IF;
  pattern := private.community_search_pattern(p_search);
  SELECT count(*) INTO total FROM public.community_listings AS listing
    WHERE listing.society_id = p_society_id AND listing.status = 'approved' AND listing.closed_at IS NULL
      AND listing.expires_at > clock_timestamp()
      AND (p_type IS NULL OR listing.listing_type = p_type)
      AND (pattern IS NULL OR listing.title ILIKE pattern OR listing.description ILIKE pattern);
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', listing.id, 'listingType', listing.listing_type, 'title', listing.title,
      'pricePaise', listing.price_paise, 'authorName', listing.author_name,
      'authorUnitLabel', listing.author_unit_label, 'approvedAt', listing.approved_at,
      'expiresAt', listing.expires_at,
      'firstPhotoPath', (SELECT photo.storage_path FROM public.community_photos AS photo
        WHERE photo.society_id = listing.society_id AND photo.listing_id = listing.id
        ORDER BY photo.position LIMIT 1),
      'replyCount', (SELECT count(*) FROM public.community_replies AS reply
        WHERE reply.society_id = listing.society_id AND reply.listing_id = listing.id AND reply.status = 'visible')
    ) ORDER BY listing.approved_at DESC, listing.id DESC), '[]'::jsonb) INTO items
  FROM (
    SELECT * FROM public.community_listings AS candidate
    WHERE candidate.society_id = p_society_id AND candidate.status = 'approved' AND candidate.closed_at IS NULL
      AND candidate.expires_at > clock_timestamp()
      AND (p_type IS NULL OR candidate.listing_type = p_type)
      AND (pattern IS NULL OR candidate.title ILIKE pattern OR candidate.description ILIKE pattern)
    ORDER BY candidate.approved_at DESC, candidate.id DESC
    LIMIT page.lim OFFSET page.off
  ) AS listing;
  RETURN jsonb_build_object('items', items, 'total', total);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_listing_get(p_society_id uuid, p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  listing public.community_listings;
  is_admin boolean;
  mine boolean;
  expired boolean;
BEGIN
  PERFORM private.community_authorize(p_society_id, 'reader', false);
  SELECT * INTO listing FROM public.community_listings WHERE society_id = p_society_id AND id = p_listing_id;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  mine := listing.author_user_id = auth.uid();
  IF listing.id IS NULL OR (NOT is_admin AND NOT mine AND listing.status <> 'approved') THEN
    RAISE EXCEPTION 'The listing was not found.' USING ERRCODE = 'P0002';
  END IF;
  expired := private.community_listing_expired(listing);
  RETURN jsonb_build_object(
    'listing', jsonb_build_object('id', listing.id, 'listingType', listing.listing_type,
      'title', listing.title, 'description', listing.description, 'pricePaise', listing.price_paise,
      'contactPhone', listing.contact_phone, 'authorName', listing.author_name,
      'authorUnitLabel', listing.author_unit_label, 'status', listing.status, 'version', listing.version,
      'createdAt', listing.created_at, 'updatedAt', listing.updated_at, 'approvedAt', listing.approved_at,
      'expiresAt', listing.expires_at, 'closedAt', listing.closed_at, 'expired', expired,
      'closed', listing.closed_at IS NOT NULL, 'mine', mine,
      'moderationReason', CASE WHEN mine OR is_admin THEN listing.moderation_reason END),
    'photos', private.community_photos_json(p_society_id, NULL, listing.id),
    'replies', private.community_replies_json(p_society_id, NULL, listing.id, is_admin),
    'canReply', listing.status = 'approved' AND listing.closed_at IS NULL AND NOT expired
      AND private.community_is_participant(p_society_id)
      AND private.society_writable(p_society_id)
      AND (private.community_active_mute(p_society_id, private.community_my_membership(p_society_id))).id IS NULL,
    'reportedByMe', EXISTS (SELECT 1 FROM public.community_reports AS report
      WHERE report.society_id = p_society_id AND report.listing_id = listing.id
        AND report.reporter_user_id = auth.uid()));
END;
$$;

CREATE OR REPLACE FUNCTION public.community_my_items(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'participant', false);
  RETURN jsonb_build_object(
    'posts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', post.id, 'groupId', post.group_id, 'groupName', grp.name, 'body', post.body,
        'status', post.status, 'moderationReason', post.moderation_reason, 'createdAt', post.created_at,
        'updatedAt', post.updated_at, 'version', post.version,
        'replyCount', (SELECT count(*) FROM public.community_replies AS reply
          WHERE reply.society_id = post.society_id AND reply.post_id = post.id AND reply.status = 'visible')
      ) ORDER BY post.created_at DESC, post.id DESC)
      FROM (
        SELECT * FROM public.community_posts AS candidate
        WHERE candidate.society_id = p_society_id AND candidate.author_user_id = auth.uid()
        ORDER BY candidate.created_at DESC, candidate.id DESC LIMIT 200
      ) AS post
      JOIN public.community_groups AS grp ON grp.society_id = post.society_id AND grp.id = post.group_id
    ), '[]'::jsonb),
    'listings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', listing.id, 'listingType', listing.listing_type, 'title', listing.title,
        'pricePaise', listing.price_paise, 'status', listing.status,
        'moderationReason', listing.moderation_reason, 'createdAt', listing.created_at,
        'approvedAt', listing.approved_at, 'expiresAt', listing.expires_at, 'closedAt', listing.closed_at,
        'expired', private.community_listing_expired(listing), 'closed', listing.closed_at IS NOT NULL,
        'version', listing.version,
        'firstPhotoPath', (SELECT photo.storage_path FROM public.community_photos AS photo
          WHERE photo.society_id = listing.society_id AND photo.listing_id = listing.id
          ORDER BY photo.position LIMIT 1),
        'replyCount', (SELECT count(*) FROM public.community_replies AS reply
          WHERE reply.society_id = listing.society_id AND reply.listing_id = listing.id
            AND reply.status = 'visible')
      ) ORDER BY listing.created_at DESC, listing.id DESC)
      FROM (
        SELECT * FROM public.community_listings AS candidate
        WHERE candidate.society_id = p_society_id AND candidate.author_user_id = auth.uid()
        ORDER BY candidate.created_at DESC, candidate.id DESC LIMIT 200
      ) AS listing
    ), '[]'::jsonb)
  );
END;
$$;

-- Admin queue over all three item kinds. Author-deleted replies are the author's business and are not listed.
CREATE OR REPLACE FUNCTION public.community_admin_queue(
  p_society_id uuid, p_queue text, p_limit integer, p_offset integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  page record;
  total integer;
  items jsonb;
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', false);
  SELECT * INTO page FROM private.community_page(p_limit, p_offset, 100);
  IF p_queue IS NULL OR p_queue NOT IN ('pending', 'hidden', 'reported', 'removed') THEN
    RAISE EXCEPTION 'Choose a valid queue.' USING ERRCODE = '22023';
  END IF;
  WITH entries AS (
    SELECT 'post'::text AS target_type, post.id, NULL::text AS title, post.body AS text,
      post.author_name, post.author_unit_label, post.author_membership_id, post.status, post.created_at,
      false AS author_deleted,
      (SELECT count(*) FROM public.community_reports AS report
        WHERE report.society_id = post.society_id AND report.post_id = post.id AND report.status = 'open')
        AS open_reports
    FROM public.community_posts AS post WHERE post.society_id = p_society_id
    UNION ALL
    SELECT 'listing', listing.id, listing.title, listing.title, listing.author_name, listing.author_unit_label,
      listing.author_membership_id, listing.status, listing.created_at, false,
      (SELECT count(*) FROM public.community_reports AS report
        WHERE report.society_id = listing.society_id AND report.listing_id = listing.id AND report.status = 'open')
    FROM public.community_listings AS listing WHERE listing.society_id = p_society_id
    UNION ALL
    SELECT 'reply', reply.id, NULL, reply.body, reply.author_name, reply.author_unit_label,
      reply.author_membership_id, reply.status, reply.created_at,
      reply.status = 'removed' AND reply.moderated_by = reply.author_user_id,
      (SELECT count(*) FROM public.community_reports AS report
        WHERE report.society_id = reply.society_id AND report.reply_id = reply.id AND report.status = 'open')
    FROM public.community_replies AS reply WHERE reply.society_id = p_society_id
  ), filtered AS (
    SELECT * FROM entries AS entry
    WHERE CASE p_queue
      WHEN 'pending' THEN entry.status = 'pending'
      WHEN 'hidden' THEN entry.status = 'hidden'
      WHEN 'reported' THEN entry.status IN ('approved', 'visible') AND entry.open_reports > 0
      ELSE entry.status IN ('removed', 'rejected') AND NOT entry.author_deleted
    END
  ), paged AS (
    SELECT * FROM filtered AS entry
    ORDER BY CASE WHEN p_queue = 'pending' THEN entry.created_at END ASC,
      entry.created_at DESC, entry.id
    LIMIT page.lim OFFSET page.off
  )
  SELECT (SELECT count(*) FROM filtered),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'targetType', entry.target_type, 'targetId', entry.id, 'title', entry.title,
      'excerpt', left(entry.text, 200), 'authorName', entry.author_name,
      'authorUnitLabel', entry.author_unit_label, 'authorMembershipId', entry.author_membership_id,
      'status', entry.status, 'openReports', entry.open_reports, 'createdAt', entry.created_at
    ) ORDER BY CASE WHEN p_queue = 'pending' THEN entry.created_at END ASC, entry.created_at DESC, entry.id)
    FROM paged AS entry), '[]'::jsonb)
  INTO total, items;
  RETURN jsonb_build_object('items', items, 'total', total);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_admin_item_get(p_society_id uuid, p_target_type text, p_target_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  post public.community_posts;
  listing public.community_listings;
  reply public.community_replies;
  item jsonb;
  author_membership uuid;
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', false);
  IF p_target_type IS NULL OR p_target_type NOT IN ('post', 'listing', 'reply') THEN
    RAISE EXCEPTION 'Choose a post, listing or reply.' USING ERRCODE = '22023';
  END IF;
  IF p_target_type = 'post' THEN
    SELECT * INTO post FROM public.community_posts WHERE society_id = p_society_id AND id = p_target_id;
    IF FOUND THEN
      author_membership := post.author_membership_id;
      item := jsonb_build_object('targetType', 'post', 'id', post.id, 'groupId', post.group_id,
        'groupName', (SELECT grp.name FROM public.community_groups AS grp
          WHERE grp.society_id = post.society_id AND grp.id = post.group_id),
        'title', NULL, 'body', post.body, 'authorName', post.author_name,
        'authorUnitLabel', post.author_unit_label, 'authorMembershipId', post.author_membership_id,
        'status', post.status, 'moderationReason', post.moderation_reason, 'moderatedAt', post.moderated_at,
        'createdAt', post.created_at, 'updatedAt', post.updated_at, 'version', post.version,
        'photos', private.community_photos_json(p_society_id, post.id, NULL));
    END IF;
  ELSIF p_target_type = 'listing' THEN
    SELECT * INTO listing FROM public.community_listings WHERE society_id = p_society_id AND id = p_target_id;
    IF FOUND THEN
      author_membership := listing.author_membership_id;
      item := jsonb_build_object('targetType', 'listing', 'id', listing.id, 'listingType', listing.listing_type,
        'title', listing.title, 'body', listing.description, 'pricePaise', listing.price_paise,
        'contactPhone', listing.contact_phone, 'authorName', listing.author_name,
        'authorUnitLabel', listing.author_unit_label, 'authorMembershipId', listing.author_membership_id,
        'status', listing.status, 'moderationReason', listing.moderation_reason,
        'moderatedAt', listing.moderated_at, 'createdAt', listing.created_at, 'updatedAt', listing.updated_at,
        'approvedAt', listing.approved_at, 'expiresAt', listing.expires_at, 'closedAt', listing.closed_at,
        'expired', private.community_listing_expired(listing), 'closed', listing.closed_at IS NOT NULL,
        'version', listing.version, 'photos', private.community_photos_json(p_society_id, NULL, listing.id));
    END IF;
  ELSE
    SELECT * INTO reply FROM public.community_replies WHERE society_id = p_society_id AND id = p_target_id;
    IF FOUND THEN
      author_membership := reply.author_membership_id;
      item := jsonb_build_object('targetType', 'reply', 'id', reply.id,
        'parentType', CASE WHEN reply.post_id IS NOT NULL THEN 'post' ELSE 'listing' END,
        'parentId', COALESCE(reply.post_id, reply.listing_id), 'title', NULL, 'body', reply.body,
        'authorName', reply.author_name, 'authorUnitLabel', reply.author_unit_label,
        'authorMembershipId', reply.author_membership_id, 'status', reply.status,
        'moderationReason', reply.moderation_reason, 'moderatedAt', reply.moderated_at,
        'createdAt', reply.created_at, 'photos', '[]'::jsonb);
    END IF;
  END IF;
  IF item IS NULL THEN
    RAISE EXCEPTION 'The item was not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'item', item,
    'reports', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', report.id, 'reason', report.reason, 'note', report.note,
        'reporterUnitLabel', private.community_unit_label(report.society_id, report.reporter_unit_id),
        'createdAt', report.created_at, 'status', report.status) ORDER BY report.created_at, report.id)
      FROM public.community_reports AS report
      WHERE report.society_id = p_society_id AND report.target_type = p_target_type
        AND report.target_id = p_target_id
    ), '[]'::jsonb),
    'authorMute', private.community_mute_json(private.community_active_mute(p_society_id, author_membership)));
END;
$$;

CREATE OR REPLACE FUNCTION public.community_admin_groups(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', false);
  RETURN jsonb_build_object('items', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', grp.id, 'name', grp.name, 'description', grp.description, 'status', grp.status,
      'memberCount', (SELECT count(*) FROM public.community_group_members AS member
        WHERE member.society_id = grp.society_id AND member.group_id = grp.id),
      'postCount', (SELECT count(*) FROM public.community_posts AS post
        WHERE post.society_id = grp.society_id AND post.group_id = grp.id AND post.status = 'approved'),
      'version', grp.version
    ) ORDER BY grp.status = 'archived', lower(grp.name), grp.id)
    FROM public.community_groups AS grp WHERE grp.society_id = p_society_id
  ), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.community_admin_mutes(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', false);
  RETURN jsonb_build_object('items', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'muteId', mute.id, 'membershipId', mute.membership_id,
      'name', COALESCE(profile.full_name, 'Resident'),
      'unitLabel', (SELECT member_unit.label FROM private.community_member_unit(p_society_id, mute.membership_id)
        AS member_unit),
      'duration', mute.duration, 'mutedUntil', mute.muted_until, 'reason', mute.reason,
      'createdAt', mute.created_at
    ) ORDER BY mute.created_at DESC, mute.id)
    FROM public.community_mutes AS mute
    JOIN public.memberships AS membership
      ON membership.society_id = mute.society_id AND membership.id = mute.membership_id
    LEFT JOIN public.profiles AS profile ON profile.id = membership.user_id
    WHERE mute.society_id = p_society_id AND mute.lifted_at IS NULL
      AND (mute.muted_until IS NULL OR mute.muted_until > clock_timestamp())
  ), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.community_member_options(p_society_id uuid, p_search text, p_limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  page record;
  pattern text;
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', false);
  SELECT * INTO page FROM private.community_page(p_limit, 0, 50);
  pattern := private.community_search_pattern(p_search);
  RETURN jsonb_build_object('items', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('membershipId', option.id, 'name', option.name,
      'unitLabel', option.unit_label) ORDER BY lower(option.name), option.id)
    FROM (
      SELECT membership.id, COALESCE(profile.full_name, 'Resident') AS name, member_unit.label AS unit_label
      FROM public.memberships AS membership
      LEFT JOIN public.profiles AS profile ON profile.id = membership.user_id
      LEFT JOIN LATERAL private.community_member_unit(p_society_id, membership.id) AS member_unit ON true
      WHERE membership.society_id = p_society_id AND membership.status = 'active'
        AND 'resident' = ANY (membership.roles)
        AND (pattern IS NULL OR profile.full_name ILIKE pattern OR member_unit.label ILIKE pattern)
      ORDER BY lower(COALESCE(profile.full_name, 'Resident')), membership.id
      LIMIT page.lim
    ) AS option
  ), '[]'::jsonb));
END;
$$;

-- Retention: items rejected, removed or withdrawn 30 days before the run day (IST) are deleted with their
-- photos, replies and reports; uploads never attached are dropped after a day.
CREATE OR REPLACE FUNCTION public.community_retention_files_list(p_today date)
RETURNS TABLE (bucket text, path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
    SELECT 'community-photos'::text, object.name FROM storage.objects AS object
    WHERE object.bucket_id = 'community-photos' AND (
      EXISTS (
        SELECT 1 FROM public.community_photos AS photo
        LEFT JOIN public.community_posts AS post
          ON post.society_id = photo.society_id AND post.id = photo.post_id
        LEFT JOIN public.community_listings AS listing
          ON listing.society_id = photo.society_id AND listing.id = photo.listing_id
        WHERE photo.storage_path = object.name AND (
          (post.status IN ('rejected', 'removed', 'withdrawn')
            AND post.status_changed_at <= cutoff - interval '30 days')
          OR (listing.status IN ('rejected', 'removed', 'withdrawn')
            AND listing.status_changed_at <= cutoff - interval '30 days'))
      )
      OR (object.created_at <= cutoff - interval '1 day' AND NOT EXISTS (
        SELECT 1 FROM public.community_photos AS photo WHERE photo.storage_path = object.name
      ))
    ) ORDER BY object.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_retention_run(p_today date, p_request_trace text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutoff timestamptz;
  reply_counts jsonb;
  post_counts jsonb;
  listing_counts jsonb;
  society uuid;
  posts integer;
  listings integer;
  replies integer;
  posts_deleted integer := 0;
  listings_deleted integer := 0;
  replies_deleted integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR NOT isfinite(p_today) OR p_request_trace IS NULL
    OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN RAISE EXCEPTION 'Invalid retention arguments.' USING ERRCODE = '22023'; END IF;
  cutoff := LEAST(clock_timestamp(), (p_today + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');
  -- Replies first, so replies removed under an item that is also due are counted once, here.
  WITH deleted AS (
    DELETE FROM public.community_replies AS reply
    WHERE reply.status = 'removed' AND reply.status_changed_at <= cutoff - interval '30 days'
    RETURNING reply.society_id
  )
  SELECT COALESCE(jsonb_object_agg(total.society_id, total.n), '{}'::jsonb) INTO reply_counts
  FROM (SELECT deleted.society_id::text AS society_id, count(*) AS n FROM deleted GROUP BY 1) AS total;
  WITH deleted AS (
    DELETE FROM public.community_posts AS post
    WHERE post.status IN ('rejected', 'removed', 'withdrawn')
      AND post.status_changed_at <= cutoff - interval '30 days'
    RETURNING post.society_id
  )
  SELECT COALESCE(jsonb_object_agg(total.society_id, total.n), '{}'::jsonb) INTO post_counts
  FROM (SELECT deleted.society_id::text AS society_id, count(*) AS n FROM deleted GROUP BY 1) AS total;
  WITH deleted AS (
    DELETE FROM public.community_listings AS listing
    WHERE listing.status IN ('rejected', 'removed', 'withdrawn')
      AND listing.status_changed_at <= cutoff - interval '30 days'
    RETURNING listing.society_id
  )
  SELECT COALESCE(jsonb_object_agg(total.society_id, total.n), '{}'::jsonb) INTO listing_counts
  FROM (SELECT deleted.society_id::text AS society_id, count(*) AS n FROM deleted GROUP BY 1) AS total;
  FOR society IN
    SELECT key::uuid FROM (
      SELECT jsonb_object_keys(reply_counts) AS key
      UNION SELECT jsonb_object_keys(post_counts)
      UNION SELECT jsonb_object_keys(listing_counts)
    ) AS keys ORDER BY 1
  LOOP
    posts := COALESCE((post_counts ->> society::text)::integer, 0);
    listings := COALESCE((listing_counts ->> society::text)::integer, 0);
    replies := COALESCE((reply_counts ->> society::text)::integer, 0);
    posts_deleted := posts_deleted + posts;
    listings_deleted := listings_deleted + listings;
    replies_deleted := replies_deleted + replies;
    PERFORM private.community_audit(society, 'system', 'retention.run', 'society', society,
      jsonb_build_object('posts_deleted', posts, 'listings_deleted', listings, 'replies_deleted', replies,
        'cutoff', cutoff), p_request_trace);
  END LOOP;
  RETURN jsonb_build_object('postsDeleted', posts_deleted, 'listingsDeleted', listings_deleted,
    'repliesDeleted', replies_deleted);
END;
$$;