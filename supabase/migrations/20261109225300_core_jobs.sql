CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  summary jsonb,
  finished_at timestamptz,
  CONSTRAINT jobs_type_check
    CHECK (type IN (
      'bill_generation',
      'csv_import_units',
      'csv_import_residents',
      'export'
    )),
  CONSTRAINT jobs_status_check
    CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed')),
  CONSTRAINT jobs_progress_check CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT jobs_summary_object_check
    CHECK (summary IS NULL OR jsonb_typeof(summary) = 'object')
);

CREATE INDEX jobs_society_created_at_idx
  ON public.jobs (society_id, created_at DESC);
CREATE INDEX jobs_created_by_idx ON public.jobs (created_by);
CREATE INDEX jobs_updated_by_idx ON public.jobs (updated_by);
CREATE INDEX jobs_created_at_idx ON public.jobs (created_at);

CREATE TRIGGER jobs_set_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY jobs_read_creator_admin_or_developer
  ON public.jobs FOR SELECT TO authenticated
  USING (
    private.is_developer()
    OR (
      private.is_member(society_id)
      AND (
        created_by = (SELECT auth.uid())
        OR private.has_role(society_id, ARRAY['admin']::text[])
      )
    )
  );

CREATE POLICY jobs_service_manage
  ON public.jobs FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.jobs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.jobs TO service_role;
