CREATE TABLE public.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  society_id uuid REFERENCES public.societies (id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  "before" jsonb,
  "after" jsonb,
  reason text,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_actor_role_check
    CHECK (actor_role IS NULL OR char_length(actor_role) <= 50),
  CONSTRAINT audit_logs_action_check
    CHECK (char_length(action) BETWEEN 1 AND 120),
  CONSTRAINT audit_logs_entity_type_check
    CHECK (char_length(entity_type) BETWEEN 1 AND 80),
  CONSTRAINT audit_logs_entity_id_check
    CHECK (entity_id IS NULL OR char_length(entity_id) <= 120),
  CONSTRAINT audit_logs_before_object_check
    CHECK ("before" IS NULL OR jsonb_typeof("before") = 'object'),
  CONSTRAINT audit_logs_after_object_check
    CHECK ("after" IS NULL OR jsonb_typeof("after") = 'object'),
  CONSTRAINT audit_logs_reason_check
    CHECK (reason IS NULL OR char_length(reason) <= 500)
);

CREATE INDEX audit_logs_society_created_at_idx
  ON public.audit_logs (society_id, created_at DESC);
CREATE INDEX audit_logs_society_entity_idx
  ON public.audit_logs (society_id, entity_type, entity_id);
CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs (actor_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_read_admin_or_developer
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    (society_id IS NOT NULL AND private.has_role(
      society_id,
      ARRAY['admin', 'committee']::text[]
    ))
    OR private.is_developer()
  );

CREATE POLICY audit_logs_insert_service
  ON public.audit_logs FOR INSERT TO service_role
  WITH CHECK (true);

CREATE TRIGGER audit_logs_reject_mutation
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();

REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
GRANT INSERT ON TABLE public.audit_logs TO service_role;
