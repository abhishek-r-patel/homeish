// Validate transfer, handover and certificate contracts independently of generated database types.
import { z } from 'zod';
import { FILE_CONTENT_TYPES, MAX_FILE_BYTES } from '../../files/constraints';

const timestamp = z.iso.datetime({ offset: true });
const version = z.number().int().min(1).max(2_147_483_647);
const nullableUuid = z.uuid().nullable();

export const CLEARANCE_WARNING =
  'This tracker is not legal advice and is not proof of title transfer. It does not replace checking the applicable state act or bye-laws.';

export const transferStageSchema = z.enum([
  'received',
  'documents_checked',
  'committee_decision',
  'dues_settled',
  'completed',
  'rejected',
  'withdrawn',
]);
export const transferDecisionSchema = z.enum([
  'approved',
  'approved_with_conditions',
  'rejected',
  'deferred',
]);
export const clearanceHandoverBasisSchema = z.enum(['bills', 'total']);
export const clearanceEvidenceSchema = z.enum([
  'admin_note',
  'signed_upload',
  'in_app_and_upload',
]);
export const certificateKindSchema = z.enum([
  'clearance',
  'conditional',
  'not_checked',
]);

export const transferSellerInputSchema = z
  .object({ membershipId: z.uuid() })
  .strict();
export const transferBuyerInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    membershipId: nullableUuid,
    phone: z.string().trim().max(30).nullable(),
    email: z.email().max(254).nullable(),
  })
  .strict();
export const transferCaseInputSchema = z
  .object({
    caseId: nullableUuid,
    unitId: z.uuid(),
    receivedOn: z.iso.date(),
    sellers: z.array(transferSellerInputSchema).min(1).max(20),
    buyer: transferBuyerInputSchema,
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine(
    (value) => (value.caseId === null) === (value.expectedVersion === null),
    { path: ['expectedVersion'], message: 'Enter the current case version.' },
  );
export const advanceTransferCaseInputSchema = z
  .object({
    caseId: z.uuid(),
    expectedVersion: version,
    nextStage: transferStageSchema,
    reason: z.string().trim().max(500).nullable(),
  })
  .strict()
  .refine(
    (value) =>
      !['rejected', 'withdrawn'].includes(value.nextStage) ||
      (value.reason !== null && value.reason.length > 0),
    { path: ['reason'], message: 'Enter a closing reason.' },
  );
export const transferConditionSchema = z
  .object({
    text: z.string().trim().min(1).max(500),
    responsible: z.string().trim().min(1).max(120),
    follow_up_on: z.iso.date().nullable().optional(),
    done: z.boolean(),
  })
  .strict();
export const transferDecisionInputSchema = z
  .object({
    caseId: z.uuid(),
    decision: transferDecisionSchema,
    resolutionReference: z.string().trim().min(1).max(120),
    resolutionDate: z.iso.date(),
    meetingId: nullableUuid,
    conditions: z.array(transferConditionSchema).max(20),
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.decision === 'approved_with_conditions' &&
      value.conditions.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['conditions'],
        message: 'Add at least one committee condition.',
      });
    }
  });
export const clearanceTargetInputSchema = z
  .object({ moveId: nullableUuid, caseId: nullableUuid })
  .strict()
  .refine((value) => (value.moveId === null) !== (value.caseId === null), {
    message: 'Choose one move or transfer case.',
  });
export const clearanceDuesSchema = z
  .object({
    status: z.enum(['cleared', 'owed', 'not_checked']),
    bills: z.array(
      z
        .object({
          bill_id: z.uuid(),
          number: z.string(),
          title: z.string(),
          outstanding_paise: z.string().regex(/^-?\d+$/),
        })
        .strict(),
    ),
    total_paise: z
      .string()
      .regex(/^-?\d+$/)
      .nullable(),
    checked_at: timestamp.nullable(),
  })
  .strict()
  .refine(
    (value) =>
      value.status === 'not_checked'
        ? value.total_paise === null && value.checked_at === null
        : value.total_paise !== null && value.checked_at !== null,
    { message: 'Dues must include an authoritative check time and total.' },
  );
export const clearanceHandoverDraftInputSchema = clearanceTargetInputSchema
  .extend({
    responsibleTransferPartyId: nullableUuid,
    responsibleMembershipId: nullableUuid,
    responsibleRole: z.enum(['tenant', 'owner', 'seller', 'buyer']),
    adminNote: z.string().trim().max(2000).nullable(),
    clientRequestId: z.uuid(),
  })
  .superRefine((value, context) => {
    if (
      (value.responsibleTransferPartyId === null) ===
      (value.responsibleMembershipId === null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['responsibleTransferPartyId'],
        message: 'Choose one responsible party.',
      });
    }
  });
export const clearanceHandoverActionInputSchema = z
  .object({
    handoverId: z.uuid(),
    expectedVersion: version,
    approvalReference: z.string().trim().min(1).max(120).optional(),
  })
  .strict();
export const clearanceConsentInputSchema = z
  .object({ handoverId: z.uuid(), expectedVersion: version })
  .strict();
export const clearanceFileInputSchema = z
  .object({
    handoverId: z.uuid(),
    coveredTransferPartyId: nullableUuid,
    coveredMembershipId: nullableUuid,
    path: z.string().max(500),
    expectedVersion: version,
  })
  .strict()
  .refine(
    (value) =>
      (value.coveredTransferPartyId === null) !==
      (value.coveredMembershipId === null),
    { message: 'Choose the party covered by this agreement.' },
  );

export const transferPartySchema = z
  .object({
    id: z.uuid(),
    role: z.enum(['seller', 'buyer']),
    membership_id: nullableUuid,
    name: z.string().min(1).max(200),
    phone: z.string().max(30).nullable(),
    email: z.email().max(254).nullable(),
    active: z.boolean(),
  })
  .strict();
export const transferDecisionRecordSchema = z
  .object({
    id: z.uuid(),
    case_id: z.uuid(),
    decision: transferDecisionSchema,
    resolution_reference: z.string().min(1).max(120),
    resolution_date: z.iso.date(),
    meeting_id: nullableUuid,
    conditions: z.array(transferConditionSchema),
    version,
  })
  .strip();
export const clearanceHandoverSchema = z
  .object({
    id: z.uuid(),
    basis: clearanceHandoverBasisSchema,
    evidence_mode: clearanceEvidenceSchema,
    dues_snapshot: clearanceDuesSchema,
    responsible_transfer_party_id: nullableUuid,
    responsible_membership_id: nullableUuid,
    responsible_role: z.enum(['tenant', 'owner', 'seller', 'buyer']),
    admin_note: z.string().max(2000).nullable(),
    status: z.enum(['draft', 'approved', 'replaced']),
    version,
    approved_at: timestamp.nullable(),
    approved_by: z.uuid().nullable().optional(),
    approval_reference: z.string().max(120).nullable(),
  })
  .strip();
export const clearanceFileSchema = z
  .object({
    id: z.uuid(),
    handover_id: z.uuid(),
    path: z.string().max(500),
    transfer_party_id: nullableUuid.optional(),
    membership_id: nullableUuid.optional(),
  })
  .strip();
export const clearanceConsentSchema = z
  .object({
    id: z.uuid(),
    membership_id: z.uuid(),
    role: z.enum(['tenant', 'owner', 'seller', 'buyer']),
    expected_version: version,
  })
  .strip();
export const certificateSchema = z
  .object({
    id: z.uuid(),
    number: z.string(),
    kind: certificateKindSchema,
    issued_at: timestamp,
    superseded_by: nullableUuid,
    path: z.string().max(500).nullable(),
  })
  .strict();
export const transferCaseSummarySchema = z
  .object({
    id: z.uuid(),
    unit_id: z.uuid(),
    unit_number: z.string().min(1),
    stage: transferStageSchema,
    received_on: z.iso.date(),
    version,
    buyers: z.array(z.object({ id: z.uuid(), name: z.string() }).strict()),
  })
  .strict();
export const transferCasesPageSchema = z
  .object({
    items: z.array(transferCaseSummarySchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().nonnegative(),
  })
  .strict();
export const transferCaseDetailSchema = z
  .object({
    case: z
      .object({
        id: z.uuid(),
        unit_id: z.uuid(),
        stage: transferStageSchema,
        received_on: z.iso.date(),
        documents_checked_on: z.iso.date().nullable(),
        committee_decision_on: z.iso.date().nullable(),
        dues_settled_on: z.iso.date().nullable(),
        completed_on: z.iso.date().nullable(),
        rejected_on: z.iso.date().nullable(),
        withdrawn_on: z.iso.date().nullable(),
        closing_reason: z.string().max(500).nullable(),
        version,
      })
      .strip(),
    parties: z.array(transferPartySchema),
    decision: transferDecisionRecordSchema.nullable(),
    handovers: z.array(clearanceHandoverSchema),
    files: z.array(clearanceFileSchema).default([]),
    certificates: z.array(certificateSchema),
    revisions: z.array(
      z
        .object({
          id: z.uuid(),
          entity_type: z.string(),
          entity_id: z.uuid(),
          action: z.string(),
          changed_fields: z.array(z.string()),
          reason: z.string().nullable(),
          created_at: timestamp,
        })
        .strip(),
    ),
  })
  .strict();
export const clearanceHandoverPageSchema = z
  .object({
    items: z.array(clearanceHandoverSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().nonnegative(),
  })
  .strict();
export const clearanceHandoverDetailSchema = z
  .object({
    handover: clearanceHandoverSchema.extend({
      move_id: nullableUuid,
      case_id: nullableUuid,
      unit_id: z.uuid(),
    }),
    files: z.array(clearanceFileSchema),
    consents: z.array(clearanceConsentSchema),
  })
  .strict();
export const certificatesPageSchema = z
  .object({
    items: z.array(certificateSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().nonnegative(),
  })
  .strict();

export const certificatePrepareInputSchema = z
  .object({
    moveId: nullableUuid,
    caseId: nullableUuid,
    purpose: z.string().trim().min(1).max(500),
    signatoryDesignation: z.string().trim().min(1).max(200),
    clientRequestId: z.uuid(),
  })
  .strict()
  .refine((value) => (value.moveId === null) !== (value.caseId === null), {
    message: 'Choose one move or transfer case.',
  });
export const certificateIssueInputSchema = z
  .object({
    moveId: nullableUuid,
    caseId: nullableUuid,
    expectedVersion: version,
  })
  .strict()
  .refine((value) => (value.moveId === null) !== (value.caseId === null), {
    message: 'Choose one move or transfer case.',
  });
export const certificateSupersedeInputSchema = z
  .object({
    certificateId: z.uuid(),
    replacementCertificateId: z.uuid(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const clearanceAcknowledgementInputSchema = z
  .object({
    warningText: z.literal(CLEARANCE_WARNING),
    clientRequestId: z.uuid(),
  })
  .strict();
export const clearanceAcknowledgementSchema = z
  .object({
    acknowledged: z.boolean(),
    acknowledged_at: timestamp.nullable(),
  })
  .strict()
  .refine((value) => value.acknowledged === (value.acknowledged_at !== null), {
    message: 'An acknowledgement must include its recorded time.',
  });

export const clearanceUploadPathSchema = z
  .string()
  .max(500)
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/tenancy-clearance\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f-]+\.(pdf|jpg|png)$/,
  );
export const certificatePathSchema = z
  .string()
  .max(500)
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/tenancy-certificates\/[0-9a-f-]+\.pdf$/,
  );
export const transferFilePathSchema = z.union([
  clearanceUploadPathSchema,
  certificatePathSchema,
]);

export const certificatePreparationSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('prepared'),
      path: certificatePathSchema,
      issued_by: z.uuid(),
      source_version: version,
      prepared_at: timestamp,
      purpose: z.string().min(1).max(500),
      kind: certificateKindSchema,
      signatory_name: z.string().min(1).max(200),
      signatory_designation: z.string().min(1).max(200),
      handover_id: nullableUuid,
      dues: clearanceDuesSchema,
      parties: z.array(
        z
          .object({
            role: z.enum(['tenant', 'owner', 'seller', 'buyer']),
            name: z.string(),
            membership_id: nullableUuid,
          })
          .strict(),
      ),
      unit: z
        .object({
          society_id: z.uuid(),
          unit_id: z.uuid(),
          number: z.string(),
        })
        .strict(),
      expected_version: version,
      client_request_id: z.uuid(),
      artifact_hash: z.string().nullable(),
      artifact_verified_at: timestamp.nullable(),
    })
    .strict(),
  z
    .object({
      status: z.literal('issued'),
      certificate_id: z.uuid(),
    })
    .strict(),
]);

export const clearanceUploadInputSchema = z
  .object({
    handoverId: z.uuid(),
    coveredTransferPartyId: nullableUuid,
    coveredMembershipId: nullableUuid,
    contentType: z.enum(FILE_CONTENT_TYPES),
    sizeBytes: z.number().int().min(1).max(MAX_FILE_BYTES),
  })
  .strict()
  .refine(
    (value) =>
      (value.coveredTransferPartyId === null) !==
      (value.coveredMembershipId === null),
    { message: 'Choose the party covered by this agreement.' },
  );

export type TransferCaseInput = z.infer<typeof transferCaseInputSchema>;
export type TransferCaseDetail = z.infer<typeof transferCaseDetailSchema>;
export type TransferCaseSummary = z.infer<typeof transferCaseSummarySchema>;
export type TransferCasesPage = z.infer<typeof transferCasesPageSchema>;
export type TenancyCertificate = z.infer<typeof certificateSchema>;
export type ClearanceDues = z.infer<typeof clearanceDuesSchema>;
export type ClearanceHandover = z.infer<typeof clearanceHandoverSchema>;
export type ClearanceHandoverDetail = z.infer<
  typeof clearanceHandoverDetailSchema
>;
export type CertificatePreparation = z.infer<
  typeof certificatePreparationSchema
>;
