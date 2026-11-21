import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type UserIds = Record<'admin' | 'committee' | 'resident' | 'guard', string>;

describe.skipIf(!hasDatabase)('database billing bills and ledger', () => {
  let database: TestDatabase;
  let societyId: string;
  let unitId: string;
  let residentMembershipId: string;
  let configUpdatedAt: string;
  let users: UserIds;
  let fixedChargeId: string;
  let areaChargeId: string;
  let customChargeId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      users = {} as UserIds;
      for (const role of ['admin', 'committee', 'resident', 'guard'] as const) {
        const id = await newAuthUser(
          client,
          `billing-bills-${role}@example.test`,
        );
        users[role] = id;
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, $2, $3)`,
          [id, `billing-bills-${role}@example.test`, `Billing ${role}`],
        );
      }
      societyId = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Billing Bills Society', $1) returning id`,
          [users.admin],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         values ($1, 'core', true, '{}'), ($1, 'billing', true, '{}')`,
        [societyId],
      );
      for (const role of Object.keys(users) as (keyof UserIds)[]) {
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
             (society_id, number, area_sqft, created_by, updated_by)
           values ($1, 'A-1', 1.50, $2, $2) returning id`,
          [societyId, users.admin],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.unit_occupants
           (society_id, unit_id, membership_id, relationship, is_primary, status, created_by)
         values ($1, $2, $3, 'owner', true, 'active', $4)`,
        [societyId, unitId, residentMembershipId, users.admin],
      );
      configUpdatedAt = (
        await client.query<{ updated_at: string }>(
          `select updated_at::text as updated_at from public.module_configs
           where society_id = $1 and module_key = 'billing'`,
          [societyId],
        )
      ).rows[0]!.updated_at;
    });
    fixedChargeId = (await saveCharge('Monthly', 'fixed', 5000)).id;
    areaChargeId = (await saveCharge('Area rate', 'per_sqft', 100)).id;
    customChargeId = (await saveCharge('Water', 'custom', null)).id;
  });

  afterAll(async () => {
    await database?.drop();
  });

  async function saveCharge(
    name: string,
    method: string,
    amount: number | null,
    eligibility = 'all',
    baseId?: string,
    basisPoints?: number,
  ) {
    return database.asRole(
      'authenticated',
      { sub: users.admin },
      async (client) => {
        const result = await client.query<{ charge: { id: string } }>(
          `select to_jsonb(charge) as charge
           from public.billing_charge_save(
             $1, null, $2, $3, $4, true, null, 'billing-bills-charge', $5, $6, $7
           ) charge`,
          [
            societyId,
            name,
            method,
            amount,
            baseId ?? null,
            basisPoints ?? null,
            eligibility,
          ],
        );
        return result.rows[0]!.charge;
      },
      { commit: true },
    );
  }

  it('uses the confirmed tenant move-in date and skips percentages rounding to zero', async () => {
    const tenantUnit = await database.asSuperuser(async (client) => {
      const {
        rows: [unit],
      } = await client.query<{ id: string }>(
        `insert into public.units (society_id, number, created_by)
         values ($1, 'P37-tenant', $2) returning id`,
        [societyId, users.admin],
      );
      const {
        rows: [occupant],
      } = await client.query<{ id: string }>(
        `insert into public.unit_occupants
           (society_id, unit_id, membership_id, relationship, status, started_at, created_by)
         values ($1, $2, $3, 'tenant', 'active', '2020-04-28', $4) returning id`,
        [societyId, unit!.id, residentMembershipId, users.admin],
      );
      return { id: unit!.id, occupantId: occupant!.id };
    });
    const base = await saveCharge(
      'P37 Tenant maintenance',
      'fixed',
      10_000,
      'tenant',
    );
    const percent = await saveCharge(
      'P37 Tenant surcharge',
      'percent_of_charge',
      null,
      'all',
      base.id,
      1000,
    );
    async function tenantPreview(period: string, charges: string[]) {
      return database.asRole(
        'authenticated',
        { sub: users.admin },
        async (client) => {
          const {
            rows: [row],
          } = await client.query<{ data: unknown }>(
            `select public.billing_bills_preview($1, $2, array[$3]::uuid[], $4, '[]') as data`,
            [societyId, period, tenantUnit.id, charges],
          );
          return row!.data;
        },
      );
    }

    await expect(
      tenantPreview('2020-05-01', [percent.id, base.id]),
    ).rejects.toMatchObject({
      code: '22023',
      hint: 'tenant_move_in_unconfirmed',
    });
    await expect(
      tenantPreview('9999-05-01', [percent.id, base.id]),
    ).rejects.toMatchObject({
      code: '22023',
      hint: 'occupancy_period_not_started',
    });
    await expect(
      database.asRole('authenticated', { sub: users.committee }, (client) =>
        client.query(
          `select public.billing_confirm_tenant_move_in($1, $2, '2020-05-03', 'p37-move')`,
          [societyId, tenantUnit.occupantId],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query(
          `select public.billing_confirm_tenant_move_in($1, $2, '2020-05-03', 'p37-move')`,
          [societyId, tenantUnit.occupantId],
        ),
      { commit: true },
    );
    const may = await tenantPreview('2020-05-01', [percent.id, base.id]);
    expect(may).toMatchObject({
      lines: [],
      skipped: expect.arrayContaining([
        expect.objectContaining({
          charge_type_id: base.id,
          reason: 'not_eligible',
        }),
        expect.objectContaining({
          charge_type_id: percent.id,
          reason: 'not_applicable',
        }),
      ]),
    });
    const tiny = await saveCharge(
      'P37 Tiny surcharge',
      'percent_of_charge',
      null,
      'all',
      base.id,
      1,
    );
    const june = await tenantPreview('2020-06-01', [
      percent.id,
      tiny.id,
      base.id,
    ]);
    expect(june).toEqual(
      await tenantPreview('2020-06-01', [base.id, tiny.id, percent.id]),
    );
    expect(june).toMatchObject({
      new_total_paise: '11000',
      lines: expect.arrayContaining([
        expect.objectContaining({
          charge_type_id: percent.id,
          amount_paise: 1000,
        }),
      ]),
      skipped: [
        expect.objectContaining({
          charge_type_id: tiny.id,
          reason: 'rounds_to_zero',
        }),
      ],
    });
  });

  it('lets committee estimate configured charges without creating bills or ledger entries', async () => {
    const counts = () =>
      database.asSuperuser(
        async (client) =>
          (
            await client.query(
              `select (select count(*) from public.billing_bills where society_id = $1) as bills,
                (select count(*) from public.billing_ledger_entries where society_id = $1) as ledger,
                (select count(*) from public.units where society_id = $1) as units`,
              [societyId],
            )
          ).rows[0],
      );
    const before = await counts();
    const estimate = (role: keyof UserIds) =>
      database.asRole(
        'authenticated',
        { sub: users[role] },
        async (client) =>
          (
            await client.query<{ result: unknown }>(
              `select public.billing_estimate($1, 1500, 'vacant', '[]') as result`,
              [societyId],
            )
          ).rows[0]!.result,
        { commit: true },
      );
    expect(await estimate('committee')).toMatchObject({
      total_paise: '155000',
      skipped: expect.arrayContaining([
        expect.objectContaining({
          charge_type_id: customChargeId,
          reason: 'no_amount',
        }),
      ]),
    });
    await expect(estimate('resident')).rejects.toMatchObject({ code: '42501' });
    expect(await counts()).toEqual(before);
  });

  async function updateSettings() {
    return database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query<{ settings: Record<string, unknown>; updated_at: string }>(
          `select result->'settings' as settings,
                  result->>'updated_at' as updated_at
           from (select public.billing_settings_update(
             $1, 'last_day', 'rupee', $2, 'billing-settings-test'
           ) as result) saved`,
          [societyId, configUpdatedAt],
        ),
      { commit: true },
    );
  }

  async function preview() {
    return database.asRole('authenticated', { sub: users.admin }, (client) =>
      client.query<{ preview: Record<string, unknown> }>(
        `select public.billing_bills_preview(
            $1, '2027-02-01', $2::uuid[], $3::uuid[],
            jsonb_build_array(jsonb_build_object(
              'unit_id', $4::text,
              'charge_type_id', $5::text,
              'amount_paise', 9876
            ))
          ) as preview`,
        [
          societyId,
          [unitId],
          [fixedChargeId, areaChargeId, customChargeId],
          unitId,
          customChargeId,
        ],
      ),
    );
  }

  it('lets the admin set society due-day and rupee rounding preferences', async () => {
    const result = await updateSettings();
    expect(result.rows[0]?.settings).toMatchObject({
      due_day_of_month: 'last_day',
      rounding: 'rupee',
    });
    expect(result.rows[0]?.updated_at).not.toBe(configUpdatedAt);
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: users.committee }, (client) =>
            client.query(
              `select public.billing_settings_update(
                  $1, '5', 'paise', $2, 'billing-settings-forbidden'
                )`,
              [societyId, result.rows[0]?.updated_at],
            ),
          ),
        )
      ).code,
    ).toBe('42501');
  });

  it('previews exact per-square-foot rounding and the last day of a short month', async () => {
    const value = (await preview()).rows[0]?.preview;
    expect(value).toMatchObject({
      period_start: '2027-02-01',
      due_date: '2027-02-28',
      unit_count: 1,
      line_count: 3,
      new_line_count: 3,
      new_total_paise: '15076',
    });
    const lines = value?.lines as {
      charge_type_id: string;
      amount_paise: number;
    }[];
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          charge_type_id: fixedChargeId,
          amount_paise: 5000,
        }),
        expect.objectContaining({
          charge_type_id: areaChargeId,
          amount_paise: 200,
        }),
        expect.objectContaining({
          charge_type_id: customChargeId,
          amount_paise: 9876,
        }),
      ]),
    );
    expect(value?.preview_hash).toMatch(/^[a-f0-9]{32}$/);
  });

  it('generates immutable bills, an append-only ledger and idempotent jobs', async () => {
    const firstPreview = (await preview()).rows[0]!.preview;
    const hash = firstPreview.preview_hash as string;
    const generated = await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query<{ result: Record<string, unknown> }>(
          `select public.billing_bills_generate(
            $1, '2027-02-01', $2::uuid[], $3::uuid[],
            jsonb_build_array(jsonb_build_object(
              'unit_id', $4::text,
              'charge_type_id', $5::text,
              'amount_paise', 9876
            )), $6, 'billing-generate-test'
          ) as result`,
          [
            societyId,
            [unitId],
            [fixedChargeId, areaChargeId, customChargeId],
            unitId,
            customChargeId,
            hash,
          ],
        ),
      { commit: true },
    );
    expect(generated.rows[0]?.result).toMatchObject({
      generated_bill_count: 1,
      generated_line_count: 3,
      already_generated_count: 0,
      total_paise: '15076',
    });
    const bill = await database.asRole(
      'authenticated',
      { sub: users.resident },
      async (client) => {
        const list = await client.query<{ bills: Record<string, unknown>[] }>(
          'select public.billing_bills_list($1, 10, 0) as bills',
          [societyId],
        );
        expect(list.rows[0]?.bills).toHaveLength(1);
        const billId = list.rows[0]?.bills[0]?.id;
        const details = await client.query<{ bill: Record<string, unknown> }>(
          'select public.billing_bill_get($1, $2) as bill',
          [societyId, billId],
        );
        return { billId, details: details.rows[0]?.bill };
      },
    );
    expect(bill.details).toMatchObject({
      total_paise: 15076,
      status: 'due',
      outstanding_paise: 15076,
    });
    expect(bill.details?.lines).toHaveLength(3);
    const ledger = await database.asRole(
      'authenticated',
      { sub: users.resident },
      (client) =>
        client.query<{ entries: Record<string, unknown>[] }>(
          'select public.billing_ledger_get($1, $2) as entries',
          [societyId, unitId],
        ),
    );
    expect(ledger.rows[0]?.entries).toHaveLength(1);
    expect(ledger.rows[0]?.entries[0]).toMatchObject({
      kind: 'bill',
      direction: 'debit',
      amount_paise: 15076,
      balance_paise: '15076',
    });
    const refreshedPreview = (await preview()).rows[0]!.preview;
    expect(refreshedPreview).toMatchObject({
      new_line_count: 0,
      new_total_paise: '0',
    });
    const rerun = await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query<{ result: Record<string, unknown> }>(
          `select public.billing_bills_generate(
            $1, '2027-02-01', $2::uuid[], $3::uuid[],
            jsonb_build_array(jsonb_build_object(
              'unit_id', $4::text,
              'charge_type_id', $5::text,
              'amount_paise', 9876
            )), $6, 'billing-generate-rerun'
          ) as result`,
          [
            societyId,
            [unitId],
            [fixedChargeId, areaChargeId, customChargeId],
            unitId,
            customChargeId,
            refreshedPreview.preview_hash,
          ],
        ),
      { commit: true },
    );
    expect(rerun.rows[0]?.result).toMatchObject({
      generated_bill_count: 0,
      generated_line_count: 0,
      already_generated_count: 3,
      total_paise: '0',
    });
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: users.guard }, (client) =>
            client.query('select public.billing_bill_get($1, $2)', [
              societyId,
              bill.billId,
            ]),
          ),
        )
      ).code,
    ).toBe('42501');
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: users.resident }, (client) =>
            client.query(
              'update public.billing_bills set title = $1 where id = $2',
              ['Changed', bill.billId],
            ),
          ),
        )
      ).code,
    ).toBe('42501');
  });
});
