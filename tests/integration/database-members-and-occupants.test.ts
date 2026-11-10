// Verify member management, occupant history, and household access in PostgreSQL.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database members and occupants', () => {
  it('creates audited invitations and ends access immediately on deactivation', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'manager@example.test');
        const residentId = await newAuthUser(client, 'resident@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'manager@example.test', 'Manager'),
                  ($2, 'resident@example.test', 'Resident')`,
          [adminId, residentId],
        );
        const society = await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Oak Grove', $1) returning id`,
          [adminId],
        );
        const societyId = society.rows[0]?.id;
        if (!societyId) throw new Error('Society fixture was not created.');
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin']::text[], 'active')`,
          [societyId, adminId],
        );
        const unit = await client.query<{ id: string }>(
          `insert into public.units (society_id, number, created_by)
           values ($1, '101', $2) returning id`,
          [societyId, adminId],
        );
        const unitId = unit.rows[0]?.id;
        if (!unitId) throw new Error('Unit fixture was not created.');
        return { adminId, residentId, societyId, unitId };
      });

      const membershipId = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select public.create_member_invitation(
              $1, 'resident@example.test', ARRAY['resident']::text[],
              $2, 'family', false, false, 'request-invite'
            ) as id`,
            [fixture.societyId, fixture.unitId],
          );
          const id = result.rows[0]?.id;
          if (!id) throw new Error('Member invitation was not created.');
          return id;
        },
        { commit: true },
      );

      const pendingOccupant = await database.asSuperuser((client) =>
        client.query<{ status: string; is_approver: boolean }>(
          `select status, is_approver from public.unit_occupants
           where membership_id = $1`,
          [membershipId],
        ),
      );
      expect(pendingOccupant.rows).toEqual([
        { status: 'pending', is_approver: false },
      ]);

      await database.asSuperuser((client) =>
        client.query(
          `update public.memberships
           set user_id = $2, invited_email = null, status = 'active',
               joined_at = now()
           where id = $1`,
          [membershipId, fixture.residentId],
        ),
      );
      const activeOccupants = await database.asSuperuser((client) =>
        client.query<{ status: string }>(
          'select status from public.unit_occupants where membership_id = $1',
          [membershipId],
        ),
      );
      expect(activeOccupants.rows).toEqual([{ status: 'active' }]);

      await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query('select public.deactivate_member($1, $2, $3)', [
            fixture.societyId,
            membershipId,
            'request-deactivate',
          ]),
        { commit: true },
      );
      const deactivated = await database.asSuperuser((client) =>
        client.query<{ membership_status: string; occupant_status: string }>(
          `select membership.status as membership_status,
                  occupant.status as occupant_status
           from public.memberships as membership
           join public.unit_occupants as occupant
             on occupant.membership_id = membership.id
           where membership.id = $1`,
          [membershipId],
        ),
      );
      expect(deactivated.rows).toEqual([
        { membership_status: 'deactivated', occupant_status: 'ended' },
      ]);
    } finally {
      await database.drop();
    }
  });

  it('enforces one active primary and limits household controls to a primary resident', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'admin@example.test');
        const primaryId = await newAuthUser(client, 'primary@example.test');
        const familyId = await newAuthUser(client, 'family@example.test');
        const secondId = await newAuthUser(client, 'second@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'admin@example.test', 'Admin'),
                  ($2, 'primary@example.test', 'Primary'),
                  ($3, 'family@example.test', 'Family'),
                  ($4, 'second@example.test', 'Second')`,
          [adminId, primaryId, familyId, secondId],
        );
        const society = await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Pine Court', $1) returning id`,
          [adminId],
        );
        const societyId = society.rows[0]?.id;
        if (!societyId) throw new Error('Society fixture was not created.');
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values
             ($1, $2, ARRAY['admin']::text[], 'active'),
             ($1, $3, ARRAY['resident']::text[], 'active'),
             ($1, $4, ARRAY['resident']::text[], 'active'),
             ($1, $5, ARRAY['resident']::text[], 'active')`,
          [societyId, adminId, primaryId, familyId, secondId],
        );
        const memberships = await client.query<{ id: string; user_id: string }>(
          `select id, user_id from public.memberships where society_id = $1`,
          [societyId],
        );
        const membershipByUser = new Map(
          memberships.rows.map((row) => [row.user_id, row.id]),
        );
        const unit = await client.query<{ id: string }>(
          `insert into public.units (society_id, number, created_by)
           values ($1, '201', $2) returning id`,
          [societyId, adminId],
        );
        const unitId = unit.rows[0]?.id;
        const primaryMembership = membershipByUser.get(primaryId);
        const familyMembership = membershipByUser.get(familyId);
        if (!unitId || !primaryMembership || !familyMembership) {
          throw new Error('Occupancy fixtures were not created.');
        }
        await client.query(
          `insert into public.unit_occupants (
             society_id, unit_id, membership_id, relationship,
            is_primary, is_approver, status, created_by
           )
           values
            ($1, $2, $3, 'owner', true, true, 'active', $5),
            ($1, $2, $4, 'family', false, false, 'active', $5)`,
          [societyId, unitId, primaryMembership, familyMembership, adminId],
        );
        const familyOccupant = await client.query<{ id: string }>(
          `select id from public.unit_occupants
           where society_id = $1 and membership_id = $2`,
          [societyId, familyMembership],
        );
        const familyOccupantId = familyOccupant.rows[0]?.id;
        if (!familyOccupantId) {
          throw new Error('Family occupancy fixture was not created.');
        }
        return {
          adminId,
          primaryId,
          familyId,
          secondId,
          societyId,
          unitId,
          familyOccupantId,
          membershipByUser: Object.fromEntries(membershipByUser),
        };
      });

      const primaryConflict = await dbError(
        database.asRole('authenticated', { sub: fixture.adminId }, (client) =>
          client.query(
            `select public.assign_unit_occupant(
              $1, $2, $3, 'tenant', true, true, current_date, 'request-primary'
            )`,
            [
              fixture.societyId,
              fixture.unitId,
              fixture.membershipByUser[fixture.secondId],
            ],
          ),
        ),
      );
      expect(primaryConflict.code).toBe('23505');

      const household = await database.asRole(
        'authenticated',
        { sub: fixture.primaryId },
        async (client) => {
          const members = await client.query<{
            full_name: string;
            is_approver: boolean;
          }>(
            'select full_name, is_approver from public.list_household_members($1)',
            [fixture.unitId],
          );
          await client.query(
            `select public.set_household_approver(
              $1, true, 'request-approver'
            )`,
            [fixture.familyOccupantId],
          );
          return members.rows;
        },
        { commit: true },
      );
      expect(household).toEqual([
        { full_name: 'Primary', is_approver: true },
        { full_name: 'Family', is_approver: false },
      ]);

      const familyCannotManage = await dbError(
        database.asRole('authenticated', { sub: fixture.familyId }, (client) =>
          client.query('select * from public.list_household_members($1)', [
            fixture.unitId,
          ]),
        ),
      );
      expect(familyCannotManage.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });

  it('imports valid resident rows atomically and reports duplicate rows in a job', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'import-admin@example.test');
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, 'import-admin@example.test', 'Import Admin')`,
          [adminId],
        );
        const society = await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
           values ('Import Society', $1) returning id`,
          [adminId],
        );
        const societyId = society.rows[0]?.id;
        if (!societyId) throw new Error('Society fixture was not created.');
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, ARRAY['admin']::text[], 'active')`,
          [societyId, adminId],
        );
        const unit = await client.query<{ id: string }>(
          `insert into public.units (society_id, number, created_by)
           values ($1, '301', $2) returning id`,
          [societyId, adminId],
        );
        const unitId = unit.rows[0]?.id;
        if (!unitId) throw new Error('Unit fixture was not created.');
        return { adminId, societyId, unitId };
      });

      const jobId = await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        async (client) => {
          const result = await client.query<{ id: string }>(
            `select public.create_resident_import_job($1, $2::jsonb, $3) as id`,
            [
              fixture.societyId,
              JSON.stringify([
                {
                  rowNumber: 2,
                  email: 'new-resident@example.test',
                  unitId: fixture.unitId,
                  relationship: 'owner',
                  isPrimary: true,
                  isApprover: true,
                },
                {
                  rowNumber: 3,
                  email: 'new-resident@example.test',
                  unitId: fixture.unitId,
                  relationship: 'family',
                  isPrimary: false,
                  isApprover: false,
                },
              ]),
              'request-resident-import',
            ],
          );
          const id = result.rows[0]?.id;
          if (!id) throw new Error('Resident import job was not created.');
          return id;
        },
        { commit: true },
      );

      const result = await database.asSuperuser(async (client) => {
        const job = await client.query<{
          status: string;
          summary: {
            importedRows: number;
            failedRows: number;
            errors: unknown[];
          };
        }>('select status, summary from public.jobs where id = $1', [jobId]);
        const counts = await client.query<{
          memberships: number;
          occupants: number;
        }>(
          `select
            (select count(*)::integer from public.memberships
             where society_id = $1 and status = 'invited') as memberships,
            (select count(*)::integer from public.unit_occupants
             where society_id = $1 and status = 'pending') as occupants`,
          [fixture.societyId],
        );
        return { job: job.rows[0], counts: counts.rows[0] };
      });
      expect(result.job?.status).toBe('partial');
      expect(result.job?.summary).toMatchObject({
        importedRows: 1,
        failedRows: 1,
      });
      expect(result.job?.summary.errors).toHaveLength(1);
      expect(result.counts).toEqual({ memberships: 1, occupants: 1 });
    } finally {
      await database.drop();
    }
  });
});
