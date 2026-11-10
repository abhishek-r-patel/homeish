// Expose email-code auth through validated, request-scoped server actions.
'use server';

import { headers } from 'next/headers';
import {
  AppError,
  ERROR_MESSAGES,
  requestIdFromHeaders,
  type ErrorCode,
} from '../../core/errors';
import {
  requestCode,
  safeReturnPath,
  signOut,
  verifyCode,
  type AuthRequestContext,
} from '../../core/auth';
import {
  developerSignIn,
  developerVerifyMfa,
  type DeveloperSignInStep,
} from '../../core/auth/developer';
import { logUnexpectedError } from '../../core/logging/error-logger';
import { clientIpFromHeaders } from '../../core/request/client-ip';
import { switchSociety } from '../../core/tenancy/session';

export type AuthActionState =
  | {
      ok: true;
      message?: string;
      redirectTo?: string;
      developer?: DeveloperSignInStep;
    }
  | {
      ok: false;
      code: ErrorCode;
      message: string;
      referenceId?: string;
      retryAfterSeconds?: number;
      fieldErrors?: Readonly<Record<string, string>>;
    };

async function runAuthAction(
  route: string,
  operation: (context: AuthRequestContext) => Promise<void | {
    message?: string;
    redirectTo?: string;
    developer?: DeveloperSignInStep;
  }>,
): Promise<AuthActionState> {
  let requestId = crypto.randomUUID();
  try {
    const requestHeaders = await headers();
    requestId = requestIdFromHeaders(requestHeaders);
    const result = await operation({
      requestId,
      ipAddress: clientIpFromHeaders(requestHeaders),
    });
    return { ok: true, ...(result ?? {}) };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        ...(error.referenceId ? { referenceId: error.referenceId } : {}),
        ...(error.retryAfterSeconds
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      };
    }

    const referenceId = await logUnexpectedError(error, {
      requestId,
      route,
      source: 'server',
    });
    return {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: ERROR_MESSAGES.INTERNAL_ERROR,
      referenceId,
    };
  }
}

export async function requestCodeAction(
  formData: FormData,
): Promise<AuthActionState> {
  return runAuthAction('auth.requestCode', (context) =>
    requestCode(
      {
        email: formData.get('email'),
        purpose: formData.get('purpose'),
      },
      context,
    ),
  );
}

export async function verifyCodeAction(
  formData: FormData,
): Promise<AuthActionState> {
  return runAuthAction('auth.verifyCode', async (context) => {
    await verifyCode(
      {
        email: formData.get('email'),
        code: formData.get('code'),
      },
      context,
    );
    return {
      redirectTo: safeReturnPath(formData.get('returnTo')) ?? '/session',
    };
  });
}

export async function signOutAction(): Promise<AuthActionState> {
  return runAuthAction('auth.signOut', async () => signOut());
}

export async function switchSocietyAction(
  societyId: string,
): Promise<AuthActionState> {
  return runAuthAction('session.switchSociety', async () => {
    await switchSociety({ societyId });
    return { message: 'Society changed.' };
  });
}

export async function developerSignInAction(
  formData: FormData,
): Promise<AuthActionState> {
  return runAuthAction('auth.developerSignIn', async (context) => ({
    developer: await developerSignIn(
      {
        email: formData.get('email'),
        password: formData.get('password'),
      },
      context,
    ),
  }));
}

export async function developerVerifyMfaAction(
  formData: FormData,
): Promise<AuthActionState> {
  return runAuthAction('auth.developerVerifyMfa', async (context) => {
    await developerVerifyMfa({ code: formData.get('code') }, context);
    return { redirectTo: '/developer' };
  });
}
