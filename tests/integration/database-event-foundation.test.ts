// Verify event tables, RPC ACLs, record-protection triggers and the module-disabled refusal.
import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  type TestDatabase,
} from './support/database';

const EVENT_TABLES = [
  'events',
  'event_audience_blocks',
  'event_rsvps',
  'event_rsvp_charges',
];

interface Fixture {
  societyId: string;
  admin: string;
  committee: string;
  owner: string;
  guard: string;
  unitId: string;
}

const requestId = (label: string) => `test-${label}-${crypto.randomUUID()}`;

describe.skipIf(!hasDatabase)('event database foundation', () => {
  let database: TestDatabase;
  let fixture: Fixture;

  const call = async (
    userId: string | null,
    name: string,
    args: unknown[],
  ): Promise<Record<string, unknown>> => {
    const parameters = args.map((_, index) => `$${index + 1}`).join(',');
    const run = (client: Client) =>
      client.query<{ value: Record<string, unknown> }>(
        `select public.${name}(${parameters}) as value`,
        args,
      );
    const result =
      userId === null
        ? await database.asRole('service_role', {}, run, { commit: true })
        : await database.asRole('authenticated', { sub: userId }, run, {
            commit: true,
          });
    return result.rows[0]!.value;
  };

  const setModule = (key: string, enabled: boolean) =>
    database.asSuperuser((client) =>
      client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,$2,$3,'{}') on conflict(society_id,module_key)
         do update set enabled=excluded.enabled`,
        [fixture.societyId, key, enabled],
      ),
    );

  const eventInput = (startsInHours: number) => ({
    title: 'Synthetic Diwali get-together',
    description: null,
    venue: 'Clubhouse',
    startsAt: new Date(Date.now() + startsInHours * 3_600_000).toISOString(),
    endsAt: new Date(
      Date.now() + (startsInHours + 3) * 3_600_000,
    ).toISOString(),
    rsvpDeadline: null,
    capacity: 10,
    maxPerUnit: 4,
    contributionType: 'per_head',
    contributionPaise: 25_000,
    audience: { scope: 'all' },
  });

  const publishedEvent = async (startsInHours = 72) => {
    const created = await call(fixture.committee, 'event_create', [
      fixture.societyId,
      crypto.randomUUID(),
      eventInput(startsInHours),
      requestId('create'),
    ]);
    const published = await call(fixture.committee, 'event_publish', [
      fixture.societyId,
      created.eventId,
      created.version,
      requestId('publish'),
    ]);
    return { eventId: created.eventId as string, version: published.version };
  };

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await database.asSuperuser(async (client) => {
      const ids = Array.from({ length: 4 }, () => crypto.randomUUID());
      const [admin, committee, owner, guard] = ids as [
        string,
        string,
        string,
        string,
      ];
      await client.query(
        `insert into auth.users(id,email) select id, id::text || '@example.test'
         from unnest($1::uuid[]) as id`,
        [ids],
      );
      await client.query(
        `insert into public.profiles(id,email,full_name)
         select id, id::text || '@example.test', 'Synthetic event member'
         from unnest($1::uuid[]) as id`,
        [ids],
      );
      const societyId = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by)
           values('Synthetic Event Society',$1) returning id`,
          [admin],
        )
      ).rows[0]!.id;
      const members = await client.query<{ id: string; user_id: string }>(
        `insert into public.memberships(society_id,user_id,roles,status)
         values($1,$2,'{admin}','active'),($1,$3,'{committee}','active'),
               ($1,$4,'{resident}','active'),($1,$5,'{guard}','active')
         returning id,user_id`,
        [societyId, admin, committee, owner, guard],
      );
      await client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,'core',true,'{}'),($1,'event',true,'{}'),($1,'billing',true,'{}')
         on conflict(society_id,module_key) do update set enabled=true`,
        [societyId],
      );
      const blockId = (
        await client.query<{ id: string }>(
          `insert into public.blocks(society_id,name,created_by)
           values($1,'A',$2) returning id`,
          [societyId, admin],
        )
      ).rows[0]!.id;
      const unitId = (
        await client.query<{ id: string }>(
          `insert into public.units(society_id,block_id,number,created_by)
           values($1,$2,'101',$3) returning id`,
          [societyId, blockId, admin],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.unit_occupants(society_id,unit_id,membership_id,relationship,is_primary,status,created_by)
         values($1,$2,$3,'owner',true,'active',$4)`,
        [
          societyId,
          unitId,
          members.rows.find((row) => row.user_id === owner)!.id,
          admin,
        ],
      );
      return { societyId, admin, committee, owner, guard, unitId };
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps every event table tenant-scoped, RLS-enabled and inaccessible directly', async () => {
    const tables = await database.asSuperuser((client) =>
      client.query(
        `select c.relname as table_name,
          coalesce((select column_info.is_nullable='NO' from information_schema.columns column_info
            where column_info.table_schema='public' and column_info.table_name=c.relname
              and column_info.column_name='society_id'),false) as society_id_required,
          c.relrowsecurity as rls_enabled,
          exists(select 1 from pg_policies policy
            where policy.schemaname='public' and policy.tablename=c.relname
              and policy.policyname=c.relname || '_no_direct_access'
              and policy.qual='false' and policy.with_check='false') as deny_policy,
          has_table_privilege('anon', c.oid, 'select') as anon_select,
          has_table_privilege('authenticated', c.oid, 'select') as authenticated_select,
          has_table_privilege('authenticated', c.oid, 'insert') as authenticated_insert,
          has_table_privilege('service_role', c.oid, 'select') as service_select,
          exists(select 1 from pg_trigger trigger_info
            where trigger_info.tgrelid=c.oid and not trigger_info.tgisinternal
              and (trigger_info.tgtype & 32)<>0) as truncate_guard
         from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relname=any($1::text[])
         order by c.relname`,
        [EVENT_TABLES],
      ),
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(
      [...EVENT_TABLES].sort(),
    );
    for (const table of tables.rows) {
      expect(table).toMatchObject({
        society_id_required: true,
        rls_enabled: true,
        deny_policy: true,
        anon_select: false,
        authenticated_select: false,
        authenticated_insert: false,
        service_select: false,
        truncate_guard: true,
      });
    }
  });

  it('exposes final SECURITY DEFINER RPC signatures only to their intended roles', async () => {
    const functions = await database.asSuperuser((client) =>
      client.query(
        `select p.proname as name,
          p.proargnames[1]='p_society_id' as society_first,
          p.prosecdef as is_definer,
          'search_path=""'=any(p.proconfig) as safe_search_path,
          exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
            where acl.grantee=0 and acl.privilege_type='EXECUTE') as public_execute,
          has_function_privilege('anon',p.oid,'execute') as anon_execute,
          has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
          has_function_privilege('service_role',p.oid,'execute') as service_execute
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname like 'event\\_%' escape '\\'
         order by p.proname`,
      ),
    );
    expect(functions.rows.map((row) => row.name)).toEqual([
      'event_admin_get',
      'event_admin_list',
      'event_block_options',
      'event_cancel',
      'event_create',
      'event_draft_delete',
      'event_member_get',
      'event_member_list',
      'event_publish',
      'event_reminders_run',
      'event_rsvp_set',
      'event_update',
    ]);
    for (const fn of functions.rows) {
      expect(fn).toMatchObject({
        society_first: true,
        is_definer: true,
        safe_search_path: true,
        public_execute: false,
        anon_execute: false,
        authenticated_execute: fn.name !== 'event_reminders_run',
        service_execute: fn.name === 'event_reminders_run',
      });
    }
  });

  it('charges a going RSVP once on the ledger and keeps charges append-only', async () => {
    const { eventId } = await publishedEvent();
    const rsvp = await call(fixture.owner, 'event_rsvp_set', [
      fixture.societyId,
      eventId,
      fixture.unitId,
      'going',
      2,
      null,
      requestId('rsvp'),
    ]);
    expect(rsvp).toMatchObject({
      status: 'going',
      headcount: 2,
      version: 1,
      chargedPaise: 50_000,
    });
    const ledger = await database.asSuperuser((client) =>
      client.query(
        `select entry.direction, entry.amount_paise::integer as amount
         from public.event_rsvp_charges charge
         join public.billing_ledger_entries entry on entry.id=charge.ledger_entry_id
         where charge.society_id=$1 and charge.rsvp_id=$2`,
        [fixture.societyId, rsvp.rsvpId],
      ),
    );
    expect(ledger.rows).toEqual([{ direction: 'debit', amount: 50_000 }]);

    for (const sql of [
      'update public.event_rsvp_charges set amount_paise=1 where rsvp_id=$1',
      'delete from public.event_rsvp_charges where rsvp_id=$1',
      'delete from public.event_rsvps where id=$1',
    ]) {
      expect(
        (
          await dbError(
            database.asSuperuser((client) => client.query(sql, [rsvp.rsvpId])),
          )
        ).code,
      ).toBe('55000');
    }
    for (const table of EVENT_TABLES) {
      expect(
        (
          await dbError(
            database.asSuperuser((client) =>
              client.query(`truncate public.${table} cascade`),
            ),
          )
        ).code,
      ).toBe('55000');
    }
    expect(
      (
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              'update public.events set contribution_paise=1 where id=$1',
              [eventId],
            ),
          ),
        )
      ).code,
    ).toBe('55000');
  });

  it('refuses guards and every call, including the reminder job, while the module is disabled', async () => {
    expect(
      (
        await dbError(
          call(fixture.guard, 'event_member_list', [fixture.societyId, null]),
        )
      ).code,
    ).toBe('42501');
    expect(
      (
        await dbError(
          call(fixture.guard, 'event_admin_list', [
            fixture.societyId,
            null,
            20,
            0,
          ]),
        )
      ).code,
    ).toBe('42501');

    const { eventId } = await publishedEvent(24);
    await call(fixture.owner, 'event_rsvp_set', [
      fixture.societyId,
      eventId,
      fixture.unitId,
      'going',
      1,
      null,
      requestId('rsvp'),
    ]);
    await setModule('event', false);
    try {
      for (const [user, name, args] of [
        [fixture.admin, 'event_admin_get', [fixture.societyId, eventId]],
        [fixture.owner, 'event_member_get', [fixture.societyId, eventId]],
        [fixture.committee, 'event_block_options', [fixture.societyId]],
      ] as const) {
        expect((await dbError(call(user, name, [...args]))).code).toBe('42501');
      }
      expect(
        await call(null, 'event_reminders_run', [
          fixture.societyId,
          requestId('reminders'),
        ]),
      ).toEqual({ events: 0, notified: 0 });
    } finally {
      await setModule('event', true);
    }
    await database.asSuperuser((client) =>
      client.query(
        `update public.events set starts_at=(date_trunc('day', now() at time zone 'Asia/Kolkata')
           + interval '1 day 18 hours') at time zone 'Asia/Kolkata',
           ends_at=(date_trunc('day', now() at time zone 'Asia/Kolkata')
           + interval '1 day 21 hours') at time zone 'Asia/Kolkata'
         where id=$1`,
        [eventId],
      ),
    );
    const reminders = await call(null, 'event_reminders_run', [
      fixture.societyId,
      requestId('reminders'),
    ]);
    expect(reminders).toMatchObject({ notified: 1 });
    expect(reminders.events).toBeGreaterThanOrEqual(1);
    expect(
      await call(null, 'event_reminders_run', [
        fixture.societyId,
        requestId('reminders'),
      ]),
    ).toEqual({ events: 0, notified: 0 });
  });
});
