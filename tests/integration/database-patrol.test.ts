// Verify patrol isolation, roles, checkpoint codes, scans, schedules, incidents, handover notes and photo retention.
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
  patrolAdminWorkspaceSchema,
  patrolGuardWorkspaceSchema,
  patrolPrintSheetSchema,
  patrolScanResultSchema,
} from '../../src/core/patrol/validation';

const ACTORS = [
  'admin',
  'secondAdmin',
  'committee',
  'guard',
  'nextGuard',
  'resident',
  'foreignAdmin',
  'foreignGuard',
] as const;
type Actor = (typeof ACTORS)[number];

describe.skipIf(!hasDatabase)('patrol database contracts', () => {
  let database: TestDatabase;
  const users = new Map<Actor, string>();
  let society = '';
  let foreignSociety = '';

  const user = (actor: Actor) => {
    const id = users.get(actor);
    if (!id) throw new Error(`Missing synthetic ${actor}.`);
    return id;
  };
  const home = (actor: Actor) =>
    actor.startsWith('foreign') ? foreignSociety : society;
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
  const code = async (promise: Promise<unknown>) =>
    (await dbError(promise)).code;
  const setModule = (enabled: boolean) =>
    database.asSuperuser((client) =>
      client.query(
        `update public.module_configs set enabled=$2 where society_id=$1 and module_key='patrol'`,
        [society, enabled],
      ),
    );
  const createCheckpoint = async (
    name: string,
    actor: Actor = 'admin',
    clientRequestId: string = crypto.randomUUID(),
  ) =>
    (await call(actor, 'patrol_checkpoint_save', [
      home(actor),
      null,
      name,
      null,
      null,
      clientRequestId,
      crypto.randomUUID(),
    ])) as string;
  const adminWorkspace = async (actor: Actor = 'admin') =>
    patrolAdminWorkspaceSchema.parse(
      await call(actor, 'patrol_admin_workspace', [home(actor)]),
    );
  const guardWorkspace = async (actor: Actor = 'guard') =>
    patrolGuardWorkspaceSchema.parse(
      await call(actor, 'patrol_guard_workspace', [home(actor)]),
    );
  const checkpointCode = async (id: string) => {
    const found = (await adminWorkspace()).checkpoints.find(
      (checkpoint) => checkpoint.id === id,
    );
    if (!found) throw new Error('Missing checkpoint.');
    return found;
  };
  const scan = async (
    actor: Actor,
    value: string,
    clientRequestId: string = crypto.randomUUID(),
    method = 'typed',
  ) =>
    patrolScanResultSchema.parse(
      await call(actor, 'patrol_scan', [
        home(actor),
        value,
        method,
        clientRequestId,
        crypto.randomUUID(),
      ]),
    );
  const saveSchedule = (
    actor: Actor,
    checkpointIds: string[],
    overrides: Partial<{
      id: string | null;
      start: string;
      end: string;
      interval: number;
      grace: number;
      version: number | null;
    }> = {},
  ) =>
    call(actor, 'patrol_schedule_save', [
      home(actor),
      overrides.id ?? null,
      'Night shift',
      overrides.start ?? '22:00',
      overrides.end ?? '06:00',
      overrides.interval ?? 120,
      overrides.grace ?? 15,
      checkpointIds,
      overrides.version ?? null,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ]) as Promise<string>;
  const upload = async (actor: Actor = 'guard', mimetype = 'image/jpeg') => {
    const path = (await call(actor, 'patrol_photo_upload_path', [
      home(actor),
      mimetype,
      2048,
    ])) as string;
    await asActor(actor, (client) =>
      client.query(
        `insert into storage.objects(bucket_id,name,metadata) values('patrol-photos',$1,$2)`,
        [path, { mimetype, size: 2048 }],
      ),
    );
    return path;
  };
  const report = (
    severity: string,
    photos: string[] = [],
    requestId: string = crypto.randomUUID(),
    actor: Actor = 'guard',
  ) =>
    call(actor, 'patrol_incident_create', [
      home(actor),
      'suspicious_activity',
      severity,
      'Unknown person near the pump room.',
      'Pump room',
      photos,
      crypto.randomUUID(),
      requestId,
    ]) as Promise<string>;
  const notifications = (requestId: string) =>
    database.asSuperuser(
      async (client) =>
        (
          await client.query<{ user_id: string; type: string }>(
            'select user_id,type from public.notifications where request_id=$1 order by user_id',
            [requestId],
          )
        ).rows,
    );
  const auditActions = (entityId: string) =>
    database.asSuperuser(async (client) =>
      (
        await client.query<{ action: string }>(
          'select action from public.audit_logs where entity_id=$1 order by created_at, action',
          [entityId],
        )
      ).rows.map((row) => row.action),
    );

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      for (const actor of ACTORS) {
        const email = `patrol-${actor.toLowerCase()}@example.test`;
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
          `insert into public.societies(name,created_by) values('Patrol A',$1) returning id`,
          [user('admin')],
        )
      ).rows[0]!.id;
      foreignSociety = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by) values('Patrol B',$1) returning id`,
          [user('foreignAdmin')],
        )
      ).rows[0]!.id;
      for (const actor of ACTORS) {
        const role = actor.toLowerCase().includes('admin')
          ? 'admin'
          : actor.toLowerCase().includes('guard')
            ? 'guard'
            : actor;
        await client.query(
          `insert into public.memberships(society_id,user_id,roles,status)
           values($1,$2,array[$3]::text[],'active')`,
          [home(actor), user(actor), role],
        );
      }
      await client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,'core',true,'{}'),($1,'patrol',true,'{}'),
           ($2,'core',true,'{}'),($2,'patrol',true,'{}')`,
        [society, foreignSociety],
      );
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('limits each view to its roles and blocks direct table access', async () => {
    expect((await adminWorkspace()).can_manage).toBe(true);
    expect((await adminWorkspace('committee')).can_manage).toBe(false);
    expect((await adminWorkspace()).settings.photo_retention_days).toBe(90);
    expect(await code(call('guard', 'patrol_admin_workspace', [society]))).toBe(
      '42501',
    );
    expect(
      await code(call('resident', 'patrol_guard_workspace', [society])),
    ).toBe('42501');
    expect(await code(call('admin', 'patrol_guard_workspace', [society]))).toBe(
      '42501',
    );
    expect(await code(call('committee', 'patrol_print_sheet', [society]))).toBe(
      '42501',
    );
    expect(
      await code(call('foreignAdmin', 'patrol_admin_workspace', [society])),
    ).toBe('42501');
    expect(await code(createCheckpoint('Gate', 'committee'))).toBe('42501');
    expect(await code(createCheckpoint('Gate', 'guard'))).toBe('42501');
    for (const table of [
      'patrol_checkpoints',
      'patrol_scans',
      'patrol_incidents',
      'patrol_handover_notes',
    ]) {
      expect(
        await code(
          asActor('admin', (client) =>
            client.query(`select * from public.${table}`),
          ),
        ),
      ).toBe('42501');
    }

    await setModule(false);
    try {
      expect(await code(guardWorkspace())).toBe('42501');
      expect(await code(adminWorkspace())).toBe('42501');
    } finally {
      await setModule(true);
    }
  });

  it('creates unique typed codes, hides them from guards and validates scans by society', async () => {
    const requestId = crypto.randomUUID();
    const gate = await createCheckpoint('Main gate', 'admin', requestId);
    expect(await createCheckpoint('Main gate', 'admin', requestId)).toBe(gate);
    const terrace = await createCheckpoint('Terrace');
    const foreign = await createCheckpoint('Foreign gate', 'foreignAdmin');
    const gateRow = await checkpointCode(gate);
    expect(gateRow.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(gateRow.code).not.toBe((await checkpointCode(terrace)).code);

    const guardView = await call('guard', 'patrol_guard_workspace', [society]);
    expect(JSON.stringify(guardView)).not.toContain(gateRow.code);
    const sheet = patrolPrintSheetSchema.parse(
      await call('admin', 'patrol_print_sheet', [society]),
    );
    expect(sheet.checkpoints.map((item) => item.code)).toContain(gateRow.code);

    const typed = `${gateRow.code.slice(0, 3).toLowerCase()} ${gateRow.code.slice(3)}`;
    const scanRequest = crypto.randomUUID();
    const first = await scan('guard', typed, scanRequest);
    expect(first.checkpoint_id).toBe(gate);
    expect((await scan('guard', typed, scanRequest)).scan_id).toBe(
      first.scan_id,
    );
    const viaQr = await scan(
      'guard',
      `homeish-patrol:${gateRow.code}`,
      crypto.randomUUID(),
      'qr',
    );
    expect(viaQr.scan_id).not.toBe(first.scan_id);
    const recent = (await guardWorkspace()).scans.filter(
      (item) => item.checkpoint_id === gate,
    );
    expect(recent).toHaveLength(2);
    expect(recent.every((item) => item.is_mine)).toBe(true);
    expect(
      (await adminWorkspace()).scans.find((item) => item.id === viaQr.scan_id),
    ).toMatchObject({
      method: 'qr',
      scanned_by_name: 'Synthetic guard',
    });

    const foreignCode = (await adminWorkspace('foreignAdmin')).checkpoints.find(
      (item) => item.id === foreign,
    )!.code;
    expect(await code(scan('guard', foreignCode))).toBe('P0002');
    expect(await code(scan('foreignGuard', gateRow.code))).toBe('P0002');
    expect(await code(scan('guard', 'OOOOOO'))).toBe('22023');
    expect(await code(scan('admin', gateRow.code))).toBe('42501');
    expect(
      await code(
        call('guard', 'patrol_scan', [
          society,
          gateRow.code,
          'nfc',
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('22023');

    const terraceRow = await checkpointCode(terrace);
    await call('admin', 'patrol_checkpoint_set_active', [
      society,
      terrace,
      false,
      terraceRow.version,
      crypto.randomUUID(),
    ]);
    expect(await code(scan('guard', terraceRow.code))).toBe('P0002');
    expect(
      await code(
        call('admin', 'patrol_checkpoint_set_active', [
          society,
          terrace,
          true,
          terraceRow.version,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('40001');
    expect(await auditActions(terrace)).toEqual([
      'patrol.checkpoint.create',
      'patrol.checkpoint.deactivate',
    ]);
  });

  it('validates schedules against the shift and active checkpoints in the same society', async () => {
    const pump = await createCheckpoint('Pump room');
    const lift = await createCheckpoint('Lift lobby');
    const foreign = await createCheckpoint('Foreign pump', 'foreignAdmin');
    expect(
      await code(
        saveSchedule('admin', [pump], { start: '22:00', end: '23:00' }),
      ),
    ).toBe('22023');
    expect(await code(saveSchedule('admin', [pump], { end: '22:00' }))).toBe(
      '22023',
    );
    expect(
      await code(saveSchedule('admin', [pump], { interval: 30, grace: 45 })),
    ).toBe('22023');
    expect(await code(saveSchedule('admin', []))).toBe('22023');
    expect(await code(saveSchedule('admin', [pump, foreign]))).toBe('P0002');
    expect(await code(saveSchedule('committee', [pump]))).toBe('42501');

    const scheduleId = await saveSchedule('admin', [pump, pump]);
    const created = (await adminWorkspace()).schedules.find(
      (item) => item.id === scheduleId,
    )!;
    expect(created).toMatchObject({
      shift_start: '22:00',
      shift_end: '06:00',
      interval_minutes: 120,
      grace_minutes: 15,
      active: true,
    });
    expect(created.checkpoints.map((item) => item.checkpoint_id)).toEqual([
      pump,
    ]);

    await saveSchedule('admin', [pump, lift], {
      id: scheduleId,
      version: created.version,
    });
    const renamed = (await adminWorkspace()).schedules.find(
      (item) => item.id === scheduleId,
    )!;
    expect(renamed.effective_from).toBe(created.effective_from);
    expect(renamed.checkpoints).toHaveLength(2);
    await saveSchedule('admin', [pump, lift], {
      id: scheduleId,
      version: renamed.version,
      interval: 60,
    });
    const retimed = (await adminWorkspace()).schedules.find(
      (item) => item.id === scheduleId,
    )!;
    expect(Date.parse(retimed.effective_from)).toBeGreaterThan(
      Date.parse(created.effective_from),
    );
    expect(
      await code(
        saveSchedule('admin', [pump], {
          id: scheduleId,
          version: created.version,
        }),
      ),
    ).toBe('40001');

    await call('admin', 'patrol_schedule_set_active', [
      society,
      scheduleId,
      false,
      retimed.version,
      crypto.randomUUID(),
    ]);
    expect(
      (await guardWorkspace()).schedules.some((item) => item.id === scheduleId),
    ).toBe(false);
    expect(await auditActions(scheduleId)).toEqual(
      expect.arrayContaining([
        'patrol.schedule.create',
        'patrol.schedule.update',
      ]),
    );
  });

  it('keeps incident photos private and alerts only administrators for high severity', async () => {
    expect(
      await code(
        call('admin', 'patrol_photo_upload_path', [society, 'image/jpeg', 10]),
      ),
    ).toBe('42501');
    expect(
      await code(
        call('guard', 'patrol_photo_upload_path', [society, 'image/gif', 10]),
      ),
    ).toBe('22023');
    const first = await upload();
    const second = await upload('guard', 'image/png');
    const othersPhoto = await upload('nextGuard');
    expect(
      await code(
        asActor('guard', (client) =>
          client.query(
            `insert into storage.objects(bucket_id,name,metadata) values('patrol-photos',$1,$2)`,
            [
              `${society}/incidents/${user('nextGuard')}/${crypto.randomUUID()}.jpg`,
              { mimetype: 'image/jpeg', size: 10 },
            ],
          ),
        ),
      ),
    ).toBe('42501');
    expect(await code(report('high', [othersPhoto]))).toBe('22023');
    const stale = await upload();
    await database.asSuperuser((client) =>
      client.query(
        `update storage.objects set created_at = now() - interval '25 hours' where bucket_id = 'patrol-photos' and name = $1`,
        [stale],
      ),
    );
    expect(await code(report('low', [stale]))).toBe('22023');
    expect(
      await code(report('high', [first, second, othersPhoto, first])),
    ).toBe('22023');

    const access = (actor: Actor, path: string) =>
      call(actor, 'patrol_photo_access', [home(actor), path]);
    expect(await access('guard', first)).toBe(true);
    expect(await access('nextGuard', first)).toBe(false);
    expect(await access('admin', first)).toBe(false);

    const highRequest = crypto.randomUUID();
    const incident = await report('critical', [first, second], highRequest);
    expect(await access('admin', first)).toBe(true);
    expect(await access('committee', second)).toBe(true);
    expect(await access('nextGuard', first)).toBe(false);
    expect(await access('foreignAdmin', first)).toBe(false);
    expect(
      (await notifications(highRequest)).map((row) => [row.user_id, row.type]),
    ).toEqual(
      [user('admin'), user('secondAdmin')]
        .sort()
        .map((id) => [id, 'patrol_incident']),
    );
    const lowRequest = crypto.randomUUID();
    await report('low', [], lowRequest);
    expect(await notifications(lowRequest)).toEqual([]);

    const mine = (await guardWorkspace()).incidents.find(
      (item) => item.id === incident,
    );
    expect(mine).toMatchObject({ severity: 'critical', status: 'open' });
    expect(mine?.photo_paths).toEqual([first, second]);
    expect(
      (await guardWorkspace('nextGuard')).incidents.some(
        (item) => item.id === incident,
      ),
    ).toBe(false);
  });

  it('lets administrators follow up and close incidents with an audit trail', async () => {
    const incident = await report('medium');
    expect(
      await code(
        call('committee', 'patrol_incident_note_add', [
          society,
          incident,
          'Looking into it.',
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('42501');
    expect(
      await code(
        call('guard', 'patrol_incident_close', [
          society,
          incident,
          'Done.',
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('42501');
    expect(
      await code(
        call('foreignAdmin', 'patrol_incident_close', [
          foreignSociety,
          incident,
          'Done.',
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('P0002');
    await call('admin', 'patrol_incident_note_add', [
      society,
      incident,
      'Checked the CCTV footage.',
      crypto.randomUUID(),
    ]);
    const closeRequest = crypto.randomUUID();
    await call('admin', 'patrol_incident_close', [
      society,
      incident,
      'Visitor was a delivery person.',
      closeRequest,
    ]);
    expect(
      await code(
        call('admin', 'patrol_incident_close', [
          society,
          incident,
          'Again.',
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('23505');
    expect(
      await code(
        call('admin', 'patrol_incident_note_add', [
          society,
          incident,
          'Late note.',
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('23505');

    const stored = (await adminWorkspace('committee')).incidents.find(
      (item) => item.id === incident,
    );
    expect(stored).toMatchObject({
      status: 'closed',
      resolution: 'Visitor was a delivery person.',
      closed_by_name: 'Synthetic admin',
    });
    expect(stored?.notes.map((note) => note.body)).toEqual([
      'Checked the CCTV footage.',
    ]);
    expect(await auditActions(incident)).toEqual([
      'patrol.incident.create',
      'patrol.incident.note',
      'patrol.incident.close',
    ]);
    expect(await notifications(closeRequest)).toEqual([
      { user_id: user('guard'), type: 'patrol_incident_closed' },
    ]);
  });

  it('shares handover notes with guards in the society and lets the next guard acknowledge once', async () => {
    const requestId = crypto.randomUUID();
    const create = (actor: Actor = 'guard') =>
      call(actor, 'patrol_handover_create', [
        home(actor),
        'Gate 2 key is with the supervisor.',
        requestId,
        crypto.randomUUID(),
      ]) as Promise<string>;
    const note = await create();
    expect(await create()).toBe(note);
    expect(await code(create('admin'))).toBe('42501');
    const acknowledge = (actor: Actor) =>
      call(actor, 'patrol_handover_acknowledge', [
        home(actor),
        note,
        crypto.randomUUID(),
      ]);

    expect(
      (await guardWorkspace('nextGuard')).handover_notes.find(
        (item) => item.id === note,
      ),
    ).toMatchObject({ is_mine: false, acknowledged_at: null });
    expect(
      (await guardWorkspace('foreignGuard')).handover_notes.some(
        (item) => item.id === note,
      ),
    ).toBe(false);
    expect(await code(acknowledge('guard'))).toBe('23514');
    expect(await code(acknowledge('foreignGuard'))).toBe('P0002');
    expect(await code(acknowledge('admin'))).toBe('42501');
    await acknowledge('nextGuard');
    expect(await code(acknowledge('nextGuard'))).toBe('23505');
    expect(
      (await adminWorkspace('committee')).handover_notes.find(
        (item) => item.id === note,
      ),
    ).toMatchObject({ acknowledged_by_name: 'Synthetic nextGuard' });
    expect(await auditActions(note)).toEqual([
      'patrol.handover.create',
      'patrol.handover.acknowledge',
    ]);
  });

  it('deletes incident photos after the retention period and never-attached uploads after a day', async () => {
    for (const days of [29, 366]) {
      expect(
        await code(
          call('admin', 'patrol_settings_update', [
            society,
            days,
            crypto.randomUUID(),
          ]),
        ),
      ).toBe('22023');
    }
    expect(
      await code(
        call('committee', 'patrol_settings_update', [
          society,
          30,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('42501');
    await call('admin', 'patrol_settings_update', [
      society,
      30,
      crypto.randomUUID(),
    ]);
    expect((await adminWorkspace()).settings.photo_retention_days).toBe(30);

    const kept = await upload();
    const expired = await upload();
    const orphan = await upload('guard', 'image/png');
    const recentOrphan = await upload();
    await report('low', [kept]);
    const oldIncident = await report('low', [expired]);
    await database.asSuperuser(async (client) => {
      await client.query(
        `update public.patrol_incident_photos set created_at=now()-interval '31 days' where path=$1`,
        [expired],
      );
      await client.query(
        `update storage.objects set created_at=now()-interval '2 days' where name=$1`,
        [orphan],
      );
    });
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(new Date());
    expect(
      await code(call('admin', 'patrol_retention_files_list', [today])),
    ).toBe('42501');
    const listed = await database.asRole(
      'service_role',
      {},
      async (client) =>
        (
          await client.query<{ bucket: string; path: string }>(
            'select bucket,path from public.patrol_retention_files_list($1)',
            [today],
          )
        ).rows,
    );
    expect(listed.every((row) => row.bucket === 'patrol-photos')).toBe(true);
    const paths = listed.map((row) => row.path);
    expect(paths).toEqual(expect.arrayContaining([expired, orphan]));
    expect(paths).not.toContain(kept);
    expect(paths).not.toContain(recentOrphan);
    expect(await call('admin', 'patrol_photo_access', [society, expired])).toBe(
      false,
    );

    await database.asSuperuser((client) =>
      client.query(
        `delete from storage.objects where bucket_id='patrol-photos' and name = any($1)`,
        [[expired, orphan]],
      ),
    );
    const run = await database.asRole(
      'service_role',
      {},
      async (client) =>
        (
          await client.query<{ value: unknown }>(
            'select public.patrol_retention_run($1,$2) as value',
            [today, 'synthetic-retention'],
          )
        ).rows[0]!.value,
      { commit: true },
    );
    expect(run).toEqual({ photos_deleted: 1 });
    expect(
      (await adminWorkspace()).incidents.find((item) => item.id === oldIncident)
        ?.photo_paths,
    ).toEqual([]);
    expect(await call('admin', 'patrol_photo_access', [society, kept])).toBe(
      true,
    );
  });
});
