CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

CREATE TABLE public.amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 10000),
  fee_paise bigint NOT NULL DEFAULT 0 CHECK (fee_paise BETWEEN 0 AND 9007199254740991),
  rules text NOT NULL DEFAULT '' CHECK (char_length(rules)<=5000),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  client_request_id uuid NOT NULL,
  UNIQUE(society_id,id),
  UNIQUE(society_id,created_by,client_request_id)
);
CREATE UNIQUE INDEX amenities_name_idx ON public.amenities(society_id,lower(name));
CREATE INDEX amenities_created_by_idx ON public.amenities(created_by);
CREATE INDEX amenities_updated_by_idx ON public.amenities(updated_by);

CREATE TABLE public.amenity_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  amenity_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_local time NOT NULL,
  ends_local time NOT NULL CHECK (ends_local>starts_local),
  active boolean NOT NULL DEFAULT true,
  FOREIGN KEY(society_id,amenity_id) REFERENCES public.amenities(society_id,id),
  UNIQUE(society_id,amenity_id,id),
  EXCLUDE USING gist (
    amenity_id extensions.gist_uuid_ops WITH =,
    weekday extensions.gist_int2_ops WITH =,
    (int4range(extract(epoch FROM starts_local)::integer,extract(epoch FROM ends_local)::integer,'[)')) WITH &&
  ) WHERE(active)
);
CREATE INDEX amenity_slots_amenity_idx ON public.amenity_slots(society_id,amenity_id);
ALTER TABLE public.billing_ledger_entries ADD CONSTRAINT billing_ledger_entries_society_unit_id_key
  UNIQUE(society_id,unit_id,id);

CREATE TABLE public.amenity_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE RESTRICT,
  amenity_id uuid NOT NULL,
  slot_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  booked_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
  booking_span tstzrange GENERATED ALWAYS AS (tstzrange(starts_at,ends_at,'[)')) STORED,
  amenity_name text NOT NULL,
  capacity integer NOT NULL,
  guest_count integer NOT NULL CHECK(guest_count BETWEEN 1 AND capacity),
  fee_paise bigint NOT NULL CHECK(fee_paise BETWEEN 0 AND 9007199254740991),
  rules_snapshot text NOT NULL,
  rules_accepted boolean NOT NULL CHECK(rules_snapshot='' OR rules_accepted),
  status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled')),
  charge_ledger_id bigint UNIQUE,
  credit_ledger_id bigint UNIQUE,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  cancel_reason text CHECK(char_length(btrim(cancel_reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  client_request_id uuid NOT NULL,
  FOREIGN KEY(society_id,amenity_id,slot_id) REFERENCES public.amenity_slots(society_id,amenity_id,id),
  FOREIGN KEY(society_id,unit_id) REFERENCES public.units(society_id,id),
  FOREIGN KEY(society_id,unit_id,charge_ledger_id) REFERENCES public.billing_ledger_entries(society_id,unit_id,id),
  FOREIGN KEY(society_id,unit_id,credit_ledger_id) REFERENCES public.billing_ledger_entries(society_id,unit_id,id),
  UNIQUE(society_id,booked_by,client_request_id),
  CHECK((fee_paise=0)=(charge_ledger_id IS NULL)),
  CHECK(
    (status='confirmed' AND cancelled_at IS NULL AND cancelled_by IS NULL AND cancel_reason IS NULL AND credit_ledger_id IS NULL)
    OR (status='cancelled' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancel_reason IS NOT NULL
      AND ((fee_paise=0)=(credit_ledger_id IS NULL)))
  ),
  EXCLUDE USING gist(amenity_id extensions.gist_uuid_ops WITH =,booking_span WITH &&) WHERE(status='confirmed')
);
CREATE INDEX amenity_bookings_slot_idx ON public.amenity_bookings(society_id,amenity_id,slot_id);
CREATE INDEX amenity_bookings_unit_idx ON public.amenity_bookings(society_id,unit_id,starts_at);
CREATE INDEX amenity_bookings_charge_idx ON public.amenity_bookings(society_id,unit_id,charge_ledger_id);
CREATE INDEX amenity_bookings_credit_idx ON public.amenity_bookings(society_id,unit_id,credit_ledger_id);
CREATE INDEX amenity_bookings_booked_by_idx ON public.amenity_bookings(booked_by);
CREATE INDEX amenity_bookings_cancelled_by_idx ON public.amenity_bookings(cancelled_by);

ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenity_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenity_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.amenities,public.amenity_slots,public.amenity_bookings FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY amenities_no_direct_access ON public.amenities FOR ALL TO authenticated USING(false) WITH CHECK(false);
CREATE POLICY amenity_slots_no_direct_access ON public.amenity_slots FOR ALL TO authenticated USING(false) WITH CHECK(false);
CREATE POLICY amenity_bookings_no_direct_access ON public.amenity_bookings FOR ALL TO authenticated USING(false) WITH CHECK(false);

CREATE FUNCTION private.amenity_authorize(p_society_id uuid,p_manage boolean,p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.module_enabled(p_society_id,'amenity')
    OR NOT private.has_role(p_society_id,CASE WHEN p_manage THEN ARRAY['admin']::text[] ELSE ARRAY['admin','committee','resident']::text[] END)
    OR (p_write AND NOT private.society_writable(p_society_id))
  THEN RAISE EXCEPTION 'Amenity access is not available.' USING ERRCODE='42501'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.amenity_authorize(uuid,boolean,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.amenity_booking_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Booking history is immutable.' USING ERRCODE='42501'; END IF;
  IF ROW(NEW.id,NEW.society_id,NEW.amenity_id,NEW.slot_id,NEW.unit_id,NEW.booked_by,NEW.starts_at,NEW.ends_at,
    NEW.amenity_name,NEW.capacity,NEW.guest_count,NEW.fee_paise,NEW.rules_snapshot,NEW.rules_accepted,NEW.charge_ledger_id,NEW.created_at,NEW.client_request_id)
    IS DISTINCT FROM ROW(OLD.id,OLD.society_id,OLD.amenity_id,OLD.slot_id,OLD.unit_id,OLD.booked_by,OLD.starts_at,OLD.ends_at,
    OLD.amenity_name,OLD.capacity,OLD.guest_count,OLD.fee_paise,OLD.rules_snapshot,OLD.rules_accepted,OLD.charge_ledger_id,OLD.created_at,OLD.client_request_id)
    OR current_setting('homeish.amenity_mutation',true) IS DISTINCT FROM 'on'
  THEN RAISE EXCEPTION 'Booking snapshots are immutable.' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.amenity_booking_immutable() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER amenity_bookings_immutable BEFORE UPDATE OR DELETE ON public.amenity_bookings
  FOR EACH ROW EXECUTE FUNCTION private.amenity_booking_immutable();

CREATE FUNCTION public.amenity_save(
  p_society_id uuid,p_amenity_id uuid,p_name text,p_capacity integer,p_fee_paise bigint,p_rules text,p_active boolean,
  p_slots jsonb,p_expected_updated_at timestamptz,p_client_request_id uuid,p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row public.amenities; saved_id uuid; slot jsonb; old_slots jsonb;
BEGIN
  PERFORM private.amenity_authorize(p_society_id,true,true);
  IF p_fee_paise>0 AND NOT private.module_enabled(p_society_id,'billing') THEN RAISE EXCEPTION 'Paid amenities require billing.' USING ERRCODE='23514'; END IF;
  IF p_client_request_id IS NULL OR p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
    OR jsonb_typeof(p_slots) IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'Check the amenity details.' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(p_slots) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Add between one and 100 recurring slots.' USING ERRCODE='22023'; END IF;
  FOR slot IN SELECT value FROM jsonb_array_elements(p_slots) LOOP
    IF jsonb_typeof(slot) <> 'object' OR NOT (slot ?& ARRAY['weekday','start','end'])
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(slot) AS key WHERE key NOT IN ('weekday','start','end'))
      OR jsonb_typeof(slot->'weekday') IS DISTINCT FROM 'number' OR (slot->>'weekday') !~ '^[0-6]$'
      OR (slot->>'start') IS NULL OR (slot->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      OR (slot->>'end') IS NULL OR (slot->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      OR (slot->>'end') <= (slot->>'start')
    THEN RAISE EXCEPTION 'Check recurring weekday slots.' USING ERRCODE='22023'; END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_society_id::text||auth.uid()::text||p_client_request_id::text,0));
  IF p_amenity_id IS NULL THEN
    SELECT * INTO old_row FROM public.amenities WHERE society_id=p_society_id AND created_by=auth.uid() AND client_request_id=p_client_request_id;
    IF FOUND THEN
      SELECT jsonb_agg(jsonb_build_object('weekday',weekday,'start',to_char(date '2000-01-01'+starts_local,'HH24:MI'),'end',to_char(date '2000-01-01'+ends_local,'HH24:MI')) ORDER BY weekday,starts_local)
        INTO old_slots FROM public.amenity_slots WHERE society_id=p_society_id AND amenity_id=old_row.id AND active;
      IF ROW(old_row.name,old_row.capacity,old_row.fee_paise,old_row.rules,old_row.active)
        IS DISTINCT FROM ROW(btrim(p_name),p_capacity,p_fee_paise,p_rules,p_active)
        OR old_slots IS DISTINCT FROM (SELECT jsonb_agg(value ORDER BY (value->>'weekday')::integer,value->>'start') FROM jsonb_array_elements(p_slots))
      THEN RAISE EXCEPTION 'Retry details changed.' USING ERRCODE='23505'; END IF;
      RETURN old_row.id;
    END IF;
    IF p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'Invalid edit version.' USING ERRCODE='22023'; END IF;
    INSERT INTO public.amenities(society_id,name,capacity,fee_paise,rules,active,created_by,updated_by,client_request_id)
      VALUES(p_society_id,btrim(p_name),p_capacity,p_fee_paise,p_rules,p_active,auth.uid(),auth.uid(),p_client_request_id) RETURNING id INTO saved_id;
  ELSE
    SELECT * INTO old_row FROM public.amenities WHERE society_id=p_society_id AND id=p_amenity_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Amenity not found.' USING ERRCODE='P0002'; END IF;
    IF old_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Amenity changed. Refresh.' USING ERRCODE='23505'; END IF;
    UPDATE public.amenities SET name=btrim(p_name),capacity=p_capacity,fee_paise=p_fee_paise,rules=p_rules,active=p_active,
      updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id=p_amenity_id;
    UPDATE public.amenity_slots SET active=false WHERE society_id=p_society_id AND amenity_id=p_amenity_id AND active;
    saved_id:=p_amenity_id;
  END IF;
  FOR slot IN SELECT value FROM jsonb_array_elements(p_slots) LOOP
    INSERT INTO public.amenity_slots(society_id,amenity_id,weekday,starts_local,ends_local)
      VALUES(p_society_id,saved_id,(slot->>'weekday')::smallint,(slot->>'start')::time,(slot->>'end')::time);
  END LOOP;
  INSERT INTO public.audit_logs(society_id,actor_id,actor_role,action,entity_type,entity_id,"after",request_id)
    VALUES(p_society_id,auth.uid(),'admin','amenity.save','amenity',saved_id::text,jsonb_build_object('active',p_active,'capacity',p_capacity,'slots',p_slots),p_request_trace);
  RETURN saved_id;
END;
$$;

CREATE FUNCTION public.amenity_book(
  p_society_id uuid,p_amenity_id uuid,p_slot_id uuid,p_date date,p_unit_id uuid,p_guest_count integer,
  p_rules_accepted boolean,p_expected_updated_at timestamptz,p_client_request_id uuid,p_request_trace text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE amenity public.amenities; slot public.amenity_slots; existing public.amenity_bookings;
  zone text; slot_start timestamptz; slot_end timestamptz; booking_id uuid:=gen_random_uuid(); charge_id bigint;
BEGIN
  PERFORM private.amenity_authorize(p_society_id,false,true);
  IF NOT private.has_role(p_society_id,ARRAY['admin','resident']::text[]) OR NOT private.occupies_unit(p_unit_id)
    OR NOT EXISTS(SELECT 1 FROM public.units WHERE society_id=p_society_id AND id=p_unit_id AND active)
  THEN RAISE EXCEPTION 'Active unit occupancy is required.' USING ERRCODE='42501'; END IF;
  IF p_client_request_id IS NULL OR p_date IS NULL OR p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
  THEN RAISE EXCEPTION 'Check the booking details.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_society_id::text||auth.uid()::text||p_client_request_id::text,0));
  SELECT * INTO existing FROM public.amenity_bookings WHERE society_id=p_society_id AND booked_by=auth.uid() AND client_request_id=p_client_request_id;
  IF FOUND THEN
    SELECT timezone INTO zone FROM public.societies WHERE id=p_society_id;
    IF ROW(existing.amenity_id,existing.slot_id,(existing.starts_at AT TIME ZONE zone)::date,existing.unit_id,existing.guest_count,existing.rules_accepted)
      IS DISTINCT FROM ROW(p_amenity_id,p_slot_id,p_date,p_unit_id,p_guest_count,p_rules_accepted)
    THEN RAISE EXCEPTION 'Retry details changed.' USING ERRCODE='23505'; END IF;
    RETURN existing.id;
  END IF;
  SELECT * INTO amenity FROM public.amenities WHERE society_id=p_society_id AND id=p_amenity_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Amenity not found.' USING ERRCODE='P0002'; END IF;
  IF amenity.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Rules or price changed. Refresh.' USING ERRCODE='23505'; END IF;
  SELECT * INTO slot FROM public.amenity_slots WHERE society_id=p_society_id AND amenity_id=p_amenity_id AND id=p_slot_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slot not found.' USING ERRCODE='P0002'; END IF;
  IF extract(dow FROM p_date)::smallint<>slot.weekday OR p_guest_count IS NULL OR p_guest_count NOT BETWEEN 1 AND amenity.capacity
    OR p_rules_accepted IS NULL OR (amenity.rules<>'' AND NOT p_rules_accepted)
  THEN RAISE EXCEPTION 'Check guests and acknowledge the current rules.' USING ERRCODE='23514'; END IF;
  SELECT timezone INTO zone FROM public.societies WHERE id=p_society_id;
  slot_start:=(p_date+slot.starts_local) AT TIME ZONE zone;
  slot_end:=(p_date+slot.ends_local) AT TIME ZONE zone;
  IF slot_start<clock_timestamp()+interval '24 hours' OR slot_end<=slot_start
    OR (slot_start AT TIME ZONE zone) IS DISTINCT FROM p_date+slot.starts_local
    OR (slot_end AT TIME ZONE zone) IS DISTINCT FROM p_date+slot.ends_local
  THEN RAISE EXCEPTION 'Book a valid local slot at least 24 hours ahead.' USING ERRCODE='23514'; END IF;
  IF amenity.fee_paise>0 THEN
    IF NOT private.module_enabled(p_society_id,'billing') THEN RAISE EXCEPTION 'Paid amenities require billing.' USING ERRCODE='23514'; END IF;
    INSERT INTO public.billing_ledger_entries(society_id,unit_id,kind,direction,amount_paise,reason,created_by)
      VALUES(p_society_id,p_unit_id,'adjustment','debit',amenity.fee_paise,'Amenity booking '||booking_id::text||': '||amenity.name,auth.uid())
      RETURNING id INTO charge_id;
  END IF;
  INSERT INTO public.amenity_bookings(id,society_id,amenity_id,slot_id,unit_id,booked_by,starts_at,ends_at,amenity_name,
    capacity,guest_count,fee_paise,rules_snapshot,rules_accepted,charge_ledger_id,client_request_id)
  VALUES(booking_id,p_society_id,p_amenity_id,p_slot_id,p_unit_id,auth.uid(),slot_start,slot_end,amenity.name,
    amenity.capacity,p_guest_count,amenity.fee_paise,amenity.rules,p_rules_accepted,charge_id,p_client_request_id);
  INSERT INTO public.audit_logs(society_id,actor_id,actor_role,action,entity_type,entity_id,"after",request_id)
    VALUES(p_society_id,auth.uid(),CASE WHEN private.has_role(p_society_id,ARRAY['admin']::text[]) THEN 'admin' ELSE 'resident' END,
      'amenity.book','amenity_booking',booking_id::text,jsonb_build_object('starts_at',slot_start,'unit_id',p_unit_id,'fee_paise',amenity.fee_paise),p_request_trace);
  RETURN booking_id;
END;
$$;

CREATE FUNCTION public.amenity_cancel(p_society_id uuid,p_booking_id uuid,p_reason text,p_request_trace text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE booking public.amenity_bookings; admin_cancel boolean; credit_id bigint; recipient record;
BEGIN
  PERFORM private.amenity_authorize(p_society_id,false,true);
  SELECT * INTO booking FROM public.amenity_bookings WHERE society_id=p_society_id AND id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found.' USING ERRCODE='P0002'; END IF;
  admin_cancel:=private.has_role(p_society_id,ARRAY['admin']::text[]);
  IF NOT admin_cancel AND (NOT private.has_role(p_society_id,ARRAY['resident']::text[]) OR booking.booked_by<>auth.uid() OR NOT private.occupies_unit(booking.unit_id))
  THEN RAISE EXCEPTION 'Only the booker or an administrator can cancel.' USING ERRCODE='42501'; END IF;
  IF p_request_trace IS NULL OR char_length(p_request_trace) NOT BETWEEN 1 AND 128
    OR (admin_cancel AND (p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500))
  THEN RAISE EXCEPTION 'Administrators must provide a cancellation reason.' USING ERRCODE='22023'; END IF;
  IF booking.status='cancelled' THEN RETURN booking.id; END IF;
  IF NOT admin_cancel AND booking.starts_at<=clock_timestamp() THEN RAISE EXCEPTION 'This slot has already begun.' USING ERRCODE='23514'; END IF;
  IF booking.fee_paise>0 THEN
    INSERT INTO public.billing_ledger_entries(society_id,unit_id,kind,direction,amount_paise,reason,created_by)
      VALUES(p_society_id,booking.unit_id,'adjustment','credit',booking.fee_paise,'Amenity cancellation '||booking.id::text||': '||booking.amenity_name,auth.uid())
      RETURNING id INTO credit_id;
  END IF;
  PERFORM set_config('homeish.amenity_mutation','on',true);
  UPDATE public.amenity_bookings SET status='cancelled',cancelled_at=clock_timestamp(),cancelled_by=auth.uid(),
    cancel_reason=CASE WHEN admin_cancel THEN btrim(p_reason) ELSE 'Cancelled by resident' END,credit_ledger_id=credit_id
    WHERE id=booking.id;
  PERFORM set_config('homeish.amenity_mutation','off',true);
  INSERT INTO public.audit_logs(society_id,actor_id,actor_role,action,entity_type,entity_id,"after",request_id)
    VALUES(p_society_id,auth.uid(),CASE WHEN admin_cancel THEN 'admin' ELSE 'resident' END,
      'amenity.cancel','amenity_booking',booking.id::text,jsonb_build_object('admin_cancel',admin_cancel,'credit_paise',booking.fee_paise),p_request_trace);
  IF admin_cancel THEN
    FOR recipient IN SELECT DISTINCT membership.user_id FROM public.memberships AS membership
      WHERE membership.society_id=p_society_id AND membership.status='active'
        AND (membership.user_id=booking.booked_by OR EXISTS(SELECT 1 FROM public.unit_occupants WHERE society_id=p_society_id AND unit_id=booking.unit_id AND membership_id=membership.id AND status='active'))
    LOOP
      PERFORM private.create_notification(p_society_id,recipient.user_id,'amenity_cancelled','Amenity booking cancelled',
        left(booking.amenity_name||': '||btrim(p_reason),300),'amenity_booking',booking.id,p_request_trace);
    END LOOP;
  END IF;
  RETURN booking.id;
END;
$$;

CREATE FUNCTION public.amenity_workspace(p_society_id uuid,p_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE zone text; manager boolean;
BEGIN
  PERFORM private.amenity_authorize(p_society_id,false,false);
  IF p_date IS NULL THEN RAISE EXCEPTION 'Choose a booking date.' USING ERRCODE='22023'; END IF;
  SELECT timezone INTO zone FROM public.societies WHERE id=p_society_id;
  manager:=private.has_role(p_society_id,ARRAY['admin','committee']::text[]);
  RETURN jsonb_build_object('today',private.housekeeping_local_date(p_society_id),'date',p_date,'timezone',zone,
    'can_manage',private.has_role(p_society_id,ARRAY['admin']::text[]),
    'can_book',private.has_role(p_society_id,ARRAY['admin','resident']::text[]),'billing_enabled',private.module_enabled(p_society_id,'billing'),
    'amenities',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',amenity.id,'name',amenity.name,'capacity',amenity.capacity,
      'fee_paise',amenity.fee_paise,'rules',amenity.rules,'active',amenity.active,'updated_at',amenity.updated_at)
      ORDER BY name,id) FROM public.amenities AS amenity WHERE society_id=p_society_id AND (active OR manager)),'[]'::jsonb),
    'slots',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',slot.id,'amenity_id',slot.amenity_id,'weekday',slot.weekday,
      'start',to_char(date '2000-01-01'+slot.starts_local,'HH24:MI'),'end',to_char(date '2000-01-01'+slot.ends_local,'HH24:MI')) ORDER BY slot.weekday,slot.starts_local)
      FROM public.amenity_slots AS slot JOIN public.amenities AS amenity ON amenity.id=slot.amenity_id
      WHERE slot.society_id=p_society_id AND slot.active AND (amenity.active OR manager)),'[]'::jsonb),
    'occurrences',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'slot_id',slot.id,'amenity_id',slot.amenity_id,'starts_at',occurrence.starts_at,'ends_at',occurrence.ends_at,
      'available',occurrence.starts_at>=now()+interval '24 hours' AND occurrence.ends_at>occurrence.starts_at
        AND (occurrence.starts_at AT TIME ZONE zone)=p_date+slot.starts_local
        AND (occurrence.ends_at AT TIME ZONE zone)=p_date+slot.ends_local
        AND (amenity.fee_paise=0 OR private.module_enabled(p_society_id,'billing'))
        AND NOT EXISTS(SELECT 1 FROM public.amenity_bookings AS booking WHERE booking.society_id=p_society_id
          AND booking.amenity_id=slot.amenity_id AND booking.status='confirmed'
          AND booking.booking_span && tstzrange(least(occurrence.starts_at,occurrence.ends_at),greatest(occurrence.starts_at,occurrence.ends_at),'[)'))
    ) ORDER BY occurrence.starts_at,slot.id)
      FROM public.amenity_slots AS slot JOIN public.amenities AS amenity ON amenity.id=slot.amenity_id
      CROSS JOIN LATERAL(SELECT (p_date+slot.starts_local) AT TIME ZONE zone AS starts_at,(p_date+slot.ends_local) AT TIME ZONE zone AS ends_at) AS occurrence
      WHERE slot.society_id=p_society_id AND slot.active AND amenity.active AND slot.weekday=extract(dow FROM p_date)::smallint),'[]'::jsonb),
    'units',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',unit.id,'number',unit.number) ORDER BY unit.number)
      FROM public.units AS unit WHERE unit.society_id=p_society_id AND unit.active AND private.occupies_unit(unit.id)),'[]'::jsonb),
    'busy',COALESCE((SELECT jsonb_agg(jsonb_build_object('amenity_id',amenity_id,'starts_at',starts_at,'ends_at',ends_at))
      FROM public.amenity_bookings WHERE society_id=p_society_id AND status='confirmed' AND (starts_at AT TIME ZONE zone)::date=p_date),'[]'::jsonb),
    'bookings',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',booking.id,'amenity_id',booking.amenity_id,'amenity_name',booking.amenity_name,'unit_number',unit.number,
      'starts_at',booking.starts_at,'ends_at',booking.ends_at,'guest_count',booking.guest_count,'fee_paise',booking.fee_paise,
      'rules_snapshot',booking.rules_snapshot,'status',booking.status,'cancel_reason',booking.cancel_reason,
      'can_cancel',booking.status='confirmed' AND (private.has_role(p_society_id,ARRAY['admin']::text[])
        OR (booking.booked_by=auth.uid() AND booking.starts_at>now() AND private.occupies_unit(booking.unit_id)))
    ) ORDER BY booking.starts_at,booking.id)
      FROM public.amenity_bookings AS booking JOIN public.units AS unit ON unit.id=booking.unit_id
      WHERE booking.society_id=p_society_id AND (booking.starts_at AT TIME ZONE zone)::date=p_date
        AND (manager OR private.occupies_unit(booking.unit_id))),'[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.amenity_save(uuid,uuid,text,integer,bigint,text,boolean,jsonb,timestamptz,uuid,text),
  public.amenity_book(uuid,uuid,uuid,date,uuid,integer,boolean,timestamptz,uuid,text),
  public.amenity_cancel(uuid,uuid,text,text),public.amenity_workspace(uuid,date) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.amenity_save(uuid,uuid,text,integer,bigint,text,boolean,jsonb,timestamptz,uuid,text),
  public.amenity_book(uuid,uuid,uuid,date,uuid,integer,boolean,timestamptz,uuid,text),
  public.amenity_cancel(uuid,uuid,text,text),public.amenity_workspace(uuid,date) TO authenticated;
