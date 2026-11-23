// Verify simple-interest day counts, mode gates and immutable monthly bills.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('database billing interest', () => {
  let database: TestDatabase;
  let societyId: string;
  let adminId: string;
  let residentId: string;
  let unitId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      adminId = await newAuthUser(client, 'interest-admin@example.test');
      residentId = await newAuthUser(client, 'interest-resident@example.test');
      for (const [id, email, name] of [
        [adminId, 'interest-admin@example.test', 'Interest Admin'],
        [residentId, 'interest-resident@example.test', 'Interest Resident'],
      ]) {
        await client.query(
          'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
          [id, email, name],
        );
      }
      societyId = (
        await client.query<{ id: string }>(
          "insert into public.societies(name,created_by) values('Interest Society',$1) returning id",
          [adminId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,'core',true,'{}'),($1,'billing',true,'{\"grace_days\":5}')`,
        [societyId],
      );
      const residentMembership = (
        await client.query<{ id: string }>(
          "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,'{resident}','active') returning id",
          [societyId, residentId],
        )
      ).rows[0]!.id;
      await client.query(
        "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,'{admin}','active')",
        [societyId, adminId],
      );
      unitId = (
        await client.query<{ id: string }>(
          "insert into public.units(society_id,number,created_by) values($1,'I-1',$2) returning id",
          [societyId, adminId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.unit_occupants(
           society_id,unit_id,membership_id,relationship,is_primary,status,created_by
         ) values($1,$2,$3,'owner',true,'active',$4)`,
        [societyId, unitId, residentMembership, adminId],
      );
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('requires acknowledgement before changing modes and rate history', async () => {
    const denied = await dbError(
      database.asRole('authenticated', { sub: adminId }, (client) =>
        client.query(
          `select public.billing_interest_rate_save(
               $1,'interest',1200,current_date + 1,$2,'rate-save'
             )`,
          [societyId, crypto.randomUUID()],
        ),
      ),
    );
    expect(denied.code).toBe('42501');
    await database.asRole(
      'authenticated',
      { sub: adminId },
      (client) =>
        client.query('select public.billing_interest_acknowledge($1,$2)', [
          societyId,
          'interest-ack',
        ]),
      { commit: true },
    );
    const saved = await database.asRole(
      'authenticated',
      { sub: adminId },
      (client) =>
        client.query(
          `select public.billing_interest_rate_save(
             $1,'interest',1200,current_date + 1,$2,'rate-save'
           ) as id`,
          [societyId, crypto.randomUUID()],
        ),
      { commit: true },
    );
    expect(saved.rows[0]!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('charges one rounded prior-month bill and never recalculates it', async () => {
    await database.asSuperuser(async (client) => {
      await client.query('begin');
      await client.query(
        `insert into public.billing_interest_rates(
           society_id,mode,rate_basis_points,effective_on,
           client_request_id,created_by
         ) values($1,'interest',1200,'2026-10-01',$2,$3)
         on conflict do nothing`,
        [societyId, crypto.randomUUID(), adminId],
      );
      await client.query(
        `insert into public.billing_bills(
           society_id,unit_id,kind,title,period_start,due_date,
           total_paise,paid_paise,created_by
         ) values($1,$2,'regular','October charges','2026-10-01','2026-10-10',
           10000,2000,$3)`,
        [societyId, unitId, adminId],
      );
      await client.query(
        `insert into public.billing_bills(
           society_id,unit_id,kind,title,period_start,due_date,total_paise,created_by
         ) values($1,$2,'fine','Excluded fine','2026-10-01','2026-10-10',5000,$3)`,
        [societyId, unitId, adminId],
      );
      await client.query('commit');
    });
    const run = () =>
      database.asRole(
        'service_role',
        null,
        (client) =>
          client.query<{
            result: { charged_count: number; total_paise: string };
          }>(
            "select public.billing_interest_run($1,'2026-11-02',$2) as result",
            [societyId, 'interest-run'],
          ),
        { commit: true },
      );
    const first = await run();
    expect(first.rows[0]!.result).toEqual({
      charged_count: 1,
      total_paise: '42',
    });
    const second = await run();
    expect(second.rows[0]!.result).toEqual({
      charged_count: 0,
      total_paise: '0',
    });
    const bill = await database.asSuperuser((client) =>
      client.query<{ id: string; total_paise: number; kind: string }>(
        `select id,total_paise,kind from public.billing_bills
         where society_id=$1 and unit_id=$2 and kind='interest'`,
        [societyId, unitId],
      ),
    );
    expect(bill.rows[0]).toMatchObject({
      kind: 'interest',
      total_paise: '42',
    });
    await database.asSuperuser(async (client) => {
      await client.query('begin');
      await client.query(
        "select set_config('homeish.billing_mutation','on',true)",
      );
      await client.query(
        `update public.billing_bills set paid_paise=total_paise
         where society_id=$1 and kind='regular'`,
        [societyId],
      );
      await client.query('commit');
    });
    await run();
    const unchanged = await database.asSuperuser((client) =>
      client.query<{ total_paise: number }>(
        'select total_paise from public.billing_bills where id=$1',
        [bill.rows[0]!.id],
      ),
    );
    expect(unchanged.rows[0]!.total_paise).toBe('42');
    const lateFees = await database.asRole(
      'service_role',
      null,
      (client) =>
        client.query<{ result: { charged_count: number } }>(
          "select public.billing_late_fees_run($1,'2026-11-02',$2) as result",
          [societyId, 'late-fee-mode-check'],
        ),
      { commit: true },
    );
    expect(lateFees.rows[0]!.result.charged_count).toBe(0);
  });
});
