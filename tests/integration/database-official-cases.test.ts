// Verify private case evidence cannot widen and official-case jobs remain admin-only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('database official case log', () => {
  let database: TestDatabase;
  let societyId: string;
  let adminId: string;
  let committeeId: string;
  let reviewerMembershipId: string;
  let folderId: string;
  let folderVersion: number;
  let versionId: string;
  let documentId: string;
  let caseId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    const fixture = await database.asSuperuser(async (client) => {
      adminId = await newAuthUser(client, 'case-admin@example.test');
      committeeId = await newAuthUser(client, 'case-committee@example.test');
      for (const [id, email, name] of [
        [adminId, 'case-admin@example.test', 'Case Admin'],
        [committeeId, 'case-committee@example.test', 'Case Committee'],
      ]) {
        await client.query(
          'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
          [id, email, name],
        );
      }
      societyId = (
        await client.query<{ id: string }>(
          "insert into public.societies(name,created_by) values('Case Society',$1) returning id",
          [adminId],
        )
      ).rows[0]!.id;
      await client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,'core',true,'{}'),($1,'document',true,'{}')`,
        [societyId],
      );
      await client.query(
        "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,'{admin}','active')",
        [societyId, adminId],
      );
      reviewerMembershipId = (
        await client.query<{ id: string }>(
          "insert into public.memberships(society_id,user_id,roles,status) values($1,$2,'{committee}','active') returning id",
          [societyId, committeeId],
        )
      ).rows[0]!.id;
      return { adminId, societyId };
    });
    await database.asRole(
      'authenticated',
      { sub: adminId },
      (client) =>
        client.query('select public.compliance_acknowledge($1,$2)', [
          fixture.societyId,
          'case-ack',
        ]),
      { commit: true },
    );
    const folder = await database.asRole(
      'authenticated',
      { sub: adminId },
      (client) =>
        client.query<{ folder: { id: string; version: number } }>(
          "select public.document_folder_save($1,null,'Case evidence','admin_only',null,$2) as folder",
          [societyId, 'folder-save'],
        ),
      { commit: true },
    );
    folderId = folder.rows[0]!.folder.id;
    folderVersion = folder.rows[0]!.folder.version;
    const created = await database.asSuperuser(async (client) => {
      const document = await client.query<{ id: string }>(
        `insert into public.documents(
           society_id,folder_id,title,client_request_id,created_by,updated_by
         ) values($1,$2,'Registrar notice',$3,$4,$4) returning id`,
        [societyId, folderId, crypto.randomUUID(), adminId],
      );
      const version = await client.query<{ id: string }>(
        `insert into public.document_versions(
           society_id,document_id,version_number,path,file_name,
           content_type,size_bytes,created_by
         ) values($1,$2,1,$3,'notice.pdf','application/pdf',100,$4) returning id`,
        [
          societyId,
          document.rows[0]!.id,
          `${societyId}/documents/${crypto.randomUUID()}.pdf`,
          adminId,
        ],
      );
      return {
        documentId: document.rows[0]!.id,
        versionId: version.rows[0]!.id,
      };
    });
    versionId = created.versionId;
    documentId = created.documentId;
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps case records admin-only and locks linked evidence folders', async () => {
    caseId = await database.asRole(
      'authenticated',
      { sub: adminId },
      async (client) =>
        (
          await client.query<{ id: string }>(
            `select public.document_official_case_save(
               $1,null,'Registrar','REF-1','Synthetic correspondence',
               '2026-27', '2026-01-01',null,null,null,'2026-12-31',null,null,
               'open',$2,null,null,'Fact checked',null,null,$3,'case-create'
             ) as id`,
            [societyId, reviewerMembershipId, crypto.randomUUID()],
          )
        ).rows[0]!.id,
      { commit: true },
    );
    await database.asRole(
      'authenticated',
      { sub: adminId },
      (client) =>
        client.query(
          'select public.document_official_case_evidence_link($1,$2,$3,$4)',
          [societyId, caseId, versionId, 'case-link'],
        ),
      { commit: true },
    );
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: adminId }, (client) =>
            client.query(
              `select public.document_folder_save(
                   $1,$2,'Case evidence','committee_admins',$3,$4
                 )`,
              [societyId, folderId, folderVersion, 'folder-widen'],
            ),
          ),
        )
      ).code,
    ).toBe('23514');
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: committeeId }, (client) =>
            client.query('select public.document_official_case_workspace($1)', [
              societyId,
            ]),
          ),
        )
      ).code,
    ).toBe('42501');
    const deniedDocument = await dbError(
      database.asRole('authenticated', { sub: committeeId }, (client) =>
        client.query('select public.document_get($1,$2)', [
          societyId,
          documentId,
        ]),
      ),
    );
    expect(deniedDocument.code).toBe('P0002');
  });

  it('runs case reminders and cleans only opted-in old closed cases', async () => {
    await database.asRole(
      'authenticated',
      { sub: adminId },
      (client) =>
        client.query(
          'select public.document_official_case_reminders_save($1,true,$2)',
          [societyId, 'case-reminders'],
        ),
      { commit: true },
    );
    const reminder = await database.asRole(
      'service_role',
      null,
      (client) =>
        client.query<{ result: { sent: number } }>(
          "select public.document_official_case_reminders_run($1,'2026-12-01',$2) as result",
          [societyId, 'case-reminder-run'],
        ),
      { commit: true },
    );
    expect(reminder.rows[0]!.result.sent).toBe(1);
    await database.asRole(
      'authenticated',
      { sub: adminId },
      (client) =>
        client.query(
          `select public.document_official_case_save(
             $1,$2,'Registrar','REF-1','Synthetic correspondence','2026-27',
             '2026-01-01',null,null,null,'2026-12-31',null,null,
             'closed',$3,null,'2020-01-01','Closed',1,'Verified closure',$4,
             'case-close'
           )`,
          [societyId, caseId, reviewerMembershipId, crypto.randomUUID()],
        ),
      { commit: true },
    );
    await database.asRole(
      'authenticated',
      { sub: adminId },
      (client) =>
        client.query(
          `select public.data_cleanup_rule_save(
             $1,'official_case',true,1,null,$2
           )`,
          [societyId, 'case-cleanup-rule'],
        ),
      { commit: true },
    );
    const candidates = await database.asRole('service_role', null, (client) =>
      client.query<{ candidates: unknown[] }>(
        "select public.document_official_case_cleanup_candidates($1,'2026-01-01') as candidates",
        [societyId],
      ),
    );
    expect(candidates.rows[0]!.candidates).toHaveLength(1);
    await database.asRole(
      'service_role',
      null,
      (client) =>
        client.query(
          'select public.document_official_case_cleanup_finalize($1,ARRAY[$2]::uuid[],$3)',
          [societyId, caseId, 'case-cleanup'],
        ),
      { commit: true },
    );
    const removed = await database.asSuperuser((client) =>
      client.query(
        `select
           (select count(*) from public.document_official_cases where id=$1) as cases,
           (select count(*) from public.document_versions where id=$2) as versions`,
        [caseId, versionId],
      ),
    );
    expect(removed.rows[0]).toMatchObject({ cases: '0', versions: '0' });
  });
});
