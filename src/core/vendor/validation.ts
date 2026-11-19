// Validate Vendors & Purchases settings, form input and the database read models.
import { z } from 'zod';
import { FILE_CONTENT_TYPES, MAX_FILE_BYTES } from '../files/constraints';

export const VENDOR_QUOTES_MIN = 1;
export const VENDOR_QUOTES_MAX = 5;
export const VENDOR_APPROVALS_MIN = 0;
export const VENDOR_APPROVALS_MAX = 5;
export const VENDOR_QUOTE_THRESHOLD_MAX_PAISE = 100_000_000_000;
export const VENDOR_AMOUNT_MAX_PAISE = 999_999_999_999_999;

export const DEFAULT_VENDOR_SETTINGS = {
  quote_threshold_paise: 2_500_000,
  quotes_above_threshold: 3,
  approvals_required: 1,
} as const;

export const vendorSettingsSchema = z
  .object({
    quote_threshold_paise: z
      .number()
      .int()
      .min(0)
      .max(VENDOR_QUOTE_THRESHOLD_MAX_PAISE)
      .optional(),
    quotes_above_threshold: z
      .number()
      .int()
      .min(VENDOR_QUOTES_MIN)
      .max(VENDOR_QUOTES_MAX)
      .optional(),
    approvals_required: z
      .number()
      .int()
      .min(VENDOR_APPROVALS_MIN)
      .max(VENDOR_APPROVALS_MAX)
      .optional(),
  })
  .strict();

/** Indian GSTIN: state code, PAN, entity number, a fixed Z and a check character. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const VENDOR_PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const VENDOR_PHONE_PATTERN = /^\+?[0-9][0-9 -]{4,18}[0-9]$/;
export const VENDOR_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeGstin(value: string) {
  return value.trim().replace(/\s/g, '').toUpperCase();
}

export function isValidGstin(value: string) {
  return GSTIN_PATTERN.test(normalizeGstin(value));
}

export function normalizeVendorPan(value: string) {
  return value.trim().replace(/\s/g, '').toUpperCase();
}

export function isValidVendorPan(value: string) {
  return VENDOR_PAN_PATTERN.test(normalizeVendorPan(value));
}

export const VENDOR_REQUEST_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'cancelled',
] as const;
export const VENDOR_EXPENSE_DRAFT_STATUSES = [
  'created',
  'skipped_disabled',
  'skipped_no_account',
  'skipped_no_category',
  'skipped_month_closed',
] as const;
export const VENDOR_FILE_CONTENT_TYPES = FILE_CONTENT_TYPES;
export const vendorFileContentTypeSchema = z.enum(VENDOR_FILE_CONTENT_TYPES);

const uuidPattern =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export const VENDOR_FILE_PATH_PATTERN = new RegExp(
  `^${uuidPattern}/vendors/${uuidPattern}/${uuidPattern}\\.(pdf|jpg|png)$`,
);
export const vendorFilePathSchema = z
  .string()
  .max(300)
  .regex(VENDOR_FILE_PATH_PATTERN);

const timestamp = z.iso.datetime({ offset: true });
const version = z.number().int().min(1).max(2_147_483_647);
const paise = z.number().int().min(1).max(VENDOR_AMOUNT_MAX_PAISE);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));
const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);

export const vendorSettingsInputSchema = z
  .object({
    quoteThresholdPaise: z
      .number()
      .int()
      .min(0, 'Enter a threshold of ₹0 or more.')
      .max(
        VENDOR_QUOTE_THRESHOLD_MAX_PAISE,
        'Use a threshold up to ₹100 crore.',
      ),
    quotesAboveThreshold: z
      .number()
      .int()
      .min(VENDOR_QUOTES_MIN, 'Ask for 1 to 5 quotes.')
      .max(VENDOR_QUOTES_MAX, 'Ask for 1 to 5 quotes.'),
    approvalsRequired: z
      .number()
      .int()
      .min(VENDOR_APPROVALS_MIN, 'Use 0 to 5 approvals.')
      .max(VENDOR_APPROVALS_MAX, 'Use 0 to 5 approvals.'),
  })
  .strict();

export const vendorInputSchema = z
  .object({
    vendorId: z.uuid().nullable(),
    name: requiredText(120, 'Enter the vendor name.'),
    category: requiredText(60, 'Enter a category, for example Plumbing.'),
    contactPerson: optionalText(120),
    phone: optionalText(20).refine(
      (value) => value === null || VENDOR_PHONE_PATTERN.test(value),
      'Enter a valid phone number.',
    ),
    email: optionalText(254).refine(
      (value) => value === null || VENDOR_EMAIL_PATTERN.test(value),
      'Enter a valid email address.',
    ),
    gstin: z
      .string()
      .max(20)
      .nullable()
      .transform((value) => (value ? normalizeGstin(value) || null : null))
      .refine(
        (value) => value === null || GSTIN_PATTERN.test(value),
        'Enter a 15-character GSTIN such as 27ABCDE1234F1Z5.',
      ),
    pan: z
      .string()
      .max(10)
      .nullable()
      .transform((value) => (value ? normalizeVendorPan(value) || null : null))
      .refine(
        (value) => value === null || VENDOR_PAN_PATTERN.test(value),
        'Enter a valid 10-character PAN.',
      ),
    paymentTermsDays: z.number().int().min(0).max(365).nullable(),
    onboardedDate: z
      .union([z.literal(''), z.iso.date(), z.null()])
      .transform((value) => value || null),
    notes: optionalText(1000),
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid().nullable(),
  })
  .strict()
  .refine(
    (input) => (input.vendorId === null) === (input.expectedVersion === null),
    { path: ['expectedVersion'], message: 'Refresh the vendor before saving.' },
  );

export const vendorBlacklistInputSchema = z
  .object({
    vendorId: z.uuid(),
    blacklisted: z.boolean(),
    reason: requiredText(500, 'Enter a reason for this change.'),
    expectedVersion: version,
  })
  .strict();

export const vendorActiveInputSchema = z
  .object({
    vendorId: z.uuid(),
    active: z.boolean(),
    expectedVersion: version,
  })
  .strict();

export const vendorUploadInputSchema = z
  .object({
    contentType: vendorFileContentTypeSchema,
    sizeBytes: z.number().int().min(1).max(MAX_FILE_BYTES),
  })
  .strict();

export const vendorDocumentInputSchema = z
  .object({
    vendorId: z.uuid(),
    title: requiredText(120, 'Enter a document title.'),
    path: vendorFilePathSchema,
    clientRequestId: z.uuid(),
  })
  .strict();

export const vendorDocumentArchiveInputSchema = z
  .object({ documentId: z.uuid() })
  .strict();

export const vendorFileInputSchema = z
  .object({ path: vendorFilePathSchema })
  .strict();

export const vendorRatingInputSchema = z
  .object({
    vendorId: z.uuid(),
    stars: z.number().int().min(1, 'Choose 1 to 5 stars.').max(5),
    comment: optionalText(500),
  })
  .strict();

export const vendorRequestInputSchema = z
  .object({
    purchaseRequestId: z.uuid().nullable(),
    title: requiredText(120, 'Enter what you want to buy.'),
    description: optionalText(2000),
    category: optionalText(60),
    estimatedAmountPaise: paise,
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid().nullable(),
  })
  .strict()
  .refine(
    (input) =>
      (input.purchaseRequestId === null) === (input.expectedVersion === null),
    {
      path: ['expectedVersion'],
      message: 'Refresh the request before saving.',
    },
  );

export const vendorQuoteInputSchema = z
  .object({
    purchaseRequestId: z.uuid(),
    vendorId: z.uuid('Choose a vendor.'),
    amountPaise: paise,
    note: optionalText(500),
    filePath: vendorFilePathSchema.nullable(),
    clientRequestId: z.uuid(),
  })
  .strict();

export const vendorQuoteRemoveInputSchema = z
  .object({ quoteId: z.uuid() })
  .strict();

export const vendorQuoteSelectInputSchema = z
  .object({
    purchaseRequestId: z.uuid(),
    quoteId: z.uuid(),
    expectedVersion: version,
  })
  .strict();

export const vendorQuoteOverrideInputSchema = z
  .object({
    purchaseRequestId: z.uuid(),
    reason: optionalText(500).refine(
      (value) => value === null || value.length >= 5,
      'Explain the override in at least 5 characters.',
    ),
    expectedVersion: version,
  })
  .strict();

export const vendorRequestSubmitInputSchema = z
  .object({ purchaseRequestId: z.uuid(), expectedVersion: version })
  .strict();

export const vendorRequestDecisionInputSchema = z
  .object({ purchaseRequestId: z.uuid() })
  .strict();

export const vendorRequestRejectInputSchema = z
  .object({
    purchaseRequestId: z.uuid(),
    reason: requiredText(500, 'Give a reason for rejecting.'),
  })
  .strict();

export const vendorRequestCancelInputSchema = z
  .object({ purchaseRequestId: z.uuid(), reason: optionalText(500) })
  .strict();

export const vendorQuoteRuleSchema = z
  .object({
    basis_amount_paise: paise,
    threshold_paise: z.number().int().min(0),
    quote_count: z.number().int().min(0),
    quotes_required: z
      .number()
      .int()
      .min(VENDOR_QUOTES_MIN)
      .max(VENDOR_QUOTES_MAX),
    overridden: z.boolean(),
    met: z.boolean(),
  })
  .strict();

const settingsSchema = z
  .object({
    quote_threshold_paise: z.number().int().min(0),
    quotes_above_threshold: z.number().int().min(1).max(5),
    approvals_required: z.number().int().min(0).max(5),
  })
  .strict();
const statusSchema = z.enum(VENDOR_REQUEST_STATUSES);
const ratingAverage = z.number().min(1).max(5).nullable();

export const vendorWorkspaceSchema = z
  .object({
    can_manage: z.boolean(),
    expense_enabled: z.boolean(),
    settings: settingsSchema,
    vendors: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string(),
          category: z.string(),
          contact_person: z.string().nullable(),
          phone: z.string().nullable(),
          email: z.string().nullable(),
          gstin: z.string().nullable(),
          pan: z.string().nullable(),
          payment_terms_days: z.number().int().min(0).max(365).nullable(),
          onboarded_date: z.iso.date().nullable(),
          blacklisted: z.boolean(),
          blacklist_reason: z.string().nullable(),
          active: z.boolean(),
          version,
          rating_average: ratingAverage,
          rating_count: z.number().int().min(0),
        })
        .strict(),
    ),
    requests: z.array(
      z
        .object({
          id: z.uuid(),
          title: z.string(),
          category: z.string().nullable(),
          status: statusSchema,
          estimated_amount_paise: paise,
          selected_amount_paise: paise.nullable(),
          selected_vendor_name: z.string().nullable(),
          rule: vendorQuoteRuleSchema,
          approvals: z.number().int().min(0),
          approvals_required: z.number().int().min(0).max(5),
          created_by_name: z.string().nullable(),
          mine: z.boolean(),
          created_at: timestamp,
          submitted_at: timestamp.nullable(),
          decided_at: timestamp.nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type VendorWorkspace = z.infer<typeof vendorWorkspaceSchema>;

export const vendorDetailSchema = z
  .object({
    can_manage: z.boolean(),
    vendor: z
      .object({
        id: z.uuid(),
        name: z.string(),
        category: z.string(),
        contact_person: z.string().nullable(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        gstin: z.string().nullable(),
        pan: z.string().nullable(),
        payment_terms_days: z.number().int().min(0).max(365).nullable(),
        onboarded_date: z.iso.date().nullable(),
        blacklisted: z.boolean(),
        blacklist_reason: z.string().nullable(),
        notes: z.string().nullable(),
        active: z.boolean(),
        version,
        created_at: timestamp,
      })
      .strict(),
    rating_average: ratingAverage,
    rating_count: z.number().int().min(0),
    my_rating: z
      .object({
        stars: z.number().int().min(1).max(5),
        comment: z.string().nullable(),
      })
      .strict()
      .nullable(),
    ratings: z.array(
      z
        .object({
          id: z.uuid(),
          stars: z.number().int().min(1).max(5),
          comment: z.string().nullable(),
          rater_name: z.string().nullable(),
          mine: z.boolean(),
          updated_at: timestamp,
        })
        .strict(),
    ),
    documents: z.array(
      z
        .object({
          id: z.uuid(),
          title: z.string(),
          path: vendorFilePathSchema,
          content_type: vendorFileContentTypeSchema,
          size_bytes: z.number().int().min(1),
          archived_at: timestamp.nullable(),
          created_at: timestamp,
        })
        .strict(),
    ),
    quotes: z.array(
      z
        .object({
          id: z.uuid(),
          request_id: z.uuid(),
          request_title: z.string(),
          request_status: statusSchema,
          amount_paise: paise,
          selected: z.boolean(),
          created_at: timestamp,
        })
        .strict(),
    ),
  })
  .strict();
export type VendorDetail = z.infer<typeof vendorDetailSchema>;

export const vendorRequestDetailSchema = z
  .object({
    request: z
      .object({
        id: z.uuid(),
        title: z.string(),
        description: z.string().nullable(),
        category: z.string().nullable(),
        status: statusSchema,
        estimated_amount_paise: paise,
        selected_quote_id: z.uuid().nullable(),
        version,
        created_by_name: z.string().nullable(),
        created_at: timestamp,
        submitted_at: timestamp.nullable(),
        decided_by_name: z.string().nullable(),
        decided_at: timestamp.nullable(),
        rejection_reason: z.string().nullable(),
        cancelled_by_name: z.string().nullable(),
        cancelled_at: timestamp.nullable(),
        cancel_reason: z.string().nullable(),
        quote_override_reason: z.string().nullable(),
        quote_override_by_name: z.string().nullable(),
        quote_override_at: timestamp.nullable(),
        expense_id: z.uuid().nullable(),
        expense_draft_status: z.enum(VENDOR_EXPENSE_DRAFT_STATUSES).nullable(),
        expense_status: z
          .enum(['pending_approval', 'posted', 'rejected'])
          .nullable(),
      })
      .strict(),
    rule: vendorQuoteRuleSchema,
    approvals_required: z.number().int().min(0).max(5),
    expense_enabled: z.boolean(),
    quotes: z.array(
      z
        .object({
          id: z.uuid(),
          vendor_id: z.uuid(),
          vendor_name: z.string(),
          blacklisted: z.boolean(),
          blacklist_reason: z.string().nullable(),
          amount_paise: paise,
          note: z.string().nullable(),
          file_path: vendorFilePathSchema.nullable(),
          file_content_type: vendorFileContentTypeSchema.nullable(),
          selected: z.boolean(),
          created_by_name: z.string().nullable(),
          created_at: timestamp,
        })
        .strict(),
    ),
    approvals: z.array(
      z
        .object({
          approver_name: z.string().nullable(),
          approver_role: z.enum(['admin', 'committee']),
          created_at: timestamp,
        })
        .strict(),
    ),
    vendors: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string(),
          blacklisted: z.boolean(),
          blacklist_reason: z.string().nullable(),
        })
        .strict(),
    ),
    can_edit: z.boolean(),
    can_override: z.boolean(),
    can_approve: z.boolean(),
    can_reject: z.boolean(),
    can_cancel: z.boolean(),
    can_retry_expense: z.boolean(),
    approval_blocked_reason: z.string().nullable(),
    is_requester: z.boolean(),
    approved_by_me: z.boolean(),
  })
  .strict();
export type VendorRequestDetail = z.infer<typeof vendorRequestDetailSchema>;

export const vendorApproveResultSchema = z
  .object({
    status: z.enum(['submitted', 'approved']),
    approvals: z.number().int().min(1),
    approvals_required: z.number().int().min(0).max(5),
    expense_draft_status: z.enum(VENDOR_EXPENSE_DRAFT_STATUSES).nullable(),
  })
  .strict();

export const vendorExpenseDraftStatusSchema = z.enum(
  VENDOR_EXPENSE_DRAFT_STATUSES,
);

export const vendorFileIssueSchema = z
  .object({
    path: vendorFilePathSchema,
    file_name: z.string().min(1).max(110),
    content_type: vendorFileContentTypeSchema,
  })
  .strict();

// P47 registers: contracts, agency staff-day checks, work orders, bills owed and summary.

const amountOrZero = z.number().int().min(0).max(VENDOR_AMOUNT_MAX_PAISE);
const dateOnly = z.iso.date('Enter a valid date.');
const optionalDate = z
  .union([z.literal(''), z.iso.date('Enter a valid date.'), z.null()])
  .transform((value) => value || null);

export const VENDOR_PAYMENT_FREQUENCIES = [
  'monthly',
  'quarterly',
  'half_yearly',
  'yearly',
  'one_time',
] as const;
export const VENDOR_CONTRACT_STATUSES = [
  'terminated',
  'upcoming',
  'expired',
  'urgent',
  'due_soon',
  'active',
] as const;
export const VENDOR_WORK_ORDER_STATUSES = [
  'issued',
  'in_progress',
  'completed',
  'cancelled',
] as const;

const contractTerms = {
  scope: requiredText(500, 'Describe what the contract covers.'),
  startDate: dateOnly,
  endDate: dateOnly,
  annualValuePaise: amountOrZero,
  paymentFrequency: z.enum(
    VENDOR_PAYMENT_FREQUENCIES,
    'Choose a payment frequency.',
  ),
  autoRenew: z.boolean(),
  noticeDays: z
    .number()
    .int()
    .min(0, 'Use a notice period of 0 to 365 days.')
    .max(365, 'Use a notice period of 0 to 365 days.')
    .nullable(),
  documentPath: vendorFilePathSchema.nullable(),
  defaultSanctionedDays: z
    .number()
    .int()
    .min(1, 'Use 1 to 31 sanctioned days.')
    .max(31, 'Use 1 to 31 sanctioned days.')
    .nullable(),
  deductionPerDayPaise: paise.nullable(),
};

function checkContractPeriod(
  value: { startDate: string; endDate: string },
  context: z.RefinementCtx,
) {
  if (value.endDate < value.startDate) {
    context.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'The end date must not precede the start date.',
    });
  }
}

export const vendorContractInputSchema = z
  .object({
    contractId: z.uuid().nullable(),
    vendorId: z.uuid('Choose a vendor.').nullable(),
    ...contractTerms,
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    checkContractPeriod(value, context);
    if ((value.contractId === null) !== (value.expectedVersion === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedVersion'],
        message: 'Refresh the contract before saving.',
      });
    }
    if (value.contractId === null && value.vendorId === null) {
      context.addIssue({
        code: 'custom',
        path: ['vendorId'],
        message: 'Choose a vendor.',
      });
    }
    if (value.contractId === null && value.clientRequestId === null) {
      context.addIssue({
        code: 'custom',
        path: ['clientRequestId'],
        message: 'Refresh the page and retry.',
      });
    }
  });

export const vendorContractRenewInputSchema = z
  .object({
    predecessorId: z.uuid(),
    ...contractTerms,
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine(checkContractPeriod);

export const vendorContractTerminateInputSchema = z
  .object({
    contractId: z.uuid(),
    terminatedOn: dateOnly,
    reason: requiredText(500, 'Enter a reason for ending the contract early.'),
    expectedVersion: version,
  })
  .strict();

export const vendorStaffDayCheckInputSchema = z
  .object({
    checkId: z.uuid().nullable(),
    contractId: z.uuid('Choose a contract.'),
    month: dateOnly,
    sanctionedDays: z
      .number()
      .int()
      .min(1, 'Use 1 to 31 sanctioned days.')
      .max(31, 'Use 1 to 31 sanctioned days.')
      .nullable(),
    actualDays: z
      .number()
      .int('Use 0 to 31 actual days.')
      .min(0, 'Use 0 to 31 actual days.')
      .max(31, 'Use 0 to 31 actual days.'),
    contractedAmountPaise: amountOrZero,
    ratePaise: paise.nullable(),
    manualDeductionPaise: paise.nullable(),
    manualDeductionReason: optionalText(500),
    billRaisedPaise: amountOrZero.nullable(),
    editReason: optionalText(500),
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.ratePaise !== null && value.manualDeductionPaise !== null) {
      context.addIssue({
        code: 'custom',
        path: ['manualDeductionPaise'],
        message: 'Use either a per-day rate or a manual deduction.',
      });
    }
    if (
      value.manualDeductionPaise !== null &&
      value.manualDeductionReason === null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['manualDeductionReason'],
        message: 'Enter a reason for the manual deduction.',
      });
    }
    if (
      value.manualDeductionPaise === null &&
      value.manualDeductionReason !== null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['manualDeductionPaise'],
        message: 'Enter the manual deduction amount for this reason.',
      });
    }
    if (value.checkId === null) {
      if (value.clientRequestId === null || value.expectedVersion !== null) {
        context.addIssue({
          code: 'custom',
          path: ['clientRequestId'],
          message: 'Refresh the page and retry.',
        });
      }
    } else {
      if (value.expectedVersion === null) {
        context.addIssue({
          code: 'custom',
          path: ['expectedVersion'],
          message: 'Refresh the check before saving.',
        });
      }
      if (value.editReason === null) {
        context.addIssue({
          code: 'custom',
          path: ['editReason'],
          message: 'Enter a reason for editing this check.',
        });
      }
    }
  });

export const vendorWorkOrderCreateInputSchema = z
  .object({
    purchaseRequestId: z.uuid('Choose an approved purchase request.'),
    description: optionalText(2000),
    valuePaise: paise.nullable(),
    issuedOn: optionalDate,
    dueOn: optionalDate,
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.issuedOn && value.dueOn && value.dueOn < value.issuedOn) {
      context.addIssue({
        code: 'custom',
        path: ['dueOn'],
        message: 'The due date must be on or after the issue date.',
      });
    }
  });

export const vendorWorkOrderUpdateInputSchema = z
  .object({
    workOrderId: z.uuid(),
    description: requiredText(2000, 'Describe the work.'),
    dueOn: optionalDate,
    expectedVersion: version,
  })
  .strict();

export const vendorWorkOrderStatusInputSchema = z
  .object({
    workOrderId: z.uuid(),
    status: z.enum(['in_progress', 'completed', 'cancelled']),
    completedOn: optionalDate,
    reason: optionalText(500),
    expectedVersion: version,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'completed' && value.completedOn === null) {
      context.addIssue({
        code: 'custom',
        path: ['completedOn'],
        message: 'Enter the completion date.',
      });
    }
    if (value.status === 'cancelled' && value.reason === null) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Enter a reason for cancelling.',
      });
    }
  });

export const vendorBillInputSchema = z
  .object({
    billId: z.uuid().nullable(),
    vendorId: z.uuid('Choose a vendor.'),
    invoiceNumber: requiredText(60, 'Enter the invoice number.'),
    invoiceDate: dateOnly,
    amountPaise: paise,
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.billId === null) !== (value.expectedVersion === null)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedVersion'],
        message: 'Refresh the bill before saving.',
      });
    }
    if (value.billId === null && value.clientRequestId === null) {
      context.addIssue({
        code: 'custom',
        path: ['clientRequestId'],
        message: 'Refresh the page and retry.',
      });
    }
  });

export const vendorBillCancelInputSchema = z
  .object({
    billId: z.uuid(),
    reason: requiredText(500, 'Enter a reason for cancelling the bill.'),
    expectedVersion: version,
  })
  .strict();

export const vendorBillPaymentLinkInputSchema = z
  .object({
    billId: z.uuid(),
    entryId: z.uuid('Choose a cash-book entry.'),
    amountPaise: paise,
    clientRequestId: z.uuid(),
  })
  .strict();

export const vendorBillPaymentUnlinkInputSchema = z
  .object({
    paymentId: z.uuid(),
    reason: requiredText(500, 'Enter a reason for unlinking.'),
  })
  .strict();

const vendorContractRowSchema = z.object({
  id: z.uuid(),
  vendor_id: z.uuid(),
  vendor_name: z.string(),
  scope: z.string(),
  start_date: z.iso.date(),
  end_date: z.iso.date(),
  annual_value_paise: amountOrZero,
  payment_frequency: z.enum(VENDOR_PAYMENT_FREQUENCIES),
  auto_renew: z.boolean(),
  notice_days: z.number().int().min(0).max(365).nullable(),
  notice_deadline: z.iso.date(),
  document_path: vendorFilePathSchema.nullable(),
  document_content_type: vendorFileContentTypeSchema.nullable(),
  document_size_bytes: z.number().int().min(1).nullable(),
  default_sanctioned_days: z.number().int().min(1).max(31).nullable(),
  deduction_per_day_paise: paise.nullable(),
  predecessor_id: z.uuid().nullable(),
  successor_id: z.uuid().nullable(),
  terminated_on: z.iso.date().nullable(),
  termination_reason: z.string().nullable(),
  terminated_by_name: z.string().nullable(),
  terminated_at: timestamp.nullable(),
  status: z.enum(VENDOR_CONTRACT_STATUSES),
  version,
  created_at: timestamp,
  created_by_name: z.string().nullable(),
  updated_at: timestamp,
  updated_by_name: z.string().nullable(),
});

export const vendorContractsSchema = z.object({
  today: z.iso.date(),
  can_manage: z.boolean(),
  settings: z.object({
    due_soon_days: z.number().int().min(1),
    urgent_days: z.number().int().min(1),
  }),
  contracts: z.array(vendorContractRowSchema),
  amc_contracts: z.array(
    z.object({
      id: z.uuid(),
      asset_label: z.string(),
      vendor_name: z.string(),
      start_date: z.iso.date(),
      end_date: z.iso.date(),
      status: z.enum(VENDOR_CONTRACT_STATUSES),
      successor_id: z.uuid().nullable(),
    }),
  ),
});
export type VendorContracts = z.infer<typeof vendorContractsSchema>;
export type VendorContract = VendorContracts['contracts'][number];

export const vendorStaffDayChecksSchema = z.object({
  can_manage: z.boolean(),
  checks: z.array(
    z.object({
      id: z.uuid(),
      contract_id: z.uuid(),
      contract_scope: z.string(),
      vendor_id: z.uuid(),
      vendor_name: z.string(),
      month: z.iso.date(),
      sanctioned_days: z.number().int().min(1).max(31),
      actual_days: z.number().int().min(0).max(31),
      contracted_amount_paise: amountOrZero,
      rate_paise: paise.nullable(),
      manual_deduction_paise: paise.nullable(),
      manual_deduction_reason: z.string().nullable(),
      bill_raised_paise: amountOrZero.nullable(),
      shortfall_days: z.number().int().min(0),
      deduction_paise: amountOrZero,
      payable_paise: amountOrZero,
      variance_paise: z.number().int().nullable(),
      flagged: z.boolean(),
      version,
      created_at: timestamp,
      updated_at: timestamp,
      updated_by_name: z.string().nullable(),
    }),
  ),
});
export type VendorStaffDayChecks = z.infer<typeof vendorStaffDayChecksSchema>;
export type VendorStaffDayCheck = VendorStaffDayChecks['checks'][number];

export const vendorWorkOrdersSchema = z.object({
  today: z.iso.date(),
  can_manage: z.boolean(),
  work_orders: z.array(
    z.object({
      id: z.uuid(),
      number: z.string(),
      purchase_request_id: z.uuid(),
      request_title: z.string(),
      vendor_id: z.uuid(),
      vendor_name: z.string(),
      description: z.string(),
      value_paise: paise,
      issued_on: z.iso.date(),
      due_on: z.iso.date().nullable(),
      completed_on: z.iso.date().nullable(),
      status: z.enum(VENDOR_WORK_ORDER_STATUSES),
      cancel_reason: z.string().nullable(),
      cancelled_at: timestamp.nullable(),
      cancelled_by_name: z.string().nullable(),
      days_open: z.number().int().min(0).nullable(),
      delay_days: z.number().int().min(0).nullable(),
      version,
      created_at: timestamp,
      created_by_name: z.string().nullable(),
      updated_at: timestamp,
    }),
  ),
  approved_requests: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      vendor_id: z.uuid(),
      vendor_name: z.string(),
      amount_paise: paise,
    }),
  ),
});
export type VendorWorkOrders = z.infer<typeof vendorWorkOrdersSchema>;
export type VendorWorkOrder = VendorWorkOrders['work_orders'][number];

export const vendorBillsSchema = z.object({
  today: z.iso.date(),
  can_manage: z.boolean(),
  bills: z.array(
    z.object({
      id: z.uuid(),
      vendor_id: z.uuid(),
      vendor_name: z.string(),
      invoice_number: z.string(),
      invoice_date: z.iso.date(),
      amount_paise: paise,
      effective_terms_days: z.number().int().min(0).max(365),
      due_date: z.iso.date(),
      paid_paise: amountOrZero,
      outstanding_paise: z.number().int(),
      payment_status: z.enum(['pending', 'partly_paid', 'paid']),
      due_state: z.enum(['overdue', 'due_soon']).nullable(),
      cancelled_at: timestamp.nullable(),
      cancel_reason: z.string().nullable(),
      cancelled_by_name: z.string().nullable(),
      version,
      created_at: timestamp,
      created_by_name: z.string().nullable(),
      updated_at: timestamp,
      payments: z.array(
        z.object({
          id: z.uuid(),
          entry_id: z.uuid(),
          amount_paise: paise,
          counting: z.boolean(),
          unlinked_at: timestamp.nullable(),
          unlink_reason: z.string().nullable(),
          unlinked_by_name: z.string().nullable(),
          entry_date: z.iso.date(),
          payee: z.string().nullable(),
          reference: z.string().nullable(),
          entry_amount_paise: paise,
          created_at: timestamp,
        }),
      ),
    }),
  ),
  linkable_entries: z.array(
    z.object({
      id: z.uuid(),
      entry_date: z.iso.date(),
      amount_paise: paise,
      unlinked_paise: paise,
      payee: z.string().nullable(),
      reference: z.string().nullable(),
      description: z.string().nullable(),
    }),
  ),
});
export type VendorBills = z.infer<typeof vendorBillsSchema>;
export type VendorBill = VendorBills['bills'][number];

export const vendorSummarySchema = z.object({
  vendor_id: z.uuid().nullable(),
  active_vendors: z.number().int().min(0).nullable(),
  active_contract_value_paise: z.number().int().min(0),
  renewals_due: z.number().int().min(0),
  renewals_due_general: z.number().int().min(0),
  renewals_due_amc: z.number().int().min(0),
  rating_average: ratingAverage,
  rating_count: z.number().int().min(0),
  open_work_orders: z.number().int().min(0),
  overdue_amc_services: z.number().int().min(0),
  bills_owed_paise: z.number().int().min(0),
  bills_owed_count: z.number().int().min(0),
});
export type VendorSummary = z.infer<typeof vendorSummarySchema>;
