import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('P54 workspace database contracts', () => {
  it('isolates preferences, developer defaults and setting-edit access', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'p54-admin@example.test');
        const residentId = await newAuthUser(
          client,
          'p54-resident@example.test',
        );
        const developerId = await newAuthUser(
          client,
          'p54-developer@example.test',
        );
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values
             ($1, 'p54-admin@example.test', 'P54 Admin'),
             ($2, 'p54-resident@example.test', 'P54 Resident'),
             ($3, 'p54-developer@example.test', 'P54 Developer')`,
          [adminId, residentId, developerId],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('P54 Society', $1) returning id`,
            [adminId],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.memberships
             (society_id, user_id, roles, status)
           values
             ($1, $2, ARRAY['admin','resident']::text[], 'active'),
             ($1, $3, ARRAY['resident']::text[], 'active')`,
          [societyId, adminId, residentId],
        );
        await client.query(
          `insert into public.module_configs
             (society_id, module_key, enabled, settings)
           values
             ($1, 'delivery', true,
              '{"response_timeout_minutes":3,"uncollected_days":3,"leave_at_gate_enabled":true}'::jsonb)
           on conflict (society_id, module_key)
           do update set enabled = true, settings = excluded.settings`,
          [societyId],
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
          residentId,
          developerId,
          societyId,
          sessionId,
        };
      });

      await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query(
            `select public.person_workspace_preferences_save(
               $1, 'home', 'bills'
             )`,
            [fixture.societyId],
          ),
        { commit: true },
      );
      const preference = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) =>
          (
            await client.query(
              `select * from public.person_workspace_preferences_get($1)`,
              [fixture.societyId],
            )
          ).rows[0],
      );
      expect(preference).toEqual({
        starting_place: 'home',
        resident_graph_mode: 'bills',
      });
      const otherRows = await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        async (client) =>
          (
            await client.query(
              `select * from public.person_workspace_preferences_get($1)`,
              [fixture.societyId],
            )
          ).rows.length,
      );
      expect(otherRows).toBe(0);

      const memberDefaults = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) =>
          (
            await client.query<{ value: string[] }>(
              `select public.workspace_quick_action_defaults_get(
                 $1, 'resident'
               ) as value`,
              [fixture.societyId],
            )
          ).rows[0]?.value,
      );
      expect(memberDefaults).toContain('visitor.preapprove');
      expect(
        (
          await dbError(
            database.asRole(
              'authenticated',
              { sub: fixture.adminId },
              (client) =>
                client.query(
                  `select public.workspace_quick_action_defaults_save(
                     $1, 'resident', ARRAY['household.view']::text[]
                   )`,
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
            `select public.workspace_quick_action_defaults_save(
               $1, 'resident', ARRAY['household.view']::text[]
             )`,
            [fixture.societyId],
          ),
        { commit: true },
      );
      const overridden = await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        async (client) =>
          (
            await client.query<{ value: string[] }>(
              `select public.workspace_quick_action_defaults_get(
                 $1, 'resident'
               ) as value`,
              [fixture.societyId],
            )
          ).rows[0]?.value,
      );
      expect(overridden).toEqual(['household.view']);

      await database.asRole(
        'authenticated',
        developerClaims,
        (client) =>
          client.query(
            `select public.module_setting_access_set(
               $1, 'delivery', 'response_timeout_minutes', false
             )`,
            [fixture.societyId],
          ),
        { commit: true },
      );
      const deniedSetting = await dbError(
        database.asRole('authenticated', { sub: fixture.adminId }, (client) =>
          client.query(
            `select public.delivery_settings_update(
                 $1,
                 '{"response_timeout_minutes":5,"uncollected_days":3,"leave_at_gate_enabled":true}'::jsonb,
                 'p54-settings-denied'
               )`,
            [fixture.societyId],
          ),
        ),
      );
      expect(deniedSetting.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });

  it('limits Coming up to the resident own due bills', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'p54-owner@example.test');
        const residentAId = await newAuthUser(client, 'p54-a@example.test');
        const residentBId = await newAuthUser(client, 'p54-b@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values
             ($1, 'p54-owner@example.test', 'P54 Owner'),
             ($2, 'p54-a@example.test', 'Resident A'),
             ($3, 'p54-b@example.test', 'Resident B')`,
          [adminId, residentAId, residentBId],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('P54 Coming Up', $1) returning id`,
            [adminId],
          )
        ).rows[0]!.id;
        const memberships = await client.query<{
          id: string;
          user_id: string;
        }>(
          `insert into public.memberships
             (society_id, user_id, roles, status)
           values
             ($1, $2, ARRAY['admin']::text[], 'active'),
             ($1, $3, ARRAY['resident']::text[], 'active'),
             ($1, $4, ARRAY['resident']::text[], 'active')
           returning id, user_id`,
          [societyId, adminId, residentAId, residentBId],
        );
        const blockId = (
          await client.query<{ id: string }>(
            `insert into public.blocks (society_id, name, created_by)
             values ($1, 'A', $2) returning id`,
            [societyId, adminId],
          )
        ).rows[0]!.id;
        const units = await client.query<{ id: string; number: string }>(
          `insert into public.units
             (society_id, block_id, number, created_by)
           values
             ($1, $2, '101', $3),
             ($1, $2, '102', $3)
           returning id, number`,
          [societyId, blockId, adminId],
        );
        const membershipA = memberships.rows.find(
          (row) => row.user_id === residentAId,
        )!.id;
        const membershipB = memberships.rows.find(
          (row) => row.user_id === residentBId,
        )!.id;
        await client.query(
          `insert into public.unit_occupants
             (society_id, unit_id, membership_id, relationship, status, created_by)
           values
             ($1, $2, $3, 'owner', 'active', $4),
             ($1, $5, $6, 'owner', 'active', $4)`,
          [
            societyId,
            units.rows[0]!.id,
            membershipA,
            adminId,
            units.rows[1]!.id,
            membershipB,
          ],
        );
        await client.query(
          `insert into public.module_configs
             (society_id, module_key, enabled, settings)
           values ($1, 'billing', true, '{}'::jsonb)
           on conflict (society_id, module_key)
           do update set enabled = true`,
          [societyId],
        );
        await client.query(
          `insert into public.billing_bills
             (society_id, unit_id, title, period_start, due_date,
              total_paise, created_by)
           values
             ($1, $2, 'Bill A', date_trunc('month', current_date), current_date + 1, 10000, $3),
             ($1, $4, 'Bill B', date_trunc('month', current_date), current_date + 1, 20000, $3)`,
          [societyId, units.rows[0]!.id, adminId, units.rows[1]!.id],
        );
        return { adminId, residentAId, societyId };
      });

      const residentItems = await database.asRole(
        'authenticated',
        { sub: fixture.residentAId },
        async (client) =>
          (
            await client.query<{ title: string }>(
              'select * from public.workspace_coming_up_get($1)',
              [fixture.societyId],
            )
          ).rows.map((row) => row.title),
      );
      expect(residentItems).toEqual(['Bill A']);

      const adminItems = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) =>
          (
            await client.query<{ title: string }>(
              'select * from public.workspace_coming_up_get($1)',
              [fixture.societyId],
            )
          ).rows.map((row) => row.title),
      );
      expect(adminItems).toEqual(['Bill A', 'Bill B']);
    } finally {
      await database.drop();
    }
  });
});
