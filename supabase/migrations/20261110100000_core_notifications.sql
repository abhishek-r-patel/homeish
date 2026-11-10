CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id text,
  CONSTRAINT notifications_type_check
    CHECK (type ~ '^[a-z][a-z0-9_]{0,79}$'),
  CONSTRAINT notifications_title_check
    CHECK (char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT notifications_body_check
    CHECK (char_length(body) BETWEEN 1 AND 300),
  CONSTRAINT notifications_entity_type_check
    CHECK (entity_type IS NULL OR char_length(entity_type) <= 80),
  CONSTRAINT notifications_request_id_check
    CHECK (request_id IS NULL OR char_length(request_id) BETWEEN 1 AND 128),
  CONSTRAINT notifications_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT notifications_society_user_membership_fkey
    FOREIGN KEY (society_id, user_id)
    REFERENCES public.memberships (society_id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX notifications_society_id_idx ON public.notifications (society_id);
CREATE INDEX notifications_society_user_idx
  ON public.notifications (society_id, user_id);
CREATE INDEX notifications_request_id_idx
  ON public.notifications (request_id)
  WHERE request_id IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.notifications TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.notifications TO service_role;

CREATE POLICY notifications_read_self
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY notifications_update_self
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  CONSTRAINT push_subscriptions_endpoint_check
    CHECK (char_length(endpoint) BETWEEN 1 AND 2048),
  CONSTRAINT push_subscriptions_endpoint_provider_check
    CHECK (
      endpoint ~* '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)(/|$)'
    ),
  CONSTRAINT push_subscriptions_p256dh_check
    CHECK (char_length(p256dh) BETWEEN 1 AND 256),
  CONSTRAINT push_subscriptions_auth_secret_check
    CHECK (char_length(auth_secret) BETWEEN 1 AND 256),
  CONSTRAINT push_subscriptions_user_agent_check
    CHECK (user_agent IS NULL OR char_length(user_agent) <= 512)
);

CREATE INDEX push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_subscriptions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO service_role;

CREATE POLICY push_subscriptions_owner
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE private.email_daily_quota (
  quota_date date PRIMARY KEY,
  sent_count integer NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  alerted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.email_daily_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.email_daily_quota
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.create_notification(
  p_society_id uuid,
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id
      AND membership.user_id = p_user_id
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'The notification recipient is not in this society.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.notifications (
    society_id, user_id, type, title, body, entity_type, entity_id, request_id
  )
  VALUES (
    p_society_id, p_user_id, p_type, p_title, p_body, p_entity_type,
    p_entity_id, p_request_id
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION private.create_notification(
  uuid, uuid, text, text, text, text, uuid, text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.notifications
  SET read_at = COALESCE(read_at, now())
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notification_read(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = auth.uid() AND read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected_rows integer;
  current_subscriptions integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text, 0)
  );

  IF p_endpoint !~* '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)(/|$)' THEN
    RAISE EXCEPTION 'The push endpoint is not supported.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.push_subscriptions
    WHERE endpoint = p_endpoint AND user_id = auth.uid()
  ) THEN
    SELECT count(*) INTO current_subscriptions
    FROM public.push_subscriptions
    WHERE user_id = auth.uid();
    IF current_subscriptions >= 10 THEN
      RAISE EXCEPTION 'A maximum of 10 push subscriptions is allowed.'
        USING ERRCODE = '54000';
    END IF;
  END IF;

  INSERT INTO public.push_subscriptions (
    user_id, endpoint, p256dh, auth_secret, user_agent
  )
  VALUES (
    auth.uid(), p_endpoint, p_p256dh, p_auth_secret, p_user_agent
  )
  ON CONFLICT (endpoint) DO UPDATE
  SET p256dh = EXCLUDED.p256dh,
      auth_secret = EXCLUDED.auth_secret,
      user_agent = EXCLUDED.user_agent
  WHERE public.push_subscriptions.user_id = auth.uid();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 0 THEN
    RAISE EXCEPTION 'This push subscription belongs to another account.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_endpoint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.push_subscriptions
  WHERE endpoint = p_endpoint AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_push_subscription(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.record_email_send(p_daily_limit integer)
RETURNS TABLE (sent_count integer, allowed boolean, should_alert boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_count integer;
  alert_time timestamptz;
  alert_threshold integer;
  send_alert boolean := false;
BEGIN
  IF p_daily_limit < 1 THEN
    RAISE EXCEPTION 'Email quota must be positive.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.email_daily_quota AS quota (quota_date, sent_count)
  VALUES (current_date, 1)
  ON CONFLICT (quota_date) DO UPDATE
  SET sent_count = quota.sent_count + 1,
      updated_at = now()
  RETURNING quota.sent_count, quota.alerted_at
  INTO current_count, alert_time;

  alert_threshold := pg_catalog.ceil(p_daily_limit * 0.8)::integer;
  IF current_count >= alert_threshold AND alert_time IS NULL THEN
    UPDATE private.email_daily_quota
    SET alerted_at = now()
    WHERE quota_date = current_date;
    alert_time := now();
    send_alert := true;
  END IF;

  RETURN QUERY SELECT
    current_count,
    current_count <= p_daily_limit,
    send_alert;
END;
$$;

REVOKE ALL ON FUNCTION public.record_email_send(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_email_send(integer)
  TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;
