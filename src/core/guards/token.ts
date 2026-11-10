// Sign and verify short-lived guard-duty claims without trusting browser state.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface GuardDutyPayload {
  expiresAt: number;
  guardId: string;
  sessionId: string;
  societyId: string;
}

function signature(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

export function createGuardDutyToken(
  payload: GuardDutyPayload,
  secret: string,
): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded, secret).toString('base64url')}`;
}

export function verifyGuardDutyToken(
  token: string,
  secret: string,
  expected: { societyId: string; sessionId: string; nowSeconds?: number },
): string | null {
  const [encodedPayload, encodedSignature, ...extra] = token.split('.');
  if (!encodedPayload || !encodedSignature || extra.length > 0) return null;
  const providedSignature = Buffer.from(encodedSignature, 'base64url');
  const expectedSignature = signature(encodedPayload, secret);
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    );
  } catch {
    return null;
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('guardId' in payload) ||
    !('sessionId' in payload) ||
    !('societyId' in payload) ||
    !('expiresAt' in payload) ||
    typeof payload.guardId !== 'string' ||
    typeof payload.sessionId !== 'string' ||
    typeof payload.societyId !== 'string' ||
    typeof payload.expiresAt !== 'number' ||
    !UUID_PATTERN.test(payload.guardId) ||
    !UUID_PATTERN.test(payload.sessionId) ||
    !UUID_PATTERN.test(payload.societyId) ||
    payload.societyId !== expected.societyId ||
    payload.sessionId !== expected.sessionId ||
    payload.expiresAt <= (expected.nowSeconds ?? Math.floor(Date.now() / 1000))
  ) {
    return null;
  }
  return payload.guardId;
}
