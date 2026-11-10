// Verify developer-console mutations are MFA-bound and audited transactionally.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database developer console', () => {
  it('denies developer operations without a verified developer session', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const developerId = await newAuthUser(client, 'developer@example.test');
        const memberId = await newAuthUser(client, 'member@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values
             ($1, 'developer@example.test', 'Developer'),
             ($2, 'member@example.test', 'Member')`,
          [developerId, memberId],
        );
        await client.query(
          'insert into public.developers (user_id) values ($1)',
          [developerId],
        );
        const sessionId = (
          await client.query<{ id: string }>(
            'insert into auth.sessions (user_id) values ($1) returning id',
            [developerId],
          )
        ).rows[0]?.id;
        if (!sessionId) throw new Error('Could not create a test session.');
        return { developerId, memberId, sessionId };
      });

      const noMfa = await dbError(
        database.asRole(
          'authenticated',
          {
            sub: fixture.developerId,
            session_id: fixture.sessionId,
            aal: 'aal2',
          },
          (client) =>
            client.query(
              `select public.developer_create_society(
                'Denied Society', null, null, null, null,
                'Asia/Kolkata', 'INR', 'Unit', null, 'test-request'
              )`,
            ),
        ),
      );
      expect(noMfa.code).toBe('42501');

      const nonDeveloper = await dbError(
        database.asRole(
          'authenticated',
          {
            sub: fixture.memberId,
            session_id: fixture.sessionId,
            aal: 'aal2',
          },
          (client) =>
            client.query(
              `select public.developer_create_society(
                'Denied Society', null, null, null, null,
                'Asia/Kolkata', 'INR', 'Unit', null, 'test-request'
              )`,
            ),
        ),
      );
      expect(nonDeveloper.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });

  it('creates and manages society configuration with atomic audit records', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const developerId = await newAuthUser(client, 'developer@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'developer@example.test', 'Developer')`,
          [developerId],
        );
        await client.query(
          'insert into public.developers (user_id) values ($1)',
          [developerId],
        );
        const sessionId = (
          await client.query<{ id: string }>(
            'insert into auth.sessions (user_id) values ($1) returning id',
            [developerId],
          )
        ).rows[0]?.id;
        if (!sessionId) throw new Error('Could not create a test session.');
        await client.query(
          `insert into public.error_logs (
            reference_id, source, severity, message, route
          ) values ('ERR-TEST1', 'server', 'error', 'Synthetic failure', '/test')`,
        );
        return { developerId, sessionId };
      });

      const claims = {
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

      const societyId = await database.asRole(
        'authenticated',
        claims,
        async (client) => {
          const created = await client.query<{ id: string }>(
            `select public.developer_create_society(
              'Oak Grove', '12 Example Road', 'Pune',
              'office@example.test', '+919876543210',
              'Asia/Kolkata', 'INR', 'Flat', 'pilot',
              'request-create'
            ) as id`,
          );
          const id = created.rows[0]?.id;
          if (!id) throw new Error('Society creation returned no identifier.');
          return id;
        },
        { commit: true },
      );

      const configured = await database.asRole(
        'authenticated',
        claims,
        async (client) => {
          const initialConfig = await client.query<{
            enabled: boolean;
            settings: unknown;
          }>(
            `select enabled, settings from public.module_configs
             where society_id = $1 and module_key = 'core'`,
            [societyId],
          );
          const createdAdmin = await client.query<{
            id: string;
            status: string;
          }>(
            `select (result.membership).id as id,
                    (result.membership).status as status
             from (
               select public.developer_create_first_admin(
                 $1, 'admin@example.test', 'request-admin'
               ) as membership
             ) as result`,
            [societyId],
          );
          const adminId = createdAdmin.rows[0]?.id;
          if (!adminId)
            throw new Error('First admin invitation was not saved.');
          return {
            initialConfig: initialConfig.rows[0],
            adminStatus: createdAdmin.rows[0]?.status,
          };
        },
        { commit: true },
      );
      expect(configured.initialConfig).toEqual({ enabled: true, settings: {} });

      const repeatedAdmin = await dbError(
        database.asRole('authenticated', claims, (client) =>
          client.query(
            `select public.developer_create_first_admin(
                $1, 'other-admin@example.test', 'request-admin-duplicate'
              )`,
            [societyId],
          ),
        ),
      );
      expect(repeatedAdmin.code).toBe('23505');

      const changes = await database.asRole(
        'authenticated',
        claims,
        async (client) => {
          await client.query(
            `select public.developer_update_society(
              $1, 'Oak Grove Residences', '12 Example Road', 'Pune',
              'office@example.test', '+919876543210',
              'Asia/Kolkata', 'INR', 'Home', 'pilot',
              'request-update'
            )`,
            [societyId],
          );
          await client.query(
            `select public.developer_toggle_module(
              $1, 'visitor', true, 'request-enable'
            )`,
            [societyId],
          );
          await client.query(
            `select public.developer_update_module_settings(
              $1, 'visitor', '{"photo_required": true}'::jsonb,
              'request-settings'
            )`,
            [societyId],
          );
          await client.query(
            `select public.developer_set_society_status(
              $1, 'suspended', 'request-suspend'
            )`,
            [societyId],
          );
          const errorStatus = await client.query<{ status: string }>(
            `select (public.developer_set_error_status(
              (select id from public.error_logs where reference_id = 'ERR-TEST1'),
              'resolved',
              'Synthetic issue resolved',
              'request-resolve'
            )).status as status`,
          );
          const auditRows = await client.query<{ action: string }>(
            `select action from public.audit_logs
             where actor_id = $1
             order by action`,
            [fixture.developerId],
          );
          const health = await client.query<{
            summary: Record<string, unknown>;
          }>('select public.developer_health_summary() as summary');
          return {
            auditActions: auditRows.rows.map(({ action }) => action),
            errorStatus: errorStatus.rows[0]?.status,
            healthSummary: health.rows[0]?.summary,
          };
        },
        { commit: true },
      );
      const coreToggle = await dbError(
        database.asRole('authenticated', claims, (client) =>
          client.query(
            `select public.developer_toggle_module(
                $1, 'core', false, 'request-disable-core'
              )`,
            [societyId],
          ),
        ),
      );

      expect(coreToggle.code).toBe('22023');
      expect(configured.adminStatus).toBe('invited');
      expect(changes.auditActions).toEqual(
        expect.arrayContaining([
          'developer.errors.resolved',
          'developer.members.createFirstAdmin',
          'developer.modules.toggle',
          'developer.modules.updateSettings',
          'developer.societies.create',
          'developer.societies.setStatus',
          'developer.societies.update',
        ]),
      );
      expect(changes.errorStatus).toBe('resolved');
      expect(changes.healthSummary).toMatchObject({
        last24HoursBySeverity: { error: 1 },
        topRoutes: [{ route: '/test', total: 1 }],
      });
    } finally {
      await database.drop();
    }
  });
});
