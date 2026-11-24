import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('P56 flat and import database contracts', () => {
  it('scopes resident access to the selected flat and supports all-flats mode', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'p56-admin@example.test');
        const residentId = await newAuthUser(
          client,
          'p56-resident@example.test',
        );
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values
             ($1, 'p56-admin@example.test', 'P56 Admin'),
             ($2, 'p56-resident@example.test', 'P56 Resident')`,
          [adminId, residentId],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('P56 Society', $1) returning id`,
            [adminId],
          )
        ).rows[0]!.id;
        const membershipId = (
          await client.query<{ id: string }>(
            `insert into public.memberships
               (society_id, user_id, roles, status)
             values ($1, $2, ARRAY['admin','resident']::text[], 'active')
             returning id`,
            [societyId, adminId],
          )
        ).rows[0]!.id;
        const residentMembershipId = (
          await client.query<{ id: string }>(
            `insert into public.memberships
               (society_id, user_id, roles, status)
             values ($1, $2, ARRAY['resident']::text[], 'active')
             returning id`,
            [societyId, residentId],
          )
        ).rows[0]!.id;
        const units = (
          await client.query<{ id: string }>(
            `insert into public.units (society_id, number, created_by)
             values ($1, 'A-101', $2), ($1, 'B-202', $2)
             returning id`,
            [societyId, adminId],
          )
        ).rows.map(({ id }) => id);
        await client.query(
          `insert into public.unit_occupants
             (society_id, unit_id, membership_id, relationship, is_primary, status, created_by)
           values
             ($1, $2, $4, 'owner', true, 'active', $3),
             ($1, $5, $4, 'owner', false, 'active', $3),
             ($1, $2, $6, 'tenant', false, 'active', $3),
             ($1, $5, $6, 'tenant', true, 'active', $3)`,
          [
            societyId,
            units[0],
            adminId,
            membershipId,
            units[1],
            residentMembershipId,
          ],
        );
        return {
          adminId,
          residentId,
          societyId,
          units,
        };
      });

      const initial = await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query('select * from public.resident_flat_options_get($1)', [
            fixture.societyId,
          ]),
      );
      expect(initial.rows).toHaveLength(2);
      expect(initial.rows.filter((row) => row.selected)).toHaveLength(1);
      expect(initial.rows.every((row) => row.all_flats === false)).toBe(true);

      await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query(
            'select public.resident_flat_selection_save($1, $2, false)',
            [fixture.societyId, fixture.units[1]],
          ),
        { commit: true },
      );
      const selected = await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        async (client) =>
          (
            await client.query<{ unit_id: string; selected: boolean }>(
              'select * from public.resident_flat_options_get($1)',
              [fixture.societyId],
            )
          ).rows
            .filter((row) => row.selected)
            .map(({ unit_id }) => unit_id),
      );
      expect(selected).toEqual([fixture.units[1]]);

      await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query(
            'select public.resident_flat_selection_save($1, null, true)',
            [fixture.societyId],
          ),
        { commit: true },
      );
      const all = await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        async (client) => {
          const options = await client.query(
            'select * from public.resident_flat_options_get($1)',
            [fixture.societyId],
          );
          return {
            options: options.rows,
          };
        },
      );
      expect(all.options.every((row) => row.all_flats === true)).toBe(true);
    } finally {
      await database.drop();
    }
  });

  it('saves every list atomically, enforces the opening-dues lock and developer access', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(
          client,
          'p56-import-admin@example.test',
        );
        const residentId = await newAuthUser(
          client,
          'p56-import-resident@example.test',
        );
        const developerId = await newAuthUser(
          client,
          'p56-import-developer@example.test',
        );
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values
             ($1, 'p56-import-admin@example.test', 'Import Admin'),
             ($2, 'p56-import-resident@example.test', 'Import Resident'),
             ($3, 'p56-import-developer@example.test', 'Import Developer')`,
          [adminId, residentId, developerId],
        );
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('P56 Import Society', $1) returning id`,
            [adminId],
          )
        ).rows[0]!.id;
        const membershipId = (
          await client.query<{ id: string }>(
            `insert into public.memberships
               (society_id, user_id, roles, status)
             values
               ($1, $2, ARRAY['admin']::text[], 'active'),
               ($1, $3, ARRAY['resident']::text[], 'active')
             returning id`,
            [societyId, adminId, residentId],
          )
        ).rows[1]!.id;
        await client.query(
          `insert into public.module_configs
             (society_id, module_key, enabled, settings)
           values
             ($1, 'core', true, '{}'),
             ($1, 'billing', true, '{}'),
             ($1, 'directory', true, '{}'),
             ($1, 'staff', true, '{}'),
             ($1, 'asset', true, '{}')`,
          [societyId],
        );
        const unitId = (
          await client.query<{ id: string }>(
            `insert into public.units
               (society_id, number, created_by, updated_by)
             values ($1, '101', $2, $2) returning id`,
            [societyId, adminId],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.unit_occupants
             (society_id, unit_id, membership_id, relationship, is_primary, status, created_by)
           values ($1, $2, $3, 'owner', true, 'active', $4)`,
          [societyId, unitId, membershipId, adminId],
        );
        const categoryId = (
          await client.query<{ id: string }>(
            `insert into public.asset_categories
               (society_id, name, client_request_id, created_by, updated_by)
             values ($1, 'Lifts', gen_random_uuid(), $2, $2) returning id`,
            [societyId, adminId],
          )
        ).rows[0]!.id;
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
          sessionId,
          societyId,
          unitId,
          membershipId,
          categoryId,
        };
      });

      const save = (kind: string, rows: unknown, requestId: string) =>
        database.asRole(
          'authenticated',
          { sub: fixture.adminId },
          async (client) =>
            (
              await client.query<{ id: string }>(
                `select public.bulk_import_save(
                   $1, $2, $3::jsonb, $4
                 ) as id`,
                [fixture.societyId, kind, JSON.stringify(rows), requestId],
              )
            ).rows[0]!.id,
          { commit: true },
        );

      const failedUnitImport = await dbError(
        database.asRole('authenticated', { sub: fixture.adminId }, (client) =>
          client.query(
            'select public.bulk_import_save($1, $2, $3::jsonb, $4)',
            [
              fixture.societyId,
              'units',
              JSON.stringify([
                { rowNumber: 2, blockName: null, number: '102' },
                { rowNumber: 3, blockName: null, number: '101' },
              ]),
              'p56-atomic-1',
            ],
          ),
        ),
      );
      expect(failedUnitImport.code).toBe('23505');
      const rolledBack = await database.asSuperuser((client) =>
        client.query(
          `select
             (select count(*)::int from public.units where society_id=$1 and number='102') as units,
             (select count(*)::int from public.society_import_runs where society_id=$1) as runs`,
          [fixture.societyId],
        ),
      );
      expect(rolledBack.rows[0]).toEqual({ units: 0, runs: 0 });

      await save(
        'opening_dues',
        [
          {
            rowNumber: 2,
            unitId: fixture.unitId,
            asOn: '2026-11-24',
            dueDate: '2026-12-10',
            amountPaise: 250000,
          },
        ],
        'p56-opening-1',
      );
      const secondOpening = await dbError(
        database.asRole('authenticated', { sub: fixture.adminId }, (client) =>
          client.query(
            'select public.bulk_import_save($1, $2, $3::jsonb, $4)',
            [
              fixture.societyId,
              'opening_dues',
              JSON.stringify([
                {
                  rowNumber: 2,
                  unitId: fixture.unitId,
                  asOn: '2026-11-25',
                  dueDate: '2026-12-11',
                  amountPaise: 100,
                },
              ]),
              'p56-opening-2',
            ],
          ),
        ),
      );
      expect(secondOpening.code).toBe('23505');

      await save(
        'vehicles',
        [
          {
            rowNumber: 2,
            unitId: fixture.unitId,
            membershipId: fixture.membershipId,
            vehicleType: 'car',
            registrationNumber: 'KA01AB1234',
            tagNumber: 'A-101-1',
          },
        ],
        'p56-vehicle-1',
      );
      await save(
        'staff',
        [
          {
            rowNumber: 2,
            staffType: 'society',
            unitId: null,
            fullName: 'Sample Gardener',
            phone: '+919876543210',
            jobRole: 'Gardener',
            policeVerified: true,
            idType: null,
            idLastFour: null,
          },
        ],
        'p56-staff-1',
      );
      await save(
        'assets',
        [
          {
            rowNumber: 2,
            categoryId: fixture.categoryId,
            name: 'Lift A1',
            location: 'Tower A',
            make: null,
            model: null,
            serialNumber: null,
            purchaseDate: null,
            purchaseCostPaise: null,
            supplier: null,
            warrantyEndDate: null,
            status: 'active',
            notes: null,
          },
        ],
        'p56-asset-1',
      );

      const residentDenied = await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.residentId },
          (client) =>
            client.query(
              'select public.bulk_import_save($1, $2, $3::jsonb, $4)',
              [
                fixture.societyId,
                'vehicles',
                JSON.stringify([]),
                'resident-denied',
              ],
            ),
        ),
      );
      expect(residentDenied.code).toBe('42501');

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
            'select public.bulk_import_save($1, $2, $3::jsonb, $4)',
            [
              fixture.societyId,
              'units',
              JSON.stringify([
                { rowNumber: 2, blockName: null, number: 'Developer-1' },
              ]),
              'p56-developer-1',
            ],
          ),
        { commit: true },
      );

      const saved = await database.asSuperuser((client) =>
        client.query(
          `select
             (select count(*)::int from public.billing_bills where kind='opening_dues') as bills,
             (select count(*)::int from public.directory_vehicles) as vehicles,
             (select count(*)::int from public.staff_members) as staff,
             (select count(*)::int from public.assets) as assets,
             (select count(*)::int from public.society_import_runs where actor_role='developer') as developer_runs`,
        ),
      );
      expect(saved.rows[0]).toEqual({
        bills: 1,
        vehicles: 1,
        staff: 1,
        assets: 1,
        developer_runs: 1,
      });
    } finally {
      await database.drop();
    }
  });
});
