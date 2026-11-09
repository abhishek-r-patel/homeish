CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE RESTRICT,
  email extensions.citext NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text,
  photo_path text,
  font_preference text NOT NULL DEFAULT 'manrope_sora',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_full_name_check
    CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 120),
  CONSTRAINT profiles_email_length_check
    CHECK (char_length(email) BETWEEN 1 AND 254),
  CONSTRAINT profiles_phone_check
    CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{10,15}$'),
  CONSTRAINT profiles_photo_path_check
    CHECK (photo_path IS NULL OR char_length(photo_path) <= 500),
  CONSTRAINT profiles_font_preference_check
    CHECK (font_preference IN ('manrope_sora', 'device_default')),
  CONSTRAINT profiles_status_check
    CHECK (status IN ('active', 'disabled', 'anonymized'))
);

CREATE TABLE public.developers (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.societies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit_label text NOT NULL DEFAULT 'Unit',
  address text,
  city text,
  contact_email extensions.citext,
  contact_phone text,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  currency text NOT NULL DEFAULT 'INR',
  logo_path text,
  status text NOT NULL DEFAULT 'trial',
  plan text,
  gate_login_mode text NOT NULL DEFAULT 'individual',
  join_code text UNIQUE,
  guard_identification text NOT NULL DEFAULT 'pick_name',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  CONSTRAINT societies_name_check
    CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  CONSTRAINT societies_address_check
    CHECK (address IS NULL OR char_length(address) <= 120),
  CONSTRAINT societies_city_check
    CHECK (city IS NULL OR char_length(city) <= 120),
  CONSTRAINT societies_contact_email_check
    CHECK (contact_email IS NULL OR char_length(contact_email) <= 254),
  CONSTRAINT societies_unit_label_check
    CHECK (
      unit_label = btrim(unit_label)
      AND char_length(unit_label) BETWEEN 1 AND 24
      AND unit_label ~ '^[[:alpha:] ]+$'
    ),
  CONSTRAINT societies_contact_phone_check
    CHECK (contact_phone IS NULL OR contact_phone ~ '^\+?[0-9]{10,15}$'),
  CONSTRAINT societies_timezone_check
    CHECK (char_length(timezone) BETWEEN 1 AND 64),
  CONSTRAINT societies_logo_path_check
    CHECK (logo_path IS NULL OR char_length(logo_path) <= 500),
  CONSTRAINT societies_currency_check
    CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT societies_status_check
    CHECK (status IN ('trial', 'active', 'suspended', 'archived')),
  CONSTRAINT societies_plan_check
    CHECK (plan IS NULL OR char_length(plan) <= 120),
  CONSTRAINT societies_gate_login_mode_check
    CHECK (gate_login_mode IN ('individual', 'shared')),
  CONSTRAINT societies_join_code_check
    CHECK (join_code IS NULL OR join_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  CONSTRAINT societies_guard_identification_check
    CHECK (guard_identification IN ('pick_name', 'pin'))
);

CREATE TABLE public.modules (
  key text PRIMARY KEY,
  name text NOT NULL,
  is_core boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL,
  CONSTRAINT modules_key_check CHECK (
    key IN (
      'core',
      'visitor',
      'delivery',
      'billing',
      'service_request',
      'staff',
      'housekeeping',
      'amc',
      'notice',
      'amenity'
    )
  ),
  CONSTRAINT modules_name_check
    CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT modules_is_core_check CHECK (is_core = (key = 'core')),
  CONSTRAINT modules_sort_order_check CHECK (sort_order >= 0)
);

CREATE TABLE public.module_configs (
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  module_key text NOT NULL REFERENCES public.modules (key) ON DELETE RESTRICT,
  enabled boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  PRIMARY KEY (society_id, module_key),
  CONSTRAINT module_configs_settings_check
    CHECK (jsonb_typeof(settings) = 'object'),
  CONSTRAINT module_configs_core_enabled_check
    CHECK (module_key <> 'core' OR enabled)
);

INSERT INTO public.modules (key, name, is_core, sort_order)
VALUES
  ('core', 'Core Platform', true, 0),
  ('visitor', 'Visitor Management', false, 1),
  ('delivery', 'Delivery Management', false, 2),
  ('billing', 'Maintenance, Fines & Payments', false, 3),
  ('service_request', 'Service Requests', false, 4),
  ('staff', 'Staff Management', false, 5),
  ('housekeeping', 'Housekeeping Inventory', false, 6),
  ('amc', 'AMC Management', false, 7),
  ('notice', 'Notice Board', false, 8),
  ('amenity', 'Amenity Booking', false, 9);

CREATE INDEX societies_created_by_idx ON public.societies (created_by);
CREATE INDEX societies_updated_by_idx ON public.societies (updated_by);
CREATE INDEX module_configs_module_key_idx ON public.module_configs (module_key);
CREATE INDEX module_configs_updated_by_idx ON public.module_configs (updated_by);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER societies_set_updated_at
  BEFORE UPDATE ON public.societies
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER module_configs_set_updated_at
  BEFORE UPDATE ON public.module_configs
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_read_self_or_developer
  ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR private.is_developer());

CREATE POLICY profiles_update_self
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY societies_read_member_or_developer
  ON public.societies FOR SELECT TO authenticated
  USING (private.is_member(id) OR private.is_developer());

CREATE POLICY modules_read_authenticated
  ON public.modules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY module_configs_read_member
  ON public.module_configs FOR SELECT TO authenticated
  USING (private.is_member(society_id));

REVOKE ALL ON TABLE
  public.profiles,
  public.developers,
  public.societies,
  public.modules,
  public.module_configs
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, photo_path, font_preference)
  ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.societies TO authenticated;
GRANT SELECT ON TABLE public.modules TO authenticated;
GRANT SELECT ON TABLE public.module_configs TO authenticated;
