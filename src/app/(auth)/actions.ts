// Expose email-code auth through validated, request-scoped server actions.
'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import {
  AppError,
  ERROR_MESSAGES,
  ValidationError,
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
import { saveResidentFlatSelection } from '../../core/home/workspace-operations';

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
        ...(formData.get('joinCode')
          ? { joinCode: formData.get('joinCode') }
          : {}),
      },
      context,
    ),
  );
}

export async function verifyCodeAction(
  formData: FormData,
): Promise<AuthActionState> {
  return runAuthAction('auth.verifyCode', async (context) => {
    const purpose = formData.get('purpose');
    const joinCode = formData.get('joinCode');
    await verifyCode(
      {
        email: formData.get('email'),
        code: formData.get('code'),
        ...(purpose ? { purpose } : {}),
        ...(joinCode ? { joinCode } : {}),
      },
      context,
    );
    return {
      redirectTo:
        purpose === 'register'
          ? '/register'
          : (safeReturnPath(formData.get('returnTo')) ?? '/session'),
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

export async function switchPlaceAction(input: unknown) {
  return runAuthAction('session.switchPlace', async () => {
    const parsed = z
      .object({
        societyId: z.uuid(),
        unitId: z.uuid().nullable().optional(),
        allFlats: z.boolean().optional(),
      })
      .strict()
      .safeParse(input);
    if (!parsed.success) {
      throw new ValidationError({
        place: 'Choose a valid society or flat.',
      });
    }
    if (
      parsed.data.unitId !== undefined ||
      parsed.data.allFlats !== undefined
    ) {
      await saveResidentFlatSelection({
        societyId: parsed.data.societyId,
        unitId: parsed.data.unitId ?? null,
        allFlats: parsed.data.allFlats ?? false,
      });
    }
    await switchSociety({ societyId: parsed.data.societyId });
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
