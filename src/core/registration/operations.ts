// Resolve and submit registrations without exposing a society directory.
import 'server-only';
import { z } from 'zod';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { AppError, createRequestId, ValidationError } from '../errors';
import { lookupRegistrationSociety } from '../privileged';
import { sendNotificationPushesForRequest } from '../privileged/notification-delivery';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';

const joinCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{8}$/);

const lookupSchema = z.object({
  societyName: z.string().min(2).max(120),
  units: z.array(
    z.object({
      id: z.uuid(),
      number: z.string().min(1).max(20),
      blockName: z.string().max(60).nullable(),
    }),
  ),
});

const submitSchema = z
  .object({
    joinCode: joinCodeSchema,
    unitId: z.uuid(),
    fullName: z.string().trim().min(1).max(120),
    relationship: z.enum(['owner', 'tenant', 'family']),
  })
  .strict();

export type RegistrationSociety = z.infer<typeof lookupSchema>;

function rpcCode(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    typeof error.cause === 'object' &&
    error.cause !== null &&
    'code' in error.cause &&
    typeof error.cause.code === 'string'
  ) {
    return error.cause.code;
  }
  return undefined;
}

export async function lookupSociety(
  input: unknown,
  ipAddress: string,
  requestId = createRequestId(),
): Promise<RegistrationSociety | null> {
  await Promise.all([
    enforceRateLimit('registrationLookupIpHourly', ipAddress, requestId),
    enforceRateLimit('registrationLookupIpDaily', ipAddress, requestId),
  ]);
  const parsedCode = joinCodeSchema.safeParse(input);
  if (!parsedCode.success) return null;

  const result = await lookupRegistrationSociety(parsedCode.data);
  if (result === null) return null;
  const parsedResult = lookupSchema.safeParse(result);
  if (!parsedResult.success) {
    throw new Error(
      'The society registration lookup returned an invalid result.',
    );
  }
  return parsedResult.data;
}

export async function submitRegistration(
  input: unknown,
  requestId: string,
): Promise<string> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      Object.fromEntries(
        parsed.error.issues.map((issue) => [
          String(issue.path[0] ?? 'form'),
          issue.message,
        ]),
      ),
    );
  }

  const context = await buildRequestContext(createRequestId());
  await enforceRateLimit(
    'registrationSubmitEmailDaily',
    context.userId,
    requestId,
  );
  let membershipId: string;
  try {
    membershipId = await invokeUntypedRpc<string>(
      context.db,
      'submit_society_registration',
      {
        p_join_code: parsed.data.joinCode,
        p_unit_id: parsed.data.unitId,
        p_full_name: parsed.data.fullName,
        p_relationship: parsed.data.relationship,
        p_request_id: requestId,
      },
    );
  } catch (error) {
    const code = rpcCode(error);
    if (code === '42501') throw new AppError('FORBIDDEN');
    if (code === 'P0002') {
      throw new AppError('NOT_FOUND', {
        message: 'This society code is no longer available. Look it up again.',
      });
    }
    if (code === '23505' || code === '23503') {
      throw new AppError('CONFLICT', {
        reason: 'invalid_state',
        message:
          'This account already has access or the selected unit is unavailable.',
      });
    }
    if (code === '22023') {
      throw new ValidationError({ form: 'Check the registration details.' });
    }
    throw new Error('Could not submit the society registration.', {
      cause: error,
    });
  }
  await sendNotificationPushesForRequest(requestId);
  return membershipId;
}
