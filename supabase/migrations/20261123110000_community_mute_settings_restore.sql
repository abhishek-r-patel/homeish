-- Community (D-64 follow-up): administrator settings for what muted residents may still do, enforced in the
-- edit, report and renew writes and exposed on the detail reads; restoring a hidden item notifies its author.
-- Creating posts, listings, replies and photo uploads stays blocked while muted; delete and close stay allowed.

-- Settings are '{}' (all defaults, false) or an object with only these optional boolean keys.
CREATE OR REPLACE FUNCTION private.community_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(p_settings) AS setting(key, value)
      WHERE setting.key NOT IN ('muted_can_edit_pending', 'muted_can_report', 'muted_can_renew')
        OR jsonb_typeof(setting.value) <> 'boolean'
    )
$$;

-- A missing key (or a missing module row) means the strictest choice: not allowed.
CREATE FUNCTION private.community_setting(p_society_id uuid, p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT (config.settings ->> p_key)::boolean FROM public.module_configs AS config
    WHERE config.society_id = p_society_id AND config.module_key = 'community'
  ), false)
$$;
REVOKE ALL ON FUNCTION private.community_setting(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_assert_muted_allowed(p_society_id uuid, p_membership_id uuid, p_key text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.community_setting(p_society_id, p_key) THEN
    RETURN;
  END IF;
  PERFORM private.community_assert_not_muted(p_society_id, p_membership_id);
END;
$$;
REVOKE ALL ON FUNCTION private.community_assert_muted_allowed(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.community_settings_json(p_society_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'settings', jsonb_build_object(
      'muted_can_edit_pending', private.community_setting(p_society_id, 'muted_can_edit_pending'),
      'muted_can_report', private.community_setting(p_society_id, 'muted_can_report'),
      'muted_can_renew', private.community_setting(p_society_id, 'muted_can_renew')),
    'updatedAt', (SELECT config.updated_at FROM public.module_configs AS config
      WHERE config.society_id = p_society_id AND config.module_key = 'community'))
$$;
REVOKE ALL ON FUNCTION private.community_settings_json(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The caller's active mute with what the settings still allow; null when not muted.
CREATE FUNCTION private.community_my_mute_json(p_society_id uuid, p_membership_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  mute public.community_mutes;
BEGIN
  IF p_membership_id IS NULL THEN
    RETURN NULL;
  END IF;
  mute := private.community_active_mute(p_society_id, p_membership_id);
  IF mute.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'mutedUntil', mute.muted_until, 'untilLifted', mute.muted_until IS NULL, 'reason', mute.reason,
    'canEditPending', private.community_setting(p_society_id, 'muted_can_edit_pending'),
    'canReport', private.community_setting(p_society_id, 'muted_can_report'),
    'canRenew', private.community_setting(p_society_id, 'muted_can_renew'));
END;
$$;
REVOKE ALL ON FUNCTION private.community_my_mute_json(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.community_settings_get(p_society_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.community_authorize(p_society_id, 'admin', false);
  RETURN private.community_settings_json(p_society_id);
END;
$$;

-- updated_at is the staleness check: module_configs has no version column and its trigger bumps updated_at.
CREATE FUNCTION public.community_settings_update(
  p_society_id uuid, p_settings jsonb, p_expected_updated_at timestamptz, p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  config public.module_configs;
  next_settings jsonb;
BEGIN
  PERFORM private.community_write_begin(p_society_id, 'admin', p_request_id);
  IF p_settings IS NULL OR NOT private.community_settings_valid(p_settings) OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'Choose yes or no for each muted-resident setting.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO config FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'community' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The community settings were not found.' USING ERRCODE = 'P0002';
  END IF;
  IF config.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The community settings changed. Reload and try again.' USING ERRCODE = '40001';
  END IF;
  next_settings := config.settings || p_settings;
  IF next_settings = config.settings THEN
    RETURN private.community_settings_json(p_society_id);
  END IF;
  UPDATE public.module_configs
  SET settings = next_settings, updated_by = auth.uid()
  WHERE society_id = p_society_id AND module_key = 'community';
  PERFORM private.community_audit(p_society_id, 'admin', 'settings.update', 'module_config', p_society_id,
    jsonb_build_object('settings', next_settings), p_request_id);
  RETURN private.community_settings_json(p_society_id);
END;
$$;

REVOKE ALL ON FUNCTION public.community_settings_get(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.community_settings_update(uuid, jsonb, timestamptz, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.community_settings_get(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_settings_update(uuid, jsonb, timestamptz, text) TO authenticated;

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
  PERFORM private.community_assert_muted_allowed(p_society_id, post.author_membership_id, 'muted_can_edit_pending');
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
  PERFORM private.community_assert_muted_allowed(p_society_id, listing.author_membership_id,
    'muted_can_edit_pending');
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
  PERFORM private.community_assert_muted_allowed(p_society_id, listing.author_membership_id, 'muted_can_renew');
  UPDATE public.community_listings
  SET expires_at = clock_timestamp() + interval '30 days', updated_at = clock_timestamp(), version = version + 1
  WHERE society_id = p_society_id AND id = p_listing_id
  RETURNING * INTO listing;
  PERFORM private.community_audit(p_society_id, 'resident', 'listing.renew', 'community_listing', listing.id,
    jsonb_build_object('expires_at', listing.expires_at), p_request_id);
  RETURN jsonb_build_object('listingId', listing.id, 'expiresAt', listing.expires_at);
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
  PERFORM private.community_assert_muted_allowed(p_society_id, reporter.membership_id, 'muted_can_report');
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
  ELSIF p_action = 'restore' THEN
    PERFORM private.community_notify_user(p_society_id, owner_id, 'community_restored',
      'Your ' || label || ' is visible again',
      'An administrator reviewed the reports and your ' || label || ' is visible again.',
      entity_type, entity_id, p_request_id);
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
        AND report.reporter_user_id = auth.uid()),
    'myMute', private.community_my_mute_json(p_society_id, membership));
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
        AND report.reporter_user_id = auth.uid()),
    'myMute', private.community_my_mute_json(p_society_id, private.community_my_membership(p_society_id)));
END;
$$;
