// Verify SOS routing, rate limits, lifecycle rules, banner acknowledgement, contacts and isolation.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type Fixture = {
  users: Map<string, string>;
  names: Map<string, string>;
  units: Map<string, string>;
  societyId: string;
  otherSocietyId: string;
};

const SOCIETY_ONE = [
  ['admin', ['admin']],
  ['committee', ['committee']],
  ['guard1', ['guard']],
  ['guard2', ['guard']],
  ['resA', ['resident']],
  ['resA2', ['resident']],
  ['resB', ['resident']],
  ['resC', ['resident']],
  ['resD', ['resident']],
  ['resN', ['resident']],
  ['resNb', ['resident']],
] as const;
// unit name, block, floor, occupant
const UNITS = [
  ['A1', 'X', 1, ['resA', 'resA2']],
  ['A2', 'X', 1, ['resB']],
  ['A3', 'X', 2, ['resC']],
  ['B1', 'Y', 1, ['resD']],
  ['N1', 'X', null, ['resN']],
  ['N2', 'X', null, ['resNb']],
] as const;

describe.skipIf(!hasDatabase)('database emergency SOS', () => {
  let db: TestDatabase;
  let f: Fixture;

  beforeAll(async () => {
    db = await createTestDatabase();
    f = await db.asSuperuser(async (client) => {
      const users = new Map<string, string>();
      const names = new Map<string, string>();
      const allNames = [
        ...SOCIETY_ONE.map(([name]) => name),
        'outsiderAdmin',
        'outsiderRes',
      ];
      for (const name of allNames) {
        const id = await newAuthUser(client, `sos-${name}@example.test`);
        users.set(name, id);
        names.set(id, name);
        await client.query(
          'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
          [id, `sos-${name}@example.test`, `SOS ${name}`],
        );
      }
      const society = async (name: string) =>
        (
          await client.query<{ id: string }>(
            'insert into public.societies(name,created_by) values($1,$2) returning id',
            [name, users.get('admin')],
          )
        ).rows[0]!.id;
      const societyId = await society('SOS society');
      const otherSocietyId = await society('Other SOS society');
      const memberships = new Map<string, string>();
      const join = async (
        sid: string,
        name: string,
        roles: readonly string[],
      ) => {
        const id = (
          await client.query<{ id: string }>(
            "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,$3,'active') returning id",
            [sid, users.get(name), roles],
          )
        ).rows[0]!.id;
        memberships.set(name, id);
      };
      for (const [name, roles] of SOCIETY_ONE)
        await join(societyId, name, roles);
      await join(otherSocietyId, 'outsiderAdmin', ['admin']);
      await join(otherSocietyId, 'outsiderRes', ['resident']);
      for (const sid of [societyId, otherSocietyId]) {
        await client.query(
          "insert into public.module_configs(society_id,module_key,enabled,settings) values($1,'core',true,'{}'),($1,'sos',true,'{}')",
          [sid],
        );
      }
      const blocks = new Map<string, string>();
      for (const block of ['X', 'Y']) {
        blocks.set(
          block,
          (
            await client.query<{ id: string }>(
              'insert into public.blocks(society_id,name,created_by) values($1,$2,$3) returning id',
              [societyId, block, users.get('admin')],
            )
          ).rows[0]!.id,
        );
      }
      const units = new Map<string, string>();
      for (const [number, block, floor, occupants] of UNITS) {
        const unitId = (
          await client.query<{ id: string }>(
            'insert into public.units(society_id,block_id,number,floor,created_by) values($1,$2,$3,$4,$5) returning id',
            [societyId, blocks.get(block), number, floor, users.get('admin')],
          )
        ).rows[0]!.id;
        units.set(number, unitId);
        for (const [index, occupant] of occupants.entries()) {
          await client.query(
            "insert into public.unit_occupants(society_id,unit_id,membership_id,relationship,is_primary,status,created_by) values($1,$2,$3,$4,$5,'active',$6)",
            [
              societyId,
              unitId,
              memberships.get(occupant),
              index === 0 ? 'owner' : 'family',
              index === 0,
              users.get('admin'),
            ],
          );
        }
      }
      const otherUnit = (
        await client.query<{ id: string }>(
          'insert into public.units(society_id,number,floor,created_by) values($1,$2,1,$3) returning id',
          [otherSocietyId, 'Z1', users.get('outsiderAdmin')],
        )
      ).rows[0]!.id;
      units.set('Z1', otherUnit);
      await client.query(
        "insert into public.unit_occupants(society_id,unit_id,membership_id,relationship,is_primary,status,created_by) values($1,$2,$3,'owner',true,'active',$4)",
        [
          otherSocietyId,
          otherUnit,
          memberships.get('outsiderRes'),
          users.get('outsiderAdmin'),
        ],
      );
      return { users, names, units, societyId, otherSocietyId };
    });
  }, 120_000);

  afterAll(async () => {
    await db?.drop();
  });

  // Each test starts with a fresh rolling hour for every unit.
  afterEach(async () => {
    await db.asSuperuser((client) =>
      client.query(
        "update public.sos_alerts set raised_at = raised_at - interval '2 hours'",
      ),
    );
  });

  const run = <T extends Record<string, unknown>>(
    user: string,
    sql: string,
    params: unknown[] = [],
  ) =>
    db.asRole(
      'authenticated',
      { sub: f.users.get(user)! },
      async (client) => (await client.query<T>(sql, params)).rows,
      { commit: true },
    );
  const raise = async (
    user: string,
    unit: string | null,
    options: {
      category?: string;
      note?: string | null;
      key?: string;
      society?: string;
    } = {},
  ) =>
    (
      await run<{ id: string }>(
        user,
        "select public.sos_raise($1,$2,$3,$4,$5,'sos-raise') as id",
        [
          options.society ?? f.societyId,
          unit ? f.units.get(unit) : null,
          options.category ?? 'medical',
          options.note ?? null,
          options.key ?? crypto.randomUUID(),
        ],
      )
    )[0]!.id;
  const acknowledge = (user: string, alertId: string, society = f.societyId) =>
    run(user, "select public.sos_acknowledge($1,$2,'sos-ack')", [
      society,
      alertId,
    ]);
  const close = (
    user: string,
    alertId: string,
    reason = 'resolved',
    note: string | null = null,
  ) =>
    run(user, "select public.sos_close($1,$2,$3,$4,'sos-close')", [
      f.societyId,
      alertId,
      reason,
      note,
    ]);
  const finish = async (alertId: string) => {
    await acknowledge('guard1', alertId);
    await close('guard1', alertId);
  };
  const settings = (
    guards: boolean,
    admins: boolean,
    committee: boolean,
    scope: string,
    user = 'admin',
  ) =>
    run(
      user,
      "select public.sos_settings_update($1,$2,$3,$4,$5,'sos-settings')",
      [f.societyId, guards, admins, committee, scope],
    );
  const recipients = (alertId: string) =>
    db.asSuperuser(async (client) =>
      (
        await client.query<{ user_id: string; audience: string }>(
          'select user_id,audience from public.sos_alert_recipients where alert_id=$1',
          [alertId],
        )
      ).rows
        .map((row) => `${f.names.get(row.user_id)}:${row.audience}`)
        .sort(),
    );
  const myAlerts = async (user: string) =>
    (
      await run<{
        data: { id: string; note: string | null; audience: string }[];
      }>(user, 'select public.sos_my_alerts() as data')
    )[0]!.data;
  const setModule = (enabled: boolean) =>
    db.asSuperuser((client) =>
      client.query(
        "update public.module_configs set enabled=$2 where society_id=$1 and module_key='sos'",
        [f.societyId, enabled],
      ),
    );

  it('routes alerts by default to guards and admins and records in-app notifications', async () => {
    const alertId = await raise('resA', null, {
      note: 'Father fell in the bathroom',
    });
    expect(await recipients(alertId)).toEqual([
      'admin:admin',
      'guard1:guard',
      'guard2:guard',
    ]);
    const notifications = await db.asSuperuser(
      async (client) =>
        (
          await client.query<{
            user_id: string;
            entity_type: string;
            type: string;
          }>(
            'select user_id,entity_type,type from public.notifications where entity_id=$1',
            [alertId],
          )
        ).rows,
    );
    expect(
      notifications
        .map(
          (row) => `${f.names.get(row.user_id)}:${row.type}:${row.entity_type}`,
        )
        .sort(),
    ).toEqual([
      'admin:sos_alert:sos_admin',
      'guard1:sos_alert:sos_guard',
      'guard2:sos_alert:sos_guard',
    ]);
    const stored = await db.asSuperuser(
      async (client) =>
        (
          await client.query<{ unit_id: string; raised_role: string }>(
            'select unit_id,raised_role from public.sos_alerts where id=$1',
            [alertId],
          )
        ).rows[0]!,
    );
    expect(stored).toEqual({
      unit_id: f.units.get('A1'),
      raised_role: 'resident',
    });
    await finish(alertId);
  });

  it('routes residents by floor, block and society scope and skips null floors', async () => {
    await settings(true, true, false, 'floor');
    const floor = await raise('resA', 'A1');
    expect(
      (await recipients(floor)).filter((r) => r.endsWith(':resident')),
    ).toEqual(['resA2:resident', 'resB:resident']);
    await finish(floor);

    const nullFloor = await raise('resN', 'N1');
    expect(
      (await recipients(nullFloor)).filter((r) => r.endsWith(':resident')),
    ).toEqual([]);
    await finish(nullFloor);

    const gate = await raise('guard1', null, { category: 'security' });
    expect(await recipients(gate)).toEqual(['admin:admin', 'guard2:guard']);
    await finish(gate);

    await settings(true, true, false, 'block');
    const block = await raise('resC', 'A3');
    expect(
      (await recipients(block)).filter((r) => r.endsWith(':resident')),
    ).toEqual([
      'resA2:resident',
      'resA:resident',
      'resB:resident',
      'resN:resident',
      'resNb:resident',
    ]);
    await finish(block);

    await settings(false, false, true, 'society');
    const everyone = await raise('resD', 'B1', {
      category: 'fire',
      note: 'Smoke in kitchen',
    });
    expect(await recipients(everyone)).toEqual([
      'committee:committee',
      'resA2:resident',
      'resA:resident',
      'resB:resident',
      'resC:resident',
      'resN:resident',
      'resNb:resident',
    ]);
    const residentView = await myAlerts('resB');
    expect(residentView.find((alert) => alert.id === everyone)).toMatchObject({
      audience: 'resident',
      note: null,
    });
    await finish(everyone);

    await db.asSuperuser((client) =>
      client.query(
        "create or replace function private.sos_resident_cap() returns integer language sql stable set search_path = '' as $$ select 2 $$",
      ),
    );
    try {
      const capped = await raise('resD', 'B1');
      const routed = await recipients(capped);
      expect(routed[0]).toBe('committee:committee');
      expect(routed.filter((r) => r.endsWith(':resident'))).toHaveLength(2);
      const truncated = await db.asSuperuser(async (client) =>
        client.query<{ after: { dropped: number; resident_cap: number } }>(
          "select after from public.audit_logs where action = 'sos.recipients_truncated' and entity_id = $1",
          [capped],
        ),
      );
      expect(truncated.rows.map((row) => row.after)).toEqual([
        { dropped: 4, resident_cap: 2 },
      ]);
      await finish(capped);
    } finally {
      await db.asSuperuser((client) =>
        client.query(
          "create or replace function private.sos_resident_cap() returns integer language sql stable set search_path = '' as $$ select 5000 $$",
        ),
      );
    }

    expect((await dbError(settings(false, false, false, 'off'))).code).toBe(
      '22023',
    );
    expect((await dbError(settings(true, true, false, 'street'))).code).toBe(
      '22023',
    );
    expect(
      (await dbError(settings(true, true, false, 'off', 'committee'))).code,
    ).toBe('42501');
    await settings(true, true, false, 'off');
  });

  it('enforces one open SOS per unit, three per rolling hour and idempotent retries', async () => {
    const key = crypto.randomUUID();
    const first = await raise('resB', 'A2', { key });
    expect(await raise('resB', 'A2', { key })).toBe(first);
    expect((await dbError(raise('resB', 'A2'))).code).toBe('55000');
    await run('resB', "select public.sos_cancel($1,$2,'sos-cancel')", [
      f.societyId,
      first,
    ]);
    const second = await raise('resB', 'A2');
    await finish(second);
    const third = await raise('resB', 'A2');
    await finish(third);
    expect((await dbError(raise('resB', 'A2'))).code).toBe('54000');
    await db.asSuperuser((client) =>
      client.query(
        "update public.sos_alerts set raised_at = raised_at - interval '61 minutes' where id=$1",
        [first],
      ),
    );
    const fourth = await raise('resB', 'A2');
    await finish(fourth);
    expect(
      (await dbError(raise('resB', 'A2', { note: 'x'.repeat(281) }))).code,
    ).toBe('22023');
    expect(
      (await dbError(raise('resB', 'A2', { category: 'flood' }))).code,
    ).toBe('22023');
  });

  it('runs the responder lifecycle with timestamps, audit rows and close-reason rules', async () => {
    const alertId = await raise('resC', 'A3', { category: 'security' });
    expect((await dbError(acknowledge('resA', alertId))).code).toBe('42501');
    expect(
      (
        await dbError(
          run(
            'guard1',
            "select public.sos_add_update($1,$2,'On the way','sos-update')",
            [f.societyId, alertId],
          ),
        )
      ).code,
    ).toBe('23505');
    expect((await dbError(close('guard1', alertId))).code).toBe('23505');
    await acknowledge('guard1', alertId);
    await acknowledge('committee', alertId);
    expect(
      (
        await dbError(
          run('resC', "select public.sos_cancel($1,$2,'sos-cancel')", [
            f.societyId,
            alertId,
          ]),
        )
      ).code,
    ).toBe('23505');
    await run(
      'committee',
      "select public.sos_add_update($1,$2,'Guard reached the flat','sos-update')",
      [f.societyId, alertId],
    );
    expect((await dbError(close('guard1', alertId, 'false_alarm'))).code).toBe(
      '22023',
    );
    expect((await dbError(close('guard1', alertId, 'other', '   '))).code).toBe(
      '22023',
    );
    expect(
      (await dbError(close('guard1', alertId, 'raised_by_mistake'))).code,
    ).toBe('22023');
    await close('admin', alertId, 'false_alarm', 'Child pressed the button');
    expect((await dbError(close('guard1', alertId))).code).toBe('23505');

    const result = await db.asSuperuser(async (client) => ({
      alert: (
        await client.query<{
          status: string;
          acknowledged_by: string;
          closed_by: string;
          close_reason: string;
          close_note: string;
          has_times: boolean;
        }>(
          'select status,acknowledged_by,closed_by,close_reason,close_note,(acknowledged_at>=raised_at and closed_at>=acknowledged_at) as has_times from public.sos_alerts where id=$1',
          [alertId],
        )
      ).rows[0]!,
      events: (
        await client.query<{ action: string }>(
          'select action from public.sos_alert_events where alert_id=$1 order by created_at,id',
          [alertId],
        )
      ).rows.map((row) => row.action),
      audit: (
        await client.query<{ action: string }>(
          "select action from public.audit_logs where entity_type='sos_alert' and entity_id=$1 order by id",
          [alertId],
        )
      ).rows.map((row) => row.action),
      raiserNotes: (
        await client.query<{ title: string }>(
          "select title from public.notifications where entity_id=$1 and user_id=$2 and type='sos_update' order by created_at",
          [alertId, f.users.get('resC')],
        )
      ).rows.map((row) => row.title),
    }));
    expect(result.alert).toEqual({
      status: 'closed',
      acknowledged_by: f.users.get('guard1'),
      closed_by: f.users.get('admin'),
      close_reason: 'false_alarm',
      close_note: 'Child pressed the button',
      has_times: true,
    });
    expect(result.events).toEqual([
      'raised',
      'acknowledged',
      'updated',
      'closed',
    ]);
    expect(result.audit).toEqual([
      'sos.raised',
      'sos.acknowledged',
      'sos.updated',
      'sos.closed',
    ]);
    expect(result.raiserNotes).toEqual([
      'SOS acknowledged',
      'SOS update',
      'SOS closed',
    ]);
    await expect(
      db.asSuperuser((client) =>
        client.query('delete from public.sos_alert_events where alert_id=$1', [
          alertId,
        ]),
      ),
    ).rejects.toThrow();
  });

  it('lets only the raiser cancel before acknowledgement as raised by mistake', async () => {
    const alertId = await raise('resA', 'A1');
    expect(
      (
        await dbError(
          run('resA2', "select public.sos_cancel($1,$2,'sos-cancel')", [
            f.societyId,
            alertId,
          ]),
        )
      ).code,
    ).toBe('P0002');
    await run('resA', "select public.sos_cancel($1,$2,'sos-cancel')", [
      f.societyId,
      alertId,
    ]);
    const state = await db.asSuperuser(async (client) => ({
      alert: (
        await client.query<{ status: string; close_reason: string }>(
          'select status,close_reason from public.sos_alerts where id=$1',
          [alertId],
        )
      ).rows[0]!,
      audit: (
        await client.query<{ action: string }>(
          "select action from public.audit_logs where entity_type='sos_alert' and entity_id=$1 order by id",
          [alertId],
        )
      ).rows.map((row) => row.action),
      cancelled: Number(
        (
          await client.query<{ count: string }>(
            "select count(*) from public.notifications where entity_id=$1 and title='SOS cancelled'",
            [alertId],
          )
        ).rows[0]!.count,
      ),
    }));
    expect(state.alert).toEqual({
      status: 'cancelled',
      close_reason: 'raised_by_mistake',
    });
    expect(state.audit).toEqual(['sos.raised', 'sos.cancelled']);
    expect(state.cancelled).toBe(3);
    expect((await dbError(acknowledge('guard1', alertId))).code).toBe('23505');
  });

  it('keeps banner alerts per recipient until each dismisses them', async () => {
    const alertId = await raise('resD', 'B1', { note: 'Gas smell' });
    expect((await myAlerts('guard1')).map((alert) => alert.id)).toContain(
      alertId,
    );
    expect((await myAlerts('guard1')).find((a) => a.id === alertId)?.note).toBe(
      'Gas smell',
    );
    await run('guard1', "select public.sos_alert_dismiss($1,'sos-dismiss')", [
      alertId,
    ]);
    await run('guard1', "select public.sos_alert_dismiss($1,'sos-dismiss')", [
      alertId,
    ]);
    expect((await myAlerts('guard1')).map((alert) => alert.id)).not.toContain(
      alertId,
    );
    expect((await myAlerts('guard2')).map((alert) => alert.id)).toContain(
      alertId,
    );
    expect(
      (
        await dbError(
          run('resA', "select public.sos_alert_dismiss($1,'sos-dismiss')", [
            alertId,
          ]),
        )
      ).code,
    ).toBe('P0002');
    await acknowledge('admin', alertId);
    expect((await myAlerts('admin')).map((alert) => alert.id)).not.toContain(
      alertId,
    );
    expect((await myAlerts('guard2')).map((alert) => alert.id)).toContain(
      alertId,
    );
    await close('admin', alertId);
    expect((await myAlerts('guard2')).map((alert) => alert.id)).not.toContain(
      alertId,
    );
    const dismissals = await db.asSuperuser(
      async (client) =>
        (
          await client.query<{ count: string }>(
            "select count(*) from public.audit_logs where action='sos.alert_dismissed' and entity_id=$1",
            [alertId],
          )
        ).rows[0]!.count,
    );
    expect(Number(dismissals)).toBe(1);
  });

  it('isolates societies and denies direct table access', async () => {
    const alertId = await raise('resA', 'A1');
    expect(
      (
        await dbError(
          run('outsiderAdmin', 'select public.sos_workspace($1) as data', [
            f.societyId,
          ]),
        )
      ).code,
    ).toBe('42501');
    expect(
      (await dbError(acknowledge('outsiderAdmin', alertId, f.otherSocietyId)))
        .code,
    ).toBe('P0002');
    expect(await myAlerts('outsiderAdmin')).toEqual([]);
    expect((await dbError(raise('resA', 'Z1'))).code).toBe('42501');
    expect(
      (await dbError(raise('outsiderRes', 'A1', { society: f.otherSocietyId })))
        .code,
    ).toBe('42501');
    expect(
      (await dbError(run('resA', 'select id from public.sos_alerts'))).code,
    ).toBe('42501');
    const residentWorkspace = (
      await run<{ data: { open: { id: string }[]; can_respond: boolean } }>(
        'resB',
        'select public.sos_workspace($1) as data',
        [f.societyId],
      )
    )[0]!.data;
    expect(residentWorkspace.can_respond).toBe(false);
    expect(residentWorkspace.open.map((alert) => alert.id)).not.toContain(
      alertId,
    );
    const householdWorkspace = (
      await run<{ data: { open: { id: string; can_cancel: boolean }[] } }>(
        'resA2',
        'select public.sos_workspace($1) as data',
        [f.societyId],
      )
    )[0]!.data;
    expect(householdWorkspace.open).toEqual([
      expect.objectContaining({ id: alertId, can_cancel: false }),
    ]);
    await finish(alertId);
  });

  it('refuses every operation while the module is disabled', async () => {
    const alertId = await raise('resB', 'A2');
    await setModule(false);
    try {
      expect((await dbError(raise('resC', 'A3'))).code).toBe('42501');
      expect((await dbError(acknowledge('guard1', alertId))).code).toBe(
        '42501',
      );
      expect(
        (
          await dbError(
            run('admin', 'select public.sos_workspace($1) as data', [
              f.societyId,
            ]),
          )
        ).code,
      ).toBe('42501');
      expect(
        (
          await dbError(
            run('guard1', "select public.sos_alert_dismiss($1,'sos-dismiss')", [
              alertId,
            ]),
          )
        ).code,
      ).toBe('42501');
      expect(await myAlerts('guard1')).toEqual([]);
    } finally {
      await setModule(true);
    }
    await finish(alertId);
  });

  it('seeds editable emergency contacts and hides archived ones from residents', async () => {
    type Contact = {
      id: string;
      label: string;
      phone: string;
      archived: boolean;
    };
    const contacts = async (user: string) =>
      (
        await run<{ data: { contacts: Contact[] } }>(
          user,
          'select public.sos_workspace($1) as data',
          [f.societyId],
        )
      )[0]!.data.contacts;
    expect(
      (await contacts('resA')).map((c) => `${c.label}:${c.phone}`),
    ).toEqual(['Emergency:112', 'Ambulance:108', 'Fire:101', 'Police:100']);
    const other = (
      await run<{ data: { contacts: Contact[] } }>(
        'outsiderRes',
        'select public.sos_workspace($1) as data',
        [f.otherSocietyId],
      )
    )[0]!.data.contacts;
    expect(other).toHaveLength(4);
    const save = (
      user: string,
      id: string | null,
      label: string,
      phone: string,
      order = 50,
    ) =>
      run<{ id: string }>(
        user,
        "select public.sos_contact_save($1,$2,$3,$4,$5,'sos-contact') as id",
        [f.societyId, id, label, phone, order],
      );
    const hospitalId = (
      await save('admin', null, 'City Hospital', '+91 22 1234-5678')
    )[0]!.id;
    expect((await dbError(save('resA', null, 'Mine', '123'))).code).toBe(
      '42501',
    );
    expect((await dbError(save('admin', null, 'Bad', 'call me'))).code).toBe(
      '22023',
    );
    expect(
      (await dbError(save('admin', crypto.randomUUID(), 'Nope', '123'))).code,
    ).toBe('P0002');
    await save('admin', hospitalId, 'City Hospital ER', '+91 22 1234-5678', 5);
    const police = (await contacts('admin')).find((c) => c.label === 'Police')!;
    await run(
      'admin',
      "select public.sos_contact_set_archived($1,$2,true,'sos-contact')",
      [f.societyId, police.id],
    );
    expect((await contacts('resA')).map((c) => c.label)).toEqual([
      'City Hospital ER',
      'Emergency',
      'Ambulance',
      'Fire',
    ]);
    expect((await contacts('admin')).at(-1)).toMatchObject({
      label: 'Police',
      archived: true,
    });
    const audit = await db.asSuperuser(async (client) =>
      (
        await client.query<{ action: string }>(
          "select action from public.audit_logs where entity_type='sos_contact' order by id",
        )
      ).rows.map((row) => row.action),
    );
    expect(audit).toEqual([
      'sos.contact.create',
      'sos.contact.update',
      'sos.contact.archive',
    ]);
  });
});
