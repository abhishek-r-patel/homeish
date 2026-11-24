// Share billing settings, exact monetary input and setup contracts across boundaries.
import { z } from 'zod';

export const MAX_MONEY_PAISE = Number.MAX_SAFE_INTEGER;
export const UPI_ID_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9._-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*$/;

const days = z.number().int().min(0).max(2147483647);
export const billingSettingsSchema = z
  .object({
    due_day_of_month: z
      .union([z.number().int().min(1).max(31), z.literal('last_day')])
      .optional(),
    rounding: z.enum(['paise', 'rupee']).optional(),
    grace_days: days.optional(),
    late_fee: z
      .discriminatedUnion('type', [
        z
          .object({
            type: z.literal('flat'),
            value: z.number().int().positive().max(MAX_MONEY_PAISE),
          })
          .strict(),
        z
          .object({
            type: z.literal('percent'),
            value: z.number().positive().max(100).multipleOf(0.01),
          })
          .strict(),
      ])
      .nullable()
      .optional(),
    reminders: z
      .object({
        before_due_days: days,
        on_due: z.boolean(),
        overdue_every_days: days.min(1),
      })
      .strict()
      .optional(),
    pending_confirmation_alert_days: days.min(1).optional(),
    bill_email_on_publish: z.boolean().optional(),
  })
  .strict();

export const DEFAULT_BILLING_SETTINGS = {
  due_day_of_month: 10,
  rounding: 'rupee',
  grace_days: 5,
  late_fee: null,
  reminders: { before_due_days: 3, on_due: true, overdue_every_days: 7 },
  pending_confirmation_alert_days: 3,
  bill_email_on_publish: true,
} satisfies Required<z.infer<typeof billingSettingsSchema>>;

export const rupeesSchema = z
  .string()
  .trim()
  .max(32)
  .regex(/^\d+(?:\.\d{1,2})?$/, 'Enter rupees with at most two decimal places.')
  .transform((value, context) => {
    const [whole = '', fraction = ''] = value.split('.');
    const paise = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
    if (paise < BigInt(1) || paise > BigInt(MAX_MONEY_PAISE)) {
      context.addIssue({
        code: 'custom',
        message: 'Enter a positive amount within the supported range.',
      });
      return z.NEVER;
    }
    return Number(paise);
  });

const timestamp = z.iso.datetime({ offset: true });
const paiseText = z.string().regex(/^\d+$/);
const chargeMethodSchema = z.enum([
  'fixed',
  'per_sqft',
  'custom',
  'percent_of_charge',
]);
const eligibilitySchema = z.enum(['all', 'owner', 'tenant']);
const occupancySchema = z.enum(['owner', 'tenant', 'vacant']);
const percentSchema = rupeesSchema.refine((value) => value <= 10000, {
  message: 'Enter a percentage from 0.01 to 100.',
});
export const chargeFormSchema = z
  .object({
    id: z.uuid().nullable(),
    name: z.string().trim().min(2).max(120),
    method: chargeMethodSchema,
    amountRupees: z.string().trim().max(32),
    eligibility: eligibilitySchema.default('all'),
    percentRate: z.string().trim().max(32).default(''),
    baseChargeTypeId: z.uuid().nullable().default(null),
    active: z.boolean(),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.method === 'percent_of_charge') {
      if (!input.baseChargeTypeId || input.baseChargeTypeId === input.id) {
        context.addIssue({
          code: 'custom',
          path: ['baseChargeTypeId'],
          message: 'Choose a different base charge.',
        });
      }
      if (!percentSchema.safeParse(input.percentRate).success) {
        context.addIssue({
          code: 'custom',
          path: ['percentRate'],
          message: 'Enter a percentage from 0.01 to 100.',
        });
      }
      if (input.amountRupees) {
        context.addIssue({
          code: 'custom',
          path: ['amountRupees'],
          message: 'Percentage charges do not use a fixed amount.',
        });
      }
      return;
    }
    if (input.baseChargeTypeId || input.percentRate) {
      context.addIssue({
        code: 'custom',
        path: ['percentRate'],
        message: 'Only percentage charges use a base charge and percentage.',
      });
    }
    if (input.method === 'custom') {
      if (input.amountRupees !== '') {
        context.addIssue({
          code: 'custom',
          path: ['amountRupees'],
          message: 'Custom charges use amounts entered during bill generation.',
        });
      }
    } else {
      const amount = rupeesSchema.safeParse(input.amountRupees);
      if (!amount.success) {
        context.addIssue({
          code: 'custom',
          path: ['amountRupees'],
          message: amount.error.issues[0]?.message ?? 'Enter a valid amount.',
        });
      }
    }
  })
  .transform(({ amountRupees, percentRate, ...input }) => ({
    ...input,
    amountPaise:
      input.method === 'fixed' || input.method === 'per_sqft'
        ? rupeesSchema.parse(amountRupees)
        : null,
    percentBasisPoints:
      input.method === 'percent_of_charge'
        ? percentSchema.parse(percentRate)
        : null,
  }));

export const paymentDetailsInputSchema = z
  .object({
    upiId: z
      .string()
      .trim()
      .min(5)
      .max(100)
      .regex(UPI_ID_PATTERN, 'Enter a UPI ID in name@handle format.'),
    payeeName: z.string().trim().min(2).max(100),
    qrPath: z.string().min(1).max(500).nullable(),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict();

export const chargeTypeSchema = z.object({
  id: z.uuid(),
  society_id: z.uuid(),
  name: z.string(),
  method: chargeMethodSchema,
  amount_paise: z.number().int().positive().max(MAX_MONEY_PAISE).nullable(),
  eligibility: eligibilitySchema,
  base_charge_type_id: z.uuid().nullable(),
  percent_basis_points: z.number().int().min(1).max(10000).nullable(),
  active: z.boolean(),
  updated_at: timestamp,
});
export const paymentDetailsSchema = z.object({
  society_id: z.uuid(),
  upi_id: z.string(),
  payee_name: z.string(),
  qr_path: z.string().nullable(),
  updated_at: timestamp,
  updated_by: z.uuid(),
  updated_by_name: z.string(),
});

const moneyPaiseSchema = z.number().int().positive().max(MAX_MONEY_PAISE);

export const billingPreviewInputSchema = z
  .object({
    periodStart: z.iso.date().refine((value) => value.endsWith('-01'), {
      message: 'Choose the first day of a billing month.',
    }),
    unitIds: z.array(z.uuid()).min(1).max(1000),
    chargeTypeIds: z.array(z.uuid()).min(1).max(100),
    customAmounts: z
      .array(
        z.object({
          unitId: z.uuid(),
          chargeTypeId: z.uuid(),
          amountRupees: z.string().trim().max(32),
        }),
      )
      .max(100000),
  })
  .strict()
  .transform((input, context) => {
    const customAmounts = input.customAmounts.map((item, index) => {
      const parsed = rupeesSchema.safeParse(item.amountRupees);
      if (!parsed.success) {
        context.addIssue({
          code: 'custom',
          path: ['customAmounts', index, 'amountRupees'],
          message: parsed.error.issues[0]?.message ?? 'Enter a valid amount.',
        });
        return null;
      }
      return {
        unit_id: item.unitId,
        charge_type_id: item.chargeTypeId,
        amount_paise: parsed.data,
      };
    });
    if (new Set(input.unitIds).size !== input.unitIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['unitIds'],
        message: 'Remove duplicate units.',
      });
    }
    if (new Set(input.chargeTypeIds).size !== input.chargeTypeIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['chargeTypeIds'],
        message: 'Remove duplicate charge types.',
      });
    }
    return {
      period_start: input.periodStart,
      unit_ids: input.unitIds,
      charge_type_ids: input.chargeTypeIds,
      custom_amounts: customAmounts.filter(
        (item): item is NonNullable<typeof item> => item !== null,
      ),
    };
  });

export const billingSettingsUpdateInputSchema = z
  .object({
    dueDay: z
      .union([
        z.literal('last_day'),
        z.string().regex(/^(?:[1-9]|[12][0-9]|3[01])$/),
      ])
      .transform((value): number | 'last_day' =>
        value === 'last_day' ? 'last_day' : Number(value),
      ),
    rounding: z.enum(['rupee', 'paise']),
    billEmailOnPublish: z.boolean(),
    expectedUpdatedAt: timestamp,
  })
  .strict();

export const billingInterestRateInputSchema = z
  .object({
    mode: z.enum(['late_fee', 'interest', 'both']),
    ratePercent: z
      .string()
      .trim()
      .max(6)
      .nullable()
      .transform((value, context) => {
        if (value === null || value === '') return null;
        if (!/^(?:\d{1,2})(?:\.\d{1,2})?$/.test(value)) {
          context.addIssue({
            code: 'custom',
            message: 'Enter a yearly rate up to 24% with at most two decimals.',
          });
          return z.NEVER;
        }
        const [whole = '', fraction = ''] = value.split('.');
        const basisPoints =
          Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
        if (basisPoints <= 0 || basisPoints > 2400) {
          context.addIssue({
            code: 'custom',
            message: 'Enter a yearly rate above 0% and at most 24%.',
          });
          return z.NEVER;
        }
        return basisPoints;
      }),
    effectiveDate: z.iso.date(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.mode === 'late_fee' && value.ratePercent !== null) {
      context.addIssue({
        code: 'custom',
        path: ['ratePercent'],
        message: 'Leave the interest rate empty when late fees are used alone.',
      });
    }
    if (value.mode !== 'late_fee' && value.ratePercent === null) {
      context.addIssue({
        code: 'custom',
        path: ['ratePercent'],
        message: 'Enter the yearly interest rate.',
      });
    }
  });

export const billingInterestSettingsSchema = z
  .object({
    acknowledged_at: timestamp.nullable(),
    can_manage: z.boolean(),
    current: z
      .object({
        id: z.uuid(),
        mode: z.enum(['late_fee', 'interest', 'both']),
        rate_basis_points: z.number().int().positive().max(2400).nullable(),
        effective_on: z.iso.date(),
      })
      .nullable(),
    history: z.array(
      z
        .object({
          id: z.uuid(),
          mode: z.enum(['late_fee', 'interest', 'both']),
          rate_basis_points: z.number().int().positive().max(2400).nullable(),
          effective_on: z.iso.date(),
          created_at: timestamp,
          created_by_name: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

export const billingPreviewSchema = z.object({
  society_id: z.uuid(),
  period_start: z.iso.date(),
  due_date: z.iso.date(),
  unit_count: z.number().int().min(1).max(1000),
  line_count: z.number().int().min(0),
  new_line_count: z.number().int().min(0),
  new_total_paise: z.string().regex(/^\d+$/),
  lines: z.array(
    z.object({
      unit_id: z.uuid(),
      unit_number: z.string(),
      charge_type_id: z.uuid(),
      charge_name: z.string(),
      method: chargeMethodSchema,
      amount_paise: moneyPaiseSchema,
      already_generated: z.boolean(),
    }),
  ),
  skipped: z.array(
    z.object({
      unit_id: z.uuid(),
      unit_number: z.string(),
      charge_type_id: z.uuid(),
      charge_name: z.string(),
      reason: z.enum(['not_eligible', 'not_applicable', 'rounds_to_zero']),
    }),
  ),
  preview_hash: z.string().regex(/^[a-f0-9]{32}$/),
});

export const billingEstimateInputSchema = z
  .object({
    areaSqft: z
      .string()
      .trim()
      .regex(
        /^\d{1,6}(?:\.\d{1,2})?$/,
        'Enter an area in square feet with up to two decimals.',
      )
      .transform(Number)
      .pipe(z.number().positive()),
    occupancy: occupancySchema,
    customAmounts: z
      .array(
        z
          .object({
            chargeTypeId: z.uuid(),
            amountRupees: rupeesSchema,
          })
          .strict(),
      )
      .max(100),
    months: z.number().int().min(1).max(12).default(1),
  })
  .strict();

export const billingEstimateSchema = z.object({
  area_sqft: z.string(),
  occupancy: occupancySchema,
  lines: z.array(
    z.object({
      charge_type_id: z.uuid(),
      charge_name: z.string(),
      amount_paise: moneyPaiseSchema,
    }),
  ),
  skipped: z.array(
    z.object({
      charge_type_id: z.uuid(),
      charge_name: z.string(),
      reason: z.enum([
        'not_eligible',
        'not_applicable',
        'rounds_to_zero',
        'no_amount',
        'base_excluded',
      ]),
    }),
  ),
  total_paise: paiseText,
  months: z.number().int().min(1).max(12),
  fund_breakdown: z.array(
    z.object({
      fund_id: z.uuid().nullable(),
      fund_name: z.string().nullable(),
      monthly_paise: z.string().regex(/^\d+$/),
      preview_paise: z
        .string()
        .regex(/^\d+$/)
        .refine((value) => BigInt(value) <= BigInt(MAX_MONEY_PAISE)),
    }),
  ),
});
export type BillingEstimate = z.infer<typeof billingEstimateSchema>;

export const billingGenerationResultSchema = z.object({
  job_id: z.uuid(),
  period_start: z.iso.date(),
  due_date: z.iso.date(),
  generated_bill_count: z.number().int().nonnegative(),
  generated_line_count: z.number().int().nonnegative(),
  already_generated_count: z.number().int().nonnegative(),
  total_paise: z.string().regex(/^\d+$/),
});

export const billingBillSchema = z.object({
  id: z.uuid(),
  unit_id: z.uuid(),
  unit_number: z.string().optional(),
  kind: z.enum(['regular', 'fine', 'late_fee', 'interest', 'opening_dues']),
  title: z.string(),
  period_start: z.iso.date(),
  due_date: z.iso.date(),
  total_paise: moneyPaiseSchema,
  paid_paise: z.number().int().nonnegative().max(MAX_MONEY_PAISE),
  waived_paise: z.number().int().nonnegative().max(MAX_MONEY_PAISE),
  status: z.enum(['cancelled', 'paid', 'waived', 'partially_paid', 'due']),
  cancelled_at: timestamp.nullable(),
  outstanding_paise: z.number().int().nonnegative().max(MAX_MONEY_PAISE),
  has_lines: z.boolean().optional(),
});

export const billingBillDetailsSchema = billingBillSchema.extend({
  society_id: z.uuid(),
  related_bill_id: z.uuid().nullable(),
  cancelled_by: z.uuid().nullable(),
  cancel_reason: z.string().nullable(),
  created_at: timestamp,
  created_by: z.uuid().nullable(),
  unit_number: z.string(),
  unit_label: z.string(),
  society_name: z.string(),
  society_address: z.string(),
  status: z.enum(['cancelled', 'paid', 'waived', 'partially_paid', 'due']),
  lines: z.array(
    z.object({
      id: z.uuid(),
      charge_type_id: z.uuid().nullable(),
      description: z.string(),
      amount_paise: moneyPaiseSchema,
    }),
  ),
});

export const billingLedgerEntrySchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/),
  unit_id: z.uuid(),
  kind: z.enum(['bill', 'payment', 'waiver', 'adjustment']),
  direction: z.enum(['debit', 'credit']),
  amount_paise: moneyPaiseSchema,
  bill_id: z.uuid().nullable(),
  payment_id: z.uuid().nullable(),
  reason: z.string().nullable(),
  created_at: timestamp,
  balance_paise: z.string().regex(/^-?\d+$/),
});

export const billingPaymentSubmitInputSchema = z
  .object({
    unitId: z.uuid(),
    amountRupees: z.string().trim().max(32),
    reference: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{6,30}$/),
    paidOn: z.iso.date(),
    proofPath: z.string().max(500).nullable(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .transform((input, context) => {
    const amount = rupeesSchema.safeParse(input.amountRupees);
    if (!amount.success) {
      context.addIssue({
        code: 'custom',
        path: ['amountRupees'],
        message: amount.error.issues[0]?.message ?? 'Enter a valid amount.',
      });
      return z.NEVER;
    }
    return {
      unit_id: input.unitId,
      amount_paise: amount.data,
      reference: input.reference,
      paid_on: input.paidOn,
      proof_path: input.proofPath,
      client_request_id: input.clientRequestId,
    };
  });

export const billingPaymentRecordInputSchema = z
  .object({
    unitId: z.uuid(),
    amountRupees: z.string().trim().max(32),
    mode: z.enum(['upi', 'cash', 'cheque', 'bank_transfer']),
    reference: z.string().trim().max(30),
    paidOn: z.iso.date(),
    clientRequestId: z.uuid(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.mode === 'cash' && input.reference !== '') {
      context.addIssue({
        code: 'custom',
        path: ['reference'],
        message: 'Cash payments do not use a reference number.',
      });
    } else if (
      input.mode !== 'cash' &&
      !/^[A-Za-z0-9]{6,30}$/.test(input.reference)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['reference'],
        message: 'Enter 6 to 30 letters or numbers.',
      });
    }
    if (!rupeesSchema.safeParse(input.amountRupees).success) {
      context.addIssue({
        code: 'custom',
        path: ['amountRupees'],
        message: 'Enter a valid positive amount.',
      });
    }
  })
  .transform((input) => ({
    unit_id: input.unitId,
    amount_paise: rupeesSchema.parse(input.amountRupees),
    mode: input.mode,
    reference: input.reference ? input.reference.toUpperCase() : null,
    paid_on: input.paidOn,
    client_request_id: input.clientRequestId,
  }));

export const billingPaymentConfirmInputSchema = z
  .object({
    paymentId: z.uuid(),
    correctedAmountRupees: z.string().trim().max(32).nullable(),
  })
  .strict()
  .transform((input, context) => {
    if (
      input.correctedAmountRupees === null ||
      input.correctedAmountRupees === ''
    ) {
      return { payment_id: input.paymentId, corrected_amount_paise: null };
    }
    const amount = rupeesSchema.safeParse(input.correctedAmountRupees);
    if (!amount.success) {
      context.addIssue({
        code: 'custom',
        path: ['correctedAmountRupees'],
        message: amount.error.issues[0]?.message ?? 'Enter a valid amount.',
      });
      return z.NEVER;
    }
    return {
      payment_id: input.paymentId,
      corrected_amount_paise: amount.data,
    };
  });

export const billingPaymentRejectInputSchema = z
  .object({
    paymentId: z.uuid(),
    reason: z.string().trim().min(2).max(500),
  })
  .strict()
  .transform(({ paymentId, reason }) => ({
    payment_id: paymentId,
    reason,
  }));

export const billingPaymentSchema = z.object({
  id: z.uuid(),
  unit_id: z.uuid(),
  unit_number: z.string().optional(),
  amount_paise: moneyPaiseSchema,
  mode: z.enum(['upi', 'cash', 'cheque', 'bank_transfer']),
  source: z.enum(['resident_submitted', 'admin_recorded']),
  reference: z.string().nullable(),
  paid_on: z.iso.date(),
  status: z.enum(['awaiting_confirmation', 'confirmed', 'rejected']),
  submitted_by: z.uuid(),
  submitted_by_name: z.string().nullable().optional(),
  confirmed_by: z.uuid().nullable(),
  confirmed_at: timestamp.nullable(),
  rejected_at: timestamp.nullable(),
  reject_reason: z.string().nullable(),
  receipt_no: z.string().nullable(),
  proof_path: z.string().nullable(),
  created_at: timestamp,
  allocated_paise: z.number().int().nonnegative().optional(),
  unallocated_paise: z.string().regex(/^\d+$/).optional(),
});

export const billingPaymentDetailsSchema = billingPaymentSchema.extend({
  society_id: z.uuid(),
  client_request_id: z.uuid().optional(),
  created_by: z.uuid().optional(),
  allocations: z.array(
    z.object({
      bill_id: z.uuid(),
      amount_paise: moneyPaiseSchema,
    }),
  ),
  allocated_paise: z.number().int().nonnegative(),
  unallocated_paise: z.string().regex(/^\d+$/),
});

function optionalRupees(
  value: string,
  context: z.RefinementCtx,
  path: string,
): number | null {
  if (value === '') return null;
  const amount = rupeesSchema.safeParse(value);
  if (amount.success) return amount.data;
  context.addIssue({
    code: 'custom',
    path: [path],
    message: amount.error.issues[0]?.message ?? 'Enter a valid amount.',
  });
  return null;
}

export const billingFineInputSchema = z
  .object({
    unitId: z.uuid(),
    amountRupees: z.string().trim().max(32),
    reason: z.string().trim().min(2).max(160),
    fineDate: z.iso.date(),
  })
  .strict()
  .transform((input, context) => {
    const amount = optionalRupees(input.amountRupees, context, 'amountRupees');
    if (amount === null) {
      if (input.amountRupees === '') {
        context.addIssue({
          code: 'custom',
          path: ['amountRupees'],
          message: 'Enter the fine amount.',
        });
      }
      return z.NEVER;
    }
    return {
      unit_id: input.unitId,
      amount_paise: amount,
      reason: input.reason,
      fine_date: input.fineDate,
    };
  });

export const billingWaiveInputSchema = z
  .object({
    billId: z.uuid(),
    amountRupees: z.string().trim().max(32),
    reason: z.string().trim().min(2).max(500),
    cancel: z.boolean(),
  })
  .strict()
  .transform((input, context) => {
    if (input.cancel && input.amountRupees !== '') {
      context.addIssue({
        code: 'custom',
        path: ['amountRupees'],
        message: 'Cancelling a bill always clears the full amount.',
      });
      return z.NEVER;
    }
    const amount = optionalRupees(input.amountRupees, context, 'amountRupees');
    if (input.amountRupees !== '' && amount === null) return z.NEVER;
    return {
      bill_id: input.billId,
      amount_paise: amount,
      reason: input.reason,
      cancel: input.cancel,
    };
  });

const paymentPlanBillIdsSchema = z
  .array(z.uuid())
  .min(1)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'Remove duplicate bills.',
  });

export const billingPaymentPlanInputSchema = z
  .object({
    id: z.uuid().nullable(),
    billIds: paymentPlanBillIdsSchema,
    downPaymentRupees: z.string().trim().max(32),
    installmentCount: z
      .string()
      .regex(/^[1-9]\d{0,9}$/)
      .transform(Number)
      .pipe(z.number().int().max(2147483647)),
    firstDueDate: z.iso.date(),
    remarks: z.string().trim().max(500),
  })
  .strict()
  .transform((input, context) => {
    const downPayment = nonnegativeRupeesSchema.safeParse(
      input.downPaymentRupees,
    );
    if (!downPayment.success) {
      context.addIssue({
        code: 'custom',
        path: ['downPaymentRupees'],
        message:
          downPayment.error.issues[0]?.message ??
          'Enter a valid down-payment amount.',
      });
      return z.NEVER;
    }
    return {
      plan_id: input.id,
      bill_ids: input.billIds,
      down_payment_paise: downPayment.data,
      installment_count: input.installmentCount,
      first_due_date: input.firstDueDate,
      remarks: input.remarks || null,
    };
  });

export const billingPaymentPlanSchema = z.object({
  id: z.uuid(),
  unit_id: z.uuid(),
  unit_number: z.string(),
  plan_date: z.iso.date(),
  down_payment_paise: z.number().int().nonnegative().max(MAX_MONEY_PAISE),
  installment_count: z.number().int().positive(),
  first_due_date: z.iso.date(),
  remarks: z.string().nullable(),
  status: z.enum(['active', 'cancelled']),
  cancelled_at: timestamp.nullable(),
  cancel_reason: z.string().nullable(),
  created_at: timestamp,
  total_paise: z.number().int().positive().max(MAX_MONEY_PAISE),
  progress_paise: z.number().int().nonnegative().max(MAX_MONEY_PAISE),
  down_payment_paid_paise: z.number().int().nonnegative().max(MAX_MONEY_PAISE),
  installments_paid_paise: z.number().int().nonnegative().max(MAX_MONEY_PAISE),
  installment_paise: z.number().int().nonnegative().max(MAX_MONEY_PAISE),
  final_installment_paise: z.number().int().nonnegative().max(MAX_MONEY_PAISE),
  bills: z.array(
    z.object({
      bill_id: z.uuid(),
      title: z.string(),
      due_date: z.iso.date(),
      snapshot_remaining_paise: z
        .number()
        .int()
        .positive()
        .max(MAX_MONEY_PAISE),
    }),
  ),
});

export const billingPaymentPlanBillOptionSchema = z.object({
  id: z.uuid(),
  unit_id: z.uuid(),
  unit_number: z.string(),
  title: z.string(),
  due_date: z.iso.date(),
  outstanding_paise: z.number().int().positive().max(MAX_MONEY_PAISE),
});

export const billingPaymentPlanSaveResultSchema = z.object({
  id: z.uuid(),
});

export const billingPaymentPlanCancelInputSchema = z
  .object({
    planId: z.uuid(),
    reason: z.string().trim().min(2).max(500),
  })
  .strict()
  .transform(({ planId, reason }) => ({
    plan_id: planId,
    reason,
  }));

export const billingPaymentPlanCancelResultSchema = z.object({
  id: z.uuid(),
  status: z.literal('cancelled'),
});

export const billingRecoveryActionInputSchema = z
  .object({
    id: z.uuid().nullable(),
    unitId: z.uuid(),
    actionDate: z.iso.date(),
    actionType: z.enum([
      'phone_call',
      'in_person_discussion',
      'meeting',
      'other_internal',
    ]),
    outcome: z.enum([
      'reached',
      'no_response',
      'follow_up_needed',
      'resolved',
      'other',
    ]),
    nextActionDate: z.iso.date(),
    assignedAdminUserId: z.uuid().nullable(),
    status: z.enum(['open', 'closed']),
  })
  .strict()
  .transform((input) => ({
    action_id: input.id,
    unit_id: input.unitId,
    action_date: input.actionDate,
    action_type: input.actionType,
    outcome: input.outcome,
    next_action_date: input.nextActionDate,
    assigned_admin_user_id: input.assignedAdminUserId,
    status: input.status,
  }));

export const billingRecoveryActionSchema = z.object({
  id: z.uuid(),
  unit_id: z.uuid(),
  unit_number: z.string(),
  action_date: z.iso.date(),
  action_type: z.enum([
    'phone_call',
    'in_person_discussion',
    'meeting',
    'other_internal',
  ]),
  outcome: z.enum([
    'reached',
    'no_response',
    'follow_up_needed',
    'resolved',
    'other',
  ]),
  next_action_date: z.iso.date(),
  assigned_admin_user_id: z.uuid().nullable(),
  assigned_admin_name: z.string().nullable(),
  status: z.enum(['open', 'closed']),
  follow_up_state: z.enum(['closed', 'overdue', 'due_soon', 'scheduled']),
  created_at: timestamp,
});

export const billingRecoveryAdminSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

export const billingRecoveryActionsSchema = z.object({
  actions: z.array(billingRecoveryActionSchema),
  admins: z.array(billingRecoveryAdminSchema),
});

export const billingRecoveryActionSaveResultSchema = z.object({
  id: z.uuid(),
  status: z.enum(['open', 'closed']),
});

export const billingCollectionEfficiencyInputSchema = z
  .object({ asOfDate: z.iso.date() })
  .strict()
  .transform(({ asOfDate }) => ({ as_of_date: asOfDate }));

export const billingCollectionEfficiencySchema = z.object({
  as_of_date: z.iso.date(),
  collected_paise: paiseText,
  billed_paise: paiseText,
  collection_percent: z.number().min(0).max(100).nullable(),
});

const dateRangeSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .strict()
  .refine((range) => range.from <= range.to, {
    message: 'The start date must be on or before the end date.',
    path: ['to'],
  });

export const billingDashboardInputSchema = dateRangeSchema;

export const BILLING_REPORTS = [
  'dues_by_unit',
  'collections',
  'defaulters',
  'collections_by_mode',
  'block_totals',
  'bill_status',
  'unapplied_credit',
] as const;

const reportCount = z.number().int().nonnegative();
export const billingReportSummarySchema = z.object({
  collections_by_mode: z.array(
    z.object({
      mode: z.enum(['upi', 'cash', 'cheque', 'bank_transfer']),
      payment_count: reportCount,
      amount_paise: paiseText,
    }),
  ),
  block_totals: z.array(
    z.object({
      block_id: z.uuid().nullable(),
      block_name: z.string().nullable(),
      billed_paise: paiseText,
      collected_paise: paiseText,
      outstanding_paise: paiseText,
    }),
  ),
  status_summary: z.array(
    z.object({
      status: z.enum([
        'due',
        'partially_paid',
        'overdue',
        'paid',
        'waived',
        'cancelled',
      ]),
      bill_count: reportCount,
      total_paise: paiseText,
      outstanding_paise: paiseText,
    }),
  ),
  unapplied_credit_paise: paiseText,
  credit_as_of: z.iso.date(),
});

export const billingReportExportInputSchema = z
  .object({
    report: z.enum(BILLING_REPORTS),
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .strict()
  .refine((range) => range.from <= range.to, {
    message: 'The start date must be on or before the end date.',
    path: ['to'],
  });

export const billingDashboardSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  bill_count: z.number().int().nonnegative(),
  billed_paise: paiseText,
  collected_paise: paiseText,
  waived_paise: paiseText,
  outstanding_paise: paiseText,
  received_paise: paiseText,
  collection_percent: z.number().min(0).max(100).nullable(),
  top_defaulters: z.array(
    z.object({
      rank: z.number().int().positive(),
      unit_id: z.uuid(),
      unit_number: z.string(),
      overdue_bill_count: z.number().int().positive(),
      oldest_due_date: z.iso.date(),
      overdue_paise: paiseText,
    }),
  ),
});

export const billingReportJobSchema = z.object({
  job_id: z.uuid(),
  report: z.enum(BILLING_REPORTS),
  row_count: z.number().int().nonnegative(),
});

export const exportJobSchema = z.object({
  id: z.uuid(),
  society_id: z.uuid(),
  created_at: timestamp,
  summary: z.object({
    module: z.literal('billing'),
    report: z.enum(BILLING_REPORTS),
    from: z.iso.date(),
    to: z.iso.date(),
    row_count: z.number().int().nonnegative(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
  }),
});

export const billingReceiptSchema = z.object({
  payment_id: z.uuid(),
  receipt_no: z.string().regex(/^R-\d{4}-\d{6}$/),
  amount_paise: moneyPaiseSchema,
  mode: z.enum(['upi', 'cash', 'cheque', 'bank_transfer']),
  source: z.enum(['resident_submitted', 'admin_recorded']),
  reference: z.string().nullable(),
  paid_on: z.iso.date(),
  confirmed_at: timestamp,
  unit_id: z.uuid(),
  unit_number: z.string(),
  unit_label: z.string(),
  society_name: z.string(),
  society_address: z.string(),
  timezone: z.string(),
  payer_name: z.string().nullable(),
  confirmed_by_name: z.string().nullable(),
  allocations: z.array(
    z.object({
      bill_id: z.uuid(),
      title: z.string(),
      period_start: z.iso.date(),
      due_date: z.iso.date(),
      amount_paise: moneyPaiseSchema,
    }),
  ),
});

export type ChargeType = z.infer<typeof chargeTypeSchema>;
export type PaymentDetails = z.infer<typeof paymentDetailsSchema>;
export type BillingSettings = Required<z.infer<typeof billingSettingsSchema>>;
export type BillingInterestSettings = z.infer<
  typeof billingInterestSettingsSchema
>;
export type BillingPreviewInput = z.input<typeof billingPreviewInputSchema>;
export type BillingPreview = z.infer<typeof billingPreviewSchema>;
export type BillingBill = z.infer<typeof billingBillSchema>;
export type BillingBillDetails = z.infer<typeof billingBillDetailsSchema>;
export type BillingPayment = z.infer<typeof billingPaymentSchema>;
export type BillingLedgerEntry = z.infer<typeof billingLedgerEntrySchema>;
export type BillingDashboard = z.infer<typeof billingDashboardSchema>;
export type BillingReceipt = z.infer<typeof billingReceiptSchema>;
export type BillingReport = (typeof BILLING_REPORTS)[number];
export type ExportJob = z.infer<typeof exportJobSchema>;
export type BillingPaymentPlan = z.infer<typeof billingPaymentPlanSchema>;
export type BillingPaymentPlanBillOption = z.infer<
  typeof billingPaymentPlanBillOptionSchema
>;
export type BillingRecoveryAction = z.infer<typeof billingRecoveryActionSchema>;
export type BillingRecoveryAdmin = z.infer<typeof billingRecoveryAdminSchema>;
export type BillingCollectionEfficiency = z.infer<
  typeof billingCollectionEfficiencySchema
>;

export function calculatePerSqftPaise(
  ratePaise: number,
  areaSqft: string,
  rounding: 'paise' | 'rupee',
): number {
  if (!Number.isSafeInteger(ratePaise) || ratePaise <= 0) {
    throw new RangeError('The per-square-foot rate must be positive paise.');
  }
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(areaSqft);
  if (!match) throw new RangeError('The unit area must be valid square feet.');
  const areaCents =
    BigInt(match[1] ?? '0') * BigInt(100) +
    BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (areaCents <= BigInt(0)) {
    throw new RangeError('The unit area must be positive square feet.');
  }
  const product = BigInt(ratePaise) * areaCents;
  const paise =
    rounding === 'rupee'
      ? ((product + BigInt(5000)) / BigInt(10000)) * BigInt(100)
      : (product + BigInt(50)) / BigInt(100);
  if (paise < BigInt(1) || paise > BigInt(MAX_MONEY_PAISE)) {
    throw new RangeError(
      'The calculated charge is outside the supported paise range.',
    );
  }
  return Number(paise);
}

export const nonnegativeRupeesSchema = z.union([
  z
    .string()
    .trim()
    .max(32)
    .regex(/^0+(?:\.0{1,2})?$/)
    .transform(() => 0),
  rupeesSchema,
]);

export { rupeesFromPaise } from '../../lib/money';
