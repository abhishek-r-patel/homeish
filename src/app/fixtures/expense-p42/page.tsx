// Exercise P42 category, vendor mapping and savings forms without database writes.
'use client';

import type { ZodType } from 'zod';
import { Banner } from '@/components/ui/feedback';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { ExpenseCategoryDetailsForm } from '@/components/expense/controls';
import {
  ExpenseBudgetApprovalForm,
  ExpenseBudgetChangeForm,
  ExpenseBudgetSettingsForm,
} from '@/components/expense/budget-change-controls';
import { ExpenseBudgetDraftForm } from '@/components/expense/budget-draft-controls';
import { ExpenseBudgetReportTable } from '@/components/expense/budget-report-table';
import { ExpensePayeeMappingForm } from '@/components/expense/vendor-spend-controls';
import {
  expenseBudgetApproveInputSchema,
  expenseBudgetChangeInputSchema,
  expenseBudgetDraftInputSchema,
  expenseBudgetSettingsInputSchema,
  type ExpenseBudget,
  type ExpenseBudgetReport,
} from '@/core/expense/budget-validation';
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
const incomeHeads = [
  ['billing', 'Maintenance collections'],
  ['donation', 'Donations'],
  ['interest', 'Interest'],
  ['other', 'Other income'],
] as const;
const draftBudget: ExpenseBudget = {
  financial_year: 2026,
  today: '2026-11-23',
  can_manage: true,
  settings: {
    budget_forecast_method: 'budget',
    budget_watch_percent: 90,
    budget_resident_summary: true,
    updated_at: '2026-11-23T00:00:00.000Z',
  },
  budget: {
    id: '00000000-0000-4000-8000-000000000110',
    financial_year: 2026,
    status: 'draft',
    copy_source_year: null,
    copy_percent_bp: null,
    approved_body: null,
    approved_on: null,
    approval_meeting_id: null,
    approval_document_id: null,
    approval_note: null,
    approved_by: null,
    approved_at: null,
    version: 1,
    created_at: '2026-11-23T00:00:00.000Z',
    updated_at: '2026-11-23T00:00:00.000Z',
  },
  heads: [
    {
      category_id: category.id,
      income_type: null,
      name: category.name,
      kind: 'spending',
    },
    ...incomeHeads.map(([income_type, name]) => ({
      category_id: null,
      income_type,
      name,
      kind: 'income' as const,
    })),
  ],
  lines: [
    {
      id: '00000000-0000-4000-8000-000000000111',
      category_id: category.id,
      income_type: null,
      name: category.name,
      phasing: 'equal_monthly',
      annual_paise: 120000,
      month_paise: Array.from({ length: 12 }, () => 10000),
    },
    ...incomeHeads.map(([income_type, name], index) => ({
      id: `00000000-0000-4000-8000-0000000001${12 + index}`,
      category_id: null,
      income_type,
      name,
      phasing: 'equal_monthly' as const,
      annual_paise: 120000,
      month_paise: Array.from({ length: 12 }, () => 10000),
    })),
  ],
  changes: [],
  current_plan: [
    {
      category_id: category.id,
      income_type: null,
      name: category.name,
      kind: 'spending',
      line_id: '00000000-0000-4000-8000-000000000111',
      original_paise: 120000,
      changes_paise: 0,
      current_paise: 120000,
      original_month_paise: Array.from({ length: 12 }, () => 10000),
      current_month_paise: Array.from({ length: 12 }, () => 10000),
    },
    ...incomeHeads.map(([income_type, name]) => ({
      category_id: null,
      income_type,
      name,
      kind: 'income' as const,
      line_id: null,
      original_paise: 120000,
      changes_paise: 0,
      current_paise: 120000,
      original_month_paise: Array.from({ length: 12 }, () => 10000),
      current_month_paise: Array.from({ length: 12 }, () => 10000),
    })),
  ],
  approval_choices: {
    meetings: [],
    documents: [],
  },
};
const approvedBudget: ExpenseBudget = {
  ...draftBudget,
  budget: {
    ...draftBudget.budget!,
    id: '00000000-0000-4000-8000-000000000120',
    status: 'approved',
    approved_body: 'committee',
    approved_on: '2026-11-01',
    approved_by: staff[0]!.user_id,
    approved_at: '2026-11-01T10:00:00.000Z',
    version: 2,
  },
};
const budgetReport: ExpenseBudgetReport = {
  financial_year: 2026,
  from: '2026-04-01',
  to: '2027-03-31',
  as_of: '2026-11-23',
  approved: true,
  forecast_method: 'budget',
  months_averaged: 0,
  summary: [
    {
      category_id: category.id,
      income_type: null,
      name: category.name,
      kind: 'spending',
      budgeted: true,
      original_paise: 120000,
      changes_paise: 0,
      current_paise: 120000,
      plan_to_date_paise: 80000,
      actual_to_date_paise: 72000,
      difference_paise: 8000,
      difference_label: 'Below budget',
      percent_used_bp: 9000,
      burn_rate_bp: 9000,
      warning: 'watch',
      projected_year_end_paise: 108000,
      projected_overrun_paise: null,
      projection_available: true,
    },
    {
      category_id: '00000000-0000-4000-8000-000000000121',
      income_type: null,
      name: 'Security',
      kind: 'spending',
      budgeted: true,
      original_paise: 240000,
      changes_paise: 0,
      current_paise: 240000,
      plan_to_date_paise: 160000,
      actual_to_date_paise: 176000,
      difference_paise: -16000,
      difference_label: 'Over budget',
      percent_used_bp: 11000,
      burn_rate_bp: 11000,
      warning: 'over_plan',
      projected_year_end_paise: 264000,
      projected_overrun_paise: 24000,
      projection_available: true,
    },
  ],
  months: [],
  cash_flow: [],
  opening_money_paise: 0,
  accounts_added_opening_paise: 0,
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
      <section aria-label="Budget controls" className="grid gap-space-5">
        <h2 className="text-heading font-semibold">Budget controls</h2>
        <ExpenseBudgetDraftForm
          workspace={draftBudget}
          action={accept(expenseBudgetDraftInputSchema, 'Budget draft saved.')}
        />
        <ExpenseBudgetApprovalForm
          workspace={draftBudget}
          action={accept(expenseBudgetApproveInputSchema, 'Budget approved.')}
        />
        <ExpenseBudgetChangeForm
          workspace={approvedBudget}
          action={accept(
            expenseBudgetChangeInputSchema,
            'Budget change recorded.',
          )}
        />
        <ExpenseBudgetSettingsForm
          workspace={approvedBudget}
          action={accept(
            expenseBudgetSettingsInputSchema,
            'Budget settings saved.',
          )}
        />
        <ExpenseBudgetReportTable locale="en" report={budgetReport} />
      </section>
    </main>
  );
}
