-- Add optional refundable amenity deposits, evidence, held cash and retained income.
ALTER TABLE public.amenities
  ADD COLUMN deposit_paise bigint
    CHECK (deposit_paise IS NULL OR deposit_paise BETWEEN 1 AND 9007199254740991),
  ADD COLUMN deposit_required_before_confirmation boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.amenity_settings_valid(p_settings jsonb)
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
        'resident_calendar_identity',
        'deposit_confirmation_policy'
      )
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
    AND (
      NOT p_settings ? 'deposit_confirmation_policy'
      OR (
        jsonb_typeof(p_settings -> 'deposit_confirmation_policy') = 'string'
        AND p_settings ->> 'deposit_confirmation_policy'
          IN ('per_amenity', 'immediate')
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.amenity_calendar_settings_get(p_society_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.amenity_authorize(p_society_id, false, false);
  IF NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[]) THEN
    RAISE EXCEPTION 'Amenity calendar settings are not available.'
      USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'resident_calendar_identity',
      private.amenity_resident_calendar_identity(p_society_id),
    'deposit_confirmation_policy', coalesce((
      SELECT config.settings ->> 'deposit_confirmation_policy'
      FROM public.module_configs config
      WHERE config.society_id = p_society_id
        AND config.module_key = 'amenity'
    ), 'per_amenity'),
    'directory_enabled', private.module_enabled(p_society_id, 'directory'),
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[])
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.amenity_save(
  p_society_id uuid,
  p_amenity_id uuid,
  p_name text,
  p_capacity integer,
  p_fee_paise bigint,
  p_rules text,
  p_active boolean,
  p_slots jsonb,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text,
  p_deposit_paise bigint,
  p_deposit_required_before_confirmation boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved_id uuid;
  previous public.amenities;
BEGIN
  saved_id := public.amenity_save(
    p_society_id,
    p_amenity_id,
    p_name,
    p_capacity,
    p_fee_paise,
    p_rules,
    p_active,
    p_slots,
    p_expected_updated_at,
    p_client_request_id,
    p_request_trace
  );
  IF p_deposit_paise IS NULL
    AND p_deposit_required_before_confirmation
  THEN
    RAISE EXCEPTION 'A deposit amount is required when prepayment is required.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO previous FROM public.amenities
  WHERE society_id = p_society_id AND id = saved_id FOR UPDATE;
  IF previous.deposit_paise IS DISTINCT FROM p_deposit_paise
    OR previous.deposit_required_before_confirmation
      IS DISTINCT FROM p_deposit_required_before_confirmation
  THEN
    UPDATE public.amenities
    SET deposit_paise = p_deposit_paise,
      deposit_required_before_confirmation =
        p_deposit_required_before_confirmation,
      updated_by = auth.uid(),
      updated_at = clock_timestamp()
    WHERE society_id = p_society_id AND id = saved_id;
    INSERT INTO public.audit_logs (
      society_id, actor_id, actor_role, action, entity_type, entity_id,
      "before", "after", request_id
    ) VALUES (
      p_society_id, auth.uid(), 'admin', 'amenity.deposit_settings.update',
      'amenity', saved_id::text,
      jsonb_build_object(
        'deposit_paise', previous.deposit_paise,
        'deposit_required_before_confirmation',
          previous.deposit_required_before_confirmation
      ),
      jsonb_build_object(
        'deposit_paise', p_deposit_paise,
        'deposit_required_before_confirmation',
          p_deposit_required_before_confirmation
      ),
      p_request_trace
    );
  END IF;
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.amenity_deposit_policy_save(
  p_society_id uuid,
  p_policy text,
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
  IF p_policy IS NULL OR p_policy NOT IN ('per_amenity', 'immediate')
    OR p_request_id IS NULL OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Choose a valid deposit confirmation policy.'
      USING ERRCODE = '22023';
  END IF;
  SELECT settings INTO current_settings
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'amenity'
  FOR UPDATE;
  UPDATE public.module_configs
  SET settings = coalesce(current_settings, '{}'::jsonb)
      || jsonb_build_object('deposit_confirmation_policy', p_policy),
    updated_by = auth.uid(),
    updated_at = clock_timestamp()
  WHERE society_id = p_society_id AND module_key = 'amenity';
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'amenity.deposit_policy.update',
    'module', 'amenity', jsonb_build_object('policy', p_policy), p_request_id
  );
END;
$$;

CREATE TABLE public.amenity_booking_deposits (
  booking_id uuid PRIMARY KEY,
  society_id uuid NOT NULL,
  original_amount_paise bigint NOT NULL
    CHECK (original_amount_paise BETWEEN 1 AND 9007199254740991),
  current_amount_paise bigint NOT NULL
    CHECK (current_amount_paise BETWEEN 1 AND 9007199254740991),
  required_before_confirmation boolean NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  FOREIGN KEY (society_id, booking_id)
    REFERENCES public.amenity_bookings (society_id, id) ON DELETE RESTRICT,
  UNIQUE (society_id, booking_id)
);

CREATE TABLE public.amenity_booking_deposit_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  society_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('receipt', 'refund', 'deduction', 'terms_change', 'void')),
  amount_paise bigint
    CHECK (amount_paise IS NULL OR amount_paise BETWEEN 1 AND 9007199254740991),
  event_date date,
  account_id uuid,
  book_entry_id uuid,
  evidence_path text,
  reason text CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  reference text CHECK (char_length(btrim(reference)) BETWEEN 1 AND 120),
  voids_event_id uuid,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  FOREIGN KEY (society_id, booking_id)
    REFERENCES public.amenity_booking_deposits (society_id, booking_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (society_id, account_id)
    REFERENCES public.expense_accounts (society_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (society_id, book_entry_id)
    REFERENCES public.expense_book_entries (society_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (society_id, voids_event_id)
    REFERENCES public.amenity_booking_deposit_events (society_id, id)
    ON DELETE RESTRICT,
  UNIQUE (society_id, id),
  UNIQUE (society_id, created_by, client_request_id),
  CONSTRAINT amenity_deposit_event_shape_check CHECK (
    (kind = 'receipt'
      AND amount_paise IS NOT NULL AND event_date IS NOT NULL
      AND account_id IS NOT NULL AND book_entry_id IS NOT NULL
      AND voids_event_id IS NULL)
    OR (kind = 'refund'
      AND amount_paise IS NOT NULL AND event_date IS NOT NULL
      AND account_id IS NOT NULL AND book_entry_id IS NOT NULL
      AND voids_event_id IS NULL AND reason IS NOT NULL)
    OR (kind = 'deduction'
      AND amount_paise IS NOT NULL AND event_date IS NOT NULL
      AND account_id IS NULL AND book_entry_id IS NULL
      AND evidence_path IS NOT NULL AND reason IS NOT NULL
      AND voids_event_id IS NULL)
    OR (kind = 'terms_change'
      AND amount_paise IS NOT NULL AND event_date IS NULL
      AND account_id IS NULL AND book_entry_id IS NULL
      AND evidence_path IS NULL AND reason IS NOT NULL
      AND voids_event_id IS NULL)
    OR (kind = 'void'
      AND amount_paise IS NULL AND event_date IS NULL
      AND account_id IS NULL AND book_entry_id IS NULL
      AND evidence_path IS NULL AND reason IS NOT NULL
      AND voids_event_id IS NOT NULL)
  )
);

CREATE INDEX amenity_booking_deposit_events_booking_idx
  ON public.amenity_booking_deposit_events (society_id, booking_id, created_at);
CREATE INDEX amenity_booking_deposit_events_void_idx
  ON public.amenity_booking_deposit_events (society_id, voids_event_id)
  WHERE voids_event_id IS NOT NULL;

ALTER TABLE public.amenity_booking_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenity_booking_deposit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.amenity_booking_deposits,
  public.amenity_booking_deposit_events
  FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY amenity_booking_deposits_no_direct_access
  ON public.amenity_booking_deposits
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY amenity_booking_deposit_events_no_direct_access
  ON public.amenity_booking_deposit_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION private.amenity_booking_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Booking history is immutable.' USING ERRCODE = '42501';
  END IF;
  IF row(
    NEW.id,
    NEW.society_id,
    NEW.amenity_id,
    NEW.slot_id,
    NEW.unit_id,
    NEW.booked_by,
    NEW.starts_at,
    NEW.ends_at,
    NEW.amenity_name,
    NEW.capacity,
    NEW.guest_count,
    NEW.fee_paise,
    NEW.rules_snapshot,
    NEW.rules_accepted,
    NEW.created_at,
    NEW.client_request_id
  ) IS DISTINCT FROM row(
    OLD.id,
    OLD.society_id,
    OLD.amenity_id,
    OLD.slot_id,
    OLD.unit_id,
    OLD.booked_by,
    OLD.starts_at,
    OLD.ends_at,
    OLD.amenity_name,
    OLD.capacity,
    OLD.guest_count,
    OLD.fee_paise,
    OLD.rules_snapshot,
    OLD.rules_accepted,
    OLD.created_at,
    OLD.client_request_id
  )
    OR current_setting('homeish.amenity_mutation', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'Booking snapshots are immutable.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.amenity_deposit_totals(
  p_society_id uuid, p_booking_id uuid
)
RETURNS TABLE (
  received_paise bigint,
  refunded_paise bigint,
  deducted_paise bigint,
  held_paise bigint
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    coalesce(sum(event.amount_paise) FILTER (WHERE event.kind = 'receipt'), 0),
    coalesce(sum(event.amount_paise) FILTER (WHERE event.kind = 'refund'), 0),
    coalesce(sum(event.amount_paise) FILTER (WHERE event.kind = 'deduction'), 0),
    coalesce(sum(event.amount_paise) FILTER (
      WHERE event.kind IN ('receipt')
    ), 0)
      - coalesce(sum(event.amount_paise) FILTER (
        WHERE event.kind IN ('refund', 'deduction')
      ), 0)
  FROM public.amenity_booking_deposit_events event
  WHERE event.society_id = p_society_id
    AND event.booking_id = p_booking_id
    AND event.kind <> 'void'
    AND NOT EXISTS (
      SELECT 1
      FROM public.amenity_booking_deposit_events void
      WHERE void.society_id = event.society_id
        AND void.voids_event_id = event.id
        AND void.kind = 'void'
    )
$$;
REVOKE ALL ON FUNCTION private.amenity_deposit_totals(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.amenity_deposit_totals(uuid, uuid)
  TO authenticated;

DO $$
DECLARE
  selected_constraint text;
BEGIN
  FOR selected_constraint IN
    SELECT checks.constraint_name::text
    FROM information_schema.check_constraints checks
    WHERE checks.constraint_schema = 'public'
      AND checks.constraint_name LIKE 'amenity_bookings_%check%'
      AND (
        checks.check_clause LIKE '%status%'
        OR (
          checks.check_clause LIKE '%fee_paise%'
          AND checks.check_clause LIKE '%charge_ledger_id%'
        )
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.amenity_bookings DROP CONSTRAINT %I',
      selected_constraint
    );
  END LOOP;
  SELECT conname INTO selected_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.amenity_bookings'::regclass
    AND contype = 'x';
  IF selected_constraint IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.amenity_bookings DROP CONSTRAINT %I',
      selected_constraint
    );
  END IF;
END;
$$;

ALTER TABLE public.amenity_bookings
  ADD CONSTRAINT amenity_bookings_status_lifecycle_check CHECK (
    (status = 'confirmed'
      AND cancelled_at IS NULL AND cancelled_by IS NULL
      AND cancel_reason IS NULL AND credit_ledger_id IS NULL)
    OR (status = 'awaiting_deposit'
      AND cancelled_at IS NULL AND cancelled_by IS NULL
      AND cancel_reason IS NULL AND credit_ledger_id IS NULL)
    OR (status = 'cancelled'
      AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
      AND cancel_reason IS NOT NULL
      AND (
        (charge_ledger_id IS NULL AND credit_ledger_id IS NULL)
        OR (charge_ledger_id IS NOT NULL AND fee_paise > 0
          AND credit_ledger_id IS NOT NULL)
      ))
  ),
  ADD CONSTRAINT amenity_bookings_charge_lifecycle_check CHECK (
    charge_ledger_id IS NULL
    OR fee_paise > 0
  ),
  ADD CONSTRAINT amenity_bookings_active_span_excl
    EXCLUDE USING gist (
      amenity_id extensions.gist_uuid_ops WITH =,
      booking_span WITH &&
    ) WHERE (status IN ('confirmed', 'awaiting_deposit'));

ALTER TABLE public.expense_book_entries
  DROP CONSTRAINT expense_book_entries_source_check,
  DROP CONSTRAINT expense_book_entries_shape_check;
ALTER TABLE public.expense_book_entries
  ADD CONSTRAINT expense_book_entries_source_check CHECK (
    source IN (
      'expense',
      'income',
      'billing_payment',
      'reversal',
      'transfer',
      'amenity_deposit'
    )
  ),
  ADD CONSTRAINT expense_book_entries_shape_check CHECK (
    (source = 'expense' AND direction = 'out' AND expense_id IS NOT NULL
      AND category_id IS NOT NULL AND income_kind IS NULL
      AND billing_payment_id IS NULL AND reverses_entry_id IS NULL
      AND transfer_pair_id IS NULL AND transfer_request_id IS NULL)
    OR (source = 'income' AND direction = 'in' AND income_kind IS NOT NULL
      AND client_request_id IS NOT NULL AND expense_id IS NULL
      AND category_id IS NULL AND billing_payment_id IS NULL
      AND reverses_entry_id IS NULL AND transfer_pair_id IS NULL
      AND transfer_request_id IS NULL)
    OR (source = 'billing_payment' AND direction = 'in'
      AND billing_payment_id IS NOT NULL AND expense_id IS NULL
      AND category_id IS NULL AND income_kind IS NULL
      AND reverses_entry_id IS NULL AND transfer_pair_id IS NULL
      AND transfer_request_id IS NULL)
    OR (source = 'amenity_deposit' AND direction IN ('in', 'out')
      AND client_request_id IS NOT NULL AND expense_id IS NULL
      AND category_id IS NULL AND income_kind IS NULL
      AND billing_payment_id IS NULL AND reverses_entry_id IS NULL
      AND transfer_pair_id IS NULL AND transfer_request_id IS NULL)
    OR (source = 'transfer' AND direction IN ('in', 'out')
      AND transfer_pair_id IS NOT NULL AND transfer_request_id IS NOT NULL
      AND client_request_id IS NULL AND expense_id IS NULL
      AND category_id IS NULL AND income_kind IS NULL
      AND billing_payment_id IS NULL AND reverses_entry_id IS NULL)
    OR (source = 'reversal' AND reverses_entry_id IS NOT NULL
      AND description IS NOT NULL
      AND expense_id IS NULL AND billing_payment_id IS NULL
      AND (category_id IS NULL OR income_kind IS NULL)
      AND (
        (transfer_pair_id IS NULL AND client_request_id IS NOT NULL
          AND transfer_request_id IS NULL)
        OR (transfer_pair_id IS NOT NULL AND client_request_id IS NULL
          AND transfer_request_id IS NOT NULL)
      ))
  );

CREATE OR REPLACE FUNCTION public.amenity_book(
  p_society_id uuid,
  p_amenity_id uuid,
  p_slot_id uuid,
  p_date date,
  p_unit_id uuid,
  p_guest_count integer,
  p_rules_accepted boolean,
  p_expected_updated_at timestamptz,
  p_client_request_id uuid,
  p_request_trace text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  amenity public.amenities;
  slot public.amenity_slots;
  existing public.amenity_bookings;
  zone text;
  policy text;
  slot_start timestamptz;
  slot_end timestamptz;
  booking_id uuid := gen_random_uuid();
  charge_id bigint;
  initial_status text;
BEGIN
  PERFORM private.amenity_authorize(p_society_id, false, true);
  IF NOT private.has_role(p_society_id, ARRAY['admin', 'resident']::text[])
    OR NOT private.occupies_unit(p_unit_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.units
      WHERE society_id = p_society_id AND id = p_unit_id AND active
    )
  THEN
    RAISE EXCEPTION 'Active unit occupancy is required.' USING ERRCODE = '42501';
  END IF;
  IF p_client_request_id IS NULL OR p_date IS NULL
    OR p_request_trace IS NULL
    OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Check the booking details.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_society_id::text || auth.uid()::text || p_client_request_id::text, 0
  ));
  SELECT * INTO existing
  FROM public.amenity_bookings
  WHERE society_id = p_society_id
    AND booked_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF FOUND THEN
    SELECT timezone INTO zone FROM public.societies WHERE id = p_society_id;
    IF row(
      existing.amenity_id,
      existing.slot_id,
      (existing.starts_at AT TIME ZONE zone)::date,
      existing.unit_id,
      existing.guest_count,
      existing.rules_accepted
    ) IS DISTINCT FROM row(
      p_amenity_id, p_slot_id, p_date, p_unit_id,
      p_guest_count, p_rules_accepted
    )
    THEN
      RAISE EXCEPTION 'Retry details changed.' USING ERRCODE = '23505';
    END IF;
    RETURN existing.id;
  END IF;
  SELECT * INTO amenity
  FROM public.amenities
  WHERE society_id = p_society_id AND id = p_amenity_id AND active
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Amenity not found.' USING ERRCODE = 'P0002';
  END IF;
  IF amenity.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Rules or price changed. Refresh.' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO slot
  FROM public.amenity_slots
  WHERE society_id = p_society_id
    AND amenity_id = p_amenity_id
    AND id = p_slot_id
    AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found.' USING ERRCODE = 'P0002';
  END IF;
  IF extract(dow FROM p_date)::smallint <> slot.weekday
    OR p_guest_count IS NULL OR p_guest_count NOT BETWEEN 1 AND amenity.capacity
    OR p_rules_accepted IS NULL OR (amenity.rules <> '' AND NOT p_rules_accepted)
  THEN
    RAISE EXCEPTION 'Check guests and acknowledge the current rules.'
      USING ERRCODE = '23514';
  END IF;
  SELECT timezone INTO zone FROM public.societies WHERE id = p_society_id;
  SELECT coalesce(
    settings ->> 'deposit_confirmation_policy', 'per_amenity'
  ) INTO policy
  FROM public.module_configs
  WHERE society_id = p_society_id AND module_key = 'amenity';
  slot_start := (p_date + slot.starts_local) AT TIME ZONE zone;
  slot_end := (p_date + slot.ends_local) AT TIME ZONE zone;
  IF slot_start < clock_timestamp() + interval '24 hours'
    OR slot_end <= slot_start
    OR (slot_start AT TIME ZONE zone) IS DISTINCT FROM p_date + slot.starts_local
    OR (slot_end AT TIME ZONE zone) IS DISTINCT FROM p_date + slot.ends_local
  THEN
    RAISE EXCEPTION 'Book a valid local slot at least 24 hours ahead.'
      USING ERRCODE = '23514';
  END IF;
  initial_status := CASE
    WHEN amenity.deposit_paise IS NOT NULL
      AND amenity.deposit_required_before_confirmation
      AND policy = 'per_amenity'
      THEN 'awaiting_deposit'
    ELSE 'confirmed'
  END;
  IF initial_status = 'confirmed' AND amenity.fee_paise > 0 THEN
    IF NOT private.module_enabled(p_society_id, 'billing') THEN
      RAISE EXCEPTION 'Paid amenities require billing.' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.billing_ledger_entries (
      society_id, unit_id, kind, direction, amount_paise, reason, created_by
    ) VALUES (
      p_society_id, p_unit_id, 'adjustment', 'debit',
      amenity.fee_paise,
      'Amenity booking ' || booking_id::text || ': ' || amenity.name,
      auth.uid()
    ) RETURNING id INTO charge_id;
  END IF;
  INSERT INTO public.amenity_bookings (
    id, society_id, amenity_id, slot_id, unit_id, booked_by,
    starts_at, ends_at, amenity_name, capacity, guest_count,
    fee_paise, rules_snapshot, rules_accepted, status,
    charge_ledger_id, client_request_id
  ) VALUES (
    booking_id, p_society_id, p_amenity_id, p_slot_id, p_unit_id, auth.uid(),
    slot_start, slot_end, amenity.name, amenity.capacity, p_guest_count,
    amenity.fee_paise, amenity.rules, p_rules_accepted, initial_status,
    charge_id, p_client_request_id
  );
  IF amenity.deposit_paise IS NOT NULL THEN
    IF NOT private.module_enabled(p_society_id, 'expense') THEN
      RAISE EXCEPTION 'Amenity deposits require Accounts.' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.amenity_booking_deposits (
      booking_id, society_id, original_amount_paise, current_amount_paise,
      required_before_confirmation, created_by, updated_by
    ) VALUES (
      booking_id, p_society_id, amenity.deposit_paise, amenity.deposit_paise,
      amenity.deposit_required_before_confirmation, auth.uid(), auth.uid()
    );
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(),
    CASE WHEN private.has_role(p_society_id, ARRAY['admin']::text[])
      THEN 'admin' ELSE 'resident' END,
    'amenity.book', 'amenity_booking', booking_id::text,
    jsonb_build_object(
      'starts_at', slot_start,
      'unit_id', p_unit_id,
      'fee_paise', amenity.fee_paise,
      'deposit_paise', amenity.deposit_paise,
      'status', initial_status
    ),
    p_request_trace
  );
  RETURN booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.amenity_deposit_override(
  p_society_id uuid,
  p_booking_id uuid,
  p_amount_paise bigint,
  p_reason text,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  booking public.amenity_bookings;
  deposit public.amenity_booking_deposits;
  retry_id uuid;
BEGIN
  PERFORM private.amenity_authorize(p_society_id, true, true);
  PERFORM private.expense_authorize(p_society_id, 'manage');
  IF p_amount_paise IS NULL OR p_amount_paise NOT BETWEEN 1 AND 9007199254740991
    OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500
    OR p_client_request_id IS NULL OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Enter valid deposit terms and a reason.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO retry_id
  FROM public.amenity_booking_deposit_events
  WHERE society_id = p_society_id
    AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF retry_id IS NOT NULL THEN RETURN retry_id; END IF;
  SELECT * INTO booking
  FROM public.amenity_bookings
  WHERE society_id = p_society_id AND id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR booking.status <> 'awaiting_deposit' THEN
    RAISE EXCEPTION 'Deposit terms can only change before confirmation.'
      USING ERRCODE = '23514';
  END IF;
  SELECT * INTO deposit
  FROM public.amenity_booking_deposits
  WHERE society_id = p_society_id AND booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.amenity_booking_deposit_events event
    WHERE event.society_id = p_society_id
      AND event.booking_id = p_booking_id
      AND event.kind = 'receipt'
      AND NOT EXISTS (
        SELECT 1 FROM public.amenity_booking_deposit_events void
        WHERE void.society_id = event.society_id
          AND void.voids_event_id = event.id
          AND void.kind = 'void'
      )
  ) THEN
    RAISE EXCEPTION 'Deposit terms cannot change after a receipt.'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.amenity_booking_deposit_events (
    society_id, booking_id, kind, amount_paise, reason,
    client_request_id, created_by
  ) VALUES (
    p_society_id, p_booking_id, 'terms_change', p_amount_paise,
    btrim(p_reason), p_client_request_id, auth.uid()
  ) RETURNING id INTO retry_id;
  UPDATE public.amenity_booking_deposits
  SET current_amount_paise = p_amount_paise,
    version = version + 1,
    updated_at = clock_timestamp(),
    updated_by = auth.uid()
  WHERE society_id = p_society_id AND booking_id = p_booking_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'amenity.deposit.terms_change',
    'amenity_booking', p_booking_id::text,
    jsonb_build_object('amount_paise', deposit.current_amount_paise),
    jsonb_build_object('amount_paise', p_amount_paise, 'reason', btrim(p_reason)),
    p_request_id
  );
  RETURN retry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.amenity_deposit_event_record(
  p_society_id uuid,
  p_booking_id uuid,
  p_kind text,
  p_amount_paise bigint,
  p_event_date date,
  p_account_id uuid,
  p_reference text,
  p_reason text,
  p_evidence_path text,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  booking public.amenity_bookings;
  deposit public.amenity_booking_deposits;
  totals record;
  account public.expense_accounts;
  event_id uuid;
  entry_id uuid;
  charge_id bigint;
BEGIN
  PERFORM private.amenity_authorize(p_society_id, true, true);
  PERFORM private.expense_authorize(p_society_id, 'manage');
  IF p_kind IS NULL OR p_kind NOT IN ('receipt', 'refund', 'deduction')
    OR p_amount_paise IS NULL
    OR p_amount_paise NOT BETWEEN 1 AND 9007199254740991
    OR p_event_date IS NULL
    OR p_client_request_id IS NULL OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'Enter a valid deposit event.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO event_id
  FROM public.amenity_booking_deposit_events
  WHERE society_id = p_society_id
    AND created_by = auth.uid()
    AND client_request_id = p_client_request_id;
  IF event_id IS NOT NULL THEN RETURN event_id; END IF;
  SELECT * INTO booking
  FROM public.amenity_bookings
  WHERE society_id = p_society_id AND id = p_booking_id FOR UPDATE;
  SELECT * INTO deposit
  FROM public.amenity_booking_deposits
  WHERE society_id = p_society_id AND booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR booking.status = 'cancelled' THEN
    RAISE EXCEPTION 'Active booking deposit not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO totals
  FROM private.amenity_deposit_totals(p_society_id, p_booking_id);
  PERFORM private.expense_lock_books(p_society_id);

  IF p_kind IN ('receipt', 'refund') THEN
    IF p_account_id IS NULL THEN
      RAISE EXCEPTION 'Choose an active cash or bank account.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO account FROM private.expense_check_account(
      p_society_id, p_account_id, p_event_date, NULL
    );
    IF account.account_type = 'deposit' THEN
      RAISE EXCEPTION 'Use a cash or bank account for booking deposits.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF p_kind = 'receipt' THEN
    IF totals.received_paise + p_amount_paise > deposit.current_amount_paise
      THEN RAISE EXCEPTION 'Receipts cannot exceed the booking deposit.'
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.expense_book_entries (
      society_id, account_id, entry_date, direction, amount_paise, source,
      counterparty, reference, description, client_request_id, created_by
    ) VALUES (
      p_society_id, p_account_id, p_event_date, 'in', p_amount_paise,
      'amenity_deposit', left(
        'Amenity deposit: Unit ' || (
          SELECT unit.number FROM public.units unit
          WHERE unit.society_id = p_society_id AND unit.id = booking.unit_id
        ), 120
      ), nullif(btrim(p_reference), ''),
      left('Refundable deposit for ' || booking.amenity_name
        || ' booking ' || booking.id::text, 2000),
      p_client_request_id, auth.uid()
    ) RETURNING id INTO entry_id;
  ELSIF p_kind = 'refund' THEN
    IF p_amount_paise > totals.held_paise
      OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500
      THEN RAISE EXCEPTION 'Refunds cannot exceed money still held.'
        USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.expense_book_entries (
      society_id, account_id, entry_date, direction, amount_paise, source,
      counterparty, reference, description, client_request_id, created_by
    ) VALUES (
      p_society_id, p_account_id, p_event_date, 'out', p_amount_paise,
      'amenity_deposit', left('Amenity deposit refund: ' || booking.id::text, 120),
      nullif(btrim(p_reference), ''), left(btrim(p_reason), 2000),
      p_client_request_id, auth.uid()
    ) RETURNING id INTO entry_id;
  ELSE
    IF booking.status <> 'confirmed'
      OR p_amount_paise > totals.held_paise
      OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500
      OR p_evidence_path IS NULL
      OR p_evidence_path !~ ('^' || p_society_id::text
        || '/amenity-deposits/' || p_booking_id::text
        || '/[0-9a-f-]+\.(jpg|png|pdf)$')
    THEN
      RAISE EXCEPTION 'Deductions require a confirmed booking, evidence and held money.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO public.amenity_booking_deposit_events (
    society_id, booking_id, kind, amount_paise, event_date, account_id,
    book_entry_id, evidence_path, reason, reference,
    client_request_id, created_by
  ) VALUES (
    p_society_id, p_booking_id, p_kind, p_amount_paise, p_event_date,
    CASE WHEN p_kind IN ('receipt', 'refund') THEN p_account_id END,
    entry_id,
    CASE WHEN p_kind = 'deduction' THEN p_evidence_path END,
    CASE WHEN p_kind IN ('refund', 'deduction') THEN btrim(p_reason) END,
    nullif(btrim(p_reference), ''),
    p_client_request_id, auth.uid()
  ) RETURNING id INTO event_id;

  IF p_kind = 'receipt'
    AND booking.status = 'awaiting_deposit'
    AND totals.received_paise + p_amount_paise = deposit.current_amount_paise
  THEN
    IF booking.fee_paise > 0 THEN
      IF NOT private.module_enabled(p_society_id, 'billing') THEN
        RAISE EXCEPTION 'Paid amenities require billing.' USING ERRCODE = '23514';
      END IF;
      INSERT INTO public.billing_ledger_entries (
        society_id, unit_id, kind, direction, amount_paise, reason, created_by
      ) VALUES (
        p_society_id, booking.unit_id, 'adjustment', 'debit',
        booking.fee_paise,
        'Amenity booking ' || booking.id::text || ': ' || booking.amenity_name,
        auth.uid()
      ) RETURNING id INTO charge_id;
    END IF;
    PERFORM set_config('homeish.amenity_mutation', 'on', true);
    UPDATE public.amenity_bookings
    SET status = 'confirmed', charge_ledger_id = charge_id
    WHERE id = booking.id;
    PERFORM set_config('homeish.amenity_mutation', 'off', true);
  END IF;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'amenity.deposit.' || p_kind,
    'amenity_booking', p_booking_id::text,
    jsonb_build_object(
      'event_id', event_id,
      'amount_paise', p_amount_paise,
      'event_date', p_event_date,
      'account_id', p_account_id,
      'has_evidence', p_evidence_path IS NOT NULL
    ),
    p_request_id
  );
  RETURN event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.amenity_deposit_event_void(
  p_society_id uuid,
  p_event_id uuid,
  p_reason text,
  p_client_request_id uuid,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  original public.amenity_booking_deposit_events;
  booking public.amenity_bookings;
  void_id uuid;
  reversal_id uuid;
BEGIN
  PERFORM private.amenity_authorize(p_society_id, true, true);
  PERFORM private.expense_authorize(p_society_id, 'manage');
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500
    OR p_client_request_id IS NULL OR p_request_id IS NULL
    OR char_length(p_request_id) NOT BETWEEN 1 AND 128
  THEN
    RAISE EXCEPTION 'A reason is required to void a deposit event.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO original
  FROM public.amenity_booking_deposit_events
  WHERE society_id = p_society_id AND id = p_event_id FOR UPDATE;
  IF NOT FOUND OR original.kind = 'void' THEN
    RAISE EXCEPTION 'Deposit event not found.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.amenity_booking_deposit_events
    WHERE society_id = p_society_id
      AND kind = 'void' AND voids_event_id = original.id
  ) THEN
    SELECT id INTO void_id
    FROM public.amenity_booking_deposit_events
    WHERE society_id = p_society_id
      AND kind = 'void' AND voids_event_id = original.id;
    RETURN void_id;
  END IF;
  SELECT * INTO booking
  FROM public.amenity_bookings
  WHERE society_id = p_society_id AND id = original.booking_id FOR UPDATE;
  IF original.kind = 'receipt'
    AND booking.status = 'confirmed'
    AND booking.charge_ledger_id IS NOT NULL
  THEN
    RAISE EXCEPTION 'A receipt that confirmed a paid booking cannot be voided.'
      USING ERRCODE = '23514';
  END IF;
  IF original.kind = 'terms_change' AND EXISTS (
    SELECT 1
    FROM public.amenity_booking_deposit_events event
    WHERE event.society_id = original.society_id
      AND event.booking_id = original.booking_id
      AND event.kind = 'receipt'
      AND NOT EXISTS (
        SELECT 1
        FROM public.amenity_booking_deposit_events void
        WHERE void.society_id = event.society_id
          AND void.kind = 'void'
          AND void.voids_event_id = event.id
      )
  ) THEN
    RAISE EXCEPTION 'A terms change with receipts cannot be voided.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM private.expense_lock_books(p_society_id);
  IF original.book_entry_id IS NOT NULL THEN
    INSERT INTO public.expense_book_entries (
      society_id, account_id, entry_date,
      direction, amount_paise, source, counterparty, reference,
      description, client_request_id, created_by, reverses_entry_id
    )
    SELECT
      entry.society_id, entry.account_id, entry.entry_date,
      CASE entry.direction WHEN 'in' THEN 'out' ELSE 'in' END,
      entry.amount_paise, 'reversal', entry.counterparty, entry.reference,
      'Void amenity deposit event ' || original.id::text,
      p_client_request_id, auth.uid(), entry.id
    FROM public.expense_book_entries entry
    WHERE entry.society_id = original.society_id
      AND entry.id = original.book_entry_id
    RETURNING id INTO reversal_id;
  END IF;
  INSERT INTO public.amenity_booking_deposit_events (
    society_id, booking_id, kind, reason, voids_event_id,
    client_request_id, created_by
  ) VALUES (
    p_society_id, original.booking_id, 'void', btrim(p_reason), original.id,
    p_client_request_id, auth.uid()
  ) RETURNING id INTO void_id;
  IF original.kind = 'terms_change' THEN
    UPDATE public.amenity_booking_deposits deposit
    SET current_amount_paise = coalesce((
        SELECT change.amount_paise
        FROM public.amenity_booking_deposit_events change
        WHERE change.society_id = deposit.society_id
          AND change.booking_id = deposit.booking_id
          AND change.kind = 'terms_change'
          AND NOT EXISTS (
            SELECT 1
            FROM public.amenity_booking_deposit_events void
            WHERE void.society_id = change.society_id
              AND void.kind = 'void'
              AND void.voids_event_id = change.id
          )
        ORDER BY change.created_at DESC, change.id DESC
        LIMIT 1
      ), deposit.original_amount_paise),
      version = deposit.version + 1,
      updated_at = clock_timestamp(),
      updated_by = auth.uid()
    WHERE deposit.society_id = original.society_id
      AND deposit.booking_id = original.booking_id;
  END IF;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(), 'admin', 'amenity.deposit.void',
    'amenity_booking', original.booking_id::text,
    jsonb_build_object(
      'event_id', original.id,
      'void_id', void_id,
      'reason', btrim(p_reason),
      'reversal_entry_id', reversal_id
    ),
    p_request_id
  );
  RETURN void_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.amenity_cancel(
  p_society_id uuid, p_booking_id uuid, p_reason text, p_request_trace text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  booking public.amenity_bookings;
  admin_cancel boolean;
  credit_id bigint;
  recipient record;
  totals record;
BEGIN
  PERFORM private.amenity_authorize(p_society_id, false, true);
  SELECT * INTO booking
  FROM public.amenity_bookings
  WHERE society_id = p_society_id AND id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.' USING ERRCODE = 'P0002';
  END IF;
  admin_cancel := private.has_role(p_society_id, ARRAY['admin']::text[]);
  IF NOT admin_cancel AND (
    NOT private.has_role(p_society_id, ARRAY['resident']::text[])
    OR booking.booked_by <> auth.uid()
    OR NOT private.occupies_unit(booking.unit_id)
  )
  THEN
    RAISE EXCEPTION 'Only the booker or an administrator can cancel.'
      USING ERRCODE = '42501';
  END IF;
  IF p_request_trace IS NULL
    OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
    OR (admin_cancel
      AND (p_reason IS NULL
        OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500))
  THEN
    RAISE EXCEPTION 'Administrators must provide a cancellation reason.'
      USING ERRCODE = '22023';
  END IF;
  IF booking.status = 'cancelled' THEN RETURN booking.id; END IF;
  IF NOT admin_cancel AND booking.starts_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'This slot has already begun.' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.amenity_booking_deposits
    WHERE society_id = p_society_id AND booking_id = booking.id
  ) THEN
    SELECT * INTO totals
    FROM private.amenity_deposit_totals(p_society_id, booking.id);
    IF totals.held_paise <> 0 THEN
      RAISE EXCEPTION 'Refund the held deposit before cancelling the booking.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF booking.fee_paise > 0 AND booking.charge_ledger_id IS NOT NULL THEN
    INSERT INTO public.billing_ledger_entries (
      society_id, unit_id, kind, direction, amount_paise, reason, created_by
    ) VALUES (
      p_society_id, booking.unit_id, 'adjustment', 'credit',
      booking.fee_paise,
      'Amenity cancellation ' || booking.id::text || ': ' || booking.amenity_name,
      auth.uid()
    ) RETURNING id INTO credit_id;
  END IF;
  PERFORM set_config('homeish.amenity_mutation', 'on', true);
  UPDATE public.amenity_bookings
  SET status = 'cancelled',
    cancelled_at = clock_timestamp(),
    cancelled_by = auth.uid(),
    cancel_reason = CASE
      WHEN admin_cancel THEN btrim(p_reason) ELSE 'Cancelled by resident' END,
    credit_ledger_id = credit_id
  WHERE id = booking.id;
  PERFORM set_config('homeish.amenity_mutation', 'off', true);
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  ) VALUES (
    p_society_id, auth.uid(),
    CASE WHEN admin_cancel THEN 'admin' ELSE 'resident' END,
    'amenity.cancel', 'amenity_booking', booking.id::text,
    jsonb_build_object(
      'admin_cancel', admin_cancel,
      'credit_paise', CASE WHEN credit_id IS NULL THEN 0 ELSE booking.fee_paise END,
      'status_before', booking.status
    ),
    p_request_trace
  );
  IF admin_cancel THEN
    FOR recipient IN
      SELECT DISTINCT membership.user_id
      FROM public.memberships membership
      WHERE membership.society_id = p_society_id
        AND membership.status = 'active'
        AND (
          membership.user_id = booking.booked_by
          OR EXISTS (
            SELECT 1 FROM public.unit_occupants occupant
            WHERE occupant.society_id = p_society_id
              AND occupant.unit_id = booking.unit_id
              AND occupant.membership_id = membership.id
              AND occupant.status = 'active'
          )
        )
    LOOP
      PERFORM private.create_notification(
        p_society_id, recipient.user_id, 'amenity_cancelled',
        'Amenity booking cancelled',
        left(booking.amenity_name || ': ' || btrim(p_reason), 300),
        'amenity_booking', booking.id, p_request_trace
      );
    END LOOP;
  END IF;
  RETURN booking.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.amenity_workspace(
  p_society_id uuid, p_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  zone text;
  manager boolean;
BEGIN
  PERFORM private.amenity_authorize(p_society_id, false, false);
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'Choose a booking date.' USING ERRCODE = '22023';
  END IF;
  SELECT timezone INTO zone FROM public.societies WHERE id = p_society_id;
  manager := private.has_role(p_society_id, ARRAY['admin', 'committee']::text[]);
  RETURN jsonb_build_object(
    'today', private.housekeeping_local_date(p_society_id),
    'date', p_date,
    'timezone', zone,
    'can_manage', private.has_role(p_society_id, ARRAY['admin']::text[]),
    'can_book', private.has_role(p_society_id, ARRAY['admin', 'resident']::text[]),
    'billing_enabled', private.module_enabled(p_society_id, 'billing'),
    'expense_enabled', private.module_enabled(p_society_id, 'expense'),
    'deposit_confirmation_policy', coalesce((
      SELECT config.settings ->> 'deposit_confirmation_policy'
      FROM public.module_configs config
      WHERE config.society_id = p_society_id
        AND config.module_key = 'amenity'
    ), 'per_amenity'),
    'amenities', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', amenity.id,
        'name', amenity.name,
        'capacity', amenity.capacity,
        'fee_paise', amenity.fee_paise,
        'deposit_paise', amenity.deposit_paise,
        'deposit_required_before_confirmation',
          amenity.deposit_required_before_confirmation,
        'rules', amenity.rules,
        'active', amenity.active,
        'updated_at', amenity.updated_at
      ) ORDER BY amenity.name, amenity.id)
      FROM public.amenities amenity
      WHERE amenity.society_id = p_society_id
        AND (amenity.active OR manager)
    ), '[]'::jsonb),
    'slots', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', slot.id,
        'amenity_id', slot.amenity_id,
        'weekday', slot.weekday,
        'start', to_char(date '2000-01-01' + slot.starts_local, 'HH24:MI'),
        'end', to_char(date '2000-01-01' + slot.ends_local, 'HH24:MI')
      ) ORDER BY slot.weekday, slot.starts_local)
      FROM public.amenity_slots slot
      JOIN public.amenities amenity ON amenity.id = slot.amenity_id
      WHERE slot.society_id = p_society_id
        AND slot.active
        AND (amenity.active OR manager)
    ), '[]'::jsonb),
    'occurrences', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'slot_id', slot.id,
        'amenity_id', slot.amenity_id,
        'starts_at', occurrence.starts_at,
        'ends_at', occurrence.ends_at,
        'available',
          occurrence.starts_at >= now() + interval '24 hours'
          AND occurrence.ends_at > occurrence.starts_at
          AND (occurrence.starts_at AT TIME ZONE zone) = p_date + slot.starts_local
          AND (occurrence.ends_at AT TIME ZONE zone) = p_date + slot.ends_local
          AND (
            amenity.fee_paise = 0
            OR private.module_enabled(p_society_id, 'billing')
          )
          AND (
            amenity.deposit_paise IS NULL
            OR private.module_enabled(p_society_id, 'expense')
          )
          AND NOT EXISTS (
            SELECT 1 FROM public.amenity_bookings booking
            WHERE booking.society_id = p_society_id
              AND booking.amenity_id = slot.amenity_id
              AND booking.status IN ('confirmed', 'awaiting_deposit')
              AND booking.booking_span && tstzrange(
                least(occurrence.starts_at, occurrence.ends_at),
                greatest(occurrence.starts_at, occurrence.ends_at),
                '[)'
              )
          )
      ) ORDER BY occurrence.starts_at, slot.id)
      FROM public.amenity_slots slot
      JOIN public.amenities amenity ON amenity.id = slot.amenity_id
      CROSS JOIN LATERAL (
        SELECT
          (p_date + slot.starts_local) AT TIME ZONE zone AS starts_at,
          (p_date + slot.ends_local) AT TIME ZONE zone AS ends_at
      ) occurrence
      WHERE slot.society_id = p_society_id
        AND slot.active
        AND amenity.active
        AND slot.weekday = extract(dow FROM p_date)::smallint
    ), '[]'::jsonb),
    'units', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', unit.id, 'number', unit.number
      ) ORDER BY unit.number)
      FROM public.units unit
      WHERE unit.society_id = p_society_id
        AND unit.active
        AND private.occupies_unit(unit.id)
    ), '[]'::jsonb),
    'expense_accounts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', account.id,
        'name', account.name,
        'account_type', account.account_type
      ) ORDER BY account.account_type, lower(account.name))
      FROM public.expense_accounts account
      WHERE account.society_id = p_society_id
        AND account.active
        AND account.account_type IN ('cash', 'bank')
        AND private.has_role(p_society_id, ARRAY['admin']::text[])
        AND private.module_enabled(p_society_id, 'expense')
    ), '[]'::jsonb),
    'busy', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'amenity_id', amenity_id,
        'starts_at', starts_at,
        'ends_at', ends_at
      ))
      FROM public.amenity_bookings
      WHERE society_id = p_society_id
        AND status IN ('confirmed', 'awaiting_deposit')
        AND (starts_at AT TIME ZONE zone)::date = p_date
    ), '[]'::jsonb),
    'bookings', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', booking.id,
        'amenity_id', booking.amenity_id,
        'amenity_name', booking.amenity_name,
        'unit_number', unit.number,
        'starts_at', booking.starts_at,
        'ends_at', booking.ends_at,
        'guest_count', booking.guest_count,
        'fee_paise', booking.fee_paise,
        'rules_snapshot', booking.rules_snapshot,
        'status', booking.status,
        'cancel_reason', booking.cancel_reason,
        'can_cancel',
          booking.status <> 'cancelled'
          AND (
            private.has_role(p_society_id, ARRAY['admin']::text[])
            OR (
              booking.booked_by = auth.uid()
              AND booking.starts_at > now()
              AND private.occupies_unit(booking.unit_id)
            )
          ),
        'deposit', CASE WHEN deposit.booking_id IS NULL THEN NULL ELSE
          jsonb_build_object(
            'original_amount_paise', deposit.original_amount_paise,
            'current_amount_paise', deposit.current_amount_paise,
            'required_before_confirmation', deposit.required_before_confirmation,
            'version', deposit.version,
            'received_paise', totals.received_paise,
            'refunded_paise', totals.refunded_paise,
            'deducted_paise', totals.deducted_paise,
            'held_paise', totals.held_paise,
            'remaining_paise', greatest(
              deposit.current_amount_paise - totals.received_paise, 0
            ),
            'can_override',
              booking.status = 'awaiting_deposit'
              AND private.has_role(p_society_id, ARRAY['admin']::text[])
              AND totals.received_paise = 0,
            'events', coalesce((
              SELECT jsonb_agg(jsonb_build_object(
                'id', event.id,
                'kind', event.kind,
                'amount_paise', event.amount_paise,
                'event_date', event.event_date,
                'account_name', account.name,
                'evidence_path', event.evidence_path,
                'reason', event.reason,
                'reference', event.reference,
                'voids_event_id', event.voids_event_id,
                'created_at', event.created_at,
                'is_voided', EXISTS (
                  SELECT 1
                  FROM public.amenity_booking_deposit_events void
                  WHERE void.society_id = event.society_id
                    AND void.kind = 'void'
                    AND void.voids_event_id = event.id
                )
              ) ORDER BY event.created_at, event.id)
              FROM public.amenity_booking_deposit_events event
              LEFT JOIN public.expense_accounts account
                ON account.society_id = event.society_id
                AND account.id = event.account_id
              WHERE event.society_id = booking.society_id
                AND event.booking_id = booking.id
            ), '[]'::jsonb)
          )
        END
      ) ORDER BY booking.starts_at, booking.id)
      FROM public.amenity_bookings booking
      JOIN public.units unit
        ON unit.society_id = booking.society_id AND unit.id = booking.unit_id
      LEFT JOIN public.amenity_booking_deposits deposit
        ON deposit.society_id = booking.society_id
        AND deposit.booking_id = booking.id
      LEFT JOIN LATERAL private.amenity_deposit_totals(
        booking.society_id, booking.id
      ) totals ON true
      WHERE booking.society_id = p_society_id
        AND (booking.starts_at AT TIME ZONE zone)::date = p_date
        AND (manager OR private.occupies_unit(booking.unit_id))
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION private.amenity_deposit_file_access(
  p_path text, p_upload boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  path_society_id uuid;
  path_booking_id uuid;
  booking public.amenity_bookings;
BEGIN
  IF p_path !~ '^[0-9a-f-]{36}/amenity-deposits/[0-9a-f-]{36}/[0-9a-f-]+\.(jpg|png|pdf)$'
  THEN
    RETURN false;
  END IF;
  path_society_id := (string_to_array(p_path, '/'))[1]::uuid;
  path_booking_id := (string_to_array(p_path, '/'))[3]::uuid;
  SELECT * INTO booking
  FROM public.amenity_bookings
  WHERE society_id = path_society_id AND id = path_booking_id;
  IF NOT FOUND OR NOT private.module_enabled(path_society_id, 'amenity') THEN
    RETURN false;
  END IF;
  IF p_upload THEN
    RETURN private.has_role(path_society_id, ARRAY['admin']::text[])
      AND private.society_writable(path_society_id);
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.amenity_booking_deposit_events event
    WHERE event.society_id = path_society_id
      AND event.booking_id = path_booking_id
      AND event.evidence_path = p_path
  ) AND (
    private.has_role(path_society_id, ARRAY['admin', 'committee']::text[])
    OR (
      private.has_role(path_society_id, ARRAY['resident']::text[])
      AND private.occupies_unit(booking.unit_id)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION private.amenity_deposit_file_access(text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.amenity_deposit_file_access(text, boolean)
  TO authenticated;

CREATE FUNCTION public.amenity_deposit_file_access(
  p_society_id uuid, p_booking_id uuid, p_upload boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  booking public.amenity_bookings;
BEGIN
  SELECT * INTO booking
  FROM public.amenity_bookings
  WHERE society_id = p_society_id AND id = p_booking_id;
  IF NOT FOUND OR NOT private.module_enabled(p_society_id, 'amenity') THEN
    RETURN false;
  END IF;
  IF p_upload THEN
    RETURN private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id);
  END IF;
  RETURN private.has_role(
      p_society_id, ARRAY['admin', 'committee']::text[]
    )
    OR (
      private.has_role(p_society_id, ARRAY['resident']::text[])
      AND private.occupies_unit(booking.unit_id)
    );
END;
$$;

CREATE FUNCTION public.amenity_deposit_file_path_access(p_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.amenity_deposit_file_access(p_path, false)
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'amenity-deposit-evidence',
  'amenity-deposit-evidence',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']::text[]
);
CREATE POLICY amenity_deposit_evidence_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'amenity-deposit-evidence'
    AND private.amenity_deposit_file_access(name, false)
  );
CREATE POLICY amenity_deposit_evidence_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'amenity-deposit-evidence'
    AND private.amenity_deposit_file_access(name, true)
  );

CREATE OR REPLACE FUNCTION private.amenity_deposit_open_bookings(p_society_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.amenity_booking_deposits deposit
    JOIN public.amenity_bookings booking
      ON booking.society_id = deposit.society_id
      AND booking.id = deposit.booking_id
    CROSS JOIN LATERAL private.amenity_deposit_totals(
      deposit.society_id, deposit.booking_id
    ) totals
    WHERE deposit.society_id = p_society_id
      AND booking.status <> 'cancelled'
      AND (
        booking.status = 'awaiting_deposit'
        OR totals.held_paise <> 0
        OR totals.received_paise < deposit.current_amount_paise
      )
  )
$$;
REVOKE ALL ON FUNCTION private.amenity_deposit_open_bookings(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.amenity_deposit_module_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.enabled
    AND NOT NEW.enabled
    AND NEW.module_key IN ('amenity', 'expense')
    AND private.amenity_deposit_open_bookings(NEW.society_id)
  THEN
    RAISE EXCEPTION 'Settle amenity deposits before disabling Amenity or Accounts.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.amenity_deposit_module_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER amenity_deposit_module_guard
  BEFORE UPDATE OF enabled ON public.module_configs
  FOR EACH ROW EXECUTE FUNCTION private.amenity_deposit_module_guard();

ALTER FUNCTION public.expense_statements(uuid, date, date)
  RENAME TO expense_statements_p35_base;
ALTER FUNCTION public.expense_statements_p35_base(uuid, date, date)
  SET SCHEMA private;
REVOKE ALL ON FUNCTION private.expense_statements_p35_base(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_statements(
  p_society_id uuid, p_from date, p_to date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  base jsonb;
  held_receipts bigint;
  held_refunds bigint;
  retained_income bigint;
BEGIN
  base := private.expense_statements_p35_base(p_society_id, p_from, p_to);
  SELECT
    coalesce(sum(event.amount_paise) FILTER (
      WHERE event.kind = 'receipt'
    ), 0),
    coalesce(sum(event.amount_paise) FILTER (
      WHERE event.kind = 'refund'
    ), 0),
    coalesce(sum(event.amount_paise) FILTER (
      WHERE event.kind = 'deduction'
    ), 0)
  INTO held_receipts, held_refunds, retained_income
  FROM public.amenity_booking_deposit_events event
  WHERE event.society_id = p_society_id
    AND event.event_date BETWEEN p_from AND p_to
    AND event.kind <> 'void'
    AND NOT EXISTS (
      SELECT 1
      FROM public.amenity_booking_deposit_events void
      WHERE void.society_id = event.society_id
        AND void.kind = 'void'
        AND void.voids_event_id = event.id
    );
  RETURN base || jsonb_build_object(
    'held_deposit_receipts_paise', held_receipts,
    'held_deposit_refunds_paise', held_refunds,
    'retained_deposit_income_paise', retained_income
  );
END;
$$;
REVOKE ALL ON FUNCTION public.expense_statements(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expense_statements(uuid, date, date)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.expense_budget_head_actuals(
  p_society_id uuid, p_from date, p_to date
)
RETURNS TABLE (
  category_id uuid,
  income_type text,
  month date,
  amount_paise bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH roots AS (
    SELECT
      entry.entry_date,
      entry.direction,
      entry.amount_paise,
      coalesce(entry.reverses_entry_id, entry.id) AS root_entry_id
    FROM public.expense_book_entries entry
    WHERE entry.society_id = p_society_id
      AND entry.entry_date BETWEEN p_from AND p_to
      AND entry.transfer_pair_id IS NULL
      AND entry.source <> 'amenity_deposit'
  ),
  classified AS (
    SELECT
      root.category_id,
      CASE WHEN root.source = 'billing_payment' THEN 'billing'
        ELSE root.income_kind END AS income_type,
      (roots.entry_date
        - (extract(day FROM roots.entry_date)::integer - 1))::date AS month,
      CASE
        WHEN root.category_id IS NOT NULL
          THEN CASE WHEN roots.direction = 'out'
            THEN roots.amount_paise ELSE -roots.amount_paise END
        ELSE CASE WHEN roots.direction = 'in'
          THEN roots.amount_paise ELSE -roots.amount_paise END
      END AS signed_amount
    FROM roots
    JOIN public.expense_book_entries root
      ON root.society_id = p_society_id AND root.id = roots.root_entry_id
    WHERE root.category_id IS NOT NULL
      OR root.source IN ('income', 'billing_payment')
  ),
  book_actuals AS (
    SELECT category_id, income_type, month, sum(signed_amount)::bigint AS amount
    FROM classified
    GROUP BY category_id, income_type, month
  ),
  deposit_actuals AS (
    SELECT
      NULL::uuid AS category_id,
      'other'::text AS income_type,
      date_trunc('month', event.event_date)::date AS month,
      sum(event.amount_paise)::bigint AS amount
    FROM public.amenity_booking_deposit_events event
    WHERE event.society_id = p_society_id
      AND event.kind = 'deduction'
      AND event.event_date BETWEEN p_from AND p_to
      AND NOT EXISTS (
        SELECT 1
        FROM public.amenity_booking_deposit_events void
        WHERE void.society_id = event.society_id
          AND void.kind = 'void'
          AND void.voids_event_id = event.id
      )
    GROUP BY date_trunc('month', event.event_date)::date
  )
  SELECT category_id, income_type, month, amount
  FROM book_actuals
  UNION ALL
  SELECT category_id, income_type, month, amount
  FROM deposit_actuals
$$;
REVOKE ALL ON FUNCTION private.expense_budget_head_actuals(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.amenity_save(
  uuid, uuid, text, integer, bigint, text, boolean, jsonb, timestamptz,
  uuid, text, bigint, boolean
), public.amenity_deposit_policy_save(uuid, text, text),
  public.amenity_deposit_override(uuid, uuid, bigint, text, uuid, text),
  public.amenity_deposit_event_record(
    uuid, uuid, text, bigint, date, uuid, text, text, text, uuid, text
  ),
  public.amenity_deposit_event_void(uuid, uuid, text, uuid, text),
  public.amenity_deposit_file_access(uuid, uuid, boolean),
  public.amenity_deposit_file_path_access(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.amenity_save(
  uuid, uuid, text, integer, bigint, text, boolean, jsonb, timestamptz,
  uuid, text, bigint, boolean
), public.amenity_deposit_policy_save(uuid, text, text),
  public.amenity_deposit_override(uuid, uuid, bigint, text, uuid, text),
  public.amenity_deposit_event_record(
    uuid, uuid, text, bigint, date, uuid, text, text, text, uuid, text
  ),
  public.amenity_deposit_event_void(uuid, uuid, text, uuid, text),
  public.amenity_deposit_file_access(uuid, uuid, boolean),
  public.amenity_deposit_file_path_access(text)
  TO authenticated;
