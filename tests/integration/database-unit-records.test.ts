// Verify P36 record isolation, edit conflicts, retention and billing independence.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database unit records', () => {
  it('keeps records private, auditable and separate from authoritative unit data', async () => {
    const database = await createTestDatabase();
    try {
      const {
        admin,
        committee,
        resident,
        residentMembership,
        reading,
        society,
        foreignSociety,
        unit,
        otherUnit,
        handler,
      } = await database.asSuperuser(async (client) => {
        const admin = await newAuthUser(client, 'p36-admin@example.test');
        const committee = await newAuthUser(
          client,
          'p36-committee@example.test',
        );
        const resident = await newAuthUser(client, 'p36-resident@example.test');
        await client.query(
          `insert into public.profiles(id,email,full_name) values
          ($1,'p36-admin@example.test','Admin'),
          ($2,'p36-committee@example.test','Committee'),
          ($3,'p36-resident@example.test','Resident')`,
          [admin, committee, resident],
        );
        const society = randomUUID();
        const foreignSociety = randomUUID();
        await client.query(
          `insert into public.societies(id,name,created_by) values ($1,'Map test',$3),($2,'Other test',$3)`,
          [society, foreignSociety, admin],
        );
        const handler = randomUUID();
        const residentMembership = randomUUID();
        await client.query(
          `insert into public.memberships(id,society_id,user_id,roles,status) values
          ($1,$2,$3,ARRAY['admin'],'active'),
          (gen_random_uuid(),$2,$4,ARRAY['committee'],'active'),
          ($5,$2,$6,ARRAY['resident'],'active')`,
          [handler, society, admin, committee, residentMembership, resident],
        );
        const unit = randomUUID();
        const otherUnit = randomUUID();
        await client.query(
          `insert into public.units(id,society_id,number,floor,area_sqft,created_by) values
          ($1,$3,'101',1,900,$4),($2,$3,'102',1,NULL,$4)`,
          [unit, otherUnit, society, admin],
        );
        await client.query(
          `insert into public.unit_occupants(
             society_id,unit_id,membership_id,relationship,status,created_by
           ) values($1,$2,$3,'owner','active',$4)`,
          [society, unit, residentMembership, admin],
        );
        await client.query(
          `insert into public.module_configs(
             society_id,module_key,enabled,settings
           ) values($1,'core',true,'{}'),($1,'metering',true,'{}')`,
          [society],
        );
        const meter = (
          await client.query<{ id: string }>(
            `insert into public.metering_meters(
               society_id,meter_type,scope,unit_id,label,initial_reading,
               client_request_id,created_by
             ) values($1,'water','unit',$2,'Unit water',100,$3,$4)
             returning id`,
            [society, unit, randomUUID(), admin],
          )
        ).rows[0]!.id;
        const reading = (
          await client.query<{ id: string }>(
            `insert into public.metering_readings(
               society_id,meter_id,unit_id,reading_value,reading_date,
               source,status,previous_value,consumption,is_reset,
               reviewed_at,reviewed_by,client_request_id,created_by
             ) values(
               $1,$2,$3,105,current_date,'admin','approved',100,5,false,
               clock_timestamp(),$4,$5,$4
             ) returning id`,
            [society, meter, unit, admin, randomUUID()],
          )
        ).rows[0]!.id;
        return {
          admin,
          committee,
          resident,
          residentMembership,
          society,
          foreignSociety,
          unit,
          otherUnit,
          handler,
          reading,
        };
      });
      const read = (user: string, scope = society) =>
        database.asRole(
          'authenticated',
          { sub: user },
          async (client) =>
            (
              await client.query<{
                result: {
                  today: string;
                  areas: { status: string }[];
                  followups: { id: string; version: number }[];
                  placement: { level: number; position: number } | null;
                };
              }>('select public.unit_records_get($1,$2) as result', [
                scope,
                unit,
              ])
            ).rows[0]!.result,
        );
      const save = (
        kind: string,
        values: object,
        key = randomUUID(),
        target = unit,
      ) =>
        database.asRole(
          'authenticated',
          { sub: admin },
          (client) =>
            client.query(
              "select public.unit_records_save($1,$2,$3,$4,$5,'p36-test')",
              [society, target, kind, JSON.stringify(values), key],
            ),
          { commit: true },
        );

      expect((await dbError(read(committee))).code).toBe('42501');
      expect((await dbError(read(admin, foreignSociety))).code).toBe('42501');
      expect(
        (
          await dbError(
            database.asRole('authenticated', { sub: admin }, (client) =>
              client.query('select * from public.unit_vacancy_followups'),
            ),
          )
        ).code,
      ).toBe('42501');
      const measure = {
        version: 0,
        source: 'Society record',
        carpet: '710.25',
      };
      expect(
        (await dbError(save('measure', { ...measure, carpet: 'NaN' }))).code,
      ).toBe('22023');
      await save('measure', measure);
      expect((await dbError(save('measure', measure))).code).toBe('40001');
      await save('verify', { version: 1, status: 'verified' });
      expect((await read(admin)).areas.map(({ status }) => status)).toEqual([
        'verified',
        'pending',
      ]);
      const area = await database.asSuperuser((client) =>
        client.query('select area_sqft from public.units where id=$1', [unit]),
      );
      expect(area.rows).toEqual([{ area_sqft: '900.00' }]);

      const today = (await read(admin)).today;
      const vacancy = {
        version: 0,
        id: null,
        kind: 'locked',
        assignedTo: handler,
        startsOn: today,
        followUpOn: today,
      };
      await save('vacancy', vacancy);
      const followup = (await read(admin)).followups[0]!;
      const closeKey = randomUUID();
      await save('close', followup, closeKey);
      await save('close', followup, closeKey);
      await save('vacancy', vacancy);
      const retained = await database.asRole(
        'service_role',
        {},
        (client) =>
          client.query(
            "select public.unit_vacancy_retention_run($1::date + 400, 'p36-retention') as removed",
            [today],
          ),
        { commit: true },
      );
      expect(retained.rows).toEqual([{ removed: 1 }]);
      expect((await read(admin)).followups).toHaveLength(1);

      type Layout = {
        buildings: { id: string; name: string }[];
        selected: string | null;
        version: string | null;
        floors: {
          level: number;
          spaces: {
            id: string;
            kind: string;
            unit: { id: string; number: string } | null;
          }[];
        }[];
      };
      const layout = (user: string, block: string | null = null) =>
        database.asRole(
          'authenticated',
          { sub: user },
          async (client) =>
            (
              await client.query<{ result: Layout }>(
                'select public.building_layout_get($1,$2) as result',
                [society, block],
              )
            ).rows[0]!.result,
        );
      const saveLayout = (
        user: string,
        block: string | null,
        values: object,
        key = randomUUID(),
      ) =>
        database.asRole(
          'authenticated',
          { sub: user },
          async (client) =>
            (
              await client.query<{ id: string }>(
                "select public.building_layout_save($1,$2,$3,$4,'p36-layout') as id",
                [society, block, JSON.stringify(values), key],
              )
            ).rows[0]!.id,
          { commit: true },
        );
      const place = (
        target: string,
        block: string,
        space: string | null,
        version: string | null,
      ) =>
        database.asRole(
          'authenticated',
          { sub: admin },
          (client) =>
            client.query(
              "select public.building_unit_place($1,$2,$3,$4,$5,$6,'p36-place')",
              [society, target, block, space, version, randomUUID()],
            ),
          { commit: true },
        );
      const spot = (id: string | null = null, kind = 'unit') => ({
        id,
        kind,
        name: null,
        duplex: false,
      });
      const tower = {
        name: 'Tower A',
        version: null,
        floors: [
          { level: 1, label: null, whole: false, spaces: [spot(), spot()] },
          {
            level: 0,
            label: null,
            whole: true,
            spaces: [{ ...spot(null, 'parking'), name: 'Stilt parking' }],
          },
        ],
      };

      expect((await layout(committee)).buildings).toEqual([]);
      expect((await dbError(saveLayout(committee, null, tower))).code).toBe(
        '42501',
      );
      for (const invalid of [
        {
          ...tower,
          floors: [{ ...tower.floors[0], level: 2 }, tower.floors[1]],
        },
        { ...tower, floors: [tower.floors[0]] },
        {
          ...tower,
          floors: [
            tower.floors[0],
            {
              ...tower.floors[1],
              whole: false,
              spaces: [{ ...spot(), duplex: true }],
            },
          ],
        },
      ]) {
        expect((await dbError(saveLayout(admin, null, invalid))).code).toBe(
          '22023',
        );
      }
      const createKey = randomUUID();
      const block = await saveLayout(admin, null, tower, createKey);
      expect(await saveLayout(admin, null, tower, createKey)).toBe(block);
      const created = await layout(committee);
      expect(created.selected).toBe(block);
      expect(created.floors.map(({ level }) => level)).toEqual([1, 0]);
      const [first, second] = created.floors[0]!.spaces;

      await place(unit, block, first!.id, created.version);
      expect(
        (
          await dbError(
            place(otherUnit, block, first!.id, (await layout(admin)).version),
          )
        ).code,
      ).toBe('40001');
      expect((await read(admin)).placement).toMatchObject({
        level: 1,
        position: 1,
      });
      const placed = await layout(admin);
      expect(placed.floors[0]!.spaces[0]!.unit?.id).toBe(unit);
      expect(
        (
          await dbError(
            saveLayout(admin, block, { ...tower, version: created.version }),
          )
        ).code,
      ).toBe('40001');
      const keep = (spaces: object[]) => ({
        ...tower,
        version: placed.version,
        floors: [{ ...tower.floors[0], spaces }, tower.floors[1]],
      });
      expect(
        (await dbError(saveLayout(admin, block, keep([spot(second!.id)]))))
          .code,
      ).toBe('22023');
      expect(
        (
          await dbError(
            saveLayout(
              admin,
              block,
              keep([
                { ...spot(first!.id, 'shop'), name: 'Shop' },
                spot(second!.id),
              ]),
            ),
          )
        ).code,
      ).toBe('22023');
      await saveLayout(admin, block, keep([spot(second!.id), spot(first!.id)]));
      const reordered = await layout(admin);
      expect(reordered.floors[0]!.spaces[1]!.unit?.id).toBe(unit);
      expect(
        (
          await dbError(
            database.asRole('authenticated', { sub: admin }, (client) =>
              client.query(
                'update public.blocks set active = false where id=$1',
                [block],
              ),
            ),
          )
        ).code,
      ).toBe('23514');
      const unitRow = await database.asSuperuser((client) =>
        client.query('select block_id, floor from public.units where id=$1', [
          unit,
        ]),
      );
      expect(unitRow.rows).toEqual([{ block_id: block, floor: 1 }]);
      await database.asSuperuser((client) =>
        client.query('update public.units set floor = 2 where id=$1', [unit]),
      );
      expect((await read(admin)).placement).toBeNull();
      expect(
        (await layout(admin)).floors[0]!.spaces.every(({ unit }) => !unit),
      ).toBe(true);

      const template = [
        { key: 'keys', label: 'Keys' },
        { key: 'meters', label: 'Meters' },
      ];
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.unit_handover_template_save(
               $1,$2::jsonb,0,$3,'p36-handover-template'
             )`,
            [society, JSON.stringify(template), randomUUID()],
          ),
        { commit: true },
      );
      const handoverRequest = randomUUID();
      expect(
        await dbError(
          database.asRole(
            'authenticated',
            { sub: committee },
            (client) =>
              client.query(
                `select public.unit_handover_create(
                   $1,$2,'standalone',null,null,$3,null,$4::uuid[],$5,
                   'p36-committee-create'
                 )`,
                [society, unit, today, [residentMembership], randomUUID()],
              ),
            { commit: true },
          ),
        ),
      ).toMatchObject({ code: '42501' });
      const committeeMembership = await database.asSuperuser(
        async (client) =>
          (
            await client.query<{ id: string }>(
              'select id from public.memberships where society_id=$1 and user_id=$2',
              [society, committee],
            )
          ).rows[0]!.id,
      );
      expect(
        await dbError(
          database.asRole(
            'authenticated',
            { sub: admin },
            (client) =>
              client.query(
                `select public.unit_handover_create(
                   $1,$2,'standalone',null,null,$3,null,$4::uuid[],$5,
                   'p36-unrelated-party'
                 )`,
                [society, unit, today, [committeeMembership], randomUUID()],
              ),
            { commit: true },
          ),
        ),
      ).toMatchObject({ code: '22023' });
      const createHandover = () =>
        database.asRole(
          'authenticated',
          { sub: admin },
          async (client) =>
            (
              await client.query<{ id: string }>(
                `select public.unit_handover_create(
                   $1,$2,'standalone',null,null,$3,'Synthetic condition check',
                   $4::uuid[],$5,'p36-handover-create'
                 ) as id`,
                [society, unit, today, [residentMembership], handoverRequest],
              )
            ).rows[0]!.id,
          { commit: true },
        );
      const handoverId = await createHandover();
      expect(await createHandover()).toBe(handoverId);
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.unit_handover_reading_link(
               $1,$2,$3,$4,'p36-handover-reading'
             )`,
            [society, handoverId, reading, randomUUID()],
          ),
        { commit: true },
      );
      const handovers = async (user: string) =>
        database.asRole(
          'authenticated',
          { sub: user },
          async (client) =>
            (
              await client.query<{ result: Record<string, unknown> }>(
                'select public.unit_handover_workspace($1,$2) as result',
                [society, unit],
              )
            ).rows[0]!.result,
        );
      for (const viewer of [admin, committee, resident])
        expect(
          (
            (await handovers(viewer)).handovers as {
              id: string;
              items: unknown[];
              photos: unknown[];
            }[]
          ).find(({ id }) => id === handoverId),
        ).toMatchObject({ items: [{}, {}], photos: [], readings: [{}] });
      const handoverView = (
        (await handovers(resident)).handovers as {
          id: string;
          items: { id: string }[];
        }[]
      ).find(({ id }) => id === handoverId)!;
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.unit_handover_items_save(
               $1,$2,$3::jsonb,'Initial answers',1,'p36-handover-items'
             )`,
            [
              society,
              handoverId,
              JSON.stringify(
                handoverView.items.map((item) => ({
                  item_id: item.id,
                  response: 'yes',
                  note: '',
                })),
              ),
            ],
          ),
        { commit: true },
      );
      const handoverPath = await database.asRole(
        'authenticated',
        { sub: admin },
        async (client) =>
          (
            await client.query<{ path: string }>(
              `select public.unit_handover_photo_upload_path(
                 $1,$2,'application/pdf',1024
               ) as path`,
              [society, handoverId],
            )
          ).rows[0]!.path,
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `insert into storage.objects(bucket_id,name,metadata)
             values('handover-photos',$1,$2::jsonb)`,
            [
              handoverPath,
              JSON.stringify({ mimetype: 'application/pdf', size: 1024 }),
            ],
          ),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.unit_handover_photo_add(
               $1,$2,$3,'application/pdf',1024,$4,'p36-handover-photo'
             )`,
            [society, handoverId, handoverPath, randomUUID()],
          ),
        { commit: true },
      );
      expect(
        (
          (await handovers(committee)).handovers as {
            id: string;
            photos: unknown[];
          }[]
        ).find(({ id }) => id === handoverId)!.photos.length,
      ).toBe(0);
      expect(
        (
          (await handovers(resident)).handovers as {
            id: string;
            photos: unknown[];
          }[]
        ).find(({ id }) => id === handoverId)!.photos.length,
      ).toBe(1);
      expect(
        (
          await database.asRole('authenticated', { sub: resident }, (client) =>
            client.query<{ allowed: boolean }>(
              `select public.unit_handover_file_access($1,$2) as allowed`,
              [society, handoverPath],
            ),
          )
        ).rows[0]!.allowed,
      ).toBe(true);
      expect(
        (
          await database.asRole('authenticated', { sub: committee }, (client) =>
            client.query<{ allowed: boolean }>(
              `select public.unit_handover_file_access($1,$2) as allowed`,
              [society, handoverPath],
            ),
          )
        ).rows[0]!.allowed,
      ).toBe(false);
      await database.asRole(
        'authenticated',
        { sub: resident },
        (client) =>
          client.query(
            `select public.unit_handover_acknowledge(
               $1,$2,'Seen and accepted','p36-handover-ack'
             )`,
            [society, handoverId],
          ),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.unit_handover_close(
               $1,$2,2,'p36-handover-close'
             )`,
            [society, handoverId],
          ),
        { commit: true },
      );
      const closed = (
        (await handovers(committee)).handovers as {
          id: string;
          status: string;
          parties: { acknowledged_at: string | null }[];
        }[]
      ).find(({ id }) => id === handoverId)!;
      expect(closed.status).toBe('closed');
      expect(closed.parties[0]!.acknowledged_at).toBeTruthy();
      for (const table of [
        'unit_handover_templates',
        'unit_handovers',
        'unit_handover_parties',
        'unit_handover_items',
        'unit_handover_readings',
        'unit_handover_photos',
        'unit_handover_acknowledgements',
        'unit_handover_revisions',
      ])
        expect(
          await dbError(
            database.asRole('authenticated', { sub: admin }, (client) =>
              client.query(`select * from public.${table}`),
            ),
          ),
        ).toMatchObject({ code: '42501' });
      expect(
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              'delete from public.unit_handover_photos where path=$1',
              [handoverPath],
            ),
          ),
        ),
      ).toMatchObject({ code: '55000' });
    } finally {
      await database.drop();
    }
  });
});
