import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type Role = 'admin' | 'committee' | 'resident' | 'foreignAdmin';

describe.skipIf(!hasDatabase)('database billing arrears trackers', () => {
  let database: TestDatabase;
  let societyId: string;
  let foreignSocietyId: string;
  let unitA: string;
  let unitB: string;
  let users: Record<Role, string>;
  let billA: string;
  let billB: string;
  let today: string;
  let yesterday: string;
  let period: string;

  const as = <T>(
    role: Role,
    fn: (client: Client) => Promise<T>,
    commit = true,
  ) => database.asRole('authenticated', { sub: users[role] }, fn, { commit });

  async function one<T>(client: Client, sql: string, args: unknown[]) {
    const result = await client.query<{ result: T }>(sql, args);
    return result.rows[0]!.result;
  }

  async function savePlan(
    client: Client,
    planId: string | null,
    billIds: string[],
    downPaymentPaise: number,
    installmentCount: number,
    requestId = randomUUID(),
  ) {
    return one<{ id: string }>(
      client,
      `select public.billing_payment_plan_save(
        $1, $2, $3::uuid[], $4, $5, $6::date, null, $7
      ) as result`,
      [
        societyId,
        planId,
        billIds,
        downPaymentPaise,
        installmentCount,
        today,
        requestId,
      ],
    );
  }

  async function recordPayment(
    amountPaise: number,
    paidOn = today,
    unitId = unitA,
    clientRequestId = randomUUID(),
  ) {
    return as('admin', (client) =>
      one<Record<string, unknown>>(
        client,
        `select public.billing_payment_record(
          $1, $2, $3, 'cash', null, $4::date, $5, $6
        ) as result`,
        [societyId, unitId, amountPaise, paidOn, clientRequestId, randomUUID()],
      ),
    );
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      users = {} as Record<Role, string>;
      for (const role of [
        'admin',
        'committee',
        'resident',
        'foreignAdmin',
      ] as const) {
        const email = `billing-arrears-${role}@example.test`;
        const id = await newAuthUser(client, email);
        users[role] = id;
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, $2, $3)`,
          [id, email, `Arrears ${role}`],
        );
      }
      societyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by, timezone)
           values ('Billing Arrears Society', $1, 'UTC') returning id`,
          [users.admin],
        )
      ).rows[0]!.id;
      foreignSocietyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by, timezone)
           values ('Other Billing Society', $1, 'UTC') returning id`,
          [users.foreignAdmin],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         values ($1, 'core', true, '{}'),
           ($1, 'billing', true, '{"due_day_of_month":10,"rounding":"paise"}'),
           ($2, 'core', true, '{}'),
           ($2, 'billing', true, '{}')`,
        [societyId, foreignSocietyId],
      );
      for (const role of ['admin', 'committee', 'resident'] as const) {
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY[$3]::text[], 'active')`,
          [societyId, users[role], role],
        );
      }
      await client.query(
        `insert into public.memberships (society_id, user_id, roles, status)
         values ($1, $2, ARRAY['admin']::text[], 'active')`,
        [foreignSocietyId, users.foreignAdmin],
      );
      const units = await client.query<{ id: string; number: string }>(
        `insert into public.units (society_id, number, created_by, updated_by)
         values ($1, 'A-1', $2, $2), ($1, 'B-1', $2, $2)
         returning id, number`,
        [societyId, users.admin],
      );
      unitA = units.rows.find((row) => row.number === 'A-1')!.id;
      unitB = units.rows.find((row) => row.number === 'B-1')!.id;
      const dates = await client.query<{
        period: string;
        today: string;
        yesterday: string;
      }>(
        `select to_char(date_trunc('month', current_date) - interval '2 months',
           'YYYY-MM-DD') as period,
         to_char(current_date, 'YYYY-MM-DD') as today,
         to_char(current_date - 1, 'YYYY-MM-DD') as yesterday`,
      );
      period = dates.rows[0]!.period;
      today = dates.rows[0]!.today;
      yesterday = dates.rows[0]!.yesterday;
    });

    const chargeId = await as('admin', (client) =>
      one<string>(
        client,
        `select (public.billing_charge_save(
          $1, null, 'Monthly', 'fixed', 10000, true, null, 'arrears-charge'
        )).id as result`,
        [societyId],
      ),
    );
    const preview = await as(
      'admin',
      (client) =>
        one<{ preview_hash: string }>(
          client,
          `select public.billing_bills_preview(
            $1, $2::date, $3::uuid[], $4::uuid[], '[]'::jsonb
          ) as result`,
          [societyId, period, [unitA, unitB], [chargeId]],
        ),
      false,
    );
    await as('admin', (client) =>
      client.query(
        `select public.billing_bills_generate(
          $1, $2::date, $3::uuid[], $4::uuid[], '[]'::jsonb, $5, 'arrears-generate'
        )`,
        [societyId, period, [unitA, unitB], [chargeId], preview.preview_hash],
      ),
    );
    await database.asSuperuser(async (client) => {
      const bills = await client.query<{ id: string; unit_id: string }>(
        `select id, unit_id from public.billing_bills where society_id = $1`,
        [societyId],
      );
      billA = bills.rows.find((row) => row.unit_id === unitA)!.id;
      billB = bills.rows.find((row) => row.unit_id === unitB)!.id;
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('enforces plan history and derives reports from confirmed allocations only', async () => {
    await recordPayment(1000);
    const ledgerBefore = await database.asSuperuser(async (client) => {
      const result = await client.query<{ count: string; paid: string }>(
        `select count(*) as count,
          (select paid_paise from public.billing_bills where id = $2) as paid
         from public.billing_ledger_entries where society_id = $1`,
        [societyId, billA],
      );
      return result.rows[0]!;
    });

    const firstPlan = await as('admin', (client) =>
      savePlan(client, null, [billA], 2000, 2),
    );
    expect(firstPlan.id).toBeTruthy();

    const overlap = await dbError(
      as('admin', (client) => savePlan(client, null, [billA], 1000, 2)),
    );
    expect(overlap.code).toBe('23505');

    const changedBills = await dbError(
      as('admin', (client) => savePlan(client, firstPlan.id, [billB], 2000, 2)),
    );
    expect(changedBills.code).toBe('23514');

    await as('admin', (client) =>
      savePlan(client, firstPlan.id, [billA], 3000, 3),
    );
    const missingCancelReason = await dbError(
      as('admin', (client) =>
        one(
          client,
          `select public.billing_payment_plan_cancel($1, $2, ' ', 'cancel-empty')`,
          [societyId, firstPlan.id],
        ),
      ),
    );
    expect(missingCancelReason.code).toBe('22023');

    await as('admin', (client) =>
      one(
        client,
        `select public.billing_payment_plan_cancel(
          $1, $2, 'Replace selected bills', 'cancel-first'
        ) as result`,
        [societyId, firstPlan.id],
      ),
    );
    const replacement = await as('admin', (client) =>
      savePlan(client, null, [billA], 2000, 2),
    );

    const ledgerAfterPlans = await database.asSuperuser(async (client) => {
      const result = await client.query<{ count: string; paid: string }>(
        `select count(*) as count,
          (select paid_paise from public.billing_bills where id = $2) as paid
         from public.billing_ledger_entries where society_id = $1`,
        [societyId, billA],
      );
      return result.rows[0]!;
    });
    expect(ledgerAfterPlans).toEqual(ledgerBefore);

    await recordPayment(1000);
    await recordPayment(9000);
    await as('admin', (client) =>
      one(
        client,
        `select public.billing_bill_waive(
          $1, $2, 500, 'Committee approved', false, 'arrears-waive'
        ) as result`,
        [societyId, billB],
      ),
    );
    await recordPayment(500, yesterday, unitB);

    const plans = await as('committee', (client) =>
      one<
        Array<{
          id: string;
          status: string;
          total_paise: number;
          progress_paise: number;
          down_payment_paid_paise: number;
          installments_paid_paise: number;
        }>
      >(client, `select public.billing_payment_plans_list($1) as result`, [
        societyId,
      ]),
    );
    expect(plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstPlan.id,
          status: 'cancelled',
          progress_paise: 0,
        }),
        expect.objectContaining({
          id: replacement.id,
          status: 'active',
          total_paise: 9000,
          progress_paise: 9000,
          down_payment_paid_paise: 2000,
          installments_paid_paise: 7000,
        }),
      ]),
    );

    const oldReport = await as('committee', (client) =>
      one<Record<string, unknown>>(
        client,
        `select public.billing_collection_efficiency($1, $2::date) as result`,
        [societyId, yesterday],
      ),
    );
    expect(oldReport).toMatchObject({
      as_of_date: yesterday,
      billed_paise: '20000',
      collected_paise: '0',
    });
    const currentReport = await as('committee', (client) =>
      one<Record<string, unknown>>(
        client,
        `select public.billing_collection_efficiency($1, $2::date) as result`,
        [societyId, today],
      ),
    );
    expect(currentReport).toMatchObject({
      as_of_date: today,
      billed_paise: '19500',
      collected_paise: '10500',
      collection_percent: 53.8,
    });

    const deniedList = await dbError(
      as(
        'resident',
        (client) =>
          one(
            client,
            `select public.billing_payment_plans_list($1) as result`,
            [societyId],
          ),
        false,
      ),
    );
    expect(deniedList.code).toBe('42501');
    const deniedWrite = await dbError(
      as(
        'committee',
        (client) => savePlan(client, null, [billB], 1000, 2),
        false,
      ),
    );
    expect(deniedWrite.code).toBe('42501');
    const crossSociety = await dbError(
      as(
        'foreignAdmin',
        (client) =>
          one(
            client,
            `select public.billing_collection_efficiency($1, $2::date) as result`,
            [societyId, today],
          ),
        false,
      ),
    );
    expect(crossSociety.code).toBe('42501');

    const notificationsBeforeRecovery = await database.asSuperuser(
      async (client) => {
        const result = await client.query<{ count: string }>(
          `select count(*)::text as count
           from public.notifications where society_id = $1`,
          [societyId],
        );
        return result.rows[0]!.count;
      },
    );
    const actionId = await as('admin', (client) =>
      one<{ id: string; status: string }>(
        client,
        `select public.billing_recovery_action_save(
          $1, null, $2, $3::date, 'phone_call', 'follow_up_needed',
          $3::date + 7, $4, 'open', 'recovery-create'
        ) as result`,
        [societyId, unitA, today, users.admin],
      ),
    );
    expect(actionId.status).toBe('open');
    const overdueAction = await as('admin', (client) =>
      one<{ id: string }>(
        client,
        `select public.billing_recovery_action_save(
          $1, null, $2, $3::date - 2, 'meeting', 'no_response',
          $3::date - 1, null, 'open', 'recovery-overdue'
        ) as result`,
        [societyId, unitA, today],
      ),
    );
    const scheduledAction = await as('admin', (client) =>
      one<{ id: string }>(
        client,
        `select public.billing_recovery_action_save(
          $1, null, $2, $3::date, 'meeting', 'reached',
          $3::date + 8, null, 'open', 'recovery-scheduled'
        ) as result`,
        [societyId, unitA, today],
      ),
    );
    const closedAction = await as('admin', (client) =>
      one<{ id: string }>(
        client,
        `select public.billing_recovery_action_save(
          $1, null, $2, $3::date, 'other_internal', 'resolved',
          $3::date - 1, null, 'closed', 'recovery-closed'
        ) as result`,
        [societyId, unitA, today],
      ),
    );
    const invalidAssignee = await dbError(
      as('admin', (client) =>
        one(
          client,
          `select public.billing_recovery_action_save(
            $1, null, $2, $3::date, 'meeting', 'reached',
            $3::date, $4, 'open', 'recovery-invalid-assignee'
          )`,
          [societyId, unitA, today, users.resident],
        ),
      ),
    );
    expect(invalidAssignee.code).toBe('23514');
    const recovery = await as('committee', (client) =>
      one<{
        actions: Array<{
          id: string;
          follow_up_state: string;
          assigned_admin_name: string;
        }>;
        admins: Array<{ id: string; name: string }>;
      }>(client, `select public.billing_recovery_actions_list($1) as result`, [
        societyId,
      ]),
    );
    expect(recovery.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: actionId.id,
          follow_up_state: 'due_soon',
          assigned_admin_name: 'Arrears admin',
        }),
        expect.objectContaining({
          id: overdueAction.id,
          follow_up_state: 'overdue',
        }),
        expect.objectContaining({
          id: scheduledAction.id,
          follow_up_state: 'scheduled',
        }),
        expect.objectContaining({
          id: closedAction.id,
          follow_up_state: 'closed',
        }),
      ]),
    );
    expect(recovery.admins).toEqual([
      { id: users.admin, name: 'Arrears admin' },
    ]);
    const notificationsAfterRecovery = await database.asSuperuser(
      async (client) => {
        const result = await client.query<{ count: string }>(
          `select count(*)::text as count
           from public.notifications where society_id = $1`,
          [societyId],
        );
        return result.rows[0]!.count;
      },
    );
    expect(notificationsAfterRecovery).toBe(notificationsBeforeRecovery);
    const deleteRecoveryHistory = await dbError(
      as('admin', (client) =>
        client.query(
          `delete from public.billing_recovery_actions where id = $1`,
          [actionId.id],
        ),
      ),
    );
    expect(deleteRecoveryHistory.code).toBe('42501');
    const deniedRecoveryWrite = await dbError(
      as(
        'committee',
        (client) =>
          one(
            client,
            `select public.billing_recovery_action_save(
              $1, null, $2, $3::date, 'meeting', 'reached',
              $3::date, null, 'open', 'recovery-denied'
            )`,
            [societyId, unitA, today],
          ),
        false,
      ),
    );
    expect(deniedRecoveryWrite.code).toBe('42501');

    const suspensionPlan = await as('admin', (client) =>
      savePlan(client, null, [billB], 0, 1),
    );
    await database.asSuperuser((client) =>
      client.query(
        `update public.societies set status = 'suspended' where id = $1`,
        [societyId],
      ),
    );
    await expect(
      as('committee', (client) =>
        one<Array<{ id: string }>>(
          client,
          `select public.billing_payment_plans_list($1) as result`,
          [societyId],
        ),
      ),
    ).resolves.toHaveLength(3);
    await expect(
      as('admin', (client) =>
        one<Array<{ id: string }>>(
          client,
          `select public.billing_payment_plan_open_bills($1) as result`,
          [societyId],
        ),
      ),
    ).resolves.toEqual([]);
    const suspendedWrite = await dbError(
      as('admin', (client) =>
        one(
          client,
          `select public.billing_payment_plan_cancel(
            $1, $2, 'Suspended society check', 'suspended-cancel'
          )`,
          [societyId, suspensionPlan.id],
        ),
      ),
    );
    expect(suspendedWrite.code).toBe('42501');
  });
});
