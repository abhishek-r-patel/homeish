// Let society administrators maintain request categories and service targets.
'use client';

import { saveServiceRequestCategoryAction } from '@/app/(resident)/requests/actions';
import { Card } from '@/components/ui/data-display';
import {
  ServiceRequestActionForm,
  type RequestFormAction,
} from './action-form';
import type { ServiceRequestCategory } from '@/core/service-requests/validation';

const fieldClass =
  'min-h-12 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-space-3 text-body focus-visible:outline-2 focus-visible:outline-focus';

function CategoryForm({
  action,
  category,
}: {
  action: RequestFormAction;
  category?: ServiceRequestCategory;
}) {
  return (
    <ServiceRequestActionForm
      action={action}
      input={(formData) => {
        const slaHours = String(formData.get('slaHours') ?? '');
        return {
          id: category?.id ?? null,
          name: String(formData.get('name') ?? ''),
          slaHours: slaHours ? Number(slaHours) : null,
          sortOrder: Number(formData.get('sortOrder') ?? 0),
          active: formData.has('active'),
          expectedUpdatedAt: category?.updated_at ?? null,
        };
      }}
      submitLabel={category ? 'Save category' : 'Add category'}
    >
      <label className="grid min-w-0 gap-space-1 text-body-strong">
        Name
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
        SLA target (hours, optional)
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
        Display order
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
        Active
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
  return (
    <div className="grid gap-space-4">
      <Card
        className="min-w-0"
        description="Set an optional response target. Categories with no SLA are not marked overdue."
        title="Add category"
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
