// Verify billing query authorization and safe error mapping without external calls.
import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Database } from '../../src/core/db/database.types';
import type { RequestContext } from '../../src/core/tenancy/request-context';

vi.mock('server-only', () => ({}));

import {
  billingRpc,
  readBillingPaymentDetails,
} from '../../src/core/billing/queries';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const fetchMock = vi.fn<typeof fetch>();
let context: RequestContext;

describe('billing queries', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(Response.json(null));
    context = {
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
      memberships: [{ societyId, roles: ['resident'] }],
      mfaVerified: false,
      requestId: 'billing-query-test',
      roles: ['resident'],
      societyId,
      societyStatus: 'active',
      userId: societyId,
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };
  });

  it('reads an explicitly unconfigured account without inventing payment details', async () => {
    await expect(
      readBillingPaymentDetails(context, societyId),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('denies cross-society, disabled-module and archived reads before querying', async () => {
    await expect(
      readBillingPaymentDetails(
        context,
        '7a696d6f-774c-41d1-ae47-6254d4a8f4cf',
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      readBillingPaymentDetails(
        { ...context, enabledModules: new Set(['core']) },
        societyId,
      ),
    ).rejects.toMatchObject({ code: 'MODULE_DISABLED' });
    await expect(
      readBillingPaymentDetails(
        { ...context, societyStatus: 'archived' },
        societyId,
      ),
    ).rejects.toMatchObject({ code: 'SOCIETY_ARCHIVED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['42501', 'FORBIDDEN'],
    ['23505', 'CONFLICT'],
    ['P0002', 'NOT_FOUND'],
    ['23514', 'VALIDATION_FAILED'],
  ])(
    'maps database %s to the standard %s outcome',
    async (databaseCode, appCode) => {
      fetchMock.mockResolvedValue(
        Response.json(
          { code: databaseCode, message: 'Synthetic database failure' },
          { status: 400 },
        ),
      );
      await expect(
        billingRpc(context, 'billing_charge_save', {}, z.unknown()),
      ).rejects.toMatchObject({ code: appCode });
    },
  );

  it.each([
    [
      { hint: 'not_unpaid' },
      'not_unpaid',
      'Only unpaid bills can be cancelled',
    ],
    [
      {
        message:
          'duplicate key value violates unique constraint "billing_payments_active_upi_reference_key"',
      },
      'duplicate_reference',
      'This reference was already submitted.',
    ],
    [{ hint: 'not-a-known-reason' }, 'invalid_state', undefined],
  ])(
    'maps a billing conflict %o to a safe reason',
    async (detail, reason, message) => {
      fetchMock.mockResolvedValue(
        Response.json(
          { code: '23505', message: 'Synthetic conflict', ...detail },
          { status: 409 },
        ),
      );
      const error = await billingRpc(
        context,
        'billing_bill_waive',
        {},
        z.unknown(),
      ).catch((caught: unknown) => caught);
      expect(error).toMatchObject({ code: 'CONFLICT', reason });
      if (message) expect((error as Error).message).toContain(message);
    },
  );

  it('does not propagate database payment identifiers or monetary values into unexpected errors', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          code: 'XX000',
          message: 'Synthetic database failure',
          details: 'row contains homeish-test@example and 123456',
        },
        { status: 500 },
      ),
    );
    try {
      await billingRpc(context, 'billing_charge_save', {}, z.unknown());
      throw new Error('Expected the billing operation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) throw error;
      expect(error.message).toBe('The billing database operation failed.');
      expect(error.cause).toEqual({ code: 'XX000' });
      expect(JSON.stringify(error.cause)).not.toContain('homeish-test@example');
      expect(JSON.stringify(error.cause)).not.toContain('123456');
    }
  });
});
