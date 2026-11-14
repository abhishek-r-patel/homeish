// Verify AMC successor history, audited visit edits, private files and catch-up reminders.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database AMC management', () => {
  it('preserves renewal history, restricts documents and sends only the most urgent reminder', async () => {
    const db = await createTestDatabase();
    try {
      const fixture = await db.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of ['admin', 'committee', 'resident']) {
          const id = await newAuthUser(client, `amc-${role}@example.test`);
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `amc-${role}@example.test`, `AMC ${role}`],
          );
          users.set(role, id);
        }
        const societyId = (
          await client.query<{ id: string }>(
            "insert into public.societies(name,created_by) values('AMC society',$1) returning id",
            [users.get('admin')],
          )
        ).rows[0]!.id;
        for (const [role, id] of users)
          await client.query(
            "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,$3,'active')",
            [societyId, id, [role]],
          );
        await client.query(
          "insert into public.module_configs(society_id,module_key,enabled,settings) values($1,'core',true,'{}'),($1,'amc',true,'{}')",
          [societyId],
        );
        const dates = (
          await client.query<{ today: string; later: string }>(
            'select private.housekeeping_local_date($1)::text as today,(private.housekeeping_local_date($1)+5)::text as later',
            [societyId],
          )
        ).rows[0]!;
        const path = `${societyId}/${users.get('admin')}/amc/${crypto.randomUUID()}.pdf`;
        await client.query(
          'insert into storage.objects(bucket_id,name,metadata) values(\'amc-files\',$1,\'{"size":50,"mimetype":"application/pdf"}\')',
          [path],
        );
        await client.query(
          "insert into public.module_configs(society_id,module_key,enabled,settings) values($1,'service_request',true,'{}')",
          [societyId],
        );
        const categoryId = (
          await client.query<{ id: string }>(
            "insert into public.service_request_categories(society_id,name) values($1,'Lift maintenance') returning id",
            [societyId],
          )
        ).rows[0]!.id;
        const requestId = (
          await client.query<{ id: string }>(
            "insert into public.service_requests(society_id,category_id,location_type,description,created_by,client_request_id) values($1,$2,'common_area','Lift inspection needed',$3,$4) returning id",
            [societyId, categoryId, users.get('resident'), crypto.randomUUID()],
          )
        ).rows[0]!.id;
        return { societyId, users, path, requestId, ...dates };
      });
      const asUser = <T>(
        role: string,
        query: Parameters<typeof db.asSuperuser<T>>[0],
      ) => {
        const userId = fixture.users.get(role);
        if (!userId) throw new Error('Missing AMC fixture user.');
        return db.asRole('authenticated', { sub: userId }, query, {
          commit: true,
        });
      };
      const save = (
        predecessor: string | null = null,
        role = 'admin',
        retryId = crypto.randomUUID(),
        path: string | null = fixture.path,
      ) =>
        asUser(
          role,
          async (client) =>
            (
              await client.query<{ id: string }>(
                "select public.amc_contract_save($1,null,'Lift','Private vendor','Private contact',$2,$3,120000,'Annual','Quarterly',$4,$5,null,$6,'amc-test') as id",
                [
                  fixture.societyId,
                  fixture.today,
                  fixture.later,
                  path,
                  predecessor,
                  retryId,
                ],
              )
            ).rows[0]!.id,
        );
      const retryId = crypto.randomUUID();
      const oldId = await save(null, 'admin', retryId);
      expect(await save(null, 'admin', retryId)).toBe(oldId);
      await asUser('admin', (client) =>
        client.query("select public.amc_request_link($1,$2,$3,'amc-link')", [
          fixture.societyId,
          fixture.requestId,
          oldId,
        ]),
      );
      const label = await asUser(
        'resident',
        async (client) =>
          (
            await client.query<{ label: string }>(
              'select public.amc_request_label($1,$2) as label',
              [fixture.societyId, fixture.requestId],
            )
          ).rows[0]!.label,
      );
      expect(label).toBe('Lift');
      expect(
        (
          await dbError(
            asUser('resident', (client) =>
              client.query(
                "select public.amc_request_link($1,$2,$3,'denied-link')",
                [fixture.societyId, fixture.requestId, oldId],
              ),
            ),
          )
        ).code,
      ).toBe('42501');
      expect((await dbError(save(null, 'committee'))).code).toBe('42501');
      expect(
        (
          await dbError(
            asUser('resident', (client) =>
              client.query('select public.amc_workspace($1)', [
                fixture.societyId,
              ]),
            ),
          )
        ).code,
      ).toBe('42501');
      expect(
        (
          await asUser('committee', (client) =>
            client.query(
              "select name from storage.objects where bucket_id='amc-files'",
            ),
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await asUser('resident', (client) =>
            client.query(
              "select name from storage.objects where bucket_id='amc-files'",
            ),
          )
        ).rows,
      ).toHaveLength(0);
      const visitId = await asUser(
        'admin',
        async (client) =>
          (
            await client.query<{ id: string }>(
              "select public.amc_visit_save($1,$2,null,$3,'Initial inspection','Technician',null,null,$4,'amc-visit') as id",
              [fixture.societyId, oldId, fixture.today, crypto.randomUUID()],
            )
          ).rows[0]!.id,
      );
      const workspace = await asUser(
        'committee',
        async (client) =>
          (
            await client.query<{ data: { visits: { updated_at: string }[] } }>(
              'select public.amc_workspace($1) as data',
              [fixture.societyId],
            )
          ).rows[0]!.data,
      );
      await asUser('admin', (client) =>
        client.query(
          "select public.amc_visit_save($1,$2,$3,$4,'Corrected inspection','Technician',null,$5,$6,'amc-edit')",
          [
            fixture.societyId,
            oldId,
            visitId,
            fixture.today,
            workspace.visits[0]!.updated_at,
            crypto.randomUUID(),
          ],
        ),
      );
      const successor = await save(oldId, 'admin', crypto.randomUUID(), null);
      expect(
        (await dbError(save(oldId, 'admin', crypto.randomUUID(), null))).code,
      ).toBe('23505');
      const reminder = () =>
        db.asRole(
          'service_role',
          {},
          async (client) =>
            (
              await client.query<{ count: number }>(
                "select public.amc_reminders_run($1,'amc-reminder') as count",
                [fixture.societyId],
              )
            ).rows[0]!.count,
          { commit: true },
        );
      expect(await reminder()).toBe(2);
      expect(await reminder()).toBe(0);
      await db.asSuperuser(async (client) => {
        expect(
          (
            await client.query(
              'select id from public.amc_visits where contract_id=$1',
              [oldId],
            )
          ).rows,
        ).toHaveLength(1);
        expect(
          (
            await client.query<{ document_path: string }>(
              'select document_path from public.amc_contracts where id=$1',
              [oldId],
            )
          ).rows[0]!.document_path,
        ).toBe(fixture.path);
        expect(
          (
            await client.query<{ last_reminder_days: number }>(
              'select last_reminder_days from public.amc_contracts where id=$1',
              [successor],
            )
          ).rows[0]!.last_reminder_days,
        ).toBe(7);
        expect(
          (
            await client.query(
              'select id from public.audit_logs where entity_id=$1 and "before" is not null',
              [visitId],
            )
          ).rows,
        ).toHaveLength(1);
        await client.query(
          "update public.module_configs set enabled=false where society_id=$1 and module_key='amc'",
          [fixture.societyId],
        );
      });
      expect(await reminder()).toBe(0);
      expect(
        (
          await dbError(
            asUser('admin', (client) =>
              client.query('select public.amc_workspace($1)', [
                fixture.societyId,
              ]),
            ),
          )
        ).code,
      ).toBe('42501');
    } finally {
      await db.drop();
    }
  });
});
