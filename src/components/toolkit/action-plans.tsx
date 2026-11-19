// Committee action-plan workspace (plans, tasks, weekly timeline, summaries) and the read-only "My tasks" view.
'use client';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, StatTile, StatusChip } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { SegmentedControl } from '@/components/ui/tabs';
import { TextInput } from '@/components/ui/text-input';
import {
  ACTION_PLAN_NAME_MAX,
  ACTION_PLAN_NOTES_MAX,
  ACTION_TASK_CATEGORIES,
  ACTION_TASK_CATEGORY_LABELS,
  ACTION_TASK_DAY_MAX,
  ACTION_TASK_LINK_MAX,
  ACTION_TASK_STATUSES,
  ACTION_TASK_STATUS_LABELS,
  ACTION_TASK_TITLE_MAX,
  LINKED_ACTION_DONE_MESSAGE,
  NOT_ADDED,
  PRIORITY_LABELS,
  TOOLKIT_PRIORITIES,
  actionPlanArchiveInputSchema,
  actionPlanSampleInputSchema,
  actionPlanSaveInputSchema,
  actionPlanSummary,
  actionPlanWeeks,
  actionTaskSaveInputSchema,
  type ActionPlan,
  type ActionPlansView,
  type ActionTask,
  type MeetingActionOption,
  type ToolkitMemberOption,
} from '@/core/toolkit/validation';
import { useToolkitDates } from './shared';

export type ActionPlanActions = {
  savePlan: ModuleFormAction;
  setPlanArchived: ModuleFormAction;
  createSamplePlan: ModuleFormAction;
  saveTask: ModuleFormAction;
};

const VIEW_OPTIONS = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'timeline', label: 'Weekly timeline' },
] as const;

function savedPlanId(data: unknown) {
  return typeof data === 'object' &&
    data !== null &&
    'planId' in data &&
    typeof data.planId === 'string'
    ? data.planId
    : null;
}

export function ActionPlansWorkspace({
  view,
  members,
  meetingActions,
  actions,
  showArchived,
  archivedHref,
  activeHref,
}: {
  view: ActionPlansView;
  members: readonly ToolkitMemberOption[];
  meetingActions: readonly MeetingActionOption[];
  actions: ActionPlanActions;
  showArchived: boolean;
  archivedHref: string;
  activeHref: string;
}) {
  const { translate: t } = useUiTranslator();
  const [selectedId, setSelectedId] = useState<string | null>(
    view.plans.find((plan) => plan.archived_at === null)?.id ??
      view.plans[0]?.id ??
      null,
  );
  const [creating, setCreating] = useState(false);
  const selected =
    view.plans.find((plan) => plan.id === selectedId) ?? view.plans[0] ?? null;
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Action plans')}</h1>
        <p className="text-ink-muted">
          {t(
            'Plan committee work as dated tasks with owners, track progress week by week and spot overdue items.',
          )}
        </p>
      </header>
      {!view.can_manage ? (
        <Banner tone="info">
          {t('Plans are read-only while the society cannot be changed.')}
        </Banner>
      ) : null}
      <div className="flex flex-wrap items-center gap-space-3">
        {view.can_manage ? (
          <Button
            variant={creating ? 'secondary' : 'primary'}
            onClick={() => setCreating((value) => !value)}
          >
            {creating ? t('Close') : t('New plan')}
          </Button>
        ) : null}
        <a
          className="text-body text-brand underline"
          href={showArchived ? activeHref : archivedHref}
        >
          {showArchived ? t('Hide archived plans') : t('Show archived plans')}
        </a>
      </div>
      {creating && view.can_manage ? (
        <NewPlanForms
          today={view.today}
          actions={actions}
          onCreated={(planId) => {
            setCreating(false);
            if (planId) setSelectedId(planId);
          }}
        />
      ) : null}
      {selected === null ? (
        <EmptyState
          title={t('No action plans yet')}
          description={
            view.can_manage
              ? t('Create a blank plan or start from the sample plan.')
              : t('Plans appear here once the committee adds them.')
          }
        />
      ) : (
        <>
          {view.plans.length > 1 ? (
            <SelectInput
              id="action-plan-select"
              label={t('Plan')}
              value={selected.id}
              onChange={(event) => setSelectedId(event.target.value)}
              options={view.plans.map((plan) => ({
                value: plan.id,
                label: plan.archived_at
                  ? `${plan.name} · ${t('Archived')}`
                  : plan.name,
              }))}
            />
          ) : null}
          <PlanDetail
            key={selected.id}
            plan={selected}
            today={view.today}
            canManage={view.can_manage}
            members={members}
            meetingActions={meetingActions}
            actions={actions}
          />
        </>
      )}
    </section>
  );
}

function NewPlanForms({
  today,
  actions,
  onCreated,
}: {
  today: string;
  actions: ActionPlanActions;
  onCreated: (planId: string | null) => void;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <div className="grid min-w-0 gap-space-4 large:grid-cols-2">
      <Card title={t('Blank plan')}>
        <ModuleActionForm
          action={actions.savePlan}
          submitLabel={t('Create plan')}
          idempotent
          onSaved={(data) => onCreated(savedPlanId(data))}
          input={(form, clientRequestId) =>
            actionPlanSaveInputSchema.parse({
              planId: null,
              name: String(form.get('name') ?? ''),
              startOn: String(form.get('startOn') ?? ''),
              notes: String(form.get('notes') ?? ''),
              expectedVersion: null,
              clientRequestId,
            })
          }
        >
          <TextInput
            id="new-plan-name"
            name="name"
            label={t('Plan name')}
            maxLength={ACTION_PLAN_NAME_MAX}
            required
          />
          <TextInput
            id="new-plan-start"
            name="startOn"
            type="date"
            label={t('Start date')}
            defaultValue={today}
            required
          />
          <TextAreaInput
            id="new-plan-notes"
            name="notes"
            label={t('Notes')}
            maxLength={ACTION_PLAN_NOTES_MAX}
          />
        </ModuleActionForm>
      </Card>
      <Card title={t('From the sample plan')}>
        <p className="text-caption text-ink-muted">
          {t(
            'Copies a starter 90-day plan with suggested tasks. Owners stay empty until you assign them.',
          )}
        </p>
        <ModuleActionForm
          action={actions.createSamplePlan}
          submitLabel={t('Create from sample')}
          idempotent
          onSaved={(data) => onCreated(savedPlanId(data))}
          input={(form, clientRequestId) =>
            actionPlanSampleInputSchema.parse({
              name: String(form.get('name') ?? ''),
              startOn: String(form.get('startOn') ?? ''),
              clientRequestId,
            })
          }
        >
          <TextInput
            id="sample-plan-name"
            name="name"
            label={t('Plan name')}
            helpText={t('Leave blank to use the sample name.')}
            maxLength={ACTION_PLAN_NAME_MAX}
          />
          <TextInput
            id="sample-plan-start"
            name="startOn"
            type="date"
            label={t('Start date')}
            defaultValue={today}
          />
        </ModuleActionForm>
      </Card>
    </div>
  );
}

function PlanDetail({
  plan,
  today,
  canManage,
  members,
  meetingActions,
  actions,
}: {
  plan: ActionPlan;
  today: string;
  canManage: boolean;
  members: readonly ToolkitMemberOption[];
  meetingActions: readonly MeetingActionOption[];
  actions: ActionPlanActions;
}) {
  const { translate: t } = useUiTranslator();
  const dates = useToolkitDates();
  const [mode, setMode] = useState<string>('tasks');
  const [editingPlan, setEditingPlan] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const archived = plan.archived_at !== null;
  const editable = canManage && !archived;
  const summary = actionPlanSummary(plan.tasks, today);
  return (
    <article className="grid min-w-0 gap-space-4" aria-label={plan.name}>
      <div className="grid gap-space-1">
        <h2 className="text-heading font-semibold">{plan.name}</h2>
        <p className="text-caption text-ink-muted">
          {t('Starts {date}', { date: dates.date(plan.start_on) })}
          {plan.updated_by_name && plan.updated_at
            ? ` · ${t('Last updated by {name} on {date}', {
                name: plan.updated_by_name,
                date: dates.date(plan.updated_at.slice(0, 10)),
              })}`
            : ''}
        </p>
        {plan.notes ? (
          <p className="whitespace-pre-line">{plan.notes}</p>
        ) : null}
      </div>
      {archived ? (
        <Banner tone="neutral">
          {t('This plan is archived. Restore it to change its tasks.')}
        </Banner>
      ) : null}
      {canManage && plan.version !== undefined ? (
        <div className="flex flex-wrap items-start gap-space-3">
          {editable ? (
            <Button
              variant="secondary"
              onClick={() => setEditingPlan((value) => !value)}
            >
              {editingPlan ? t('Close') : t('Edit plan')}
            </Button>
          ) : null}
          <ModuleActionForm
            action={actions.setPlanArchived}
            submitLabel={archived ? t('Unarchive') : t('Archive')}
            confirmMessage={
              archived
                ? t('Restore this plan?')
                : t('Archive this plan? Its tasks stay saved but read-only.')
            }
            input={() =>
              actionPlanArchiveInputSchema.parse({
                planId: plan.id,
                archived: !archived,
                expectedVersion: plan.version,
              })
            }
          >
            {null}
          </ModuleActionForm>
        </div>
      ) : null}
      {editingPlan && editable ? (
        <Card title={t('Edit plan')}>
          <ModuleActionForm
            action={actions.savePlan}
            submitLabel={t('Save plan')}
            onSaved={() => setEditingPlan(false)}
            input={(form) =>
              actionPlanSaveInputSchema.parse({
                planId: plan.id,
                name: String(form.get('name') ?? ''),
                startOn: String(form.get('startOn') ?? ''),
                notes: String(form.get('notes') ?? ''),
                expectedVersion: plan.version ?? null,
                clientRequestId: null,
              })
            }
          >
            <TextInput
              id={`plan-${plan.id}-name`}
              name="name"
              label={t('Plan name')}
              maxLength={ACTION_PLAN_NAME_MAX}
              defaultValue={plan.name}
              required
            />
            <TextInput
              id={`plan-${plan.id}-start`}
              name="startOn"
              type="date"
              label={t('Start date')}
              helpText={t('Task dates move with the start date.')}
              defaultValue={plan.start_on}
              required
            />
            <TextAreaInput
              id={`plan-${plan.id}-notes`}
              name="notes"
              label={t('Notes')}
              maxLength={ACTION_PLAN_NOTES_MAX}
              defaultValue={plan.notes ?? ''}
            />
          </ModuleActionForm>
        </Card>
      ) : null}
      <div className="grid min-w-0 gap-space-3 medium:grid-cols-2 large:grid-cols-4">
        <StatTile label={t('Total')} value={summary.total} />
        <StatTile label={t('Completed')} value={summary.completed} />
        <StatTile label={t('In progress')} value={summary.inProgress} />
        <StatTile label={t('Overdue')} value={summary.overdue} />
        <StatTile
          label={t('High priority open')}
          value={summary.highPriorityOpen}
        />
        <StatTile
          label={t('Overall progress')}
          value={`${summary.progressPercent}%`}
        />
        <StatTile
          label={t('Due in next 7 days')}
          value={summary.nextSevenDays}
        />
      </div>
      {editable ? (
        <div>
          <Button
            variant={addingTask ? 'secondary' : 'primary'}
            onClick={() => setAddingTask((value) => !value)}
          >
            {addingTask ? t('Close') : t('Add task')}
          </Button>
        </div>
      ) : null}
      {addingTask && editable ? (
        <Card title={t('Add task')}>
          <TaskForm
            planId={plan.id}
            task={null}
            members={members}
            meetingActions={meetingActions}
            action={actions.saveTask}
            onSaved={() => setAddingTask(false)}
          />
        </Card>
      ) : null}
      <SegmentedControl
        label={t('Task view')}
        value={mode}
        onChange={setMode}
        options={VIEW_OPTIONS}
      />
      {plan.tasks.length === 0 ? (
        <EmptyState
          title={t('No tasks in this plan')}
          description={
            editable
              ? t('Add the first task to start tracking progress.')
              : t('Tasks appear here once they are added.')
          }
        />
      ) : mode === 'timeline' ? (
        <WeeklyTimeline plan={plan} />
      ) : (
        <ul className="grid min-w-0 gap-space-3">
          {plan.tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              editable={editable}
              members={members}
              meetingActions={meetingActions}
              action={actions.saveTask}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

function WeeklyTimeline({ plan }: { plan: ActionPlan }) {
  const { translate: t } = useUiTranslator();
  const dates = useToolkitDates();
  return (
    <ol className="grid min-w-0 gap-space-3" aria-label={t('Weekly timeline')}>
      {actionPlanWeeks(plan).map((week) => (
        <li
          key={week.week}
          className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4"
        >
          <h3 className="text-body-strong">
            {t('Week {week}', { week: week.week })}
            <span className="text-caption font-normal text-ink-muted">
              {` · ${dates.date(week.from)} – ${dates.date(week.to)}`}
            </span>
          </h3>
          <ul className="grid gap-space-2">
            {week.tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-space-2"
              >
                <span>
                  {task.title}
                  <span className="text-caption text-ink-muted">
                    {` · ${t('Due {date}', { date: dates.date(task.due_on) })} · ${task.progress}%`}
                  </span>
                </span>
                <StatusChip status={`action_task.${task.timeline}`} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function TaskItem({
  task,
  editable,
  members,
  meetingActions,
  action,
}: {
  task: ActionTask;
  editable: boolean;
  members: readonly ToolkitMemberOption[];
  meetingActions: readonly MeetingActionOption[];
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const dates = useToolkitDates();
  const [editing, setEditing] = useState(false);
  return (
    <li
      className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4"
      aria-label={task.title}
    >
      <div className="flex flex-wrap items-start justify-between gap-space-2">
        <h3 className="text-body-strong">{task.title}</h3>
        <StatusChip status={`action_task.${task.timeline}`} />
      </div>
      <dl className="grid min-w-0 gap-space-1 medium:grid-cols-2">
        <div>
          <dt className="text-caption text-ink-muted">{t('Category')}</dt>
          <dd>{t(ACTION_TASK_CATEGORY_LABELS[task.category])}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{t('Priority')}</dt>
          <dd>{t(PRIORITY_LABELS[task.priority])}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{t('Owner')}</dt>
          <dd>{task.owner_name ?? t('Not assigned')}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{t('Dates')}</dt>
          <dd>
            {`${dates.date(task.start_on)} – ${dates.date(task.due_on)}`}
            <span className="text-caption text-ink-muted">
              {` · ${t('Days {start}–{end}', {
                start: task.start_day,
                end: task.end_day,
              })}`}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{t('Status')}</dt>
          <dd>{t(ACTION_TASK_STATUS_LABELS[task.status])}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{t('Progress')}</dt>
          <dd>{`${task.progress}%`}</dd>
        </div>
        {task.notes ? (
          <div className="medium:col-span-2">
            <dt className="text-caption text-ink-muted">{t('Notes')}</dt>
            <dd className="whitespace-pre-line">{task.notes}</dd>
          </div>
        ) : null}
        <div className="medium:col-span-2">
          <dt className="text-caption text-ink-muted">{t('Evidence link')}</dt>
          <dd>
            {task.evidence_url ? (
              <a
                className="text-brand underline"
                href={task.evidence_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {task.evidence_url}
              </a>
            ) : (
              t(NOT_ADDED)
            )}
          </dd>
        </div>
        {task.meeting_action ? (
          <div className="medium:col-span-2">
            <dt className="text-caption text-ink-muted">
              {t('Linked meeting action')}
            </dt>
            <dd>
              {task.meeting_action.title}
              {task.status !== 'done' ? (
                <span className="block text-caption text-ink-muted">
                  {t(LINKED_ACTION_DONE_MESSAGE)}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
      {editable && action ? (
        editing ? (
          <div className="grid gap-space-3">
            <TaskForm
              planId={task.plan_id}
              task={task}
              members={members}
              meetingActions={meetingActions}
              action={action}
              onSaved={() => setEditing(false)}
            />
            <Button variant="secondary" onClick={() => setEditing(false)}>
              {t('Close')}
            </Button>
          </div>
        ) : (
          <div>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {t('Edit task')}
            </Button>
          </div>
        )
      ) : null}
    </li>
  );
}

function TaskForm({
  planId,
  task,
  members,
  meetingActions,
  action,
  onSaved,
}: {
  planId: string;
  task: ActionTask | null;
  members: readonly ToolkitMemberOption[];
  meetingActions: readonly MeetingActionOption[];
  action: ModuleFormAction;
  onSaved: () => void;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [linkedActionId, setLinkedActionId] = useState(
    task?.meeting_action?.id ?? '',
  );
  const [status, setStatus] = useState<string>(task?.status ?? 'not_started');
  const ownerOptions =
    task?.owner_membership_id &&
    !members.some((member) => member.membershipId === task.owner_membership_id)
      ? [
          ...members,
          {
            membershipId: task.owner_membership_id,
            label: task.owner_name ?? t('Former member'),
            manager: false,
          },
        ]
      : members;
  const actionOptions =
    task?.meeting_action &&
    !meetingActions.some((item) => item.id === task.meeting_action?.id)
      ? [
          ...meetingActions,
          { id: task.meeting_action.id, label: task.meeting_action.title },
        ]
      : meetingActions;
  const linked = linkedActionId !== '';
  return (
    <ModuleActionForm
      action={action}
      submitLabel={task ? t('Save task') : t('Add task')}
      idempotent={task === null}
      onSaved={onSaved}
      input={(form, clientRequestId) =>
        actionTaskSaveInputSchema.parse({
          taskId: task?.id ?? null,
          planId,
          title: String(form.get('title') ?? ''),
          category: form.get('category'),
          priority: form.get('priority'),
          ownerMembershipId: String(form.get('owner') ?? ''),
          startDay: String(form.get('startDay') ?? ''),
          endDay: String(form.get('endDay') ?? ''),
          status,
          progress: String(form.get('progress') ?? ''),
          notes: String(form.get('notes') ?? ''),
          evidenceUrl: String(form.get('evidenceUrl') ?? ''),
          meetingActionItemId: linkedActionId,
          expectedVersion: task?.version ?? null,
          clientRequestId,
        })
      }
    >
      <TextInput
        id={`${id}-title`}
        name="title"
        label={t('Title')}
        maxLength={ACTION_TASK_TITLE_MAX}
        defaultValue={task?.title ?? ''}
        required
      />
      <SelectInput
        id={`${id}-category`}
        name="category"
        label={t('Category')}
        defaultValue={task?.category ?? 'governance'}
        options={ACTION_TASK_CATEGORIES.map((value) => ({
          value,
          label: t(ACTION_TASK_CATEGORY_LABELS[value]),
        }))}
      />
      <SelectInput
        id={`${id}-priority`}
        name="priority"
        label={t('Priority')}
        defaultValue={task?.priority ?? 'medium'}
        options={TOOLKIT_PRIORITIES.map((value) => ({
          value,
          label: t(PRIORITY_LABELS[value]),
        }))}
      />
      <SelectInput
        id={`${id}-owner`}
        name="owner"
        label={t('Owner')}
        helpText={t('Any active member. They are notified when assigned.')}
        defaultValue={task?.owner_membership_id ?? ''}
        options={[
          { value: '', label: t('Not assigned') },
          ...ownerOptions.map((member) => ({
            value: member.membershipId,
            label: member.label,
          })),
        ]}
      />
      <div className="grid gap-space-3 medium:grid-cols-2">
        <TextInput
          id={`${id}-start`}
          name="startDay"
          type="number"
          inputMode="numeric"
          min={1}
          max={ACTION_TASK_DAY_MAX}
          label={t('Start day')}
          helpText={t('Day 1 is the plan start date.')}
          defaultValue={task?.start_day ?? 1}
          required
        />
        <TextInput
          id={`${id}-end`}
          name="endDay"
          type="number"
          inputMode="numeric"
          min={1}
          max={ACTION_TASK_DAY_MAX}
          label={t('End day')}
          defaultValue={task?.end_day ?? 7}
          required
        />
      </div>
      <SelectInput
        id={`${id}-meeting-action`}
        label={t('Linked meeting action')}
        helpText={t('Optional. Linked tasks are completed from the meeting.')}
        value={linkedActionId}
        onChange={(event) => {
          setLinkedActionId(event.target.value);
          if (event.target.value !== '' && status === 'done') {
            setStatus('in_progress');
          }
        }}
        options={[
          { value: '', label: t('None') },
          ...actionOptions.map((item) => ({
            value: item.id,
            label: item.label,
          })),
        ]}
      />
      <SelectInput
        id={`${id}-status`}
        label={t('Status')}
        helpText={linked ? t(LINKED_ACTION_DONE_MESSAGE) : undefined}
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        options={ACTION_TASK_STATUSES.map((value) => ({
          value,
          label: t(ACTION_TASK_STATUS_LABELS[value]),
          disabled: linked && value === 'done',
        }))}
      />
      <TextInput
        id={`${id}-progress`}
        name="progress"
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        label={t('Progress (%)')}
        defaultValue={task?.progress ?? 0}
        required
      />
      <TextAreaInput
        id={`${id}-notes`}
        name="notes"
        label={t('Notes')}
        maxLength={ACTION_PLAN_NOTES_MAX}
        defaultValue={task?.notes ?? ''}
      />
      <TextInput
        id={`${id}-evidence`}
        name="evidenceUrl"
        type="url"
        label={t('Evidence link')}
        helpText={t('Optional link to a document or photo album.')}
        maxLength={ACTION_TASK_LINK_MAX}
        defaultValue={task?.evidence_url ?? ''}
      />
    </ModuleActionForm>
  );
}

export function MyTasksView({ view }: { view: ActionPlansView }) {
  const { translate: t } = useUiTranslator();
  const plans = view.plans.filter((plan) => plan.tasks.length > 0);
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('My tasks')}</h1>
        <p className="text-ink-muted">
          {t(
            'Committee action-plan tasks assigned to you. Ask a committee member to update their status.',
          )}
        </p>
      </header>
      {plans.length === 0 ? (
        <EmptyState
          title={t('No tasks assigned to you')}
          description={t(
            'When the committee assigns you an action-plan task, it appears here.',
          )}
        />
      ) : (
        plans.map((plan) => (
          <section
            key={plan.id}
            className="grid min-w-0 gap-space-3"
            aria-label={plan.name}
          >
            <h2 className="text-heading font-semibold">{plan.name}</h2>
            <ul className="grid min-w-0 gap-space-3">
              {plan.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  editable={false}
                  members={[]}
                  meetingActions={[]}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
