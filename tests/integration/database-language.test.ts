// Verify Hindi availability defaults, authorization, concurrency and audit.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database language availability', () => {
  it('keeps Hindi off by default and requires an enabled module and society admin', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = {
          admin: await newAuthUser(client),
          committee: await newAuthUser(client),
          resident: await newAuthUser(client),
          otherAdmin: await newAuthUser(client),
        };
        for (const [role, userId] of Object.entries(users)) {
          await client.query(
            'insert into public.profiles (id, email, full_name) values ($1, $2, $3)',
            [userId, `${userId}@example.test`, role],
          );
        }

        const society = (
          await client.query<{ id: string; updated_at: string }>(
            `insert into public.societies (name, created_by, status)
             values ('Language Society', $1, 'active')
             returning id, updated_at::text as updated_at`,
            [users.admin],
          )
        ).rows[0];
        const disabledSociety = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by, status)
             values ('Language Disabled Society', $1, 'active')
             returning id`,
            [users.otherAdmin],
          )
        ).rows[0];
        if (!society || !disabledSociety) {
          throw new Error('Could not create language test societies.');
        }

        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled)
           values ($1, 'language', true)`,
          [society.id],
        );
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values
             ($1, $2, ARRAY['admin']::text[], 'active'),
             ($1, $3, ARRAY['committee']::text[], 'active'),
             ($1, $4, ARRAY['resident']::text[], 'active'),
             ($5, $6, ARRAY['admin']::text[], 'active')`,
          [
            society.id,
            users.admin,
            users.committee,
            users.resident,
            disabledSociety.id,
            users.otherAdmin,
          ],
        );

        const defaults = await client.query<{
          hindi_available: boolean;
        }>('select hindi_available from public.societies where id = $1', [
          society.id,
        ]);
        const disabledModule = await client.query<{ enabled: boolean }>(
          `select private.module_enabled($1, 'language') as enabled`,
          [disabledSociety.id],
        );
        return {
          ...users,
          societyId: society.id,
          disabledSocietyId: disabledSociety.id,
          expectedVersion: society.updated_at,
          hindiAvailable: defaults.rows[0]?.hindi_available,
          disabledModule: disabledModule.rows[0]?.enabled,
        };
      });

      expect(fixture.hindiAvailable).toBe(false);
      expect(fixture.disabledModule).toBe(false);

      for (const userId of [
        fixture.admin,
        fixture.committee,
        fixture.resident,
      ]) {
        const ownSociety = await database.asRole(
          'authenticated',
          { sub: userId },
          (client) =>
            client.query<{ hindi_available: boolean }>(
              'select hindi_available from public.societies where id = $1',
              [fixture.societyId],
            ),
        );
        expect(ownSociety.rows).toEqual([{ hindi_available: false }]);
      }
      const disabledRead = await database.asRole(
        'authenticated',
        { sub: fixture.otherAdmin },
        (client) =>
          client.query<{ hindi_available: boolean }>(
            'select hindi_available from public.societies where id = $1',
            [fixture.disabledSocietyId],
          ),
      );
      expect(disabledRead.rows).toEqual([{ hindi_available: false }]);
      const crossSociety = await database.asRole(
        'authenticated',
        { sub: fixture.otherAdmin },
        (client) =>
          client.query(
            'select hindi_available from public.societies where id = $1',
            [fixture.societyId],
          ),
      );
      expect(crossSociety.rows).toEqual([]);
      const privateColumnError = await dbError(
        database.asRole('authenticated', { sub: fixture.resident }, (client) =>
          client.query('select join_code from public.societies where id = $1', [
            fixture.societyId,
          ]),
        ),
      );
      expect(privateColumnError.code).toBe('42501');

      const enabled = await database.asRole(
        'authenticated',
        { sub: fixture.admin },
        (client) =>
          client.query<{
            result: { hindi_available: boolean; updated_at: string };
          }>(
            `select public.admin_set_hindi_availability($1, true, $2, $3) as result`,
            [
              fixture.societyId,
              fixture.expectedVersion,
              'c3b10f69-e5f8-41cd-a1cf-52a56aa2c081',
            ],
          ),
        { commit: true },
      );
      expect(enabled.rows[0]?.result.hindi_available).toBe(true);

      const audit = await database.asSuperuser((client) =>
        client.query<{
          action: string;
          actor_id: string;
          before: { hindi_available: boolean };
          after: { hindi_available: boolean };
          request_id: string;
        }>(
          `select action, actor_id, "before" as before, "after" as after, request_id
           from public.audit_logs
           where request_id = $1`,
          ['c3b10f69-e5f8-41cd-a1cf-52a56aa2c081'],
        ),
      );
      expect(audit.rows).toEqual([
        {
          action: 'society.update_language_availability',
          actor_id: fixture.admin,
          before: { hindi_available: false },
          after: { hindi_available: true },
          request_id: 'c3b10f69-e5f8-41cd-a1cf-52a56aa2c081',
        },
      ]);

      for (const userId of [
        fixture.committee,
        fixture.resident,
        fixture.otherAdmin,
      ]) {
        const error = await dbError(
          database.asRole('authenticated', { sub: userId }, (client) =>
            client.query(
              `select public.admin_set_hindi_availability($1, false, $2, $3)`,
              [
                fixture.societyId,
                fixture.expectedVersion,
                'c3b10f69-e5f8-41cd-a1cf-52a56aa2c082',
              ],
            ),
          ),
        );
        expect(error.code).toBe('42501');
      }

      const disabledModuleError = await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.otherAdmin },
          (client) =>
            client.query(
              `select public.admin_set_hindi_availability($1, true, $2, $3)`,
              [
                fixture.disabledSocietyId,
                fixture.expectedVersion,
                'c3b10f69-e5f8-41cd-a1cf-52a56aa2c083',
              ],
            ),
        ),
      );
      expect(disabledModuleError.code).toBe('42501');

      const staleVersionError = await dbError(
        database.asRole('authenticated', { sub: fixture.admin }, (client) =>
          client.query(
            `select public.admin_set_hindi_availability($1, false, $2, $3)`,
            [
              fixture.societyId,
              fixture.expectedVersion,
              'c3b10f69-e5f8-41cd-a1cf-52a56aa2c084',
            ],
          ),
        ),
      );
      expect(staleVersionError.code).toBe('40001');

      const directWriteError = await dbError(
        database.asRole('authenticated', { sub: fixture.admin }, (client) =>
          client.query(
            `update public.societies set hindi_available = false where id = $1`,
            [fixture.societyId],
          ),
        ),
      );
      expect(directWriteError.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });
});
