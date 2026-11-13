// Every society-scoped RPC refuses a signed-in member of a different society (P10.1 cross-tenant check).
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  hasDatabase,
  newAuthUser,
} from './support/database';

const SAMPLE_BY_TYPE: Record<string, string> = {
  uuid: 'gen_random_uuid()',
  text: "'x'::text",
  'character varying': "'x'::varchar",
  citext: "'x@example.test'::citext",
  integer: '1',
  bigint: '1::bigint',
  smallint: '1::smallint',
  numeric: '1::numeric',
  boolean: 'false',
  date: 'current_date',
  'timestamp with time zone': 'now()',
  jsonb: "'{}'::jsonb",
  json: "'{}'::json",
  'text[]': "'{}'::text[]",
  'uuid[]': "'{}'::uuid[]",
};

interface SocietyScopedFunction {
  name: string;
  args: { name: string; type: string }[];
}

describe.skipIf(!hasDatabase)('cross-society RPC isolation', () => {
  it('refuses every society-scoped RPC for an admin of another society', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'admin-a@example.test');
        const ownerId = await newAuthUser(client, 'owner-b@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'admin-a@example.test', 'Admin A'),
                  ($2, 'owner-b@example.test', 'Owner B')`,
          [adminId, ownerId],
        );
        const societies = await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Society A', $1), ('Society B', $2) returning id`,
          [adminId, ownerId],
        );
        const [societyA, societyB] = societies.rows.map((row) => row.id);
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin','committee','guard','resident']::text[], 'active'),
                  ($3, $4, ARRAY['admin','resident']::text[], 'active')`,
          [societyA, adminId, societyB, ownerId],
        );
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
           select s.id, m.key, true,
                  case when m.key = 'service_request'
                    then '{"auto_close_days":3}'::jsonb else '{}'::jsonb end
           from public.societies s cross join public.modules m
           on conflict (society_id, module_key)
           do update set enabled = true, settings = excluded.settings`,
        );
        const functions = await client.query<SocietyScopedFunction>(
          `select p.proname as name,
                  json_agg(json_build_object(
                    'name', a.name, 'type', format_type(a.type, null)
                  ) order by a.ord) as args
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           cross join lateral unnest(
             p.proargnames[1:p.pronargs], p.proargtypes::oid[]
           ) with ordinality as a(name, type, ord)
           where n.nspname = 'public'
             and p.prokind = 'f'
             and has_function_privilege('authenticated', p.oid, 'EXECUTE')
             and 'p_society_id' = any(p.proargnames)
           group by p.oid, p.proname
           order by p.proname`,
        );
        return { adminId, ownerId, societyB, functions: functions.rows };
      });

      const victim = await database.asRole(
        'authenticated',
        { sub: fixture.ownerId },
        async (client) => {
          const category = await client.query<{ id: string }>(
            `select id from public.service_request_categories
             where society_id = $1 limit 1`,
            [fixture.societyB],
          );
          const request = await client.query<{ id: string }>(
            `select (public.request_create(
               $1, $2, 'common_area', null, 'Synthetic lift noise', 'normal',
               '[]'::jsonb, gen_random_uuid(), 'cross-society'
             )).id`,
            [fixture.societyB, category.rows[0]?.id],
          );
          await client.query(
            `select public.visitor_blacklist_add(
               $1, '+919800000001', 'Blocked', 'Synthetic', 'cross-society')`,
            [fixture.societyB],
          );
          return { requestId: request.rows[0]?.id, phone: '+919800000001' };
        },
        { commit: true },
      );
      expect(victim.requestId).toBeTruthy();
      const overrides: Record<string, string> = {
        'p_society_id uuid': `'${fixture.societyB}'::uuid`,
        'p_request_id uuid': `'${victim.requestId}'::uuid`,
        'p_phone text': `'${victim.phone}'`,
        'p_status text': "'in_progress'",
        'p_reason text': "'Synthetic outsider reason'",
        'p_rating integer': '5',
      };

      expect(fixture.functions.length).toBeGreaterThan(20);
      const tablesShowingSocietyB = (userId: string) =>
        database.asRole(
          'authenticated',
          { sub: userId, aal: 'aal2', session_id: crypto.randomUUID() },
          async (client) => {
            const tables = await client.query<{ table_name: string }>(
              `select c.table_name from information_schema.columns c
               where c.table_schema = 'public' and c.column_name = 'society_id'
                 and has_table_privilege('authenticated',
                   format('public.%I', c.table_name), 'SELECT')
               order by c.table_name`,
            );
            const showing: string[] = [];
            for (const { table_name } of tables.rows) {
              const rows = await client.query<{ count: string }>(
                `select count(*) from public.${table_name} where society_id = $1`,
                [fixture.societyB],
              );
              if (rows.rows[0]?.count !== '0') showing.push(table_name);
            }
            return { tables: tables.rows.length, showing };
          },
        );
      const outsider = await tablesShowingSocietyB(fixture.adminId);
      expect(outsider.tables).toBeGreaterThan(10);
      expect(outsider.showing, 'tables exposing another society').toEqual([]);
      // Control: the same queries do return society B rows to its own admin.
      const insider = await tablesShowingSocietyB(fixture.ownerId);
      expect(insider.showing).toEqual(
        expect.arrayContaining(['memberships', 'service_requests']),
      );

      const outcomes: { name: string; code: string }[] = [];
      for (const fn of fixture.functions) {
        const argumentList = fn.args
          .map(
            ({ name, type }) =>
              `${name} => ${overrides[`${name} ${type}`] ?? SAMPLE_BY_TYPE[type] ?? `null::${type}`}`,
          )
          .join(', ');
        const code = await database
          .asRole(
            'authenticated',
            {
              sub: fixture.adminId,
              aal: 'aal2',
              session_id: crypto.randomUUID(),
            },
            (client) =>
              client.query<{ result: unknown }>(
                `select public.${fn.name}(${argumentList}) as result`,
              ),
          )
          .then(
            ({ rows }) => (rows[0]?.result === false ? 'FALSE' : 'ALLOWED'),
            (error: { code?: string }) => error.code ?? 'unknown',
          );
        outcomes.push({ name: fn.name, code });
      }
      // P0002 is the deliberate "not found" answer that hides whether another society's row exists.
      const refused = new Set(['42501', 'P0002']);
      expect(
        outcomes.filter(
          ({ name, code }) =>
            !refused.has(code) &&
            !(name === 'visitor_blacklist_match' && code === 'FALSE'),
        ),
        'society-scoped RPCs that did not refuse an outsider',
      ).toEqual([]);
    } finally {
      await database.drop();
    }
  });
});
