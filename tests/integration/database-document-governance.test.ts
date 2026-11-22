// Verify P44 source access, private history, source loss and expiry-reminder safety.
import { describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

const ACTORS = [
  'admin',
  'committee',
  'ownerCommittee',
  'tenant',
  'resident',
] as const;
type Actor = (typeof ACTORS)[number];

async function createFixture(database: TestDatabase) {
  const users = new Map<Actor, string>();
  const memberships = new Map<Actor, string>();
  const id = (actor: Actor) => {
    const value = users.get(actor);
    if (!value) throw new Error(`Missing ${actor}.`);
    return value;
  };
  const membershipId = (actor: Actor) => {
    const value = memberships.get(actor);
    if (!value) throw new Error(`Missing ${actor} membership.`);
    return value;
  };
  const fixture = await database.asSuperuser(async (client) => {
    for (const actor of ACTORS) {
      const email = `governance-${actor.toLowerCase()}@example.test`;
      const userId = await newAuthUser(client, email);
      users.set(actor, userId);
      await client.query(
        `insert into public.profiles(id,email,full_name) values($1,$2,$3)
         on conflict(id) do update set full_name=excluded.full_name`,
        [userId, email, `Synthetic ${actor}`],
      );
    }
    const societyId = (
      await client.query<{ id: string }>(
        `insert into public.societies(name,created_by)
         values('Governance documents',$1) returning id`,
        [id('admin')],
      )
    ).rows[0]!.id;
    for (const actor of ACTORS) {
      const roles =
        actor === 'admin'
          ? ['admin']
          : actor === 'committee'
            ? ['committee']
            : actor === 'ownerCommittee'
              ? ['committee', 'resident']
              : ['resident'];
      const membership = (
        await client.query<{ id: string }>(
          `insert into public.memberships(society_id,user_id,roles,status)
           values($1,$2,$3,'active') returning id`,
          [societyId, id(actor), roles],
        )
      ).rows[0]!.id;
      memberships.set(actor, membership);
    }
    const unitId = (
      await client.query<{ id: string }>(
        `insert into public.units(society_id,number,created_by)
         values($1,'A-101',$2) returning id`,
        [societyId, id('admin')],
      )
    ).rows[0]!.id;
    for (const [actor, relationship] of [
      ['ownerCommittee', 'owner'],
      ['tenant', 'tenant'],
    ] as const) {
      await client.query(
        `insert into public.unit_occupants
         (society_id,unit_id,membership_id,relationship,status,started_at,created_by)
         values($1,$2,$3,$4,'active',current_date-60,$5)`,
        [societyId, unitId, membershipId(actor), relationship, id('admin')],
      );
    }
    await client.query(
      `insert into public.module_configs(society_id,module_key,enabled,settings)
       values
         ($1,'core',true,'{}'),
         ($1,'document',true,'{}'),
         ($1,'tenancy',true,'{}'),
         ($1,'meeting',true,'{}')`,
      [societyId],
    );
    const folderId = (
      await client.query<{ id: string }>(
        `select id from public.document_folders
         where society_id=$1 and system_key='bylaws'`,
        [societyId],
      )
    ).rows[0]!.id;
    const ownerOccupancyId = (
      await client.query<{ id: string }>(
        `select id from public.unit_occupants
         where society_id=$1 and membership_id=$2`,
        [societyId, membershipId('ownerCommittee')],
      )
    ).rows[0]!.id;
    const tenantOccupancyId = (
      await client.query<{ id: string }>(
        `select id from public.unit_occupants
         where society_id=$1 and membership_id=$2`,
        [societyId, membershipId('tenant')],
      )
    ).rows[0]!.id;
    const moveId = (
      await client.query<{ id: string }>(
        `insert into public.tenancy_moves(
           society_id,unit_id,tenant_membership_id,occupancy_id,kind,starts_at,ends_at,
           status,approved_at,approved_by,completed_at,completed_by,
           client_request_id,created_by,updated_by
         ) values(
           $1,$2,$3,$4,'move_out',clock_timestamp()-interval '2 days',
           clock_timestamp()-interval '1 day','completed',clock_timestamp()-interval '2 days',
           $5,clock_timestamp()-interval '1 day',$5,$6,$5,$5
         ) returning id`,
        [
          societyId,
          unitId,
          membershipId('tenant'),
          tenantOccupancyId,
          id('admin'),
          crypto.randomUUID(),
        ],
      )
    ).rows[0]!.id;
    const nocId = (
      await client.query<{ id: string }>(
        `insert into public.tenancy_documents(
           society_id,move_id,kind,path,content_type,size_bytes,dues_status,
           dues_checked_at,purge_after,created_by
         ) values(
           $1,$2,'noc',$3,'application/pdf',100,'cleared',
           clock_timestamp(),clock_timestamp()+interval '1 year',$4
         ) returning id`,
        [
          societyId,
          moveId,
          `${societyId}/moves/${moveId}/noc/${crypto.randomUUID()}.pdf`,
          id('admin'),
        ],
      )
    ).rows[0]!.id;
    const meetingId = (
      await client.query<{ id: string }>(
        `insert into public.meetings(
           society_id,meeting_type,status,title,client_request_id,created_by,updated_by
         ) values($1,'committee','draft','Synthetic decision',$2,$3,$3) returning id`,
        [societyId, crypto.randomUUID(), id('admin')],
      )
    ).rows[0]!.id;
    const resolutionId = (
      await client.query<{ id: string }>(
        `insert into public.meeting_resolutions(
           society_id,meeting_id,position,title,body,outcome,created_by,updated_by
         ) values($1,$2,1,'Adopt house rules','Recorded rule decision','passed',$3,$3)
         returning id`,
        [societyId, meetingId, id('admin')],
      )
    ).rows[0]!.id;
    return {
      societyId,
      folderId,
      unitId,
      ownerOccupancyId,
      tenantOccupancyId,
      nocId,
      meetingId,
      resolutionId,
    };
  });

  const asActor = <T>(actor: Actor, run: (client: Client) => Promise<T>) =>
    database.asRole('authenticated', { sub: id(actor) }, run, {
      commit: true,
    });
  const asService = <T>(run: (client: Client) => Promise<T>) =>
    database.asRole('service_role', null, run, { commit: true });
  const value = async (actor: Actor, sql: string, params: unknown[]) =>
    (
      await asActor(actor, (client) =>
        client.query<{ value: unknown }>(`select ${sql} as value`, params),
      )
    ).rows[0]!.value;

  const uploadAndCreate = async () => {
    const path = `${fixture.societyId}/documents/${crypto.randomUUID()}.pdf`;
    await asActor('admin', (client) =>
      client.query(
        `insert into storage.objects(bucket_id,name,metadata) values(
           'document-files',$1,$2
         )`,
        [path, { mimetype: 'application/pdf', size: 2048 }],
      ),
    );
    return value(
      'admin',
      'public.document_create($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [
        fixture.societyId,
        fixture.folderId,
        null,
        null,
        'Registration certificate',
        null,
        path,
        'certificate.pdf',
        crypto.randomUUID(),
        crypto.randomUUID(),
      ],
    ) as Promise<{
      id: string;
      version: number;
      current_version: { id: string };
    }>;
  };

  const save = async (args: {
    actor?: Actor;
    recordId?: string | null;
    kind: 'validity' | 'register' | 'amendment' | 'house_rule';
    title: string;
    state: 'draft' | 'verified';
    documentVersionId?: string | null;
    nocId?: string | null;
    resolutionId?: string | null;
    approvingResolutionId?: string | null;
    details: Record<string, unknown>;
    expectedVersion?: number | null;
    reason?: string | null;
  }) =>
    value(
      args.actor ?? 'admin',
      'public.document_governance_save($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
      [
        fixture.societyId,
        args.recordId ?? null,
        args.kind,
        args.title,
        args.state,
        args.documentVersionId ?? null,
        args.nocId ?? null,
        args.resolutionId ?? null,
        args.approvingResolutionId ?? null,
        JSON.stringify(args.details),
        args.expectedVersion ?? null,
        args.reason ?? null,
        crypto.randomUUID(),
        crypto.randomUUID(),
      ],
    ) as Promise<{
      id: string;
      kind: string;
      title: string;
      state: string;
      version: number;
      source: { state: string };
    }>;

  return {
    ...fixture,
    id,
    membershipId,
    asActor,
    asService,
    value,
    save,
    uploadAndCreate,
    superuser: <T>(run: (client: Client) => Promise<T>) =>
      database.asSuperuser(run),
  };
}

describe.skipIf(!hasDatabase)('database document governance', () => {
  it('enforces source-aware staff reads and keeps custody private', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      const document = await fixture.uploadAndCreate();
      const draft = await fixture.save({
        kind: 'register',
        title: 'Shared draft',
        state: 'draft',
        details: {
          name: 'Society register',
          type: 'Society-entered',
          basis: 'Draft basis',
          maintenanceState: 'not_started',
          clauseOrPage: null,
          format: null,
          physicalLocation: 'Locked cabinet',
          custodian: 'Admin office',
          reviewDate: null,
        },
      });
      const committeeDraft = (await fixture.value(
        'committee',
        'public.document_governance_get($1,$2)',
        [fixture.societyId, draft.id],
      )) as { register: Record<string, unknown> };
      expect(committeeDraft.register).not.toHaveProperty('physicalLocation');
      expect(committeeDraft.register).not.toHaveProperty('custodian');
      expect(
        (
          await dbError(
            fixture.value('resident', 'public.document_governance_get($1,$2)', [
              fixture.societyId,
              draft.id,
            ]),
          )
        ).code,
      ).toBe('42501');

      const verified = await fixture.save({
        kind: 'register',
        title: 'Verified register',
        state: 'verified',
        documentVersionId: document.current_version.id,
        details: {
          name: 'Membership register',
          type: 'Society-entered',
          basis: 'P19 certificate',
          maintenanceState: 'maintained',
          clauseOrPage: null,
          format: 'PDF',
          physicalLocation: 'Locked cabinet',
          custodian: 'Admin office',
          reviewDate: '2026-11-22',
        },
      });
      expect(
        await fixture.value(
          'committee',
          'public.document_governance_get($1,$2)',
          [fixture.societyId, verified.id],
        ),
      ).toMatchObject({ state: 'verified' });
      await fixture.value(
        'admin',
        'public.document_set_archived($1,$2,true,$3,$4)',
        [fixture.societyId, document.id, document.version, crypto.randomUUID()],
      );
      expect(
        (
          (await fixture.value(
            'admin',
            'public.document_governance_get($1,$2)',
            [fixture.societyId, verified.id],
          )) as { source: { state: string } }
        ).source.state,
      ).toBe('needs_review');
      for (const table of [
        'document_governance_records',
        'document_validities',
        'document_register_indexes',
        'document_amendment_milestones',
        'document_house_rules',
        'document_governance_revisions',
      ]) {
        const denied = await dbError(
          fixture.asActor('admin', (client) =>
            client.query(`select * from public.${table}`),
          ),
        );
        expect(denied.code).toBe('42501');
      }
    } finally {
      await database.drop();
    }
  });

  it('retains NOC-linked records for admins but requires independent NOC access', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      await fixture.superuser((client) =>
        client.query(
          `with new_moves as (
             insert into public.tenancy_moves(
               society_id,unit_id,tenant_membership_id,occupancy_id,kind,starts_at,ends_at,
               status,approved_at,approved_by,completed_at,completed_by,
               client_request_id,created_by,updated_by
             )
             select $1,$2,$3,$4,'move_out',clock_timestamp()-interval '2 days',
               clock_timestamp()-interval '1 day','completed',
               clock_timestamp()-interval '2 days',$5,
               clock_timestamp()-interval '1 day',$5,
               gen_random_uuid(),$5,$5
             from generate_series(1, 51)
             returning id
           )
           insert into public.tenancy_documents(
             society_id,move_id,kind,path,content_type,size_bytes,dues_status,
             dues_checked_at,purge_after,created_by
           )
           select $1,id,'noc',$1::text || '/moves/' || id::text || '/noc/' ||
             gen_random_uuid()::text || '.pdf','application/pdf',100,'cleared',
             clock_timestamp(),clock_timestamp()+interval '1 year',$5
           from new_moves`,
          [
            fixture.societyId,
            fixture.unitId,
            fixture.membershipId('tenant'),
            fixture.tenantOccupancyId,
            fixture.id('admin'),
          ],
        ),
      );
      const pagedNocs = (await fixture.value(
        'admin',
        'public.document_governance_sources_list($1,$2,$3,25,50)',
        [fixture.societyId, 'validity', 'tenancy_noc'],
      )) as { total: number; items: unknown[] };
      expect(pagedNocs.total).toBe(52);
      expect(pagedNocs.items).toHaveLength(2);
      const record = await fixture.save({
        kind: 'validity',
        title: 'NOC-backed fact',
        state: 'verified',
        nocId: fixture.nocId,
        details: {
          issuingAuthority: 'Registrar',
          reference: 'NOC-1',
          issueDate: '2026-11-20',
          expiryKind: 'dated',
          expiryDate: '2027-11-20',
        },
      });
      expect(
        (
          await dbError(
            fixture.value(
              'committee',
              'public.document_governance_get($1,$2)',
              [fixture.societyId, record.id],
            ),
          )
        ).code,
      ).toBe('P0002');
      expect(
        await fixture.value(
          'ownerCommittee',
          'public.document_governance_get($1,$2)',
          [fixture.societyId, record.id],
        ),
      ).toMatchObject({ state: 'verified' });
      await fixture.superuser((client) =>
        client.query(
          `update public.tenancy_documents
           set purge_after=clock_timestamp()-interval '1 second'
           where id=$1`,
          [fixture.nocId],
        ),
      );
      const adminRecord = (await fixture.value(
        'admin',
        'public.document_governance_get($1,$2)',
        [fixture.societyId, record.id],
      )) as { source: { state: string } };
      expect(adminRecord.source.state).toBe('needs_review');
      expect(
        (
          await dbError(
            fixture.value(
              'ownerCommittee',
              'public.document_governance_get($1,$2)',
              [fixture.societyId, record.id],
            ),
          )
        ).code,
      ).toBe('P0002');
      await fixture.superuser((client) =>
        client.query(
          `update public.module_configs set enabled=false
           where society_id=$1 and module_key='tenancy'`,
          [fixture.societyId],
        ),
      );
      const hidden = (await fixture.value(
        'admin',
        'public.document_governance_list($1,null,false,25,0)',
        [fixture.societyId],
      )) as { total: number };
      expect(hidden.total).toBe(0);
      expect(
        (
          await dbError(
            fixture.value(
              'admin',
              'public.document_governance_history($1,$2,25,0)',
              [fixture.societyId, record.id],
            ),
          )
        ).code,
      ).toBe('P0002');
    } finally {
      await database.drop();
    }
  });

  it('preserves deleted meeting evidence as an unavailable sourced record', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      const record = await fixture.save({
        kind: 'amendment',
        title: 'Filed amendment',
        state: 'verified',
        resolutionId: fixture.resolutionId,
        details: {
          milestoneType: 'meeting',
          milestoneDate: '2026-11-22',
          note: 'Recorded meeting fact',
          historicalEvidence: false,
        },
      });
      await fixture.superuser((client) =>
        client.query(`delete from public.meeting_resolutions where id=$1`, [
          fixture.resolutionId,
        ]),
      );
      const adminRecord = (await fixture.value(
        'admin',
        'public.document_governance_get($1,$2)',
        [fixture.societyId, record.id],
      )) as { source: { state: string } };
      expect(adminRecord.source.state).toBe('needs_review');
      expect(
        (
          await dbError(
            fixture.value(
              'committee',
              'public.document_governance_get($1,$2)',
              [fixture.societyId, record.id],
            ),
          )
        ).code,
      ).toBe('P0002');
    } finally {
      await database.drop();
    }
  });

  it('deduplicates expiry reminders and sends no reminder from an unavailable NOC', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      const document = await fixture.uploadAndCreate();
      await fixture.superuser((client) =>
        client.query(
          `update public.module_configs
           set settings='{\"expiry_reminders_enabled\":true}'::jsonb
           where society_id=$1 and module_key='document'`,
          [fixture.societyId],
        ),
      );
      const record = await fixture.save({
        kind: 'validity',
        title: 'Expiring certificate',
        state: 'verified',
        documentVersionId: document.current_version.id,
        details: {
          issuingAuthority: 'Registrar',
          reference: 'REG-1',
          issueDate: '2026-01-01',
          expiryKind: 'dated',
          expiryDate: '2026-11-29',
        },
      });
      const run = () =>
        fixture.asService((client) =>
          client.query<{ count: number }>(
            `select public.document_expiry_reminders_run($1,$2) as count`,
            [fixture.societyId, crypto.randomUUID()],
          ),
        );
      const first = await run();
      const second = await run();
      expect(first.rows[0]!.count).toBe(1);
      expect(second.rows[0]!.count).toBe(0);
      const notifications = await fixture.superuser((client) =>
        client.query(
          `select id from public.notifications
           where society_id=$1 and type='document_expiry_reminder'`,
          [fixture.societyId],
        ),
      );
      expect(notifications.rowCount).toBe(1);
      await fixture.save({
        recordId: record.id,
        expectedVersion: record.version,
        reason: 'Correct the sourced date',
        kind: 'validity',
        title: record.title,
        state: 'verified',
        documentVersionId: document.current_version.id,
        details: {
          issuingAuthority: 'Registrar',
          reference: 'REG-1',
          issueDate: '2026-01-01',
          expiryKind: 'dated',
          expiryDate: '2026-11-22',
        },
      });
      expect((await run()).rows[0]!.count).toBe(1);
      const pending = await fixture.save({
        kind: 'validity',
        title: 'Pending with no recipient',
        state: 'verified',
        documentVersionId: document.current_version.id,
        details: {
          issuingAuthority: 'Registrar',
          reference: 'REG-2',
          issueDate: '2026-01-01',
          expiryKind: 'dated',
          expiryDate: '2026-11-22',
        },
      });
      await fixture.superuser((client) =>
        client.query(
          `update public.memberships set status='deactivated'
           where society_id=$1 and user_id=$2`,
          [fixture.societyId, fixture.id('admin')],
        ),
      );
      expect((await run()).rows[0]!.count).toBe(0);
      const marker = await fixture.superuser((client) =>
        client.query<{ reminder_cycle_date: string | null }>(
          `select reminder_cycle_date from public.document_validities
           where record_id=$1`,
          [pending.id],
        ),
      );
      expect(marker.rows[0]!.reminder_cycle_date).toBe(null);
      const denied = await dbError(
        fixture.value(
          'ownerCommittee',
          'public.document_expiry_reminders_run($1,$2)',
          [fixture.societyId, crypto.randomUUID()],
        ),
      );
      expect(denied.code).toBe('42501');
    } finally {
      await database.drop();
    }
  });

  it('keeps house-rule publication fail-closed', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await createFixture(database);
      const document = await fixture.uploadAndCreate();
      const rule = await fixture.save({
        kind: 'house_rule',
        title: 'House rule draft',
        state: 'verified',
        documentVersionId: document.current_version.id,
        approvingResolutionId: fixture.resolutionId,
        details: {
          text: 'Recorded rule decision',
          approvalDate: '2026-11-22',
          effectiveDate: '2026-11-23',
        },
      });
      const denied = await dbError(
        fixture.value(
          'admin',
          'public.document_house_rule_publish($1,$2,$3,$4)',
          [fixture.societyId, rule.id, rule.version, crypto.randomUUID()],
        ),
      );
      expect(denied.code).toBe('23514');
      const stored = await fixture.superuser((client) =>
        client.query<{ publication_state: string; gate_locked: boolean }>(
          `select publication_state,gate_locked from public.document_house_rules
           where record_id=$1`,
          [rule.id],
        ),
      );
      expect(stored.rows[0]).toEqual({
        publication_state: 'draft',
        gate_locked: true,
      });
      expect(
        await fixture.value(
          'resident',
          'public.document_house_rules_published_list($1)',
          [fixture.societyId],
        ),
      ).toEqual({ items: [] });
      await fixture.superuser(async (client) => {
        await client.query(
          `alter table public.document_house_rules
             drop constraint document_house_rules_gate_locked_check,
             drop constraint document_house_rules_publication_check`,
        );
        await client.query(
          `update public.document_house_rules set gate_locked=false where record_id=$1`,
          [rule.id],
        );
      });
      await fixture.value(
        'admin',
        'public.document_house_rule_publish($1,$2,$3,$4)',
        [fixture.societyId, rule.id, rule.version, crypto.randomUUID()],
      );
      const published = (await fixture.value(
        'resident',
        'public.document_house_rules_published_list($1)',
        [fixture.societyId],
      )) as { items: { id: string }[] };
      expect(published.items.map((item) => item.id)).toEqual([rule.id]);
      await fixture.superuser((client) =>
        client.query(
          `update public.module_configs set enabled=false
           where society_id=$1 and module_key='meeting'`,
          [fixture.societyId],
        ),
      );
      expect(
        await fixture.value(
          'resident',
          'public.document_house_rules_published_list($1)',
          [fixture.societyId],
        ),
      ).toEqual({ items: [] });
      await fixture.superuser(async (client) => {
        await client.query(
          `update public.module_configs set enabled=true
           where society_id=$1 and module_key='meeting'`,
          [fixture.societyId],
        );
        await client.query(
          `update public.document_folders set archived_at=clock_timestamp(),archived_by=$1
           where id=$2`,
          [fixture.id('admin'), fixture.folderId],
        );
      });
      expect(
        await fixture.value(
          'resident',
          'public.document_house_rules_published_list($1)',
          [fixture.societyId],
        ),
      ).toEqual({ items: [] });
    } finally {
      await database.drop();
    }
  });
});
