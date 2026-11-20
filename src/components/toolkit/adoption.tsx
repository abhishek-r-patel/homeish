// List one capability adoption row per Homeish module with summaries; admins edit, committee members read.
'use client';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatTile } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  ADOPTION_NOTES_MAX,
  ADOPTION_STATUSES,
  ADOPTION_STATUS_LABELS,
  NOT_ADDED,
  PRIORITY_LABELS,
  TOOLKIT_PRIORITIES,
  adoptionSummary,
  capabilityAdoptionSaveInputSchema,
  type CapabilityAdoption,
  type CapabilityAdoptionsView,
  type ToolkitMemberOption,
} from '@/core/toolkit/validation';
import { useToolkitDates } from './shared';

export type AdoptionActions = { saveAdoption: ModuleFormAction };

export function AdoptionScreen({
  view,
  owners,
  actions,
}: {
  view: CapabilityAdoptionsView;
  owners: readonly ToolkitMemberOption[];
  actions: AdoptionActions;
}) {
  const { translate: t } = useUiTranslator();
  const summary = adoptionSummary(view.capabilities, view.today);
  const managerOwners = owners.filter((owner) => owner.manager);
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Adoption tracker')}</h1>
        <p className="text-ink-muted">
          {t(
            'Track how far your society has adopted each Homeish module, who owns it and when to review it.',
          )}
        </p>
      </header>
      <Banner tone="info">
        {t(
          'Entries here are your own notes. They do not turn modules on or off, grant access or track how the app is used.',
        )}
      </Banner>
      <div className="grid min-w-0 gap-space-3 medium:grid-cols-2 large:grid-cols-4">
        <StatTile
          label={t('In use or mastered')}
          value={summary.inUse}
          context={t('of {total} modules', {
            total: view.capabilities.length,
          })}
        />
        <StatTile label={t('Exploring')} value={summary.exploring} />
        <StatTile label={t('Review due')} value={summary.reviewPending} />
        <StatTile
          label={t('High priority, not started')}
          value={summary.highPriorityNotStarted}
        />
      </div>
      {view.capabilities.length === 0 ? (
        <EmptyState
          title={t('No modules to track')}
          description={t('Modules appear here once Homeish lists them.')}
        />
      ) : (
        <ul className="grid min-w-0 gap-space-3">
          {view.capabilities.map((item) => (
            <AdoptionRow
              key={item.module_key}
              item={item}
              today={view.today}
              canManage={view.can_manage}
              owners={managerOwners}
              action={actions.saveAdoption}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AdoptionRow({
  item,
  today,
  canManage,
  owners,
  action,
}: {
  item: CapabilityAdoption;
  today: string;
  canManage: boolean;
  owners: readonly ToolkitMemberOption[];
  action: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const dates = useToolkitDates();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const reviewDue = item.review_on !== null && item.review_on <= today;
  const ownerOptions = owners.some(
    (owner) => owner.membershipId === item.owner_membership_id,
  )
    ? owners
    : item.owner_membership_id && item.owner_name
      ? [
          ...owners,
          {
            membershipId: item.owner_membership_id,
            label: item.owner_name,
            manager: true,
          },
        ]
      : owners;
  return (
    <li
      className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4"
      aria-label={item.module_name}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-space-2">
        <h2 className="text-body-strong">{item.module_name}</h2>
        <span className="text-caption text-ink-muted">
          {item.enabled ? t('Module is on') : t('Module is off')}
        </span>
      </div>
      <dl className="grid min-w-0 gap-space-1 medium:grid-cols-2">
        <div>
          <dt className="text-caption text-ink-muted">{t('Status')}</dt>
          <dd>{t(ADOPTION_STATUS_LABELS[item.status])}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{t('Priority')}</dt>
          <dd>{t(PRIORITY_LABELS[item.priority])}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{t('Owner')}</dt>
          <dd>{item.owner_name ?? t(NOT_ADDED)}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{t('Review date')}</dt>
          <dd>
            {item.review_on ? dates.date(item.review_on) : t(NOT_ADDED)}
            {reviewDue ? ` · ${t('Review due')}` : ''}
          </dd>
        </div>
        {item.notes ? (
          <div className="medium:col-span-2">
            <dt className="text-caption text-ink-muted">{t('Notes')}</dt>
            <dd className="whitespace-pre-line">{item.notes}</dd>
          </div>
        ) : null}
      </dl>
      {canManage ? (
        editing ? (
          <div className="grid gap-space-3">
            <ModuleActionForm
              action={action}
              submitLabel={t('Save adoption')}
              input={(form) =>
                capabilityAdoptionSaveInputSchema.parse({
                  moduleKey: item.module_key,
                  status: form.get('status'),
                  priority: form.get('priority'),
                  ownerMembershipId: String(form.get('owner') ?? ''),
                  reviewOn: String(form.get('reviewOn') ?? ''),
                  notes: String(form.get('notes') ?? ''),
                  expectedVersion: item.version,
                })
              }
            >
              <SelectInput
                id={`${id}-status`}
                name="status"
                label={t('Status')}
                defaultValue={item.status}
                options={ADOPTION_STATUSES.map((value) => ({
                  value,
                  label: t(ADOPTION_STATUS_LABELS[value]),
                }))}
              />
              <SelectInput
                id={`${id}-priority`}
                name="priority"
                label={t('Priority')}
                defaultValue={item.priority}
                options={TOOLKIT_PRIORITIES.map((value) => ({
                  value,
                  label: t(PRIORITY_LABELS[value]),
                }))}
              />
              <SelectInput
                id={`${id}-owner`}
                name="owner"
                label={t('Owner')}
                helpText={t('An active admin or committee member.')}
                defaultValue={item.owner_membership_id ?? ''}
                options={[
                  { value: '', label: t('Not assigned') },
                  ...ownerOptions.map((owner) => ({
                    value: owner.membershipId,
                    label: owner.label,
                  })),
                ]}
              />
              <TextInput
                id={`${id}-review`}
                name="reviewOn"
                type="date"
                label={t('Review date')}
                defaultValue={item.review_on ?? ''}
              />
              <TextAreaInput
                id={`${id}-notes`}
                name="notes"
                label={t('Notes')}
                maxLength={ADOPTION_NOTES_MAX}
                defaultValue={item.notes ?? ''}
              />
            </ModuleActionForm>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              {t('Close')}
            </Button>
          </div>
        ) : (
          <div>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {t('Edit')}
            </Button>
          </div>
        )
      ) : null}
    </li>
  );
}
