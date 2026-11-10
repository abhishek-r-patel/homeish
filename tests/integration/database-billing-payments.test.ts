import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('database billing payments', () => {
  let database: TestDatabase;
  let societyId: string;
  let unitId: string;
  let users: Record<'admin' | 'committee' | 'resident' | 'guard', string>;
  let chargeId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      users = {} as typeof users;
      for (const role of ['admin', 'committee', 'resident', 'guard'] as const) {
        const id = await newAuthUser(
          client,
          `billing-payments-${role}@example.test`,
        );
        users[role] = id;
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, $2, $3)`,
          [id, `billing-payments-${role}@example.test`, `Billing ${role}`],
        );
      }
      societyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Billing Payments Society', $1) returning id`,
          [users.admin],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         values ($1, 'core', true, '{}'), ($1, 'billing', true, '{}')`,
        [societyId],
      );
      let residentMembershipId = '';
      for (const role of Object.keys(users) as (keyof typeof users)[]) {
        const membership = await client.query<{ id: string }>(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY[$3]::text[], 'active') returning id`,
          [societyId, users[role], role],
        );
        if (role === 'resident') residentMembershipId = membership.rows[0]!.id;
      }
      unitId = (
        await client.query<{ id: string }>(
          `insert into public.units
             (society_id, number, created_by, updated_by)
           values ($1, 'A-1', $2, $2) returning id`,
          [societyId, users.admin],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.unit_occupants
           (society_id, unit_id, membership_id, relationship, is_primary, status, created_by)
         values ($1, $2, $3, 'owner', true, 'active', $4)`,
        [societyId, unitId, residentMembershipId, users.admin],
      );
    });
    chargeId = await database.asRole(
      'authenticated',
      { sub: users.admin },
      async (client) => {
        const result = await client.query<{ id: string }>(
          `select (public.billing_charge_save(
            $1, null, 'Monthly', 'fixed', 10000, true, null,
            'billing-payments-charge'
          )).id as id`,
          [societyId],
        );
        return result.rows[0]!.id;
      },
      { commit: true },
    );
  });

  afterAll(async () => {
    await database?.drop();
  });

  async function generate(period: string) {
    const preview = await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query<{ preview: { preview_hash: string } }>(
          `select public.billing_bills_preview(
            $1, $2::date, $3::uuid[], $4::uuid[], '[]'::jsonb
          ) as preview`,
          [societyId, period, [unitId], [chargeId]],
        ),
    );
    return database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query<{ result: Record<string, unknown> }>(
          `select public.billing_bills_generate(
            $1, $2::date, $3::uuid[], $4::uuid[], '[]'::jsonb,
            $5, $6
          ) as result`,
          [
            societyId,
            period,
            [unitId],
            [chargeId],
            preview.rows[0]!.preview.preview_hash,
            `billing-payment-generate-${period}`,
          ],
        ),
      { commit: true },
    );
  }

  async function submit(reference: string, clientRequestId: string) {
    return database.asRole(
      'authenticated',
      { sub: users.resident },
      (client) =>
        client.query<{ payment: Record<string, unknown> }>(
          `select public.billing_payment_submit(
            $1, $2, 15000, $3, current_date, null, $4, $5
          ) as payment`,
          [
            societyId,
            unitId,
            reference,
            clientRequestId,
            `billing-payment-submit-${clientRequestId}`,
          ],
        ),
      { commit: true },
    );
  }

  it('rejects duplicate references, confirms with allocation, and applies leftover credit to the next bill', async () => {
    await generate('2027-01-01');
    const submitted = await submit(
      'AB123456',
      '00000000-0000-4000-8000-000000000001',
    );
    const paymentId = submitted.rows[0]!.payment.id as string;
    expect(submitted.rows[0]?.payment.status).toBe('awaiting_confirmation');
    expect(
      (
        await dbError(
          submit('AB123456', '00000000-0000-4000-8000-000000000002'),
        )
      ).code,
    ).toBe('23505');

    const confirmed = await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query<{ payment: Record<string, unknown> }>(
          `select public.billing_payment_confirm(
            $1, $2, 16000, 'billing-payment-confirm'
          ) as payment`,
          [societyId, paymentId],
        ),
      { commit: true },
    );
    expect(confirmed.rows[0]?.payment).toMatchObject({
      status: 'confirmed',
      amount_paise: 16000,
      unallocated_paise: '6000',
    });
    expect(confirmed.rows[0]?.payment.receipt_no).toMatch(/^R-\d{4}-\d{6}$/);

    const residentDetails = await database.asRole(
      'authenticated',
      { sub: users.resident },
      (client) =>
        client.query<{ payment: Record<string, unknown> }>(
          'select public.billing_payment_get($1, $2) as payment',
          [societyId, paymentId],
        ),
    );
    expect(residentDetails.rows[0]?.payment).toMatchObject({
      allocated_paise: 10000,
      unallocated_paise: '6000',
    });

    await generate('2027-02-01');
    const bills = await database.asRole(
      'authenticated',
      { sub: users.resident },
      (client) =>
        client.query<{ bills: Record<string, unknown>[] }>(
          'select public.billing_bills_list($1, 10, 0) as bills',
          [societyId],
        ),
    );
    const februaryBill = bills.rows[0]?.bills.find(
      (bill) => bill.period_start === '2027-02-01',
    );
    expect(februaryBill).toMatchObject({
      total_paise: 10000,
      paid_paise: 6000,
      outstanding_paise: 4000,
      status: 'partially_paid',
    });
  });

  it('allows a rejected reference to be resubmitted and denies non-admin confirmation', async () => {
    const rejectedSubmission = await submit(
      'REJ123456',
      '00000000-0000-4000-8000-000000000003',
    );
    const paymentId = rejectedSubmission.rows[0]!.payment.id as string;
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: users.committee }, (client) =>
            client.query(
              `select public.billing_payment_confirm(
                  $1, $2, null, 'billing-payment-forbidden'
                )`,
              [societyId, paymentId],
            ),
          ),
        )
      ).code,
    ).toBe('42501');
    await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query(
          `select public.billing_payment_reject(
            $1, $2, 'Reference did not match', 'billing-payment-reject'
          )`,
          [societyId, paymentId],
        ),
      { commit: true },
    );
    const resubmitted = await submit(
      'REJ123456',
      '00000000-0000-4000-8000-000000000004',
    );
    expect(resubmitted.rows[0]?.payment.status).toBe('awaiting_confirmation');
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: users.guard }, (client) =>
            client.query('select public.billing_payment_get($1, $2)', [
              societyId,
              paymentId,
            ]),
          ),
        )
      ).code,
    ).toBe('42501');
  });
});
