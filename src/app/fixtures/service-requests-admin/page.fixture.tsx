// Exercise the administrative category workflow with synthetic in-memory data.
'use client';

import { useState } from 'react';
import { ServiceRequestCategoryManager } from '@/components/service-requests/category-manager';
import type { RequestFormAction } from '@/components/service-requests/action-form';
import { Card } from '@/components/ui/data-display';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  serviceRequestCategoryInputSchema,
  type ServiceRequestCategory,
} from '@/core/service-requests/validation';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';

const initialCategory: ServiceRequestCategory = {
  id: '6a696d6f-774c-41d1-ae47-6254d4a8f4cf',
  society_id: societyId,
  created_at: '2026-11-10T09:00:00.000Z',
  created_by: null,
  updated_at: '2026-11-10T09:00:00.000Z',
  updated_by: null,
  name: 'Plumbing',
  sla_hours: 24,
  sort_order: 0,
  active: true,
};

function failure(message: string): ServerActionResult<unknown> {
  return { ok: false, code: 'VALIDATION_FAILED', message };
}

export default function ServiceRequestsAdminFixturePage() {
  const [categories, setCategories] = useState([initialCategory]);

  const saveAction: RequestFormAction = async (formData) => {
    let input: unknown;
    try {
      input = JSON.parse(String(formData.get('input') ?? ''));
    } catch {
      return failure('The fixture category was invalid.');
    }

    const parsed = serviceRequestCategoryInputSchema.safeParse(input);
    if (!parsed.success) return failure('Check the category details.');

    setCategories((current) => {
      const { id, ...values } = parsed.data;
      if (id) {
        return current.map((category) =>
          category.id === id
            ? {
                ...category,
                ...values,
                updated_at: '2026-11-10T10:00:00.000Z',
              }
            : category,
        );
      }

      return [
        ...current,
        {
          ...initialCategory,
          id: '7a696d6f-774c-41d1-ae47-6254d4a8f4cf',
          created_at: '2026-11-10T10:00:00.000Z',
          updated_at: '2026-11-10T10:00:00.000Z',
          ...values,
        },
      ];
    });

    return { ok: true, message: 'The request category was saved.' };
  };

  return (
    <main className="mx-auto grid min-h-dvh w-full min-w-0 max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
      <h1 className="text-title font-semibold">Service requests</h1>
      <Card
        className="min-w-0"
        description="Synthetic in-memory data. Reload to reset."
        title="Service request administration fixture"
      >
        <p className="text-body text-ink-muted">
          No category is written to a database.
        </p>
      </Card>
      <ServiceRequestCategoryManager
        categories={categories}
        saveAction={saveAction}
      />
    </main>
  );
}
