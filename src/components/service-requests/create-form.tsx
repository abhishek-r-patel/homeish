// Collect a resident service request and attach verified private photos.
'use client';

import { useState } from 'react';
import { createServiceRequestAction } from '@/app/(resident)/requests/actions';
import {
  ServiceRequestActionForm,
  type RequestFormAction,
} from './action-form';
import { ServiceRequestPhotoUpload } from './photo-upload';
import type { ServiceRequestCategory } from '@/core/service-requests/validation';

type RequestUnit = { id: string; number: string; block: string | null };

const fieldClass =
  'min-h-12 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-space-3 text-body focus-visible:outline-2 focus-visible:outline-focus';

export function ServiceRequestCreateForm({
  categories,
  action = createServiceRequestAction,
  onCreated,
  refresh,
  units,
}: {
  categories: ServiceRequestCategory[];
  action?: RequestFormAction;
  onCreated?: () => void;
  refresh?: boolean;
  units: RequestUnit[];
}) {
  const [requestId, setRequestId] = useState('');
  const [locationType, setLocationType] = useState<'unit' | 'common_area'>(
    'unit',
  );

  function ensureRequestId() {
    if (requestId) return requestId;
    try {
      const key = 'homeish:service-request:create';
      const existing = sessionStorage.getItem(key);
      const id = existing ?? crypto.randomUUID();
      sessionStorage.setItem(key, id);
      setRequestId(id);
      return id;
    } catch {
      const id = crypto.randomUUID();
      setRequestId(id);
      return id;
    }
  }

  return (
    <ServiceRequestActionForm
      action={action}
      input={(formData) => ({
        categoryId: String(formData.get('categoryId') ?? ''),
        locationType: String(formData.get('locationType') ?? ''),
        unitId: String(formData.get('unitId') ?? '') || null,
        description: String(formData.get('description') ?? ''),
        priority: String(formData.get('priority') ?? ''),
        attachments: JSON.parse(
          String(formData.get('attachments') ?? '[]'),
        ).map((path: string) => ({ path })),
        clientRequestId: ensureRequestId(),
      })}
      onSuccess={() => {
        try {
          sessionStorage.removeItem('homeish:service-request:create');
          const nextId = crypto.randomUUID();
          sessionStorage.setItem('homeish:service-request:create', nextId);
          setRequestId(nextId);
        } catch {
          setRequestId(crypto.randomUUID());
        }
        onCreated?.();
      }}
      refresh={refresh}
      submitLabel="Submit request"
    >
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="request-category"
      >
        Category
        <select
          className={fieldClass}
          id="request-category"
          name="categoryId"
          required
        >
          <option value="">Choose a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="grid min-w-0 gap-space-2 border-0 p-0">
        <legend className="text-body-strong">Where is the issue?</legend>
        <label className="flex min-h-10 items-center gap-space-2">
          <input
            checked={locationType === 'unit'}
            name="locationType"
            onChange={() => setLocationType('unit')}
            type="radio"
            value="unit"
          />
          My unit
        </label>
        <label className="flex min-h-10 items-center gap-space-2">
          <input
            checked={locationType === 'common_area'}
            name="locationType"
            onChange={() => setLocationType('common_area')}
            type="radio"
            value="common_area"
          />
          Common area
        </label>
      </fieldset>
      {locationType === 'unit' ? (
        <label
          className="grid min-w-0 gap-space-1 text-body-strong"
          htmlFor="request-unit"
        >
          Unit
          <select
            className={fieldClass}
            id="request-unit"
            name="unitId"
            required
          >
            <option value="">Choose a unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.block ? `${unit.block} · ` : ''}
                {unit.number}
              </option>
            ))}
          </select>
          {units.length === 0 ? (
            <span className="text-caption text-ink-muted">
              No active unit is linked to your household.
            </span>
          ) : null}
        </label>
      ) : (
        <input name="unitId" type="hidden" value="" />
      )}
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="request-description"
      >
        Describe the issue
        <textarea
          className="min-h-32 rounded-md border border-rule-strong bg-surface p-space-3 text-body focus-visible:outline-2 focus-visible:outline-focus"
          id="request-description"
          maxLength={2000}
          name="description"
          required
        />
      </label>
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="request-priority"
      >
        Priority
        <select
          className={fieldClass}
          defaultValue="normal"
          id="request-priority"
          name="priority"
        >
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <input name="clientRequestId" type="hidden" value={requestId} />
      <ServiceRequestPhotoUpload
        getRequestId={ensureRequestId}
        requestId={requestId}
      />
    </ServiceRequestActionForm>
  );
}
