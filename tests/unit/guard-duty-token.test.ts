// Verify signed guard-duty claims expire and remain bound to a session/society.
import { describe, expect, it } from 'vitest';
import {
  createGuardDutyToken,
  verifyGuardDutyToken,
} from '../../src/core/guards/token';

const payload = {
  expiresAt: 1_800_000_100,
  guardId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  societyId: '33333333-3333-4333-8333-333333333333',
};
const secret = 'guard-session-secret-for-unit-test';
const expected = {
  societyId: payload.societyId,
  sessionId: payload.sessionId,
  nowSeconds: 1_800_000_000,
};

describe('guard duty token', () => {
  it('accepts a valid signed token for the expected session and society', () => {
    const token = createGuardDutyToken(payload, secret);
    expect(verifyGuardDutyToken(token, secret, expected)).toBe(payload.guardId);
  });

  it('rejects tampered, expired, cross-session and cross-society tokens', () => {
    const token = createGuardDutyToken(payload, secret);
    expect(verifyGuardDutyToken(`${token}x`, secret, expected)).toBeNull();
    expect(
      verifyGuardDutyToken(token, secret, {
        ...expected,
        nowSeconds: payload.expiresAt,
      }),
    ).toBeNull();
    expect(
      verifyGuardDutyToken(token, secret, {
        ...expected,
        sessionId: '44444444-4444-4444-8444-444444444444',
      }),
    ).toBeNull();
    expect(
      verifyGuardDutyToken(token, secret, {
        ...expected,
        societyId: '55555555-5555-4555-8555-555555555555',
      }),
    ).toBeNull();
  });
});
