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
        await client.query(
          `insert into public.profiles(id,email,full_name) values
          ($1,'p36-admin@example.test','Admin'),($2,'p36-committee@example.test','Committee')`,
          [admin, committee],
        );
        const society = randomUUID();
        const foreignSociety = randomUUID();
        await client.query(
          `insert into public.societies(id,name,created_by) values ($1,'Map test',$3),($2,'Other test',$3)`,
          [society, foreignSociety, admin],
        );
        const handler = randomUUID();
        await client.query(
          `insert into public.memberships(id,society_id,user_id,roles,status) values
          ($1,$2,$3,ARRAY['admin'],'active'), (gen_random_uuid(),$2,$4,ARRAY['committee'],'active')`,
          [handler, society, admin, committee],
        );
        const unit = randomUUID();
        const otherUnit = randomUUID();
        await client.query(
          `insert into public.units(id,society_id,number,floor,area_sqft,created_by) values
          ($1,$3,'101',1,900,$4),($2,$3,'102',1,NULL,$4)`,
          [unit, otherUnit, society, admin],
        );
        return {
          admin,
          committee,
          society,
          foreignSociety,
          unit,
          otherUnit,
          handler,
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
    } finally {
      await database.drop();
    }
  });
});
