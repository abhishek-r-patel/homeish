// Let society administrators maintain request categories and service targets.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import {
  saveServiceRequestCategoryAction,
  saveServiceRequestEscalationSettingsAction,
} from '@/app/(resident)/requests/actions';
import { Card } from '@/components/ui/data-display';
import {
  ServiceRequestActionForm,
  type RequestFormAction,
} from './action-form';
import {
  DEFAULT_COMMITTEE_ESCALATION_DAYS,
  type ServiceRequestCategory,
  type ServiceRequestEscalationDelivery,
  type ServiceRequestEscalationSettings,
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
        const slaHours = String(formData.get('slaHours') ?? '');
        return {
          id: category?.id ?? null,
          name: String(formData.get('name') ?? ''),
          slaHours: slaHours ? Number(slaHours) : null,
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
        {t('SLA target (hours, optional)')}
        <input
          className={fieldClass}
          defaultValue={category?.sla_hours ?? ''}
          max={8760}
          min={1}
          name="slaHours"
          type="number"
        />
      </label>
      <label className="grid min-w-0 gap-space-1 text-body-strong">
        {t('Escalate to committee after (days)')}
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

export function ServiceRequestCategoryManager({
  categories,
  saveAction = saveServiceRequestCategoryAction,
}: {
  categories: ServiceRequestCategory[];
  saveAction?: RequestFormAction;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <div className="grid gap-space-4">
      <Card
        className="min-w-0"
        description={t(
          'Set an optional response target. Categories with no SLA are not marked overdue.',
        )}
        title={t('Add category')}
      >
        <CategoryForm action={saveAction} />
      </Card>
      {categories.map((category) => (
        <Card className="min-w-0" key={category.id} title={category.name}>
          <CategoryForm action={saveAction} category={category} />
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
  return (
    <Card
      className="min-w-0"
      description={t(
        "Requests that miss their SLA go to admins. If still open after the category's committee interval, they go to the committee. Recipients always get an in-app notification. Residents see only that the request was escalated.",
      )}
      title={t('SLA escalation')}
    >
      <ServiceRequestActionForm
        action={saveAction}
        input={(formData) => ({
          delivery: String(formData.get('delivery') ?? 'in_app'),
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
      </ServiceRequestActionForm>
    </Card>
  );
}
