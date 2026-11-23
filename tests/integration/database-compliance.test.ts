// Verify factual compliance acknowledgement, role access, reminders and cleanup.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('database compliance register', () => {
  let database: TestDatabase;
  let societyId: string;
  let adminId: string;
  let committeeId: string;
  let residentId: string;
  let responsibleMembershipId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      adminId = await newAuthUser(client, 'compliance-admin@example.test');
      committeeId = await newAuthUser(
        client,
        'compliance-committee@example.test',
      );
      residentId = await newAuthUser(
        client,
        'compliance-resident@example.test',
      );
      for (const [id, email, name] of [
        [adminId, 'compliance-admin@example.test', 'Compliance Admin'],
        [
          committeeId,
          'compliance-committee@example.test',
          'Compliance Committee',
        ],
        [residentId, 'compliance-resident@example.test', 'Compliance Resident'],
      ]) {
        await client.query(
          'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
          [id, email, name],
        );
      }
      societyId = (
        await client.query<{ id: string }>(
          "insert into public.societies(name,created_by) values('Compliance Society',$1) returning id",
          [adminId],
        )
      ).rows[0]!.id;
      await client.query(
        "insert into public.module_configs(society_id,module_key,enabled,settings) values($1,'core',true,'{}')",
        [societyId],
      );
      await client.query(
        "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,'{admin}','active'),($1,$3,'{committee}','active')",
        [societyId, adminId, committeeId],
      );
      responsibleMembershipId = (
        await client.query<{ id: string }>(
          "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,'{resident}','active') returning id",
          [societyId, residentId],
        )
      ).rows[0]!.id;
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('requires acknowledgement, preserves revisions and limits access', async () => {
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: adminId }, (client) =>
            client.query(
              `select public.compliance_entry_save(
                   $1,null,'Annual filing','Registrar','yearly','2026-12-01',
                   $2,'pending',null,null,'',null,null,$3,'create'
                 )`,
              [societyId, responsibleMembershipId, crypto.randomUUID()],
            ),
          ),
        )
      ).code,
    ).toBe('42501');

    await database.asRole(
      'authenticated',
      { sub: adminId },
      (client) =>
        client.query('select public.compliance_acknowledge($1,$2)', [
          societyId,
          'acknowledge',
        ]),
      { commit: true },
    );
    const entryId = await database.asRole(
      'authenticated',
      { sub: adminId },
      async (client) =>
        (
          await client.query<{ id: string }>(
            `select public.compliance_entry_save(
               $1,null,'Annual filing','Registrar','yearly','2026-12-01',
               $2,'pending',null,null,'Verified from society notice',null,null,
               $3,'create'
             ) as id`,
            [societyId, responsibleMembershipId, crypto.randomUUID()],
          )
        ).rows[0]!.id,
      { commit: true },
    );
    await database.asRole(
      'authenticated',
      { sub: adminId },
      (client) =>
        client.query(
          `select public.compliance_entry_save(
             $1,$2,'Annual filing','Registrar','yearly','2026-12-01',
             $3,'done','2026-11-20',null,'Filed and acknowledged',1,
             'Receipt verified',$4,'revise'
           )`,
          [societyId, entryId, responsibleMembershipId, crypto.randomUUID()],
        ),
      { commit: true },
    );
    const committee = await database.asRole(
      'authenticated',
      { sub: committeeId },
      (client) =>
        client.query<{ data: Record<string, unknown> }>(
          'select public.compliance_workspace($1) as data',
          [societyId],
        ),
    );
    expect(committee.rows[0]!.data).toMatchObject({
      can_manage: false,
      acknowledged_at: expect.any(String),
      entries: [
        expect.objectContaining({
          id: entryId,
          status: 'done',
          due_state: 'done',
          responsible_name: 'Compliance Resident',
        }),
      ],
    });
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: residentId }, (client) =>
            client.query('select public.compliance_workspace($1)', [societyId]),
          ),
        )
      ).code,
    ).toBe('42501');
    const revisions = await database.asSuperuser((client) =>
      client.query(
        'select count(*)::integer as count from public.compliance_revisions where entry_id=$1',
        [entryId],
      ),
    );
    expect(revisions.rows[0]!.count).toBe(1);
  });

  it('runs 30-day reminders and opts into age-based permanent cleanup', async () => {
    await database.asRole(
      'authenticated',
      { sub: adminId },
      (client) =>
        client.query('select public.compliance_reminders_save($1,true,$2)', [
          societyId,
          'reminders-on',
        ]),
      { commit: true },
    );
    const entryId = await database.asRole(
      'authenticated',
      { sub: adminId },
      async (client) =>
        (
          await client.query<{ id: string }>(
            `select public.compliance_entry_save(
               $1,null,'Thirty-day item','Society source','none','2030-01-31',
               $2,'pending',null,null,'',null,null,$3,'reminder-item'
             ) as id`,
            [societyId, responsibleMembershipId, crypto.randomUUID()],
          )
        ).rows[0]!.id,
      { commit: true },
    );
    const reminder = await database.asRole(
      'service_role',
      null,
      (client) =>
        client.query<{ result: { sent: number } }>(
          "select public.compliance_reminders_run($1,'2030-01-01',$2) as result",
          [societyId, 'reminder-run'],
        ),
      { commit: true },
    );
    expect(reminder.rows[0]!.result.sent).toBe(1);
    const duplicate = await database.asRole(
      'service_role',
      null,
      (client) =>
        client.query<{ result: { sent: number } }>(
          "select public.compliance_reminders_run($1,'2030-01-01',$2) as result",
          [societyId, 'reminder-rerun'],
        ),
      { commit: true },
    );
    expect(duplicate.rows[0]!.result.sent).toBe(0);
    const rule = await database.asRole(
      'authenticated',
      { sub: adminId },
      (client) =>
        client.query<{ rule: { enabled: boolean } }>(
          `select public.data_cleanup_rule_save(
             $1,'compliance_entry',true,1,null,$2
           ) as rule`,
          [societyId, 'cleanup-rule'],
        ),
      { commit: true },
    );
    expect(rule.rows[0]!.rule.enabled).toBe(true);
    await database.asSuperuser((client) =>
      client.query(
        `update public.compliance_entries
         set status='done', completed_on='2020-01-01'
         where society_id=$1 and id=$2`,
        [societyId, entryId],
      ),
    );
    await database.asRole(
      'service_role',
      null,
      (client) =>
        client.query(
          "select public.compliance_data_cleanup_run($1,'2026-01-01',$2)",
          [societyId, 'cleanup-run'],
        ),
      { commit: true },
    );
    const deleted = await database.asSuperuser((client) =>
      client.query(
        'select count(*)::integer as count from public.compliance_entries where id=$1',
        [entryId],
      ),
    );
    expect(deleted.rows[0]!.count).toBe(0);
  });
});
