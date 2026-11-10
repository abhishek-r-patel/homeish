CREATE TABLE public.service_request_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  name text NOT NULL,
  sla_hours integer,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT service_request_categories_name_check
    CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  CONSTRAINT service_request_categories_sla_check
    CHECK (sla_hours IS NULL OR sla_hours BETWEEN 1 AND 8760),
  CONSTRAINT service_request_categories_sort_order_check
    CHECK (sort_order BETWEEN 0 AND 10000),
  CONSTRAINT service_request_categories_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT service_request_categories_society_name_key UNIQUE (society_id, name)
);

CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  category_id uuid NOT NULL,
  location_type text NOT NULL,
  unit_id uuid,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  assigned_membership_id uuid,
  assigned_vendor_name text,
  assigned_vendor_phone text,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  reject_reason text,
  rating smallint,
  rating_comment text,
  client_request_id uuid NOT NULL,
  CONSTRAINT service_requests_description_check
    CHECK (char_length(btrim(description)) BETWEEN 1 AND 2000),
  CONSTRAINT service_requests_priority_check
    CHECK (priority IN ('normal', 'urgent')),
  CONSTRAINT service_requests_location_check
    CHECK (
      (location_type = 'unit' AND unit_id IS NOT NULL)
      OR (location_type = 'common_area' AND unit_id IS NULL)
    ),
  CONSTRAINT service_requests_status_check
    CHECK (status IN (
      'open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened'
    )),
  CONSTRAINT service_requests_assignment_check
    CHECK (
      (assigned_membership_id IS NULL
        AND assigned_vendor_name IS NULL AND assigned_vendor_phone IS NULL)
      OR (assigned_membership_id IS NOT NULL
        AND assigned_vendor_name IS NULL AND assigned_vendor_phone IS NULL)
      OR (assigned_membership_id IS NULL
        AND char_length(btrim(assigned_vendor_name)) BETWEEN 1 AND 120
        AND char_length(btrim(assigned_vendor_phone)) BETWEEN 7 AND 20)
    ),
  CONSTRAINT service_requests_reject_reason_check
    CHECK (
      (status = 'rejected' AND char_length(btrim(reject_reason)) BETWEEN 1 AND 500)
      OR (status <> 'rejected' AND reject_reason IS NULL)
    ),
  CONSTRAINT service_requests_resolved_at_check
    CHECK (
      (status IN ('resolved', 'closed') AND resolved_at IS NOT NULL)
      OR (status NOT IN ('resolved', 'closed') AND resolved_at IS NULL)
    ),
  CONSTRAINT service_requests_closed_at_check
    CHECK ((status = 'closed') = (closed_at IS NOT NULL)),
  CONSTRAINT service_requests_rating_check
    CHECK (
      (rating IS NULL AND rating_comment IS NULL)
      OR (status = 'closed' AND rating BETWEEN 1 AND 5
        AND (rating_comment IS NULL OR char_length(rating_comment) <= 500))
    ),
  CONSTRAINT service_requests_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT service_requests_category_same_society_fkey
    FOREIGN KEY (society_id, category_id)
    REFERENCES public.service_request_categories (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT service_requests_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT service_requests_assignee_same_society_fkey
    FOREIGN KEY (society_id, assigned_membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT service_requests_client_request_key
    UNIQUE (society_id, created_by, client_request_id)
);

CREATE TABLE public.service_request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  body text NOT NULL,
  client_request_id uuid NOT NULL,
  CONSTRAINT service_request_comments_body_check
    CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  CONSTRAINT service_request_comments_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT service_request_comments_request_id_id_key UNIQUE (request_id, id),
  CONSTRAINT service_request_comments_request_same_society_fkey
    FOREIGN KEY (society_id, request_id)
    REFERENCES public.service_requests (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT service_request_comments_client_request_key
    UNIQUE (society_id, created_by, client_request_id)
);

CREATE TABLE public.service_request_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  comment_id uuid,
  storage_path text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  CONSTRAINT service_request_attachments_path_check
    CHECK (char_length(storage_path) BETWEEN 1 AND 500),
  CONSTRAINT service_request_attachments_type_check
    CHECK (content_type IN ('image/jpeg', 'image/png')),
  CONSTRAINT service_request_attachments_size_check
    CHECK (size_bytes BETWEEN 1 AND 5242880),
  CONSTRAINT service_request_attachments_comment_check
    CHECK (comment_id IS NULL OR content_type IN ('image/jpeg', 'image/png')),
  CONSTRAINT service_request_attachments_storage_path_key UNIQUE (storage_path),
  CONSTRAINT service_request_attachments_request_same_society_fkey
    FOREIGN KEY (society_id, request_id)
    REFERENCES public.service_requests (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT service_request_attachments_comment_same_request_fkey
    FOREIGN KEY (request_id, comment_id)
    REFERENCES public.service_request_comments (request_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.service_request_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  note text,
  CONSTRAINT service_request_events_type_check
    CHECK (event_type IN (
      'created', 'assigned', 'reassigned', 'status_changed',
      'rejected', 'confirmed', 'reopened', 'rated', 'commented', 'auto_closed'
    )),
  CONSTRAINT service_request_events_status_check
    CHECK (
      (from_status IS NULL OR from_status IN (
        'open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened'
      ))
      AND (to_status IS NULL OR to_status IN (
        'open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened'
      ))
    ),
  CONSTRAINT service_request_events_note_check
    CHECK (note IS NULL OR char_length(note) <= 500),
  CONSTRAINT service_request_events_request_same_society_fkey
    FOREIGN KEY (society_id, request_id)
    REFERENCES public.service_requests (society_id, id) ON DELETE RESTRICT
);

CREATE INDEX service_request_categories_society_active_order_idx
  ON public.service_request_categories (society_id, active, sort_order, name);
CREATE INDEX service_request_categories_created_by_idx
  ON public.service_request_categories (created_by)
  WHERE created_by IS NOT NULL;
CREATE INDEX service_request_categories_updated_by_idx
  ON public.service_request_categories (updated_by)
  WHERE updated_by IS NOT NULL;
CREATE INDEX service_requests_society_status_created_idx
  ON public.service_requests (society_id, status, created_at DESC);
CREATE INDEX service_requests_society_unit_created_idx
  ON public.service_requests (society_id, unit_id, created_at DESC);
CREATE INDEX service_requests_society_common_created_idx
  ON public.service_requests (society_id, created_at DESC)
  WHERE location_type = 'common_area';
CREATE INDEX service_requests_assignee_status_idx
  ON public.service_requests (society_id, assigned_membership_id, status);
CREATE INDEX service_requests_category_same_society_idx
  ON public.service_requests (society_id, category_id);
CREATE INDEX service_requests_created_by_idx
  ON public.service_requests (created_by);
CREATE INDEX service_requests_updated_by_idx
  ON public.service_requests (updated_by)
  WHERE updated_by IS NOT NULL;
CREATE INDEX service_requests_overdue_idx
  ON public.service_requests (society_id, sla_due_at)
  WHERE status IN ('open', 'assigned', 'in_progress', 'reopened')
    AND sla_due_at IS NOT NULL;
CREATE INDEX service_requests_auto_close_idx
  ON public.service_requests (society_id, resolved_at)
  WHERE status = 'resolved';
CREATE INDEX service_request_comments_thread_idx
  ON public.service_request_comments (request_id, created_at);
CREATE INDEX service_request_comments_request_same_society_idx
  ON public.service_request_comments (society_id, request_id);
CREATE INDEX service_request_comments_created_by_idx
  ON public.service_request_comments (created_by);
CREATE INDEX service_request_attachments_request_idx
  ON public.service_request_attachments (request_id, created_at);
CREATE INDEX service_request_attachments_request_same_society_idx
  ON public.service_request_attachments (society_id, request_id);
CREATE INDEX service_request_attachments_comment_idx
  ON public.service_request_attachments (request_id, comment_id);
CREATE INDEX service_request_attachments_created_by_idx
  ON public.service_request_attachments (created_by);
CREATE INDEX service_request_events_timeline_idx
  ON public.service_request_events (request_id, created_at);
CREATE INDEX service_request_events_request_same_society_idx
  ON public.service_request_events (society_id, request_id);
CREATE INDEX service_request_events_created_by_idx
  ON public.service_request_events (created_by)
  WHERE created_by IS NOT NULL;

CREATE TRIGGER service_request_categories_set_updated_at
  BEFORE UPDATE ON public.service_request_categories
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();
CREATE TRIGGER service_requests_set_updated_at
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.service_request_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.service_request_categories,
  public.service_requests, public.service_request_comments,
  public.service_request_attachments, public.service_request_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.service_request_categories,
  public.service_requests, public.service_request_comments,
  public.service_request_attachments, public.service_request_events
  TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.service_request_categories,
  public.service_requests, public.service_request_comments,
  public.service_request_attachments, public.service_request_events
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.service_request_events_id_seq
  TO service_role;

CREATE POLICY service_request_categories_read
  ON public.service_request_categories FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'service_request')
    AND private.has_role(
      society_id, ARRAY['admin', 'committee', 'resident']::text[]
    )
  );
CREATE POLICY service_requests_read
  ON public.service_requests FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'service_request')
    AND (
      private.has_role(society_id, ARRAY['admin', 'committee']::text[])
      OR (location_type = 'unit' AND private.occupies_unit(unit_id))
      OR (
        location_type = 'common_area'
        AND private.has_role(society_id, ARRAY['resident']::text[])
      )
      OR EXISTS (
        SELECT 1
        FROM public.memberships AS assignee
        WHERE assignee.id = assigned_membership_id
          AND assignee.society_id = service_requests.society_id
          AND assignee.user_id = (SELECT auth.uid())
          AND assignee.status = 'active'
      )
    )
  );
CREATE POLICY service_request_comments_read
  ON public.service_request_comments FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'service_request')
    AND EXISTS (
      SELECT 1 FROM public.service_requests AS request
      WHERE request.society_id = service_request_comments.society_id
        AND request.id = service_request_comments.request_id
    )
  );
CREATE POLICY service_request_attachments_read
  ON public.service_request_attachments FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'service_request')
    AND EXISTS (
      SELECT 1 FROM public.service_requests AS request
      WHERE request.society_id = service_request_attachments.society_id
        AND request.id = service_request_attachments.request_id
    )
  );
CREATE POLICY service_request_events_read
  ON public.service_request_events FOR SELECT TO authenticated
  USING (
    private.module_enabled(society_id, 'service_request')
    AND EXISTS (
      SELECT 1 FROM public.service_requests AS request
      WHERE request.society_id = service_request_events.society_id
        AND request.id = service_request_events.request_id
    )
  );

CREATE OR REPLACE FUNCTION private.seed_service_request_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.service_request_categories (
    society_id, name, sort_order, created_by, updated_by
  )
  VALUES
    (NEW.id, 'Plumbing', 10, NEW.created_by, NEW.created_by),
    (NEW.id, 'Electrical', 20, NEW.created_by, NEW.created_by),
    (NEW.id, 'Lift', 30, NEW.created_by, NEW.created_by),
    (NEW.id, 'Cleaning', 40, NEW.created_by, NEW.created_by),
    (NEW.id, 'Security', 50, NEW.created_by, NEW.created_by),
    (NEW.id, 'Parking', 60, NEW.created_by, NEW.created_by),
    (NEW.id, 'Noise', 70, NEW.created_by, NEW.created_by),
    (NEW.id, 'Other', 80, NEW.created_by, NEW.created_by);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.seed_service_request_categories()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER societies_seed_service_request_categories
  AFTER INSERT ON public.societies
  FOR EACH ROW EXECUTE FUNCTION private.seed_service_request_categories();
