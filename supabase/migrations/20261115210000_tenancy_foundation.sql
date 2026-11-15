-- Gate tenant moves behind consent, private proofs and actual Core occupancy completion.
ALTER TABLE public.modules DROP CONSTRAINT modules_key_check;
ALTER TABLE public.modules ADD CONSTRAINT modules_key_check CHECK (
  key IN ('core', 'visitor', 'delivery', 'billing', 'service_request', 'staff',
    'housekeeping', 'amc', 'notice', 'amenity', 'directory', 'expense', 'tenancy')
);
INSERT INTO public.modules (key, name, is_core, sort_order)
VALUES ('tenancy', 'Move-in, Move-out & Tenancy', false, 12);

ALTER TABLE public.amenity_bookings ADD CONSTRAINT amenity_bookings_society_id_id_key
  UNIQUE (society_id, id);

CREATE FUNCTION private.tenancy_settings_valid(p_settings jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_settings) AS key
      WHERE key <> 'police_verification_required'
    )
    AND (NOT p_settings ? 'police_verification_required'
      OR jsonb_typeof(p_settings -> 'police_verification_required') = 'boolean')
$$;
REVOKE ALL ON FUNCTION private.tenancy_settings_valid(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.tenancy_settings_valid(jsonb)
  TO authenticated, service_role;
ALTER TABLE public.module_configs ADD CONSTRAINT module_configs_tenancy_settings_check
  CHECK (module_key <> 'tenancy' OR private.tenancy_settings_valid(settings));

CREATE TABLE public.tenancy_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  tenant_membership_id uuid NOT NULL,
  occupancy_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('move_in', 'move_out')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  agreement_expires_on date,
  amenity_booking_id uuid,
  status text NOT NULL CHECK (status IN (
    'awaiting_consent', 'pending_review', 'approved', 'rejected', 'cancelled', 'completed'
  )),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  owner_consent_occupancy_id uuid,
  consented_at timestamptz,
  consented_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  completion_in_progress boolean NOT NULL DEFAULT false,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_moves_unit_fkey FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_moves_tenant_fkey FOREIGN KEY (society_id, tenant_membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_moves_occupancy_fkey FOREIGN KEY (society_id, occupancy_id)
    REFERENCES public.unit_occupants (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_moves_owner_consent_fkey FOREIGN KEY (society_id, owner_consent_occupancy_id)
    REFERENCES public.unit_occupants (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_moves_amenity_booking_fkey FOREIGN KEY (society_id, amenity_booking_id)
    REFERENCES public.amenity_bookings (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_moves_agreement_check
    CHECK ((kind = 'move_in') = (agreement_expires_on IS NOT NULL)),
  CONSTRAINT tenancy_moves_consent_check CHECK (
    (owner_consent_occupancy_id IS NULL AND consented_at IS NULL AND consented_by IS NULL)
    OR (kind = 'move_in' AND owner_consent_occupancy_id IS NOT NULL
      AND consented_at IS NOT NULL AND consented_by IS NOT NULL)
  ),
  CONSTRAINT tenancy_moves_approval_check
    CHECK ((approved_at IS NULL) = (approved_by IS NULL)
      AND (status NOT IN ('approved', 'completed') OR approved_at IS NOT NULL)),
  CONSTRAINT tenancy_moves_completion_check
    CHECK ((completed_at IS NULL) = (completed_by IS NULL)
      AND (status = 'completed') = (completed_at IS NOT NULL)
      AND (NOT completion_in_progress OR status = 'approved')),
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id)
);
CREATE UNIQUE INDEX tenancy_moves_open_occupancy_idx
  ON public.tenancy_moves (society_id, occupancy_id)
  WHERE status IN ('awaiting_consent', 'pending_review', 'approved');
CREATE INDEX tenancy_moves_schedule_idx
  ON public.tenancy_moves (society_id, starts_at DESC, id);
CREATE INDEX tenancy_moves_unit_idx ON public.tenancy_moves (society_id, unit_id);
CREATE INDEX tenancy_moves_tenant_idx
  ON public.tenancy_moves (society_id, tenant_membership_id);
CREATE INDEX tenancy_moves_occupancy_idx
  ON public.tenancy_moves (society_id, occupancy_id);
CREATE INDEX tenancy_moves_owner_consent_idx
  ON public.tenancy_moves (society_id, owner_consent_occupancy_id);
CREATE INDEX tenancy_moves_amenity_booking_idx
  ON public.tenancy_moves (society_id, amenity_booking_id);
CREATE INDEX tenancy_moves_created_by_idx ON public.tenancy_moves (created_by);
CREATE INDEX tenancy_moves_updated_by_idx ON public.tenancy_moves (updated_by);
CREATE INDEX tenancy_moves_consented_by_idx ON public.tenancy_moves (consented_by);
CREATE INDEX tenancy_moves_approved_by_idx ON public.tenancy_moves (approved_by);
CREATE INDEX tenancy_moves_completed_by_idx ON public.tenancy_moves (completed_by);

CREATE TABLE public.tenancy_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  move_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('rental_agreement', 'police_verification', 'noc')),
  path text NOT NULL UNIQUE CHECK (char_length(path) BETWEEN 1 AND 500),
  content_type text NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  dues_status text CHECK (dues_status IN ('cleared', 'not_checked')),
  dues_checked_at timestamptz,
  purge_after timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_documents_move_fkey FOREIGN KEY (society_id, move_id)
    REFERENCES public.tenancy_moves (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT tenancy_documents_noc_check CHECK (
    (kind <> 'noc' AND dues_status IS NULL AND dues_checked_at IS NULL)
    OR (kind = 'noc' AND content_type = 'application/pdf'
      AND dues_status IS NOT NULL
      AND ((dues_status = 'cleared') = (dues_checked_at IS NOT NULL)))
  ),
  UNIQUE (society_id, id),
  UNIQUE (society_id, move_id, kind)
);
CREATE INDEX tenancy_documents_retention_idx
  ON public.tenancy_documents (society_id, purge_after) WHERE deleted_at IS NULL;
CREATE INDEX tenancy_documents_created_by_idx ON public.tenancy_documents (created_by);

CREATE TABLE public.tenancy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  move_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'created', 'document_attached', 'consented', 'approved', 'rejected',
    'cancelled', 'completed', 'noc_issued'
  )),
  status text NOT NULL CHECK (status IN (
    'awaiting_consent', 'pending_review', 'approved', 'rejected', 'cancelled', 'completed'
  )),
  reason text CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  CONSTRAINT tenancy_events_move_fkey FOREIGN KEY (society_id, move_id)
    REFERENCES public.tenancy_moves (society_id, id) ON DELETE RESTRICT
);
CREATE INDEX tenancy_events_move_idx
  ON public.tenancy_events (society_id, move_id, created_at, id);
CREATE INDEX tenancy_events_created_by_idx ON public.tenancy_events (created_by);

ALTER TABLE public.tenancy_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenancy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenancy_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenancy_moves, public.tenancy_documents, public.tenancy_events
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY tenancy_moves_no_direct_access ON public.tenancy_moves
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY tenancy_documents_no_direct_access ON public.tenancy_documents
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY tenancy_events_no_direct_access ON public.tenancy_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER tenancy_events_immutable BEFORE UPDATE OR DELETE ON public.tenancy_events
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER tenancy_events_no_truncate BEFORE TRUNCATE ON public.tenancy_events
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER tenancy_moves_no_delete BEFORE DELETE ON public.tenancy_moves
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER tenancy_moves_no_truncate BEFORE TRUNCATE ON public.tenancy_moves
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER tenancy_documents_no_delete BEFORE DELETE ON public.tenancy_documents
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER tenancy_documents_no_truncate BEFORE TRUNCATE ON public.tenancy_documents
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.tenancy_authorize(p_society_id uuid, p_roles text[], p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id, 'tenancy')
    OR NOT private.has_role(p_society_id, p_roles)
    OR NOT EXISTS (
      SELECT 1 FROM public.societies WHERE id = p_society_id AND status <> 'archived'
    )
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN
    RAISE EXCEPTION 'Tenancy access is not available.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_authorize(uuid, text[], boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_is_owner(p_society_id uuid, p_unit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_society_id AND occupant.unit_id = p_unit_id
      AND occupant.relationship = 'owner' AND occupant.status = 'active'
      AND membership.status = 'active' AND membership.user_id = auth.uid()
      AND 'resident' = ANY(membership.roles)
  )
$$;
REVOKE ALL ON FUNCTION private.tenancy_is_owner(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_can_read_move(p_society_id uuid, p_move_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenancy_moves AS move
    WHERE move.society_id = p_society_id AND move.id = p_move_id
      AND (
        private.has_role(p_society_id, ARRAY['admin']::text[])
        OR private.tenancy_is_owner(p_society_id, move.unit_id)
        OR EXISTS (
          SELECT 1 FROM public.memberships AS membership
          WHERE membership.society_id = p_society_id AND membership.id = move.tenant_membership_id
            AND membership.user_id = auth.uid() AND membership.status = 'active'
            AND 'resident' = ANY(membership.roles)
        )
      )
  )
$$;
REVOKE ALL ON FUNCTION private.tenancy_can_read_move(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_consent_valid(p_move public.tenancy_moves)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_move.kind = 'move_out' OR EXISTS (
    SELECT 1 FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
    WHERE occupant.society_id = p_move.society_id AND occupant.id = p_move.owner_consent_occupancy_id
      AND occupant.unit_id = p_move.unit_id AND occupant.relationship = 'owner'
      AND occupant.status = 'active' AND membership.status = 'active'
      AND membership.user_id = p_move.consented_by AND 'resident' = ANY(membership.roles)
  )
$$;
REVOKE ALL ON FUNCTION private.tenancy_consent_valid(public.tenancy_moves)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_police_required(p_society_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT (settings ->> 'police_verification_required')::boolean
    FROM public.module_configs WHERE society_id = p_society_id AND module_key = 'tenancy'
  ), false)
$$;
REVOKE ALL ON FUNCTION private.tenancy_police_required(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_assert_version(p_actual integer, p_expected integer)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF p_expected IS NULL OR p_expected < 1 THEN
    RAISE EXCEPTION 'A current version is required.' USING ERRCODE = '22023';
  END IF;
  IF p_actual <> p_expected THEN
    RAISE EXCEPTION 'This move changed. Refresh before trying again.' USING ERRCODE = '40001';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_assert_version(integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_event(p_move_id uuid, p_action text, p_reason text, p_request_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move public.tenancy_moves;
BEGIN
  SELECT * INTO STRICT move FROM public.tenancy_moves WHERE id = p_move_id;
  INSERT INTO public.tenancy_events (society_id, move_id, action, status, reason, created_by, request_id)
  VALUES (move.society_id, move.id, p_action, move.status, p_reason, auth.uid(), p_request_id);
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
  ) VALUES (
    move.society_id, auth.uid(),
    CASE WHEN auth.uid() IS NULL THEN 'system'
      WHEN private.has_role(move.society_id, ARRAY['admin']::text[]) THEN 'admin'
      ELSE 'resident' END,
    'tenancy.' || p_action, 'tenancy_move', move.id::text,
    jsonb_build_object('status', move.status, 'version', move.version), p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_event(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.tenancy_settings_update(
  p_society_id uuid, p_police_verification_required boolean, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  IF p_police_verification_required IS NULL THEN
    RAISE EXCEPTION 'Choose whether police proof is required.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.module_configs
  SET settings = jsonb_build_object('police_verification_required', p_police_verification_required),
    updated_by = auth.uid(), updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'tenancy';
  INSERT INTO public.audit_logs (society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id)
  VALUES (p_society_id, auth.uid(), 'admin', 'tenancy.settings.update', 'module', 'tenancy',
    jsonb_build_object('police_verification_required', p_police_verification_required), p_request_id);
END;
$$;

-- A private row marker, not a caller-settable session flag, authorises activation.
CREATE FUNCTION private.tenancy_occupancy_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.relationship = 'tenant' AND NEW.status = 'active'
    AND (TG_OP = 'INSERT' OR OLD.status <> 'active'
      OR (NEW.society_id, NEW.unit_id, NEW.membership_id, NEW.relationship)
        IS DISTINCT FROM (OLD.society_id, OLD.unit_id, OLD.membership_id, OLD.relationship))
    AND private.module_enabled(NEW.society_id, 'tenancy')
    AND NOT EXISTS (
      SELECT 1 FROM public.tenancy_moves AS move
      WHERE move.society_id = NEW.society_id AND move.unit_id = NEW.unit_id
        AND move.tenant_membership_id = NEW.membership_id AND move.occupancy_id = NEW.id
        AND move.kind = 'move_in' AND move.status = 'approved' AND move.completion_in_progress
        AND private.has_role(NEW.society_id, ARRAY['admin']::text[])
    )
  THEN
    RAISE EXCEPTION 'Tenant access requires a completed move-in workflow.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_occupancy_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER tenancy_occupancy_activation_guard
  BEFORE INSERT OR UPDATE ON public.unit_occupants
  FOR EACH ROW EXECUTE FUNCTION private.tenancy_occupancy_guard();

CREATE OR REPLACE FUNCTION private.sync_occupants_with_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    UPDATE public.unit_occupants
    SET status = 'active'
    WHERE society_id = NEW.society_id AND membership_id = NEW.id AND status = 'pending'
      AND (relationship <> 'tenant' OR NOT private.module_enabled(NEW.society_id, 'tenancy'));
  ELSIF NEW.status = 'deactivated' AND OLD.status IS DISTINCT FROM 'deactivated' THEN
    UPDATE public.unit_occupants SET status = 'ended', ended_at = current_date
    WHERE society_id = NEW.society_id AND membership_id = NEW.id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.tenancy_serialize_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.module_enabled(NEW.society_id, 'tenancy') THEN
    PERFORM 1 FROM public.units WHERE society_id = NEW.society_id AND id = NEW.unit_id FOR UPDATE;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_serialize_ledger()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER tenancy_ledger_clearance_lock BEFORE INSERT ON public.billing_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION private.tenancy_serialize_ledger();

CREATE FUNCTION private.tenancy_dues(p_society_id uuid, p_unit_id uuid, p_lock boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  balance numeric;
BEGIN
  IF p_lock THEN
    PERFORM 1 FROM public.module_configs
      WHERE society_id = p_society_id AND module_key = 'billing' FOR SHARE;
    PERFORM 1 FROM public.units WHERE society_id = p_society_id AND id = p_unit_id FOR UPDATE;
  END IF;
  IF NOT private.module_enabled(p_society_id, 'billing') THEN
    RETURN jsonb_build_object('status', 'not_checked', 'balance_paise', NULL, 'checked_at', NULL);
  END IF;
  SELECT COALESCE(sum(CASE direction WHEN 'debit' THEN amount_paise ELSE -amount_paise END), 0)
  INTO balance FROM public.billing_ledger_entries
  WHERE society_id = p_society_id AND unit_id = p_unit_id;
  RETURN jsonb_build_object(
    'status', CASE WHEN balance > 0 THEN 'pending' ELSE 'cleared' END,
    'balance_paise', balance::text, 'checked_at', clock_timestamp()
  );
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_dues(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_assert_proofs(p_move public.tenancy_moves)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  required_kind text;
  local_today date;
BEGIN
  IF p_move.kind <> 'move_in' THEN RETURN; END IF;
  SELECT (clock_timestamp() AT TIME ZONE timezone)::date INTO local_today
    FROM public.societies WHERE id = p_move.society_id;
  IF p_move.agreement_expires_on < local_today THEN
    RAISE EXCEPTION 'The rental agreement has expired.' USING ERRCODE = '23514';
  END IF;
  FOREACH required_kind IN ARRAY (
    CASE WHEN private.tenancy_police_required(p_move.society_id)
      THEN ARRAY['rental_agreement', 'police_verification']::text[]
      ELSE ARRAY['rental_agreement']::text[] END
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.tenancy_documents AS document
      JOIN storage.objects AS object ON object.bucket_id = 'tenancy-files' AND object.name = document.path
      WHERE document.society_id = p_move.society_id AND document.move_id = p_move.id
        AND document.kind = required_kind AND document.deleted_at IS NULL
        AND (document.purge_after IS NULL OR document.purge_after > clock_timestamp())
        AND object.metadata ->> 'mimetype' = document.content_type
        AND object.metadata ->> 'size' = document.size_bytes::text
    ) THEN
      RAISE EXCEPTION 'Upload the required valid tenant proofs before consent or approval.' USING ERRCODE = '23514';
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_assert_proofs(public.tenancy_moves)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.tenancy_assert_ready(p_move public.tenancy_moves)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.units WHERE society_id = p_move.society_id AND id = p_move.unit_id AND active
  ) OR NOT EXISTS (
    SELECT 1 FROM public.memberships WHERE society_id = p_move.society_id
      AND id = p_move.tenant_membership_id AND status IN ('invited', 'pending_approval', 'active')
      AND 'resident' = ANY(roles)
  ) THEN
    RAISE EXCEPTION 'The unit or tenant is no longer available.' USING ERRCODE = '23514';
  END IF;
  IF p_move.amenity_booking_id IS NOT NULL AND (
    NOT private.module_enabled(p_move.society_id, 'amenity') OR NOT EXISTS (
      SELECT 1 FROM public.amenity_bookings AS booking
      WHERE booking.id = p_move.amenity_booking_id AND booking.society_id = p_move.society_id
        AND booking.unit_id = p_move.unit_id AND booking.status = 'confirmed'
        AND booking.starts_at <= p_move.starts_at AND booking.ends_at >= p_move.ends_at
    )
  ) THEN
    RAISE EXCEPTION 'The linked amenity booking is unavailable.' USING ERRCODE = '23514';
  END IF;
  IF p_move.kind = 'move_in' THEN
    IF NOT private.tenancy_consent_valid(p_move) THEN
      RAISE EXCEPTION 'Current owner consent is required.' USING ERRCODE = '23514';
    END IF;
    PERFORM private.tenancy_assert_proofs(p_move);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_assert_ready(public.tenancy_moves)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.tenancy_move_create(
  p_society_id uuid, p_unit_id uuid, p_tenant_membership_id uuid, p_kind text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_agreement_expires_on date,
  p_amenity_booking_id uuid, p_client_request_id uuid, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move_id uuid;
  occupant public.unit_occupants;
  tenant public.memberships;
  society_timezone text;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin', 'resident']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin', 'resident']::text[], true);
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  SELECT id INTO move_id FROM public.tenancy_moves
  WHERE society_id = p_society_id AND created_by = auth.uid() AND client_request_id = p_client_request_id;
  IF FOUND THEN RETURN move_id; END IF;
  SELECT timezone INTO society_timezone FROM public.societies WHERE id = p_society_id;
  IF p_kind IS NULL OR p_kind NOT IN ('move_in', 'move_out')
    OR p_client_request_id IS NULL OR p_starts_at IS NULL OR p_ends_at IS NULL
    OR NOT isfinite(p_starts_at) OR NOT isfinite(p_ends_at)
    OR p_starts_at < clock_timestamp() OR p_ends_at <= p_starts_at
    OR (p_kind = 'move_in') <> (p_agreement_expires_on IS NOT NULL)
    OR (p_agreement_expires_on IS NOT NULL
      AND (NOT isfinite(p_agreement_expires_on)
        OR p_agreement_expires_on < (p_starts_at AT TIME ZONE society_timezone)::date))
  THEN
    RAISE EXCEPTION 'Choose a future move window and a valid agreement expiry.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO tenant FROM public.memberships
  WHERE society_id = p_society_id AND id = p_tenant_membership_id
    AND status IN ('active', 'invited', 'pending_approval') AND 'resident' = ANY(roles);
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.units WHERE society_id = p_society_id AND id = p_unit_id AND active
  ) THEN
    RAISE EXCEPTION 'Move target not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO occupant FROM public.unit_occupants
  WHERE society_id = p_society_id AND unit_id = p_unit_id
    AND membership_id = p_tenant_membership_id AND status <> 'ended' FOR UPDATE;
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    AND NOT private.tenancy_is_owner(p_society_id, p_unit_id)
    AND NOT COALESCE(tenant.user_id = auth.uid() AND occupant.relationship = 'tenant', false)
  THEN
    RAISE EXCEPTION 'Move target not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_kind = 'move_out' AND (
    occupant.id IS NULL OR occupant.status <> 'active' OR occupant.relationship <> 'tenant'
  ) THEN
    RAISE EXCEPTION 'An active tenant occupancy is required.' USING ERRCODE = '23514';
  END IF;
  IF p_kind = 'move_in' THEN
    IF occupant.id IS NOT NULL AND (occupant.status <> 'pending' OR occupant.relationship <> 'tenant') THEN
      RAISE EXCEPTION 'This tenant already has an occupancy.' USING ERRCODE = '23505';
    END IF;
    IF occupant.id IS NULL THEN
      INSERT INTO public.unit_occupants (
        society_id, unit_id, membership_id, relationship, is_primary, is_approver, status, created_by
      ) VALUES (p_society_id, p_unit_id, p_tenant_membership_id, 'tenant', false, true, 'pending', auth.uid())
      RETURNING * INTO occupant;
    END IF;
  END IF;
  IF p_amenity_booking_id IS NOT NULL AND (
    NOT private.module_enabled(p_society_id, 'amenity') OR NOT EXISTS (
      SELECT 1 FROM public.amenity_bookings WHERE society_id = p_society_id AND id = p_amenity_booking_id
        AND unit_id = p_unit_id AND status = 'confirmed' AND starts_at <= p_starts_at AND ends_at >= p_ends_at
    )
  ) THEN
    RAISE EXCEPTION 'Choose a confirmed booking covering this move window.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.tenancy_moves (
    society_id, unit_id, tenant_membership_id, occupancy_id, kind, starts_at, ends_at,
    agreement_expires_on, amenity_booking_id, status, client_request_id, created_by, updated_by
  ) VALUES (
    p_society_id, p_unit_id, p_tenant_membership_id, occupant.id, p_kind, p_starts_at, p_ends_at,
    p_agreement_expires_on, p_amenity_booking_id,
    CASE p_kind WHEN 'move_in' THEN 'awaiting_consent' ELSE 'pending_review' END,
    p_client_request_id, auth.uid(), auth.uid()
  ) RETURNING id INTO move_id;
  PERFORM private.tenancy_event(move_id, 'created', NULL, p_request_id);
  RETURN move_id;
END;
$$;

CREATE FUNCTION public.tenancy_move_consent(
  p_society_id uuid, p_move_id uuid, p_expected_version integer, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move public.tenancy_moves;
  owner_occupancy_id uuid;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['resident']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['resident']::text[], true);
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  SELECT * INTO move FROM public.tenancy_moves
    WHERE society_id = p_society_id AND id = p_move_id FOR UPDATE;
  IF NOT FOUND OR NOT private.tenancy_is_owner(p_society_id, move.unit_id) THEN
    RAISE EXCEPTION 'Move request not found.' USING ERRCODE = 'P0002';
  END IF;
  IF move.kind = 'move_in' AND move.consented_by = auth.uid()
    AND move.status IN ('pending_review', 'approved', 'completed') AND private.tenancy_consent_valid(move)
  THEN RETURN; END IF;
  PERFORM private.tenancy_assert_version(move.version, p_expected_version);
  IF move.kind <> 'move_in' OR move.status <> 'awaiting_consent' THEN
    RAISE EXCEPTION 'This move cannot receive owner consent.' USING ERRCODE = '23505';
  END IF;
  PERFORM private.tenancy_assert_proofs(move);
  SELECT occupant.id INTO owner_occupancy_id FROM public.unit_occupants AS occupant
  JOIN public.memberships AS membership
    ON membership.society_id = occupant.society_id AND membership.id = occupant.membership_id
  WHERE occupant.society_id = p_society_id AND occupant.unit_id = move.unit_id
    AND occupant.relationship = 'owner' AND occupant.status = 'active'
    AND membership.user_id = auth.uid() AND membership.status = 'active'
  ORDER BY occupant.id LIMIT 1;
  UPDATE public.tenancy_moves
  SET owner_consent_occupancy_id = owner_occupancy_id, consented_at = clock_timestamp(),
    consented_by = auth.uid(), status = 'pending_review', version = version + 1,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = p_move_id;
  PERFORM private.tenancy_event(p_move_id, 'consented', NULL, p_request_id);
END;
$$;

CREATE FUNCTION public.tenancy_move_decide(
  p_society_id uuid, p_move_id uuid, p_decision text, p_expected_version integer,
  p_reason text, p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move public.tenancy_moves;
  is_admin boolean;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin', 'resident']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin', 'resident']::text[], true);
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected', 'cancelled')
    OR (p_decision <> 'approved' AND (
      p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500
    ))
  THEN RAISE EXCEPTION 'Choose a decision and enter its reason.' USING ERRCODE = '22023'; END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  IF p_decision <> 'cancelled' AND NOT is_admin THEN
    RAISE EXCEPTION 'Administrator approval is required.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  SELECT * INTO move FROM public.tenancy_moves
    WHERE society_id = p_society_id AND id = p_move_id FOR UPDATE;
  IF NOT FOUND OR (NOT is_admin AND move.created_by <> auth.uid()) THEN
    RAISE EXCEPTION 'Move request not found.' USING ERRCODE = 'P0002';
  END IF;
  IF move.status = p_decision AND move.updated_by = auth.uid() THEN RETURN; END IF;
  PERFORM private.tenancy_assert_version(move.version, p_expected_version);
  IF move.status NOT IN ('awaiting_consent', 'pending_review', 'approved')
    OR (p_decision = 'approved' AND move.status <> 'pending_review')
    OR (p_decision = 'rejected' AND move.status = 'approved')
  THEN RAISE EXCEPTION 'This move cannot receive that decision.' USING ERRCODE = '23505'; END IF;
  IF p_decision = 'approved' THEN PERFORM private.tenancy_assert_ready(move); END IF;
  UPDATE public.tenancy_moves
  SET status = p_decision, version = version + 1,
    approved_at = CASE WHEN p_decision = 'approved' THEN clock_timestamp() ELSE approved_at END,
    approved_by = CASE WHEN p_decision = 'approved' THEN auth.uid() ELSE approved_by END,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = p_move_id;
  IF p_decision IN ('rejected', 'cancelled') THEN
    UPDATE public.tenancy_documents SET purge_after = clock_timestamp() + interval '30 days'
    WHERE society_id = p_society_id AND move_id = p_move_id AND deleted_at IS NULL;
  END IF;
  PERFORM private.tenancy_event(p_move_id, p_decision,
    CASE WHEN p_decision = 'approved' THEN NULL ELSE btrim(p_reason) END, p_request_id);
  IF p_decision = 'approved' OR (p_decision = 'cancelled' AND move.approved_at IS NOT NULL) THEN
    PERFORM private.create_notification(
      p_society_id, membership.user_id, 'tenancy_schedule',
      CASE WHEN p_decision = 'approved' THEN 'Scheduled move approved' ELSE 'Scheduled move cancelled' END,
      'Check the moving schedule for the current unit, date and time window.',
      'tenancy_schedule', p_move_id, p_request_id
    ) FROM public.memberships AS membership
    WHERE membership.society_id = p_society_id AND membership.status = 'active'
      AND 'guard' = ANY(membership.roles) AND membership.user_id IS NOT NULL;
  END IF;
END;
$$;

CREATE FUNCTION public.tenancy_move_complete(
  p_society_id uuid, p_move_id uuid, p_expected_version integer, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move public.tenancy_moves;
  occupant public.unit_occupants;
  local_today date;
  dues jsonb;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin']::text[], true);
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  SELECT * INTO move FROM public.tenancy_moves
    WHERE society_id = p_society_id AND id = p_move_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Move request not found.' USING ERRCODE = 'P0002'; END IF;
  IF move.status = 'completed' THEN RETURN move.occupancy_id; END IF;
  PERFORM private.tenancy_assert_version(move.version, p_expected_version);
  IF move.status <> 'approved' OR move.starts_at > clock_timestamp() THEN
    RAISE EXCEPTION 'Only an approved move that has started can complete.' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.module_configs
    WHERE society_id = p_society_id AND module_key = 'tenancy' FOR SHARE;
  PERFORM private.tenancy_assert_ready(move);
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships WHERE society_id = p_society_id AND id = move.tenant_membership_id
      AND status = 'active' AND user_id IS NOT NULL AND 'resident' = ANY(roles)
  ) THEN
    RAISE EXCEPTION 'The tenant must complete their Core invitation first.' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.units WHERE society_id = p_society_id AND id = move.unit_id FOR UPDATE;
  SELECT * INTO occupant FROM public.unit_occupants
  WHERE society_id = p_society_id AND id = move.occupancy_id
    AND unit_id = move.unit_id AND membership_id = move.tenant_membership_id
    AND relationship = 'tenant' FOR UPDATE;
  IF NOT FOUND OR occupant.status <> (CASE move.kind WHEN 'move_in' THEN 'pending' ELSE 'active' END) THEN
    RAISE EXCEPTION 'The tenant occupancy has changed.' USING ERRCODE = '23505';
  END IF;
  SELECT (clock_timestamp() AT TIME ZONE timezone)::date INTO local_today
    FROM public.societies WHERE id = p_society_id;
  IF move.kind = 'move_in' THEN
    UPDATE public.tenancy_moves SET completion_in_progress = true WHERE id = p_move_id;
    UPDATE public.unit_occupants SET status = 'active', started_at = local_today, is_approver = true
    WHERE id = move.occupancy_id;
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id, "after", request_id
    ) VALUES (
      p_society_id, auth.uid(), 'admin', 'members.unit.assign', 'unit_occupant', move.occupancy_id::text,
      jsonb_build_object('relationship', 'tenant', 'startedAt', local_today, 'moveId', move.id), p_request_id
    );
  ELSE
    dues := private.tenancy_dues(p_society_id, move.unit_id, true);
    IF dues ->> 'status' = 'pending' THEN
      RAISE EXCEPTION 'Clear outstanding unit dues before completing move-out.' USING ERRCODE = '23514';
    END IF;
    PERFORM public.end_unit_occupancy(p_society_id, move.occupancy_id, local_today, p_request_id);
  END IF;
  UPDATE public.tenancy_moves
  SET status = 'completed', completed_at = clock_timestamp(), completed_by = auth.uid(),
    completion_in_progress = false, version = version + 1,
    updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = p_move_id;
  PERFORM private.tenancy_event(p_move_id, 'completed', NULL, p_request_id);
  RETURN move.occupancy_id;
END;
$$;

CREATE FUNCTION private.tenancy_schedule_file_retention()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  society_timezone text;
BEGIN
  IF NEW.status = 'ended' AND (
    OLD.status IS DISTINCT FROM 'ended' OR NEW.ended_at IS DISTINCT FROM OLD.ended_at
  ) THEN
    SELECT timezone INTO society_timezone FROM public.societies WHERE id = NEW.society_id;
    UPDATE public.tenancy_documents AS document
    SET purge_after = CASE WHEN move.status IN ('rejected', 'cancelled')
      THEN move.updated_at + interval '30 days'
      ELSE ((COALESCE(NEW.ended_at, current_date) + interval '1 year') AT TIME ZONE society_timezone) END
    FROM public.tenancy_moves AS move
    WHERE move.society_id = NEW.society_id AND move.occupancy_id = NEW.id
      AND document.society_id = move.society_id AND document.move_id = move.id AND document.deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_schedule_file_retention()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER tenancy_occupancy_file_retention AFTER UPDATE OF status, ended_at ON public.unit_occupants
  FOR EACH ROW EXECUTE FUNCTION private.tenancy_schedule_file_retention();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tenancy-files', 'tenancy-files', false, 5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']);

CREATE FUNCTION private.tenancy_file_access(p_path text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_society_id uuid;
  target_move_id uuid;
  file_kind text;
  move public.tenancy_moves;
BEGIN
  IF p_path IS NULL OR p_path !~ (
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/moves/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' ||
    '/(rental_agreement|police_verification|noc)/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|pdf)$'
  ) THEN RETURN false; END IF;
  target_society_id := split_part(p_path, '/', 1)::uuid;
  target_move_id := split_part(p_path, '/', 3)::uuid;
  file_kind := split_part(p_path, '/', 4);
  IF auth.uid() IS NULL OR NOT private.module_enabled(target_society_id, 'tenancy')
    OR NOT private.is_member(target_society_id)
    OR NOT EXISTS (SELECT 1 FROM public.societies WHERE id = target_society_id AND status <> 'archived')
    OR NOT private.tenancy_can_read_move(target_society_id, target_move_id)
  THEN RETURN false; END IF;
  SELECT * INTO move FROM public.tenancy_moves AS item
    WHERE item.society_id = target_society_id AND item.id = target_move_id;
  IF p_write THEN
    RETURN private.society_writable(target_society_id)
      AND (
        (file_kind <> 'noc' AND move.kind = 'move_in'
          AND move.status IN ('awaiting_consent', 'pending_review', 'approved')
          AND EXISTS (
            SELECT 1 FROM public.unit_occupants AS occupant
            WHERE occupant.society_id = target_society_id AND occupant.id = move.occupancy_id
              AND occupant.unit_id = move.unit_id AND occupant.membership_id = move.tenant_membership_id
              AND occupant.status <> 'ended'
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.tenancy_documents AS document
            WHERE document.society_id = target_society_id AND document.move_id = target_move_id AND document.kind = file_kind
          ))
        OR (file_kind = 'noc' AND right(p_path, 4) = '.pdf'
          AND private.has_role(target_society_id, ARRAY['admin']::text[])
          AND move.kind = 'move_out' AND move.status = 'completed'
          AND NOT EXISTS (
            SELECT 1 FROM public.tenancy_documents AS document
            WHERE document.society_id = target_society_id AND document.move_id = target_move_id AND document.kind = 'noc'
          ))
      );
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.tenancy_documents AS document
    WHERE document.society_id = target_society_id AND document.move_id = target_move_id AND document.path = p_path
      AND document.deleted_at IS NULL AND (document.purge_after IS NULL OR document.purge_after > clock_timestamp())
  ) OR private.tenancy_file_access(p_path, true);
END;
$$;
REVOKE ALL ON FUNCTION private.tenancy_file_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.tenancy_file_access(text, boolean) TO authenticated;
CREATE POLICY tenancy_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tenancy-files' AND private.tenancy_file_access(name, false));
CREATE POLICY tenancy_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenancy-files' AND private.tenancy_file_access(name, true));

CREATE FUNCTION public.tenancy_document_attach(
  p_society_id uuid, p_move_id uuid, p_kind text, p_path text,
  p_expected_version integer, p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move public.tenancy_moves;
  object_metadata jsonb;
  document_id uuid;
  content_type text;
  size_bytes integer;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin', 'resident']::text[], true);
  PERFORM 1 FROM public.societies WHERE id = p_society_id FOR KEY SHARE;
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin', 'resident']::text[], true);
  PERFORM pg_advisory_xact_lock(hashtextextended('directory:' || p_society_id::text, 0));
  SELECT * INTO move FROM public.tenancy_moves
    WHERE society_id = p_society_id AND id = p_move_id FOR UPDATE;
  IF NOT FOUND OR NOT private.tenancy_can_read_move(p_society_id, p_move_id) THEN
    RAISE EXCEPTION 'Move request not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT id INTO document_id FROM public.tenancy_documents
    WHERE society_id = p_society_id AND move_id = p_move_id AND kind = p_kind AND path = p_path;
  IF FOUND THEN RETURN document_id; END IF;
  PERFORM private.tenancy_assert_version(move.version, p_expected_version);
  IF p_kind IS NULL OR p_kind NOT IN ('rental_agreement', 'police_verification')
    OR NOT private.tenancy_file_access(p_path, true)
    OR split_part(p_path, '/', 1) <> p_society_id::text
    OR split_part(p_path, '/', 3) <> p_move_id::text
    OR split_part(p_path, '/', 4) <> p_kind
  THEN RAISE EXCEPTION 'The tenant proof is not available.' USING ERRCODE = '42501'; END IF;
  SELECT metadata INTO object_metadata FROM storage.objects
    WHERE bucket_id = 'tenancy-files' AND name = p_path
      AND created_at > clock_timestamp() - interval '24 hours';
  IF NOT FOUND THEN RAISE EXCEPTION 'Uploaded tenant proof not found or upload expired.' USING ERRCODE = 'P0002'; END IF;
  content_type := object_metadata ->> 'mimetype';
  IF COALESCE(object_metadata ->> 'size', '') !~ '^[0-9]{1,8}$' THEN
    RAISE EXCEPTION 'The uploaded file size is invalid.' USING ERRCODE = '22023';
  END IF;
  size_bytes := (object_metadata ->> 'size')::integer;
  IF size_bytes NOT BETWEEN 1 AND 5242880 OR content_type IS NULL OR NOT (
    (content_type = 'application/pdf' AND right(p_path, 4) = '.pdf')
    OR (content_type = 'image/jpeg' AND right(p_path, 4) = '.jpg')
    OR (content_type = 'image/png' AND right(p_path, 4) = '.png')
  ) THEN RAISE EXCEPTION 'Use a PDF, JPG or PNG up to 5 MiB.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.tenancy_documents (society_id, move_id, kind, path, content_type, size_bytes, created_by)
  VALUES (p_society_id, p_move_id, p_kind, p_path, content_type, size_bytes, auth.uid())
  RETURNING id INTO document_id;
  UPDATE public.tenancy_moves SET version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
  WHERE id = p_move_id;
  PERFORM private.tenancy_event(p_move_id, 'document_attached', NULL, p_request_id);
  RETURN document_id;
END;
$$;

CREATE FUNCTION private.tenancy_move_summary(p_move public.tenancy_moves)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', p_move.id, 'unit_id', p_move.unit_id,
    'unit_number', (SELECT number FROM public.units WHERE society_id = p_move.society_id AND id = p_move.unit_id),
    'kind', p_move.kind, 'status', p_move.status, 'starts_at', p_move.starts_at,
    'ends_at', p_move.ends_at, 'version', p_move.version,
    'can_view_details', private.tenancy_can_read_move(p_move.society_id, p_move.id)
  )
$$;
REVOKE ALL ON FUNCTION private.tenancy_move_summary(public.tenancy_moves)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.tenancy_moves_page(
  p_society_id uuid, p_status text DEFAULT NULL, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin', 'committee', 'resident', 'guard']::text[], false);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset < 0
    OR (p_status IS NOT NULL AND p_status NOT IN (
      'awaiting_consent', 'pending_review', 'approved', 'rejected', 'cancelled', 'completed'
    ))
  THEN RAISE EXCEPTION 'Choose a valid move status and page.' USING ERRCODE = '22023'; END IF;
  RETURN (
    WITH visible AS (
      SELECT move.* FROM public.tenancy_moves AS move
      WHERE move.society_id = p_society_id AND (p_status IS NULL OR move.status = p_status)
        AND (
          private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
          OR private.tenancy_can_read_move(p_society_id, move.id)
          OR (private.has_role(p_society_id, ARRAY['guard']::text[]) AND move.approved_at IS NOT NULL
            AND move.status IN ('approved', 'cancelled', 'completed'))
        )
    ), page AS (
      SELECT * FROM visible ORDER BY starts_at DESC, id LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_build_object(
      'items', COALESCE((SELECT jsonb_agg(private.tenancy_move_summary(page::public.tenancy_moves) ORDER BY starts_at DESC, id) FROM page), '[]'::jsonb),
      'total', (SELECT count(*) FROM visible), 'limit', p_limit, 'offset', p_offset
    )
  );
END;
$$;

CREATE FUNCTION public.tenancy_move_get(p_society_id uuid, p_move_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  move public.tenancy_moves;
  is_admin boolean;
BEGIN
  PERFORM private.tenancy_authorize(p_society_id, ARRAY['admin', 'resident']::text[], false);
  SELECT * INTO move FROM public.tenancy_moves WHERE society_id = p_society_id AND id = p_move_id;
  IF NOT FOUND OR NOT private.tenancy_can_read_move(p_society_id, p_move_id) THEN
    RAISE EXCEPTION 'Move request not found.' USING ERRCODE = 'P0002';
  END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  RETURN jsonb_build_object(
    'move', private.tenancy_move_summary(move),
    'tenant_membership_id', move.tenant_membership_id,
    'tenant_name', COALESCE((
      SELECT profile.full_name FROM public.memberships AS membership
      JOIN public.profiles AS profile ON profile.id = membership.user_id
      WHERE membership.society_id = p_society_id AND membership.id = move.tenant_membership_id
    ), 'Invited tenant'),
    'agreement_expires_on', move.agreement_expires_on, 'amenity_booking_id', move.amenity_booking_id,
    'completed_at', move.completed_at, 'owner_consent_valid', private.tenancy_consent_valid(move),
    'police_verification_required', private.tenancy_police_required(p_society_id),
    'can_manage', is_admin, 'can_consent', move.kind = 'move_in' AND move.status = 'awaiting_consent'
      AND private.tenancy_is_owner(p_society_id, move.unit_id),
    'can_cancel', move.status IN ('awaiting_consent', 'pending_review', 'approved')
      AND (is_admin OR move.created_by = auth.uid()),
    'documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', document.id, 'kind', document.kind, 'path', document.path,
        'content_type', document.content_type, 'size_bytes', document.size_bytes, 'created_at', document.created_at
      ) ORDER BY document.created_at, document.id)
      FROM public.tenancy_documents AS document WHERE document.society_id = p_society_id
        AND document.move_id = p_move_id AND document.deleted_at IS NULL
        AND (document.purge_after IS NULL OR document.purge_after > clock_timestamp())
    ), '[]'::jsonb),
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', event.id, 'action', event.action, 'status', event.status, 'reason', event.reason,
        'actor_name', COALESCE(profile.full_name, 'System'), 'created_at', event.created_at
      ) ORDER BY event.created_at, event.id)
      FROM public.tenancy_events AS event LEFT JOIN public.profiles AS profile ON profile.id = event.created_by
      WHERE event.society_id = p_society_id AND event.move_id = p_move_id
    ), '[]'::jsonb),
    'dues', CASE WHEN move.kind = 'move_out' THEN private.tenancy_dues(p_society_id, move.unit_id, false) ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tenancy_settings_update(uuid, boolean, text),
  public.tenancy_move_create(uuid, uuid, uuid, text, timestamptz, timestamptz, date, uuid, uuid, text),
  public.tenancy_move_consent(uuid, uuid, integer, text),
  public.tenancy_move_decide(uuid, uuid, text, integer, text, text),
  public.tenancy_move_complete(uuid, uuid, integer, text),
  public.tenancy_document_attach(uuid, uuid, text, text, integer, text),
  public.tenancy_moves_page(uuid, text, integer, integer),
  public.tenancy_move_get(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenancy_settings_update(uuid, boolean, text),
  public.tenancy_move_create(uuid, uuid, uuid, text, timestamptz, timestamptz, date, uuid, uuid, text),
  public.tenancy_move_consent(uuid, uuid, integer, text),
  public.tenancy_move_decide(uuid, uuid, text, integer, text, text),
  public.tenancy_move_complete(uuid, uuid, integer, text),
  public.tenancy_document_attach(uuid, uuid, text, text, integer, text),
  public.tenancy_moves_page(uuid, text, integer, integer),
  public.tenancy_move_get(uuid, uuid)
  TO authenticated;
