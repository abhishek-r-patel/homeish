// Verify billing failures never carry UTRs, UPI IDs or amounts into error logs.
import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Database } from '../../src/core/db/database.types';
import type { RequestContext } from '../../src/core/tenancy/request-context';

const mocks = vi.hoisted(() => ({
  writeErrorLog: vi.fn(),
  captureSentryException: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/config/server-env', () => ({
  serverEnvironment: { server: { APP_VERSION: 'test-version' } },
}));
vi.mock('../../src/core/privileged', () => ({
  writeErrorLog: mocks.writeErrorLog,
}));
vi.mock('../../src/core/logging/sentry', () => ({
  captureSentryException: mocks.captureSentryException,
}));

import { AppError } from '../../src/core/errors';
import { billingRpc } from '../../src/core/billing/queries';
import { logUnexpectedError } from '../../src/core/logging/error-logger';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const unitId = '0f8f5a3e-9f43-4d0e-8e8c-7d3b0c9a1e21';
const SECRETS = [
  'UTR998877665544',
  'resident.pay@okbank',
  '1234567',
  '12345.67',
];
const fetchMock = vi.fn<typeof fetch>();

function contextWith(): RequestContext {
  return {
    db: createClient<Database>(
      'https://billing-fixture.example.test',
      'synthetic-public-key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { fetch: fetchMock },
      },
    ),
    enabledModules: new Set(['core', 'billing']),
    isDeveloper: false,
    isDeveloperAccount: false,
    memberships: [{ societyId, roles: ['admin'] }],
    mfaVerified: true,
    requestId: 'billing-logs-test',
    roles: ['admin'],
    societyId,
    societyStatus: 'active',
    userId: societyId,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

function databaseFailure(code: string) {
  return Response.json(
    {
      code,
      message: `payment UTR998877665544 from resident.pay@okbank for 1234567 paise failed (constraint billing_payments_amount_check)`,
      details: 'Failing row contains (UTR998877665544, 1234567, 12345.67).',
      hint: 'resident.pay@okbank',
    },
    { status: 400 },
  );
}

function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item instanceof Error
      ? {
          ...item,
          name: item.name,
          message: item.message,
          stack: item.stack,
          cause: item.cause,
        }
      : item,
  );
}

function expectNoSecrets(value: unknown) {
  const text = serialize(value);
  for (const secret of SECRETS) expect(text).not.toContain(secret);
}

describe('billing log safety', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mocks.writeErrorLog.mockReset().mockResolvedValue(undefined);
    mocks.captureSentryException.mockReset();
  });

  it.each([
    ['XX000', Error],
    ['P0001', Error],
    ['23505', AppError],
    ['22023', AppError],
    ['42501', AppError],
  ])(
    'strips payment details from %s database failures before logging',
    async (code, expected) => {
      fetchMock.mockResolvedValue(databaseFailure(code));
      const error = await billingRpc(
        contextWith(),
        'billing_payment_submit',
        {
          p_society_id: societyId,
          p_unit_id: unitId,
          p_amount_paise: 1234567,
          p_reference: 'UTR998877665544',
        },
        z.unknown(),
      ).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(expected);
      expectNoSecrets(error);

      await logUnexpectedError(error, {
        requestId: 'billing-logs-test',
        route: '/bills/pay',
        source: 'server',
        societyId,
      });
      expect(mocks.writeErrorLog).toHaveBeenCalledOnce();
      expectNoSecrets(mocks.writeErrorLog.mock.calls);
      expectNoSecrets(mocks.captureSentryException.mock.calls);
    },
  );

  it('keeps the duplicate-reference conflict readable without echoing the UTR', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "billing_payments_active_upi_reference_key"',
          details: 'Key (society_id, reference)=(x, UTR998877665544) exists.',
          hint: null,
        },
        { status: 409 },
      ),
    );
    const error = await billingRpc(
      contextWith(),
      'billing_payment_submit',
      { p_reference: 'UTR998877665544' },
      z.unknown(),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'CONFLICT',
      reason: 'duplicate_reference',
    });
    expectNoSecrets(error);
  });
});
