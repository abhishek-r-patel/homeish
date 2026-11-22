-- Add P52 tenancy metadata, parking summaries and amenity calendar/activity reads.

CREATE OR REPLACE FUNCTION private.tenancy_settings_valid(p_settings jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_object_keys(p_settings) AS key
      WHERE key NOT IN (
        'police_verification_required',
        'clearance_handover_basis',
        'clearance_agreement_evidence',
        'verification_tracking_enabled'
      )
    )
    AND (
      NOT p_settings ? 'police_verification_required'
      OR jsonb_typeof(p_settings -> 'police_verification_required') = 'boolean'
    )
    AND (
      NOT p_settings ? 'verification_tracking_enabled'
      OR jsonb_typeof(p_settings -> 'verification_tracking_enabled') = 'boolean'
    )
    AND (
      NOT p_settings ? 'clearance_handover_basis'
      OR p_settings ->> 'clearance_handover_basis' IN ('bills', 'total')
    )
    AND (
      NOT p_settings ? 'clearance_agreement_evidence'
      OR p_settings ->> 'clearance_agreement_evidence' IN (
        'admin_note',
        'signed_upload',
        'in_app_and_upload'
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.tenancy_settings_update(
  p_society_id uuid,
  p_police_verification_required boolean,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_settings jsonb;
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id,
    ARRAY['admin']::text[],
    true
  );
  PERFORM 1
  FROM public.societies
  WHERE id = p_society_id
  FOR KEY SHARE;
  IF p_police_verification_required IS NULL THEN
    RAISE EXCEPTION 'Choose whether police proof is required.'
      USING ERRCODE = '22023';
  END IF;

  SELECT settings INTO current_settings
  FROM public.module_configs
  WHERE society_id = p_society_id
    AND module_key = 'tenancy'
  FOR UPDATE;

  UPDATE public.module_configs
  SET settings = jsonb_set(
      COALESCE(current_settings, '{}'::jsonb),
      '{police_verification_required}',
      to_jsonb(p_police_verification_required)
    ),
    updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id
    AND module_key = 'tenancy';

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "after",
    request_id
  )
  VALUES (
    p_society_id,
    auth.uid(),
    'admin',
    'tenancy.settings.update',
    'module',
    'tenancy',
    jsonb_build_object(
      'police_verification_required',
      p_police_verification_required
    ),
    p_request_id
  );
END;
$$;

CREATE FUNCTION public.tenancy_verification_settings_update(
  p_society_id uuid,
  p_verification_tracking_enabled boolean,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_settings jsonb;
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id,
    ARRAY['admin']::text[],
    true
  );
  PERFORM 1
  FROM public.societies
  WHERE id = p_society_id
  FOR KEY SHARE;
  IF p_verification_tracking_enabled IS NULL
    OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose verification tracking and provide a request reference.'
      USING ERRCODE = '22023';
  END IF;

  SELECT settings INTO current_settings
  FROM public.module_configs
  WHERE society_id = p_society_id
    AND module_key = 'tenancy'
  FOR UPDATE;

  UPDATE public.module_configs
  SET settings = jsonb_set(
      COALESCE(current_settings, '{}'::jsonb),
      '{verification_tracking_enabled}',
      to_jsonb(p_verification_tracking_enabled)
    ),
    updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id
    AND module_key = 'tenancy';

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "after",
    request_id
  )
  VALUES (
    p_society_id,
    auth.uid(),
    'admin',
    'tenancy.verification_settings.update',
    'module',
    'tenancy',
    jsonb_build_object(
      'verification_tracking_enabled',
      p_verification_tracking_enabled
    ),
    p_request_id
  );
END;
$$;

CREATE FUNCTION public.tenancy_settings_update(
  p_society_id uuid,
  p_police_verification_required boolean,
  p_clearance_handover_basis text,
  p_clearance_agreement_evidence text,
  p_verification_tracking_enabled boolean,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_settings jsonb;
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id,
    ARRAY['admin']::text[],
    true
  );
  PERFORM 1
  FROM public.societies
  WHERE id = p_society_id
  FOR KEY SHARE;
  IF p_police_verification_required IS NULL
    OR p_clearance_handover_basis IS NULL
    OR p_clearance_handover_basis NOT IN ('bills', 'total')
    OR p_clearance_agreement_evidence IS NULL
    OR p_clearance_agreement_evidence NOT IN (
      'admin_note',
      'signed_upload',
      'in_app_and_upload'
    )
    OR p_verification_tracking_enabled IS NULL
    OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose valid Tenancy settings.'
      USING ERRCODE = '22023';
  END IF;
  SELECT settings || jsonb_build_object(
    'police_verification_required',
    p_police_verification_required,
    'clearance_handover_basis',
    p_clearance_handover_basis,
    'clearance_agreement_evidence',
    p_clearance_agreement_evidence,
    'verification_tracking_enabled',
    p_verification_tracking_enabled
  )
  INTO next_settings
  FROM public.module_configs
  WHERE society_id = p_society_id
    AND module_key = 'tenancy'
  FOR UPDATE;
  UPDATE public.module_configs
  SET settings = next_settings,
      updated_by = auth.uid(),
      updated_at = clock_timestamp()
  WHERE society_id = p_society_id
    AND module_key = 'tenancy';
  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "after",
    request_id
  )
  VALUES (
    p_society_id,
    auth.uid(),
    'admin',
    'tenancy.settings.update',
    'module',
    'tenancy',
    next_settings,
    p_request_id
  );
END;
$$;

ALTER TABLE public.tenancy_moves
  ADD COLUMN verification_status text,
  ADD COLUMN verification_checked_on date,
  ADD COLUMN verification_reference text,
  ADD COLUMN agreement_type text,
  ADD COLUMN agreement_starts_on date;

ALTER TABLE public.tenancy_moves
  ADD CONSTRAINT tenancy_moves_verification_check CHECK (
    verification_status IS NULL
      OR verification_status IN ('pending', 'verified', 'rejected')
  ),
  ADD CONSTRAINT tenancy_moves_verification_date_check CHECK (
    verification_status IS NOT NULL
      OR (
        verification_checked_on IS NULL
        AND verification_reference IS NULL
      )
  ),
  ADD CONSTRAINT tenancy_moves_verification_reference_check CHECK (
    verification_reference IS NULL
    OR (
      char_length(btrim(verification_reference)) BETWEEN 1 AND 120
      AND verification_reference = btrim(verification_reference)
    )
  ),
  ADD CONSTRAINT tenancy_moves_agreement_type_check CHECK (
    agreement_type IS NULL
    OR agreement_type IN (
      'rental',
      'leave_and_licence',
      'company_lease',
      'paying_guest',
      'other'
    )
  ),
  ADD CONSTRAINT tenancy_moves_agreement_dates_check CHECK (
    (
      agreement_type IS NULL
      AND agreement_starts_on IS NULL
    )
    OR (
      kind = 'move_in'
      AND agreement_type IS NOT NULL
      AND agreement_starts_on IS NOT NULL
      AND (
        agreement_expires_on IS NULL
        OR agreement_starts_on <= agreement_expires_on
      )
    )
  );

CREATE FUNCTION public.tenancy_verification_save(
  p_society_id uuid,
  p_move_id uuid,
  p_expected_version integer,
  p_verification_status text,
  p_verification_checked_on date,
  p_verification_reference text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  move public.tenancy_moves;
  reference_text text := NULLIF(btrim(COALESCE(p_verification_reference, '')), '');
  tracking_enabled boolean;
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id,
    ARRAY['admin']::text[],
    true
  );
  SELECT COALESCE(
      (settings ->> 'verification_tracking_enabled')::boolean,
      false
    )
  INTO tracking_enabled
  FROM public.module_configs
  WHERE society_id = p_society_id
    AND module_key = 'tenancy';

  IF NOT tracking_enabled THEN
    RAISE EXCEPTION 'Verification tracking is disabled.'
      USING ERRCODE = '23514';
  END IF;
  IF p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
    OR p_verification_status IS NULL
    OR p_verification_status NOT IN ('pending', 'verified', 'rejected')
    OR reference_text IS NOT NULL AND char_length(reference_text) > 120
  THEN
    RAISE EXCEPTION 'Check the verification status and reference.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO move
  FROM public.tenancy_moves
  WHERE society_id = p_society_id
    AND id = p_move_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Move request not found.'
      USING ERRCODE = 'P0002';
  END IF;
  PERFORM private.tenancy_assert_version(move.version, p_expected_version);

  UPDATE public.tenancy_moves
  SET verification_status = p_verification_status,
      verification_checked_on = p_verification_checked_on,
      verification_reference = reference_text,
      version = version + 1,
      updated_at = clock_timestamp(),
      updated_by = auth.uid()
  WHERE id = move.id;

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "after",
    request_id
  )
  VALUES (
    p_society_id,
    auth.uid(),
    'admin',
    'tenancy.verification.update',
    'tenancy_move',
    move.id::text,
    jsonb_build_object(
      'status', p_verification_status,
      'checked_on', p_verification_checked_on,
      'has_reference', reference_text IS NOT NULL
    ),
    p_request_id
  );
END;
$$;

CREATE FUNCTION public.tenancy_agreement_metadata_save(
  p_society_id uuid,
  p_move_id uuid,
  p_expected_version integer,
  p_agreement_type text,
  p_agreement_starts_on date,
  p_agreement_expires_on date,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  move public.tenancy_moves;
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id,
    ARRAY['admin']::text[],
    true
  );
  IF p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
    OR (
      (p_agreement_type IS NULL) <>
      (p_agreement_starts_on IS NULL)
    )
    OR (
      p_agreement_type IS NOT NULL
      AND p_agreement_type NOT IN (
        'rental',
        'leave_and_licence',
        'company_lease',
        'paying_guest',
        'other'
      )
    )
    OR p_agreement_starts_on IS NOT NULL
      AND p_agreement_expires_on IS NOT NULL
      AND p_agreement_starts_on > p_agreement_expires_on
  THEN
    RAISE EXCEPTION 'Check the agreement metadata.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO move
  FROM public.tenancy_moves
  WHERE society_id = p_society_id
    AND id = p_move_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Move request not found.'
      USING ERRCODE = 'P0002';
  END IF;
  PERFORM private.tenancy_assert_version(move.version, p_expected_version);
  IF move.kind <> 'move_in' THEN
    RAISE EXCEPTION 'Agreement metadata is available for move-ins only.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.tenancy_moves
  SET agreement_type = p_agreement_type,
      agreement_starts_on = p_agreement_starts_on,
      agreement_expires_on = p_agreement_expires_on,
      version = version + 1,
      updated_at = clock_timestamp(),
      updated_by = auth.uid()
  WHERE id = move.id;

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "after",
    request_id
  )
  VALUES (
    p_society_id,
    auth.uid(),
    'admin',
    'tenancy.agreement_metadata.update',
    'tenancy_move',
    move.id::text,
    jsonb_build_object(
      'agreement_type', p_agreement_type,
      'agreement_starts_on', p_agreement_starts_on,
      'agreement_expires_on', p_agreement_expires_on
    ),
    p_request_id
  );
END;
$$;

CREATE FUNCTION public.tenancy_move_progress_get(
  p_society_id uuid,
  p_move_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  move public.tenancy_moves;
  occupancy_status text;
  tracking_enabled boolean := false;
  proof_complete boolean := false;
BEGIN
  PERFORM private.tenancy_authorize(
    p_society_id,
    ARRAY['admin', 'resident']::text[],
    false
  );
  SELECT * INTO move
  FROM public.tenancy_moves
  WHERE society_id = p_society_id
    AND id = p_move_id;
  IF NOT FOUND OR NOT private.tenancy_can_read_move(p_society_id, p_move_id) THEN
    RAISE EXCEPTION 'Move request not found.'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT occupant.status INTO occupancy_status
  FROM public.unit_occupants AS occupant
  WHERE occupant.society_id = p_society_id
    AND occupant.id = move.occupancy_id;

  SELECT COALESCE(
      (settings ->> 'verification_tracking_enabled')::boolean,
      false
    )
  INTO tracking_enabled
  FROM public.module_configs
  WHERE society_id = p_society_id
    AND module_key = 'tenancy';

  proof_complete := (
    move.kind = 'move_out'
    OR EXISTS (
      SELECT 1
      FROM public.tenancy_documents AS document
      WHERE document.society_id = p_society_id
        AND document.move_id = move.id
        AND document.kind = 'rental_agreement'
        AND document.deleted_at IS NULL
        AND (
          document.purge_after IS NULL
          OR document.purge_after > clock_timestamp()
        )
    ) AND (
      NOT private.tenancy_police_required(p_society_id)
      OR EXISTS (
        SELECT 1
        FROM public.tenancy_documents AS document
        WHERE document.society_id = p_society_id
          AND document.move_id = move.id
          AND document.kind = 'police_verification'
          AND document.deleted_at IS NULL
          AND (
            document.purge_after IS NULL
            OR document.purge_after > clock_timestamp()
          )
      )
    )
  );

  RETURN jsonb_build_object(
    'move_id', move.id,
    'version', move.version,
    'steps', jsonb_build_array(
      jsonb_build_object(
        'key', 'request_recorded',
        'state', 'complete',
        'at', move.created_at
      ),
      jsonb_build_object(
        'key', 'owner_consent',
        'state', CASE
          WHEN move.kind = 'move_out' THEN 'not_required'
          WHEN move.consented_at IS NOT NULL THEN 'complete'
          ELSE 'pending'
        END,
        'at', move.consented_at
      ),
      jsonb_build_object(
        'key', 'required_proofs',
        'state', CASE
          WHEN move.kind = 'move_out' THEN 'not_required'
          WHEN proof_complete THEN 'complete'
          ELSE 'pending'
        END,
        'at', NULL
      ),
      jsonb_build_object(
        'key', 'verification',
        'state', CASE
          WHEN NOT tracking_enabled THEN 'not_required'
          WHEN move.verification_status = 'verified' THEN 'complete'
          WHEN move.verification_status = 'rejected' THEN 'blocked'
          ELSE 'pending'
        END,
        'at', CASE
          WHEN tracking_enabled THEN move.verification_checked_on
          ELSE NULL
        END
      ),
      jsonb_build_object(
        'key', 'admin_scheduled',
        'state', CASE
          WHEN move.approved_at IS NOT NULL THEN 'complete'
          WHEN move.status IN ('rejected', 'cancelled') THEN 'blocked'
          ELSE 'pending'
        END,
        'at', move.approved_at
      ),
      jsonb_build_object(
        'key', 'actual_completion',
        'state', CASE
          WHEN move.completed_at IS NOT NULL THEN 'complete'
          WHEN move.status IN ('rejected', 'cancelled') THEN 'blocked'
          ELSE 'pending'
        END,
        'at', move.completed_at
      ),
      jsonb_build_object(
        'key', 'core_occupancy',
        'state', CASE
          WHEN occupancy_status IS NULL THEN 'pending'
          WHEN move.kind = 'move_in' AND occupancy_status = 'active'
            THEN 'complete'
          WHEN move.kind = 'move_out' AND occupancy_status = 'ended'
            THEN 'complete'
          ELSE 'pending'
        END,
        'at', move.completed_at
      )
    ),
    'verification_tracking_enabled', tracking_enabled,
    'verification', CASE WHEN tracking_enabled THEN
      jsonb_build_object(
        'status', move.verification_status,
        'checked_on', move.verification_checked_on,
        'reference', move.verification_reference
      )
      ELSE jsonb_build_object(
        'status', NULL,
        'checked_on', NULL,
        'reference', NULL
      )
    END,
    'agreement', jsonb_build_object(
      'type', move.agreement_type,
      'starts_on', move.agreement_starts_on,
      'expires_on', move.agreement_expires_on
    )
  );
END;
$$;

ALTER TABLE public.parking_slots
  ADD COLUMN condition_status text NOT NULL DEFAULT 'available';
ALTER TABLE public.parking_slots
  ADD CONSTRAINT parking_slots_condition_status_check
    CHECK (
      condition_status IN (
        'available',
        'needs_attention',
        'out_of_service'
      )
    );
CREATE INDEX parking_slots_condition_idx
  ON public.parking_slots (society_id, condition_status)
  WHERE archived_at IS NULL;

CREATE FUNCTION public.parking_condition_set(
  p_society_id uuid,
  p_slot_id uuid,
  p_condition_status text,
  p_expected_version integer,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  slot public.parking_slots;
BEGIN
  PERFORM private.parking_write_begin(
    p_society_id,
    ARRAY['admin']::text[]
  );
  IF p_condition_status IS NULL
    OR p_condition_status NOT IN (
      'available',
      'needs_attention',
      'out_of_service'
    )
    OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose a valid parking slot condition.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO slot
  FROM public.parking_slots
  WHERE society_id = p_society_id
    AND id = p_slot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parking slot not found.'
      USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR slot.version <> p_expected_version THEN
    RAISE EXCEPTION 'This slot changed. Refresh before trying again.'
      USING ERRCODE = '40001';
  END IF;
  IF slot.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Archived slots cannot be updated.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.parking_slots
  SET condition_status = p_condition_status,
      version = version + 1,
      updated_at = clock_timestamp(),
      updated_by = auth.uid()
  WHERE id = slot.id;

  PERFORM private.parking_audit(
    p_society_id,
    'admin',
    'slot.condition.update',
    'parking_slot',
    slot.id,
    jsonb_build_object(
      'condition_status', p_condition_status,
      'version', slot.version + 1
    ),
    p_request_id
  );
END;
$$;

CREATE FUNCTION public.parking_summary(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.parking_authorize(
    p_society_id,
    ARRAY['admin', 'committee']::text[],
    false
  );
  RETURN (
    WITH live_slots AS (
      SELECT slot.*,
        EXISTS (
          SELECT 1
          FROM public.parking_allocations AS allocation
          WHERE allocation.society_id = slot.society_id
            AND allocation.slot_id = slot.id
            AND allocation.ended_at IS NULL
        ) AS allocated,
        (
          SELECT count(*)
          FROM public.parking_vehicle_links AS link
          JOIN public.parking_allocations AS allocation
            ON allocation.society_id = link.society_id
            AND allocation.id = link.allocation_id
          WHERE allocation.society_id = slot.society_id
            AND allocation.slot_id = slot.id
            AND allocation.ended_at IS NULL
            AND link.ended_at IS NULL
        ) AS vehicle_count
      FROM public.parking_slots AS slot
      WHERE slot.society_id = p_society_id
        AND slot.archived_at IS NULL
    ),
    by_type AS (
      SELECT slot_type,
        count(*) AS slot_count,
        count(*) FILTER (
          WHERE slot_type <> 'visitor' AND NOT allocated
        ) AS vacant_count,
        count(*) FILTER (
          WHERE slot_type <> 'visitor' AND allocated
        ) AS allocated_count,
        COALESCE(sum(vehicle_count), 0) AS vehicle_count
      FROM live_slots
      GROUP BY slot_type
    )
    SELECT jsonb_build_object(
      'slots_total', (SELECT count(*) FROM live_slots),
      'vacant_slots', (
        SELECT count(*)
        FROM live_slots
        WHERE slot_type <> 'visitor' AND NOT allocated
      ),
      'allocated_slots', (
        SELECT count(*)
        FROM live_slots
        WHERE slot_type <> 'visitor' AND allocated
      ),
      'vehicle_count', (
        SELECT COALESCE(sum(vehicle_count), 0)
        FROM live_slots
      ),
      'condition_counts', jsonb_build_object(
        'available', (
          SELECT count(*)
          FROM live_slots
          WHERE condition_status = 'available'
        ),
        'needs_attention', (
          SELECT count(*)
          FROM live_slots
          WHERE condition_status = 'needs_attention'
        ),
        'out_of_service', (
          SELECT count(*)
          FROM live_slots
          WHERE condition_status = 'out_of_service'
        )
      ),
      'by_slot_type', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'slot_type', slot_type,
          'slot_count', slot_count,
          'vacant_count', vacant_count,
          'allocated_count', allocated_count,
          'vehicle_count', vehicle_count
        ) ORDER BY slot_type)
        FROM by_type
      ), '[]'::jsonb)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.parking_admin_workspace(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.parking_authorize(
    p_society_id,
    ARRAY['admin', 'committee']::text[],
    false
  );
  RETURN jsonb_build_object(
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[]),
    'directory_enabled', private.module_enabled(p_society_id, 'directory'),
    'visitor_enabled', private.module_enabled(p_society_id, 'visitor'),
    'settings', jsonb_build_object(
      'photo_retention_days',
      private.parking_photo_retention_days(p_society_id)
    ),
    'slots', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', slot.id,
        'label', slot.label,
        'slot_type', slot.slot_type,
        'condition_status', slot.condition_status,
        'location_note', slot.location_note,
        'archived_at', slot.archived_at,
        'version', slot.version,
        'allocation', (
          SELECT private.parking_allocation_json(allocation)
          FROM public.parking_allocations AS allocation
          WHERE allocation.slot_id = slot.id
            AND allocation.ended_at IS NULL
        )
      ) ORDER BY slot.archived_at IS NOT NULL, lower(slot.label))
      FROM (
        SELECT *
        FROM public.parking_slots AS item
        WHERE item.society_id = p_society_id
        ORDER BY item.archived_at IS NOT NULL, lower(item.label)
        LIMIT 500
      ) AS slot
    ), '[]'::jsonb),
    'units', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', unit.id,
        'number', unit.number
      ) ORDER BY unit.number)
      FROM public.units AS unit
      WHERE unit.society_id = p_society_id
        AND unit.active
    ), '[]'::jsonb),
    'queues', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', queued.id,
        'unit_id', queued.unit_id,
        'unit_number', queued.unit_number,
        'slot_type', queued.slot_type,
        'note', queued.note,
        'created_at', queued.created_at,
        'queue_position', queued.queue_position
      ) ORDER BY queued.slot_type, queued.queue_position)
      FROM (
        SELECT request.*,
          unit.number AS unit_number,
          row_number() OVER (
            PARTITION BY request.slot_type
            ORDER BY request.queue_seq
          ) AS queue_position
        FROM public.parking_requests AS request
        JOIN public.units AS unit
          ON unit.id = request.unit_id
        WHERE request.society_id = p_society_id
          AND request.status = 'waiting'
      ) AS queued
    ), '[]'::jsonb),
    'passes', COALESCE((
      SELECT jsonb_agg(private.parking_pass_json(pass) ORDER BY pass.starts_at)
      FROM public.parking_visitor_passes AS pass
      WHERE pass.society_id = p_society_id
        AND pass.status = 'active'
        AND pass.ends_at > clock_timestamp()
    ), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(
        private.parking_report_json(report)
        ORDER BY report.created_at DESC
      )
      FROM (
        SELECT *
        FROM public.parking_reports AS item
        WHERE item.society_id = p_society_id
        ORDER BY item.status = 'open' DESC, item.created_at DESC
        LIMIT 100
      ) AS report
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION private.amenity_settings_valid(p_settings jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_typeof(p_settings) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_object_keys(p_settings) AS key
      WHERE key <> 'resident_calendar_identity'
    )
    AND (
      NOT p_settings ? 'resident_calendar_identity'
      OR (
        jsonb_typeof(p_settings -> 'resident_calendar_identity') = 'string'
        AND p_settings ->> 'resident_calendar_identity' IN (
          'availability_only',
          'booker_name',
          'booker_name_and_unit'
        )
      )
    )
$$;
REVOKE ALL ON FUNCTION private.amenity_settings_valid(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.amenity_settings_valid(jsonb)
  TO authenticated, service_role;

ALTER TABLE public.module_configs
  ADD CONSTRAINT module_configs_amenity_settings_check
  CHECK (
    module_key <> 'amenity'
    OR private.amenity_settings_valid(settings)
  );

CREATE FUNCTION private.amenity_resident_calendar_identity(p_society_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT settings ->> 'resident_calendar_identity'
    FROM public.module_configs
    WHERE society_id = p_society_id
      AND module_key = 'amenity'
  ), 'availability_only')
$$;
REVOKE ALL ON FUNCTION private.amenity_resident_calendar_identity(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.amenity_calendar_settings_get(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.amenity_authorize(p_society_id, false, false);
  IF NOT private.has_role(
      p_society_id,
      ARRAY['admin', 'committee']::text[]
    )
  THEN
    RAISE EXCEPTION 'Amenity calendar settings are not available.'
      USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'resident_calendar_identity',
      private.amenity_resident_calendar_identity(p_society_id),
    'directory_enabled', private.module_enabled(p_society_id, 'directory'),
    'can_manage', private.has_role(
      p_society_id,
      ARRAY['admin']::text[]
    )
  );
END;
$$;

CREATE FUNCTION public.amenity_calendar_visibility_save(
  p_society_id uuid,
  p_resident_calendar_identity text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_settings jsonb;
BEGIN
  PERFORM private.amenity_authorize(p_society_id, true, true);
  IF p_resident_calendar_identity IS NULL
    OR p_resident_calendar_identity NOT IN (
      'availability_only',
      'booker_name',
      'booker_name_and_unit'
    )
    OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose a valid resident calendar identity setting.'
      USING ERRCODE = '22023';
  END IF;

  SELECT settings INTO current_settings
  FROM public.module_configs
  WHERE society_id = p_society_id
    AND module_key = 'amenity'
  FOR UPDATE;

  UPDATE public.module_configs
  SET settings = jsonb_set(
      COALESCE(current_settings, '{}'::jsonb),
      '{resident_calendar_identity}',
      to_jsonb(p_resident_calendar_identity)
    ),
    updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id
    AND module_key = 'amenity';

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "after",
    request_id
  )
  VALUES (
    p_society_id,
    auth.uid(),
    'admin',
    'amenity.calendar_settings.update',
    'module',
    'amenity',
    jsonb_build_object(
      'resident_calendar_identity',
      p_resident_calendar_identity
    ),
    p_request_id
  );
END;
$$;

CREATE FUNCTION public.amenity_calendar_month(
  p_society_id uuid,
  p_month date,
  p_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  zone text;
  first_day date;
  next_month date;
  identity_mode text;
  directory_enabled boolean;
BEGIN
  PERFORM private.amenity_authorize(p_society_id, false, false);
  IF p_month IS NULL
    OR p_limit IS NULL
    OR p_limit NOT BETWEEN 1 AND 500
  THEN
    RAISE EXCEPTION 'Choose a month and a valid result limit.'
      USING ERRCODE = '22023';
  END IF;
  SELECT timezone INTO zone
  FROM public.societies
  WHERE id = p_society_id;
  first_day := date_trunc('month', p_month)::date;
  next_month := (first_day + interval '1 month')::date;
  identity_mode := private.amenity_resident_calendar_identity(p_society_id);
  directory_enabled := private.module_enabled(p_society_id, 'directory');

  RETURN jsonb_build_object(
    'month', to_char(first_day, 'YYYY-MM'),
    'timezone', zone,
    'identity_mode', identity_mode,
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'amenity_id', booking.amenity_id,
          'amenity_name', booking.amenity_name,
          'starts_at', booking.starts_at,
          'ends_at', booking.ends_at,
          'booker_name', CASE
            WHEN NOT directory_enabled
              OR identity_mode = 'availability_only'
              OR NOT COALESCE(preference.name_visible, true)
            THEN NULL
            ELSE profile.full_name
          END,
          'unit_number', CASE
            WHEN NOT directory_enabled
              OR identity_mode <> 'booker_name_and_unit'
              OR NOT COALESCE(preference.unit_visible, true)
            THEN NULL
            ELSE unit.number
          END,
          'overlap_warning', EXISTS (
            SELECT 1
            FROM public.amenity_bookings AS overlap
            WHERE overlap.society_id = booking.society_id
              AND overlap.id <> booking.id
              AND overlap.amenity_id = booking.amenity_id
              AND overlap.status = 'confirmed'
              AND overlap.booking_span && booking.booking_span
          )
        )
        ORDER BY booking.starts_at, booking.amenity_id
      )
      FROM (
        SELECT item.*
        FROM public.amenity_bookings AS item
        WHERE item.society_id = p_society_id
          AND item.status = 'confirmed'
          AND item.starts_at < next_month AT TIME ZONE zone
          AND item.ends_at > first_day AT TIME ZONE zone
        ORDER BY item.starts_at, item.id
        LIMIT p_limit
      ) AS booking
      JOIN public.profiles AS profile
        ON profile.id = booking.booked_by
      JOIN public.units AS unit
        ON unit.society_id = booking.society_id
        AND unit.id = booking.unit_id
      LEFT JOIN public.memberships AS membership
        ON membership.society_id = booking.society_id
        AND membership.user_id = booking.booked_by
        AND membership.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM public.unit_occupants AS occupant
          WHERE occupant.society_id = booking.society_id
            AND occupant.unit_id = booking.unit_id
            AND occupant.membership_id = membership.id
            AND occupant.status = 'active'
        )
      LEFT JOIN public.directory_preferences AS preference
        ON preference.society_id = booking.society_id
        AND preference.membership_id = membership.id
    ), '[]'::jsonb)
  );
END;
$$;

ALTER TABLE public.amc_visits
  ADD CONSTRAINT amc_visits_society_id_id_key
    UNIQUE (society_id, id);

CREATE TABLE public.amenity_activity_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL
    REFERENCES public.societies (id) ON DELETE RESTRICT,
  source_kind text NOT NULL,
  amenity_booking_id uuid,
  asset_id uuid,
  amc_visit_id uuid,
  service_request_id uuid,
  activity_kind text NOT NULL,
  event_at timestamptz NOT NULL,
  note text,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT amenity_activity_source_kind_check CHECK (
    source_kind IN (
      'amenity_booking',
      'asset',
      'amc_visit',
      'service_request'
    )
  ),
  CONSTRAINT amenity_activity_source_check CHECK (
    (
      source_kind = 'amenity_booking'
      AND amenity_booking_id IS NOT NULL
      AND asset_id IS NULL
      AND amc_visit_id IS NULL
      AND service_request_id IS NULL
    )
    OR (
      source_kind = 'asset'
      AND amenity_booking_id IS NULL
      AND asset_id IS NOT NULL
      AND amc_visit_id IS NULL
      AND service_request_id IS NULL
    )
    OR (
      source_kind = 'amc_visit'
      AND amenity_booking_id IS NULL
      AND asset_id IS NULL
      AND amc_visit_id IS NOT NULL
      AND service_request_id IS NULL
    )
    OR (
      source_kind = 'service_request'
      AND amenity_booking_id IS NULL
      AND asset_id IS NULL
      AND amc_visit_id IS NULL
      AND service_request_id IS NOT NULL
    )
  ),
  CONSTRAINT amenity_activity_booking_fkey
    FOREIGN KEY (society_id, amenity_booking_id)
    REFERENCES public.amenity_bookings (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT amenity_activity_asset_fkey
    FOREIGN KEY (society_id, asset_id)
    REFERENCES public.assets (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT amenity_activity_amc_visit_fkey
    FOREIGN KEY (society_id, amc_visit_id)
    REFERENCES public.amc_visits (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT amenity_activity_service_request_fkey
    FOREIGN KEY (society_id, service_request_id)
    REFERENCES public.service_requests (society_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT amenity_activity_kind_check CHECK (
    activity_kind IN ('use', 'issue')
  ),
  CONSTRAINT amenity_activity_note_check CHECK (
    note IS NULL
    OR (
      char_length(btrim(note)) BETWEEN 1 AND 500
      AND note = btrim(note)
    )
  ),
  CONSTRAINT amenity_activity_society_id_id_key
    UNIQUE (society_id, id),
  CONSTRAINT amenity_activity_actor_request_key
    UNIQUE (society_id, created_by, client_request_id)
);
CREATE INDEX amenity_activity_society_event_idx
  ON public.amenity_activity_records (society_id, event_at DESC, id);
CREATE INDEX amenity_activity_booking_idx
  ON public.amenity_activity_records (society_id, amenity_booking_id);
CREATE INDEX amenity_activity_asset_idx
  ON public.amenity_activity_records (society_id, asset_id);
CREATE INDEX amenity_activity_amc_idx
  ON public.amenity_activity_records (society_id, amc_visit_id);
CREATE INDEX amenity_activity_request_idx
  ON public.amenity_activity_records (society_id, service_request_id);
CREATE INDEX amenity_activity_created_by_idx
  ON public.amenity_activity_records (created_by);

ALTER TABLE public.amenity_activity_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.amenity_activity_records
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY amenity_activity_records_no_direct_access
  ON public.amenity_activity_records
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
CREATE TRIGGER amenity_activity_records_no_update
  BEFORE UPDATE OR DELETE ON public.amenity_activity_records
  FOR EACH ROW EXECUTE FUNCTION private.reject_append_only_mutation();
CREATE TRIGGER amenity_activity_records_no_truncate
  BEFORE TRUNCATE ON public.amenity_activity_records
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_append_only_mutation();

CREATE FUNCTION private.amenity_activity_source_available(
  p_society_id uuid,
  p_source_kind text,
  p_source_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE p_source_kind
    WHEN 'amenity_booking' THEN
      private.module_enabled(p_society_id, 'amenity')
      AND EXISTS (
        SELECT 1
        FROM public.amenity_bookings
        WHERE society_id = p_society_id
          AND id = p_source_id
      )
    WHEN 'asset' THEN
      private.module_enabled(p_society_id, 'asset')
      AND EXISTS (
        SELECT 1
        FROM public.assets
        WHERE society_id = p_society_id
          AND id = p_source_id
      )
    WHEN 'amc_visit' THEN
      private.module_enabled(p_society_id, 'amc')
      AND EXISTS (
        SELECT 1
        FROM public.amc_visits
        WHERE society_id = p_society_id
          AND id = p_source_id
      )
    WHEN 'service_request' THEN
      private.module_enabled(p_society_id, 'service_request')
      AND EXISTS (
        SELECT 1
        FROM public.service_requests
        WHERE society_id = p_society_id
          AND id = p_source_id
      )
    ELSE false
  END
$$;
REVOKE ALL ON FUNCTION private.amenity_activity_source_available(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.amenity_activity_record(
  p_society_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_activity_kind text,
  p_occurred_at_local text,
  p_note text,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  society_timezone text;
  occurred_at_local timestamp;
  event_at timestamptz;
  existing public.amenity_activity_records;
  activity_id uuid;
BEGIN
  PERFORM private.amenity_authorize(p_society_id, true, true);
  IF p_source_kind IS NULL
    OR p_source_kind NOT IN (
      'amenity_booking',
      'asset',
      'amc_visit',
      'service_request'
    )
    OR p_source_id IS NULL
    OR p_activity_kind IS NULL
    OR p_activity_kind NOT IN ('use', 'issue')
    OR p_occurred_at_local IS NULL
    OR p_occurred_at_local !~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'
    OR clean_note IS NOT NULL AND char_length(clean_note) > 500
    OR p_client_request_id IS NULL
    OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Check the activity source, time, kind and note.'
      USING ERRCODE = '22023';
  END IF;
  SELECT timezone INTO society_timezone
  FROM public.societies
  WHERE id = p_society_id;
  BEGIN
    occurred_at_local := p_occurred_at_local::timestamp;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Choose a valid local activity time.'
      USING ERRCODE = '22023';
  END;
  event_at := occurred_at_local AT TIME ZONE society_timezone;
  IF event_at > clock_timestamp() + interval '5 minutes'
    OR (event_at AT TIME ZONE society_timezone)::timestamp
      IS DISTINCT FROM occurred_at_local
  THEN
    RAISE EXCEPTION 'Choose a valid society-local activity time.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT private.amenity_activity_source_available(
      p_society_id,
      p_source_kind,
      p_source_id
    )
  THEN
    RAISE EXCEPTION 'The linked activity source is not available.'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO existing
  FROM public.amenity_activity_records
  WHERE society_id = p_society_id
    AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF ROW(
        existing.source_kind,
        CASE existing.source_kind
          WHEN 'amenity_booking' THEN existing.amenity_booking_id
          WHEN 'asset' THEN existing.asset_id
          WHEN 'amc_visit' THEN existing.amc_visit_id
          ELSE existing.service_request_id
        END,
        existing.activity_kind,
        existing.event_at,
        existing.note
      ) IS DISTINCT FROM ROW(
        p_source_kind,
        p_source_id,
        p_activity_kind,
        event_at,
        clean_note
      )
    THEN
      RAISE EXCEPTION 'Retry details changed.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing.id;
  END IF;

  INSERT INTO public.amenity_activity_records (
    society_id,
    source_kind,
    amenity_booking_id,
    asset_id,
    amc_visit_id,
    service_request_id,
    activity_kind,
    event_at,
    note,
    client_request_id,
    created_by
  )
  VALUES (
    p_society_id,
    p_source_kind,
    CASE
      WHEN p_source_kind = 'amenity_booking' THEN p_source_id
    END,
    CASE WHEN p_source_kind = 'asset' THEN p_source_id END,
    CASE WHEN p_source_kind = 'amc_visit' THEN p_source_id END,
    CASE
      WHEN p_source_kind = 'service_request' THEN p_source_id
    END,
    p_activity_kind,
    event_at,
    clean_note,
    p_client_request_id,
    auth.uid()
  )
  RETURNING id INTO activity_id;

  INSERT INTO public.audit_logs (
    society_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    "after",
    request_id
  )
  VALUES (
    p_society_id,
    auth.uid(),
    'admin',
    'amenity.activity.record',
    'amenity_activity_record',
    activity_id::text,
    jsonb_build_object(
      'source_kind', p_source_kind,
      'source_id', p_source_id,
      'activity_kind', p_activity_kind,
      'event_at', event_at
    ),
    p_request_id
  );
  RETURN activity_id;
END;
$$;

CREATE FUNCTION private.amenity_activity_source_label(
  p_record public.amenity_activity_records
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE p_record.source_kind
    WHEN 'amenity_booking' THEN (
      SELECT booking.amenity_name || ' · ' ||
        to_char(
          booking.starts_at AT TIME ZONE society.timezone,
          'YYYY-MM-DD'
        )
      FROM public.amenity_bookings AS booking
      JOIN public.societies AS society
        ON society.id = booking.society_id
      WHERE booking.society_id = p_record.society_id
        AND booking.id = p_record.amenity_booking_id
    )
    WHEN 'asset' THEN (
      SELECT asset.name || ' · ' || asset.location
      FROM public.assets AS asset
      WHERE asset.society_id = p_record.society_id
        AND asset.id = p_record.asset_id
    )
    WHEN 'amc_visit' THEN (
      SELECT contract.asset_label || ' visit · ' ||
        visit.visit_date::text
      FROM public.amc_visits AS visit
      JOIN public.amc_contracts AS contract
        ON contract.society_id = visit.society_id
        AND contract.id = visit.contract_id
      WHERE visit.society_id = p_record.society_id
        AND visit.id = p_record.amc_visit_id
    )
    ELSE (
      SELECT 'Service request · ' ||
        left(regexp_replace(request.description, '\s+', ' ', 'g'), 120)
      FROM public.service_requests AS request
      WHERE request.society_id = p_record.society_id
        AND request.id = p_record.service_request_id
    )
  END
$$;
REVOKE ALL ON FUNCTION private.amenity_activity_source_label(public.amenity_activity_records)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.amenity_facilities_report(
  p_society_id uuid,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_admin boolean;
  zone text;
BEGIN
  PERFORM private.amenity_authorize(p_society_id, false, false);
  IF NOT private.has_role(
      p_society_id,
      ARRAY['admin', 'committee']::text[]
    )
  THEN
    RAISE EXCEPTION 'Amenity facilities access is not available.'
      USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL
    OR p_limit NOT BETWEEN 1 AND 100
    OR p_offset IS NULL
    OR p_offset < 0
  THEN
    RAISE EXCEPTION 'Choose a valid activity page.'
      USING ERRCODE = '22023';
  END IF;
  is_admin := private.has_role(p_society_id, ARRAY['admin']::text[]);
  SELECT timezone INTO zone
  FROM public.societies
  WHERE id = p_society_id;

  RETURN jsonb_build_object(
    'timezone', zone,
    'can_record', is_admin,
    'limit', p_limit,
    'offset', p_offset,
    'total', (
      SELECT count(*)
      FROM public.amenity_activity_records AS activity
      WHERE activity.society_id = p_society_id
        AND private.amenity_activity_source_available(
          activity.society_id,
          activity.source_kind,
          CASE activity.source_kind
            WHEN 'amenity_booking' THEN activity.amenity_booking_id
            WHEN 'asset' THEN activity.asset_id
            WHEN 'amc_visit' THEN activity.amc_visit_id
            ELSE activity.service_request_id
          END
        )
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', activity.id,
        'source_kind', activity.source_kind,
        'source_id', CASE activity.source_kind
          WHEN 'amenity_booking' THEN activity.amenity_booking_id
          WHEN 'asset' THEN activity.asset_id
          WHEN 'amc_visit' THEN activity.amc_visit_id
          ELSE activity.service_request_id
        END,
        'source_label', private.amenity_activity_source_label(activity),
        'activity_kind', activity.activity_kind,
        'event_at', activity.event_at,
        'note', activity.note,
        'actor_name', profile.full_name,
        'created_at', activity.created_at
      ) ORDER BY activity.event_at DESC, activity.id)
      FROM (
        SELECT *
        FROM public.amenity_activity_records AS candidate
        WHERE candidate.society_id = p_society_id
          AND private.amenity_activity_source_available(
            candidate.society_id,
            candidate.source_kind,
            CASE candidate.source_kind
              WHEN 'amenity_booking' THEN candidate.amenity_booking_id
              WHEN 'asset' THEN candidate.asset_id
              WHEN 'amc_visit' THEN candidate.amc_visit_id
              ELSE candidate.service_request_id
            END
          )
        ORDER BY candidate.event_at DESC, candidate.id
        LIMIT p_limit
        OFFSET p_offset
      ) AS activity
      JOIN public.profiles AS profile
        ON profile.id = activity.created_by
    ), '[]'::jsonb),
    'source_choices', CASE
      WHEN NOT is_admin THEN '[]'::jsonb
      ELSE COALESCE((
        WITH choices AS (
          (
            SELECT booking.id,
              'amenity_booking'::text AS source_kind,
              booking.amenity_name || ' · ' ||
                to_char(
                  booking.starts_at AT TIME ZONE zone,
                  'YYYY-MM-DD'
                ) AS label,
              booking.starts_at AS occurred_at
            FROM public.amenity_bookings AS booking
            WHERE booking.society_id = p_society_id
              AND private.module_enabled(p_society_id, 'amenity')
            ORDER BY booking.starts_at DESC, booking.id
            LIMIT 25
          )
          UNION ALL
          (
            SELECT asset.id,
              'asset'::text,
              asset.name || ' · ' || asset.location,
              asset.created_at
            FROM public.assets AS asset
            WHERE asset.society_id = p_society_id
              AND private.module_enabled(p_society_id, 'asset')
            ORDER BY asset.name, asset.id
            LIMIT 25
          )
          UNION ALL
          (
            SELECT visit.id,
              'amc_visit'::text,
              contract.asset_label || ' visit · ' ||
                visit.visit_date::text,
              visit.visit_date::timestamptz
            FROM public.amc_visits AS visit
            JOIN public.amc_contracts AS contract
              ON contract.society_id = visit.society_id
              AND contract.id = visit.contract_id
            WHERE visit.society_id = p_society_id
              AND private.module_enabled(p_society_id, 'amc')
            ORDER BY visit.visit_date DESC, visit.id
            LIMIT 25
          )
          UNION ALL
          (
            SELECT request.id,
              'service_request'::text,
              'Service request · ' ||
                left(
                  regexp_replace(request.description, '\s+', ' ', 'g'),
                  120
                ),
              request.created_at
            FROM public.service_requests AS request
            WHERE request.society_id = p_society_id
              AND private.module_enabled(p_society_id, 'service_request')
            ORDER BY request.created_at DESC, request.id
            LIMIT 25
          )
        )
        SELECT jsonb_agg(jsonb_build_object(
          'source_kind', source_kind,
          'source_id', id,
          'label', label
        ) ORDER BY occurred_at DESC, source_kind, id)
        FROM (
          SELECT *
          FROM choices
          ORDER BY occurred_at DESC, source_kind, id
          LIMIT 100
        ) AS bounded
      ), '[]'::jsonb)
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.tenancy_settings_update(uuid, boolean, text),
  public.tenancy_settings_update(uuid, boolean, text, text, boolean, text),
  public.tenancy_verification_settings_update(uuid, boolean, text),
  public.tenancy_verification_save(
    uuid, uuid, integer, text, date, text, text
  ),
  public.tenancy_agreement_metadata_save(
    uuid, uuid, integer, text, date, date, text
  ),
  public.tenancy_move_progress_get(uuid, uuid),
  public.parking_condition_set(uuid, uuid, text, integer, text),
  public.parking_summary(uuid),
  public.amenity_calendar_settings_get(uuid),
  public.amenity_calendar_visibility_save(uuid, text, text),
  public.amenity_calendar_month(uuid, date, integer),
  public.amenity_activity_record(
    uuid, text, uuid, text, text, text, uuid, text
  ),
  public.amenity_facilities_report(uuid, integer, integer)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.tenancy_settings_update(uuid, boolean, text),
  public.tenancy_settings_update(uuid, boolean, text, text, boolean, text),
  public.tenancy_verification_settings_update(uuid, boolean, text),
  public.tenancy_verification_save(
    uuid, uuid, integer, text, date, text, text
  ),
  public.tenancy_agreement_metadata_save(
    uuid, uuid, integer, text, date, date, text
  ),
  public.tenancy_move_progress_get(uuid, uuid),
  public.parking_condition_set(uuid, uuid, text, integer, text),
  public.parking_summary(uuid),
  public.amenity_calendar_settings_get(uuid),
  public.amenity_calendar_visibility_save(uuid, text, text),
  public.amenity_calendar_month(uuid, date, integer),
  public.amenity_activity_record(
    uuid, text, uuid, text, text, text, uuid, text
  ),
  public.amenity_facilities_report(uuid, integer, integer)
TO authenticated;
