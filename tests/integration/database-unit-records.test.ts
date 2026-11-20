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
                  floor_version: string;
                  areas: { status: string }[];
                  followups: { id: string; version: number }[];
                  floor_units: { id: string; row: number | null }[];
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

      const floorVersion = (await read(admin)).floor_version;
      await save('position', { floorVersion, row: 1, column: 2 });
      expect(
        (
          await dbError(
            save(
              'position',
              { floorVersion, row: 2, column: 1 },
              randomUUID(),
              otherUnit,
            ),
          )
        ).code,
      ).toBe('40001');
      const currentVersion = (await read(admin)).floor_version;
      expect(
        (
          await dbError(
            save(
              'position',
              { floorVersion: currentVersion, row: 1, column: 2 },
              randomUUID(),
              otherUnit,
            ),
          )
        ).code,
      ).toBe('23505');
      await database.asSuperuser(async (client) => {
        await client.query('update public.units set floor = 2 where id=$1', [
          unit,
        ]);
        await client.query('update public.units set floor = 1 where id=$1', [
          unit,
        ]);
      });
      expect(
        (await read(admin)).floor_units.find(({ id }) => id === unit)?.row,
      ).toBeNull();
    } finally {
      await database.drop();
    }
  });
});
