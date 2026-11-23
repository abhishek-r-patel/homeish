// Validate admin-only official case fields and eligible source links.
import { z } from 'zod';

const timestamp = z.iso.datetime({ offset: true });
export const officialCaseInputSchema = z
  .object({
    id: z.uuid().nullable(),
    authority: z.string().trim().min(1).max(120),
    reference: z.string().trim().min(1).max(120),
    subject: z.string().trim().min(1).max(200),
    relevantPeriod: z.string().trim().max(120),
    receivedOn: z.iso.date().nullable(),
    filedOn: z.iso.date().nullable(),
    filingMode: z.string().trim().max(120).nullable(),
    filingAcknowledgement: z.string().trim().max(200).nullable(),
    replyDueOn: z.iso.date().nullable(),
    hearingOn: z.iso.date().nullable(),
    responseOn: z.iso.date().nullable(),
    status: z.enum(['open', 'closed']),
    reviewerMembershipId: z.uuid().nullable(),
    complianceEntryId: z.uuid().nullable(),
    closedOn: z.iso.date().nullable(),
    note: z.string().trim().max(5000),
    expectedVersion: z.number().int().positive().nullable(),
    reason: z.string().trim().max(500).nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'closed' && value.closedOn === null) {
      context.addIssue({
        code: 'custom',
        path: ['closedOn'],
        message: 'Add the verified closure date.',
      });
    }
    if ((value.id === null) !== (value.expectedVersion === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedVersion'],
        message: 'Refresh this case before editing.',
      });
    }
    if (value.id !== null && (!value.reason || value.reason.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A reason is required when changing a case.',
      });
    }
  });

export const officialCaseLinkInputSchema = z
  .object({ caseId: z.uuid(), versionId: z.uuid() })
  .strict();

export const officialCaseRemindersInputSchema = z
  .object({ enabled: z.boolean() })
  .strict();

export const officialCaseWorkspaceSchema = z
  .object({
    warning: z.string(),
    acknowledged: z.boolean(),
    reminders_enabled: z.boolean(),
    reviewer_choices: z.array(
      z.object({ membership_id: z.uuid(), name: z.string() }).strict(),
    ),
    compliance_choices: z.array(
      z.object({ id: z.uuid(), title: z.string() }).strict(),
    ),
    evidence_choices: z.array(
      z
        .object({
          version_id: z.uuid(),
          document_title: z.string(),
          file_name: z.string(),
        })
        .strict(),
    ),
    cases: z.array(
      z
        .object({
          id: z.uuid(),
          authority: z.string(),
          reference: z.string(),
          subject: z.string(),
          relevant_period: z.string(),
          received_on: z.iso.date().nullable(),
          filed_on: z.iso.date().nullable(),
          filing_mode: z.string().nullable(),
          filing_acknowledgement: z.string().nullable(),
          reply_due_on: z.iso.date().nullable(),
          hearing_on: z.iso.date().nullable(),
          response_on: z.iso.date().nullable(),
          status: z.enum(['open', 'closed']),
          reviewer_membership_id: z.uuid().nullable(),
          reviewer_name: z.string().nullable(),
          compliance_entry_id: z.uuid().nullable(),
          compliance_title: z.string().nullable(),
          closed_on: z.iso.date().nullable(),
          note: z.string(),
          version: z.number().int().positive(),
          updated_at: timestamp,
          next_date: z.iso.date().nullable(),
          due_state: z.enum(['upcoming', 'due_today', 'overdue', 'closed']),
          evidence: z.array(
            z
              .object({
                version_id: z.uuid(),
                document_title: z.string(),
                file_name: z.string(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export type OfficialCaseWorkspace = z.infer<typeof officialCaseWorkspaceSchema>;
