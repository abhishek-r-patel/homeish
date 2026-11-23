// Exercise P42 category, vendor mapping and savings forms without database writes.
'use client';

import type { ZodType } from 'zod';
import { Banner } from '@/components/ui/feedback';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { ExpenseCategoryDetailsForm } from '@/components/expense/controls';
import { ExpensePayeeMappingForm } from '@/components/expense/vendor-spend-controls';
import {
  ExpenseSavingsEvidenceForm,
  ExpenseSavingsForm,
  ExpenseSavingsStatusForm,
} from '@/components/expense/savings-controls';
import {
  expenseCategoryDetailsInputSchema,
  expensePayeeMappingInputSchema,
  expenseSavingsEvidenceInputSchema,
  expenseSavingsInputSchema,
  expenseSavingsStatusInputSchema,
  type ExpenseCategory,
  type ExpenseSavings,
  type ExpenseSavingsDetail,
  type ExpenseWorkspace,
} from '@/core/expense/validation';

const today = new Date().toISOString().slice(0, 10);
const category: ExpenseCategory = {
  id: '00000000-0000-4000-8000-000000000101',
  name: 'Repairs',
  active: true,
  detail_group: 'Maintenance',
  cost_nature: 'variable',
  owner_user_id: null,
  owner_name: null,
  owner_is_current: null,
  detail_description: null,
  detail_version: 1,
  detail_revisions: [],
  updated_at: '2026-11-23T00:00:00.000Z',
};
const staff: ExpenseWorkspace['staff'] = [
  {
    user_id: '00000000-0000-4000-8000-000000000102',
    full_name: 'Synthetic Admin',
  },
  {
    user_id: '00000000-0000-4000-8000-000000000103',
    full_name: 'Synthetic Committee',
  },
];
const vendors = [
  {
    id: '00000000-0000-4000-8000-000000000104',
    name: 'Synthetic Lift Vendor',
  },
];
const initiative: ExpenseSavingsDetail = {
  id: '00000000-0000-4000-8000-000000000105',
  title: 'Renegotiate lift AMC',
  description: 'Synthetic savings fixture',
  kind: 'renegotiation',
  owner_user_id: staff[0]!.user_id,
  owner_name: staff[0]!.full_name,
  owner_is_current: true,
  category_id: category.id,
  category_name: category.name,
  vendor_id: vendors[0]!.id,
  vendor_name: vendors[0]!.name,
  baseline_annual_paise: 120000,
  expected_annual_paise: 24000,
  status: 'implementing',
  version: 1,
  realised_to_date_paise: 0,
  updated_at: '2026-11-23T00:00:00.000Z',
  created_at: '2026-11-23T00:00:00.000Z',
  status_events: [],
  evidence: [],
};
const savings: ExpenseSavings = {
  can_manage: true,
  vendor_enabled: true,
  initiatives: [initiative],
  staff,
  categories: [{ id: category.id, name: category.name }],
  vendors,
  source_choices: {
    entries: [
      {
        id: '00000000-0000-4000-8000-000000000106',
        label: 'PV/2026-11/1 · 2026-11-01 · Lift vendor',
      },
    ],
    vendor_bills: [],
    vendor_contracts: [],
  },
};

function input(form: FormData): unknown {
  const value = form.get('input');
  if (typeof value !== 'string') return null;
  return JSON.parse(value);
}

function accept(schema: ZodType, message: string): ModuleFormAction {
  return async (form) => {
    const parsed = schema.safeParse(input(form));
    return parsed.success
      ? { ok: true, message }
      : {
          ok: false,
          code: 'VALIDATION_FAILED' as const,
          message: parsed.error.issues[0]?.message ?? 'Invalid.',
        };
  };
}

export default function ExpenseP42FixturePage() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
      <Banner title="Synthetic P42 fixture" tone="info">
        Development-only simulated actions. No database writes.
      </Banner>
      <h1 className="text-title font-semibold">Expense controls</h1>
      <section
        aria-label="Category reporting details"
        className="grid gap-space-3"
      >
        <h2 className="text-heading font-semibold">
          Category reporting details
        </h2>
        <ExpenseCategoryDetailsForm
          category={category}
          groupSuggestions={['Maintenance', 'People']}
          staff={staff}
          action={accept(
            expenseCategoryDetailsInputSchema,
            'Category details saved.',
          )}
        />
      </section>
      <section aria-label="Vendor mapping" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Vendor mapping</h2>
        <ExpensePayeeMappingForm
          payee="Synthetic Lift Vendor"
          vendors={vendors}
          suggestedVendorId={vendors[0]!.id}
          action={accept(
            expensePayeeMappingInputSchema,
            'Payee mapped to vendor.',
          )}
        />
      </section>
      <section aria-label="Savings controls" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Savings controls</h2>
        <ExpenseSavingsForm
          workspace={savings}
          initiative={initiative}
          action={accept(
            expenseSavingsInputSchema,
            'Savings initiative saved.',
          )}
        />
        <ExpenseSavingsStatusForm
          initiative={initiative}
          action={accept(
            expenseSavingsStatusInputSchema,
            'Savings status changed.',
          )}
        />
        <ExpenseSavingsEvidenceForm
          initiative={initiative}
          workspace={savings}
          today={today}
          action={accept(
            expenseSavingsEvidenceInputSchema,
            'Savings evidence added.',
          )}
        />
      </section>
    </main>
  );
}
