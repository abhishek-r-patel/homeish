// Prove P55 search, pin, request, onboarding and calendar isolation rules.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('P55 workspace database contracts', () => {
  it('limits record search and pins to the caller role and society', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'p55-admin@example.test');
        const guardId = await newAuthUser(client, 'p55-guard@example.test');
        const residentId = await newAuthUser(
          client,
          'p55-resident@example.test',
        );
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values
             ($1, 'p55-admin@example.test', 'Alpha Person'),
             ($2, 'p55-guard@example.test', 'Gate Guard'),
             ($3, 'p55-resident@example.test', 'Beta Person')`,
          [adminId, guardId, residentId],
        );
        const societies = await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('P55 Search A', $1), ('P55 Search B', $1)
           returning id`,
          [adminId],
        );
        const [societyA, societyB] = societies.rows.map((row) => row.id);
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values
             ($1, $2, ARRAY['admin','resident']::text[], 'active'),
             ($1, $3, ARRAY['guard']::text[], 'active'),
             ($1, $4, ARRAY['resident']::text[], 'active'),
             ($5, $4, ARRAY['admin']::text[], 'active')`,
          [societyA, adminId, guardId, residentId, societyB],
        );
        const block = await client.query<{ id: string }>(
          `insert into public.blocks (society_id, name, created_by)
           values ($1, 'Alpha Block', $2) returning id`,
          [societyA, adminId],
        );
        const unit = await client.query<{ id: string }>(
          `insert into public.units
             (society_id, block_id, number, created_by)
           values ($1, $2, 'A-101', $3) returning id`,
          [societyA, block.rows[0]!.id, adminId],
        );
        const membership = await client.query<{ id: string }>(
          `select id from public.memberships
           where society_id = $1 and user_id = $2`,
          [societyA, residentId],
        );
        await client.query(
          `insert into public.unit_occupants
             (society_id, unit_id, membership_id, relationship, status, created_by)
           values ($1, $2, $3, 'owner', 'active', $4)`,
          [societyA, unit.rows[0]!.id, membership.rows[0]!.id, adminId],
        );
        await client.query(
          `insert into public.module_configs
             (society_id, module_key, enabled, settings)
           values
             ($1, 'directory', true, '{}'::jsonb),
             ($1, 'billing', true, '{}'::jsonb)
           on conflict (society_id, module_key) do update
           set enabled = true`,
          [societyA],
        );
        await client.query(
          `insert into public.directory_vehicles
             (society_id, unit_id, membership_id, vehicle_type,
              registration_number, client_request_id, created_by)
           values ($1, $2, $3, 'car', 'MH01AB1234', gen_random_uuid(), $4)`,
          [societyA, unit.rows[0]!.id, membership.rows[0]!.id, adminId],
        );
        await client.query(
          `insert into public.billing_bills
             (society_id, unit_id, title, period_start, due_date,
              total_paise, created_by)
           values (
             $1, $2, 'P55 resident bill',
             date_trunc('month', current_date),
             current_date + 2, 10000, $3
           )`,
          [societyA, unit.rows[0]!.id, adminId],
        );
        return { adminId, guardId, residentId, societyA, societyB };
      });

      const asAdmin = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query(
            'select * from public.workspace_search_records($1, $2)',
            [fixture.societyA, 'alpha'],
          ),
      );
      expect(asAdmin.rows.map((row) => row.kind).sort()).toEqual([
        'flat',
        'person',
      ]);
      const asGuard = await database.asRole(
        'authenticated',
        { sub: fixture.guardId },
        (client) =>
          client.query(
            'select * from public.workspace_search_records($1, $2)',
            [fixture.societyA, 'MH01AB1234'],
          ),
      );
      expect(asGuard.rows).toEqual([
        expect.objectContaining({ kind: 'vehicle', title: 'MH01AB1234' }),
      ]);
      expect(
        (
          await database.asRole(
            'authenticated',
            { sub: fixture.guardId },
            (client) =>
              client.query(
                'select * from public.workspace_search_records($1, $2)',
                [fixture.societyA, 'Beta'],
              ),
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await dbError(
            database.asRole(
              'authenticated',
              { sub: fixture.residentId },
              (client) =>
                client.query(
                  'select * from public.workspace_search_records($1, $2)',
                  [fixture.societyA, 'Alpha'],
                ),
            ),
          )
        ).code,
      ).toBe('42501');
      expect(
        (
          await dbError(
            database.asRole(
              'authenticated',
              { sub: fixture.adminId },
              (client) =>
                client.query(
                  'select * from public.workspace_search_records($1, $2)',
                  [fixture.societyB, 'Alpha'],
                ),
            ),
          )
        ).code,
      ).toBe('42501');

      await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query(
            `select public.workspace_quick_action_pins_save(
               $1, ARRAY['notice.create','billing.view']::text[]
             )`,
            [fixture.societyA],
          ),
        { commit: true },
      );
      const ownPins = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) =>
          (
            await client.query<{ value: string[] }>(
              'select public.workspace_quick_action_pins_get($1) as value',
              [fixture.societyA],
            )
          ).rows[0]?.value,
      );
      expect(ownPins).toEqual(['notice.create', 'billing.view']);
      const otherPins = await database.asRole(
        'authenticated',
        { sub: fixture.guardId },
        async (client) =>
          (
            await client.query<{ value: string[] | null }>(
              'select public.workspace_quick_action_pins_get($1) as value',
              [fixture.societyA],
            )
          ).rows[0]?.value,
      );
      expect(otherPins).toBeNull();
      const calendar = await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query(
            `select * from public.workspace_calendar_get(
               $1, now() - interval '1 day', now() + interval '10 days'
             )`,
            [fixture.societyA],
          ),
      );
      expect(calendar.rows.map((row) => row.title)).toEqual([
        'P55 resident bill',
      ]);
    } finally {
      await database.drop();
    }
  });

  it('keeps onboarding developer-only and feature requests society-owned', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'p55-admin2@example.test');
        const committeeId = await newAuthUser(
          client,
          'p55-committee@example.test',
        );
        const developerId = await newAuthUser(
          client,
          'p55-developer@example.test',
        );
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values
             ($1, 'p55-admin2@example.test', 'P55 Admin'),
             ($2, 'p55-committee@example.test', 'P55 Committee'),
             ($3, 'p55-developer@example.test', 'P55 Developer')`,
          [adminId, committeeId, developerId],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('P55 Requests', $1) returning id`,
            [adminId],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values
             ($1, $2, ARRAY['admin']::text[], 'active'),
             ($1, $3, ARRAY['committee']::text[], 'active')`,
          [societyId, adminId, committeeId],
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
        ).rows[0]!.id;
        return {
          adminId,
          committeeId,
          developerId,
          sessionId,
          societyId,
        };
      });
      const requestId = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select public.society_feature_request_create(
                 $1, 'metering', 'Need utility readings'
               ) as id`,
              [fixture.societyId],
            )
          ).rows[0]!.id,
        { commit: true },
      );
      expect(
        (
          await dbError(
            database.asRole(
              'authenticated',
              { sub: fixture.committeeId },
              (client) =>
                client.query(
                  `select public.society_feature_request_create(
                     $1, 'metering', 'Committee attempt'
                   )`,
                  [fixture.societyId],
                ),
            ),
          )
        ).code,
      ).toBe('42501');
      expect(
        (
          await database.asRole(
            'authenticated',
            { sub: fixture.adminId },
            (client) =>
              client.query(
                'select * from public.society_feature_requests_get($1)',
                [fixture.societyId],
              ),
          )
        ).rows,
      ).toHaveLength(1);

      expect(
        (
          await dbError(
            database.asRole(
              'authenticated',
              { sub: fixture.adminId },
              (client) =>
                client.query(
                  'select public.developer_onboarding_record_get($1)',
                  [fixture.societyId],
                ),
            ),
          )
        ).code,
      ).toBe('42501');
      const developerClaims = {
        sub: fixture.developerId,
        session_id: fixture.sessionId,
        aal: 'aal2',
      };
      await database.asRole(
        'authenticated',
        developerClaims,
        (client) => client.query('select public.record_developer_mfa()'),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        developerClaims,
        (client) =>
          client.query(
            `select public.developer_onboarding_record_save(
               $1, 'setting_up', ARRAY['billing','metering']::text[],
               '2026-12-01', 'Private Contact', '+919800000001',
               'private@example.test', 'Private implementation note'
             )`,
            [fixture.societyId],
          ),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        developerClaims,
        (client) =>
          client.query(
            'select public.developer_feature_request_status_set($1, $2)',
            [requestId, 'agreed'],
          ),
        { commit: true },
      );
      const audit = await database.asSuperuser((client) =>
        client.query<{ before: unknown; after: unknown }>(
          `select "before", "after" from public.audit_logs
           where action = 'society.onboarding.update'
           order by id desc limit 1`,
        ),
      );
      expect(JSON.stringify(audit.rows[0])).not.toContain('+919800000001');
      expect(JSON.stringify(audit.rows[0])).not.toContain(
        'private@example.test',
      );
      const record = await database.asRole(
        'authenticated',
        developerClaims,
        async (client) =>
          (
            await client.query<{ value: unknown }>(
              `select public.developer_onboarding_record_get($1) as value`,
              [fixture.societyId],
            )
          ).rows[0]!.value,
      );
      expect(record).toMatchObject({
        stage: 'setting_up',
        contact_phone: '+919800000001',
        contact_email: 'private@example.test',
      });
      const setup = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) =>
          (
            await client.query<{
              value: { dismissed: boolean; steps: unknown[] };
            }>('select public.society_getting_started_get($1) as value', [
              fixture.societyId,
            ])
          ).rows[0]!.value,
      );
      expect(setup.dismissed).toBe(false);
      expect(setup.steps).toHaveLength(7);
      await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query(
            'select public.society_getting_started_dismiss($1, true)',
            [fixture.societyId],
          ),
        { commit: true },
      );
      expect(
        (
          await database.asRole(
            'authenticated',
            { sub: fixture.adminId },
            async (client) =>
              (
                await client.query<{ value: { dismissed: boolean } }>(
                  'select public.society_getting_started_get($1) as value',
                  [fixture.societyId],
                )
              ).rows[0]!.value,
          )
        ).dismissed,
      ).toBe(true);
    } finally {
      await database.drop();
    }
  });
});
