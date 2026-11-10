// Authenticate developer accounts with a password and an authenticator factor.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId, ValidationError } from '../errors';
import { createUserSupabaseClient } from '../db/server-client';
import { enforceRateLimit } from '../rate-limit';
import type { AuthRequestContext } from './index';
import { clearLocalAuthSession } from './index';

const signInSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(256),
  })
  .strict();

const verifyMfaSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/),
  })
  .strict();

const INVALID_CREDENTIALS_MESSAGE = 'Email or password is not correct.';
const INVALID_MFA_MESSAGE = 'That authenticator code is invalid.';

export type DeveloperSignInStep =
  { step: 'verify' } | { step: 'enroll'; qrCode: string; secret: string };

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError({
      input: 'Check the developer sign-in details.',
    });
  }
  return parsed.data;
}

function requestIdFrom(context: AuthRequestContext): string {
  return createRequestId(context.requestId);
}

function ipFrom(context: AuthRequestContext): string {
  return context.ipAddress.trim() || 'unknown';
}

async function loadDeveloperAccount(
  client: Awaited<ReturnType<typeof createUserSupabaseClient>>['client'],
) {
  const { data, error } = await client.rpc('session_developer_access');
  if (error) {
    throw new Error('Could not verify developer account access.', {
      cause: error,
    });
  }
  const access = data[0];
  if (!access) {
    throw new Error('Developer account access was not returned.');
  }
  return access.is_developer_account;
}

export async function developerSignIn(
  input: unknown,
  context: AuthRequestContext,
): Promise<DeveloperSignInStep> {
  const { email, password } = parseInput(signInSchema, input);
  const requestId = requestIdFrom(context);
  await enforceRateLimit(
    'developerAuthFailures',
    `${email}:${ipFrom(context)}`,
    requestId,
  );

  const { client } = await createUserSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    if (error.status === 429) {
      throw new AppError('RATE_LIMITED', { retryAfterSeconds: 300 });
    }
    throw new AppError('UNAUTHENTICATED', {
      message: INVALID_CREDENTIALS_MESSAGE,
    });
  }
  if (!data.session || !data.user) {
    throw new Error('Developer password sign-in returned no session.');
  }

  let isDeveloperAccount: boolean;
  try {
    isDeveloperAccount = await loadDeveloperAccount(client);
  } catch (accessError) {
    await clearLocalAuthSession(client);
    throw accessError;
  }
  if (!isDeveloperAccount) {
    await clearLocalAuthSession(client);
    throw new AppError('UNAUTHENTICATED', {
      message: INVALID_CREDENTIALS_MESSAGE,
    });
  }

  const { data: factorData, error: factorError } =
    await client.auth.mfa.listFactors();
  if (factorError) {
    await clearLocalAuthSession(client);
    throw new Error('Could not load developer authenticator factors.', {
      cause: factorError,
    });
  }

  const verifiedTotp = factorData.totp[0];
  if (verifiedTotp) {
    return { step: 'verify' };
  }

  for (const factor of factorData.all) {
    if (factor.factor_type === 'totp' && factor.status === 'unverified') {
      const { error: unenrollError } = await client.auth.mfa.unenroll({
        factorId: factor.id,
      });
      if (unenrollError) {
        await clearLocalAuthSession(client);
        throw new Error(
          'Could not replace the unfinished authenticator setup.',
          {
            cause: unenrollError,
          },
        );
      }
    }
  }

  const { data: enrollment, error: enrollmentError } =
    await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Homeish developer',
      issuer: 'Homeish Developer Console',
    });
  if (enrollmentError) {
    await clearLocalAuthSession(client);
    throw new Error('Could not start developer authenticator enrollment.', {
      cause: enrollmentError,
    });
  }
  if (enrollment.type !== 'totp') {
    await clearLocalAuthSession(client);
    throw new Error(
      'The authenticator service returned an unsupported factor.',
    );
  }

  return {
    step: 'enroll',
    qrCode: `data:image/svg+xml;utf8,${encodeURIComponent(enrollment.totp.qr_code)}`,
    secret: enrollment.totp.secret,
  };
}

export async function developerVerifyMfa(
  input: unknown,
  context: AuthRequestContext,
): Promise<void> {
  const { code } = parseInput(verifyMfaSchema, input);
  const requestId = requestIdFrom(context);
  const { client } = await createUserSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) {
    if (authError.status === 401) {
      throw new AppError('SESSION_EXPIRED');
    }
    throw new AppError('INTEGRATION_FAILED');
  }
  if (!authData.user) {
    throw new AppError('UNAUTHENTICATED');
  }

  await enforceRateLimit(
    'developerAuthFailures',
    `${authData.user.id}:${ipFrom(context)}`,
    requestId,
  );
  if (!(await loadDeveloperAccount(client))) {
    await clearLocalAuthSession(client);
    throw new AppError('UNAUTHENTICATED', {
      message: INVALID_CREDENTIALS_MESSAGE,
    });
  }

  const { data: factorData, error: factorError } =
    await client.auth.mfa.listFactors();
  if (factorError) {
    throw new Error('Could not load developer authenticator factors.', {
      cause: factorError,
    });
  }
  const factor =
    factorData.totp[0] ??
    factorData.all.find(
      (candidate) =>
        candidate.factor_type === 'totp' && candidate.status === 'unverified',
    );
  if (!factor) {
    throw new AppError('MFA_REQUIRED');
  }

  const { data: challenge, error: challengeError } =
    await client.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError) {
    throw new Error('Could not start developer MFA verification.', {
      cause: challengeError,
    });
  }
  const { error: verifyError } = await client.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) {
    if (
      verifyError.code === 'mfa_verification_failed' ||
      verifyError.code === 'invalid_credentials'
    ) {
      throw new AppError('UNAUTHENTICATED', { message: INVALID_MFA_MESSAGE });
    }
    throw new Error('Could not verify the developer authenticator code.', {
      cause: verifyError,
    });
  }

  const { data: assurance, error: assuranceError } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) {
    throw new Error('Could not verify the developer assurance level.', {
      cause: assuranceError,
    });
  }
  if (assurance.currentLevel !== 'aal2') {
    throw new AppError('MFA_REQUIRED');
  }

  const { error: recordError } = await client.rpc('record_developer_mfa');
  if (recordError) {
    await clearLocalAuthSession(client);
    throw new Error('Could not record the verified developer session.', {
      cause: recordError,
    });
  }
}
