// Verify directory privacy, guard vehicle lookup and society isolation.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

type User =
  'admin' | 'committee' | 'residentA' | 'residentB' | 'guard' | 'unassigned';

type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

describe.skipIf(!hasDatabase)('database resident directory', () => {
  it('applies resident visibility preferences and limits guard lookup fields', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = {} as Record<User, string>;
        for (const name of [
          'admin',
          'committee',
          'residentA',
          'residentB',
          'guard',
          'unassigned',
        ] as const) {
          users[name] = await newAuthUser(
            client,
            `directory-${name}@example.test`,
          );
          await client.query(
            `insert into public.profiles(id,email,full_name,phone)
             values($1,$2,$3,$4)`,
            [
              users[name],
              `directory-${name}@example.test`,
              `Directory ${name}`,
              '+919876543210',
            ],
          );
        }
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies(name,created_by)
             values('Directory Society',$1) returning id`,
            [users.admin],
          )
        ).rows[0]!.id;
        const memberships = (
          await client.query<{ id: string; user_id: string }>(
            `insert into public.memberships(society_id,user_id,roles,status)
             values($1,$2,array['admin']::text[],'active'),
                   ($1,$3,array['committee']::text[],'active'),
                   ($1,$4,array['resident']::text[],'active'),
                   ($1,$5,array['resident']::text[],'active'),
                   ($1,$6,array['guard']::text[],'active'),
                   ($1,$7,array['resident']::text[],'active')
             returning id,user_id`,
            [
              societyId,
              users.admin,
              users.committee,
              users.residentA,
              users.residentB,
              users.guard,
              users.unassigned,
            ],
          )
        ).rows;
        const membershipOf = (user: User) =>
          memberships.find(({ user_id }) => user_id === users[user])!.id;
        const [unitA, unitB] = (
          await client.query<{ id: string }>(
            `insert into public.units(society_id,number,created_by)
             values($1,'1A',$2),($1,'1B',$2) returning id`,
            [societyId, users.admin],
          )
        ).rows.map(({ id }) => id);
        await client.query(
          `insert into public.unit_occupants
             (society_id,unit_id,membership_id,relationship,is_primary,
              is_approver,status,created_by)
           values($1,$2,$3,'owner',true,true,'active',$4),
                 ($1,$5,$6,'owner',false,true,'active',$4)`,
          [
            societyId,
            unitA,
            membershipOf('residentA'),
            users.admin,
            unitB,
            membershipOf('residentB'),
          ],
        );
        await client.query(
          `insert into public.module_configs(society_id,module_key,enabled,settings)
           values($1,'core',true,'{}'),($1,'directory',true,'{}')`,
          [societyId],
        );
        await client.query(
          `insert into public.directory_vehicles
             (society_id,unit_id,membership_id,vehicle_type,registration_number,
              verified_at,verified_by,created_by,client_request_id)
           values($1,$2,$3,'car','MH12AB1234',now(),$4,$4,$5)`,
          [
            societyId,
            unitA,
            membershipOf('residentA'),
            users.admin,
            crypto.randomUUID(),
          ],
        );
        return {
          users,
          societyId,
          unitA: unitA!,
          unitB: unitB!,
          membershipA: membershipOf('residentA'),
          membershipB: membershipOf('residentB'),
        };
      });

      const asUser = <T>(
        user: User,
        run: Parameters<typeof database.asSuperuser<T>>[0],
      ) =>
        database.asRole('authenticated', { sub: fixture.users[user] }, run, {
          commit: true,
        });
      const listResidents = async (
        user: User,
        search: string | null = null,
        limit = 25,
        offset = 0,
      ) => {
        const result = await asUser(user, (client) =>
          client.query<{
            page: Page<{
              membership_id: string;
              unit_id: string | null;
              full_name: string;
              unit_number: string | null;
              phone: string | null;
            }>;
          }>('select public.directory_resident_list($1,$2,$3,$4) as page', [
            fixture.societyId,
            search,
            limit,
            offset,
          ]),
        );
        return result.rows[0]!.page;
      };
      const duplicateRegistration = await dbError(
        database.asSuperuser((client) =>
          client.query(
            `insert into public.directory_vehicles
               (society_id,unit_id,membership_id,vehicle_type,registration_number,
                verified_at,verified_by,created_by,client_request_id)
             values($1,$2,$3,'car','MH12AB1234',now(),$4,$4,$5)`,
            [
              fixture.societyId,
              fixture.unitB,
              fixture.membershipB,
              fixture.users.admin,
              crypto.randomUUID(),
            ],
          ),
        ),
      );
      expect(duplicateRegistration.code).toBe('23505');

      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled=false
           where society_id=$1 and module_key='directory'`,
          [fixture.societyId],
        ),
      );
      expect(
        await dbError(
          asUser('residentA', (client) =>
            client.query(
              'select public.directory_resident_list($1,null,25,0)',
              [fixture.societyId],
            ),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled=true
           where society_id=$1 and module_key='directory'`,
          [fixture.societyId],
        ),
      );

      const defaultRows = await listResidents('residentA');
      expect(defaultRows.items).toHaveLength(2);
      expect(
        defaultRows.items.find(
          (row) => row.membership_id === fixture.membershipB,
        ),
      ).toMatchObject({
        full_name: 'Directory residentB',
        unit_number: '1B',
        phone: null,
      });
      const firstPage = await listResidents('residentA', null, 1, 0);
      expect(firstPage).toMatchObject({ total: 2, limit: 1, offset: 0 });
      expect(firstPage.items).toHaveLength(1);
      expect(
        (await listResidents('residentA', '1B')).items.map(
          ({ membership_id }) => membership_id,
        ),
      ).toEqual([fixture.membershipB]);
      expect(
        await dbError(
          asUser('residentA', (client) =>
            client.query(
              'select public.directory_resident_list($1,null,101,0)',
              [fixture.societyId],
            ),
          ),
        ),
      ).toMatchObject({ code: '22023' });

      await asUser('residentB', (client) =>
        client.query(
          `select public.directory_set_visibility($1,true,true,true)`,
          [fixture.societyId],
        ),
      );
      const currentPreferences = await asUser('residentB', (client) =>
        client.query('select * from public.directory_my_preferences($1)', [
          fixture.societyId,
        ]),
      );
      expect(currentPreferences.rows[0]).toMatchObject({
        name_visible: true,
        unit_visible: true,
        phone_visible: true,
      });
      const currentHouseholds = await asUser('residentA', (client) =>
        client.query('select * from public.directory_my_households($1)', [
          fixture.societyId,
        ]),
      );
      expect(currentHouseholds.rows).toEqual([
        {
          unit_id: fixture.unitA,
          membership_id: fixture.membershipA,
          unit_number: '1A',
        },
      ]);
      const optedInRows = await listResidents('residentA');
      expect(
        optedInRows.items.find(
          (row) => row.membership_id === fixture.membershipB,
        )?.phone,
      ).toBe('+919876543210');

      await asUser('residentB', (client) =>
        client.query(
          'select public.directory_set_visibility($1,true,false,true)',
          [fixture.societyId],
        ),
      );
      expect((await listResidents('residentA', '1B')).items).toEqual([]);
      expect(
        (await listResidents('residentA')).items.find(
          ({ membership_id }) => membership_id === fixture.membershipB,
        ),
      ).toMatchObject({ unit_id: null, unit_number: null });

      await asUser('residentB', (client) =>
        client.query(
          `select public.directory_set_visibility($1,false,false,true)`,
          [fixture.societyId],
        ),
      );
      const hiddenRows = await listResidents('residentA');
      expect(
        hiddenRows.items.map(({ membership_id }) => membership_id),
      ).toEqual([fixture.membershipA]);

      const managerRows = await listResidents('committee');
      expect(managerRows.items).toHaveLength(2);
      expect(
        managerRows.items.find(
          (row) => row.membership_id === fixture.membershipB,
        )?.phone,
      ).toBe('+919876543210');

      const guardResult = await asUser('guard', (client) =>
        client.query<{ vehicle_type: string; unit_number: string }>(
          `select * from public.directory_guard_vehicle_lookup($1,'mh 12-ab 1234')`,
          [fixture.societyId],
        ),
      );
      expect(guardResult.rows).toEqual([
        { vehicle_type: 'car', unit_number: '1A' },
      ]);
      const requestId = crypto.randomUUID();
      const savedVehicle = await asUser('residentA', (client) =>
        client.query<{ id: string }>(
          `select public.directory_vehicle_save(
             $1,null,$2,null,'two_wheeler',$3,null,$4
           ) as id`,
          [fixture.societyId, fixture.unitA, 'MH 12-CD 5678', requestId],
        ),
      );
      const retriedVehicle = await asUser('residentA', (client) =>
        client.query<{ id: string }>(
          `select public.directory_vehicle_save(
             $1,null,$2,null,'two_wheeler',$3,null,$4
           ) as id`,
          [fixture.societyId, fixture.unitA, 'MH12CD5678', requestId],
        ),
      );
      expect(retriedVehicle.rows[0]?.id).toBe(savedVehicle.rows[0]?.id);
      const pendingLookup = await asUser('guard', (client) =>
        client.query(
          `select * from public.directory_guard_vehicle_lookup($1,'MH12CD5678')`,
          [fixture.societyId],
        ),
      );
      expect(pendingLookup.rows).toEqual([]);
      expect(
        await dbError(
          asUser('residentA', (client) =>
            client.query('select public.directory_vehicle_verify($1,$2,true)', [
              fixture.societyId,
              savedVehicle.rows[0]?.id,
            ]),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      await asUser('admin', (client) =>
        client.query('select public.directory_vehicle_verify($1,$2,true)', [
          fixture.societyId,
          savedVehicle.rows[0]?.id,
        ]),
      );
      const verifiedLookup = await asUser('guard', (client) =>
        client.query(
          `select * from public.directory_guard_vehicle_lookup($1,'MH12-CD 5678')`,
          [fixture.societyId],
        ),
      );
      expect(verifiedLookup.rows).toEqual([
        { vehicle_type: 'two_wheeler', unit_number: '1A' },
      ]);
      await asUser('residentA', (client) =>
        client.query(
          `select public.directory_vehicle_save(
          $1,$2,$3,null,'car','MH12CD5678',null,$4
        )`,
          [
            fixture.societyId,
            savedVehicle.rows[0]?.id,
            fixture.unitA,
            crypto.randomUUID(),
          ],
        ),
      );
      const changedTypeLookup = await asUser('guard', (client) =>
        client.query(
          `select * from public.directory_guard_vehicle_lookup($1,'MH12CD5678')`,
          [fixture.societyId],
        ),
      );
      expect(changedTypeLookup.rows).toEqual([]);
      const firstVehiclePage = await asUser('residentA', (client) =>
        client.query<{ page: Page<{ id: string }> }>(
          'select public.directory_vehicle_list($1,1,0) as page',
          [fixture.societyId],
        ),
      );
      expect(firstVehiclePage.rows[0]?.page).toMatchObject({
        total: 2,
        limit: 1,
        offset: 0,
      });
      expect(firstVehiclePage.rows[0]?.page.items).toHaveLength(1);

      const savedContact = await asUser('residentA', (client) =>
        client.query<{ id: string }>(
          `select public.directory_emergency_contact_save(
             $1,null,$2,null,'Emergency Contact','parent','+919876543210',$3
           ) as id`,
          [fixture.societyId, fixture.unitA, crypto.randomUUID()],
        ),
      );
      const ownContacts = await asUser('residentA', (client) =>
        client.query<{ page: Page<{ id: string }> }>(
          'select public.directory_emergency_contacts_list($1,$2,25,0) as page',
          [fixture.societyId, fixture.unitA],
        ),
      );
      expect(ownContacts.rows[0]?.page.items).toHaveLength(1);
      expect(
        await dbError(
          asUser('residentB', (client) =>
            client.query(
              'select * from public.directory_emergency_contacts_list($1,$2)',
              [fixture.societyId, fixture.unitA],
            ),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      const committeeContacts = await asUser('committee', (client) =>
        client.query<{ page: Page<{ id: string }> }>(
          'select public.directory_emergency_contacts_list($1,$2,25,0) as page',
          [fixture.societyId, fixture.unitA],
        ),
      );
      expect(committeeContacts.rows[0]?.page.items).toHaveLength(1);
      expect(
        await dbError(
          asUser('guard', (client) =>
            client.query(
              'select * from public.directory_emergency_contacts_list($1,$2)',
              [fixture.societyId, fixture.unitA],
            ),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      await asUser('residentA', (client) =>
        client.query(
          'select public.directory_emergency_contact_deactivate($1,$2)',
          [fixture.societyId, savedContact.rows[0]?.id],
        ),
      );
      const inactiveContacts = await asUser('residentA', (client) =>
        client.query<{ page: Page<{ id: string }> }>(
          'select public.directory_emergency_contacts_list($1,$2,25,0) as page',
          [fixture.societyId, fixture.unitA],
        ),
      );
      expect(inactiveContacts.rows[0]?.page).toMatchObject({
        items: [],
        total: 0,
      });
      const visibilityAudit = await database.asSuperuser((client) =>
        client.query<{ after: Record<string, unknown> }>(
          `select action,entity_type,"after"
           from public.audit_logs
           where society_id=$1 and actor_id=$2
             and action='directory.visibility.update'`,
          [fixture.societyId, fixture.users.residentB],
        ),
      );
      expect(visibilityAudit.rows).toHaveLength(3);
      expect(Object.keys(visibilityAudit.rows[0]!.after).sort()).toEqual([
        'name_visible',
        'phone_visible',
        'unit_visible',
      ]);
      expect(
        await dbError(
          asUser('guard', (client) =>
            client.query(
              'select public.directory_resident_list($1,null,25,0)',
              [fixture.societyId],
            ),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      for (const table of [
        'directory_preferences',
        'directory_vehicles',
        'directory_emergency_contacts',
      ]) {
        expect(
          await dbError(
            asUser('residentA', (client) =>
              client.query(`select * from public.${table}`),
            ),
          ),
        ).toMatchObject({ code: '42501' });
      }
      expect(
        await dbError(
          asUser('unassigned', (client) =>
            client.query(
              'select public.directory_resident_list($1,null,25,0)',
              [fixture.societyId],
            ),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      expect(
        await dbError(
          asUser('residentA', (client) =>
            client.query(
              'select registration_number from public.directory_vehicles',
            ),
          ),
        ),
      ).toMatchObject({ code: '42501' });

      await asUser('residentA', (client) =>
        client.query(
          `select public.directory_set_visibility($1,false,false,false)`,
          [fixture.societyId],
        ),
      );
      const sourceOccupant = await database.asSuperuser((client) =>
        client.query<{ id: string }>(
          `select id from public.unit_occupants
           where society_id=$1 and unit_id=$2 and membership_id=$3
             and status='active'`,
          [fixture.societyId, fixture.unitA, fixture.membershipA],
        ),
      );
      const activeContact = await asUser('residentA', (client) =>
        client.query<{ id: string }>(
          `select public.directory_emergency_contact_save(
             $1,null,$2,null,'Transfer Contact','parent','+919876543210',$3
           ) as id`,
          [fixture.societyId, fixture.unitA, crypto.randomUUID()],
        ),
      );
      const otherHouseholdVehicle = await asUser('residentB', (client) =>
        client.query<{ id: string }>(
          `select public.directory_vehicle_save(
            $1,null,$2,null,'car','MH99ZZ9999',null,$3
          ) as id`,
          [fixture.societyId, fixture.unitB, crypto.randomUUID()],
        ),
      );
      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled=false
         where society_id=$1 and module_key='directory'`,
          [fixture.societyId],
        ),
      );
      const movedOccupant = await asUser('admin', (client) =>
        client.query<{ id: string }>(
          `select public.move_unit_occupant($1,$2,$3,$4) as id`,
          [
            fixture.societyId,
            sourceOccupant.rows[0]?.id,
            fixture.unitB,
            crypto.randomUUID(),
          ],
        ),
      );
      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled=true
         where society_id=$1 and module_key='directory'`,
          [fixture.societyId],
        ),
      );
      const movedRecords = await database.asSuperuser((client) =>
        client.query<{
          vehicles: Array<{
            unit_id: string;
            verified_at: string | null;
            registration_number: string;
          }>;
          contact: { unit_id: string; phone: string };
        }>(
          `select
             (select jsonb_agg(jsonb_build_object(
                'unit_id',unit_id,'verified_at',verified_at,
                'registration_number',registration_number
              )) from public.directory_vehicles
              where society_id=$1 and membership_id=$2 and status='active') as vehicles,
             (select jsonb_build_object('unit_id',unit_id,'phone',phone)
              from public.directory_emergency_contacts
              where id=$3) as contact`,
          [fixture.societyId, fixture.membershipA, activeContact.rows[0]?.id],
        ),
      );
      expect(movedRecords.rows[0]?.vehicles).toHaveLength(2);
      expect(
        movedRecords.rows[0]?.vehicles?.every(
          ({ unit_id, verified_at }) =>
            unit_id === fixture.unitB && verified_at === null,
        ),
      ).toBe(true);
      expect(movedRecords.rows[0]?.contact).toMatchObject({
        unit_id: fixture.unitB,
        phone: '+919876543210',
      });
      const movedContactVisibleToHousehold = await asUser(
        'residentB',
        (client) =>
          client.query<{ page: Page<{ id: string }> }>(
            'select public.directory_emergency_contacts_list($1,$2,25,0) as page',
            [fixture.societyId, fixture.unitB],
          ),
      );
      expect(
        movedContactVisibleToHousehold.rows[0]?.page.items.map(({ id }) => id),
      ).toContain(activeContact.rows[0]?.id);
      const movedHouseholds = await asUser('residentA', (client) =>
        client.query('select * from public.directory_my_households($1)', [
          fixture.societyId,
        ]),
      );
      expect(movedHouseholds.rows).toEqual([
        {
          unit_id: fixture.unitB,
          membership_id: fixture.membershipA,
          unit_number: '1B',
        },
      ]);
      expect(
        (await listResidents('residentB')).items.map(
          ({ membership_id }) => membership_id,
        ),
      ).not.toContain(fixture.membershipA);
      const transferAudit = await database.asSuperuser((client) =>
        client.query<{ action: string; before: unknown; after: unknown }>(
          `select action,"before","after" from public.audit_logs
           where society_id=$1 and action in (
             'directory.vehicle.transfer',
             'directory.emergency_contact.transfer'
           )`,
          [fixture.societyId],
        ),
      );
      expect(transferAudit.rows).toHaveLength(3);
      expect(JSON.stringify(transferAudit.rows)).not.toContain('MH12');
      expect(JSON.stringify(transferAudit.rows)).not.toContain('+919876543210');

      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled=false
           where society_id=$1 and module_key='directory'`,
          [fixture.societyId],
        ),
      );
      await asUser('admin', (client) =>
        client.query(
          `select public.end_unit_occupancy($1,$2,(now() at time zone 'Asia/Kolkata')::date,$3)`,
          [fixture.societyId, movedOccupant.rows[0]?.id, crypto.randomUUID()],
        ),
      );
      const endedRecords = await database.asSuperuser((client) =>
        client.query<{
          vehicle_count: number;
          contact_status: string;
          vehicle_purge_after: string;
          contact_purge_after: string;
        }>(
          `select
             (select count(*)::int from public.directory_vehicles
              where society_id=$1 and membership_id=$2 and status='inactive') as vehicle_count,
             (select status from public.directory_emergency_contacts
              where id=$3) as contact_status,
             (select min(purge_after)::text from public.directory_vehicles
              where society_id=$1 and membership_id=$2) as vehicle_purge_after,
             (select purge_after::text from public.directory_emergency_contacts
              where id=$3) as contact_purge_after`,
          [fixture.societyId, fixture.membershipA, activeContact.rows[0]?.id],
        ),
      );
      expect(endedRecords.rows[0]).toMatchObject({
        vehicle_count: 2,
        contact_status: 'inactive',
      });
      expect(endedRecords.rows[0]?.vehicle_purge_after).toBe(
        endedRecords.rows[0]?.contact_purge_after,
      );
      const beforePurge = await database.asRole(
        'service_role',
        null,
        (client) =>
          client.query<{ result: Record<string, number> }>(
            `select public.directory_retention_run(
               ($1::date - 1),$2
             ) as result`,
            [endedRecords.rows[0]?.vehicle_purge_after, crypto.randomUUID()],
          ),
        { commit: true },
      );
      expect(beforePurge.rows[0]?.result).toEqual({
        vehicles_deleted: 0,
        emergency_contacts_deleted: 0,
        preferences_deleted: 0,
      });
      const stillRetained = await database.asSuperuser((client) =>
        client.query<{ count: number }>(
          `select count(*)::int as count from public.directory_vehicles
           where society_id=$1 and membership_id=$2`,
          [fixture.societyId, fixture.membershipA],
        ),
      );
      expect(stillRetained.rows[0]?.count).toBe(2);
      const atPurge = await database.asRole(
        'service_role',
        null,
        (client) =>
          client.query<{ result: Record<string, number> }>(
            `select public.directory_retention_run($1::date,$2) as result`,
            [endedRecords.rows[0]?.vehicle_purge_after, crypto.randomUUID()],
          ),
        { commit: true },
      );
      expect(atPurge.rows[0]?.result).toEqual({
        vehicles_deleted: 2,
        emergency_contacts_deleted: 2,
        preferences_deleted: 1,
      });
      const purgeAudit = await database.asSuperuser((client) =>
        client.query<{ after: Record<string, unknown> }>(
          `select "after" from public.audit_logs
           where action='directory.retention.purge'`,
        ),
      );
      expect(purgeAudit.rows).toHaveLength(1);
      expect(purgeAudit.rows[0]?.after).toEqual({
        vehicles_deleted: 2,
        emergency_contacts_deleted: 2,
        preferences_deleted: 1,
      });
      expect(
        await dbError(
          asUser('admin', (client) =>
            client.query(
              'select public.directory_retention_run(current_date,$1)',
              [crypto.randomUUID()],
            ),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      const repeatPurge = await database.asRole(
        'service_role',
        null,
        (client) =>
          client.query<{ result: Record<string, number> }>(
            'select public.directory_retention_run($1::date,$2) as result',
            [endedRecords.rows[0]?.vehicle_purge_after, crypto.randomUUID()],
          ),
        { commit: true },
      );
      expect(repeatPurge.rows[0]?.result).toEqual({
        vehicles_deleted: 0,
        emergency_contacts_deleted: 0,
        preferences_deleted: 0,
      });
      const otherVehicle = await database.asSuperuser((client) =>
        client.query(
          'select unit_id,status from public.directory_vehicles where id=$1',
          [otherHouseholdVehicle.rows[0]?.id],
        ),
      );
      expect(otherVehicle.rows).toEqual([
        { unit_id: fixture.unitB, status: 'active' },
      ]);

      const reentry = await database.asSuperuser(async (client) => {
        await client.query(
          `update public.module_configs set enabled=true
          where society_id=$1 and module_key='directory'`,
          [fixture.societyId],
        );
        const occupant = await client.query<{ id: string }>(
          `insert into public.unit_occupants (
            society_id,unit_id,membership_id,relationship,status,started_at,created_by
          ) values ($1,$2,$3,'owner','active',current_date,$4) returning id`,
          [
            fixture.societyId,
            fixture.unitA,
            fixture.membershipA,
            fixture.users.admin,
          ],
        );
        const vehicle = await client.query<{ id: string }>(
          `insert into public.directory_vehicles (
            society_id,unit_id,membership_id,vehicle_type,registration_number,
            status,purge_after,created_by,client_request_id
          ) values ($1,$2,$3,'car','MH01RE1234','inactive',current_date,$4,$5)
          returning id`,
          [
            fixture.societyId,
            fixture.unitA,
            fixture.membershipA,
            fixture.users.admin,
            crypto.randomUUID(),
          ],
        );
        return {
          occupantId: occupant.rows[0]!.id,
          vehicleId: vehicle.rows[0]!.id,
        };
      });
      await asUser('residentA', (client) =>
        client.query(
          `select public.directory_vehicle_save(
          $1,$2,$3,null,'car','MH01RE1234',null,$4
        )`,
          [
            fixture.societyId,
            reentry.vehicleId,
            fixture.unitA,
            crypto.randomUUID(),
          ],
        ),
      );
      const reactivated = await database.asSuperuser((client) =>
        client.query(
          'select status,purge_after,verified_at from public.directory_vehicles where id=$1',
          [reentry.vehicleId],
        ),
      );
      expect(reactivated.rows).toEqual([
        { status: 'active', purge_after: null, verified_at: null },
      ]);
      await asUser('admin', (client) =>
        client.query(
          'select public.end_unit_occupancy($1,$2,current_date+30,$3)',
          [fixture.societyId, reentry.occupantId, crypto.randomUUID()],
        ),
      );
      const futureEnd = await database.asSuperuser((client) =>
        client.query<{
          status: string;
          correct_anchor: boolean;
        }>(
          `select status,purge_after=(current_date+30+interval '1 year')::date as correct_anchor
        from public.directory_vehicles where id=$1`,
          [reentry.vehicleId],
        ),
      );
      expect(futureEnd.rows).toEqual([
        { status: 'inactive', correct_anchor: true },
      ]);
      await database.asSuperuser((client) =>
        client.query(
          `update public.memberships set status='deactivated',left_at=now()-interval '2 days'
          where id=$1`,
          [fixture.membershipB],
        ),
      );
      const deactivated = await database.asSuperuser((client) =>
        client.query(
          `select status,verified_at,
          purge_after=((now() at time zone 'Asia/Kolkata')::date-2+interval '1 year')::date as correct_anchor
          from public.directory_vehicles where id=$1`,
          [otherHouseholdVehicle.rows[0]?.id],
        ),
      );
      expect(deactivated.rows).toEqual([
        { status: 'inactive', verified_at: null, correct_anchor: true },
      ]);
      const membershipPurge = await database.asRole(
        'service_role',
        null,
        (client) =>
          client.query<{ result: Record<string, number> }>(
            `select public.directory_retention_run(
            ((now() at time zone 'Asia/Kolkata')::date-2+interval '1 year')::date,$1
          ) as result`,
            [crypto.randomUUID()],
          ),
        { commit: true },
      );
      expect(membershipPurge.rows[0]?.result.vehicles_deleted).toBe(1);
      const backdated = await database.asSuperuser((client) =>
        client.query<{ id: string }>(
          `insert into public.unit_occupants (
          society_id,unit_id,membership_id,relationship,status,started_at,created_by
        ) values ($1,$2,$3,'owner','active',current_date-10,$4) returning id`,
          [
            fixture.societyId,
            fixture.unitA,
            fixture.membershipA,
            fixture.users.admin,
          ],
        ),
      );
      const backdatedVehicle = await asUser('residentA', (client) =>
        client.query<{ id: string }>(
          `select public.directory_vehicle_save(
          $1,null,$2,null,'car','MH01BA1234',null,$3
        ) as id`,
          [fixture.societyId, fixture.unitA, crypto.randomUUID()],
        ),
      );
      await asUser('admin', (client) =>
        client.query(
          'select public.end_unit_occupancy($1,$2,current_date-1,$3)',
          [fixture.societyId, backdated.rows[0]?.id, crypto.randomUUID()],
        ),
      );
      const backdatedEnd = await database.asSuperuser((client) =>
        client.query(
          `select status,purge_after=(current_date-1+interval '1 year')::date as correct_anchor
          from public.directory_vehicles where id=$1`,
          [backdatedVehicle.rows[0]?.id],
        ),
      );
      expect(backdatedEnd.rows).toEqual([
        { status: 'inactive', correct_anchor: true },
      ]);
      const directoryAudit = await database.asSuperuser((client) =>
        client.query(
          `select "before","after" from public.audit_logs
          where society_id=$1 and action like 'directory.%'`,
          [fixture.societyId],
        ),
      );
      expect(JSON.stringify(directoryAudit.rows)).not.toContain(
        '+919876543210',
      );
      expect(JSON.stringify(directoryAudit.rows)).not.toContain('MH12');
      expect(JSON.stringify(directoryAudit.rows)).not.toContain(
        'Emergency Contact',
      );
      const otherSociety = await database.asSuperuser(async (client) => {
        const society = await client.query<{ id: string }>(
          `insert into public.societies(name,created_by)
            values('Other Directory Society',$1) returning id`,
          [fixture.users.admin],
        );
        const societyId = society.rows[0]!.id;
        const member = await client.query<{ id: string }>(
          `insert into public.memberships(society_id,user_id,roles,status)
            values($1,$2,array['resident']::text[],'active') returning id`,
          [societyId, fixture.users.unassigned],
        );
        const unit = await client.query<{ id: string }>(
          `insert into public.units(society_id,number,created_by)
            values($1,'Other-101',$2) returning id`,
          [societyId, fixture.users.admin],
        );
        const membershipId = member.rows[0]!.id;
        const unitId = unit.rows[0]!.id;
        await client.query(
          `insert into public.unit_occupants(society_id,unit_id,membership_id,relationship,status,created_by)
            values($1,$2,$3,'owner','active',$4)`,
          [societyId, unitId, membershipId, fixture.users.admin],
        );
        await client.query(
          `insert into public.module_configs(society_id,module_key,enabled)
            values($1,'core',true),($1,'directory',true)`,
          [societyId],
        );
        await client.query(
          `insert into public.directory_vehicles(
            society_id,unit_id,membership_id,vehicle_type,registration_number,
            verified_at,verified_by,created_by,client_request_id
          ) values($1,$2,$3,'car','MH12AB1234',now(),$4,$4,$5)`,
          [
            societyId,
            unitId,
            membershipId,
            fixture.users.admin,
            crypto.randomUUID(),
          ],
        );
        return { societyId, membershipId, unitId };
      });
      for (const [user, sql, args] of [
        [
          'residentA',
          'select public.directory_resident_list($1,null,25,0)',
          [otherSociety.societyId],
        ],
        [
          'admin',
          'select public.directory_vehicle_list($1,25,0)',
          [otherSociety.societyId],
        ],
        [
          'guard',
          'select public.directory_guard_vehicle_lookup($1,$2)',
          [otherSociety.societyId, 'MH12AB1234'],
        ],
        [
          'residentA',
          'select public.directory_emergency_contacts_list($1,$2,25,0)',
          [otherSociety.societyId, otherSociety.unitId],
        ],
        [
          'admin',
          `select public.directory_vehicle_save($1,null,$2,$3,'car','MH22AA1234',null,$4)`,
          [
            fixture.societyId,
            otherSociety.unitId,
            otherSociety.membershipId,
            crypto.randomUUID(),
          ],
        ],
      ] as const) {
        expect(
          await dbError(asUser(user, (client) => client.query(sql, [...args]))),
        ).toMatchObject({ code: '42501' });
      }
      const otherResidents = await asUser('unassigned', (client) =>
        client.query<{
          page: Page<{ membership_id: string }>;
        }>('select public.directory_resident_list($1,null,25,0) as page', [
          otherSociety.societyId,
        ]),
      );
      expect(
        otherResidents.rows[0]?.page.items.map(
          ({ membership_id }) => membership_id,
        ),
      ).toEqual([otherSociety.membershipId]);
    } finally {
      await database.drop();
    }
  });
});
