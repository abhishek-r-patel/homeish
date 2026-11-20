// Let society administrators maintain request categories, priority targets and escalation waits.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { useState } from 'react';
import {
  saveServiceRequestCategoryAction,
  saveServiceRequestEscalationSettingsAction,
  saveServiceRequestTargetsAction,
} from '@/app/(resident)/requests/actions';
import { Card } from '@/components/ui/data-display';
import {
  ServiceRequestActionForm,
  type RequestFormAction,
} from './action-form';
import { PRIORITY_OPTIONS } from './priority-field';
import {
  DEFAULT_COMMITTEE_ESCALATION_DAYS,
  type ServiceRequestCategory,
  type ServiceRequestEscalationDelivery,
  type ServiceRequestEscalationSettings,
  type ServiceRequestTarget,
} from '@/core/service-requests/validation';

const fieldClass =
  'min-h-12 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-space-3 text-body focus-visible:outline-2 focus-visible:outline-focus';

function CategoryForm({
  action,
  category,
}: {
  action: RequestFormAction;
  category?: ServiceRequestCategory;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ServiceRequestActionForm
      action={action}
      input={(formData) => {
        return {
          id: category?.id ?? null,
          name: String(formData.get('name') ?? ''),
          // Targets now live per priority; the old hour value is kept unchanged.
          slaHours: category?.sla_hours ?? null,
          committeeEscalationDays: Number(
            formData.get('committeeEscalationDays') ??
              DEFAULT_COMMITTEE_ESCALATION_DAYS,
          ),
          sortOrder: Number(formData.get('sortOrder') ?? 0),
          active: formData.has('active'),
          expectedUpdatedAt: category?.updated_at ?? null,
        };
      }}
      submitLabel={category ? t('Save category') : t('Add category')}
    >
      <label className="grid min-w-0 gap-space-1 text-body-strong">
        {t('Name')}
        <input
          className={fieldClass}
          defaultValue={category?.name ?? ''}
          maxLength={80}
          minLength={2}
          name="name"
          required
        />
      </label>
      <label className="grid min-w-0 gap-space-1 text-body-strong">
        {t('Escalate to committee after (days, per-category wait)')}
        <input
          className={fieldClass}
          defaultValue={
            category?.committee_escalation_days ??
            DEFAULT_COMMITTEE_ESCALATION_DAYS
          }
          max={30}
          min={1}
          name="committeeEscalationDays"
          required
          type="number"
        />
      </label>
      <label className="grid min-w-0 gap-space-1 text-body-strong">
        {t('Display order')}
        <input
          className={fieldClass}
          defaultValue={category?.sort_order ?? 0}
          max={10000}
          min={0}
          name="sortOrder"
          required
          type="number"
        />
      </label>
      <label className="flex min-h-10 items-center gap-space-2">
        <input
          defaultChecked={category?.active ?? true}
          name="active"
          type="checkbox"
        />
        {t('Active')}
      </label>
    </ServiceRequestActionForm>
  );
}

function TargetsForm({
  action,
  categoryId,
  targets,
}: {
  action: RequestFormAction;
  categoryId: string;
  targets: ServiceRequestTarget[];
}) {
  const { translate: t } = useUiTranslator();
  const days = (priority: string) =>
    targets.find(
      (target) =>
        target.category_id === categoryId && target.priority === priority,
    )?.target_days ?? '';
  return (
    <ServiceRequestActionForm
      action={action}
      input={(formData) => {
        const values = PRIORITY_OPTIONS.map(({ value }) =>
          String(formData.get(value) ?? '').trim(),
        );
        if (values.every((value) => value === '')) {
          return { categoryId, targets: null };
        }
        const [critical, high, medium, low] = values.map(Number);
        return { categoryId, targets: { critical, high, medium, low } };
      }}
      submitLabel={t('Save target days')}
    >
      <fieldset className="grid min-w-0 gap-space-3 border-0 p-0 small:grid-cols-4">
        <legend className="mb-space-2 text-body-strong">
          {t('Target days by priority (leave all empty for no target)')}
        </legend>
        {PRIORITY_OPTIONS.map((option) => (
          <label
            className="grid min-w-0 gap-space-1"
            htmlFor={`target-${categoryId}-${option.value}`}
            key={option.value}
          >
            {t(option.label)}
            <input
              className={fieldClass}
              defaultValue={days(option.value)}
              id={`target-${categoryId}-${option.value}`}
              max={365}
              min={1}
              name={option.value}
              type="number"
            />
          </label>
        ))}
      </fieldset>
    </ServiceRequestActionForm>
  );
}

export function ServiceRequestCategoryManager({
  categories,
  saveAction = saveServiceRequestCategoryAction,
  saveTargetsAction = saveServiceRequestTargetsAction,
  targets = [],
}: {
  categories: ServiceRequestCategory[];
  saveAction?: RequestFormAction;
  saveTargetsAction?: RequestFormAction;
  targets?: ServiceRequestTarget[];
}) {
  const { translate: t } = useUiTranslator();
  return (
    <div className="grid gap-space-4">
      <Card
        className="min-w-0"
        description={t(
          'After adding a category, set its target days per priority. Categories with no target are not marked overdue.',
        )}
        title={t('Add category')}
      >
        <CategoryForm action={saveAction} />
      </Card>
      {categories.map((category) => (
        <Card className="min-w-0" key={category.id} title={category.name}>
          <div className="grid min-w-0 gap-space-5">
            <CategoryForm action={saveAction} category={category} />
            <TargetsForm
              action={saveTargetsAction}
              categoryId={category.id}
              targets={targets}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}

const deliveryOptions = [
  { value: 'in_app', label: 'In-app' },
  { value: 'in_app_email', label: 'In-app + email' },
] as const satisfies readonly {
  value: ServiceRequestEscalationDelivery;
  label: string;
}[];

export function ServiceRequestEscalationSettingsForm({
  settings,
  saveAction = saveServiceRequestEscalationSettingsAction,
}: {
  settings: ServiceRequestEscalationSettings;
  saveAction?: RequestFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const [waitMode, setWaitMode] = useState(settings.committee_wait_mode);
  return (
    <Card
      className="min-w-0"
      description={t(
        'Requests that miss their target go to admins. If still open after the committee wait, they go to the committee. Recipients always get an in-app notification. Residents see only that the request was escalated.',
      )}
      title={t('SLA escalation')}
    >
      <ServiceRequestActionForm
        action={saveAction}
        input={(formData) => ({
          delivery: String(formData.get('delivery') ?? 'in_app'),
          committeeWaitMode: waitMode,
          committeeWaits:
            waitMode === 'per_priority'
              ? {
                  critical: Number(formData.get('waitCritical')),
                  high: Number(formData.get('waitHigh')),
                  medium: Number(formData.get('waitMedium')),
                  low: Number(formData.get('waitLow')),
                }
              : null,
          expectedUpdatedAt: settings.updated_at,
        })}
        submitLabel={t('Save escalation settings')}
      >
        <fieldset className="grid min-w-0 gap-space-2">
          <legend className="text-body-strong">
            {t('Send escalations by')}
          </legend>
          {deliveryOptions.map((option) => (
            <label
              className="flex min-h-10 items-center gap-space-2"
              key={option.value}
            >
              <input
                defaultChecked={settings.delivery === option.value}
                name="delivery"
                type="radio"
                value={option.value}
              />
              {t(option.label)}
            </label>
          ))}
        </fieldset>
        <fieldset className="grid min-w-0 gap-space-2">
          <legend className="text-body-strong">
            {t('Committee wait is set')}
          </legend>
          <label className="flex min-h-10 items-center gap-space-2">
            <input
              checked={waitMode === 'per_category'}
              name="committeeWaitMode"
              onChange={() => setWaitMode('per_category')}
              type="radio"
              value="per_category"
            />
            {t('Per category')}
          </label>
          <label className="flex min-h-10 items-center gap-space-2">
            <input
              checked={waitMode === 'per_priority'}
              name="committeeWaitMode"
              onChange={() => setWaitMode('per_priority')}
              type="radio"
              value="per_priority"
            />
            {t('Per priority')}
          </label>
        </fieldset>
        {waitMode === 'per_priority' ? (
          <fieldset className="grid min-w-0 gap-space-3 border-0 p-0 small:grid-cols-4">
            <legend className="mb-space-2 text-body-strong">
              {t('Committee wait (days) by priority')}
            </legend>
            {PRIORITY_OPTIONS.map((option) => {
              const name = `wait${option.label}`;
              return (
                <label
                  className="grid min-w-0 gap-space-1"
                  htmlFor={`committee-wait-${option.value}`}
                  key={option.value}
                >
                  {t(option.label)}
                  <input
                    className={fieldClass}
                    defaultValue={settings.committee_waits[option.value]}
                    id={`committee-wait-${option.value}`}
                    max={30}
                    min={1}
                    name={name}
                    required
                    type="number"
                  />
                </label>
              );
            })}
          </fieldset>
        ) : null}
      </ServiceRequestActionForm>
    </Card>
  );
}
