// Bind a shared-account guard identity to the current verified auth session.
import 'server-only';
import { cookies } from 'next/headers';
import { AppError } from '../errors';
import { serverEnvironment } from '../config/server-env';
import type { RequestContext } from '../tenancy/request-context';
import {
  createGuardDutyToken,
  UUID_PATTERN,
  verifyGuardDutyToken,
} from './token';

const COOKIE_NAME = 'homeish-guard-duty';
const MAX_AGE_SECONDS = 12 * 60 * 60;
async function currentSessionId(context: RequestContext): Promise<string> {
  const { data, error } = await context.db.auth.getSession();
  if (error || !data.session || data.session.user.id !== context.userId) {
    throw new AppError('UNAUTHENTICATED');
  }
  const encodedPayload = data.session.access_token.split('.')[1];
  if (!encodedPayload) {
    throw new AppError('UNAUTHENTICATED');
  }
  let claims: unknown;
  try {
    claims = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    );
  } catch {
    throw new AppError('UNAUTHENTICATED');
  }
  if (
    typeof claims !== 'object' ||
    claims === null ||
    !('session_id' in claims) ||
    typeof claims.session_id !== 'string' ||
    !UUID_PATTERN.test(claims.session_id)
  ) {
    throw new AppError('UNAUTHENTICATED');
  }
  return claims.session_id;
}

export async function setGuardDutyCookie(
  context: RequestContext,
  guardId: string,
): Promise<void> {
  if (!context.societyId) {
    throw new AppError('FORBIDDEN');
  }
  const token = createGuardDutyToken(
    {
      expiresAt: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
      guardId,
      sessionId: await currentSessionId(context),
      societyId: context.societyId,
    },
    serverEnvironment.server.GUARD_SESSION_SECRET,
  );
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NEXT_PUBLIC_APP_ENV !== 'local',
  });
}

export async function readGuardDutyCookie(
  context: RequestContext,
): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !context.societyId) return null;
  return verifyGuardDutyToken(
    token,
    serverEnvironment.server.GUARD_SESSION_SECRET,
    {
      societyId: context.societyId,
      sessionId: await currentSessionId(context),
    },
  );
}

export async function clearGuardDutyCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
