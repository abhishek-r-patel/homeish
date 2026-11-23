// Verify P50.1b audit history, project links, privacy and reminder idempotency.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';
import { majorWorksAuditsSchema } from '../../src/core/major-works/validation';

describe.skipIf(!hasDatabase)('database major works audits', () => {
  it('keeps private audit history and sends each due reminder once', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of ['admin', 'committee', 'resident']) {
          const id = await newAuthUser(
            client,
            `works-audit-${role}@example.test`,
          );
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `works-audit-${role}@example.test`, `Audit ${role}`],
          );
          users.set(role, id);
        }
        const society = (
          await client.query<{ id: string }>(
            'insert into public.societies(name,created_by) values($1,$2) returning id',
            ['Audit Society', users.get('admin')],
          )
        ).rows[0]!.id;
        for (const role of ['admin', 'committee', 'resident']) {
          await client.query(
            `insert into public.memberships(society_id,user_id,roles,status)
             values($1,$2,$3,'active')`,
            [society, users.get(role), [role]],
          );
        }
        await client.query(
          `insert into public.module_configs(
             society_id,module_key,enabled,settings
           ) values
             ($1,'core',true,'{}'),
             ($1,'major_works',true,'{"consent_method":"poll"}')`,
          [society],
        );
        const project = (
          await client.query<{ id: string }>(
            `insert into public.major_works_projects(
               society_id,title,location,category,priority,estimate_paise,
               progress_percent,client_request_id,created_by
             ) values($1,'Lift work','Block A','lifts','high',100000,0,$2,$3)
             returning id`,
            [society, crypto.randomUUID(), users.get('admin')],
          )
        ).rows[0]!.id;
        const today = (
          await client.query<{ today: string }>(
            'select private.housekeeping_local_date($1) as today',
            [society],
          )
        ).rows[0]!.today;
        return { society, users, project, today };
      });
      const admin = fixture.users.get('admin')!;
      const committee = fixture.users.get('committee')!;
      const resident = fixture.users.get('resident')!;
      const audit = await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query<{ id: string }>(
            `select public.major_works_audit_save(
               $1,null,$2,'Synthetic auditor','Synthetic findings','major_repairs',
               null,'pending',$2::date + 30,ARRAY[$3]::uuid[],null,$4,'audit-create'
             ) as id`,
            [
              fixture.society,
              fixture.today,
              fixture.project,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );
      const auditId = audit.rows[0]!.id;
      const listed = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_audits_list($1) as data',
            [fixture.society],
          ),
      );
      const parsed = majorWorksAuditsSchema.parse(listed.rows[0]!.data);
      expect(parsed.can_manage).toBe(false);
      expect(parsed.audits[0]).toMatchObject({
        id: auditId,
        rating: 'major_repairs',
        repair_status: 'pending',
        report_path: null,
        projects: [{ id: fixture.project, title: 'Lift work' }],
      });
      expect(
        await dbError(
          database.asRole('authenticated', { sub: resident }, (client) =>
            client.query('select public.major_works_audits_list($1)', [
              fixture.society,
            ]),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      const reminders = await database.asRole(
        'service_role',
        null,
        (client) =>
          client.query<{ result: { notified: number } }>(
            'select public.major_works_audit_reminders_run($1,$2) as result',
            [fixture.society, 'audit-reminder-1'],
          ),
        { commit: true },
      );
      expect(reminders.rows[0]!.result.notified).toBe(1);
      const repeated = await database.asRole(
        'service_role',
        null,
        (client) =>
          client.query<{ result: { notified: number } }>(
            'select public.major_works_audit_reminders_run($1,$2) as result',
            [fixture.society, 'audit-reminder-2'],
          ),
        { commit: true },
      );
      expect(repeated.rows[0]!.result.notified).toBe(0);
      const currentAudit = await database.asSuperuser((client) =>
        client.query<{ updated_at: string }>(
          `select updated_at::text as updated_at
           from public.major_works_audits where id=$1`,
          [auditId],
        ),
      );

      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_audit_void(
               $1,$2,'Wrong structural audit',$3,$4,'audit-void'
             )`,
            [
              fixture.society,
              auditId,
              currentAudit.rows[0]!.updated_at,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );
      const events = await database.asSuperuser((client) =>
        client.query(
          `select action from public.major_works_audit_events
           where society_id=$1 and audit_id=$2 order by created_at`,
          [fixture.society, auditId],
        ),
      );
      expect(events.rows.map((row) => row.action)).toEqual(['create', 'void']);
      expect(
        await dbError(
          database.asSuperuser((client) =>
            client.query(
              'delete from public.major_works_audit_events where audit_id=$1',
              [auditId],
            ),
          ),
        ),
      ).toMatchObject({ code: '55000' });
    } finally {
      await database.drop();
    }
  });
});
