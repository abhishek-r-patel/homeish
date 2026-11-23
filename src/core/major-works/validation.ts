// Validate P50 module settings, project inputs and read models.
import { z } from 'zod';
import { nonnegativeRupeesSchema, rupeesSchema } from '../billing/validation';
import { EXPENSE_REPAIR_FORECAST_CATEGORIES } from '../expense/repair-forecast-validation';

const timestamp = z.iso.datetime({ offset: true });
const optionalDate = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(z.iso.date().nullable());
const optionalUuid = z.uuid().nullable();
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null);
const money = z.number().int().safe().min(0);

export const DEFAULT_MAJOR_WORKS_SETTINGS = {
  consent_method: 'poll',
};
export const majorWorksSettingsSchema = z
  .object({
    consent_method: z.enum(['poll', 'admin_recorded']).optional(),
  })
  .strict();

export const MAJOR_WORKS_PRIORITIES = [
  'low',
  'medium',
  'high',
  'urgent',
] as const;
export const MAJOR_WORKS_STATUSES = [
  'planned',
  'quoting',
  'approved',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
] as const;
export const MAJOR_WORKS_FILE_BYTES = 10 * 1024 * 1024;
export const majorWorksProjectInputSchema = z
  .object({
    projectId: z.uuid().nullable(),
    title: z.string().trim().min(1).max(120),
    location: z.string().trim().min(1).max(120),
    category: z.enum(EXPENSE_REPAIR_FORECAST_CATEGORIES),
    priority: z.enum(MAJOR_WORKS_PRIORITIES),
    estimateRupees: nonnegativeRupeesSchema,
    plannedStartOn: optionalDate,
    plannedEndOn: optionalDate,
    actualStartOn: optionalDate,
    actualEndOn: optionalDate,
    progressPercent: z.coerce.number().int().min(0).max(100),
    notes: optionalText(2000),
    forecastItemId: optionalUuid,
    expectedUpdatedAt: timestamp.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.projectId === null) !== (value.expectedUpdatedAt === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the project before editing.',
      });
    }
    for (const [start, end] of [
      ['plannedStartOn', 'plannedEndOn'],
      ['actualStartOn', 'actualEndOn'],
    ] as const) {
      if (value[start] && value[end] && value[end]! < value[start]!) {
        context.addIssue({
          code: 'custom',
          path: [end],
          message: 'The end date cannot be before the start date.',
        });
      }
    }
  });

export const majorWorksProjectStatusInputSchema = z
  .object({
    projectId: z.uuid(),
    status: z.enum(MAJOR_WORKS_STATUSES),
    reason: optionalText(500),
    approvalBody: z.enum(['committee', 'general_body', 'other']).nullable(),
    approvalDate: optionalDate,
    meetingResolutionId: optionalUuid,
    expectedUpdatedAt: timestamp,
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.status === 'on_hold' || value.status === 'cancelled') &&
      (!value.reason || value.reason.length < 5)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Give a reason of at least 5 characters.',
      });
    }
    if (
      value.status === 'approved' &&
      (!value.approvalBody || !value.approvalDate)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['approvalBody'],
        message: 'Record who approved the work and the approval date.',
      });
    }
  });

export const majorWorksBudgetInputSchema = z
  .object({
    projectId: z.uuid(),
    source: z.enum(['typed', 'sanctioned_work']),
    typedBudgetRupees: nonnegativeRupeesSchema,
    fundWorkId: optionalUuid,
    expectedUpdatedAt: timestamp,
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.source === 'sanctioned_work') !== (value.fundWorkId !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['fundWorkId'],
        message: 'Choose sanctioned work only for the linked budget source.',
      });
    }
  });

export const majorWorksSpendTagInputSchema = z
  .object({
    projectId: z.uuid(),
    entryId: z.uuid(),
    amountRupees: rupeesSchema,
    clientRequestId: z.uuid(),
  })
  .strict();

export const majorWorksSpendTagRemoveInputSchema = z
  .object({
    tagId: z.uuid(),
    reason: z.string().trim().min(5).max(500),
    clientRequestId: z.uuid(),
  })
  .strict();

export const MAJOR_WORKS_AUDIT_RATINGS = [
  'fine',
  'minor_repairs',
  'major_repairs',
  'unsafe',
] as const;
export const MAJOR_WORKS_AUDIT_REPAIR_STATUSES = [
  'not_needed',
  'pending',
  'in_progress',
  'done',
] as const;
export const majorWorksAuditInputSchema = z
  .object({
    auditId: z.uuid().nullable(),
    auditOn: z.iso.date(),
    auditorName: z.string().trim().min(1).max(120),
    findings: z.string().trim().min(1).max(2000),
    rating: z.enum(MAJOR_WORKS_AUDIT_RATINGS),
    reportPath: optionalText(500),
    repairStatus: z.enum(MAJOR_WORKS_AUDIT_REPAIR_STATUSES),
    nextDueOn: z.iso.date(),
    projectIds: z.array(z.uuid()).max(100),
    expectedUpdatedAt: timestamp.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.auditId === null) !== (value.expectedUpdatedAt === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the structural audit before editing.',
      });
    }
    if (value.nextDueOn < value.auditOn) {
      context.addIssue({
        code: 'custom',
        path: ['nextDueOn'],
        message: 'The next due date cannot be before the audit date.',
      });
    }
    if (new Set(value.projectIds).size !== value.projectIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['projectIds'],
        message: 'Choose each linked project once.',
      });
    }
  });
export const majorWorksAuditVoidInputSchema = z
  .object({
    auditId: z.uuid(),
    reason: z.string().trim().min(5).max(500),
    expectedUpdatedAt: timestamp,
    clientRequestId: z.uuid(),
  })
  .strict();

export const majorWorksAuditsSchema = z
  .object({
    can_manage: z.boolean(),
    audits: z.array(
      z
        .object({
          id: z.uuid(),
          audit_on: z.iso.date(),
          auditor_name: z.string(),
          findings: z.string(),
          rating: z.enum(MAJOR_WORKS_AUDIT_RATINGS),
          report_path: z.string().nullable(),
          report_url: z.url().nullable().optional(),
          repair_status: z.enum(MAJOR_WORKS_AUDIT_REPAIR_STATUSES),
          next_due_on: z.iso.date(),
          reminder_due_sent_at: timestamp.nullable(),
          reminder_overdue_sent_at: timestamp.nullable(),
          voided_at: timestamp.nullable(),
          void_reason: z.string().nullable(),
          updated_at: timestamp,
          projects: z.array(
            z.object({ id: z.uuid(), title: z.string() }).strict(),
          ),
        })
        .strict(),
    ),
    projects: z.array(z.object({ id: z.uuid(), title: z.string() }).strict()),
  })
  .strict();

export const majorWorksQuoteInputSchema = z
  .object({
    projectId: z.uuid(),
    vendorQuoteId: z.uuid().nullable(),
    vendorName: z.string().trim().min(1).max(120),
    amountRupees: rupeesSchema,
    scopeNote: z.string().trim().min(1).max(500),
    filePath: optionalText(500),
    likeForLike: z.boolean(),
    clientRequestId: z.uuid(),
  })
  .strict();
export const majorWorksQuoteRemoveInputSchema = z
  .object({
    quoteId: z.uuid(),
    reason: z.string().trim().min(5).max(500),
    exclude: z.boolean(),
    clientRequestId: z.uuid(),
  })
  .strict();
export const majorWorksCriteriaInputSchema = z
  .object({
    projectId: z.uuid(),
    criteria: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(80),
            weight: z.number().int().min(1).max(100),
          })
          .strict(),
      )
      .min(2)
      .max(8),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.criteria.reduce((sum, criterion) => sum + criterion.weight, 0) !==
      100
    ) {
      context.addIssue({
        code: 'custom',
        path: ['criteria'],
        message: 'Criterion weights must total 100.',
      });
    }
  });
export const majorWorksScoringTransitionInputSchema = z
  .object({
    projectId: z.uuid(),
    action: z.enum(['open', 'close', 'not_scored']),
    reason: optionalText(500),
    expectedUpdatedAt: timestamp,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.action === 'not_scored' &&
      (!value.reason || value.reason.length < 5)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Give a reason for marking the project as not scored.',
      });
    }
  });
export const majorWorksScoresInputSchema = z
  .object({
    projectId: z.uuid(),
    items: z.array(
      z
        .object({
          quoteId: z.uuid(),
          criterionId: z.uuid(),
          score: z.coerce.number().int().min(0).max(10),
        })
        .strict(),
    ),
  })
  .strict();
export const majorWorksChosenQuoteInputSchema = z
  .object({
    projectId: z.uuid(),
    quoteId: z.uuid(),
    reason: z.string().trim().min(5).max(500),
    resolutionId: z.uuid().nullable(),
    expectedUpdatedAt: timestamp,
  })
  .strict();

export const majorWorksScoringSchema = z
  .object({
    project_id: z.uuid(),
    scoring_state: z.enum(['setup', 'open', 'closed', 'not_scored']),
    not_scored_reason: z.string().nullable(),
    chosen_quote_id: z.uuid().nullable(),
    chosen_quote_reason: z.string().nullable(),
    updated_at: timestamp,
    can_manage: z.boolean(),
    quotes: z.array(
      z
        .object({
          id: z.uuid(),
          source: z.enum(['vendor_quote', 'typed']),
          vendor_quote_id: z.uuid().nullable(),
          vendor_name: z.string(),
          amount_paise: money,
          scope_note: z.string(),
          file_path: z.string().nullable(),
          file_url: z.url().nullable().optional(),
          like_for_like: z.boolean(),
          excluded_at: timestamp.nullable(),
          exclusion_reason: z.string().nullable(),
          removed_at: timestamp.nullable(),
          removal_reason: z.string().nullable(),
          weighted_average: z.number().nullable(),
          scorer_count: z.number().int().nonnegative().nullable(),
        })
        .strict(),
    ),
    criteria: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string(),
          weight: z.number().int().min(1).max(100),
          position: z.number().int().min(1).max(8),
        })
        .strict(),
    ),
    my_scores: z.array(
      z
        .object({
          quote_id: z.uuid(),
          criterion_id: z.uuid(),
          score: z.number().int().min(0).max(10),
        })
        .strict(),
    ),
    vendor_quotes: z.array(
      z
        .object({
          id: z.uuid(),
          request_id: z.uuid(),
          request_title: z.string(),
          vendor_name: z.string(),
          amount_paise: money,
          scope_note: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export const majorWorksScenarioInputSchema = z
  .object({
    scenarioId: z.uuid().nullable(),
    projectId: z.uuid(),
    name: z.string().trim().min(1).max(80),
    amountBasis: z.enum(['typed', 'estimate', 'budget']),
    typedAmountRupees: z
      .string()
      .trim()
      .max(32)
      .transform((value) => value || null),
    deductionType: z.enum(['none', 'typed', 'fund']),
    deductionRupees: z
      .string()
      .trim()
      .max(32)
      .transform((value) => value || null),
    fundId: z.uuid().nullable(),
    split: z.enum(['area', 'equal']),
    expectedUpdatedAt: timestamp.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.scenarioId === null) !== (value.expectedUpdatedAt === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the scenario before editing.',
      });
    }
    if (
      (value.amountBasis === 'typed') !==
      (value.typedAmountRupees !== null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['typedAmountRupees'],
        message: 'Enter an amount only for a typed scenario.',
      });
    }
    if (
      (value.deductionType === 'typed') !== (value.deductionRupees !== null) ||
      (value.deductionType === 'fund') !== (value.fundId !== null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['deductionRupees'],
        message: 'Choose one valid deduction source.',
      });
    }
  })
  .transform((value, context) => {
    const typedAmount = value.typedAmountRupees
      ? nonnegativeRupeesSchema.safeParse(value.typedAmountRupees)
      : null;
    const typedDeduction = value.deductionRupees
      ? nonnegativeRupeesSchema.safeParse(value.deductionRupees)
      : null;
    if (typedAmount && !typedAmount.success) {
      context.addIssue({
        code: 'custom',
        path: ['typedAmountRupees'],
        message:
          typedAmount.error.issues[0]?.message ?? 'Enter a valid amount.',
      });
      return z.NEVER;
    }
    if (typedDeduction && !typedDeduction.success) {
      context.addIssue({
        code: 'custom',
        path: ['deductionRupees'],
        message:
          typedDeduction.error.issues[0]?.message ?? 'Enter a valid deduction.',
      });
      return z.NEVER;
    }
    return {
      ...value,
      typedAmountPaise: typedAmount?.success ? typedAmount.data : null,
      deductionPaise: typedDeduction?.success ? typedDeduction.data : null,
    };
  });

export const majorWorksScenariosSchema = z
  .object({
    can_manage: z.boolean(),
    expense_enabled: z.boolean(),
    scenarios: z.array(
      z
        .object({
          id: z.uuid(),
          project_id: z.uuid(),
          name: z.string(),
          amount_basis: z.enum(['typed', 'estimate', 'budget']),
          typed_amount_paise: money.nullable(),
          deduction_type: z.enum(['none', 'typed', 'fund']),
          deduction_paise: money.nullable(),
          fund_id: z.uuid().nullable(),
          split: z.enum(['area', 'equal']),
          amount_paise: money,
          complete: z.boolean(),
          rounding_difference_paise: money,
          missing_area_units: z.array(
            z.object({ unit_id: z.uuid(), unit_number: z.string() }).strict(),
          ),
          shares: z.array(
            z
              .object({
                unit_id: z.uuid(),
                unit_number: z.string(),
                area_sqft: z.number().positive().nullable(),
                amount_paise: money,
              })
              .strict(),
          ),
          updated_at: timestamp,
        })
        .strict(),
    ),
    funds: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string(),
          balance_paise: money,
        })
        .strict(),
    ),
    project: z
      .object({
        id: z.uuid(),
        title: z.string(),
        estimate_paise: money,
        budget_paise: money,
      })
      .nullable(),
  })
  .strict();

const proposalAmount = z
  .string()
  .trim()
  .max(32)
  .transform((value) => value || null);
export const majorWorksProposalInputSchema = z
  .object({
    proposalId: z.uuid().nullable(),
    developerName: z.string().trim().min(1).max(120),
    receivedOn: z.iso.date(),
    decisionDueOn: z
      .string()
      .trim()
      .transform((value) => value || null)
      .pipe(z.iso.date().nullable()),
    extraAreaPercent: proposalAmount,
    monthlyRentRupees: proposalAmount,
    corpusRupees: proposalAmount,
    timelineMonths: z
      .string()
      .trim()
      .transform((value) => (value ? Number(value) : null)),
    bankGuaranteeRupees: proposalAmount,
    otherTerms: optionalText(1000),
    expectedUpdatedAt: timestamp.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.proposalId === null) !== (value.expectedUpdatedAt === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the proposal before editing.',
      });
    }
    if (
      value.timelineMonths !== null &&
      (!Number.isInteger(value.timelineMonths) ||
        value.timelineMonths < 1 ||
        value.timelineMonths > 600)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['timelineMonths'],
        message: 'Enter a timeline from 1 to 600 months.',
      });
    }
  })
  .transform((value, context) => {
    function parseMoney(value: string | null, path: string) {
      if (value === null) return null;
      const result = nonnegativeRupeesSchema.safeParse(value);
      if (result.success) return result.data;
      context.addIssue({
        code: 'custom',
        path: [path],
        message: result.error.issues[0]?.message ?? 'Enter a valid amount.',
      });
      return z.NEVER;
    }
    let extraAreaBp: number | null = null;
    if (value.extraAreaPercent !== null) {
      if (!/^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/.test(value.extraAreaPercent)) {
        context.addIssue({
          code: 'custom',
          path: ['extraAreaPercent'],
          message: 'Enter extra area from 0 to 100 with up to two decimals.',
        });
        return z.NEVER;
      }
      const percent = Number(value.extraAreaPercent);
      if (percent > 100) {
        context.addIssue({
          code: 'custom',
          path: ['extraAreaPercent'],
          message: 'Extra area cannot exceed 100%.',
        });
        return z.NEVER;
      }
      extraAreaBp = Math.round(percent * 100);
    }
    return {
      ...value,
      extraAreaBp,
      monthlyRentPaise: parseMoney(
        value.monthlyRentRupees,
        'monthlyRentRupees',
      ),
      corpusPaise: parseMoney(value.corpusRupees, 'corpusRupees'),
      bankGuaranteePaise: parseMoney(
        value.bankGuaranteeRupees,
        'bankGuaranteeRupees',
      ),
    };
  });
export const majorWorksProposalStageInputSchema = z
  .object({
    proposalId: z.uuid(),
    stage: z.enum([
      'under_review',
      'shortlisted',
      'selected',
      'rejected',
      'withdrawn',
    ]),
    reason: optionalText(500),
    expectedUpdatedAt: timestamp,
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      ['rejected', 'withdrawn'].includes(value.stage) &&
      (!value.reason || value.reason.length < 5)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Give a reason for rejecting or withdrawing the proposal.',
      });
    }
  });
export const majorWorksProposalFileInputSchema = z
  .object({
    proposalId: z.uuid(),
    path: z.string().trim().min(1).max(500),
    clientRequestId: z.uuid(),
  })
  .strict();
export const majorWorksProposalsSchema = z
  .object({
    can_manage: z.boolean(),
    proposals: z.array(
      z
        .object({
          id: z.uuid(),
          developer_name: z.string(),
          received_on: z.iso.date(),
          stage: z.enum([
            'received',
            'under_review',
            'shortlisted',
            'selected',
            'rejected',
            'withdrawn',
          ]),
          stage_reason: z.string().nullable(),
          decision_due_on: z.iso.date().nullable(),
          extra_area_bp: z.number().int().nullable(),
          monthly_rent_paise: money.nullable(),
          corpus_paise: money.nullable(),
          timeline_months: z.number().int().nullable(),
          bank_guarantee_paise: money.nullable(),
          other_terms: z.string().nullable(),
          archived_at: timestamp.nullable(),
          updated_at: timestamp,
          files: z.array(
            z
              .object({
                id: z.uuid(),
                path: z.string(),
                url: z.url().optional(),
                content_type: z.enum([
                  'application/pdf',
                  'image/jpeg',
                  'image/png',
                ]),
                size_bytes: z.number().int().positive(),
                created_at: timestamp,
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export const majorWorksConsentMethodInputSchema = z
  .object({
    method: z.enum(['poll', 'admin_recorded']),
    confirmed: z.boolean(),
    clientRequestId: z.uuid(),
  })
  .strict();
export const majorWorksConsentRecordInputSchema = z
  .object({
    proposalId: z.uuid(),
    unitId: z.uuid(),
    status: z.enum(['consents', 'does_not_consent']),
    signedFormPath: optionalText(500),
    expectedVersion: z.number().int().positive(),
    clientRequestId: z.uuid(),
  })
  .strict();
export const majorWorksConsentPollInputSchema = z
  .object({
    proposalId: z.uuid(),
    confirmed: z.boolean(),
    clientRequestId: z.uuid(),
  })
  .strict();
export const majorWorksConsentViewSchema = z
  .object({
    method: z.enum(['poll', 'admin_recorded']),
    poll_id: z.uuid().nullable(),
    poll_applied_at: timestamp.nullable(),
    records: z.array(
      z
        .object({
          unit_id: z.uuid(),
          unit_number: z.string(),
          status: z.enum(['pending', 'consents', 'does_not_consent']),
          method: z.enum(['poll', 'admin']).nullable(),
          recorded_on: z.iso.date().nullable(),
          version: z.number().int().positive(),
          has_signed_form: z.boolean(),
          signed_form_path: z.string().nullable(),
          signed_form_url: z.url().nullable().optional(),
        })
        .strict(),
    ),
    indicative_poll_answers: z.array(
      z
        .object({
          unit_id: z.uuid(),
          label: z.enum(['I consent', 'I do not consent']),
        })
        .strict(),
    ),
  })
  .strict();
export const majorWorksMyConsentsSchema = z
  .object({
    consents: z.array(
      z
        .object({
          proposal_id: z.uuid(),
          developer_name: z.string(),
          unit_id: z.uuid(),
          unit_number: z.string(),
          status: z.enum(['pending', 'consents', 'does_not_consent']),
          method: z.enum(['poll', 'admin']).nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export const majorWorksMilestoneInputSchema = z
  .object({
    milestoneId: z.uuid().nullable(),
    proposalId: z.uuid(),
    title: z.string().trim().min(1).max(120),
    plannedOn: z
      .string()
      .trim()
      .transform((value) => value || null)
      .pipe(z.iso.date().nullable()),
    actualOn: z
      .string()
      .trim()
      .transform((value) => value || null)
      .pipe(z.iso.date().nullable()),
    status: z.enum(['todo', 'done', 'not_needed']),
    note: optionalText(500),
    position: z.coerce.number().int().min(1).max(100),
    expectedUpdatedAt: timestamp.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.milestoneId === null) !== (value.expectedUpdatedAt === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedUpdatedAt'],
        message: 'Refresh the milestone before editing.',
      });
    }
  });
export const majorWorksMilestonesSchema = z
  .object({
    can_manage: z.boolean(),
    milestones: z.array(
      z
        .object({
          id: z.uuid(),
          proposal_id: z.uuid(),
          title: z.string(),
          planned_on: z.iso.date().nullable(),
          actual_on: z.iso.date().nullable(),
          status: z.enum(['todo', 'done', 'not_needed']),
          note: z.string().nullable(),
          position: z.number().int(),
          updated_at: timestamp,
        })
        .strict(),
    ),
  })
  .strict();

export const majorWorksSummarySchema = z
  .object({
    projects: z.array(
      z
        .object({
          id: z.uuid(),
          title: z.string(),
          status: z.enum(MAJOR_WORKS_STATUSES),
          progress_percent: z.number().int().min(0).max(100),
          planned_end_on: z.iso.date().nullable(),
          budget_paise: money,
          spend_paise: money.nullable(),
          delayed: z.boolean(),
        })
        .strict(),
    ),
    overdue_audits: z.boolean(),
    proposals_by_stage: z.array(
      z
        .object({
          stage: z.enum([
            'received',
            'under_review',
            'shortlisted',
            'selected',
            'rejected',
            'withdrawn',
          ]),
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
  })
  .strict();
export const majorWorksProposalArchiveInputSchema = z
  .object({
    proposalId: z.uuid(),
    expectedUpdatedAt: timestamp,
    clientRequestId: z.uuid(),
  })
  .strict();

const projectSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    location: z.string(),
    category: z.enum(EXPENSE_REPAIR_FORECAST_CATEGORIES),
    priority: z.enum(MAJOR_WORKS_PRIORITIES),
    estimate_paise: money,
    planned_start_on: z.iso.date().nullable(),
    planned_end_on: z.iso.date().nullable(),
    actual_start_on: z.iso.date().nullable(),
    actual_end_on: z.iso.date().nullable(),
    progress_percent: z.number().int().min(0).max(100),
    notes: z.string().nullable(),
    forecast_item_id: z.uuid().nullable(),
    status: z.enum(MAJOR_WORKS_STATUSES),
    status_reason: z.string().nullable(),
    resume_status: z.enum(['quoting', 'approved', 'in_progress']).nullable(),
    approval_body: z.enum(['committee', 'general_body', 'other']).nullable(),
    approval_date: z.iso.date().nullable(),
    approval_meeting_resolution_id: z.uuid().nullable(),
    budget_source: z.enum(['typed', 'sanctioned_work']),
    typed_budget_paise: money,
    linked_budget_paise: money.nullable(),
    fund_work_id: z.uuid().nullable(),
    budget_paise: money,
    spend_paise: money.nullable(),
    spend_tags: z.array(
      z
        .object({
          id: z.uuid(),
          entry_id: z.uuid(),
          entry_date: z.iso.date(),
          counterparty: z.string(),
          amount_paise: money,
          removed_at: timestamp.nullable(),
          removal_reason: z.string().nullable(),
        })
        .strict(),
    ),
    updated_at: timestamp,
  })
  .strict();

export const majorWorksAdminListSchema = z
  .object({
    can_manage: z.boolean(),
    expense_enabled: z.boolean(),
    meeting_enabled: z.boolean(),
    projects: z.array(projectSchema),
    forecast_items: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string(),
          category: z.enum(EXPENSE_REPAIR_FORECAST_CATEGORIES),
          estimate_paise: money,
        })
        .strict(),
    ),
    sanctioned_works: z.array(
      z
        .object({
          id: z.uuid(),
          title: z.string(),
          amount_paise: money,
        })
        .strict(),
    ),
    expense_entries: z.array(
      z
        .object({
          id: z.uuid(),
          entry_date: z.iso.date(),
          counterparty: z.string(),
          amount_paise: money,
          remaining_paise: money,
        })
        .strict(),
    ),
    meeting_resolutions: z.array(
      z
        .object({
          id: z.uuid(),
          title: z.string(),
          passed_on: z.iso.date(),
        })
        .strict(),
    ),
  })
  .strict();

export const majorWorksResidentListSchema = z
  .object({
    projects: z.array(
      z
        .object({
          id: z.uuid(),
          title: z.string(),
          location: z.string(),
          status: z.enum(MAJOR_WORKS_STATUSES),
          progress_percent: z.number().int().min(0).max(100),
          planned_start_on: z.iso.date().nullable(),
          planned_end_on: z.iso.date().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export type MajorWorksAdminList = z.infer<typeof majorWorksAdminListSchema>;
export type MajorWorksProject = z.infer<typeof projectSchema>;
export type MajorWorksAudits = z.infer<typeof majorWorksAuditsSchema>;
export type MajorWorksScoring = z.infer<typeof majorWorksScoringSchema>;
export type MajorWorksScenarios = z.infer<typeof majorWorksScenariosSchema>;
export type MajorWorksProposals = z.infer<typeof majorWorksProposalsSchema>;
export type MajorWorksConsentView = z.infer<typeof majorWorksConsentViewSchema>;
export type MajorWorksMilestones = z.infer<typeof majorWorksMilestonesSchema>;
export type MajorWorksSummary = z.infer<typeof majorWorksSummarySchema>;
