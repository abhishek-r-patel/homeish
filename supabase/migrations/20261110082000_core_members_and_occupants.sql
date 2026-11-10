CREATE TABLE public.unit_occupants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  relationship text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  is_approver boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  started_at date NOT NULL DEFAULT current_date,
  ended_at date,
  CONSTRAINT unit_occupants_relationship_check
    CHECK (relationship IN ('owner', 'tenant', 'family')),
  CONSTRAINT unit_occupants_primary_relationship_check
    CHECK (NOT is_primary OR relationship IN ('owner', 'tenant')),
  CONSTRAINT unit_occupants_status_check
    CHECK (status IN ('pending', 'active', 'ended')),
  CONSTRAINT unit_occupants_dates_check
    CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT unit_occupants_society_id_id_key UNIQUE (society_id, id),
  CONSTRAINT unit_occupants_unit_same_society_fkey
    FOREIGN KEY (society_id, unit_id)
    REFERENCES public.units (society_id, id) ON DELETE RESTRICT,
  CONSTRAINT unit_occupants_membership_same_society_fkey
    FOREIGN KEY (society_id, membership_id)
    REFERENCES public.memberships (society_id, id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX unit_occupants_unit_membership_open_key
  ON public.unit_occupants (unit_id, membership_id)
  WHERE status <> 'ended';
CREATE INDEX unit_occupants_society_unit_idx
  ON public.unit_occupants (society_id, unit_id);
CREATE INDEX unit_occupants_society_membership_idx
  ON public.unit_occupants (society_id, membership_id);
CREATE UNIQUE INDEX unit_occupants_one_active_primary_key
  ON public.unit_occupants (unit_id)
  WHERE status = 'active' AND is_primary;
CREATE INDEX unit_occupants_membership_active_idx
  ON public.unit_occupants (membership_id)
  WHERE status = 'active';
CREATE INDEX unit_occupants_unit_approver_idx
  ON public.unit_occupants (unit_id)
  WHERE status = 'active' AND is_approver;
CREATE INDEX unit_occupants_created_by_idx ON public.unit_occupants (created_by);
CREATE INDEX unit_occupants_updated_by_idx ON public.unit_occupants (updated_by);

CREATE TRIGGER unit_occupants_set_updated_at
  BEFORE UPDATE ON public.unit_occupants
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at_and_actor();

ALTER TABLE public.unit_occupants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.unit_occupants
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.unit_occupants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.unit_occupants TO service_role;

CREATE OR REPLACE FUNCTION private.occupies_unit(p_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
    WHERE occupant.unit_id = p_unit_id
      AND occupant.status = 'active'
      AND membership.user_id = (SELECT auth.uid())
      AND membership.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION private.is_household_manager(p_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.unit_occupants AS occupant
    JOIN public.memberships AS membership
      ON membership.society_id = occupant.society_id
      AND membership.id = occupant.membership_id
    WHERE occupant.unit_id = p_unit_id
      AND occupant.status = 'active'
      AND membership.user_id = (SELECT auth.uid())
      AND membership.status = 'active'
      AND (occupant.relationship = 'owner' OR occupant.is_primary)
  )
$$;

REVOKE ALL ON FUNCTION private.occupies_unit(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_household_manager(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.occupies_unit(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_household_manager(uuid)
  TO authenticated, service_role;

CREATE POLICY unit_occupants_read_member
  ON public.unit_occupants FOR SELECT TO authenticated
  USING (
    private.has_role(society_id, ARRAY['admin', 'committee']::text[])
    OR EXISTS (
      SELECT 1
      FROM public.memberships AS own_membership
      WHERE own_membership.id = unit_occupants.membership_id
        AND own_membership.user_id = (SELECT auth.uid())
        AND own_membership.status = 'active'
    )
    OR private.is_household_manager(unit_id)
  );

CREATE OR REPLACE FUNCTION private.sync_occupants_with_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    UPDATE public.unit_occupants
    SET status = 'active'
    WHERE society_id = NEW.society_id
      AND membership_id = NEW.id
      AND status = 'pending';
  ELSIF NEW.status = 'deactivated' AND OLD.status IS DISTINCT FROM 'deactivated'
  THEN
    UPDATE public.unit_occupants
    SET status = 'ended',
        ended_at = current_date
    WHERE society_id = NEW.society_id
      AND membership_id = NEW.id
      AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_occupants_with_membership()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER memberships_sync_occupants
  AFTER UPDATE OF status ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION private.sync_occupants_with_membership();

CREATE OR REPLACE FUNCTION public.list_society_members(p_society_id uuid)
RETURNS TABLE (
  membership_id uuid,
  user_id uuid,
  email text,
  full_name text,
  phone_masked text,
  roles text[],
  status text,
  occupant_id uuid,
  unit_id uuid,
  unit_number text,
  block_name text,
  relationship text,
  is_primary boolean,
  is_approver boolean,
  occupant_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
    OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society manager access is required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    membership.id,
    membership.user_id,
    COALESCE(profile.email::text, membership.invited_email::text),
    profile.full_name,
    CASE
      WHEN profile.phone IS NULL THEN NULL
      ELSE pg_catalog.repeat('*', GREATEST(char_length(profile.phone) - 4, 0))
        || right(profile.phone, 4)
    END,
    membership.roles,
    membership.status,
    occupant.id,
    occupant.unit_id,
    unit.number,
    block.name,
    occupant.relationship,
    occupant.is_primary,
    occupant.is_approver,
    occupant.status
  FROM public.memberships AS membership
  LEFT JOIN public.profiles AS profile ON profile.id = membership.user_id
  LEFT JOIN public.unit_occupants AS occupant
    ON occupant.society_id = membership.society_id
    AND occupant.membership_id = membership.id
    AND occupant.status <> 'ended'
  LEFT JOIN public.units AS unit ON unit.id = occupant.unit_id
  LEFT JOIN public.blocks AS block ON block.id = unit.block_id
  WHERE membership.society_id = p_society_id
  ORDER BY COALESCE(profile.full_name, membership.invited_email::text), membership.id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_society_members(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_society_members(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_member_invitation(
  p_society_id uuid,
  p_email text,
  p_roles text[],
  p_unit_id uuid,
  p_relationship text,
  p_is_primary boolean,
  p_is_approver boolean,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_email text := lower(btrim(p_email));
  membership_id uuid;
  occupant_approver boolean;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF normalized_email IS NULL OR char_length(normalized_email) NOT BETWEEN 3 AND 254
    OR normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  THEN
    RAISE EXCEPTION 'A valid email address is required.'
      USING ERRCODE = '22023';
  END IF;
  IF p_roles IS NULL OR cardinality(p_roles) = 0
    OR NOT (p_roles <@ ARRAY[
      'admin', 'committee', 'guard', 'hk_supervisor', 'resident'
    ]::text[])
  THEN
    RAISE EXCEPTION 'One or more valid roles are required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_roles @> ARRAY['resident']::text[] THEN
    IF p_unit_id IS NULL OR p_relationship IS NULL
      OR p_relationship NOT IN ('owner', 'tenant', 'family')
      OR (p_is_primary AND p_relationship = 'family')
    THEN
      RAISE EXCEPTION 'Resident invitations require a valid unit and relationship.'
        USING ERRCODE = '22023';
    END IF;
    occupant_approver := COALESCE(
      p_is_approver,
      p_relationship IN ('owner', 'tenant')
    );
    IF NOT EXISTS (
      SELECT 1 FROM public.units AS unit
      WHERE unit.id = p_unit_id AND unit.society_id = p_society_id AND unit.active
    ) THEN
      RAISE EXCEPTION 'The selected unit is unavailable.'
        USING ERRCODE = '23503';
    END IF;
  ELSIF p_unit_id IS NOT NULL OR p_relationship IS NOT NULL
    OR p_is_primary OR p_is_approver
  THEN
    RAISE EXCEPTION 'Only resident invitations may include an occupancy.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.memberships (
    society_id, invited_email, roles, status, invited_by
  )
  VALUES (
    p_society_id, normalized_email::extensions.citext, p_roles, 'invited', auth.uid()
  )
  RETURNING id INTO membership_id;

  IF p_unit_id IS NOT NULL THEN
    INSERT INTO public.unit_occupants (
      society_id, unit_id, membership_id, relationship,
      is_primary, is_approver, status
    )
    VALUES (
      p_society_id, p_unit_id, membership_id, p_relationship,
      p_is_primary, occupant_approver, 'pending'
    );
  END IF;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'members.invite', 'membership',
    membership_id::text,
    pg_catalog.jsonb_build_object(
      'email', normalized_email, 'roles', p_roles, 'unitId', p_unit_id
    ),
    p_request_id
  );
  RETURN membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_member_roles(
  p_society_id uuid,
  p_membership_id uuid,
  p_roles text[],
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_roles text[];
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  PERFORM 1
  FROM public.societies AS society
  WHERE society.id = p_society_id
  FOR UPDATE;
  IF p_roles IS NULL OR cardinality(p_roles) = 0
    OR NOT (p_roles <@ ARRAY[
      'admin', 'committee', 'guard', 'hk_supervisor', 'resident'
    ]::text[])
  THEN
    RAISE EXCEPTION 'One or more valid roles are required.'
      USING ERRCODE = '22023';
  END IF;

  SELECT membership.roles INTO previous_roles
  FROM public.memberships AS membership
  WHERE membership.id = p_membership_id
    AND membership.society_id = p_society_id
    AND membership.status <> 'deactivated'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found.' USING ERRCODE = 'P0002';
  END IF;
  IF 'resident' = ANY(previous_roles)
    AND NOT ('resident' = ANY(p_roles))
    AND EXISTS (
      SELECT 1 FROM public.unit_occupants AS occupant
      WHERE occupant.society_id = p_society_id
        AND occupant.membership_id = p_membership_id
        AND occupant.status = 'active'
    )
  THEN
    RAISE EXCEPTION 'End active unit occupancy before removing the resident role.'
      USING ERRCODE = '23514';
  END IF;
  IF 'admin' = ANY(previous_roles) AND NOT ('admin' = ANY(p_roles))
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships AS other_admin
      WHERE other_admin.society_id = p_society_id
        AND other_admin.id <> p_membership_id
        AND other_admin.status = 'active'
        AND 'admin' = ANY(other_admin.roles)
    )
  THEN
    RAISE EXCEPTION 'A society must retain at least one active administrator.'
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.memberships
  SET roles = p_roles
  WHERE id = p_membership_id AND society_id = p_society_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'members.changeRoles', 'membership',
    p_membership_id::text,
    pg_catalog.jsonb_build_object('roles', previous_roles),
    pg_catalog.jsonb_build_object('roles', p_roles),
    p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_member(
  p_society_id uuid,
  p_membership_id uuid,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_status text;
  old_roles text[];
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  PERFORM 1
  FROM public.societies AS society
  WHERE society.id = p_society_id
  FOR UPDATE;
  SELECT membership.status, membership.roles
  INTO old_status, old_roles
  FROM public.memberships AS membership
  WHERE membership.id = p_membership_id
    AND membership.society_id = p_society_id
    AND membership.status <> 'deactivated'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found.' USING ERRCODE = 'P0002';
  END IF;
  IF old_status = 'active' AND 'admin' = ANY(old_roles)
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships AS other_admin
      WHERE other_admin.society_id = p_society_id
        AND other_admin.id <> p_membership_id
        AND other_admin.status = 'active'
        AND 'admin' = ANY(other_admin.roles)
    )
  THEN
    RAISE EXCEPTION 'A society must retain at least one active administrator.'
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.memberships
  SET status = 'deactivated', left_at = now()
  WHERE id = p_membership_id AND society_id = p_society_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'members.deactivate', 'membership',
    p_membership_id::text,
    pg_catalog.jsonb_build_object('status', old_status),
    pg_catalog.jsonb_build_object('status', 'deactivated'),
    p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_unit_occupant(
  p_society_id uuid,
  p_unit_id uuid,
  p_membership_id uuid,
  p_relationship text,
  p_is_primary boolean,
  p_is_approver boolean,
  p_started_at date,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  occupant_id uuid;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_relationship NOT IN ('owner', 'tenant', 'family')
    OR (p_is_primary AND p_relationship = 'family')
    OR NOT EXISTS (
      SELECT 1 FROM public.memberships AS membership
      WHERE membership.id = p_membership_id
        AND membership.society_id = p_society_id
        AND membership.status = 'active'
        AND 'resident' = ANY(membership.roles)
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.units AS unit
      WHERE unit.id = p_unit_id
        AND unit.society_id = p_society_id
        AND unit.active
    )
  THEN
    RAISE EXCEPTION 'The unit, resident membership, or relationship is invalid.'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.unit_occupants (
    society_id, unit_id, membership_id, relationship, is_primary,
    is_approver, status, started_at
  )
  VALUES (
    p_society_id, p_unit_id, p_membership_id, p_relationship, p_is_primary,
    p_is_approver, 'active', COALESCE(p_started_at, current_date)
  )
  RETURNING id INTO occupant_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'members.unit.assign',
    'unit_occupant', occupant_id::text,
    pg_catalog.jsonb_build_object(
      'unitId', p_unit_id, 'membershipId', p_membership_id,
      'relationship', p_relationship, 'isPrimary', p_is_primary,
      'isApprover', p_is_approver
    ),
    p_request_id
  );
  RETURN occupant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_unit_occupant(
  p_society_id uuid,
  p_occupant_id uuid,
  p_target_unit_id uuid,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_occupant public.unit_occupants%ROWTYPE;
  new_occupant_id uuid;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO old_occupant
  FROM public.unit_occupants
  WHERE id = p_occupant_id
    AND society_id = p_society_id
    AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.units AS unit
    WHERE unit.id = p_target_unit_id
      AND unit.society_id = p_society_id
      AND unit.active
  ) THEN
    RAISE EXCEPTION 'Occupancy or target unit not found.'
      USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.unit_occupants
  SET status = 'ended', ended_at = current_date
  WHERE id = old_occupant.id;
  INSERT INTO public.unit_occupants (
    society_id, unit_id, membership_id, relationship, is_primary,
    is_approver, status, started_at
  )
  VALUES (
    p_society_id, p_target_unit_id, old_occupant.membership_id,
    old_occupant.relationship, old_occupant.is_primary,
    old_occupant.is_approver, 'active', current_date
  )
  RETURNING id INTO new_occupant_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'members.unit.move',
    'unit_occupant', new_occupant_id::text,
    pg_catalog.jsonb_build_object(
      'unitId', old_occupant.unit_id, 'occupantId', old_occupant.id
    ),
    pg_catalog.jsonb_build_object(
      'unitId', p_target_unit_id, 'occupantId', new_occupant_id
    ),
    p_request_id
  );
  RETURN new_occupant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_unit_occupancy(
  p_society_id uuid,
  p_occupant_id uuid,
  p_ended_at date,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_occupant public.unit_occupants%ROWTYPE;
  end_date date := COALESCE(p_ended_at, current_date);
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO old_occupant
  FROM public.unit_occupants
  WHERE id = p_occupant_id
    AND society_id = p_society_id
    AND status <> 'ended'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Occupancy not found.' USING ERRCODE = 'P0002';
  END IF;
  IF end_date < old_occupant.started_at THEN
    RAISE EXCEPTION 'End date cannot precede the occupancy start date.'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.unit_occupants
  SET status = 'ended', ended_at = end_date
  WHERE id = p_occupant_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'members.unit.end',
    'unit_occupant', p_occupant_id::text,
    pg_catalog.jsonb_build_object('status', old_occupant.status),
    pg_catalog.jsonb_build_object('status', 'ended', 'endedAt', end_date),
    p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_household_members(p_unit_id uuid)
RETURNS TABLE (
  occupant_id uuid,
  full_name text,
  relationship text,
  is_primary boolean,
  is_approver boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_household_manager(p_unit_id) THEN
    RAISE EXCEPTION 'Household manager access is required.'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT occupant.id, profile.full_name, occupant.relationship,
    occupant.is_primary, occupant.is_approver
  FROM public.unit_occupants AS occupant
  JOIN public.memberships AS membership
    ON membership.society_id = occupant.society_id
    AND membership.id = occupant.membership_id
    AND membership.status = 'active'
  JOIN public.profiles AS profile ON profile.id = membership.user_id
  WHERE occupant.unit_id = p_unit_id
    AND occupant.status = 'active'
  ORDER BY occupant.is_primary DESC, profile.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_household_approver(
  p_occupant_id uuid,
  p_is_approver boolean,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.unit_occupants%ROWTYPE;
BEGIN
  SELECT * INTO target
  FROM public.unit_occupants
  WHERE id = p_occupant_id AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND OR NOT private.is_household_manager(target.unit_id) THEN
    RAISE EXCEPTION 'Household manager access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF target.membership_id = (
    SELECT membership.id FROM public.memberships AS membership
    WHERE membership.user_id = (SELECT auth.uid())
      AND membership.society_id = target.society_id
      AND membership.status = 'active'
  ) AND NOT p_is_approver THEN
    RAISE EXCEPTION 'You cannot remove your own approver access.'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.unit_occupants
  SET is_approver = p_is_approver
  WHERE id = p_occupant_id;
  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "before", "after", request_id
  )
  VALUES (
    target.society_id, auth.uid(), 'resident', 'household.members.setApprover',
    'unit_occupant', p_occupant_id::text,
    pg_catalog.jsonb_build_object('isApprover', target.is_approver),
    pg_catalog.jsonb_build_object('isApprover', p_is_approver),
    p_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_member_invitation(
  uuid, text, text[], uuid, text, boolean, boolean, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.change_member_roles(uuid, uuid, text[], text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.deactivate_member(uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.assign_unit_occupant(
  uuid, uuid, uuid, text, boolean, boolean, date, text
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.move_unit_occupant(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.end_unit_occupancy(uuid, uuid, date, text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.list_household_members(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.set_household_approver(uuid, boolean, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_member_invitation(
  uuid, text, text[], uuid, text, boolean, boolean, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_member_roles(uuid, uuid, text[], text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_member(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_unit_occupant(
  uuid, uuid, uuid, text, boolean, boolean, date, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_unit_occupant(uuid, uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_unit_occupancy(uuid, uuid, date, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_household_members(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_household_approver(uuid, boolean, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_resident_import_job(
  p_society_id uuid,
  p_rows jsonb,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  row_value jsonb;
  row_number integer;
  row_index integer := 0;
  row_count integer;
  imported_count integer := 0;
  failed_count integer := 0;
  unit_id uuid;
  normalized_email text;
  relationship_value text;
  primary_value boolean;
  approver_value boolean;
  membership_id uuid;
  occupant_id uuid;
  job_id uuid;
  row_errors jsonb := '[]'::jsonb;
BEGIN
  IF NOT private.has_role(p_society_id, ARRAY['admin']::text[])
    OR NOT private.society_writable(p_society_id)
    OR NOT private.module_enabled(p_society_id, 'core')
  THEN
    RAISE EXCEPTION 'Society administrator access is required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Import rows must be provided as an array.'
      USING ERRCODE = '22023';
  END IF;
  row_count := jsonb_array_length(p_rows);
  IF row_count NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Import must contain between 1 and 1000 rows.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.jobs (
    society_id, created_by, updated_by, type, status, progress
  )
  VALUES (
    p_society_id, auth.uid(), auth.uid(), 'csv_import_residents', 'running', 0
  )
  RETURNING id INTO job_id;

  FOR row_value IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    row_index := row_index + 1;
    row_number := row_index + 1;
    BEGIN
      IF jsonb_typeof(row_value) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Invalid import row.' USING ERRCODE = '22023';
      END IF;
      row_number := COALESCE(
        NULLIF(row_value ->> 'rowNumber', '')::integer,
        row_index + 1
      );
      unit_id := NULLIF(btrim(row_value ->> 'unitId'), '')::uuid;
      normalized_email := lower(btrim(COALESCE(row_value ->> 'email', '')));
      relationship_value := NULLIF(btrim(row_value ->> 'relationship'), '');
      primary_value := COALESCE((row_value ->> 'isPrimary')::boolean, false);
      approver_value := COALESCE(
        (row_value ->> 'isApprover')::boolean,
        relationship_value IN ('owner', 'tenant')
      );
      IF normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        OR char_length(normalized_email) NOT BETWEEN 3 AND 254
        OR relationship_value NOT IN ('owner', 'tenant', 'family')
        OR (primary_value AND relationship_value = 'family')
        OR unit_id IS NULL
      THEN
        RAISE EXCEPTION 'Resident row values are invalid.'
          USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.units AS unit
        WHERE unit.id = unit_id
          AND unit.society_id = p_society_id
          AND unit.active
      ) THEN
        RAISE EXCEPTION 'The selected unit is unavailable.'
          USING ERRCODE = '23503';
      END IF;

      INSERT INTO public.memberships (
        society_id, invited_email, roles, status, invited_by
      )
      VALUES (
        p_society_id, normalized_email::extensions.citext,
        ARRAY['resident']::text[], 'invited', auth.uid()
      )
      RETURNING id INTO membership_id;
      INSERT INTO public.unit_occupants (
        society_id, unit_id, membership_id, relationship,
        is_primary, is_approver, status
      )
      VALUES (
        p_society_id, unit_id, membership_id, relationship_value,
        primary_value, approver_value, 'pending'
      )
      RETURNING id INTO occupant_id;

      INSERT INTO public.audit_logs (
        society_id, actor_id, actor_role, action, entity_type, entity_id,
        "after", request_id
      )
      VALUES (
        p_society_id, auth.uid(), 'admin', 'members.importConfirm',
        'membership', membership_id::text,
        pg_catalog.jsonb_build_object(
          'email', normalized_email, 'unitId', unit_id,
          'occupantId', occupant_id, 'relationship', relationship_value
        ),
        p_request_id
      );
      imported_count := imported_count + 1;
    EXCEPTION
      WHEN unique_violation THEN
        failed_count := failed_count + 1;
        row_errors := row_errors || pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'rowNumber', row_number,
            'message', 'This email is already a member or invitation in this society.'
          )
        );
      WHEN check_violation OR invalid_text_representation
        OR numeric_value_out_of_range OR foreign_key_violation
        OR not_null_violation THEN
        failed_count := failed_count + 1;
        row_errors := row_errors || pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'rowNumber', row_number,
            'message', 'The resident row contains invalid or unavailable values.'
          )
        );
    END;
  END LOOP;

  UPDATE public.jobs
  SET status = CASE WHEN failed_count > 0 THEN 'partial' ELSE 'succeeded' END,
      progress = 100,
      summary = pg_catalog.jsonb_build_object(
        'totalRows', row_count,
        'importedRows', imported_count,
        'failedRows', failed_count,
        'errors', row_errors
      ),
      finished_at = now(),
      updated_by = auth.uid()
  WHERE id = job_id;

  INSERT INTO public.audit_logs (
    society_id, actor_id, actor_role, action, entity_type, entity_id,
    "after", request_id
  )
  VALUES (
    p_society_id, auth.uid(), 'admin', 'members.importConfirm',
    'job', job_id::text,
    pg_catalog.jsonb_build_object(
      'totalRows', row_count,
      'importedRows', imported_count,
      'failedRows', failed_count
    ),
    p_request_id
  );
  RETURN job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_resident_import_job(uuid, jsonb, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_resident_import_job(uuid, jsonb, text)
  TO authenticated;
