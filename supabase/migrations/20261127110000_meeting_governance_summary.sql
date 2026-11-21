-- P43.5 meeting and committee summary for admins and committee members, derived live from P23 records.
-- Meetings are counted by their society-local start date; drafts are excluded. Action-item figures describe the
-- current state of items raised in those meetings. The per-person list is factual (counts and next due date),
-- never a score or ranking.
CREATE OR REPLACE FUNCTION public.meeting_governance_summary(
  p_society_id uuid,
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  zone text;
  today date;
  result jsonb;
BEGIN
  IF NOT private.module_enabled(p_society_id, 'meeting') THEN
    RAISE EXCEPTION 'Meeting access is required.' USING ERRCODE = '42501';
  END IF;
  PERFORM private.analytics_authorize(p_society_id, ARRAY['admin', 'committee']::text[], false);
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 731 THEN
    RAISE EXCEPTION 'Choose a period of up to 24 months.' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(society.timezone, 'Asia/Kolkata') INTO zone
  FROM public.societies society WHERE society.id = p_society_id;
  today := (now() AT TIME ZONE zone)::date;

  WITH period_meetings AS (
    SELECT meeting.id, meeting.status, meeting.quorum_percent,
      CASE WHEN meeting.meeting_type = 'committee' THEN (
        SELECT count(*) FROM public.meeting_invited_members member
        WHERE member.society_id = p_society_id AND member.meeting_id = meeting.id
      ) ELSE (
        SELECT count(*) FROM public.meeting_invited_units unit
        WHERE unit.society_id = p_society_id AND unit.meeting_id = meeting.id
      ) END::integer AS invited,
      (
        SELECT count(*) FROM public.meeting_attendance attendance
        WHERE attendance.society_id = p_society_id AND attendance.meeting_id = meeting.id
      )::integer AS present,
      EXISTS (
        SELECT 1 FROM public.meeting_minutes minutes
        WHERE minutes.society_id = p_society_id AND minutes.meeting_id = meeting.id
          AND minutes.status = 'published'
      ) AS minutes_published
    FROM public.meetings meeting
    WHERE meeting.society_id = p_society_id
      AND meeting.status <> 'draft'
      AND (meeting.starts_at AT TIME ZONE zone)::date BETWEEN p_from AND p_to
  ),
  period_items AS (
    SELECT item.owner_membership_id, item.owner_name, item.status, item.due_on, item.created_at
    FROM public.meeting_action_items item
    JOIN period_meetings meeting ON meeting.id = item.meeting_id
    WHERE item.society_id = p_society_id
  )
  SELECT jsonb_build_object(
    'today', today,
    'from', p_from,
    'to', p_to,
    'meetings', (
      SELECT jsonb_build_object(
        'scheduled', count(*) FILTER (WHERE status = 'scheduled'),
        'held', count(*) FILTER (WHERE status = 'held'),
        'cancelled', count(*) FILTER (WHERE status = 'cancelled')
      ) FROM period_meetings
    ),
    'quorum', (
      SELECT jsonb_build_object(
        'with_rule', count(*) FILTER (
          WHERE status = 'held' AND quorum_percent IS NOT NULL AND invited > 0
        ),
        'met', count(*) FILTER (
          WHERE status = 'held' AND quorum_percent IS NOT NULL AND invited > 0
            AND present * 100 >= quorum_percent * invited
        )
      ) FROM period_meetings
    ),
    'average_attendance_percent', (
      SELECT round(avg(present * 100.0 / invited), 1)
      FROM period_meetings WHERE status = 'held' AND invited > 0
    ),
    'minutes_unpublished', (
      SELECT count(*) FROM period_meetings WHERE status = 'held' AND NOT minutes_published
    ),
    'resolutions', (
      SELECT jsonb_build_object(
        'passed', count(*) FILTER (WHERE resolution.outcome = 'passed'),
        'failed', count(*) FILTER (WHERE resolution.outcome = 'failed'),
        'deferred', count(*) FILTER (WHERE resolution.outcome = 'deferred'),
        'pending', count(*) FILTER (WHERE resolution.outcome = 'pending')
      )
      FROM public.meeting_resolutions resolution
      JOIN period_meetings meeting ON meeting.id = resolution.meeting_id
      WHERE resolution.society_id = p_society_id
    ),
    'actions', (
      SELECT jsonb_build_object(
        'open', count(*) FILTER (WHERE status = 'open' AND due_on >= today),
        'overdue', count(*) FILTER (WHERE status = 'open' AND due_on < today),
        'done', count(*) FILTER (WHERE status = 'done')
      ) FROM period_items
    ),
    'owners', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
          'owner_name', owner.owner_name,
          'open', owner.open_count,
          'overdue', owner.overdue_count,
          'next_due_on', owner.next_due_on
        ) ORDER BY owner.next_due_on, owner.owner_name), '[]'::jsonb)
      FROM (
        SELECT (array_agg(owner_name ORDER BY created_at DESC))[1] AS owner_name,
          count(*) FILTER (WHERE due_on >= today)::integer AS open_count,
          count(*) FILTER (WHERE due_on < today)::integer AS overdue_count,
          min(due_on) AS next_due_on
        FROM period_items
        WHERE status = 'open'
        GROUP BY owner_membership_id
      ) owner
    )
  )
  INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.meeting_governance_summary(uuid, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.meeting_governance_summary(uuid, date, date) TO authenticated;
