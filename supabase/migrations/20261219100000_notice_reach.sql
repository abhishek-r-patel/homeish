-- Count the current notice audience for managers without exposing resident identities.
CREATE OR REPLACE FUNCTION public.notice_reach_get(
  p_society_id uuid,
  p_audience text,
  p_block_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR NOT private.module_enabled(p_society_id, 'notice')
    OR NOT private.has_role(p_society_id, ARRAY['admin', 'committee']::text[])
  THEN
    RAISE EXCEPTION 'Notice management access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_audience IS NULL OR p_audience NOT IN ('all', 'blocks', 'owners') THEN
    RAISE EXCEPTION 'Choose a valid notice audience.' USING ERRCODE = '22023';
  END IF;
  IF p_block_ids IS NULL
    OR cardinality(p_block_ids) > 50
    OR cardinality(p_block_ids) <> (SELECT count(DISTINCT value) FROM unnest(p_block_ids) AS value)
  THEN
    RAISE EXCEPTION 'Choose unique notice blocks.' USING ERRCODE = '22023';
  END IF;
  IF (p_audience = 'blocks' AND cardinality(p_block_ids) = 0)
    OR (p_audience <> 'blocks' AND cardinality(p_block_ids) <> 0)
  THEN
    RAISE EXCEPTION 'The notice audience and blocks do not match.' USING ERRCODE = '22023';
  END IF;
  IF p_audience = 'blocks' AND (
    SELECT count(*) FROM public.blocks block
    WHERE block.society_id = p_society_id
      AND block.active
      AND block.id = ANY(p_block_ids)
  ) <> cardinality(p_block_ids) THEN
    RAISE EXCEPTION 'A chosen block is unavailable.' USING ERRCODE = '22023';
  END IF;

  RETURN (
    WITH eligible AS MATERIALIZED (
      SELECT DISTINCT membership.user_id, occupant.unit_id
      FROM public.memberships AS membership
      JOIN public.unit_occupants AS occupant
        ON occupant.society_id = membership.society_id
        AND occupant.membership_id = membership.id
        AND occupant.status = 'active'
      JOIN public.units AS unit
        ON unit.society_id = occupant.society_id
        AND unit.id = occupant.unit_id
        AND unit.active
      WHERE membership.society_id = p_society_id
        AND membership.status = 'active'
        AND membership.user_id IS NOT NULL
        AND membership.roles @> ARRAY['resident']::text[]
        AND (
          p_audience = 'all'
          OR (p_audience = 'owners' AND occupant.relationship = 'owner')
          OR (p_audience = 'blocks' AND unit.block_id = ANY(p_block_ids))
        )
    )
    SELECT pg_catalog.jsonb_build_object(
      'people', count(DISTINCT user_id)::integer,
      'flats', count(DISTINCT unit_id)::integer
    )
    FROM eligible
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notice_reach_get(uuid, text, uuid[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.notice_reach_get(uuid, text, uuid[])
  TO authenticated;
