// Verify parking privacy, waitlist order, capacity, visitor passes, report targeting and photo retention.
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
  parkingAdminWorkspaceSchema,
  parkingGuardBoardSchema,
  parkingResidentWorkspaceSchema,
} from '../../src/core/parking/validation';

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

describe.skipIf(!hasDatabase)('parking database contracts', () => {
  let database: TestDatabase;
  const users = new Map<Actor, string>();
  let society = '';
  let foreignSociety = '';
  const units = new Map<string, string>();
  const vehicles = new Map<string, string>();

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
  const vehicle = (number: string) => {
    const id = vehicles.get(number);
    if (!id) throw new Error(`Missing synthetic vehicle ${number}.`);
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
  const createSlot = async (
    label: string,
    slotType: string,
    targetSociety = society,
    actor: Actor = 'admin',
  ) =>
    (await call(actor, 'parking_slot_save', [
      targetSociety,
      null,
      label,
      slotType,
      null,
      null,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ])) as string;
  const allocate = async (slot: string, unitNumber: string, reason?: string) =>
    (await call('admin', 'parking_allocate', [
      society,
      slot,
      unit(unitNumber),
      reason ?? null,
      crypto.randomUUID(),
    ])) as string;
  const requestSlot = async (actor: Actor, unitNumber: string, type: string) =>
    (await call(actor, 'parking_request_create', [
      society,
      unit(unitNumber),
      type,
      null,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ])) as string;
  const link = (
    actor: Actor,
    allocation: string,
    vehicleNumber: string,
    linked = true,
  ) =>
    call(actor, 'parking_vehicle_link_set', [
      society,
      allocation,
      vehicle(vehicleNumber),
      linked,
      crypto.randomUUID(),
    ]);
  const later = (hours: number) =>
    new Date(Date.now() + hours * 3_600_000).toISOString();
  const createPass = (
    actor: Actor,
    unitNumber: string,
    slot: string | null,
    startHours: number,
    endHours: number,
    entry: string | null = null,
  ) =>
    call(actor, 'parking_pass_create', [
      society,
      unit(unitNumber),
      slot,
      later(startHours),
      later(endHours),
      'Synthetic Visitor',
      'ka 05-mn 1234',
      entry,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ]);
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
  const residentWorkspace = async (actor: Actor) =>
    parkingResidentWorkspaceSchema.parse(
      await call(actor, 'parking_resident_workspace', [society]),
    );
  const adminWorkspace = async (actor: Actor = 'admin') =>
    parkingAdminWorkspaceSchema.parse(
      await call(actor, 'parking_admin_workspace', [society]),
    );

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      for (const actor of ACTORS) {
        const email = `parking-${actor.toLowerCase()}@example.test`;
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
          `insert into public.societies(name,created_by) values('Parking A',$1) returning id`,
          [user('admin')],
        )
      ).rows[0]!.id;
      foreignSociety = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by) values('Parking B',$1) returning id`,
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
           values($1,'A-101',$2),($1,'B-201',$2),($1,'C-301',$2) returning id,number`,
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
      for (const [number, type, unitNumber, actor, verified] of [
        ['MH01AB1234', 'car', 'A-101', 'owner', true],
        ['MH01CD5678', 'other', 'A-101', 'owner', true],
        ['MH01EF1111', 'two_wheeler', 'A-101', 'owner', true],
        ['MH02XY9999', 'two_wheeler', 'B-201', 'tenant', true],
        ['MH03UV0001', 'car', 'C-301', 'otherResident', false],
      ] as const) {
        vehicles.set(
          number,
          (
            await client.query<{ id: string }>(
              `insert into public.directory_vehicles
               (society_id,unit_id,membership_id,vehicle_type,registration_number,client_request_id,created_by,
                verified_at,verified_by)
               values($1,$2,$3,$4,$5,gen_random_uuid(),$6,
                 case when $7 then now() end,case when $7 then $8::uuid end) returning id`,
              [
                society,
                unit(unitNumber),
                memberships.get(actor),
                type,
                number,
                user(actor),
                verified,
                user('admin'),
              ],
            )
          ).rows[0]!.id,
        );
      }
      await client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,'core',true,'{}'),($1,'parking',true,'{}'),($1,'directory',true,'{}'),
           ($1,'visitor',true,'{}'),($2,'core',true,'{}'),($2,'parking',true,'{}')`,
        [society, foreignSociety],
      );
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps tables private and isolates societies', async () => {
    const own = await createSlot('A1', 'car');
    const foreign = await createSlot(
      'F1',
      'car',
      foreignSociety,
      'foreignAdmin',
    );
    expect(
      (
        await dbError(
          asActor('admin', (client) =>
            client.query('select * from public.parking_slots'),
          ),
        )
      ).code,
    ).toBe('42501');
    expect(
      (
        await dbError(
          call('foreignAdmin', 'parking_admin_workspace', [society]),
        )
      ).code,
    ).toBe('42501');
    expect(
      (await dbError(createSlot('X1', 'car', society, 'foreignAdmin'))).code,
    ).toBe('42501');
    expect(
      (
        await dbError(
          call('admin', 'parking_allocate', [
            society,
            foreign,
            unit('A-101'),
            null,
            crypto.randomUUID(),
          ]),
        )
      ).code,
    ).toBe('P0002');
    const committee = await adminWorkspace('committee');
    expect(committee.can_manage).toBe(false);
    expect(committee.slots.map((slot) => slot.id)).toEqual([own]);
    expect(
      (await dbError(createSlot('C1', 'car', society, 'committee'))).code,
    ).toBe('42501');
    for (const actor of ['guard', 'owner'] as const) {
      expect(
        (await dbError(call(actor, 'parking_admin_workspace', [society]))).code,
      ).toBe('42501');
    }
    expect(
      (await dbError(call('admin', 'parking_guard_board', [society, null])))
        .code,
    ).toBe('42501');
    expect(
      (
        await dbError(
          call('admin', 'parking_report_create', [
            society,
            own,
            null,
            null,
            null,
            crypto.randomUUID(),
            crypto.randomUUID(),
          ]),
        )
      ).code,
    ).toBe('42501');
  });

  it('refuses every parking call while the module is disabled', async () => {
    await setModule('parking', false);
    try {
      expect(
        (await dbError(call('owner', 'parking_resident_workspace', [society])))
          .code,
      ).toBe('42501');
      expect((await dbError(createSlot('OFF', 'car'))).code).toBe('42501');
      expect(
        (await dbError(call('guard', 'parking_guard_board', [society, null])))
          .code,
      ).toBe('42501');
      expect((await dbError(requestSlot('owner', 'A-101', 'car'))).code).toBe(
        '42501',
      );
    } finally {
      await setModule('parking', true);
    }
  });

  it('never allocates visitor slots and keeps one active allocation per slot', async () => {
    const visitor = await createSlot('V-ALLOC', 'visitor');
    expect((await dbError(allocate(visitor, 'A-101'))).code).toBe('23514');
    expect(
      (
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              `insert into public.parking_allocations(society_id,slot_id,unit_id,started_by)
               values($1,$2,$3,$4)`,
              [society, visitor, unit('A-101'), user('admin')],
            ),
          ),
        )
      ).code,
    ).toBe('23514');
    const car = await createSlot('ONE-ALLOC', 'car');
    await allocate(car, 'C-301');
    expect((await dbError(allocate(car, 'B-201', 'Synthetic'))).code).toBe(
      '23505',
    );
    expect(
      (
        await dbError(
          call('admin', 'parking_slot_archive', [
            society,
            car,
            1,
            crypto.randomUUID(),
          ]),
        )
      ).code,
    ).toBe('23514');
  });

  it('allocates the waitlist in FIFO order and audits skip reasons', async () => {
    const first = await requestSlot('tenant', 'B-201', 'car');
    const second = await requestSlot('owner', 'A-101', 'car');
    expect((await dbError(requestSlot('tenant', 'B-201', 'car'))).code).toBe(
      '23505',
    );
    expect(
      (await dbError(requestSlot('tenant', 'B-201', 'visitor'))).code,
    ).toBe('22023');
    expect((await dbError(requestSlot('tenant', 'A-101', 'ev'))).code).toBe(
      'P0002',
    );
    const queues = (await adminWorkspace()).queues.filter(
      (row) => row.slot_type === 'car',
    );
    expect(queues.map((row) => [row.id, row.queue_position])).toEqual([
      [first, 1],
      [second, 2],
    ]);
    const slotOne = await createSlot('Q1', 'car');
    expect((await dbError(allocate(slotOne, 'A-101'))).code).toBe('22023');
    const allocation = await allocate(slotOne, 'A-101', 'Medical priority');
    const audit = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ after: Record<string, unknown> }>(
            `select "after" from public.audit_logs where action='parking.allocation.create' and entity_id=$1`,
            [allocation],
          )
        ).rows[0]!.after,
    );
    expect(audit).toMatchObject({
      skip_reason: 'Medical priority',
      skipped_request_id: first,
      waitlist_request_id: second,
    });
    const owner = await residentWorkspace('owner');
    expect(owner.requests.find((row) => row.id === second)?.status).toBe(
      'fulfilled',
    );
    const tenant = await residentWorkspace('tenant');
    expect(tenant.requests.find((row) => row.id === first)).toMatchObject({
      status: 'waiting',
      queue_position: 1,
    });
    const slotTwo = await createSlot('Q2', 'car');
    await allocate(slotTwo, 'B-201');
    expect(
      (await residentWorkspace('tenant')).requests.find(
        (row) => row.id === first,
      )?.status,
    ).toBe('fulfilled');

    const ev = await requestSlot('otherResident', 'C-301', 'ev');
    expect(
      (
        await dbError(
          call('tenant', 'parking_request_cancel', [
            society,
            ev,
            crypto.randomUUID(),
          ]),
        )
      ).code,
    ).toBe('P0002');
    await call('otherResident', 'parking_request_cancel', [
      society,
      ev,
      crypto.randomUUID(),
    ]);
    expect((await adminWorkspace()).queues.some((row) => row.id === ev)).toBe(
      false,
    );
  });

  it('enforces slot capacity for linked directory vehicles', async () => {
    const carSlot = await createSlot('CAP-CAR', 'car');
    const bikeSlot = await createSlot('CAP-BIKE', 'two_wheeler');
    const carAllocation = await allocate(carSlot, 'A-101', 'Capacity test');
    const bikeAllocation = await allocate(bikeSlot, 'A-101', 'Capacity test');
    await link('owner', carAllocation, 'MH01AB1234');
    expect(
      (await dbError(link('owner', carAllocation, 'MH01CD5678'))).code,
    ).toBe('23514');
    await link('admin', carAllocation, 'MH01EF1111');
    expect(
      (await dbError(link('owner', bikeAllocation, 'MH01CD5678'))).code,
    ).toBe('23514');
    expect(
      (await dbError(link('owner', bikeAllocation, 'MH01EF1111'))).code,
    ).toBe('23505');
    expect(
      (await dbError(link('tenant', carAllocation, 'MH01CD5678'))).code,
    ).toBe('P0002');
    expect(
      (await dbError(link('owner', carAllocation, 'MH02XY9999'))).code,
    ).toBe('P0002');
    expect(
      (
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              `insert into public.parking_vehicle_links
               (society_id,allocation_id,vehicle_id,slot_type,vehicle_class,created_by)
               values($1,$2,$3,'two_wheeler','four_wheeler',$4)`,
              [society, bikeAllocation, vehicle('MH01CD5678'), user('admin')],
            ),
          ),
        )
      ).code,
    ).toBe('23514');
    expect(
      (
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              `insert into public.parking_vehicle_links
               (society_id,allocation_id,vehicle_id,slot_type,vehicle_class,created_by)
               values($1,$2,$3,'car','four_wheeler',$4)`,
              [society, carAllocation, vehicle('MH01CD5678'), user('admin')],
            ),
          ),
        )
      ).code,
    ).toBe('23505');
    await link('owner', carAllocation, 'MH01AB1234', false);
    await link('owner', carAllocation, 'MH01CD5678');
    const mine = (await residentWorkspace('owner')).allocations.find(
      (row) => row.id === carAllocation,
    );
    expect(
      mine?.vehicles
        .filter((row) => row.linked)
        .map((row) => row.registration_number),
    ).toEqual(['MH01CD5678', 'MH01EF1111']);
    const board = parkingGuardBoardSchema.parse(
      await call('guard', 'parking_guard_board', [society, 'mh01-cd 5678']),
    );
    expect(board.matches).toEqual([
      expect.objectContaining({ slot_label: 'CAP-CAR', unit_number: 'A-101' }),
    ]);
    await call('admin', 'parking_allocation_end', [
      society,
      bikeAllocation,
      crypto.randomUUID(),
    ]);
  });

  it('hides and refuses vehicle links while the directory module is off', async () => {
    const slot = await createSlot('DIR-OFF', 'car');
    const allocation = await allocate(slot, 'A-101', 'Directory test');
    await setModule('directory', false);
    try {
      expect(
        (await dbError(link('owner', allocation, 'MH01AB1234'))).code,
      ).toBe('42501');
      const workspace = await residentWorkspace('owner');
      expect(workspace.directory_enabled).toBe(false);
      expect(
        workspace.allocations.every((row) => row.vehicles.length === 0),
      ).toBe(true);
    } finally {
      await setModule('directory', true);
    }
  });

  it('keeps visitor passes within 24 hours without overlaps', async () => {
    await database.asSuperuser((client) =>
      client.query(
        `update public.parking_slots set archived_at=now(),archived_by=$2
         where society_id=$1 and slot_type='visitor' and archived_at is null`,
        [society, user('admin')],
      ),
    );
    const first = await createSlot('AA-VIS-1', 'visitor');
    const second = await createSlot('AA-VIS-2', 'visitor');
    const car = await createSlot('VIS-CAR', 'car');
    const pass = (await createPass('owner', 'A-101', first, 1, 3)) as string;
    expect(
      (await dbError(createPass('tenant', 'B-201', first, 2, 4))).code,
    ).toBe('23P01');
    await createPass('tenant', 'B-201', null, 2, 4);
    const passes = (await residentWorkspace('tenant')).passes;
    expect(passes.map((row) => row.slot_id)).toEqual([second]);
    expect(passes[0]?.vehicle_number).toBe('KA05MN1234');
    expect(
      (await dbError(createPass('tenant', 'B-201', null, 2, 3))).code,
    ).toBe('23P01');
    expect(
      (await dbError(createPass('owner', 'A-101', first, 5, 30))).code,
    ).toBe('22023');
    expect((await dbError(createPass('owner', 'A-101', car, 5, 6))).code).toBe(
      'P0002',
    );
    expect(
      (await dbError(createPass('tenant', 'A-101', first, 5, 6))).code,
    ).toBe('P0002');
    const board = parkingGuardBoardSchema.parse(
      await call('guard', 'parking_guard_board', [society, null]),
    );
    expect(board.passes.map((row) => row.id)).toContain(pass);
    expect(
      (
        await dbError(
          call('tenant', 'parking_pass_cancel', [
            society,
            pass,
            crypto.randomUUID(),
          ]),
        )
      ).code,
    ).toBe('P0002');
    await call('owner', 'parking_pass_cancel', [
      society,
      pass,
      crypto.randomUUID(),
    ]);
    await createPass('otherResident', 'C-301', first, 2, 4);

    const entries = await database.asSuperuser(async (client) => {
      const guard = (
        await client.query<{ id: string }>(
          `insert into public.guard_roster(society_id,name,created_by) values($1,'Gate',$2) returning id`,
          [society, user('admin')],
        )
      ).rows[0]!.id;
      return (
        await client.query<{ id: string; unit_id: string }>(
          `insert into public.visitor_entries
           (society_id,created_by,unit_id,visitor_name,purpose,status,decision_source,decided_at,handled_by_guard_id)
           values($1,$2,$3,'Synthetic Guest','guest','approved','resident',now(),$5),
                 ($1,$2,$4,'Other Guest','guest','approved','resident',now(),$5)
           returning id,unit_id`,
          [society, user('admin'), unit('A-101'), unit('B-201'), guard],
        )
      ).rows;
    });
    const ownEntry = entries.find((row) => row.unit_id === unit('A-101'))!.id;
    const otherEntry = entries.find((row) => row.unit_id === unit('B-201'))!.id;
    expect(
      (await dbError(createPass('owner', 'A-101', null, 6, 7, otherEntry)))
        .code,
    ).toBe('P0002');
    await createPass('owner', 'A-101', null, 6, 7, ownEntry);

    await setModule('visitor', false);
    try {
      expect(
        (await dbError(createPass('owner', 'A-101', null, 8, 9))).code,
      ).toBe('23514');
      expect((await residentWorkspace('owner')).visitor_slots).toEqual([]);
    } finally {
      await setModule('visitor', true);
    }
  });

  it('notifies the slot holder or vehicle owner and admins about wrong parking', async () => {
    const slot = await createSlot('REP-1', 'car');
    await allocate(slot, 'A-101', 'Report test');
    const report = async (
      actor: Actor,
      slotId: string | null,
      vehicleNumber: string | null,
      requestId: string,
    ) =>
      (await call(actor, 'parking_report_create', [
        society,
        slotId,
        vehicleNumber,
        'Blocking the ramp',
        null,
        crypto.randomUUID(),
        requestId,
      ])) as string;
    const bySlot = crypto.randomUUID();
    const slotReport = await report('guard', slot, null, bySlot);
    expect(
      (await notifications(bySlot)).map((row) => [
        row.user_id,
        row.entity_type,
      ]),
    ).toEqual(
      [
        [user('admin'), 'parking_admin'],
        [user('owner'), 'parking'],
      ].sort((left, right) => left[0]!.localeCompare(right[0]!)),
    );
    const byVehicle = crypto.randomUUID();
    const vehicleReport = await report(
      'tenant',
      null,
      'mh-01 ab 1234',
      byVehicle,
    );
    expect(
      (await notifications(byVehicle)).map((row) => row.user_id).sort(),
    ).toEqual([user('admin'), user('owner')].sort());
    const matchedUnitSeenBy = async (actor: Actor, reportId: string) =>
      (actor === 'admin' || actor === 'committee'
        ? (await adminWorkspace(actor)).reports
        : (await residentWorkspace(actor)).reports
      ).find((row) => row.id === reportId)?.matched_unit_number;
    expect(await matchedUnitSeenBy('tenant', vehicleReport)).toBeNull();
    expect(await matchedUnitSeenBy('owner', vehicleReport)).toBe('A-101');
    expect(await matchedUnitSeenBy('admin', vehicleReport)).toBe('A-101');
    expect(await matchedUnitSeenBy('committee', vehicleReport)).toBe('A-101');
    const tenantSlotReport = await report(
      'tenant',
      slot,
      null,
      crypto.randomUUID(),
    );
    expect(await matchedUnitSeenBy('tenant', tenantSlotReport)).toBeNull();
    const unverified = crypto.randomUUID();
    const unverifiedReport = await report(
      'tenant',
      null,
      'MH03UV0001',
      unverified,
    );
    expect((await notifications(unverified)).map((row) => row.user_id)).toEqual(
      [user('admin')],
    );
    expect(await matchedUnitSeenBy('admin', unverifiedReport)).toBeNull();
    expect(
      parkingGuardBoardSchema.parse(
        await call('guard', 'parking_guard_board', [society, 'MH03UV0001']),
      ).matches,
    ).toEqual([]);
    const unknown = crypto.randomUUID();
    await report('otherResident', null, 'ZZ99ZZ9999', unknown);
    expect((await notifications(unknown)).map((row) => row.user_id)).toEqual([
      user('admin'),
    ]);
    expect(
      (await dbError(report('owner', null, 'AB', crypto.randomUUID()))).code,
    ).toBe('22023');
    expect(
      (await residentWorkspace('owner')).reports.some(
        (row) => row.id === slotReport,
      ),
    ).toBe(true);
    expect(
      (await residentWorkspace('tenant')).reports.some(
        (row) => row.id === slotReport,
      ),
    ).toBe(false);
    const resolved = crypto.randomUUID();
    await call('admin', 'parking_report_resolve', [
      society,
      slotReport,
      'Vehicle moved',
      resolved,
    ]);
    expect(await notifications(resolved)).toEqual([
      expect.objectContaining({
        user_id: user('guard'),
        entity_type: 'parking_guard',
      }),
    ]);
    expect(
      (
        await dbError(
          call('admin', 'parking_report_resolve', [
            society,
            slotReport,
            null,
            crypto.randomUUID(),
          ]),
        )
      ).code,
    ).toBe('23505');
    let accepted = 1;
    let limitCode: string | undefined;
    while (!limitCode && accepted <= 10) {
      try {
        await report('otherResident', null, 'ZZ99ZZ9999', crypto.randomUUID());
        accepted += 1;
      } catch (error) {
        limitCode = (error as { code?: string }).code;
      }
    }
    expect([accepted, limitCode]).toEqual([10, '54000']);
  });

  it('keeps report photos private and purges them after the retention period', async () => {
    expect(
      (
        await dbError(
          call('admin', 'parking_settings_update', [
            society,
            0,
            crypto.randomUUID(),
          ]),
        )
      ).code,
    ).toBe('22023');
    expect(
      (
        await dbError(
          call('committee', 'parking_settings_update', [
            society,
            2,
            crypto.randomUUID(),
          ]),
        )
      ).code,
    ).toBe('42501');
    await call('admin', 'parking_settings_update', [
      society,
      1,
      crypto.randomUUID(),
    ]);
    expect((await adminWorkspace()).settings.photo_retention_days).toBe(1);

    const upload = async (mimetype = 'image/jpeg') => {
      const path = (await call('guard', 'parking_photo_upload_path', [
        society,
        mimetype,
        2048,
      ])) as string;
      await asActor('guard', (client) =>
        client.query(
          `insert into storage.objects(bucket_id,name,metadata) values('parking-photos',$1,$2)`,
          [path, { mimetype, size: 2048 }],
        ),
      );
      return path;
    };
    const foreignPath = `${society}/reports/${user('owner')}/${crypto.randomUUID()}.jpg`;
    expect(
      (
        await dbError(
          asActor('guard', (client) =>
            client.query(
              `insert into storage.objects(bucket_id,name,metadata) values('parking-photos',$1,$2)`,
              [foreignPath, { mimetype: 'image/jpeg', size: 10 }],
            ),
          ),
        )
      ).code,
    ).toBe('42501');
    const slot = await createSlot('PHOTO-1', 'car');
    await allocate(slot, 'A-101', 'Photo test');
    const path = await upload();
    const reportId = (await call('guard', 'parking_report_create', [
      society,
      slot,
      null,
      null,
      path,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ])) as string;
    const orphan = await upload('image/png');
    const access = (actor: Actor, target: string) =>
      call(actor, 'parking_photo_access', [society, target]);
    expect(await access('owner', path)).toBe(true);
    expect(await access('admin', path)).toBe(true);
    expect(await access('tenant', path)).toBe(false);
    expect(await access('tenant', orphan)).toBe(false);
    expect(await access('guard', orphan)).toBe(true);
    expect(
      (
        await dbError(
          call('owner', 'parking_report_create', [
            society,
            slot,
            null,
            null,
            orphan,
            crypto.randomUUID(),
            crypto.randomUUID(),
          ]),
        )
      ).code,
    ).toBe('22023');

    await database.asSuperuser(async (client) => {
      await client.query(
        `update public.parking_reports set created_at=now()-interval '2 days' where id=$1`,
        [reportId],
      );
      await client.query(
        `update storage.objects set created_at=now()-interval '2 days' where name=$1`,
        [orphan],
      );
    });
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(new Date());
    const listed = await database.asRole('service_role', {}, async (client) =>
      (
        await client.query<{ path: string }>(
          'select path from public.parking_retention_files_list($1)',
          [today],
        )
      ).rows.map((row) => row.path),
    );
    expect(listed.sort()).toEqual([orphan, path].sort());
    expect(
      (
        await dbError(
          call('admin', 'parking_retention_run', [today, 'synthetic']),
        )
      ).code,
    ).toBe('42501');
    await database.asSuperuser((client) =>
      client.query(
        `delete from storage.objects where bucket_id='parking-photos' and name = any($1)`,
        [listed],
      ),
    );
    const run = await database.asRole(
      'service_role',
      {},
      async (client) =>
        (
          await client.query<{ value: unknown }>(
            'select public.parking_retention_run($1,$2) as value',
            [today, 'synthetic-retention'],
          )
        ).rows[0]!.value,
      { commit: true },
    );
    expect(run).toEqual({ photos_deleted: 1 });
    expect(await access('owner', path)).toBe(false);
    const stored = (await adminWorkspace()).reports.find(
      (row) => row.id === reportId,
    );
    expect(stored?.photo_path).toBeNull();
  });

  it('updates P52 slot condition and exposes aggregate-only manager summaries', async () => {
    const slot = await createSlot('P52-CONDITION', 'car');
    const allocation = await allocate(slot, 'A-101', 'P52 summary');
    await link('owner', allocation, 'MH01AB1234');

    expect(
      (
        await dbError(
          call('committee', 'parking_condition_set', [
            society,
            slot,
            'needs_attention',
            1,
            'committee-condition',
          ]),
        )
      ).code,
    ).toBe('42501');
    await call('admin', 'parking_condition_set', [
      society,
      slot,
      'needs_attention',
      1,
      'admin-condition',
    ]);
    expect(
      (
        await dbError(
          call('admin', 'parking_condition_set', [
            society,
            slot,
            'out_of_service',
            1,
            'stale-condition',
          ]),
        )
      ).code,
    ).toBe('40001');
    expect(
      (
        await dbError(
          call('admin', 'parking_condition_set', [
            society,
            slot,
            'closed',
            2,
            'invalid-condition',
          ]),
        )
      ).code,
    ).toBe('22023');

    const summary = (await call('admin', 'parking_summary', [society])) as {
      slots_total: number;
      allocated_slots: number;
      vehicle_count: number;
      condition_counts: Record<string, number>;
      by_slot_type: unknown[];
    };
    expect(summary.slots_total).toBeGreaterThan(0);
    expect(summary.allocated_slots).toBeGreaterThan(0);
    expect(summary.vehicle_count).toBeGreaterThan(0);
    expect(summary.condition_counts.needs_attention).toBeGreaterThan(0);
    expect(JSON.stringify(summary)).not.toMatch(/MH0|registration_number/i);
    expect(await call('committee', 'parking_summary', [society])).toEqual(
      summary,
    );
    expect(
      (await dbError(call('owner', 'parking_summary', [society]))).code,
    ).toBe('42501');
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: user('admin') }, (client) =>
            client.query(
              'select condition_status from public.parking_slots where id=$1',
              [slot],
            ),
          ),
        )
      ).code,
    ).toBe('42501');

    const audit = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ after: Record<string, unknown> }>(
            `select "after" from public.audit_logs
           where action='parking.slot.condition.update' and entity_id=$1`,
            [slot],
          )
        ).rows.at(-1)?.after,
    );
    expect(audit).toMatchObject({
      condition_status: 'needs_attention',
      version: 2,
    });

    await setModule('parking', false);
    try {
      expect(
        (await dbError(call('admin', 'parking_summary', [society]))).code,
      ).toBe('42501');
    } finally {
      await setModule('parking', true);
    }
  });
});
