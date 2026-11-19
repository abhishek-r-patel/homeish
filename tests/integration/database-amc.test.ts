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
          await client.query<{
            today: string;
            later: string;
            urgentBoundary: string;
            dueSoonBoundary: string;
            activeBoundary: string;
            pastStart: string;
            expiredEnd: string;
            futureStart: string;
            futureEnd: string;
          }>(
            `select today::text as today,(today+5)::text as later,
              (today+30)::text as "urgentBoundary",(today+60)::text as "dueSoonBoundary",
              (today+61)::text as "activeBoundary",(today-10)::text as "pastStart",
              (today-1)::text as "expiredEnd",(today+10)::text as "futureStart",
              (today+50)::text as "futureEnd"
             from (select private.housekeeping_local_date($1) as today) dates`,
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
        startDate = fixture.today,
        endDate = fixture.later,
      ) =>
        asUser(
          role,
          async (client) =>
            (
              await client.query<{ id: string }>(
                "select public.amc_contract_save($1,null,'Lift','Private vendor','Private contact',$2,$3,120000,'Annual','Quarterly',$4,$5,null,$6,'amc-test') as id",
                [
                  fixture.societyId,
                  startDate,
                  endDate,
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
            await client.query<{
              data: {
                settings: { due_soon_days: number; urgent_days: number };
                contracts: { id: string; status: string }[];
                visits: { updated_at: string }[];
              };
            }>('select public.amc_workspace($1) as data', [fixture.societyId])
          ).rows[0]!.data,
      );
      expect(workspace.settings).toEqual({
        due_soon_days: 60,
        urgent_days: 30,
      });
      expect(
        workspace.contracts.find((contract) => contract.id === oldId)?.status,
      ).toBe('urgent');

      expect(
        (
          await dbError(
            asUser('committee', (client) =>
              client.query(
                "select public.amc_settings_update($1,60,30,'committee-settings')",
                [fixture.societyId],
              ),
            ),
          )
        ).code,
      ).toBe('42501');
      expect(
        (
          await dbError(
            asUser('admin', (client) =>
              client.query(
                "select public.amc_settings_update($1,30,30,'invalid-settings')",
                [fixture.societyId],
              ),
            ),
          )
        ).code,
      ).toBe('22023');
      await db.asSuperuser((client) =>
        client.query(
          `update public.module_configs
           set settings='{"reminder_days":[60,30,7]}'
           where society_id=$1 and module_key='amc'`,
          [fixture.societyId],
        ),
      );
      await asUser('admin', (client) =>
        client.query(
          "select public.amc_settings_update($1,90,15,'admin-settings')",
          [fixture.societyId],
        ),
      );
      const updatedSettings = await asUser(
        'committee',
        async (client) =>
          (
            await client.query<{
              data: {
                settings: { due_soon_days: number; urgent_days: number };
              };
            }>('select public.amc_workspace($1) as data', [fixture.societyId])
          ).rows[0]!.data.settings,
      );
      expect(updatedSettings).toEqual({
        due_soon_days: 90,
        urgent_days: 15,
      });
      const reminderDays = await db.asSuperuser(
        async (client) =>
          (
            await client.query<{ days: number[] }>(
              `select settings->'reminder_days' as days
           from public.module_configs where society_id=$1 and module_key='amc'`,
              [fixture.societyId],
            )
          ).rows[0]!.days,
      );
      expect(reminderDays).toEqual([60, 30, 7]);
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
      await asUser('admin', (client) =>
        client.query(
          "select public.amc_settings_update($1,60,30,'reset-settings')",
          [fixture.societyId],
        ),
      );
      const boundaryIds = await Promise.all([
        save(
          null,
          'admin',
          crypto.randomUUID(),
          null,
          fixture.today,
          fixture.urgentBoundary,
        ),
        save(
          null,
          'admin',
          crypto.randomUUID(),
          null,
          fixture.today,
          fixture.dueSoonBoundary,
        ),
        save(
          null,
          'admin',
          crypto.randomUUID(),
          null,
          fixture.today,
          fixture.activeBoundary,
        ),
        save(
          null,
          'admin',
          crypto.randomUUID(),
          null,
          fixture.futureStart,
          fixture.futureEnd,
        ),
        save(
          null,
          'admin',
          crypto.randomUUID(),
          null,
          fixture.pastStart,
          fixture.expiredEnd,
        ),
      ]);
      const boundaryWorkspace = await asUser(
        'committee',
        async (client) =>
          (
            await client.query<{
              data: { contracts: { id: string; status: string }[] };
            }>('select public.amc_workspace($1) as data', [fixture.societyId])
          ).rows[0]!.data,
      );
      const statusById = new Map(
        boundaryWorkspace.contracts.map((contract) => [
          contract.id,
          contract.status,
        ]),
      );
      expect(boundaryIds.map((id) => statusById.get(id))).toEqual([
        'urgent',
        'due_soon',
        'active',
        'upcoming',
        'expired',
      ]);
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

  it('saves an audited service schedule and derives the next and overdue services', async () => {
    const db = await createTestDatabase();
    try {
      const fixture = await db.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of ['admin', 'committee']) {
          const id = await newAuthUser(client, `amc-plan-${role}@example.test`);
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `amc-plan-${role}@example.test`, `AMC plan ${role}`],
          );
          users.set(role, id);
        }
        const societyId = (
          await client.query<{ id: string }>(
            "insert into public.societies(name,created_by) values('AMC plan society',$1) returning id",
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
        const categoryId = (
          await client.query<{ id: string }>(
            "insert into public.asset_categories(society_id,name,client_request_id,created_by,updated_by) values($1,'Lifts',$2,$3,$3) returning id",
            [societyId, crypto.randomUUID(), users.get('admin')],
          )
        ).rows[0]!.id;
        const today = (
          await client.query<{ today: string }>(
            'select private.housekeeping_local_date($1)::text as today',
            [societyId],
          )
        ).rows[0]!.today;
        return { societyId, users, categoryId, today };
      });
      const shift = (days: number) => {
        const date = new Date(`${fixture.today}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + days);
        return date.toISOString().slice(0, 10);
      };
      const asUser = <T>(
        role: string,
        query: Parameters<typeof db.asSuperuser<T>>[0],
      ) =>
        db.asRole('authenticated', { sub: fixture.users.get(role)! }, query, {
          commit: true,
        });
      const create = (label: string) =>
        asUser(
          'admin',
          async (client) =>
            (
              await client.query<{ id: string }>(
                "select public.amc_contract_save($1,null,$2,'Plan vendor','Plan contact',$3,$4,120000,'Annual','Quarterly',null,null,null,$5,'amc-plan') as id",
                [
                  fixture.societyId,
                  label,
                  shift(-400),
                  shift(200),
                  crypto.randomUUID(),
                ],
              )
            ).rows[0]!.id,
        );
      const visit = (contractId: string, days: number) =>
        db.asSuperuser((client) =>
          client.query(
            "insert into public.amc_visits(society_id,contract_id,visit_date,summary,technician,created_by,updated_by,client_request_id) values($1,$2,$3,'Routine service','Synthetic technician',$4,$4,$5)",
            [
              fixture.societyId,
              contractId,
              shift(days),
              fixture.users.get('admin'),
              crypto.randomUUID(),
            ],
          ),
        );
      type Contract = {
        id: string;
        updated_at: string;
        amc_type: string | null;
        asset_category_id: string | null;
        asset_category_name: string | null;
        services_per_year: number | null;
        last_visit_date: string | null;
        next_service_date: string | null;
        service_overdue: boolean;
      };
      const workspace = async (role = 'admin') =>
        (
          await asUser(
            role,
            async (client) =>
              (
                await client.query<{ value: { contracts: Contract[] } }>(
                  'select public.amc_workspace($1) as value',
                  [fixture.societyId],
                )
              ).rows[0]!.value,
          )
        ).contracts;
      const contract = async (id: string) =>
        (await workspace()).find((row) => row.id === id)!;
      const schedule = async (
        id: string,
        servicesPerYear: number | null,
        options: {
          role?: string;
          type?: string | null;
          category?: string | null;
          updatedAt?: string;
          trace?: string;
        } = {},
      ) => {
        const updatedAt = options.updatedAt ?? (await contract(id)).updated_at;
        return asUser(options.role ?? 'admin', (client) =>
          client.query(
            'select public.amc_schedule_save($1,$2,$3,$4,$5,$6,$7)',
            [
              fixture.societyId,
              id,
              options.type ?? null,
              options.category ?? null,
              servicesPerYear,
              updatedAt,
              options.trace ?? 'amc-plan',
            ],
          ),
        );
      };

      const yearly = await create('Fire pumps');
      const quarterly = await create('Lift');
      const monthly = await create('Water purifier');
      const unvisited = await create('Generator');
      const unscheduled = await create('CCTV');
      await visit(yearly, -365);
      await visit(quarterly, -200);
      await visit(quarterly, -92);
      await visit(monthly, -10);
      await visit(unscheduled, -300);

      const trace = crypto.randomUUID();
      await schedule(yearly, 1, {
        type: 'comprehensive',
        category: fixture.categoryId,
        trace,
      });
      await schedule(quarterly, 4, { type: 'non_comprehensive' });
      await schedule(monthly, 12);
      await schedule(unvisited, 4);

      expect(await contract(yearly)).toMatchObject({
        amc_type: 'comprehensive',
        asset_category_id: fixture.categoryId,
        asset_category_name: 'Lifts',
        services_per_year: 1,
        last_visit_date: shift(-365),
        next_service_date: fixture.today,
        service_overdue: false,
      });
      expect(await contract(quarterly)).toMatchObject({
        amc_type: 'non_comprehensive',
        last_visit_date: shift(-92),
        next_service_date: shift(-1),
        service_overdue: true,
      });
      expect(await contract(monthly)).toMatchObject({
        next_service_date: shift(20),
        service_overdue: false,
      });
      expect(await contract(unvisited)).toMatchObject({
        services_per_year: 4,
        last_visit_date: null,
        next_service_date: null,
        service_overdue: false,
      });
      expect(await contract(unscheduled)).toMatchObject({
        services_per_year: null,
        amc_type: null,
        next_service_date: null,
        service_overdue: false,
      });
      expect(
        (await workspace('committee')).find((row) => row.id === quarterly),
      ).toMatchObject({ service_overdue: true });

      const audit = await db.asSuperuser(
        async (client) =>
          (
            await client.query<{ before: unknown; after: unknown }>(
              "select before,after from public.audit_logs where action='amc.schedule.save' and request_id=$1",
              [trace],
            )
          ).rows,
      );
      expect(audit).toEqual([
        {
          before: {
            amc_type: null,
            asset_category_id: null,
            services_per_year: null,
          },
          after: {
            amc_type: 'comprehensive',
            asset_category_id: fixture.categoryId,
            services_per_year: 1,
          },
        },
      ]);

      const stale = (await contract(monthly)).updated_at;
      await schedule(monthly, 6);
      const code = async (action: Promise<unknown>) =>
        (await dbError(action)).code;
      expect(await code(schedule(monthly, 4, { updatedAt: stale }))).toBe(
        '23505',
      );
      expect(await code(schedule(monthly, 13))).toBe('22023');
      expect(await code(schedule(monthly, 4, { type: 'partial' }))).toBe(
        '22023',
      );
      expect(
        await code(schedule(monthly, 4, { category: crypto.randomUUID() })),
      ).toBe('22023');
      expect(await code(schedule(monthly, 4, { role: 'committee' }))).toBe(
        '42501',
      );
      expect((await contract(monthly)).services_per_year).toBe(6);
    } finally {
      await db.drop();
    }
  });
});
