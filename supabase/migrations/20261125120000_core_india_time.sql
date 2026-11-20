-- Fix society time to IST without shifting any recorded instants.
ALTER TABLE public.societies DISABLE TRIGGER societies_set_updated_at;
UPDATE public.societies SET timezone = 'Asia/Kolkata'
WHERE timezone <> 'Asia/Kolkata';
ALTER TABLE public.societies ENABLE TRIGGER societies_set_updated_at;
ALTER TABLE public.societies ADD CONSTRAINT societies_india_timezone_check
  CHECK (timezone = 'Asia/Kolkata');

ALTER TABLE public.unit_occupants ALTER COLUMN started_at
  SET DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date);

-- Scope legacy CURRENT_DATE expressions to the business zone, not the caller's session.
ALTER FUNCTION public.assign_unit_occupant(uuid, uuid, uuid, text, boolean, boolean, date, text)
  SET TimeZone TO 'Asia/Kolkata';
ALTER FUNCTION public.move_unit_occupant(uuid, uuid, uuid, text)
  SET TimeZone TO 'Asia/Kolkata';
ALTER FUNCTION public.end_unit_occupancy(uuid, uuid, date, text)
  SET TimeZone TO 'Asia/Kolkata';
ALTER FUNCTION private.sync_occupants_with_membership()
  SET TimeZone TO 'Asia/Kolkata';
ALTER FUNCTION private.directory_deactivate_membership()
  SET TimeZone TO 'Asia/Kolkata';
ALTER FUNCTION private.tenancy_schedule_file_retention()
  SET TimeZone TO 'Asia/Kolkata';
ALTER FUNCTION public.record_email_send(integer)
  SET TimeZone TO 'Asia/Kolkata';
