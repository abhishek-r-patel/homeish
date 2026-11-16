// Verify document audiences, unit-issued visibility, versions, audited downloads and isolation.
import { describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';
import {
  documentDetailSchema,
  documentDownloadSchema,
  documentListSchema,
  documentSchema,
  documentWorkspaceSchema,
  type DocumentFolderAudience,
} from '../../src/core/document/validation';

const ACTORS = [
  'admin',
  'committee',
  'guard',
  'owner',
  'tenant',
  'family',
  'otherOwner',
  'foreignAdmin',
  'foreignResident',
] as const;
type Actor = (typeof ACTORS)[number];

async function createFixture(database: TestDatabase) {
  const users = new Map<Actor, string>();
  const memberships = new Map<Actor, string>();
  const id = (map: Map<Actor, string>, actor: Actor) => {
    const value = map.get(actor);
    if (!value) throw new Error(`Missing synthetic ${actor}.`);
    return value;
  };
  const fixture = await database.asSuperuser(async (client) => {
    for (const actor of ACTORS) {
      const email = `document-${actor.toLowerCase()}@example.test`;
      const userId = await newAuthUser(client, email);
      users.set(actor, userId);
      await client.query(
        `insert into public.profiles(id,email,full_name) values($1,$2,$3)
         on conflict(id) do update set full_name=excluded.full_name`,
        [userId, email, `Synthetic ${actor}`],
      );
    }
    const society = (
      await client.query<{ id: string }>(
        `insert into public.societies(name,created_by) values('Documents A',$1) returning id`,
        [id(users, 'admin')],
      )
    ).rows[0]!.id;
    const foreignSociety = (
      await client.query<{ id: string }>(
        `insert into public.societies(name,created_by) values('Documents B',$1) returning id`,
        [id(users, 'foreignAdmin')],
      )
    ).rows[0]!.id;
    for (const actor of ACTORS) {
      const role =
        actor === 'admin' || actor === 'foreignAdmin'
          ? 'admin'
          : actor === 'committee'
            ? 'committee'
            : actor === 'guard'
              ? 'guard'
              : 'resident';
      const membershipId = (
        await client.query<{ id: string }>(
          `insert into public.memberships(society_id,user_id,roles,status)
           values($1,$2,array[$3]::text[],'active') returning id`,
          [
            actor.startsWith('foreign') ? foreignSociety : society,
            id(users, actor),
            role,
          ],
        )
      ).rows[0]!.id;
      memberships.set(actor, membershipId);
    }
    const units = (
      await client.query<{ id: string; number: string; society_id: string }>(
        `insert into public.units(society_id,number,created_by)
         values($1,'A-101',$2),($1,'B-201',$2),($3,'Z-1',$4)
         returning id,number,society_id`,
        [
          society,
          id(users, 'admin'),
          foreignSociety,
          id(users, 'foreignAdmin'),
        ],
      )
    ).rows;
    const unit = (number: string) =>
      units.find((row) => row.number === number)!.id;
    const occupancies = new Map<Actor, string>();
    for (const [actor, number, relationship] of [
      ['owner', 'A-101', 'owner'],
      ['tenant', 'A-101', 'tenant'],
      ['family', 'A-101', 'family'],
      ['otherOwner', 'B-201', 'owner'],
      ['foreignResident', 'Z-1', 'owner'],
    ] as const) {
      const occupancyId = (
        await client.query<{ id: string }>(
          `insert into public.unit_occupants
           (society_id,unit_id,membership_id,relationship,status,started_at,created_by)
           values($1,$2,$3,$4,'active',current_date-30,$5) returning id`,
          [
            actor.startsWith('foreign') ? foreignSociety : society,
            unit(number),
            id(memberships, actor),
            relationship,
            id(users, actor.startsWith('foreign') ? 'foreignAdmin' : 'admin'),
          ],
        )
      ).rows[0]!.id;
      occupancies.set(actor, occupancyId);
    }
    await client.query(
      `insert into public.module_configs(society_id,module_key,enabled,settings)
       values($1,'core',true,'{}'),($1,'document',true,'{}'),($1,'tenancy',true,'{}'),
         ($2,'core',true,'{}'),($2,'document',true,'{}')`,
      [society, foreignSociety],
    );
    return { society, foreignSociety, unit, occupancies };
  });

  const asActor = <T>(actor: Actor, run: (client: Client) => Promise<T>) =>
    database.asRole('authenticated', { sub: id(users, actor) }, run, {
      commit: true,
    });
  const value = async (actor: Actor, sql: string, params: unknown[]) =>
    (
      await asActor(actor, (client) =>
        client.query<{ value: unknown }>(`select ${sql} as value`, params),
      )
    ).rows[0]!.value;
  const superuser = <T>(run: (client: Client) => Promise<T>) =>
    database.asSuperuser(run);

  const folders = async (society = fixture.society) =>
    (
      await superuser((client) =>
        client.query<{
          id: string;
          name: string;
          system_key: string | null;
          audience: DocumentFolderAudience;
          version: number;
        }>(
          `select id,name,system_key,audience,version from public.document_folders
           where society_id=$1 order by sort_order`,
          [society],
        ),
      )
    ).rows;
  const folderId = async (systemKey: string, society = fixture.society) => {
    const match = (await folders(society)).find(
      (folder) => folder.system_key === systemKey,
    );
    if (!match) throw new Error(`Missing ${systemKey} folder.`);
    return match.id;
  };
  const upload = async (
    actor: Actor = 'admin',
    metadata: Record<string, unknown> = {
      mimetype: 'application/pdf',
      size: 2048,
    },
    society = fixture.society,
    extension = 'pdf',
  ) => {
    const path = `${society}/documents/${crypto.randomUUID()}.${extension}`;
    await asActor(actor, (client) =>
      client.query(
        `insert into storage.objects(bucket_id,name,metadata) values('document-files',$1,$2)`,
        [path, metadata],
      ),
    );
    return path;
  };
  const create = async (
    target:
      | { folderId: string }
      | { unitId: string; unitAudience: 'all_occupants' | 'owners_only' },
    title = 'Synthetic document',
    actor: Actor = 'admin',
    clientRequestId: string = crypto.randomUUID(),
  ) => {
    const path = await upload(actor);
    return documentSchema.parse(
      await value(
        actor,
        'public.document_create($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [
          fixture.society,
          'folderId' in target ? target.folderId : null,
          'unitId' in target ? target.unitId : null,
          'unitId' in target ? target.unitAudience : null,
          title,
          null,
          path,
          'file.pdf',
          clientRequestId,
          crypto.randomUUID(),
        ],
      ),
    );
  };
  const workspaceFor = async (actor: Actor) => {
    try {
      return documentWorkspaceSchema.parse(
        await value(actor, 'public.document_workspace_get($1)', [
          fixture.society,
        ]),
      );
    } catch (error) {
      if ((error as { code?: string }).code === '42501') return null;
      throw error;
    }
  };
  const visibleDocuments = async (actor: Actor) => {
    const workspace = await workspaceFor(actor);
    if (!workspace) return [];
    const targets = [
      ...workspace.folders.map((folder) => [folder.id, null] as const),
      ...workspace.units.map((unit) => [null, unit.id] as const),
    ];
    const titles: string[] = [];
    for (const [folder, unit] of targets) {
      const list = documentListSchema.parse(
        await value(actor, 'public.document_list($1,$2,$3,true,100,0)', [
          fixture.society,
          folder,
          unit,
        ]),
      );
      titles.push(...list.items.map((item) => item.title));
    }
    return titles.sort();
  };
  const visibleFolders = async (actor: Actor) =>
    ((await workspaceFor(actor))?.folders ?? []).map((folder) => folder.name);
  const documentVersion = async (documentId: string) =>
    (
      await superuser((client) =>
        client.query<{ version: number }>(
          'select version from public.documents where id=$1',
          [documentId],
        ),
      )
    ).rows[0]!.version;

  return {
    ...fixture,
    users: (actor: Actor) => id(users, actor),
    asActor,
    value,
    superuser,
    folders,
    folderId,
    upload,
    create,
    visibleDocuments,
    visibleFolders,
    documentVersion,
  };
}

describe.skipIf(!hasDatabase)('database document repository', () => {
  it('seeds the standard folders once when the module is enabled', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      expect((await fixture.folders()).map((folder) => folder.name)).toEqual([
        'Bylaws',
        'Minutes',
        'Audit reports',
        'Circulars',
        'NOCs',
      ]);
      const minutes = (await fixture.folders()).find(
        (folder) => folder.system_key === 'minutes',
      )!;
      await fixture.value(
        'admin',
        'public.document_folder_save($1,$2,$3,$4,$5,$6)',
        [
          fixture.society,
          minutes.id,
          'Meeting minutes',
          'all_residents',
          minutes.version,
          crypto.randomUUID(),
        ],
      );
      await fixture.superuser(async (client) => {
        await client.query(
          `update public.module_configs set enabled=false where society_id=$1 and module_key='document'`,
          [fixture.society],
        );
        await client.query(
          `update public.module_configs set enabled=true where society_id=$1 and module_key='document'`,
          [fixture.society],
        );
      });
      const names = (await fixture.folders()).map((folder) => folder.name);
      expect(names).toHaveLength(5);
      expect(names).toContain('Meeting minutes');
      const audit = await fixture.superuser((client) =>
        client.query(
          `select 1 from public.audit_logs where society_id=$1 and action='document.folder_update'`,
          [fixture.society],
        ),
      );
      expect(audit.rowCount).toBe(1);
    } finally {
      await database.drop();
    }
  });

  it('enforces folder audiences through RPCs and refuses direct reads', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      for (const actor of ['admin', 'owner'] as const) {
        for (const table of [
          'document_folders',
          'documents',
          'document_versions',
        ]) {
          const direct = await dbError(
            fixture.asActor(actor, (client) =>
              client.query(`select id from public.${table}`),
            ),
          );
          expect(direct.code).toBe('42501');
        }
      }
      const committeeFolder = await fixture.value(
        'admin',
        'public.document_folder_save($1,null,$2,$3,null,$4)',
        [
          fixture.society,
          'Committee papers',
          'committee_admins',
          crypto.randomUUID(),
        ],
      );
      const committeeFolderId = (committeeFolder as { id: string }).id;
      await fixture.create(
        { folderId: await fixture.folderId('bylaws') },
        'All residents doc',
      );
      await fixture.create(
        { folderId: await fixture.folderId('audit_reports') },
        'Owners doc',
      );
      await fixture.create({ folderId: committeeFolderId }, 'Committee doc');

      expect(await fixture.visibleDocuments('owner')).toEqual([
        'All residents doc',
        'Owners doc',
      ]);
      expect(await fixture.visibleDocuments('tenant')).toEqual([
        'All residents doc',
      ]);
      expect(await fixture.visibleDocuments('family')).toEqual([
        'All residents doc',
      ]);
      expect(await fixture.visibleDocuments('committee')).toEqual([
        'All residents doc',
        'Committee doc',
        'Owners doc',
      ]);
      expect(await fixture.visibleDocuments('guard')).toEqual([]);
      expect(await fixture.visibleDocuments('foreignAdmin')).toEqual([]);
      expect(await fixture.visibleFolders('tenant')).toEqual([
        'Bylaws',
        'Minutes',
        'Circulars',
        'NOCs',
      ]);
      expect(await fixture.visibleFolders('committee')).toContain(
        'Committee papers',
      );

      const tenantWorkspace = documentWorkspaceSchema.parse(
        await fixture.value('tenant', 'public.document_workspace_get($1)', [
          fixture.society,
        ]),
      );
      expect(tenantWorkspace.can_manage).toBe(false);
      expect(
        tenantWorkspace.folders.map((folder) => folder.name),
      ).not.toContain('Audit reports');
      expect(tenantWorkspace.units.map((unit) => unit.number)).toEqual([
        'A-101',
      ]);
      const hidden = await dbError(
        fixture.value('tenant', 'public.document_list($1,$2,null,false,25,0)', [
          fixture.society,
          await fixture.folderId('audit_reports'),
        ]),
      );
      expect(hidden.code).toBe('P0002');
      const guardWorkspace = await dbError(
        fixture.value('guard', 'public.document_workspace_get($1)', [
          fixture.society,
        ]),
      );
      expect(guardWorkspace.code).toBe('42501');

      const auditFolder = (await fixture.folders()).find(
        (folder) => folder.system_key === 'audit_reports',
      )!;
      await fixture.value(
        'admin',
        'public.document_folder_save($1,$2,$3,$4,$5,$6)',
        [
          fixture.society,
          auditFolder.id,
          auditFolder.name,
          'all_residents',
          auditFolder.version,
          crypto.randomUUID(),
        ],
      );
      expect(await fixture.visibleDocuments('tenant')).toEqual([
        'All residents doc',
        'Owners doc',
      ]);
    } finally {
      await database.drop();
    }
  });

  it('limits unit-issued documents to the chosen occupants', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      const unitA = fixture.unit('A-101');
      await fixture.create(
        { unitId: unitA, unitAudience: 'all_occupants' },
        'Unit all',
      );
      await fixture.create(
        { unitId: unitA, unitAudience: 'owners_only' },
        'Unit owners',
      );
      expect(await fixture.visibleDocuments('owner')).toEqual([
        'Unit all',
        'Unit owners',
      ]);
      expect(await fixture.visibleDocuments('tenant')).toEqual(['Unit all']);
      expect(await fixture.visibleDocuments('family')).toEqual(['Unit all']);
      expect(await fixture.visibleDocuments('otherOwner')).toEqual([]);
      expect(await fixture.visibleDocuments('committee')).toEqual([
        'Unit all',
        'Unit owners',
      ]);
      const tenantList = documentListSchema.parse(
        await fixture.value(
          'tenant',
          'public.document_list($1,null,$2,false,25,0)',
          [fixture.society, unitA],
        ),
      );
      expect(tenantList.items.map((item) => item.title)).toEqual(['Unit all']);
      const otherUnit = await dbError(
        fixture.value(
          'otherOwner',
          'public.document_list($1,null,$2,false,25,0)',
          [fixture.society, unitA],
        ),
      );
      expect(otherUnit.code).toBe('P0002');
      const missingAudience = await dbError(
        fixture.value(
          'admin',
          'public.document_create($1,null,$2,null,$3,null,$4,$5,$6,$7)',
          [
            fixture.society,
            unitA,
            'Bad',
            await fixture.upload(),
            'file.pdf',
            crypto.randomUUID(),
            crypto.randomUUID(),
          ],
        ),
      );
      expect(missingAudience.code).toBe('22023');
    } finally {
      await database.drop();
    }
  });

  it('keeps version history, shows residents the current version and never deletes', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      const document = await fixture.create(
        { folderId: await fixture.folderId('bylaws') },
        'Bylaws 2026',
      );
      const secondPath = await fixture.upload();
      const updated = documentSchema.parse(
        await fixture.value(
          'admin',
          'public.document_version_add($1,$2,$3,$4,$5,$6,$7)',
          [
            fixture.society,
            document.id,
            secondPath,
            'bylaws-v2.pdf',
            'Amended clause 4',
            document.version,
            crypto.randomUUID(),
          ],
        ),
      );
      expect(updated.current_version?.version_number).toBe(2);
      expect(updated.version_count).toBe(2);
      const retried = documentSchema.parse(
        await fixture.value(
          'admin',
          'public.document_version_add($1,$2,$3,$4,$5,$6,$7)',
          [
            fixture.society,
            document.id,
            secondPath,
            'bylaws-v2.pdf',
            null,
            document.version,
            crypto.randomUUID(),
          ],
        ),
      );
      expect(retried.version).toBe(updated.version);

      const ownerDetail = documentDetailSchema.parse(
        await fixture.value('owner', 'public.document_get($1,$2)', [
          fixture.society,
          document.id,
        ]),
      );
      expect(ownerDetail.versions.map((item) => item.version_number)).toEqual([
        2,
      ]);
      expect(ownerDetail.document.version_count).toBeNull();
      const adminDetail = documentDetailSchema.parse(
        await fixture.value('admin', 'public.document_get($1,$2)', [
          fixture.society,
          document.id,
        ]),
      );
      expect(adminDetail.versions.map((item) => item.version_number)).toEqual([
        2, 1,
      ]);

      const stale = await dbError(
        fixture.value(
          'admin',
          'public.document_version_add($1,$2,$3,$4,null,$5,$6)',
          [
            fixture.society,
            document.id,
            await fixture.upload(),
            'v3.pdf',
            document.version,
            crypto.randomUUID(),
          ],
        ),
      );
      expect(stale.code).toBe('40001');

      const v2 = adminDetail.versions[0]!;
      await fixture.value(
        'admin',
        'public.document_version_set_archived($1,$2,true,$3,$4)',
        [
          fixture.society,
          v2.id,
          await fixture.documentVersion(document.id),
          crypto.randomUUID(),
        ],
      );
      const afterArchive = documentDetailSchema.parse(
        await fixture.value('owner', 'public.document_get($1,$2)', [
          fixture.society,
          document.id,
        ]),
      );
      expect(afterArchive.versions.map((item) => item.version_number)).toEqual([
        1,
      ]);
      const lastVersion = await dbError(
        fixture.value(
          'admin',
          'public.document_version_set_archived($1,$2,true,$3,$4)',
          [
            fixture.society,
            adminDetail.versions[1]!.id,
            await fixture.documentVersion(document.id),
            crypto.randomUUID(),
          ],
        ),
      );
      expect(lastVersion.code).toBe('23514');

      await fixture.value(
        'admin',
        'public.document_set_archived($1,$2,true,$3,$4)',
        [
          fixture.society,
          document.id,
          await fixture.documentVersion(document.id),
          crypto.randomUUID(),
        ],
      );
      expect(await fixture.visibleDocuments('owner')).toEqual([]);
      const archivedForOwner = await dbError(
        fixture.value('owner', 'public.document_get($1,$2)', [
          fixture.society,
          document.id,
        ]),
      );
      expect(archivedForOwner.code).toBe('P0002');
      const adminArchived = documentListSchema.parse(
        await fixture.value(
          'admin',
          'public.document_list($1,$2,null,true,25,0)',
          [fixture.society, document.folder_id],
        ),
      );
      expect(adminArchived.items.map((item) => item.id)).toEqual([document.id]);

      for (const sql of [
        'delete from public.documents where id=$1',
        'delete from public.document_versions where document_id=$1',
      ]) {
        const deleted = await dbError(
          fixture.superuser((client) => client.query(sql, [document.id])),
        );
        expect(deleted.message).not.toBe('');
      }
      const folderDelete = await dbError(
        fixture.superuser((client) =>
          client.query(
            'delete from public.document_folders where society_id=$1',
            [fixture.society],
          ),
        ),
      );
      expect(folderDelete.message).not.toBe('');
      const mutated = await dbError(
        fixture.superuser((client) =>
          client.query(
            `update public.document_versions set file_name='changed.pdf' where document_id=$1`,
            [document.id],
          ),
        ),
      );
      expect(mutated.code).toBe('23514');
    } finally {
      await database.drop();
    }
  });

  it('hides documents in archived folders from residents only', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      const circulars = (await fixture.folders()).find(
        (folder) => folder.system_key === 'circulars',
      )!;
      await fixture.create({ folderId: circulars.id }, 'Water cut');
      await fixture.value(
        'admin',
        'public.document_folder_set_archived($1,$2,true,$3,$4)',
        [fixture.society, circulars.id, circulars.version, crypto.randomUUID()],
      );
      expect(await fixture.visibleDocuments('owner')).toEqual([]);
      expect(await fixture.visibleFolders('owner')).not.toContain('Circulars');
      expect(await fixture.visibleDocuments('committee')).toEqual([
        'Water cut',
      ]);
      const upload = await fixture.upload();
      const archivedTarget = await dbError(
        fixture.value(
          'admin',
          'public.document_create($1,$2,null,null,$3,null,$4,$5,$6,$7)',
          [
            fixture.society,
            circulars.id,
            'Late',
            upload,
            'late.pdf',
            crypto.randomUUID(),
            crypto.randomUUID(),
          ],
        ),
      );
      expect(archivedTarget.code).toBe('P0002');
    } finally {
      await database.drop();
    }
  });

  it('audits every download link and gates storage reads on that audit', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      const document = await fixture.create(
        { folderId: await fixture.folderId('audit_reports') },
        'Audit FY26',
      );
      const versionId = document.current_version!.id;
      const path = (
        await fixture.superuser((client) =>
          client.query<{ path: string }>(
            'select path from public.document_versions where id=$1',
            [versionId],
          ),
        )
      ).rows[0]!.path;
      const readObject = (actor: Actor) =>
        fixture.asActor(actor, (client) =>
          client.query(
            `select name from storage.objects where bucket_id='document-files' and name=$1`,
            [path],
          ),
        );
      expect((await readObject('owner')).rowCount).toBe(0);
      const issued = documentDownloadSchema.parse(
        await fixture.value(
          'owner',
          'public.document_download_issue($1,$2,$3)',
          [fixture.society, versionId, 'download-request'],
        ),
      );
      expect(issued.path).toBe(path);
      expect((await readObject('owner')).rowCount).toBe(1);
      const audit = await fixture.superuser((client) =>
        client.query<{
          actor_id: string;
          actor_role: string;
          request_id: string;
        }>(
          `select actor_id,actor_role,request_id from public.audit_logs
           where society_id=$1 and action='document.download' and entity_id=$2`,
          [fixture.society, versionId],
        ),
      );
      expect(audit.rows).toEqual([
        {
          actor_id: fixture.users('owner'),
          actor_role: 'resident',
          request_id: 'download-request',
        },
      ]);
      const tenantDownload = await dbError(
        fixture.value('tenant', 'public.document_download_issue($1,$2,$3)', [
          fixture.society,
          versionId,
          crypto.randomUUID(),
        ]),
      );
      expect(tenantDownload.code).toBe('P0002');
      expect((await readObject('tenant')).rowCount).toBe(0);
    } finally {
      await database.drop();
    }
  });

  it('lists only stale unattached uploads for service-role retention', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      const attached = await fixture.create(
        { folderId: await fixture.folderId('bylaws') },
        'Bylaws 2026',
      );
      const attachedPath = (
        await fixture.superuser((client) =>
          client.query<{ path: string }>(
            'select path from public.document_versions where id=$1',
            [attached.current_version!.id],
          ),
        )
      ).rows[0]!.path;
      const stale = await fixture.upload();
      const fresh = await fixture.upload();
      await fixture.superuser((client) =>
        client.query(
          `update storage.objects set created_at=now()-interval '25 hours'
           where bucket_id='document-files' and name = any($1)`,
          [[stale, attachedPath]],
        ),
      );
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
      }).format(new Date());
      const listed = await database.asRole(
        'service_role',
        {},
        async (client) =>
          (
            await client.query<{ bucket: string; path: string }>(
              'select bucket,path from public.document_retention_files_list($1)',
              [today],
            )
          ).rows,
      );
      expect(listed).toEqual([{ bucket: 'document-files', path: stale }]);
      expect(listed.map((row) => row.path)).not.toContain(fresh);
      const refused = await dbError(
        fixture.value('admin', 'public.document_retention_files_list($1)', [
          today,
        ]),
      );
      expect(refused.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });

  it('refuses writes from non-admins and validates uploads', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      const bylaws = await fixture.folderId('bylaws');
      const residentUpload = await dbError(fixture.upload('owner'));
      expect(residentUpload.code).toBe('42501');
      const committeeUpload = await dbError(fixture.upload('committee'));
      expect(committeeUpload.code).toBe('42501');
      const adminPath = await fixture.upload();
      for (const actor of ['committee', 'owner'] as const) {
        const refused = await dbError(
          fixture.value(
            actor,
            'public.document_create($1,$2,null,null,$3,null,$4,$5,$6,$7)',
            [
              fixture.society,
              bylaws,
              'Nope',
              adminPath,
              'file.pdf',
              crypto.randomUUID(),
              crypto.randomUUID(),
            ],
          ),
        );
        expect(refused.code).toBe('42501');
        const folder = await dbError(
          fixture.value(
            actor,
            'public.document_folder_save($1,null,$2,$3,null,$4)',
            [fixture.society, 'Mine', 'all_residents', crypto.randomUUID()],
          ),
        );
        expect(folder.code).toBe('42501');
      }
      const direct = await dbError(
        fixture.asActor('admin', (client) =>
          client.query(
            `insert into public.documents(society_id,folder_id,title,client_request_id,created_by)
             values($1,$2,'Direct',gen_random_uuid(),$3)`,
            [fixture.society, bylaws, fixture.users('admin')],
          ),
        ),
      );
      expect(direct.code).toBe('42501');

      const wrongType = await fixture.upload('admin', {
        mimetype: 'image/png',
        size: 100,
      });
      const mismatch = await dbError(
        fixture.value(
          'admin',
          'public.document_create($1,$2,null,null,$3,null,$4,$5,$6,$7)',
          [
            fixture.society,
            bylaws,
            'Mismatch',
            wrongType,
            'file.pdf',
            crypto.randomUUID(),
            crypto.randomUUID(),
          ],
        ),
      );
      expect(mismatch.code).toBe('22023');
      const tooBig = await fixture.upload('admin', {
        mimetype: 'application/pdf',
        size: 5242881,
      });
      const big = await dbError(
        fixture.value(
          'admin',
          'public.document_create($1,$2,null,null,$3,null,$4,$5,$6,$7)',
          [
            fixture.society,
            bylaws,
            'Big',
            tooBig,
            'file.pdf',
            crypto.randomUUID(),
            crypto.randomUUID(),
          ],
        ),
      );
      expect(big.code).toBe('22023');

      const clientRequestId = crypto.randomUUID();
      const first = await fixture.create(
        { folderId: bylaws },
        'Once',
        'admin',
        clientRequestId,
      );
      const second = await fixture.create(
        { folderId: bylaws },
        'Once',
        'admin',
        clientRequestId,
      );
      expect(second.id).toBe(first.id);
      const duplicateFolder = await dbError(
        fixture.value(
          'admin',
          'public.document_folder_save($1,null,$2,$3,null,$4)',
          [fixture.society, 'bylaws', 'all_residents', crypto.randomUUID()],
        ),
      );
      expect(duplicateFolder.code).toBe('23514');
      const creates = await fixture.superuser((client) =>
        client.query(
          `select actor_role from public.audit_logs where society_id=$1 and action='document.create'`,
          [fixture.society],
        ),
      );
      expect(creates.rows).toEqual([{ actor_role: 'admin' }]);
    } finally {
      await database.drop();
    }
  });

  it('notifies only the audience in the same society', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      await fixture.create(
        { folderId: await fixture.folderId('audit_reports') },
        'Owners audit',
      );
      await fixture.create(
        { unitId: fixture.unit('A-101'), unitAudience: 'all_occupants' },
        'Unit letter',
      );
      const notifications = await fixture.superuser((client) =>
        client.query<{ user_id: string; body: string; entity_type: string }>(
          `select user_id,body,entity_type from public.notifications
           where type='document_published' order by body,user_id`,
        ),
      );
      const recipients = (body: string) =>
        notifications.rows
          .filter((row) => row.body === body)
          .map((row) => row.user_id)
          .sort();
      expect(recipients('Owners audit')).toEqual(
        [fixture.users('owner'), fixture.users('otherOwner')].sort(),
      );
      expect(recipients('Unit letter')).toEqual(
        [
          fixture.users('owner'),
          fixture.users('tenant'),
          fixture.users('family'),
        ].sort(),
      );
      expect(
        notifications.rows.every((row) => row.entity_type === 'document'),
      ).toBe(true);
    } finally {
      await database.drop();
    }
  });

  it('refuses access when the module is disabled', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      await fixture.create(
        { folderId: await fixture.folderId('bylaws') },
        'Bylaws',
      );
      await fixture.superuser((client) =>
        client.query(
          `update public.module_configs set enabled=false where society_id=$1 and module_key='document'`,
          [fixture.society],
        ),
      );
      for (const actor of ['admin', 'owner'] as const) {
        const workspace = await dbError(
          fixture.value(actor, 'public.document_workspace_get($1)', [
            fixture.society,
          ]),
        );
        expect(workspace.code).toBe('42501');
        expect(await fixture.visibleDocuments(actor)).toEqual([]);
        expect(await fixture.visibleFolders(actor)).toEqual([]);
      }
      const write = await dbError(
        fixture.value(
          'admin',
          'public.document_folder_save($1,null,$2,$3,null,$4)',
          [fixture.society, 'New', 'all_residents', crypto.randomUUID()],
        ),
      );
      expect(write.code).toBe('42501');
      const uploadRefused = await dbError(fixture.upload());
      expect(uploadRefused.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });

  it('isolates societies', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      const document = await fixture.create(
        { folderId: await fixture.folderId('bylaws') },
        'Society A bylaws',
      );
      const foreignWorkspace = await dbError(
        fixture.value('foreignAdmin', 'public.document_workspace_get($1)', [
          fixture.society,
        ]),
      );
      expect(foreignWorkspace.code).toBe('42501');
      const crossGet = await dbError(
        fixture.value('foreignAdmin', 'public.document_get($1,$2)', [
          fixture.foreignSociety,
          document.id,
        ]),
      );
      expect(crossGet.code).toBe('P0002');
      const crossDownload = await dbError(
        fixture.value(
          'foreignResident',
          'public.document_download_issue($1,$2,$3)',
          [fixture.foreignSociety, document.current_version!.id, 'x'],
        ),
      );
      expect(crossDownload.code).toBe('P0002');
      const foreignPath = await fixture.upload(
        'foreignAdmin',
        undefined,
        fixture.foreignSociety,
      );
      const crossFolder = await dbError(
        fixture.value(
          'foreignAdmin',
          'public.document_create($1,$2,null,null,$3,null,$4,$5,$6,$7)',
          [
            fixture.foreignSociety,
            await fixture.folderId('bylaws'),
            'Cross',
            foreignPath,
            'file.pdf',
            crypto.randomUUID(),
            crypto.randomUUID(),
          ],
        ),
      );
      expect(crossFolder.code).toBe('P0002');
      const crossPath = await dbError(
        fixture.value(
          'foreignAdmin',
          'public.document_create($1,$2,null,null,$3,null,$4,$5,$6,$7)',
          [
            fixture.foreignSociety,
            await fixture.folderId('bylaws', fixture.foreignSociety),
            'Cross path',
            await fixture.upload(),
            'file.pdf',
            crypto.randomUUID(),
            crypto.randomUUID(),
          ],
        ),
      );
      expect(crossPath.code).toBe('22023');
      const crossUnit = await dbError(
        fixture.value(
          'foreignAdmin',
          'public.document_create($1,null,$2,$3,$4,null,$5,$6,$7,$8)',
          [
            fixture.foreignSociety,
            fixture.unit('A-101'),
            'all_occupants',
            'Cross unit',
            foreignPath,
            'file.pdf',
            crypto.randomUUID(),
            crypto.randomUUID(),
          ],
        ),
      );
      expect(crossUnit.code).toBe('P0002');
      expect(await fixture.visibleDocuments('foreignResident')).toEqual([]);
    } finally {
      await database.drop();
    }
  });

  it('lists tenancy NOCs for the unit only while tenancy is enabled', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      const unitA = fixture.unit('A-101');
      await fixture.superuser(async (client) => {
        const admin = fixture.users('admin');
        const tenantMembership = (
          await client.query<{ membership_id: string }>(
            'select membership_id from public.unit_occupants where id=$1',
            [fixture.occupancies.get('tenant')],
          )
        ).rows[0]!.membership_id;
        const move = (
          await client.query<{ id: string }>(
            `insert into public.tenancy_moves
             (society_id,unit_id,tenant_membership_id,occupancy_id,kind,starts_at,ends_at,status,
              approved_at,approved_by,completed_at,completed_by,client_request_id,created_by,updated_by)
             values($1,$2,$3,$4,'move_out',clock_timestamp()-interval '2 hours',
              clock_timestamp()-interval '1 hour','completed',clock_timestamp(),$5,clock_timestamp(),$5,
              gen_random_uuid(),$5,$5) returning id`,
            [
              fixture.society,
              unitA,
              tenantMembership,
              fixture.occupancies.get('tenant'),
              admin,
            ],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.tenancy_documents
           (society_id,move_id,kind,path,content_type,size_bytes,dues_status,created_by)
           values($1,$2,'noc',$3,'application/pdf',2048,'not_checked',$4)`,
          [
            fixture.society,
            move,
            `${fixture.society}/moves/${move}/noc/${crypto.randomUUID()}.pdf`,
            admin,
          ],
        );
      });
      const list = async (actor: Actor) =>
        documentListSchema.parse(
          await fixture.value(
            actor,
            'public.document_list($1,null,$2,false,25,0)',
            [fixture.society, unitA],
          ),
        ).tenancy_nocs;
      expect(await list('owner')).toHaveLength(1);
      expect(await list('admin')).toHaveLength(1);
      expect(await list('family')).toHaveLength(0);
      await fixture.superuser((client) =>
        client.query(
          `update public.module_configs set enabled=false where society_id=$1 and module_key='tenancy'`,
          [fixture.society],
        ),
      );
      expect(await list('owner')).toHaveLength(0);
      const workspace = documentWorkspaceSchema.parse(
        await fixture.value('owner', 'public.document_workspace_get($1)', [
          fixture.society,
        ]),
      );
      expect(workspace.tenancy_enabled).toBe(false);
    } finally {
      await database.drop();
    }
  });
});
