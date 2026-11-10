// Verify billing concurrency, visibility, state gates, scale and money invariants.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type Role =
  'admin' | 'second-admin' | 'committee' | 'resident' | 'neighbour' | 'guard';

const ROLE_OF: Record<Role, string> = {
  admin: 'admin',
  'second-admin': 'admin',
  committee: 'committee',
  resident: 'resident',
  neighbour: 'resident',
  guard: 'guard',
};

describe.skipIf(!hasDatabase)('database billing invariants', () => {
  let database: TestDatabase;
  let societyId: string;
  let unitId: string;
  let neighbourUnitId: string;
  let users: Record<Role, string>;
  let chargeId: string;
  let requestCounter = 0;

  function requestId(label: string) {
    requestCounter += 1;
    return `billing-invariants-${label}-${requestCounter}`;
  }

  function clientRequestId() {
    requestCounter += 1;
    return `00000000-0000-4000-9000-${String(requestCounter).padStart(12, '0')}`;
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      users = {} as typeof users;
      for (const role of Object.keys(ROLE_OF) as Role[]) {
        const email = `billing-invariants-${role}@example.test`;
        const id = await newAuthUser(client, email);
        users[role] = id;
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, $2, $3)`,
          [id, email, `Invariant ${role}`],
        );
      }
      societyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Billing Invariant Society', $1) returning id`,
          [users.admin],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         values ($1, 'core', true, '{}'), ($1, 'billing', true, '{}')`,
        [societyId],
      );
      const memberships = {} as Record<Role, string>;
      for (const role of Object.keys(ROLE_OF) as Role[]) {
        memberships[role] = (
          await client.query<{ id: string }>(
            `insert into public.memberships (society_id, user_id, roles, status)
             values ($1, $2, ARRAY[$3]::text[], 'active') returning id`,
            [societyId, users[role], ROLE_OF[role]],
          )
        ).rows[0]!.id;
      }
      const units = await client.query<{ id: string; number: string }>(
        `insert into public.units (society_id, number, created_by, updated_by)
         select $1, 'INV-' || lpad(n::text, 3, '0'), $2, $2
         from generate_series(1, 300) as n
         returning id, number`,
        [societyId, users.admin],
      );
      const byNumber = new Map(units.rows.map((row) => [row.number, row.id]));
      unitId = byNumber.get('INV-001')!;
      neighbourUnitId = byNumber.get('INV-002')!;
      await client.query(
        `insert into public.unit_occupants
           (society_id, unit_id, membership_id, relationship, is_primary, status, created_by)
         values ($1, $2, $3, 'owner', true, 'active', $6),
                ($1, $4, $5, 'owner', true, 'active', $6)`,
        [
          societyId,
          unitId,
          memberships.resident,
          neighbourUnitId,
          memberships.neighbour,
          users.admin,
        ],
      );
    });
    chargeId = await database.asRole(
      'authenticated',
      { sub: users.admin },
      async (client) =>
        (
          await client.query<{ id: string }>(
            `select (public.billing_charge_save(
              $1, null, 'Maintenance', 'fixed', 10000, true, null,
              'billing-invariants-charge'
            )).id as id`,
            [societyId],
          )
        ).rows[0]!.id,
      { commit: true },
    );
  });

  afterAll(async () => {
    await database?.drop();
  });

  async function allUnitIds() {
    return database.asSuperuser(async (client) =>
      (
        await client.query<{ id: string }>(
          'select id from public.units where society_id = $1 order by number',
          [societyId],
        )
      ).rows.map((row) => row.id),
    );
  }

  async function generate(period: string, unitIds: string[]) {
    const preview = await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query<{ preview: { preview_hash: string } }>(
          `select public.billing_bills_preview(
            $1, $2::date, $3::uuid[], $4::uuid[], '[]'::jsonb
          ) as preview`,
          [societyId, period, unitIds, [chargeId]],
        ),
    );
    const result = await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query<{ result: Record<string, unknown> }>(
          `select public.billing_bills_generate(
            $1, $2::date, $3::uuid[], $4::uuid[], '[]'::jsonb, $5, $6
          ) as result`,
          [
            societyId,
            period,
            unitIds,
            [chargeId],
            preview.rows[0]!.preview.preview_hash,
            requestId('generate'),
          ],
        ),
      { commit: true },
    );
    return result.rows[0]!.result;
  }

  async function submit(
    reference: string,
    amountPaise: number,
    as: Role = 'resident',
    unit = unitId,
  ) {
    const result = await database.asRole(
      'authenticated',
      { sub: users[as] },
      (client) =>
        client.query<{ payment: { id: string; status: string } }>(
          `select public.billing_payment_submit(
            $1, $2, $3, $4, current_date, null, $5, $6
          ) as payment`,
          [
            societyId,
            unit,
            amountPaise,
            reference,
            clientRequestId(),
            requestId('submit'),
          ],
        ),
      { commit: true },
    );
    return result.rows[0]!.payment;
  }

  function confirm(
    paymentId: string,
    as: Role = 'admin',
    correctedPaise: number | null = null,
  ) {
    return database.asRole(
      'authenticated',
      { sub: users[as] },
      (client) =>
        client.query<{ payment: Record<string, unknown> }>(
          `select public.billing_payment_confirm($1, $2, $3, $4) as payment`,
          [societyId, paymentId, correctedPaise, requestId('confirm')],
        ),
      { commit: true },
    );
  }

  it('generates 300 unit bills in one run and creates no duplicates on re-run', async () => {
    const unitIds = await allUnitIds();
    expect(unitIds).toHaveLength(300);
    const started = performance.now();
    expect(await generate('2027-03-01', unitIds)).toMatchObject({
      generated_bill_count: 300,
      generated_line_count: 300,
      already_generated_count: 0,
      total_paise: '3000000',
    });
    expect(performance.now() - started).toBeLessThan(30_000);
    expect(await generate('2027-03-01', unitIds)).toMatchObject({
      generated_bill_count: 0,
      generated_line_count: 0,
      already_generated_count: 300,
    });
    const count = await database.asSuperuser(async (client) =>
      Number(
        (
          await client.query<{ count: string }>(
            `select count(*) from public.billing_bills
             where society_id = $1 and period_start = '2027-03-01'`,
            [societyId],
          )
        ).rows[0]!.count,
      ),
    );
    expect(count).toBe(300);
  });

  it('confirms a payment exactly once when two admins confirm at the same time', async () => {
    const payment = await submit('RACE123456', 4000);
    const outcomes = await Promise.allSettled([
      confirm(payment.id, 'admin'),
      confirm(payment.id, 'second-admin'),
    ]);
    expect(
      outcomes.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(
      rejected?.status === 'rejected' ? rejected.reason : null,
    ).toMatchObject({ code: '23505' });
    const counts = await database.asSuperuser(async (client) => {
      const row = (
        await client.query<{
          allocations: string;
          credits: string;
          confirms: string;
        }>(
          `select
             (select count(*) from public.billing_payment_allocations
               where payment_id = $1) as allocations,
             (select count(*) from public.billing_ledger_entries
               where payment_id = $1 and kind = 'payment') as credits,
             (select count(*) from public.audit_logs
               where entity_id = $1::text
                 and action = 'billing.payment.confirm') as confirms`,
          [payment.id],
        )
      ).rows[0]!;
      return {
        allocations: Number(row.allocations),
        credits: Number(row.credits),
        confirms: Number(row.confirms),
      };
    });
    expect(counts).toEqual({ allocations: 1, credits: 1, confirms: 1 });
  });

  it('records a partial payment and audits a corrected confirmation amount', async () => {
    const payment = await submit('PART123456', 2500);
    const confirmed = await confirm(payment.id, 'admin', 3000);
    expect(confirmed.rows[0]?.payment).toMatchObject({
      status: 'confirmed',
      amount_paise: 3000,
      unallocated_paise: '0',
    });
    const state = await database.asSuperuser(async (client) => ({
      bill: (
        await client.query<{ paid_paise: string; status: string }>(
          `select paid_paise, status from public.billing_bills
           where unit_id = $1 and period_start = '2027-03-01'`,
          [unitId],
        )
      ).rows[0],
      audit: (
        await client.query<{
          before: Record<string, unknown>;
          after: Record<string, unknown>;
        }>(
          `select "before", "after" from public.audit_logs
           where entity_id = $1::text and action = 'billing.payment.amount_correct'`,
          [payment.id],
        )
      ).rows,
    }));
    expect(state.bill).toMatchObject({
      paid_paise: '7000',
      status: 'partially_paid',
    });
    expect(state.audit).toEqual([
      { before: { amount_paise: 2500 }, after: { amount_paise: 3000 } },
    ]);
  });

  it('shows residents only their own unit and gives guards no billing data', async () => {
    const neighbourPayment = await submit(
      'NEIGH12345',
      1000,
      'neighbour',
      neighbourUnitId,
    );
    const residentView = await database.asRole(
      'authenticated',
      { sub: users.resident },
      async (client) => ({
        bills: (
          await client.query<{ bills: { unit_id: string }[] }>(
            'select public.billing_bills_list($1, 100, 0) as bills',
            [societyId],
          )
        ).rows[0]!.bills,
        payments: (
          await client.query<{ payments: { unit_id: string }[] }>(
            'select public.billing_payments_list($1, 100, 0) as payments',
            [societyId],
          )
        ).rows[0]!.payments,
        tableBills: (
          await client.query<{ unit_id: string }>(
            'select unit_id from public.billing_bills where society_id = $1',
            [societyId],
          )
        ).rows,
      }),
    );
    expect(residentView.bills.length).toBeGreaterThan(0);
    for (const rows of [
      residentView.bills,
      residentView.payments,
      residentView.tableBills,
    ]) {
      expect(new Set(rows.map((row) => row.unit_id))).toEqual(
        new Set([unitId]),
      );
    }
    for (const statement of [
      'select public.billing_payment_get($1, $2)',
      'select public.billing_receipt_get($1, $2)',
    ]) {
      expect(
        (
          await dbError(
            database.asRole(
              'authenticated',
              { sub: users.resident },
              (client) =>
                client.query(statement, [societyId, neighbourPayment.id]),
            ),
          )
        ).code,
      ).toMatch(/^(42501|P0002)$/);
    }
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: users.resident }, (client) =>
            client.query('select public.billing_ledger_get($1, $2)', [
              societyId,
              neighbourUnitId,
            ]),
          ),
        )
      ).code,
    ).toBe('42501');

    for (const statement of [
      'select public.billing_bills_list($1, 10, 0)',
      'select public.billing_payments_list($1, 10, 0)',
      "select public.billing_dashboard($1, '2027-01-01', '2027-12-31')",
    ]) {
      expect(
        (
          await dbError(
            database.asRole('authenticated', { sub: users.guard }, (client) =>
              client.query(statement, [societyId]),
            ),
          )
        ).code,
      ).toBe('42501');
    }
    const guardRows = await database.asRole(
      'authenticated',
      { sub: users.guard },
      async (client) => {
        let total = 0;
        for (const table of [
          'billing_bills',
          'billing_payments',
          'billing_ledger_entries',
          'billing_payment_allocations',
        ]) {
          total += (
            await client.query(
              `select 1 from public.${table} where society_id = $1`,
              [societyId],
            )
          ).rowCount!;
        }
        return total;
      },
    );
    expect(guardRows).toBe(0);
  });

  it('keeps suspended societies read-only and hides a disabled module', async () => {
    const billId = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ id: string }>(
            `select id from public.billing_bills
             where unit_id = $1 and period_start = '2027-03-01'`,
            [neighbourUnitId],
          )
        ).rows[0]!.id,
    );
    const writes: [Role, string, unknown[]][] = [
      [
        'resident',
        `select public.billing_payment_submit(
          $1, $2, 1000, 'STATE12345', current_date, null, $3, 'state-submit'
        )`,
        [societyId, unitId, clientRequestId()],
      ],
      [
        'admin',
        `select public.billing_payment_record(
          $1, $2, 1000, 'cash', null, current_date, $3, 'state-record'
        )`,
        [societyId, unitId, clientRequestId()],
      ],
      [
        'admin',
        `select public.billing_fine_add(
          $1, $2, 1000, 'Late gate pass', current_date, 'state-fine'
        )`,
        [societyId, unitId],
      ],
      [
        'admin',
        `select public.billing_bill_waive(
          $1, $2, null, 'Committee approved', false, 'state-waive'
        )`,
        [societyId, billId],
      ],
    ];
    async function expectWritesDenied() {
      for (const [role, statement, params] of writes) {
        expect(
          (
            await dbError(
              database.asRole('authenticated', { sub: users[role] }, (client) =>
                client.query(statement, params),
              ),
            )
          ).code,
        ).toBe('42501');
      }
    }
    function residentBills() {
      return database.asRole(
        'authenticated',
        { sub: users.resident },
        (client) =>
          client.query('select public.billing_bills_list($1, 10, 0)', [
            societyId,
          ]),
      );
    }

    await database.asSuperuser((client) =>
      client.query(
        "update public.societies set status = 'suspended' where id = $1",
        [societyId],
      ),
    );
    try {
      await expectWritesDenied();
      await expect(residentBills()).resolves.toBeDefined();
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          "update public.societies set status = 'active' where id = $1",
          [societyId],
        ),
      );
    }

    await database.asSuperuser((client) =>
      client.query(
        `update public.module_configs set enabled = false
         where society_id = $1 and module_key = 'billing'`,
        [societyId],
      ),
    );
    try {
      await expectWritesDenied();
      expect((await dbError(residentBills())).code).toBe('42501');
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = true
           where society_id = $1 and module_key = 'billing'`,
          [societyId],
        ),
      );
    }
  });

  it('keeps every bill, payment and ledger consistent (DATABASE 15.3)', async () => {
    const waiveBill = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ id: string }>(
            `select id from public.billing_bills
             where unit_id = $1 and period_start = '2027-03-01'`,
            [neighbourUnitId],
          )
        ).rows[0]!.id,
    );
    await database.asRole(
      'authenticated',
      { sub: users.admin },
      async (client) => {
        await client.query(
          `select public.billing_bill_waive(
            $1, $2, 2500, 'Committee approved', false, 'invariant-waive'
          )`,
          [societyId, waiveBill],
        );
        await client.query(
          `select public.billing_fine_add(
            $1, $2, 1500, 'Parking violation', current_date, 'invariant-fine'
          )`,
          [societyId, unitId],
        );
        await client.query(
          `select public.billing_payment_record(
            $1, $2, 50000, 'cash', null, current_date, $3, 'invariant-record'
          )`,
          [societyId, neighbourUnitId, clientRequestId()],
        );
      },
      { commit: true },
    );

    const violations = await database.asSuperuser(async (client) => ({
      paidVsAllocations: (
        await client.query(
          `select bill.id from public.billing_bills bill
           left join public.billing_payment_allocations allocation
             on allocation.bill_id = bill.id
           where bill.society_id = $1
           group by bill.id
           having bill.paid_paise <> coalesce(sum(allocation.amount_paise), 0)`,
          [societyId],
        )
      ).rows,
      totalVsLines: (
        await client.query(
          `select bill.id from public.billing_bills bill
           left join public.billing_bill_lines line on line.bill_id = bill.id
           where bill.society_id = $1
           group by bill.id
           having bill.total_paise <> coalesce(sum(line.amount_paise), 0)`,
          [societyId],
        )
      ).rows,
      overSettled: (
        await client.query(
          `select id from public.billing_bills
           where society_id = $1
             and paid_paise + waived_paise > total_paise`,
          [societyId],
        )
      ).rows,
      overAllocated: (
        await client.query(
          `select payment.id from public.billing_payments payment
           join public.billing_payment_allocations allocation
             on allocation.payment_id = payment.id
           where payment.society_id = $1
           group by payment.id
           having sum(allocation.amount_paise) > payment.amount_paise`,
          [societyId],
        )
      ).rows,
      unconfirmedAllocations: (
        await client.query(
          `select allocation.payment_id from public.billing_payment_allocations allocation
           join public.billing_payments payment on payment.id = allocation.payment_id
           where allocation.society_id = $1 and payment.status <> 'confirmed'`,
          [societyId],
        )
      ).rows,
      ledger: (
        await client.query(
          `with ledger as (
             select unit_id,
               sum(case when direction = 'debit' then amount_paise
                        else -amount_paise end) as balance
             from public.billing_ledger_entries
             where society_id = $1
             group by unit_id
           ),
           expected as (
             select unit.id as unit_id,
               coalesce((select sum(total_paise) from public.billing_bills
                 where unit_id = unit.id), 0)
               - coalesce((select sum(amount_paise) from public.billing_payments
                 where unit_id = unit.id and status = 'confirmed'), 0)
               - coalesce((select sum(waived_paise) from public.billing_bills
                 where unit_id = unit.id), 0)
               + coalesce((select sum(case when direction = 'debit'
                   then amount_paise else -amount_paise end)
                 from public.billing_ledger_entries
                 where unit_id = unit.id and kind = 'adjustment'), 0)
               as balance
             from public.units unit where unit.society_id = $1
           )
           select expected.unit_id from expected
           left join ledger using (unit_id)
           where coalesce(ledger.balance, 0) <> expected.balance`,
          [societyId],
        )
      ).rows,
    }));
    expect(violations).toEqual({
      paidVsAllocations: [],
      totalVsLines: [],
      overSettled: [],
      overAllocated: [],
      unconfirmedAllocations: [],
      ledger: [],
    });
  });
});
