CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id text NOT NULL UNIQUE,
  society_id uuid REFERENCES public.societies (id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  role text,
  module_key text REFERENCES public.modules (key) ON DELETE RESTRICT,
  route text,
  source text NOT NULL,
  severity text NOT NULL,
  message text NOT NULL,
  stack text,
  app_version text,
  device jsonb,
  request_id text,
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  resolve_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT error_logs_reference_id_check
    CHECK (char_length(reference_id) BETWEEN 4 AND 32),
  CONSTRAINT error_logs_role_check
    CHECK (role IS NULL OR char_length(role) <= 50),
  CONSTRAINT error_logs_route_check
    CHECK (route IS NULL OR char_length(route) <= 500),
  CONSTRAINT error_logs_source_check
    CHECK (source IN ('server', 'client', 'job')),
  CONSTRAINT error_logs_severity_check
    CHECK (severity IN ('critical', 'error', 'warning', 'info')),
  CONSTRAINT error_logs_message_check
    CHECK (char_length(message) BETWEEN 1 AND 2000),
  CONSTRAINT error_logs_stack_check
    CHECK (stack IS NULL OR char_length(stack) <= 12000),
  CONSTRAINT error_logs_device_object_check
    CHECK (device IS NULL OR jsonb_typeof(device) = 'object'),
  CONSTRAINT error_logs_status_check
    CHECK (status IN ('open', 'resolved', 'ignored')),
  CONSTRAINT error_logs_resolve_note_check
    CHECK (resolve_note IS NULL OR char_length(resolve_note) <= 500)
);

CREATE INDEX error_logs_status_severity_created_at_idx
  ON public.error_logs (status, severity, created_at DESC);
CREATE INDEX error_logs_society_created_at_idx
  ON public.error_logs (society_id, created_at DESC);
CREATE INDEX error_logs_request_id_idx ON public.error_logs (request_id);
CREATE INDEX error_logs_user_id_idx ON public.error_logs (user_id);
CREATE INDEX error_logs_module_key_idx ON public.error_logs (module_key);
CREATE INDEX error_logs_resolved_by_idx ON public.error_logs (resolved_by);
CREATE INDEX error_logs_created_at_idx ON public.error_logs (created_at);

CREATE OR REPLACE FUNCTION private.guard_error_log_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF ROW(
    NEW.id,
    NEW.reference_id,
    NEW.society_id,
    NEW.user_id,
    NEW.role,
    NEW.module_key,
    NEW.route,
    NEW.source,
    NEW.severity,
    NEW.message,
    NEW.stack,
    NEW.app_version,
    NEW.device,
    NEW.request_id,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.id,
    OLD.reference_id,
    OLD.society_id,
    OLD.user_id,
    OLD.role,
    OLD.module_key,
    OLD.route,
    OLD.source,
    OLD.severity,
    OLD.message,
    OLD.stack,
    OLD.app_version,
    OLD.device,
    OLD.request_id,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Error log details cannot be changed.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_error_log_update() FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY error_logs_read_developer
  ON public.error_logs FOR SELECT TO authenticated
  USING (private.is_developer());

CREATE POLICY error_logs_update_developer
  ON public.error_logs FOR UPDATE TO authenticated
  USING (private.is_developer())
  WITH CHECK (private.is_developer());

CREATE POLICY error_logs_insert_service
  ON public.error_logs FOR INSERT TO service_role
  WITH CHECK (true);

CREATE TRIGGER error_logs_guard_update
  BEFORE UPDATE ON public.error_logs
  FOR EACH ROW EXECUTE FUNCTION private.guard_error_log_update();

CREATE TRIGGER error_logs_reject_delete
  BEFORE DELETE ON public.error_logs
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();

REVOKE ALL ON TABLE public.error_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.error_logs TO authenticated;
GRANT UPDATE (status, resolved_by, resolved_at, resolve_note)
  ON TABLE public.error_logs TO authenticated;
GRANT INSERT ON TABLE public.error_logs TO service_role;
