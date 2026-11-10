// Verify tenant isolation and integrity for blocks and units.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database society structure', () => {
  it('isolates rows and restricts writes to society admins', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'admin@example.test');
        const residentId = await newAuthUser(client, 'resident@example.test');
        const otherAdminId = await newAuthUser(
          client,
          'other-admin@example.test',
        );
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values
             ($1, 'admin@example.test', 'Admin'),
             ($2, 'resident@example.test', 'Resident'),
             ($3, 'other-admin@example.test', 'Other Admin')`,
          [adminId, residentId, otherAdminId],
        );
        const societyIds: string[] = [];
        for (const [name, createdBy] of [
          ['Oak Grove', adminId],
          ['Pine Court', otherAdminId],
        ]) {
          const result = await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ($1, $2) returning id`,
            [name, createdBy],
          );
          const id = result.rows[0]?.id;
          if (!id) throw new Error('Society fixture was not created.');
          societyIds.push(id);
        }
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values
             ($1, $2, ARRAY['admin']::text[], 'active'),
             ($1, $3, ARRAY['resident']::text[], 'active'),
             ($4, $5, ARRAY['admin']::text[], 'active')`,
          [societyIds[0], adminId, residentId, societyIds[1], otherAdminId],
        );
        const foreignBlock = await client.query<{ id: string }>(
          `insert into public.blocks (society_id, name, created_by)
           values ($1, 'Foreign Block', $2) returning id`,
          [societyIds[1], otherAdminId],
        );
        const foreignBlockId = foreignBlock.rows[0]?.id;
        if (!foreignBlockId) throw new Error('Foreign block was not created.');
        return {
          adminId,
          residentId,
          otherAdminId,
          societyIds,
          foreignBlockId,
        };
      });

      const [firstSocietyId, secondSocietyId] = fixture.societyIds;
      if (!firstSocietyId || !secondSocietyId) {
        throw new Error('Society fixture IDs were not returned.');
      }

      const blockId = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) => {
          const result = await client.query<{ id: string }>(
            `insert into public.blocks (society_id, name)
             values ($1, 'North') returning id`,
            [firstSocietyId],
          );
          const id = result.rows[0]?.id;
          if (!id) throw new Error('Block fixture was not created.');
          await client.query(
            `insert into public.units (society_id, block_id, number)
             values ($1, $2, '101')`,
            [firstSocietyId, id],
          );
          return id;
        },
        { commit: true },
      );

      const residentRows = await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query<{ number: string }>(
            'select number from public.units where society_id = $1',
            [firstSocietyId],
          ),
      );
      expect(residentRows.rows).toEqual([{ number: '101' }]);

      const crossSocietyRows = await database.asRole(
        'authenticated',
        { sub: fixture.otherAdminId },
        (client) =>
          client.query('select id from public.blocks where society_id = $1', [
            firstSocietyId,
          ]),
      );
      expect(crossSocietyRows.rows).toEqual([]);

      const residentWrite = await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.residentId },
          (client) =>
            client.query(
              `insert into public.blocks (society_id, name)
               values ($1, 'Resident Block')`,
              [firstSocietyId],
            ),
        ),
      );
      expect(residentWrite.code).toBe('42501');

      const duplicateUnit = await dbError(
        database.asRole('authenticated', { sub: fixture.adminId }, (client) =>
          client.query(
            `insert into public.units (society_id, block_id, number)
               values ($1, $2, '101')`,
            [firstSocietyId, blockId],
          ),
        ),
      );
      expect(duplicateUnit.code).toBe('23505');

      await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query(
            `insert into public.units (society_id, number)
             values ($1, '201')`,
            [firstSocietyId],
          ),
        { commit: true },
      );
      const duplicateUnblockedUnit = await dbError(
        database.asRole('authenticated', { sub: fixture.adminId }, (client) =>
          client.query(
            `insert into public.units (society_id, number)
               values ($1, '201')`,
            [firstSocietyId],
          ),
        ),
      );
      expect(duplicateUnblockedUnit.code).toBe('23505');

      const crossSocietyBlock = await dbError(
        database.asSuperuser((client) =>
          client.query(
            `insert into public.units (society_id, block_id, number, created_by)
             values ($1, $2, '201', $3)`,
            [firstSocietyId, fixture.foreignBlockId, fixture.adminId],
          ),
        ),
      );
      expect(crossSocietyBlock.code).toBe('23503');

      const importedJobId = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select public.create_units_import_job($1, $2::jsonb, $3) as id`,
            [
              firstSocietyId,
              JSON.stringify([
                {
                  rowNumber: 2,
                  blockName: 'North',
                  number: '102',
                  floor: '1',
                  unitType: '2BHK',
                  areaSqft: '850.5',
                },
                {
                  rowNumber: 3,
                  blockName: 'North',
                  number: '101',
                  floor: '',
                  unitType: '',
                  areaSqft: '',
                },
                {
                  rowNumber: 4,
                  blockName: 'North',
                  number: '103',
                  floor: 'not-a-floor',
                  unitType: '',
                  areaSqft: '',
                },
              ]),
              'request-import',
            ],
          );
          const id = result.rows[0]?.id;
          if (!id) throw new Error('Units import job was not created.');
          return id;
        },
        { commit: true },
      );
      const importResult = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) => {
          const job = await client.query<{
            status: string;
            progress: number;
            summary: {
              totalRows: number;
              importedRows: number;
              failedRows: number;
              errors: { rowNumber: number; message: string }[];
            };
          }>(
            `select status, progress, summary
             from public.jobs where id = $1`,
            [importedJobId],
          );
          const importedUnit = await client.query(
            `select id from public.units
             where society_id = $1 and number = '102'`,
            [firstSocietyId],
          );
          const audit = await client.query(
            `select id from public.audit_logs
             where action = 'structure.units.importConfirm'
               and entity_id = $1`,
            [importedJobId],
          );
          return {
            job: job.rows[0],
            importedUnitCount: importedUnit.rowCount,
            auditCount: audit.rowCount,
          };
        },
      );
      expect(importResult.job).toMatchObject({
        status: 'partial',
        progress: 100,
        summary: {
          totalRows: 3,
          importedRows: 1,
          failedRows: 2,
        },
      });
      expect(importResult.job?.summary.errors).toHaveLength(2);
      expect(importResult.importedUnitCount).toBe(1);
      expect(importResult.auditCount).toBe(1);

      const unauthorizedImport = await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.residentId },
          (client) =>
            client.query(
              `select public.create_units_import_job($1, '[]'::jsonb, 'request-denied')`,
              [firstSocietyId],
            ),
        ),
      );
      expect(unauthorizedImport.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });
});
