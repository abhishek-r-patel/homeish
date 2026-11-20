// Verify resident-home data stays household-scoped and billing totals include every open bill.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { residentHomeSnapshotSchema } from '../../src/core/home/validation';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type Summary = {
  unit_id: string;
  outstanding_paise: string;
  next_due_date: string;
};

type Home = {
  units: { id: string; number: string }[];
  pending_visitors: number;
  pending_deliveries: number;
  next_response_at: string | null;
  activity: { id: string; module: string; title: string; status: string }[];
};

describe.skipIf(!hasDatabase)('database resident home', () => {
  let database: TestDatabase;
  let societyId: string;
  let otherSocietyId: string;
  let residentId: string;
  let neighbourId: string;
  let guardId: string;
  let firstUnitId: string;
  let secondUnitId: string;
  let membershipId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      const users: Record<string, string> = {};
      for (const name of ['resident', 'neighbour', 'guard']) {
        const email = `home-${name}@example.test`;
        users[name] = await newAuthUser(client, email);
        await client.query(
          'insert into public.profiles (id, email, full_name) values ($1, $2, $3)',
          [users[name], email, `Synthetic ${name}`],
        );
      }
      residentId = users.resident!;
      neighbourId = users.neighbour!;
      guardId = users.guard!;
      const societies = await client.query<{ id: string }>(
        `insert into public.societies (name, created_by)
         values ('Home Society', $1), ('Other Society', $1) returning id`,
        [residentId],
      );
      [societyId, otherSocietyId] = societies.rows.map(({ id }) => id) as [
        string,
        string,
      ];
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         select $1, module_key, true, '{}'::jsonb
         from unnest(array['core', 'visitor', 'delivery', 'billing', 'service_request']) as module_key`,
        [societyId],
      );
      const memberships = await client.query<{ id: string; user_id: string }>(
        `insert into public.memberships (society_id, user_id, roles, status)
         values ($1, $2, array['resident', 'admin']::text[], 'active'),
                ($1, $3, array['resident']::text[], 'active'),
                ($1, $4, array['guard']::text[], 'active')
         returning id, user_id`,
        [societyId, residentId, neighbourId, guardId],
      );
      membershipId = memberships.rows.find(
        ({ user_id }) => user_id === residentId,
      )!.id;
      const neighbourMembership = memberships.rows.find(
        ({ user_id }) => user_id === neighbourId,
      )!.id;
      const units = await client.query<{ id: string; number: string }>(
        `insert into public.units (society_id, number, created_by)
         values ($1, 'A-1', $3), ($1, 'A-2', $3), ($1, 'B-1', $3),
                ($2, 'C-1', $3)
         returning id, number`,
        [societyId, otherSocietyId, residentId],
      );
      firstUnitId = units.rows.find(({ number }) => number === 'A-1')!.id;
      secondUnitId = units.rows.find(({ number }) => number === 'A-2')!.id;
      const neighbourUnit = units.rows.find(
        ({ number }) => number === 'B-1',
      )!.id;
      await client.query(
        `insert into public.unit_occupants
           (society_id, unit_id, membership_id, relationship, is_primary,
            is_approver, status, created_by)
         values ($1, $2, $4, 'owner', true, true, 'active', $6),
                ($1, $3, $4, 'owner', true, false, 'active', $6),
                ($1, $5, $7, 'owner', true, true, 'active', $6)`,
        [
          societyId,
          firstUnitId,
          secondUnitId,
          membershipId,
          neighbourUnit,
          residentId,
          neighbourMembership,
        ],
      );
      const guardRoster = (
        await client.query<{ id: string }>(
          `insert into public.guard_roster (society_id, name, created_by)
           values ($1, 'Synthetic guard', $2) returning id`,
          [societyId, residentId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.billing_bills
           (society_id, unit_id, title, period_start, due_date, total_paise, created_by, created_at)
         select $1, $2, 'Older bill', '2025-01-01', '2025-01-31', 10000, $3,
                now() - interval '100 days'
         from generate_series(1, 105)`,
        [societyId, firstUnitId, residentId],
      );
      await client.query(
        `insert into public.billing_bills
           (society_id, unit_id, title, period_start, due_date, total_paise, created_by, created_at)
         select $1, $2, 'Other household bill', '2029-01-01', '2029-01-31',
                1000, $3, now() - interval '100 days'
         from generate_series(1, 105)`,
        [societyId, neighbourUnit, residentId],
      );
      await client.query(
        `insert into public.billing_bills
           (society_id, unit_id, title, period_start, due_date, total_paise,
            paid_paise, waived_paise, created_by, created_at)
         values ($1, $2, 'Part paid', '2025-01-01', '2025-02-01', 20000, 5000, 2000, $5, now() - interval '100 days'),
                ($1, $2, 'Paid', '2025-01-01', '2025-02-01', 1000, 1000, 0, $5, now() - interval '100 days'),
                ($1, $2, 'Waived', '2025-01-01', '2025-02-01', 1000, 0, 1000, $5, now() - interval '100 days'),
                ($1, $2, 'Recent bill', '2025-01-01', '2025-02-01', 1000, 0, 0, $5, now() - interval '4 minutes'),
                ($1, $3, 'Second unit bill', '2025-01-01', '2025-02-01', 22222, 0, 0, $5, now() - interval '100 days'),
                ($1, $4, 'Neighbour bill', '2025-01-01', '2025-02-01', 999999, 0, 0, $5, now() - interval '1 minute')`,
        [societyId, firstUnitId, secondUnitId, neighbourUnit, residentId],
      );
      await client.query(
        `insert into public.billing_bills
           (society_id, unit_id, title, period_start, due_date, total_paise,
            waived_paise, cancelled_at, cancelled_by, cancel_reason, created_by, created_at)
         values ($1, $2, 'Cancelled', '2025-01-01', '2025-02-01',
                 1000, 1000, now() - interval '100 days', $3, 'Synthetic cancellation', $3, now() - interval '100 days')`,
        [societyId, firstUnitId, residentId],
      );
      await client.query(
        `insert into public.billing_payments
           (society_id, unit_id, amount_paise, mode, source, reference, paid_on,
            status, submitted_by, client_request_id, created_by, created_at)
         values ($1, $2, 5000, 'upi', 'resident_submitted', 'OWNREF1234', current_date,
                 'awaiting_confirmation', $3, gen_random_uuid(), $3, now() - interval '1 day')`,
        [societyId, firstUnitId, residentId],
      );
      await client.query(
        `insert into public.billing_payments
           (society_id, unit_id, amount_paise, mode, source, reference, paid_on,
            status, submitted_by, client_request_id, created_by, created_at)
         select $1, $2, 5000, 'upi', 'resident_submitted',
                'NEIGHBOUR' || lpad(item::text, 6, '0'), current_date,
                'awaiting_confirmation', $3, gen_random_uuid(), $3, now()
         from generate_series(1, 105) as item`,
        [societyId, neighbourUnit, neighbourId],
      );
      await client.query(
        `insert into public.visitor_entries
           (society_id, unit_id, visitor_name, purpose, handled_by_guard_id,
            status, respond_by, created_by, created_at, updated_at)
         values ($1, $2, 'Household visitor', 'guest', $5, 'pending', now() + interval '5 minutes', $6, now() - interval '1 minute', now() - interval '1 minute'),
                ($1, $3, 'Second-unit visitor', 'guest', $5, 'pending', now() + interval '5 minutes', $6, now() - interval '5 minutes', now() - interval '5 minutes'),
                ($1, $2, 'Expired visitor', 'guest', $5, 'pending', now() - interval '40 minutes', $6, now() - interval '50 minutes', now() - interval '50 minutes'),
                ($1, $4, 'Neighbour visitor', 'guest', $5, 'pending', now() + interval '5 minutes', $6, now(), now())`,
        [
          societyId,
          firstUnitId,
          secondUnitId,
          neighbourUnit,
          guardRoster,
          guardId,
        ],
      );
      await client.query(
        `insert into public.delivery_entries
           (society_id, unit_id, company, delivery_type, handled_by_guard_id,
            status, respond_by, client_request_id, created_by, created_at, updated_at)
         values ($1, $2, 'Household parcel', 'parcel', $4, 'pending_response', now() + interval '5 minutes', gen_random_uuid(), $5, now() - interval '2 minutes', now() - interval '2 minutes'),
                ($1, $2, 'Expired parcel', 'parcel', $4, 'pending_response', now() - interval '40 minutes', gen_random_uuid(), $5, now() - interval '50 minutes', now() - interval '50 minutes'),
                ($1, $3, 'Neighbour parcel', 'parcel', $4, 'pending_response', now() + interval '5 minutes', gen_random_uuid(), $5, now(), now())`,
        [societyId, firstUnitId, neighbourUnit, guardRoster, guardId],
      );
      const categoryId = (
        await client.query<{ id: string }>(
          `select id from public.service_request_categories
           where society_id = $1 and name = 'Plumbing'`,
          [societyId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.service_requests
           (society_id, category_id, location_type, description,
            client_request_id, created_by, created_at, updated_at)
         values ($1, $2, 'common_area', 'Own request', gen_random_uuid(), $3, now() - interval '3 minutes', now() - interval '3 minutes'),
                ($1, $2, 'common_area', 'Neighbour request', gen_random_uuid(), $4, now(), now())`,
        [societyId, categoryId, residentId, neighbourId],
      );
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  async function summary(userId = residentId, targetSociety = societyId) {
    return database.asRole(
      'authenticated',
      { sub: userId },
      async (client) =>
        (
          await client.query<{ result: Summary[] }>(
            'select public.billing_resident_outstanding($1) as result',
            [targetSociety],
          )
        ).rows[0]!.result,
    );
  }

  async function home(userId = residentId, targetSociety = societyId) {
    return database.asRole(
      'authenticated',
      { sub: userId },
      async (client) =>
        (
          await client.query<{ result: Home }>(
            'select public.resident_home_get($1) as result',
            [targetSociety],
          )
        ).rows[0]!.result,
    );
  }

  it('sums more than 100 bills per occupied unit without including settled or other households bills', async () => {
    expect(await summary()).toEqual(
      expect.arrayContaining([
        {
          unit_id: firstUnitId,
          outstanding_paise: '1064000',
          next_due_date: '2025-01-31',
        },
        {
          unit_id: secondUnitId,
          outstanding_paise: '22222',
          next_due_date: '2025-02-01',
        },
      ]),
    );
    expect(await summary()).toHaveLength(2);
  });

  it('returns only the latest five household records and actionable approver requests', async () => {
    const result = await home();
    expect(() => residentHomeSnapshotSchema.parse(result)).not.toThrow();
    expect(result.units.map(({ number }) => number)).toEqual(['A-1', 'A-2']);
    expect(result.pending_visitors).toBe(1);
    expect(result.pending_deliveries).toBe(1);
    expect(result.next_response_at).not.toBeNull();
    expect(result.activity.map(({ title }) => title)).toEqual([
      'Household visitor',
      'Household parcel',
      'Plumbing',
      'Recent bill',
      'Second-unit visitor',
    ]);
  });

  it('narrows bills and payments to the household before applying the page limit', async () => {
    const result = await database.asRole(
      'authenticated',
      { sub: residentId },
      async (client) =>
        (
          await client.query<{
            result: {
              bills: { unit_id: string }[];
              payments: { unit_id: string; reference: string }[];
            };
          }>('select public.billing_resident_lists($1) as result', [societyId])
        ).rows[0]!.result,
    );
    expect(result.bills).toHaveLength(100);
    expect(
      result.bills.every(({ unit_id }) =>
        [firstUnitId, secondUnitId].includes(unit_id),
      ),
    ).toBe(true);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0]).toMatchObject({
      unit_id: firstUnitId,
      reference: 'OWNREF1234',
    });
  });

  it('removes disabled module activity and suppresses actions when suspended', async () => {
    await database.asSuperuser((client) =>
      client.query(
        `update public.module_configs set enabled = false
         where society_id = $1 and module_key in ('delivery', 'service_request')`,
        [societyId],
      ),
    );
    try {
      const disabled = await home();
      expect(disabled.pending_deliveries).toBe(0);
      expect(
        disabled.activity.some(({ module }) => module === 'delivery'),
      ).toBe(false);
      expect(
        disabled.activity.some(({ module }) => module === 'service_request'),
      ).toBe(false);
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = true
           where society_id = $1 and module_key in ('delivery', 'service_request')`,
          [societyId],
        ),
      );
    }
    await database.asSuperuser((client) =>
      client.query(
        `update public.societies set status = 'suspended' where id = $1`,
        [societyId],
      ),
    );
    try {
      const suspended = await home();
      expect(suspended.pending_visitors).toBe(0);
      expect(suspended.pending_deliveries).toBe(0);
      expect(suspended.next_response_at).not.toBeNull();
      expect(await summary()).toHaveLength(2);
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          `update public.societies set status = 'trial' where id = $1`,
          [societyId],
        ),
      );
    }
  });

  it('refreshes expiring household activity even for a non-approver', async () => {
    await database.asSuperuser((client) =>
      client.query(
        'update public.unit_occupants set is_approver = false where membership_id = $1',
        [membershipId],
      ),
    );
    try {
      const result = await home();
      expect(result.pending_visitors).toBe(0);
      expect(result.pending_deliveries).toBe(0);
      expect(result.next_response_at).not.toBeNull();
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          'update public.unit_occupants set is_approver = true where membership_id = $1 and unit_id = $2',
          [membershipId, firstUnitId],
        ),
      );
    }
  });

  it('marks expired gate requests as non-actionable and refuses disabled billing', async () => {
    await database.asSuperuser((client) =>
      client.query(
        `update public.module_configs set enabled = false
         where society_id = $1 and module_key in ('billing', 'service_request')`,
        [societyId],
      ),
    );
    try {
      const result = await home();
      expect(result.pending_visitors).toBe(1);
      expect(result.pending_deliveries).toBe(1);
      expect(result.activity).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Expired visitor',
            status: 'expired',
          }),
          expect.objectContaining({
            title: 'Expired parcel',
            status: 'no_response',
          }),
        ]),
      );
      expect(result.activity.some(({ module }) => module === 'billing')).toBe(
        false,
      );
      expect((await dbError(summary())).code).toBe('42501');
      expect(
        (
          await dbError(
            database.asRole('authenticated', { sub: residentId }, (client) =>
              client.query('select public.billing_resident_lists($1)', [
                societyId,
              ]),
            ),
          )
        ).code,
      ).toBe('42501');
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = true
           where society_id = $1 and module_key in ('billing', 'service_request')`,
          [societyId],
        ),
      );
    }
  });

  it('does not expose unit data after occupancy ends', async () => {
    await database.asSuperuser((client) =>
      client.query(
        `update public.unit_occupants set status = 'ended', ended_at = current_date
         where membership_id = $1`,
        [membershipId],
      ),
    );
    try {
      expect(await summary()).toEqual([]);
      const result = await home();
      expect(result.units).toEqual([]);
      expect(result.pending_visitors).toBe(0);
      expect(result.pending_deliveries).toBe(0);
      expect(result.activity.map(({ title }) => title)).toEqual(['Plumbing']);
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          `update public.unit_occupants set status = 'active', ended_at = null
           where membership_id = $1`,
          [membershipId],
        ),
      );
    }
  });

  it('refuses other societies, non-residents, anonymous callers and disabled accounts', async () => {
    for (const attempt of [
      () => home(residentId, otherSocietyId),
      () => summary(residentId, otherSocietyId),
      () => home(guardId),
      () => summary(guardId),
      () =>
        database.asRole('anon', null, (client) =>
          client.query('select public.resident_home_get($1)', [societyId]),
        ),
      () =>
        database.asRole('anon', null, (client) =>
          client.query('select public.billing_resident_outstanding($1)', [
            societyId,
          ]),
        ),
      () =>
        database.asRole('service_role', null, (client) =>
          client.query('select public.billing_resident_lists($1)', [societyId]),
        ),
    ]) {
      expect((await dbError(attempt())).code).toBe('42501');
    }
    await database.asSuperuser((client) =>
      client.query(
        `update public.profiles set status = 'disabled' where id = $1`,
        [residentId],
      ),
    );
    try {
      expect((await dbError(home())).code).toBe('42501');
      expect((await dbError(summary())).code).toBe('42501');
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          `update public.profiles set status = 'active' where id = $1`,
          [residentId],
        ),
      );
    }
  });

  it('returns exact integer strings even when a unit total exceeds the JavaScript safe integer', async () => {
    await database.asSuperuser((client) =>
      client.query(
        `insert into public.billing_bills
           (society_id, unit_id, title, period_start, due_date, total_paise, created_by)
         values ($1, $2, 'Large synthetic bill', '2025-01-01', '2025-02-01',
                 9007199254740991, $3)`,
        [societyId, firstUnitId, residentId],
      ),
    );
    expect(
      (await summary()).find(({ unit_id }) => unit_id === firstUnitId)
        ?.outstanding_paise,
    ).toBe('9007199255804991');
  });
});
