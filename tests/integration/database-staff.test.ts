// Verify resident registration privacy, unit blocks, gate attendance and staff shifts.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

type User = 'admin' | 'residentA' | 'residentB' | 'guard' | 'outsider';

describe.skipIf(!hasDatabase)('database staff management', () => {
  it('enforces approval, privacy, unit blocks, entry/exit and shift permissions', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = {} as Record<User, string>;
        for (const name of [
          'admin',
          'residentA',
          'residentB',
          'guard',
          'outsider',
        ] as const) {
          users[name] = await newAuthUser(client, `staff-${name}@example.test`);
          await client.query(
            `insert into public.profiles (id, email, full_name)
             values ($1, $2, $3)`,
            [users[name], `staff-${name}@example.test`, `Staff ${name}`],
          );
        }
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by)
             values ('Staff Society', $1) returning id`,
            [users.admin],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.module_configs
             (society_id, module_key, enabled, settings)
           values ($1, 'core', true, '{}'::jsonb),
                  ($1, 'staff', true, '{}'::jsonb)`,
          [societyId],
        );
        const memberships = (
          await client.query<{ id: string; user_id: string }>(
            `insert into public.memberships (society_id, user_id, roles, status)
             values ($1, $2, ARRAY['admin']::text[], 'active'),
                    ($1, $3, ARRAY['resident']::text[], 'active'),
                    ($1, $4, ARRAY['resident']::text[], 'active'),
                    ($1, $5, ARRAY['guard']::text[], 'active')
             returning id, user_id`,
            [
              societyId,
              users.admin,
              users.residentA,
              users.residentB,
              users.guard,
            ],
          )
        ).rows;
        const membershipOf = (user: User) =>
          memberships.find(({ user_id }) => user_id === users[user])!.id;
        const [unitA, unitB] = (
          await client.query<{ id: string }>(
            `insert into public.units (society_id, number, created_by)
             values ($1, '1A', $2), ($1, '1B', $2) returning id`,
            [societyId, users.admin],
          )
        ).rows.map(({ id }) => id);
        await client.query(
          `insert into public.unit_occupants (
             society_id, unit_id, membership_id, relationship, is_primary,
             is_approver, status, created_by
           )
           values ($1, $2, $3, 'owner', true, true, 'active', $6),
                  ($1, $4, $5, 'owner', true, true, 'active', $6)`,
          [
            societyId,
            unitA,
            membershipOf('residentA'),
            unitB,
            membershipOf('residentB'),
            users.admin,
          ],
        );
        const guardId = (
          await client.query<{ id: string }>(
            `insert into public.guard_roster
               (society_id, name, membership_id, created_by)
             values ($1, 'Gate guard', $2, $3) returning id`,
            [societyId, membershipOf('guard'), users.admin],
          )
        ).rows[0]!.id;
        return {
          users,
          societyId,
          unitA: unitA!,
          unitB: unitB!,
          guardId,
        };
      });

      const asUser = <T>(
        user: User,
        run: (
          query: (
            sql: string,
            params: unknown[],
          ) => Promise<{ rows: Record<string, unknown>[] }>,
        ) => Promise<T>,
      ) =>
        database.asRole(
          'authenticated',
          { sub: fixture.users[user] },
          (client) => run((sql, params) => client.query(sql, params)),
          { commit: true },
        );
      const register = (
        user: 'residentA' | 'residentB',
        unitId: string,
        phone: string,
        requestId = crypto.randomUUID(),
      ) =>
        asUser(
          user,
          async (query) =>
            (
              await query(
                `select public.staff_resident_register(
                 $1, $2, $3, $4, $5, null, null, $6, false, $7, 'staff-register'
               ) as result`,
                [
                  fixture.societyId,
                  unitId,
                  'Domestic worker',
                  phone,
                  `${fixture.societyId}/staff/${fixture.users[user]}/${crypto.randomUUID()}.jpg`,
                  'Cleaner',
                  requestId,
                ],
              )
            ).rows[0]!.result as {
              staff_id: string;
              link_id: string;
              status: string;
            },
        );
      const adminSave = (
        staffType: 'domestic' | 'society',
        phone: string,
        unitIds: string[] = [],
      ) =>
        asUser(
          'admin',
          async (query) =>
            (
              await query(
                `select public.staff_admin_save(
                 $1, null, $2, $3, $4, $5, null, null, $6,
                 false, 'active', $7::uuid[], 'staff-admin-save'
               ) as id`,
                [
                  fixture.societyId,
                  staffType,
                  'Admin staff',
                  phone,
                  `${fixture.societyId}/staff/${fixture.users.admin}/${crypto.randomUUID()}.jpg`,
                  'Cook',
                  unitIds,
                ],
              )
            ).rows[0]!.id as string,
        );

      const defaultSettings = await database.asSuperuser(async (client) =>
        client.query<{ settings: { resident_approval_required?: boolean } }>(
          `select settings from public.module_configs
           where society_id = $1 and module_key = 'staff'`,
          [fixture.societyId],
        ),
      );
      expect(defaultSettings.rows[0]?.settings).toEqual({});
      expect(
        (await register('residentA', fixture.unitA, '+15550000001')).status,
      ).toBe('pending');
      const firstLink = await asUser(
        'admin',
        async (query) =>
          (
            await query(`select public.staff_list($1) as result`, [
              fixture.societyId,
            ])
          ).rows[0]!.result as {
            id: string;
            unit_links: { id: string; status: string }[];
          }[],
      );
      const firstStaff = firstLink[0]!;
      const firstStaffId = firstStaff.id;
      const firstLinkId = firstStaff.unit_links[0]!.id;
      expect(firstStaff.unit_links[0]?.status).toBe('pending');

      await asUser('admin', (query) =>
        query(
          `select public.staff_review_link($1, $2, 'active', 'staff-review')`,
          [fixture.societyId, firstLinkId],
        ),
      );
      await asUser('admin', (query) =>
        query(
          `select public.staff_settings_update($1, false, 'staff-settings')`,
          [fixture.societyId],
        ),
      );
      expect(
        (await register('residentA', fixture.unitA, '+15550000002')).status,
      ).toBe('active');

      const duplicate = await register(
        'residentB',
        fixture.unitB,
        '+15550000001',
      );
      expect(duplicate).toMatchObject({
        staff_id: firstStaffId,
        status: 'pending',
      });
      const hiddenFromOtherResident = await asUser(
        'residentB',
        async (query) =>
          (
            await query(`select public.staff_list($1) as result`, [
              fixture.societyId,
            ])
          ).rows[0]!.result as unknown[],
      );
      expect(hiddenFromOtherResident).toHaveLength(0);
      await asUser('admin', (query) =>
        query(
          `select public.staff_review_link($1, $2, 'active', 'staff-review-2')`,
          [fixture.societyId, duplicate.link_id],
        ),
      );
      const visibleAfterReview = await asUser(
        'residentB',
        async (query) =>
          (
            await query(`select public.staff_list($1) as result`, [
              fixture.societyId,
            ])
          ).rows[0]!.result as { id: string; phone: string }[],
      );
      expect(visibleAfterReview).toContainEqual(
        expect.objectContaining({ id: firstStaffId, phone: '+15550000001' }),
      );

      await asUser('residentA', (query) =>
        query(
          `select public.staff_resident_day_block($1, $2, $3, 'staff-block')`,
          [fixture.societyId, firstStaffId, fixture.unitA],
        ),
      );
      const blockedUnit = await asUser(
        'guard',
        async (query) =>
          (
            await query(`select public.staff_gate_list($1, $2) as result`, [
              fixture.societyId,
              fixture.unitA,
            ])
          ).rows[0]!.result as Record<string, unknown>[],
      );
      const allowedUnit = await asUser(
        'guard',
        async (query) =>
          (
            await query(`select public.staff_gate_list($1, $2) as result`, [
              fixture.societyId,
              fixture.unitB,
            ])
          ).rows[0]!.result as Record<string, unknown>[],
      );
      expect(blockedUnit.find(({ id }) => id === firstStaffId)).toMatchObject({
        blocked_today: true,
        inside: false,
      });
      expect(allowedUnit.find(({ id }) => id === firstStaffId)).toMatchObject({
        blocked_today: false,
      });
      expect(blockedUnit[0]).not.toHaveProperty('phone');
      expect(blockedUnit[0]).not.toHaveProperty('id_last_four');

      const code = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{ staff_code: string }>(
              `select staff_code from public.staff_members where id = $1`,
              [firstStaffId],
            )
          ).rows[0]!.staff_code,
      );
      const attendanceId = await asUser(
        'guard',
        async (query) =>
          (
            await query(
              `select public.staff_check_in($1, $2, $3, $4, 'staff-check-in') as id`,
              [fixture.societyId, fixture.unitB, code, fixture.guardId],
            )
          ).rows[0]!.id as string,
      );
      expect(
        (
          await dbError(
            asUser('guard', (query) =>
              query(
                `select public.staff_check_in($1, $2, $3, $4, 'staff-check-in-duplicate')`,
                [fixture.societyId, fixture.unitA, code, fixture.guardId],
              ),
            ),
          )
        ).code,
      ).toBe('23505');
      await asUser('guard', (query) =>
        query(`select public.staff_check_out($1, $2, $3, 'staff-check-out')`, [
          fixture.societyId,
          attendanceId,
          fixture.guardId,
        ]),
      );
      const currentPhotoPath = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{ photo_path: string }>(
              `select photo_path from public.staff_members where id = $1`,
              [firstStaffId],
            )
          ).rows[0]!.photo_path,
      );
      await asUser('admin', (query) =>
        query(
          `select public.staff_admin_save(
             $1, $2, 'domestic', 'Domestic worker', '+15550000001',
             $3, null, null, 'Cleaner', false, 'active', $4::uuid[],
             'staff-admin-update'
           )`,
          [fixture.societyId, firstStaffId, currentPhotoPath, [fixture.unitA]],
        ),
      );
      const linkStatuses = await database.asSuperuser(async (client) =>
        client.query<{ unit_id: string; status: string }>(
          `select unit_id, status from public.staff_unit_links
           where staff_id = $1`,
          [firstStaffId],
        ),
      );
      expect(linkStatuses.rows).toContainEqual({
        unit_id: fixture.unitA,
        status: 'active',
      });
      expect(linkStatuses.rows).toContainEqual({
        unit_id: fixture.unitB,
        status: 'inactive',
      });

      const societyStaffId = await adminSave('society', '+15550000003');
      const shiftDate = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{ day: string }>(
              `select private.staff_local_date($1)::text as day`,
              [fixture.societyId],
            )
          ).rows[0]!.day,
      );
      await asUser('admin', (query) =>
        query(
          `select public.staff_shift_mark($1, $2, $3, 'present', 'staff-shift')`,
          [fixture.societyId, societyStaffId, shiftDate],
        ),
      );
      await asUser('admin', (query) =>
        query(
          `select public.staff_shift_mark($1, $2, $3, 'leave', 'staff-shift-update')`,
          [fixture.societyId, societyStaffId, shiftDate],
        ),
      );
      const shifts = await asUser(
        'admin',
        async (query) =>
          (
            await query(
              `select public.staff_shift_list(
               $1, date_trunc('month', $2::date)::date
             ) as result`,
              [fixture.societyId, shiftDate],
            )
          ).rows[0]!.result as { staff_id: string; status: string }[],
      );
      expect(shifts).toContainEqual(
        expect.objectContaining({
          staff_id: societyStaffId,
          status: 'leave',
        }),
      );
      expect(
        (
          await dbError(
            asUser('residentA', (query) =>
              query(
                `select public.staff_shift_mark($1, $2, $3, 'present', 'staff-shift-denied')`,
                [fixture.societyId, societyStaffId, shiftDate],
              ),
            ),
          )
        ).code,
      ).toBe('42501');
      expect(
        (
          await dbError(
            asUser('outsider', (query) =>
              query(`select public.staff_list($1)`, [fixture.societyId]),
            ),
          )
        ).code,
      ).toBe('42501');

      const oldOpenStaffId = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select id from public.staff_members where phone = '+15550000002'`,
            )
          ).rows[0]!.id,
      );
      await database.asSuperuser(async (client) => {
        await client.query(
          `update public.staff_attendance
           set checked_in_at = now() - interval '2 years',
               checked_out_at = now() - interval '2 years' + interval '1 hour'
           where id = $1`,
          [attendanceId],
        );
        await client.query(
          `insert into public.staff_attendance (
             society_id, staff_id, unit_id, checked_in_by, check_in_guard_id,
             checked_in_at
           )
           values ($1, $2, $3, $4, $5, now() - interval '2 years')`,
          [
            fixture.societyId,
            oldOpenStaffId,
            fixture.unitA,
            fixture.users.guard,
            fixture.guardId,
          ],
        );
      });
      const today = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{ day: string }>(
              `select private.staff_local_date($1)::text as day`,
              [fixture.societyId],
            )
          ).rows[0]!.day,
      );
      await database.asRole(
        'service_role',
        {},
        async (client) =>
          client.query(
            `select public.staff_retention_run($1, 'staff-retention')`,
            [today],
          ),
        { commit: true },
      );
      const retainedAttendance = await database.asSuperuser(async (client) =>
        client.query<{ id: string; checked_out_at: string | null }>(
          `select id, checked_out_at from public.staff_attendance
           where staff_id = $1`,
          [oldOpenStaffId],
        ),
      );
      expect(retainedAttendance.rows).toHaveLength(1);
      expect(retainedAttendance.rows[0]?.checked_out_at).toBeNull();
      const expiredAttendance = await database.asSuperuser(async (client) =>
        client.query(`select id from public.staff_attendance where id = $1`, [
          attendanceId,
        ]),
      );
      expect(expiredAttendance.rows).toHaveLength(0);
    } finally {
      await database.drop();
    }
  });
});
