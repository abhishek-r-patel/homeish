// Exercise P40.9 and P50.1 forms without database writes.
'use client';
import type { ZodType } from 'zod';
import { Banner } from '@/components/ui/feedback';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import {
  RepairForecastFundForm,
  RepairForecastItemForm,
} from '@/components/expense/repair-forecast';
import { MajorWorksProjectForm } from '@/components/major-works/project-forms';
import {
  MajorWorksBudgetForm,
  MajorWorksStatusForm,
} from '@/components/major-works/status-budget-forms';
import { MajorWorksSpendTagForm } from '@/components/major-works/spend-forms';
import { MajorWorksAuditForm } from '@/components/major-works/audit-forms';
import {
  MajorWorksQuoteForm,
  MajorWorksChosenQuoteForm,
} from '@/components/major-works/quote-forms';
import {
  MajorWorksCriteriaForm,
  MajorWorksScoresForm,
  MajorWorksScoringTransitionForm,
} from '@/components/major-works/scoring-forms';
import { MajorWorksScenarioForm } from '@/components/major-works/scenario-form';
import {
  MajorWorksProposalForm,
  MajorWorksProposalStageForm,
  MajorWorksProposalArchiveForm,
} from '@/components/major-works/proposal-forms';
import { MajorWorksSummaryView } from '@/components/major-works/summary-view';
import {
  MajorWorksConsentMethodForm,
  MajorWorksConsentPollForm,
  MajorWorksConsentRecordForm,
  MajorWorksMilestoneForm,
} from '@/components/major-works/consent-forms';
import {
  expenseRepairForecastFundInputSchema,
  expenseRepairForecastItemInputSchema,
  type ExpenseRepairForecast,
} from '@/core/expense/repair-forecast-validation';
import {
  majorWorksBudgetInputSchema,
  majorWorksAuditInputSchema,
  majorWorksProjectInputSchema,
  majorWorksProjectStatusInputSchema,
  majorWorksChosenQuoteInputSchema,
  majorWorksCriteriaInputSchema,
  majorWorksQuoteInputSchema,
  majorWorksScoresInputSchema,
  majorWorksScoringTransitionInputSchema,
  majorWorksScenarioInputSchema,
  majorWorksProposalInputSchema,
  majorWorksProposalStageInputSchema,
  majorWorksProposalArchiveInputSchema,
  majorWorksConsentMethodInputSchema,
  majorWorksConsentPollInputSchema,
  majorWorksConsentRecordInputSchema,
  majorWorksMilestoneInputSchema,
  majorWorksSpendTagInputSchema,
  type MajorWorksAdminList,
  type MajorWorksProject,
  type MajorWorksScoring,
  type MajorWorksScenarios,
  type MajorWorksConsentView,
  type MajorWorksSummary,
} from '@/core/major-works/validation';

const forecastItemId = '00000000-0000-4000-8000-000000000501';
const projectId = '00000000-0000-4000-8000-000000000502';
const entryId = '00000000-0000-4000-8000-000000000503';
const fundId = '00000000-0000-4000-8000-000000000504';
const forecast: ExpenseRepairForecast = {
  today: '2026-11-23',
  financial_year_start: '2026-04-01',
  can_manage: true,
  include_archived: false,
  items: [
    {
      id: forecastItemId,
      name: 'Lift modernization',
      category: 'lifts',
      last_done_year: 2020,
      cycle_years: 20,
      manual_next_due_year: null,
      current_cost_paise: 700_000_000,
      inflation_bp: 750,
      notes: 'Synthetic forecast fixture.',
      archived_at: null,
      archive_reason: null,
      updated_at: '2026-11-23T00:00:00.000Z',
      next_due_year: 2040,
      overdue: false,
      years: Array.from({ length: 10 }, (_, index) => ({
        financial_year: 2026 + index,
        amount_paise: 0,
      })),
      project_id: null,
      project_title: null,
    },
  ],
  years: Array.from({ length: 10 }, (_, index) => ({
    financial_year: 2026 + index,
    total_paise: 0,
  })),
  gap_fund_id: fundId,
  gap_fund_name: 'Synthetic repair fund',
  gap_fund_balance_paise: 200_000_000,
  fund_balance_available: true,
  settings_updated_at: '2026-11-23T00:00:00.000Z',
  funds: [{ id: fundId, name: 'Synthetic repair fund' }],
};
const project: MajorWorksProject = {
  id: projectId,
  title: 'Lift modernization',
  location: 'Block A',
  category: 'lifts',
  priority: 'high',
  estimate_paise: 700_000_000,
  planned_start_on: '2026-12-01',
  planned_end_on: '2027-02-28',
  actual_start_on: null,
  actual_end_on: null,
  progress_percent: 10,
  notes: 'Synthetic project fixture.',
  forecast_item_id: forecastItemId,
  status: 'quoting',
  status_reason: null,
  resume_status: null,
  approval_body: null,
  approval_date: null,
  approval_meeting_resolution_id: null,
  budget_source: 'typed',
  typed_budget_paise: 200_000_000,
  linked_budget_paise: null,
  fund_work_id: null,
  budget_paise: 200_000_000,
  spend_paise: 0,
  spend_tags: [],
  updated_at: '2026-11-23T00:00:00.000Z',
};
const summary: MajorWorksSummary = {
  projects: [
    {
      id: projectId,
      title: project.title,
      status: project.status,
      progress_percent: project.progress_percent,
      planned_end_on: project.planned_end_on,
      budget_paise: project.budget_paise,
      spend_paise: project.spend_paise,
      delayed: true,
    },
  ],
  overdue_audits: true,
  proposals_by_stage: [
    { stage: 'under_review', count: 1 },
    { stage: 'selected', count: 1 },
  ],
};
const meetingResolutions: MajorWorksAdminList['meeting_resolutions'] = [
  {
    id: '00000000-0000-4000-8000-000000000505',
    title: 'Approve lift work',
    passed_on: '2026-11-20',
  },
];
const expenseEntries: MajorWorksAdminList['expense_entries'] = [
  {
    id: entryId,
    entry_date: '2026-11-10',
    counterparty: 'Synthetic lift contractor',
    amount_paise: 50_000_000,
    remaining_paise: 50_000_000,
  },
];
const sanctionedWorks: MajorWorksAdminList['sanctioned_works'] = [
  {
    id: '00000000-0000-4000-8000-000000000506',
    title: 'Synthetic sanctioned lift work',
    amount_paise: 800_000_000,
  },
];
const audit = {
  id: '00000000-0000-4000-8000-000000000507',
  audit_on: '2026-11-01',
  auditor_name: 'Synthetic structural auditor',
  findings: 'Synthetic structural audit findings.',
  rating: 'minor_repairs' as const,
  report_path: null,
  repair_status: 'pending' as const,
  next_due_on: '2027-11-01',
  reminder_due_sent_at: null,
  reminder_overdue_sent_at: null,
  voided_at: null,
  void_reason: null,
  updated_at: '2026-11-23T00:00:00.000Z',
  projects: [{ id: projectId, title: project.title }],
};
const scoringSetup: MajorWorksScoring = {
  project_id: projectId,
  scoring_state: 'setup',
  not_scored_reason: null,
  chosen_quote_id: null,
  chosen_quote_reason: null,
  updated_at: '2026-11-23T00:00:00.000Z',
  can_manage: true,
  quotes: [],
  criteria: [],
  my_scores: [],
  vendor_quotes: [],
};
const scoringOpen: MajorWorksScoring = {
  ...scoringSetup,
  scoring_state: 'open',
  quotes: [
    {
      id: '00000000-0000-4000-8000-000000000508',
      source: 'typed',
      vendor_quote_id: null,
      vendor_name: 'Synthetic quote A',
      amount_paise: 10_000_000,
      scope_note: 'Synthetic scope',
      file_path: null,
      like_for_like: true,
      excluded_at: null,
      exclusion_reason: null,
      removed_at: null,
      removal_reason: null,
      weighted_average: null,
      scorer_count: null,
    },
  ],
  criteria: [
    {
      id: '00000000-0000-4000-8000-000000000509',
      name: 'Price',
      weight: 60,
      position: 1,
    },
    {
      id: '00000000-0000-4000-8000-000000000510',
      name: 'Quality',
      weight: 40,
      position: 2,
    },
  ],
};
const scoringClosed: MajorWorksScoring = {
  ...scoringOpen,
  scoring_state: 'closed',
  chosen_quote_id: scoringOpen.quotes[0]!.id,
  chosen_quote_reason: null,
};
const scenarioData: MajorWorksScenarios = {
  can_manage: true,
  expense_enabled: true,
  scenarios: [],
  funds: [
    {
      id: fundId,
      name: 'Synthetic repair fund',
      balance_paise: 100_000_000,
    },
  ],
  project: {
    id: projectId,
    title: project.title,
    estimate_paise: project.estimate_paise,
    budget_paise: project.budget_paise,
  },
};
const proposal = {
  id: '00000000-0000-4000-8000-000000000511',
  developer_name: 'Synthetic Developer',
  received_on: '2026-11-01',
  stage: 'received' as const,
  stage_reason: null,
  decision_due_on: '2026-12-01',
  extra_area_bp: 1250,
  monthly_rent_paise: 5_000_000,
  corpus_paise: 75_000_000,
  timeline_months: 24,
  bank_guarantee_paise: 100_000_000,
  other_terms: 'Synthetic developer-stated terms.',
  archived_at: null,
  updated_at: '2026-11-23T00:00:00.000Z',
  files: [],
};
const terminalProposal = {
  ...proposal,
  id: '00000000-0000-4000-8000-000000000513',
  stage: 'selected' as const,
};
const consentView: MajorWorksConsentView = {
  method: 'poll',
  poll_id: null,
  poll_applied_at: null,
  records: [
    {
      unit_id: '00000000-0000-4000-8000-000000000512',
      unit_number: 'A-101',
      status: 'pending',
      method: null,
      recorded_on: null,
      version: 1,
      has_signed_form: false,
      signed_form_path: null,
      signed_form_url: null,
    },
  ],
  indicative_poll_answers: [],
};

function input(form: FormData): unknown {
  const value = form.get('input');
  return typeof value === 'string' ? JSON.parse(value) : null;
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

export default function MajorWorksFixturePage() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
      <Banner title="Synthetic P40.9 and P50.1 fixture" tone="info">
        Development-only simulated actions. No database writes.
      </Banner>
      <h1 className="text-title font-semibold">Major works controls</h1>
      <section aria-label="Repair forecast item" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Repair forecast item</h2>
        <RepairForecastItemForm
          action={accept(
            expenseRepairForecastItemInputSchema,
            'Repair forecast item saved.',
          )}
          item={forecast.items[0]}
        />
      </section>
      <section aria-label="Proposal archive" className="grid gap-space-3">
        <MajorWorksProposalArchiveForm
          action={accept(
            majorWorksProposalArchiveInputSchema,
            'Proposal archived.',
          )}
          proposal={terminalProposal}
          refresh={false}
        />
      </section>
      <section aria-label="Major works summary fixture">
        <MajorWorksSummaryView locale="en" summary={summary} />
      </section>
      <section aria-label="Forecast fund" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Forecast fund</h2>
        <RepairForecastFundForm
          action={accept(
            expenseRepairForecastFundInputSchema,
            'Forecast gap fund updated.',
          )}
          forecast={forecast}
        />
      </section>
      <section aria-label="Repair project" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Repair project</h2>
        <MajorWorksProjectForm
          action={accept(majorWorksProjectInputSchema, 'Repair project saved.')}
          forecastItems={forecast.items.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            estimate_paise: item.current_cost_paise,
          }))}
          project={project}
        />
      </section>
      <section aria-label="Project status" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Project status</h2>
        <MajorWorksStatusForm
          action={accept(
            majorWorksProjectStatusInputSchema,
            'Repair project status updated.',
          )}
          meetingResolutions={meetingResolutions}
          project={project}
        />
      </section>
      <section aria-label="Project budget" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Project budget</h2>
        <MajorWorksBudgetForm
          action={accept(
            majorWorksBudgetInputSchema,
            'Repair project budget source updated.',
          )}
          project={project}
          sanctionedWorks={sanctionedWorks}
        />
      </section>
      <section aria-label="Project spend" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Project spend</h2>
        <MajorWorksSpendTagForm
          action={accept(
            majorWorksSpendTagInputSchema,
            'Accounts expense tagged to the repair project.',
          )}
          entries={expenseEntries}
          project={project}
        />
      </section>
      <section aria-label="Structural audit" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Structural audit</h2>
        <MajorWorksAuditForm
          action={accept(majorWorksAuditInputSchema, 'Structural audit saved.')}
          audit={audit}
          projects={[{ id: projectId, title: project.title }]}
        />
      </section>
      <section aria-label="Quote entry" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Quote entry</h2>
        <MajorWorksQuoteForm
          action={accept(majorWorksQuoteInputSchema, 'Quote added.')}
          projectId={projectId}
          refresh={false}
          vendorQuotes={[]}
        />
      </section>
      <section aria-label="Scoring criteria" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Scoring criteria</h2>
        <MajorWorksCriteriaForm
          action={accept(
            majorWorksCriteriaInputSchema,
            'Scoring criteria saved.',
          )}
          data={scoringSetup}
          refresh={false}
        />
        <MajorWorksScoringTransitionForm
          action={accept(
            majorWorksScoringTransitionInputSchema,
            'Scoring state updated.',
          )}
          data={scoringSetup}
          refresh={false}
        />
      </section>
      <section aria-label="Private scoring" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Private scoring</h2>
        <MajorWorksScoresForm
          action={accept(majorWorksScoresInputSchema, 'Private scores saved.')}
          data={scoringOpen}
          refresh={false}
        />
      </section>
      <section aria-label="Chosen quote" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Chosen quote</h2>
        <MajorWorksChosenQuoteForm
          action={accept(
            majorWorksChosenQuoteInputSchema,
            'Chosen quote recorded. Homeish did not recommend it.',
          )}
          data={scoringClosed}
          refresh={false}
        />
      </section>
      <section aria-label="Funding scenario" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Funding scenario</h2>
        <MajorWorksScenarioForm
          action={accept(
            majorWorksScenarioInputSchema,
            'What-if funding scenario saved. No bill or levy was created.',
          )}
          data={scenarioData}
          projectId={projectId}
          refresh={false}
        />
      </section>
      <section aria-label="Redevelopment proposal" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Redevelopment proposal</h2>
        <MajorWorksProposalForm
          action={accept(
            majorWorksProposalInputSchema,
            'Redevelopment proposal saved.',
          )}
          proposal={proposal}
          refresh={false}
        />
        <MajorWorksProposalStageForm
          action={accept(
            majorWorksProposalStageInputSchema,
            'Redevelopment proposal stage updated.',
          )}
          proposal={proposal}
          refresh={false}
        />
      </section>
      <section aria-label="Consent controls" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Consent controls</h2>
        <MajorWorksConsentMethodForm
          action={accept(
            majorWorksConsentMethodInputSchema,
            'Consent method updated.',
          )}
          data={consentView}
          refresh={false}
        />
        <MajorWorksConsentRecordForm
          action={accept(
            majorWorksConsentRecordInputSchema,
            'Owner-unit consent recorded.',
          )}
          proposalId={proposal.id}
          record={consentView.records[0]!}
          refresh={false}
        />
        <MajorWorksConsentPollForm
          action={accept(
            majorWorksConsentPollInputSchema,
            'Draft consent poll created.',
          )}
          data={consentView}
          proposalId={proposal.id}
          refresh={false}
        />
      </section>
      <section
        aria-label="Redevelopment milestone"
        className="grid gap-space-3"
      >
        <h2 className="text-heading font-semibold">Redevelopment milestone</h2>
        <MajorWorksMilestoneForm
          action={accept(
            majorWorksMilestoneInputSchema,
            'Redevelopment milestone saved.',
          )}
          proposalId={proposal.id}
          refresh={false}
        />
      </section>
    </main>
  );
}
