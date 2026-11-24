// Validate factual compliance records and opt-in cleanup rules.
import { z } from 'zod';

const timestamp = z.iso.datetime({ offset: true });
export const COMPLIANCE_RECURRENCES = [
  'none',
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
] as const;
export const COMPLIANCE_STATUSES = [
  'pending',
  'done',
  'not_applicable',
] as const;

export const complianceEntryInputSchema = z
  .object({
    id: z.uuid().nullable(),
    title: z.string().trim().min(1).max(120),
    authority: z.string().trim().min(1).max(120),
    recurrence: z.enum(COMPLIANCE_RECURRENCES),
    dueDate: z.iso.date(),
    responsibleMembershipId: z.uuid(),
    status: z.enum(COMPLIANCE_STATUSES),
    completedOn: z.iso.date().nullable(),
    evidenceVersionId: z.uuid().nullable(),
    note: z.string().trim().max(2000),
    expectedVersion: z.number().int().positive().nullable(),
    reason: z.string().trim().max(500).nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'done' && value.completedOn === null) {
      context.addIssue({
        code: 'custom',
        path: ['completedOn'],
        message: 'Add the verified completion date.',
      });
    }
    if ((value.id === null) !== (value.expectedVersion === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedVersion'],
        message: 'Refresh this record before editing.',
      });
    }
    if (value.id !== null && (!value.reason || value.reason.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A reason is required when changing a record.',
      });
    }
  });

export const complianceRemindersInputSchema = z
  .object({ enabled: z.boolean() })
  .strict();

export const dataCleanupRuleInputSchema = z
  .object({
    recordKind: z.enum(['compliance_entry', 'official_case']),
    enabled: z.boolean(),
    olderThanYears: z.number().int().min(1).max(20),
    expectedVersion: z.number().int().positive().nullable(),
  })
  .strict();

const evidenceChoiceSchema = z
  .object({
    version_id: z.uuid(),
    document_title: z.string(),
    file_name: z.string(),
  })
  .strict();

export const complianceWorkspaceSchema = z
  .object({
    warning: z.string(),
    acknowledged_at: timestamp.nullable(),
    can_manage: z.boolean(),
    reminders_enabled: z.boolean(),
    responsible_choices: z.array(
      z
        .object({
          membership_id: z.uuid(),
          name: z.string(),
          roles: z.array(z.string()),
        })
        .strict(),
    ),
    evidence_choices: z.array(evidenceChoiceSchema),
    entries: z.array(
      z
        .object({
          id: z.uuid(),
          title: z.string(),
          authority: z.string(),
          recurrence: z.enum(COMPLIANCE_RECURRENCES),
          due_date: z.iso.date(),
          next_due_date: z.iso.date().nullable(),
          responsible_membership_id: z.uuid(),
          responsible_name: z.string(),
          status: z.enum(COMPLIANCE_STATUSES),
          completed_on: z.iso.date().nullable(),
          evidence_version_id: z.uuid().nullable(),
          evidence_name: z.string().nullable(),
          note: z.string(),
          version: z.number().int().positive(),
          updated_at: timestamp,
          due_state: z.enum([
            'upcoming',
            'due_today',
            'overdue',
            'done',
            'not_applicable',
          ]),
        })
        .strict(),
    ),
  })
  .strict();

export const dataCleanupRulesSchema = z.array(
  z
    .object({
      record_kind: z.enum(['compliance_entry', 'official_case']),
      enabled: z.boolean(),
      older_than_years: z.number().int().min(1).max(20),
      version: z.number().int().positive(),
    })
    .strict(),
);

export type ComplianceWorkspace = z.infer<typeof complianceWorkspaceSchema>;
export type ComplianceEntry = ComplianceWorkspace['entries'][number];
export type DataCleanupRule = z.infer<typeof dataCleanupRulesSchema>[number];
