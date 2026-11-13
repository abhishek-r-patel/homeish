// Verify society slugs, the create-society script's RPC path and the server-only host lookup.
import { describe, expect, it } from 'vitest';
import { applyOnboarding } from '../../scripts/create-society.mjs';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type Claims,
  type TestDatabase,
} from './support/database';

async function developerFixture(database: TestDatabase) {
  const fixture = await database.asSuperuser(async (client) => {
    const developerId = await newAuthUser(client, 'developer@example.test');
    const memberId = await newAuthUser(client, 'member@example.test');
    await client.query(
      `insert into public.profiles (id, email, full_name)
       values ($1, 'developer@example.test', 'Developer'),
              ($2, 'member@example.test', 'Member')`,
      [developerId, memberId],
    );
    await client.query('insert into public.developers (user_id) values ($1)', [
      developerId,
    ]);
    const sessionId = (
      await client.query<{ id: string }>(
        'insert into auth.sessions (user_id) values ($1) returning id',
        [developerId],
      )
    ).rows[0]?.id;
    if (!sessionId) throw new Error('Could not create a test session.');
    return { developerId, memberId, sessionId };
  });
  const claims: Claims = {
    sub: fixture.developerId,
    session_id: fixture.sessionId,
    aal: 'aal2',
  };
  await database.asRole(
    'authenticated',
    claims,
    (client) => client.query('select public.record_developer_mfa()'),
    { commit: true },
  );
  return { ...fixture, claims };
}

// Each call is one committed API request, as PostgREST runs the script's supabase-js RPCs.
function rpcAs(database: TestDatabase, claims: Claims) {
  return (name: string, args: Record<string, unknown>) => {
    if (!/^[a-z_]+$/.test(name)) throw new Error('Unexpected RPC name.');
    const keys = Object.keys(args);
    const named = keys.map((key, index) => `${key} => $${index + 1}`);
    return database.asRole(
      'authenticated',
      claims,
      async (client) =>
        (
          await client.query<{ result: unknown }>(
            `select public.${name}(${named.join(', ')}) as result`,
            keys.map((key) => args[key]),
          )
        ).rows[0]?.result,
      { commit: true },
    );
  };
}

const input = {
  slug: 'oak-grove',
  name: 'Oak Grove',
  address: '12 Example Road',
  city: 'Pune',
  adminEmail: 'admin@example.test',
  contactEmail: null,
  contactPhone: null,
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  unitLabel: 'Flat',
  plan: null,
  societyId: null,
};

describe.skipIf(!hasDatabase)('database society slugs', () => {
  it('onboards idempotently through audited developer RPCs', async () => {
    const database = await createTestDatabase();
    try {
      const { developerId, claims } = await developerFixture(database);
      const rpc = rpcAs(database, claims);
      const first = await applyOnboarding({
        rpc,
        input,
        requestId: 'run-1',
        log: () => {},
      });
      expect(first).toMatchObject({
        society: 'created',
        admin: 'invited',
        enabledModules: ['core'],
      });
      const again = await applyOnboarding({
        rpc,
        input,
        requestId: 'run-2',
        log: () => {},
      });
      expect(again).toMatchObject({
        societyId: first.societyId,
        society: 'reused',
        admin: 'reused',
      });

      const state = await database.asSuperuser(async (client) => {
        const society = await client.query(
          `select slug, status, address, city, unit_label, created_by
           from public.societies where id = $1`,
          [first.societyId],
        );
        const audit = await client.query<{
          action: string;
          request_id: string;
        }>(
          `select action, request_id from public.audit_logs
           where society_id = $1 order by action`,
          [first.societyId],
        );
        const modules = await client.query<{ module_key: string }>(
          `select module_key from public.module_configs
           where society_id = $1 and enabled`,
          [first.societyId],
        );
        const admin = await client.query(
          `select invited_email, roles, status from public.memberships
           where society_id = $1`,
          [first.societyId],
        );
        return {
          society: society.rows[0],
          audit: audit.rows,
          modules: modules.rows.map(({ module_key }) => module_key),
          admins: admin.rows,
        };
      });
      expect(state.society).toEqual({
        slug: 'oak-grove',
        status: 'trial',
        address: '12 Example Road',
        city: 'Pune',
        unit_label: 'Flat',
        created_by: developerId,
      });
      expect(state.audit).toEqual([
        { action: 'developer.members.createFirstAdmin', request_id: 'run-1' },
        { action: 'developer.societies.create', request_id: 'run-1' },
        { action: 'developer.societies.setSlug', request_id: 'run-1' },
      ]);
      expect(state.modules).toEqual(['core']);
      expect(state.admins).toEqual([
        {
          invited_email: 'admin@example.test',
          roles: ['admin'],
          status: 'invited',
        },
      ]);

      await expect(
        applyOnboarding({
          rpc,
          input: { ...input, adminEmail: 'other@example.test' },
          requestId: 'run-3',
          log: () => {},
        }),
      ).rejects.toThrow('already has an administrator');
    } finally {
      await database.drop();
    }
  });

  it('keeps slugs unique, valid, immutable and developer-only', async () => {
    const database = await createTestDatabase();
    try {
      const { memberId, sessionId, claims } = await developerFixture(database);
      const rpc = rpcAs(database, claims);
      const societyId = String(
        await rpc('developer_create_society_with_slug', {
          p_slug: 'oak-grove',
          p_name: 'Oak Grove',
          p_address: '',
          p_city: '',
          p_contact_email: '',
          p_contact_phone: '',
          p_timezone: 'Asia/Kolkata',
          p_currency: 'INR',
          p_unit_label: 'Unit',
          p_plan: '',
          p_request_id: 'create',
        }),
      );
      const unaddressed = String(
        await rpc('developer_create_society', {
          p_name: 'Oak Grove',
          p_address: '',
          p_city: '',
          p_contact_email: '',
          p_contact_phone: '',
          p_timezone: 'Asia/Kolkata',
          p_currency: 'INR',
          p_unit_label: 'Unit',
          p_plan: '',
          p_request_id: 'legacy',
        }),
      );

      const status = (await rpc('developer_society_onboarding_status', {
        p_slug: 'new-oak',
        p_name: ' oak grove ',
      })) as { society: unknown; unaddressedNameMatches: { id: string }[] };
      expect(status.society).toBeNull();
      expect(status.unaddressedNameMatches.map(({ id }) => id)).toEqual([
        unaddressed,
      ]);

      const duplicate = await dbError(
        rpc('developer_set_society_slug', {
          p_society_id: unaddressed,
          p_slug: 'oak-grove',
          p_request_id: 'dup',
        }),
      );
      expect(duplicate.code).toBe('23505');
      const failedCreate = await dbError(
        rpc('developer_create_society_with_slug', {
          p_slug: 'oak-grove',
          p_name: 'Second Oak',
          p_address: '',
          p_city: '',
          p_contact_email: '',
          p_contact_phone: '',
          p_timezone: 'Asia/Kolkata',
          p_currency: 'INR',
          p_unit_label: 'Unit',
          p_plan: '',
          p_request_id: 'dup-create',
        }),
      );
      expect(failedCreate.code).toBe('23505');
      for (const slug of ['beta', 'Bad', '-bad', 'a.b']) {
        const invalid = await dbError(
          rpc('developer_set_society_slug', {
            p_society_id: unaddressed,
            p_slug: slug,
            p_request_id: 'invalid',
          }),
        );
        expect(invalid.code).toBe('22023');
      }
      await rpc('developer_set_society_slug', {
        p_society_id: societyId,
        p_slug: 'oak-grove',
        p_request_id: 'same',
      });
      const changed = await dbError(
        rpc('developer_set_society_slug', {
          p_society_id: societyId,
          p_slug: 'oak-grove-two',
          p_request_id: 'change',
        }),
      );
      expect(changed.code).toBe('23505');
      const directChange = await dbError(
        database.asSuperuser((client) =>
          client.query(
            "update public.societies set slug = 'renamed' where id = $1",
            [societyId],
          ),
        ),
      );
      expect(directChange.code).toBe('23514');

      const counts = await database.asSuperuser(async (client) => {
        const result = await client.query<{ total: number }>(
          `select count(*)::int as total from public.societies`,
        );
        const slugAudits = await client.query<{ total: number }>(
          `select count(*)::int as total from public.audit_logs
           where action = 'developer.societies.setSlug'`,
        );
        return {
          societies: result.rows[0]?.total,
          slugAudits: slugAudits.rows[0]?.total,
        };
      });
      expect(counts).toEqual({ societies: 2, slugAudits: 1 });

      const denied = await dbError(
        database.asRole(
          'authenticated',
          { sub: memberId, session_id: sessionId, aal: 'aal2' },
          (client) =>
            client.query(
              "select public.developer_society_onboarding_status('oak-grove', 'Oak Grove')",
            ),
        ),
      );
      expect(denied.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });

  it('exposes the host lookup only to the server role', async () => {
    const database = await createTestDatabase();
    try {
      const { claims } = await developerFixture(database);
      const rpc = rpcAs(database, claims);
      const societyId = String(
        await rpc('developer_create_society_with_slug', {
          p_slug: 'oak-grove',
          p_name: 'Oak Grove',
          p_address: '',
          p_city: '',
          p_contact_email: '',
          p_contact_phone: '',
          p_timezone: 'Asia/Kolkata',
          p_currency: 'INR',
          p_unit_label: 'Unit',
          p_plan: '',
          p_request_id: 'create',
        }),
      );
      const lookup = (role: 'anon' | 'authenticated' | 'service_role') =>
        database.asRole(role, role === 'authenticated' ? claims : null, (c) =>
          c.query("select * from public.society_host_lookup('oak-grove')"),
        );
      for (const role of ['anon', 'authenticated'] as const) {
        expect((await dbError(lookup(role))).code).toBe('42501');
      }
      expect((await lookup('service_role')).rows).toEqual([
        { id: societyId, name: 'Oak Grove', status: 'trial' },
      ]);
      await rpc('developer_set_society_status', {
        p_society_id: societyId,
        p_status: 'archived',
        p_request_id: 'archive',
      });
      expect((await lookup('service_role')).rows).toEqual([]);
    } finally {
      await database.drop();
    }
  });
});
