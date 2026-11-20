-- Owner-reviewed P35 task removal: retain history, hide removed tasks and restrict removal to admins.
ALTER TABLE public.committee_action_plan_tasks
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN deletion_reason text,
  ADD CONSTRAINT committee_action_plan_tasks_deletion_check CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL AND deletion_reason IS NULL)
    OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL
      AND deletion_reason IS NOT NULL
      AND deletion_reason = btrim(deletion_reason)
      AND char_length(deletion_reason) BETWEEN 1 AND 300)
  );
CREATE INDEX committee_action_plan_tasks_deleted_by_idx
  ON public.committee_action_plan_tasks(deleted_by) WHERE deleted_by IS NOT NULL;

CREATE FUNCTION private.action_task_preserve_removed()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'A removed task cannot be edited.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.action_task_preserve_removed() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER action_task_preserve_removed BEFORE UPDATE ON public.committee_action_plan_tasks
  FOR EACH ROW EXECUTE FUNCTION private.action_task_preserve_removed();

CREATE FUNCTION public.committee_action_plan_task_delete(
  p_society_id uuid, p_task_id uuid, p_expected_version integer, p_reason text, p_request_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  task_row public.committee_action_plan_tasks;
  clean_reason text;
BEGIN
  PERFORM private.core_toolkit_write_begin(p_society_id, ARRAY['admin']::text[]);
  clean_reason := private.core_toolkit_clean_text(p_reason, 300, 'a removal reason', true);
  SELECT * INTO task_row FROM public.committee_action_plan_tasks
    WHERE society_id = p_society_id AND id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found.' USING ERRCODE = 'P0002'; END IF;
  PERFORM 1 FROM public.committee_action_plans
    WHERE society_id = p_society_id AND id = task_row.plan_id FOR UPDATE;
  SELECT * INTO task_row FROM public.committee_action_plan_tasks
    WHERE society_id = p_society_id AND id = p_task_id FOR UPDATE;
  IF task_row.deleted_at IS NOT NULL THEN RETURN; END IF;
  IF p_expected_version IS NULL OR p_expected_version <> task_row.version THEN
    RAISE EXCEPTION 'Task changed. Refresh.' USING ERRCODE = '40001';
  END IF;
  UPDATE public.committee_action_plan_tasks
    SET deleted_at = clock_timestamp(), deleted_by = auth.uid(), deletion_reason = clean_reason,
      version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
    WHERE society_id = p_society_id AND id = p_task_id;
  PERFORM private.core_toolkit_audit(
    p_society_id, 'action_plan.task_remove', 'committee_action_plan_task', p_task_id::text,
    jsonb_build_object('version', task_row.version),
    jsonb_build_object('version', task_row.version + 1, 'removed', true), p_request_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.committee_action_plan_task_delete(uuid, uuid, integer, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.committee_action_plan_task_delete(uuid, uuid, integer, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.committee_action_plans_get(p_society_id uuid, p_include_archived boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_manager boolean;
  local_today date;
  my_membership_id uuid;
  plans jsonb;
BEGIN
  PERFORM private.core_toolkit_authorize(
    p_society_id, ARRAY['admin', 'committee', 'guard', 'hk_supervisor', 'resident'], false
  );
  is_manager := private.has_role(p_society_id, ARRAY['admin', 'committee']::text[]);
  local_today := private.housekeeping_local_date(p_society_id);
  SELECT id INTO my_membership_id FROM public.memberships
    WHERE society_id = p_society_id AND user_id = auth.uid() AND status = 'active';
  WITH visible_tasks AS (
    SELECT task.*, plan.start_on + task.start_day - 1 AS start_on,
      plan.start_on + task.end_day - 1 AS due_on,
      action.status AS action_status, action.title AS action_title,
      action.due_on AS action_due_on, action.meeting_id AS action_meeting_id,
      CASE WHEN action.status = 'done' THEN 'done' ELSE task.status END AS effective_status
    FROM public.committee_action_plan_tasks AS task
    JOIN public.committee_action_plans AS plan
      ON plan.society_id = task.society_id AND plan.id = task.plan_id
    LEFT JOIN public.meeting_action_items AS action
      ON action.society_id = task.society_id AND action.id = task.meeting_action_item_id
    WHERE task.society_id = p_society_id AND task.deleted_at IS NULL
      AND (is_manager OR task.owner_membership_id = my_membership_id)
  ), task_json AS (
    SELECT task.plan_id, jsonb_agg(jsonb_build_object(
      'id', task.id, 'plan_id', task.plan_id, 'title', task.title, 'category', task.category,
      'priority', task.priority, 'owner_membership_id', task.owner_membership_id,
      'owner_name', private.core_member_name(p_society_id, task.owner_membership_id),
      'start_day', task.start_day, 'end_day', task.end_day, 'start_on', task.start_on,
      'due_on', task.due_on, 'days_left', task.due_on - local_today,
      'status', task.effective_status,
      'progress', CASE WHEN task.effective_status = 'done' THEN 100 ELSE task.progress END,
      'timeline', CASE WHEN task.effective_status = 'done' THEN 'done'
        WHEN local_today > task.due_on THEN 'overdue'
        WHEN local_today < task.start_on THEN 'upcoming' ELSE 'on_track' END,
      'notes', task.notes, 'evidence_url', task.evidence_url,
      'meeting_action', CASE WHEN task.meeting_action_item_id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', task.meeting_action_item_id, 'meeting_id', task.action_meeting_id,
        'title', task.action_title, 'status', task.action_status, 'due_on', task.action_due_on
      ) END,
      'version', task.version, 'updated_at', task.updated_at,
      'updated_by_name', private.core_toolkit_person(task.updated_by)
    ) ORDER BY task.start_day, task.end_day, task.created_at) AS tasks
    FROM visible_tasks AS task GROUP BY task.plan_id
  )
  SELECT COALESCE(jsonb_agg(
    CASE WHEN is_manager THEN jsonb_build_object(
      'id', plan.id, 'name', plan.name, 'start_on', plan.start_on, 'notes', plan.notes,
      'archived_at', plan.archived_at, 'version', plan.version, 'created_at', plan.created_at,
      'created_by_name', private.core_toolkit_person(plan.created_by), 'updated_at', plan.updated_at,
      'updated_by_name', private.core_toolkit_person(plan.updated_by),
      'tasks', COALESCE(task_json.tasks, '[]'::jsonb)
    ) ELSE jsonb_build_object(
      'id', plan.id, 'name', plan.name, 'start_on', plan.start_on,
      'archived_at', plan.archived_at, 'tasks', task_json.tasks
    ) END ORDER BY plan.archived_at NULLS FIRST, plan.start_on DESC, plan.created_at DESC
  ), '[]'::jsonb) INTO plans
  FROM public.committee_action_plans AS plan LEFT JOIN task_json ON task_json.plan_id = plan.id
  WHERE plan.society_id = p_society_id
    AND (COALESCE(p_include_archived, false) OR plan.archived_at IS NULL)
    AND (is_manager OR task_json.tasks IS NOT NULL);
  RETURN jsonb_build_object(
    'today', local_today, 'can_manage', is_manager AND private.society_writable(p_society_id),
    'can_delete_tasks', private.has_role(p_society_id, ARRAY['admin']::text[])
      AND private.society_writable(p_society_id), 'plans', plans
  );
END;
$$;
