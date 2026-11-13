// Verify private bucket configuration and first-segment society isolation.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

const expectedBuckets = [
  'visitor-photos',
  'delivery-photos',
  'request-files',
  'payment-proofs',
  'society-assets',
  'notice-files',
  'staff-photos',
];

describe.skipIf(!hasDatabase)('database private file storage', () => {
  it('provisions private buckets with limits and type allow-lists', async () => {
    const database = await createTestDatabase();
    try {
      const { rows } = await database.asSuperuser((client) =>
        client.query<{
          id: string;
          public: boolean;
          file_size_limit: number;
          allowed_mime_types: string[];
        }>(
          `select id, public, file_size_limit, allowed_mime_types
           from storage.buckets order by id`,
        ),
      );
      expect(rows).toHaveLength(expectedBuckets.length);
      expect(rows.map(({ id }) => id)).toEqual([...expectedBuckets].sort());
      expect(rows.every((bucket) => !bucket.public)).toBe(true);
      expect(
        rows.every((bucket) => Number(bucket.file_size_limit) === 5242880),
      ).toBe(true);
      expect(
        rows.find(({ id }) => id === 'request-files')?.allowed_mime_types,
      ).toEqual(['image/jpeg', 'image/png', 'application/pdf']);
    } finally {
      await database.drop();
    }
  });

  it('filters every bucket by society and applies per-bucket role policies', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const adminId = await newAuthUser(client, 'storage-admin@example.test');
        const residentId = await newAuthUser(
          client,
          'storage-resident@example.test',
        );
        const guardId = await newAuthUser(client, 'storage-guard@example.test');
        const otherAdminId = await newAuthUser(
          client,
          'storage-other-admin@example.test',
        );
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values
             ($1, 'storage-admin@example.test', 'Storage Admin'),
             ($2, 'storage-resident@example.test', 'Storage Resident'),
             ($3, 'storage-guard@example.test', 'Storage Guard'),
             ($4, 'storage-other-admin@example.test', 'Other Admin')`,
          [adminId, residentId, guardId, otherAdminId],
        );
        const societies = await Promise.all(
          [
            ['Storage Society', adminId],
            ['Other Storage Society', otherAdminId],
          ].map(async ([name, createdBy]) => {
            const result = await client.query<{ id: string }>(
              `insert into public.societies (name, created_by)
               values ($1, $2) returning id`,
              [name, createdBy],
            );
            const societyId = result.rows[0]?.id;
            if (!societyId) throw new Error('Storage society was not created.');
            return societyId;
          }),
        );
        const [societyId, otherSocietyId] = societies;
        if (!societyId || !otherSocietyId) {
          throw new Error('Storage society IDs were not returned.');
        }
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values
             ($1, $2, ARRAY['admin']::text[], 'active'),
             ($1, $3, ARRAY['resident']::text[], 'active'),
             ($1, $4, ARRAY['guard']::text[], 'active'),
             ($5, $6, ARRAY['admin']::text[], 'active')`,
          [
            societyId,
            adminId,
            residentId,
            guardId,
            otherSocietyId,
            otherAdminId,
          ],
        );
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled)
           values ($1, 'visitor', true), ($1, 'delivery', true)`,
          [societyId],
        );
        const unitRows = await client.query<{
          id: string;
          society_id: string;
        }>(
          `insert into public.units (society_id, number, created_by)
           values ($1, '1A', $2), ($3, '1A', $4)
           returning id, society_id`,
          [societyId, adminId, otherSocietyId, otherAdminId],
        );
        const unitId = unitRows.rows.find(
          (unit) => unit.society_id === societyId,
        )?.id;
        const otherUnitId = unitRows.rows.find(
          (unit) => unit.society_id === otherSocietyId,
        )?.id;
        if (!unitId || !otherUnitId) {
          throw new Error('Storage unit fixtures were not created.');
        }
        for (const bucketId of expectedBuckets) {
          const ownName =
            bucketId === 'delivery-photos'
              ? `${societyId}/${unitId}/deliveries/44a696d6-774c-41d1-ae47-6254d4a8f4cf.jpg`
              : `${societyId}/files/object.jpg`;
          const foreignName =
            bucketId === 'delivery-photos'
              ? `${otherSocietyId}/${otherUnitId}/deliveries/54a696d6-774c-41d1-ae47-6254d4a8f4cf.jpg`
              : `${otherSocietyId}/files/object.jpg`;
          await client.query(
            `insert into storage.objects (bucket_id, name)
             values ($1, $2), ($1, $3)`,
            [bucketId, ownName, foreignName],
          );
        }
        await client.query(
          `insert into storage.objects (bucket_id, name)
           values ('society-assets', 'not-a-society/logos/logo.png')`,
        );
        return { adminId, guardId, otherUnitId, residentId, societyId };
      });

      const residentRows = await database.asRole(
        'authenticated',
        { sub: fixture.residentId },
        (client) =>
          client.query<{ bucket_id: string; name: string }>(
            `select bucket_id, name from storage.objects
             where name like $1 order by bucket_id`,
            [`${fixture.societyId}/%`],
          ),
      );
      expect(residentRows.rows.map(({ bucket_id }) => bucket_id)).toEqual([
        'society-assets',
      ]);
      expect(
        residentRows.rows.every(({ name }) =>
          name.startsWith(`${fixture.societyId}/`),
        ),
      ).toBe(true);

      const guardRows = await database.asRole(
        'authenticated',
        { sub: fixture.guardId },
        (client) =>
          client.query<{ bucket_id: string }>(
            `select bucket_id from storage.objects
             where name like $1 order by bucket_id`,
            [`${fixture.societyId}/%`],
          ),
      );
      expect(guardRows.rows.map(({ bucket_id }) => bucket_id)).toEqual([
        'delivery-photos',
        'society-assets',
        'visitor-photos',
      ]);

      const residentAssetUpload = await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.residentId },
          (client) =>
            client.query(
              `insert into storage.objects (bucket_id, name)
               values ('society-assets', $1)`,
              [`${fixture.societyId}/logos/not-authorized.png`],
            ),
        ),
      );
      expect(residentAssetUpload.code).toBe('42501');

      await database.asRole(
        'authenticated',
        { sub: fixture.adminId },
        (client) =>
          client.query(
            `insert into storage.objects (bucket_id, name)
             values ('society-assets', $1)`,
            [`${fixture.societyId}/logos/admin-upload.png`],
          ),
        { commit: true },
      );

      const crossSocietyUpload = await dbError(
        database.asRole('authenticated', { sub: fixture.adminId }, (client) =>
          client.query(
            `insert into storage.objects (bucket_id, name)
               values ('society-assets', $1)`,
            ['not-a-society/logos/not-authorized.png'],
          ),
        ),
      );
      expect(crossSocietyUpload.code).toBe('42501');
      const mismatchedDeliveryUnit = await dbError(
        database.asRole('authenticated', { sub: fixture.guardId }, (client) =>
          client.query(
            `insert into storage.objects (bucket_id, name)
             values ('delivery-photos', $1)`,
            [
              `${fixture.societyId}/${fixture.otherUnitId}/deliveries/64a696d6-774c-41d1-ae47-6254d4a8f4cf.jpg`,
            ],
          ),
        ),
      );
      expect(mismatchedDeliveryUnit.code).toBe('42501');

      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = false
           where society_id = $1 and module_key = 'visitor'`,
          [fixture.societyId],
        ),
      );
      const disabledVisitorPhotos = await database.asRole(
        'authenticated',
        { sub: fixture.guardId },
        (client) =>
          client.query(
            `select name from storage.objects
             where bucket_id = 'visitor-photos' and name like $1`,
            [`${fixture.societyId}/%`],
          ),
      );
      expect(disabledVisitorPhotos.rows).toHaveLength(0);
    } finally {
      await database.drop();
    }
  });
});
