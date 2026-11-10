// Read billing data with caller permissions and redact database error details.
import 'server-only';
import { z } from 'zod';
import {
  AppError,
  CONFLICT_REASONS,
  ValidationError,
  type ConflictReason,
} from '../errors';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { authorizeRequest } from '../permissions/authorize';
import type { RequestContext } from '../tenancy/request-context';
import { paymentDetailsSchema } from './validation';

const BILLING_CONFLICT_MESSAGES: Partial<Record<ConflictReason, string>> = {
  duplicate_reference: 'This reference was already submitted.',
  not_unpaid: 'Only unpaid bills can be cancelled. Waive the balance instead.',
};

export async function billingRpc<T>(
  context: RequestContext,
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  let result: unknown;
  try {
    result = await invokeUntypedRpc<unknown>(context.db, name, args);
  } catch (error) {
    const cause = z
      .object({
        code: z.string().optional(),
        hint: z.string().nullish(),
        message: z.string().nullish(),
      })
      .safeParse(error instanceof Error ? error.cause : null);
    const code = cause.success ? cause.data.code : undefined;
    const hint = cause.success ? cause.data.hint : undefined;
    if (code === '42501') throw new AppError('FORBIDDEN');
    if (code === 'P0002') throw new AppError('NOT_FOUND');
    if (code === '23505') {
      const reason =
        CONFLICT_REASONS.find((item) => item === hint) ??
        (cause.data?.message?.includes(
          'billing_payments_active_upi_reference_key',
        )
          ? 'duplicate_reference'
          : 'invalid_state');
      throw new AppError('CONFLICT', {
        reason,
        message: BILLING_CONFLICT_MESSAGES[reason],
      });
    }
    if (code === '22023' || code === '23514' || code === '23502') {
      throw new ValidationError({
        form: 'Check the billing details and try again.',
      });
    }
    // Database details can contain payment identifiers or monetary values.
    throw new Error('The billing database operation failed.', {
      cause: { code: code ?? 'unknown' },
    });
  }
  return schema.parse(result);
}

export async function readBillingPaymentDetails(
  context: RequestContext,
  societyId: string,
) {
  authorizeRequest(context, {
    moduleKey: 'billing',
    permission: 'billing:payment_details:read',
  });
  if (context.societyId !== societyId) throw new AppError('FORBIDDEN');
  return billingRpc(
    context,
    'billing_payment_details_get',
    { p_society_id: societyId },
    paymentDetailsSchema.nullable(),
  );
}
