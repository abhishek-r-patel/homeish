// Handle email-code authentication without exposing privileged credentials.
import 'server-only';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { AppError, createRequestId, ValidationError } from '../errors';
import {
  ACTIVE_SOCIETY_COOKIE,
  createUserSupabaseClient,
} from '../db/server-client';
import { logUnexpectedError } from '../logging/error-logger';
import { enforceRateLimit, hashRateLimitIdentifier } from '../rate-limit';
import {
  ensureAuthUserForSignIn,
  finishAuthCodeAttempt,
  hasSignInAccess,
  isRegistrationCodeActive,
  reserveAuthCodeAttempt,
  startAuthCodeChallenge,
} from '../privileged';
export { safeReturnPath } from './return-path';

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const requestCodeSchema = z
  .object({
    email: emailSchema,
    purpose: z.enum(['signin', 'register']),
    joinCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-HJ-NP-Z2-9]{8}$/)
      .optional(),
  })
  .strict()
  .superRefine(({ purpose, joinCode }, context) => {
    if (purpose === 'register' && !joinCode) {
      context.addIssue({
        code: 'custom',
        message: 'Enter the society code to register.',
        path: ['joinCode'],
      });
    }
    if (purpose === 'signin' && joinCode) {
      context.addIssue({
        code: 'custom',
        message: 'A society code is only used for registration.',
        path: ['joinCode'],
      });
    }
  });

export const verifyCodeSchema = z
  .object({
    email: emailSchema,
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/),
    purpose: z.enum(['signin', 'register']).default('signin'),
    joinCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-HJ-NP-Z2-9]{8}$/)
      .optional(),
  })
  .strict()
  .superRefine(({ purpose, joinCode }, context) => {
    if (purpose === 'register' && !joinCode) {
      context.addIssue({
        code: 'custom',
        message: 'Enter the society code to register.',
        path: ['joinCode'],
      });
    }
    if (purpose === 'signin' && joinCode) {
      context.addIssue({
        code: 'custom',
        message: 'A society code is only used for registration.',
        path: ['joinCode'],
      });
    }
  });

export interface AuthRequestContext {
  requestId: string;
  ipAddress: string;
}

const REQUEST_CODE_MESSAGE =
  'If this email is registered, a code has been sent.';
const INVALID_CODE_MESSAGE =
  'That code is invalid or expired. Request a new code and try again.';

function parseRequest<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError({ input: 'Check the sign-in details.' });
  }
  return result.data;
}

function requestIdFrom(context: AuthRequestContext): string {
  return createRequestId(context.requestId);
}

function ipFrom(context: AuthRequestContext): string {
  return context.ipAddress.trim() || 'unknown';
}

export async function requestCode(
  input: unknown,
  context: AuthRequestContext,
): Promise<{ message: string }> {
  const { email, purpose, joinCode } = parseRequest(requestCodeSchema, input);
  const requestId = requestIdFrom(context);

  await Promise.all([
    enforceRateLimit(
      'authRequestCodeEmailCooldown',
      `${email}:${purpose}`,
      requestId,
    ),
    enforceRateLimit(
      'authRequestCodeEmailHourly',
      `${email}:${purpose}`,
      requestId,
    ),
    enforceRateLimit('authRequestCodeIpHourly', ipFrom(context), requestId),
  ]);

  if (
    (purpose === 'signin' && !(await hasSignInAccess(email))) ||
    (purpose === 'register' &&
      (!joinCode || !(await isRegistrationCodeActive(joinCode))))
  ) {
    return { message: REQUEST_CODE_MESSAGE };
  }

  try {
    await ensureAuthUserForSignIn(email);
    const emailKey = await hashRateLimitIdentifier(
      purpose === 'register'
        ? 'auth:registration:challenge:email'
        : 'auth:challenge:email',
      email,
    );
    await startAuthCodeChallenge(emailKey);

    const { client } = await createUserSupabaseClient();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      throw new Error('Could not send the sign-in code.', { cause: error });
    }
  } catch (error) {
    await logUnexpectedError(error, {
      requestId,
      route: 'auth.requestCode',
      source: 'server',
    });
  }

  return { message: REQUEST_CODE_MESSAGE };
}

export async function clearLocalAuthSession(
  client: Awaited<ReturnType<typeof createUserSupabaseClient>>['client'],
): Promise<void> {
  const { error } = await client.auth.signOut({ scope: 'local' });
  (await cookies()).delete(ACTIVE_SOCIETY_COOKIE);
  if (error) {
    throw new Error('Could not clear the sign-in session.', {
      cause: error,
    });
  }
}

export async function verifyCode(
  input: unknown,
  context: AuthRequestContext,
): Promise<void> {
  const { email, code, purpose, joinCode } = parseRequest(
    verifyCodeSchema,
    input,
  );
  const requestId = requestIdFrom(context);

  await Promise.all([
    enforceRateLimit('authVerifyCodeEmailHourly', email, requestId),
    enforceRateLimit('authVerifyCodeIpHourly', ipFrom(context), requestId),
  ]);

  const emailKey = await hashRateLimitIdentifier(
    purpose === 'register'
      ? 'auth:registration:challenge:email'
      : 'auth:challenge:email',
    email,
  );
  const { client } = await createUserSupabaseClient();
  const reservation = await reserveAuthCodeAttempt(emailKey);
  if (reservation.status === 'locked') {
    throw new AppError('RATE_LIMITED', {
      retryAfterSeconds: Math.max(1, reservation.retryAfterSeconds),
    });
  }
  if (reservation.status !== 'reserved' || !reservation.challengeId) {
    throw new AppError('UNAUTHENTICATED', { message: INVALID_CODE_MESSAGE });
  }
  const challengeId = reservation.challengeId;
  let reservationFinished = false;
  let sessionEstablished = false;
  let sessionCleared = false;
  const finish = async (result: {
    failed: boolean;
    succeeded: boolean;
  }): Promise<boolean> => {
    reservationFinished = true;
    return finishAuthCodeAttempt(challengeId, result);
  };
  const clearSession = async (): Promise<void> => {
    if (!sessionEstablished || sessionCleared) {
      return;
    }
    await clearLocalAuthSession(client);
    sessionCleared = true;
  };

  try {
    const { data, error } = await client.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    if (error) {
      const invalidCode =
        error.code === 'invalid_credentials' || error.code === 'otp_expired';
      const providerRateLimited =
        error.code === 'over_request_rate_limit' ||
        error.code === 'over_email_send_rate_limit';
      await finish({ failed: invalidCode, succeeded: false });
      if (invalidCode) {
        throw new AppError('UNAUTHENTICATED', {
          message: INVALID_CODE_MESSAGE,
        });
      }
      if (error.status === 429 || providerRateLimited) {
        throw new AppError('RATE_LIMITED', { retryAfterSeconds: 300 });
      }
      throw new Error('Could not verify the sign-in code.', { cause: error });
    }

    if (!data.session || !data.user) {
      await finish({ failed: false, succeeded: false });
      throw new Error('Sign-in verification returned no session.');
    }
    sessionEstablished = true;

    const stillEligible =
      purpose === 'register'
        ? Boolean(joinCode && (await isRegistrationCodeActive(joinCode)))
        : await hasSignInAccess(email);
    const challengeConsumed = await finish({
      failed: false,
      succeeded: true,
    });
    if (!stillEligible || !challengeConsumed) {
      await clearSession();
      throw new AppError('UNAUTHENTICATED', { message: INVALID_CODE_MESSAGE });
    }

    const { error: claimError } = await client.rpc('claim_memberships');
    if (claimError) {
      await clearSession();
      throw new Error('Could not claim the invited memberships.', {
        cause: claimError,
      });
    }
  } catch (error) {
    await clearSession();
    if (!reservationFinished) {
      await finish({ failed: false, succeeded: false });
    }
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const { client } = await createUserSupabaseClient();
  await clearLocalAuthSession(client);
}
