// Let admins and housekeeping supervisors log a request for a unit or common area.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { useState } from 'react';
import { logServiceRequestAction } from '@/app/(resident)/requests/actions';
import {
  ServiceRequestActionForm,
  type RequestFormAction,
} from './action-form';
import { ServiceRequestPriorityField } from './priority-field';
import type {
  ServiceRequestIntakeSource,
  ServiceRequestIntakeOptions,
} from '@/core/service-requests/validation';

const fieldClass =
  'min-h-12 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-space-3 text-body focus-visible:outline-2 focus-visible:outline-focus';

export const INTAKE_SOURCE_LABELS = {
  walk_in: 'Walk-in',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  email: 'Email',
  helpdesk_app: 'Helpdesk app',
  daily_rounds: 'Daily rounds',
} as const satisfies Record<ServiceRequestIntakeSource, string>;

const LOGGED_SOURCES = [
  'walk_in',
  'phone',
  'whatsapp',
  'email',
  'helpdesk_app',
] as const satisfies readonly ServiceRequestIntakeSource[];

export function ServiceRequestLogForm({
  action = logServiceRequestAction,
  categories,
  units,
}: {
  action?: RequestFormAction;
  categories: ServiceRequestIntakeOptions['categories'];
  units: { id: string; number: string }[];
}) {
  const { translate: t } = useUiTranslator();
  const [clientRequestId, setClientRequestId] = useState('');
  const [formKey, setFormKey] = useState(0);
  const [locationType, setLocationType] = useState<'unit' | 'common_area'>(
    'unit',
  );

  function ensureClientRequestId() {
    if (clientRequestId) return clientRequestId;
    const id = crypto.randomUUID();
    setClientRequestId(id);
    return id;
  }

  return (
    <ServiceRequestActionForm
      action={action}
      input={(formData) => ({
        categoryId: String(formData.get('categoryId') ?? ''),
        locationType,
        unitId:
          locationType === 'unit'
            ? String(formData.get('unitId') ?? '') || null
            : null,
        description: String(formData.get('description') ?? ''),
        priority: String(formData.get('priority') ?? 'medium'),
        intakeSource: String(formData.get('intakeSource') ?? ''),
        clientRequestId: ensureClientRequestId(),
      })}
      onSuccess={() => {
        setClientRequestId('');
        setFormKey((value) => value + 1);
      }}
      submitLabel={t('Log request')}
    >
      {/* Remount only the fields after success so the confirmation stays visible. */}
      <div className="contents" key={formKey}>
        <label
          className="grid min-w-0 gap-space-1 text-body-strong"
          htmlFor="log-request-source"
        >
          {t('How it arrived')}
          <select
            className={fieldClass}
            defaultValue="walk_in"
            id="log-request-source"
            name="intakeSource"
            required
          >
            {LOGGED_SOURCES.map((source) => (
              <option key={source} value={source}>
                {t(INTAKE_SOURCE_LABELS[source])}
              </option>
            ))}
          </select>
        </label>
        <label
          className="grid min-w-0 gap-space-1 text-body-strong"
          htmlFor="log-request-category"
        >
          {t('Category')}
          <select
            className={fieldClass}
            id="log-request-category"
            name="categoryId"
            required
          >
            <option value="">{t('Choose a category')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="grid min-w-0 gap-space-2 border-0 p-0">
          <legend className="text-body-strong">
            {t('Where is the issue?')}
          </legend>
          <label className="flex min-h-10 items-center gap-space-2">
            <input
              checked={locationType === 'unit'}
              name="locationType"
              onChange={() => setLocationType('unit')}
              type="radio"
              value="unit"
            />
            {t('A unit')}
          </label>
          <label className="flex min-h-10 items-center gap-space-2">
            <input
              checked={locationType === 'common_area'}
              name="locationType"
              onChange={() => setLocationType('common_area')}
              type="radio"
              value="common_area"
            />
            {t('Common area')}
          </label>
        </fieldset>
        {locationType === 'unit' ? (
          <label
            className="grid min-w-0 gap-space-1 text-body-strong"
            htmlFor="log-request-unit"
          >
            {t('Unit')}
            <select
              className={fieldClass}
              id="log-request-unit"
              name="unitId"
              required
            >
              <option value="">{t('Choose a unit')}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.number}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label
          className="grid min-w-0 gap-space-1 text-body-strong"
          htmlFor="log-request-description"
        >
          {t('Describe the issue')}
          <textarea
            className="min-h-32 rounded-md border border-rule-strong bg-surface p-space-3 text-body focus-visible:outline-2 focus-visible:outline-focus"
            id="log-request-description"
            maxLength={2000}
            name="description"
            required
          />
        </label>
        <ServiceRequestPriorityField idPrefix="log-request-priority" />
      </div>
    </ServiceRequestActionForm>
  );
}
