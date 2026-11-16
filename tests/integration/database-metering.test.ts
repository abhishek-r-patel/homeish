// Verify metering privacy, reading review, lower-reading resets, exact once-only utility billing and photo cleanup.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';
import {
  meteringAdminWorkspaceSchema,
  meteringBillingResultSchema,
  meteringGuardBoardSchema,
  meteringResidentWorkspaceSchema,
} from '../../src/core/metering/validation';

const ACTORS = [
  'admin',
  'committee',
  'guard',
  'owner',
  'tenant',
  'otherResident',
  'foreignAdmin',
] as const;
type Actor = (typeof ACTORS)[number];

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

describe.skipIf(!hasDatabase)('metering database contracts', () => {
  let database: TestDatabase;
  const users = new Map<Actor, string>();
  let society = '';
  let foreignSociety = '';
  let today = '';
  const units = new Map<string, string>();

  const user = (actor: Actor) => {
    const id = users.get(actor);
    if (!id) throw new Error(`Missing synthetic ${actor}.`);
    return id;
  };
  const unit = (number: string) => {
    const id = units.get(number);
    if (!id) throw new Error(`Missing synthetic unit ${number}.`);
    return id;
  };
  const asActor = <T>(actor: Actor, run: (client: Client) => Promise<T>) =>
    database.asRole('authenticated', { sub: user(actor) }, run, {
      commit: true,
    });
  const call = async (actor: Actor, name: string, args: unknown[]) => {
    const placeholders = args.map((_, index) => `$${index + 1}`).join(',');
    const result = await asActor(actor, (client) =>
      client.query<{ value: unknown }>(
        `select public.${name}(${placeholders}) as value`,
        args,
      ),
    );
    return result.rows[0]?.value;
  };
  const setModule = (moduleKey: string, enabled: boolean) =>
    database.asSuperuser((client) =>
      client.query(
        'update public.module_configs set enabled=$3 where society_id=$1 and module_key=$2',
        [society, moduleKey, enabled],
      ),
    );
  const saveMeter = async (
    label: string,
    meterType: string,
    unitNumber: string | null,
    initial = '0',
    options: { actor?: Actor; targetSociety?: string } = {},
  ) =>
    (await call(options.actor ?? 'admin', 'metering_meter_save', [
      options.targetSociety ?? society,
      null,
      meterType,
      unitNumber ? 'unit' : 'common',
      unitNumber ? unit(unitNumber) : null,
      label,
      null,
      initial,
      true,
      null,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ])) as string;
  const setRate = (meterType: string, ratePaise: number) =>
    call('admin', 'metering_rate_set', [
      society,
      meterType,
      ratePaise,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ]);
  const record = async (
    meter: string,
    value: string,
    date: string,
    reason: string | null = null,
    actor: Actor = 'admin',
  ) =>
    (await call(actor, 'metering_reading_record', [
      society,
      meter,
      value,
      date,
      reason,
      null,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ])) as string;
  const uploadPhoto = async (actor: Actor, mimetype = 'image/jpeg') => {
    const path = (await call(actor, 'metering_photo_upload_path', [
      society,
      mimetype,
      2048,
    ])) as string;
    await asActor(actor, (client) =>
      client.query(
        `insert into storage.objects(bucket_id,name,metadata) values('metering-photos',$1,$2)`,
        [path, { mimetype, size: 2048 }],
      ),
    );
    return path;
  };
  const submit = async (
    actor: Actor,
    meter: string,
    value: string,
    date: string,
    photo: string | null,
    reason: string | null = null,
    requestId = crypto.randomUUID(),
  ) =>
    (await call(actor, 'metering_reading_submit', [
      society,
      meter,
      value,
      date,
      reason,
      photo,
      crypto.randomUUID(),
      requestId,
    ])) as string;
  const review = (
    reading: string,
    decision: 'approve' | 'reject',
    reason: string | null = null,
    requestId = crypto.randomUUID(),
  ) =>
    call('admin', 'metering_reading_review', [
      society,
      reading,
      decision,
      reason,
      requestId,
    ]);
  const billingRun = async (date = today) =>
    meteringBillingResultSchema.parse(
      await call('admin', 'metering_billing_run', [
        society,
        date,
        crypto.randomUUID(),
      ]),
    );
  const reading = (id: string) =>
    database.asSuperuser(
      async (client) =>
        (
          await client.query<{
            status: string;
            consumption: string | null;
            is_reset: boolean;
            previous_value: string | null;
          }>(
            'select status,consumption::text,is_reset,previous_value::text from public.metering_readings where id=$1',
            [id],
          )
        ).rows[0],
    );
  const charge = (readingId: string) =>
    database.asSuperuser(
      async (client) =>
        (
          await client.query<{
            status: string;
            rate_paise: number | null;
            amount_paise: string | null;
            billed_paise: string | null;
            bill_id: string | null;
          }>(
            'select status,rate_paise,amount_paise::text,billed_paise::text,bill_id from public.metering_charges where reading_id=$1',
            [readingId],
          )
        ).rows[0] ?? null,
    );
  const notifications = (requestId: string) =>
    database.asSuperuser(
      async (client) =>
        (
          await client.query<{
            user_id: string;
            entity_type: string;
            type: string;
          }>(
            'select user_id,entity_type,type from public.notifications where request_id=$1 order by user_id',
            [requestId],
          )
        ).rows,
    );
  const adminWorkspace = async (actor: Actor = 'admin') =>
    meteringAdminWorkspaceSchema.parse(
      await call(actor, 'metering_admin_workspace', [society]),
    );

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      for (const actor of ACTORS) {
        const email = `metering-${actor.toLowerCase()}@example.test`;
        const id = await newAuthUser(client, email);
        users.set(actor, id);
        await client.query(
          `insert into public.profiles(id,email,full_name) values($1,$2,$3)
           on conflict(id) do update set full_name=excluded.full_name`,
          [id, email, `Synthetic ${actor}`],
        );
      }
      society = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by) values('Metering A',$1) returning id`,
          [user('admin')],
        )
      ).rows[0]!.id;
      foreignSociety = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by) values('Metering B',$1) returning id`,
          [user('foreignAdmin')],
        )
      ).rows[0]!.id;
      const memberships = new Map<Actor, string>();
      for (const actor of ACTORS) {
        const role =
          actor === 'admin' || actor === 'foreignAdmin'
            ? 'admin'
            : actor === 'committee' || actor === 'guard'
              ? actor
              : 'resident';
        memberships.set(
          actor,
          (
            await client.query<{ id: string }>(
              `insert into public.memberships(society_id,user_id,roles,status)
               values($1,$2,array[$3]::text[],'active') returning id`,
              [
                actor === 'foreignAdmin' ? foreignSociety : society,
                user(actor),
                role,
              ],
            )
          ).rows[0]!.id,
        );
      }
      for (const row of (
        await client.query<{ id: string; number: string }>(
          `insert into public.units(society_id,number,created_by)
           values($1,'A-101',$2),($1,'B-201',$2),($1,'C-301',$2),($1,'D-401',$2) returning id,number`,
          [society, user('admin')],
        )
      ).rows) {
        units.set(row.number, row.id);
      }
      for (const [actor, number, relationship] of [
        ['owner', 'A-101', 'owner'],
        ['tenant', 'B-201', 'tenant'],
        ['otherResident', 'C-301', 'owner'],
      ] as const) {
        await client.query(
          `insert into public.unit_occupants
           (society_id,unit_id,membership_id,relationship,status,is_primary,is_approver,started_at,created_by)
           values($1,$2,$3,$4,'active',true,true,current_date-30,$5)`,
          [
            society,
            unit(number),
            memberships.get(actor),
            relationship,
            user('admin'),
          ],
        );
      }
      await client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,'core',true,'{}'),($1,'metering',true,'{}'),($1,'billing',false,'{"rounding":"paise"}'),
           ($2,'core',true,'{}'),($2,'metering',true,'{}')`,
        [society, foreignSociety],
      );
    });
    today = (await adminWorkspace()).today;
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps tables private and isolates societies', async () => {
    const own = await saveMeter('ISO-1', 'water', 'A-101');
    const foreign = await saveMeter('ISO-F', 'water', null, '0', {
      actor: 'foreignAdmin',
      targetSociety: foreignSociety,
    });
    for (const table of [
      'metering_meters',
      'metering_rates',
      'metering_readings',
      'metering_charges',
    ]) {
      expect(
        (
          await dbError(
            asActor('admin', (client) =>
              client.query(`select * from public.${table}`),
            ),
          )
        ).code,
      ).toBe('42501');
    }
    expect(
      (
        await dbError(
          call('foreignAdmin', 'metering_admin_workspace', [society]),
        )
      ).code,
    ).toBe('42501');
    expect((await dbError(record(foreign, '5', today))).code).toBe('P0002');
    const workspace = await adminWorkspace();
    expect(workspace.meters.map((meter) => meter.id)).toContain(own);
    expect(workspace.meters.map((meter) => meter.id)).not.toContain(foreign);
  });

  it('enforces the role matrix and the module switch', async () => {
    const meter = await saveMeter('ROLE-1', 'electricity', 'A-101');
    expect(
      (
        await dbError(
          saveMeter('X', 'water', null, '0', { actor: 'committee' }),
        )
      ).code,
    ).toBe('42501');
    expect(
      (await dbError(record(meter, '1', today, null, 'committee'))).code,
    ).toBe('42501');
    expect((await dbError(record(meter, '1', today, null, 'owner'))).code).toBe(
      '42501',
    );
    expect((await adminWorkspace('committee')).can_manage).toBe(false);
    expect(
      (await dbError(call('guard', 'metering_admin_workspace', [society])))
        .code,
    ).toBe('42501');
    expect(
      (await dbError(call('guard', 'metering_resident_workspace', [society])))
        .code,
    ).toBe('42501');
    expect(
      (await dbError(call('owner', 'metering_guard_board', [society, null])))
        .code,
    ).toBe('42501');
    expect((await dbError(submit('guard', meter, '1', today, null))).code).toBe(
      '42501',
    );
    const guardReading = await record(meter, '2.5', today, null, 'guard');
    expect(await reading(guardReading)).toMatchObject({
      status: 'approved',
      consumption: '2.500',
      is_reset: false,
    });
    const board = meteringGuardBoardSchema.parse(
      await call('guard', 'metering_guard_board', [society, 'a-101']),
    );
    expect(board.meters.map((item) => item.label)).toContain('ROLE-1');
    expect(board.recent[0]?.id).toBe(guardReading);
    await setModule('metering', false);
    try {
      expect(
        (await dbError(call('owner', 'metering_resident_workspace', [society])))
          .code,
      ).toBe('42501');
      expect((await dbError(record(meter, '3', today))).code).toBe('42501');
      expect(
        (await dbError(call('guard', 'metering_guard_board', [society, null])))
          .code,
      ).toBe('42501');
    } finally {
      await setModule('metering', true);
    }
  });

  it('validates meters and keeps their identity immutable', async () => {
    const meter = await saveMeter('IMM-1', 'gas', 'B-201', '10.5');
    expect((await dbError(saveMeter('imm-1', 'gas', 'C-301'))).code).toBe(
      '23505',
    );
    expect(
      (
        await dbError(
          call('admin', 'metering_meter_save', [
            society,
            null,
            'water',
            'common',
            unit('A-101'),
            'BAD',
            null,
            '0',
            true,
            null,
            crypto.randomUUID(),
            crypto.randomUUID(),
          ]),
        )
      ).code,
    ).toBe('22023');
    expect(
      (
        await dbError(
          call('admin', 'metering_meter_save', [
            society,
            meter,
            'water',
            'unit',
            unit('B-201'),
            'IMM-1',
            null,
            '10.5',
            true,
            1,
            crypto.randomUUID(),
            crypto.randomUUID(),
          ]),
        )
      ).code,
    ).toBe('22023');
    await record(meter, '11', today);
    expect(
      (
        await dbError(
          call('admin', 'metering_meter_save', [
            society,
            meter,
            'gas',
            'unit',
            unit('B-201'),
            'IMM-1',
            'SN-1',
            '0',
            true,
            1,
            crypto.randomUUID(),
            crypto.randomUUID(),
          ]),
        )
      ).code,
    ).toBe('23514');
    await call('admin', 'metering_meter_save', [
      society,
      meter,
      'gas',
      'unit',
      unit('B-201'),
      'IMM-1',
      'SN-1',
      '10.5',
      false,
      1,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ]);
    expect((await dbError(record(meter, '12', today))).code).toBe('P0002');
    expect(
      (
        await dbError(
          database.asSuperuser((client) =>
            client.query('delete from public.metering_meters where id=$1', [
              meter,
            ]),
          ),
        )
      ).code,
    ).toBe('55000');
  });

  it('records staff readings and computes consumption, resets and date rules', async () => {
    const meter = await saveMeter('CONS-1', 'water', 'C-301', '100');
    const first = await record(meter, '105.25', addDays(today, -20));
    expect(await reading(first)).toMatchObject({
      consumption: '5.250',
      previous_value: '100.000',
      is_reset: false,
    });
    expect((await dbError(record(meter, '110', addDays(today, 1)))).code).toBe(
      '22023',
    );
    expect(
      (await dbError(record(meter, '110', addDays(today, -400)))).code,
    ).toBe('22023');
    expect(
      (await dbError(record(meter, '110', addDays(today, -25)))).code,
    ).toBe('23514');
    expect((await dbError(record(meter, '10', addDays(today, -10)))).code).toBe(
      '22023',
    );
    expect(
      (await dbError(record(meter, '1.2345', addDays(today, -10)))).code,
    ).toBe('22023');
    const reset = await record(
      meter,
      '10',
      addDays(today, -10),
      'Meter replaced',
    );
    expect(await reading(reset)).toMatchObject({
      consumption: '0.000',
      previous_value: '105.250',
      is_reset: true,
    });
    const after = await record(meter, '12.5', addDays(today, -5));
    expect(await reading(after)).toMatchObject({
      consumption: '2.500',
      previous_value: '10.000',
    });
    const sameDay = await dbError(record(meter, '13', addDays(today, -5)));
    expect(sameDay.code).toBe('23514');
    expect(sameDay.message).toContain('or later');
    expect(
      (
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              'update public.metering_readings set reading_value=1 where id=$1',
              [after],
            ),
          ),
        )
      ).code,
    ).not.toBe('');
  });

  it('requires a resident photo, holds it for review and notifies both ways', async () => {
    const meter = await saveMeter('RES-1', 'electricity', 'A-101', '500');
    const otherMeter = await saveMeter('RES-OTHER', 'electricity', 'C-301');
    const common = await saveMeter('RES-COMMON', 'electricity', null);
    expect(
      (await dbError(submit('owner', meter, '510', today, null))).code,
    ).toBe('22023');
    const photo = await uploadPhoto('owner');
    expect(
      (await dbError(submit('owner', otherMeter, '1', today, photo))).code,
    ).toBe('P0002');
    expect(
      (await dbError(submit('owner', common, '1', today, photo))).code,
    ).toBe('P0002');
    const foreignPhoto = await uploadPhoto('tenant');
    expect(
      (await dbError(submit('owner', meter, '510', today, foreignPhoto))).code,
    ).toBe('22023');
    const stalePhoto = await uploadPhoto('owner');
    await database.asSuperuser((client) =>
      client.query(
        `update storage.objects set created_at=now()-interval '25 hours'
         where bucket_id='metering-photos' and name=$1`,
        [stalePhoto],
      ),
    );
    expect(
      await dbError(submit('owner', meter, '510', today, stalePhoto)),
    ).toMatchObject({
      code: '22023',
      message: 'Photo upload expired. Upload it again.',
    });
    const mismatched = await uploadPhoto('owner');
    await database.asSuperuser((client) =>
      client.query(
        `update storage.objects set metadata=jsonb_set(metadata,'{mimetype}','"image/png"')
         where bucket_id='metering-photos' and name=$1`,
        [mismatched],
      ),
    );
    expect(
      (await dbError(submit('owner', meter, '510', today, mismatched))).code,
    ).toBe('22023');
    const requestId = crypto.randomUUID();
    const pending = await submit(
      'owner',
      meter,
      '510',
      addDays(today, -3),
      photo,
      null,
      requestId,
    );
    expect(await reading(pending)).toMatchObject({
      status: 'pending',
      consumption: null,
    });
    expect(await notifications(requestId)).toEqual([
      {
        user_id: user('admin'),
        entity_type: 'metering_admin',
        type: 'metering_reading_submitted',
      },
    ]);
    expect(
      (
        await dbError(
          submit('owner', meter, '511', today, await uploadPhoto('owner')),
        )
      ).code,
    ).toBe('23505');
    const resident = meteringResidentWorkspaceSchema.parse(
      await call('owner', 'metering_resident_workspace', [society]),
    );
    expect(resident.meters.map((item) => item.label)).toContain('RES-1');
    expect(resident.meters.map((item) => item.label)).not.toContain(
      'RES-OTHER',
    );
    expect(resident.readings.find((item) => item.id === pending)).toMatchObject(
      {
        status: 'pending',
        photo_path: photo,
        is_mine: true,
      },
    );
    const tenantView = meteringResidentWorkspaceSchema.parse(
      await call('tenant', 'metering_resident_workspace', [society]),
    );
    expect(tenantView.readings.map((item) => item.id)).not.toContain(pending);
    expect((await adminWorkspace()).queue.map((item) => item.id)).toContain(
      pending,
    );
    expect(await call('admin', 'metering_photo_access', [society, photo])).toBe(
      true,
    );
    expect(await call('owner', 'metering_photo_access', [society, photo])).toBe(
      true,
    );
    expect(
      await call('tenant', 'metering_photo_access', [society, photo]),
    ).toBe(false);

    expect((await dbError(review(pending, 'reject'))).code).toBe('22023');
    const reviewId = crypto.randomUUID();
    await review(pending, 'approve', null, reviewId);
    await review(pending, 'approve');
    expect((await dbError(review(pending, 'reject', 'Too late'))).code).toBe(
      '23505',
    );
    expect(await reading(pending)).toMatchObject({
      status: 'approved',
      consumption: '10.000',
    });
    expect(await notifications(reviewId)).toEqual([
      {
        user_id: user('owner'),
        entity_type: 'metering',
        type: 'metering_reading_reviewed',
      },
    ]);

    const lowPhoto = await uploadPhoto('owner');
    const low = await submit(
      'owner',
      meter,
      '3',
      addDays(today, -2),
      lowPhoto,
      'Rollover after 99999',
    );
    const rejectId = crypto.randomUUID();
    await review(low, 'reject', 'Photo is blurred', rejectId);
    expect(await reading(low)).toMatchObject({
      status: 'rejected',
      consumption: null,
    });
    expect((await notifications(rejectId))[0]?.type).toBe(
      'metering_reading_reviewed',
    );
    const again = await submit(
      'owner',
      meter,
      '520',
      today,
      await uploadPhoto('owner', 'image/png'),
    );
    await record(meter, '530', addDays(today, -1));
    expect((await dbError(record(meter, '540', addDays(today, -1)))).code).toBe(
      '23514',
    );
    expect((await dbError(review(again, 'approve'))).code).toBe('22023');
    await review(again, 'approve', 'Staff reading taken later the same day');
    expect(await reading(again)).toMatchObject({
      consumption: '0.000',
      is_reset: true,
    });
  });

  it('bills approved unit readings exactly once with half-up paise when billing is on', async () => {
    const electric = await saveMeter('BILL-E', 'electricity', 'D-401', '1000');
    const water = await saveMeter('BILL-W', 'water', 'D-401', '0');
    const gas = await saveMeter('BILL-G', 'gas', 'D-401', '0');
    const dg = await saveMeter('BILL-DG', 'dg', 'D-401', '0');
    const common = await saveMeter('BILL-COMMON', 'electricity', null, '0');
    const offReading = await record(electric, '1012.345', addDays(today, -20));
    expect(await charge(offReading)).toBeNull();
    expect((await dbError(billingRun())).code).toBe('23514');

    await setModule('billing', true);
    const electricReading = await record(
      electric,
      '1024.69',
      addDays(today, -10),
    );
    const waterReading = await record(water, '0.5', addDays(today, -10));
    const gasReading = await record(gas, '3', addDays(today, -10));
    const dgReading = await record(dg, '0.001', addDays(today, -10));
    const commonReading = await record(common, '50', addDays(today, -10));
    expect(await charge(commonReading)).toBeNull();
    expect(await charge(electricReading)).toMatchObject({
      status: 'pending',
      rate_paise: null,
    });

    await setRate('electricity', 800);
    await setRate('electricity', 850);
    await setRate('water', 3);
    await setRate('dg', 100);
    expect((await dbError(billingRun(addDays(today, 1)))).code).toBe('22023');
    const results = await Promise.all([billingRun(), billingRun()]);
    const [first, second] = results.sort(
      (a, b) => b.bills_created - a.bills_created,
    );
    expect(first).toMatchObject({
      billing_enabled: true,
      bills_created: 1,
      charges_billed: 2,
      charges_no_charge: 1,
      charges_without_rate: 1,
      billed_paise: 10495,
    });
    expect(second).toMatchObject({
      bills_created: 0,
      charges_billed: 0,
      billed_paise: 0,
    });
    expect(await charge(electricReading)).toMatchObject({
      status: 'billed',
      rate_paise: 850,
      amount_paise: '10493',
    });
    expect(await charge(waterReading)).toMatchObject({
      status: 'billed',
      amount_paise: '2',
    });
    expect(await charge(dgReading)).toMatchObject({
      status: 'no_charge',
      amount_paise: '0',
    });
    expect(await charge(gasReading)).toMatchObject({ status: 'pending' });
    const billId = (await charge(electricReading))!.bill_id!;
    const bill = await database.asSuperuser(async (client) => ({
      bill: (
        await client.query<{
          total_paise: string;
          kind: string;
          unit_id: string;
        }>(
          'select total_paise::text,kind,unit_id from public.billing_bills where id=$1',
          [billId],
        )
      ).rows[0],
      lines: (
        await client.query<{ amount_paise: string }>(
          'select amount_paise::text from public.billing_bill_lines where bill_id=$1 order by amount_paise::bigint',
          [billId],
        )
      ).rows.map((row) => row.amount_paise),
      ledger: (
        await client.query<{ amount_paise: string }>(
          `select amount_paise::text from public.billing_ledger_entries where bill_id=$1 and direction='debit'`,
          [billId],
        )
      ).rows.map((row) => row.amount_paise),
    }));
    expect(bill).toEqual({
      bill: { total_paise: '10495', kind: 'regular', unit_id: unit('D-401') },
      lines: ['2', '10493'],
      ledger: ['10495'],
    });
    expect(await billingRun()).toMatchObject({
      bills_created: 0,
      charges_without_rate: 1,
    });

    await setRate('electricity', 900);
    const later = await record(electric, '1025.69', addDays(today, -1));
    expect(await billingRun()).toMatchObject({
      bills_created: 1,
      billed_paise: 900,
    });
    expect(await charge(later)).toMatchObject({
      rate_paise: 900,
      amount_paise: '900',
    });
    expect(await charge(electricReading)).toMatchObject({
      rate_paise: 850,
      amount_paise: '10493',
    });
    expect(
      (
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              `update public.metering_charges set status='pending' where reading_id=$1`,
              [later],
            ),
          ),
        )
      ).code,
    ).not.toBe('');

    const workspace = await adminWorkspace();
    expect(workspace.billing_enabled).toBe(true);
    expect(workspace.charges).toMatchObject({
      pending_count: 1,
      pending_without_rate: 1,
    });
    const report = workspace.report.meters.find(
      (item) => item.meter_id === electric,
    );
    expect(report?.periods.at(-1)?.month).toBe(
      `${addDays(today, -1).slice(0, 7)}-01`,
    );
    expect(workspace.report.months).toHaveLength(9);

    await setModule('billing', false);
    try {
      const offAgain = await record(electric, '1030', today);
      expect(await charge(offAgain)).toBeNull();
      expect((await dbError(billingRun())).code).toBe('23514');
      expect((await adminWorkspace()).billing_enabled).toBe(false);
    } finally {
      await setModule('billing', true);
    }
    expect(await billingRun()).toMatchObject({ bills_created: 0 });
    await setModule('billing', false);
  });

  it('bills utility charges during bill generation once, with billing rounding', async () => {
    const setRounding = (rounding: 'rupee' | 'paise') =>
      database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set settings=jsonb_set(settings,'{rounding}',to_jsonb($2::text))
           where society_id=$1 and module_key='billing'`,
          [society, rounding],
        ),
      );
    const period = `${today.slice(0, 7)}-01`;
    const generate = async (unitNumbers: string[]) => {
      const unitIds = unitNumbers.map(unit);
      const preview = (await call('admin', 'billing_bills_preview', [
        society,
        period,
        unitIds,
        [chargeType],
        '[]',
      ])) as { preview_hash: string };
      return call('admin', 'billing_bills_generate', [
        society,
        period,
        unitIds,
        [chargeType],
        '[]',
        preview.preview_hash,
        crypto.randomUUID(),
      ]);
    };
    const utilityBills = (unitNumber: string) =>
      database.asSuperuser(
        async (client) =>
          (
            await client.query<{ id: string; total_paise: string }>(
              `select id,total_paise::text from public.billing_bills
               where unit_id=$1 and title like 'Utility charges - %' order by created_at`,
              [unit(unitNumber)],
            )
          ).rows,
      );
    const generationTrail = (jobId: string) =>
      database.asSuperuser(async (client) => {
        const job = await client.query<{ utility: unknown }>(
          `select summary->'utility' as utility from public.jobs where id=$1`,
          [jobId],
        );
        const audit = await client.query<{ utility: unknown }>(
          `select "after"->'utility' as utility from public.audit_logs
           where action='billing.bills.generate' and entity_id=$1`,
          [jobId],
        );
        const metering = await client.query<{ after: unknown }>(
          `select "after" - 'billing_enabled' - 'charges_without_rate' - 'has_more' - 'period_start' as after
           from public.audit_logs
           where action='metering.billing.generate' and "after"->>'billing_job_id'=$1`,
          [jobId],
        );
        return {
          job: job.rows[0]?.utility,
          audit: audit.rows[0]?.utility,
          metering: metering.rows.map((row) => row.after),
        };
      });

    await setModule('billing', true);
    await setRounding('rupee');
    const chargeType = await asActor('admin', async (client) => {
      const result = await client.query<{ id: string }>(
        `select (public.billing_charge_save($1,null,'Maintenance','fixed',10000,true,null,$2)).id`,
        [society, crypto.randomUUID()],
      );
      return result.rows[0]!.id;
    });
    const dgA = await saveMeter('GEN-DG-A', 'dg', 'A-101', '0');
    const dgC = await saveMeter('GEN-DG-C', 'dg', 'C-301', '0');
    const electricC = await saveMeter('GEN-E-C', 'electricity', 'C-301', '0');
    const readingA = await record(dgA, '2.494', addDays(today, -2));
    const readingC = await record(dgC, '155.5', addDays(today, -2));
    const smallC = await record(electricC, '0.05', addDays(today, -2));

    // Metering off: generation bills only the regular charges.
    await setModule('metering', false);
    try {
      const { job_id: jobOff } = (await generate(['A-101'])) as {
        job_id: string;
      };
      expect(await generationTrail(jobOff)).toEqual({
        job: null,
        audit: null,
        metering: [],
      });
    } finally {
      await setModule('metering', true);
    }
    expect(await utilityBills('A-101')).toEqual([]);
    expect(await charge(readingA)).toMatchObject({ status: 'pending' });

    // Metering on, rupee rounding: generation bills its own units in the same run.
    const { job_id: jobC } = (await generate(['C-301'])) as { job_id: string };
    expect(await generationTrail(jobC)).toEqual({
      job: { bills: 1, charges: 1, has_more: false },
      audit: { bills: 1, charges: 1, has_more: false },
      metering: [
        {
          bills_created: 1,
          charges_billed: 1,
          charges_no_charge: 1,
          billed_paise: 15600,
          billing_job_id: jobC,
        },
      ],
    });
    const [billC] = await utilityBills('C-301');
    expect(billC?.total_paise).toBe('15600');
    expect(await charge(readingC)).toMatchObject({
      status: 'billed',
      amount_paise: '15550',
      billed_paise: '15600',
      bill_id: billC?.id,
    });
    expect(await charge(smallC)).toMatchObject({
      status: 'no_charge',
      amount_paise: '45',
      billed_paise: '0',
      bill_id: null,
    });
    expect(await charge(readingA)).toMatchObject({ status: 'pending' });

    // The manual run catches up on units outside the generation and never re-bills.
    expect(await billingRun()).toMatchObject({
      bills_created: 1,
      charges_billed: 1,
      billed_paise: 200,
    });
    expect(await charge(readingA)).toMatchObject({
      amount_paise: '249',
      billed_paise: '200',
    });
    expect(await billingRun()).toMatchObject({ bills_created: 0 });
    expect(await utilityBills('C-301')).toHaveLength(1);
    expect(await utilityBills('A-101')).toHaveLength(1);

    // Paise rounding, with generation and the manual run racing for the same charge.
    await setRounding('paise');
    const dgB = await saveMeter('GEN-DG-B', 'dg', 'B-201', '0');
    const readingB = await record(dgB, '1.235', addDays(today, -1));
    await Promise.all([generate(['B-201']), billingRun()]);
    const billsB = await utilityBills('B-201');
    expect(billsB).toHaveLength(1);
    expect(billsB[0]?.total_paise).toBe('124');
    expect(await charge(readingB)).toMatchObject({
      status: 'billed',
      amount_paise: '124',
      billed_paise: '124',
      bill_id: billsB[0]?.id,
    });
    await setModule('billing', false);
  });

  it('lists only never-attached photos for cleanup', async () => {
    const meter = await saveMeter('PHOTO-1', 'water', 'B-201');
    const attached = await uploadPhoto('tenant');
    await submit('tenant', meter, '1', today, attached);
    const orphan = await uploadPhoto('tenant');
    const fresh = await uploadPhoto('tenant');
    await database.asSuperuser((client) =>
      client.query(
        `update storage.objects set created_at=now()-interval '2 days' where name=any($1)`,
        [[attached, orphan]],
      ),
    );
    const listed = await database.asRole('service_role', {}, async (client) =>
      (
        await client.query<{ path: string }>(
          'select path from public.metering_retention_files_list($1)',
          [today],
        )
      ).rows.map((row) => row.path),
    );
    expect(listed).toContain(orphan);
    expect(listed).not.toContain(attached);
    expect(listed).not.toContain(fresh);
    expect(
      (
        await dbError(
          asActor('admin', (client) =>
            client.query(
              'select * from public.metering_retention_files_list($1)',
              [today],
            ),
          ),
        )
      ).code,
    ).toBe('42501');
  });
});
