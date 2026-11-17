// Verify tenant-move privacy, consent, Core access timing and financial/lifecycle backstops.
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
  tenancyMoveDetailSchema,
  tenancyNocPreparationSchema,
  tenancyPageSchema,
  tenancyWorkspaceSchema,
} from '../../src/core/tenancy/moves/validation';

const ACTORS = [
  'admin',
  'adminTwo',
  'committee',
  'guard',
  'supervisor',
  'owner',
  'coOwner',
  'otherResident',
  'tenant',
  'newTenant',
  'foreignAdmin',
] as const;
type Actor = (typeof ACTORS)[number];

function requireId(ids: Map<Actor, string>, actor: Actor) {
  const id = ids.get(actor);
  if (!id) throw new Error(`Missing synthetic ${actor} identifier.`);
  return id;
}

async function createFixture(database: TestDatabase) {
  const users = new Map<Actor, string>();
  const memberships = new Map<Actor, string>();
  const fixture = await database.asSuperuser(async (client) => {
    for (const actor of ACTORS) {
      const email = `tenancy-${actor.toLowerCase()}@example.test`;
      const id = await newAuthUser(client, email);
      users.set(actor, id);
      await client.query(
        'update auth.users set email_confirmed_at=now() where id=$1',
        [id],
      );
      await client.query(
        `insert into public.profiles(id,email,full_name) values($1,$2,$3)
         on conflict(id) do update set full_name=excluded.full_name`,
        [id, email, `Synthetic ${actor}`],
      );
    }
    const society = (
      await client.query<{ id: string }>(
        `insert into public.societies(name,created_by) values('Tenancy A',$1) returning id`,
        [requireId(users, 'admin')],
      )
    ).rows[0]!.id;
    const foreignSociety = (
      await client.query<{ id: string }>(
        `insert into public.societies(name,created_by) values('Tenancy B',$1) returning id`,
        [requireId(users, 'foreignAdmin')],
      )
    ).rows[0]!.id;
    for (const actor of ACTORS) {
      const role = ['admin', 'adminTwo', 'foreignAdmin'].includes(actor)
        ? 'admin'
        : actor === 'committee'
          ? 'committee'
          : actor === 'guard'
            ? 'guard'
            : actor === 'supervisor'
              ? 'hk_supervisor'
              : 'resident';
      const id = (
        await client.query<{ id: string }>(
          `insert into public.memberships(society_id,user_id,invited_email,roles,status)
           values($1,$2,$3,array[$4]::text[],$5) returning id`,
          [
            actor === 'foreignAdmin' ? foreignSociety : society,
            actor === 'newTenant' ? null : requireId(users, actor),
            actor === 'newTenant' ? 'tenancy-newtenant@example.test' : null,
            role,
            actor === 'newTenant' ? 'invited' : 'active',
          ],
        )
      ).rows[0]!.id;
      memberships.set(actor, id);
    }
    const units = (
      await client.query<{ id: string; number: string }>(
        `insert into public.units(society_id,number,created_by)
         values($1,'A-101',$2),($1,'B-201',$2),($1,'C-301',$2) returning id,number`,
        [society, requireId(users, 'admin')],
      )
    ).rows;
    const unit = (number: string) => {
      const match = units.find((row) => row.number === number);
      if (!match) throw new Error('Missing synthetic unit.');
      return match.id;
    };
    const occupancies = new Map<Actor, string>();
    for (const [actor, number, relationship, status, primary] of [
      ['owner', 'A-101', 'owner', 'active', true],
      ['coOwner', 'A-101', 'owner', 'active', false],
      ['otherResident', 'C-301', 'owner', 'active', true],
      ['tenant', 'B-201', 'tenant', 'active', true],
      ['newTenant', 'A-101', 'tenant', 'pending', false],
    ] as const) {
      const id = (
        await client.query<{ id: string }>(
          `insert into public.unit_occupants
           (society_id,unit_id,membership_id,relationship,status,is_primary,is_approver,started_at,created_by)
           values($1,$2,$3,$4,$5,$6,true,current_date-30,$7) returning id`,
          [
            society,
            unit(number),
            requireId(memberships, actor),
            relationship,
            status,
            primary,
            requireId(users, 'admin'),
          ],
        )
      ).rows[0]!.id;
      occupancies.set(actor, id);
    }
    await client.query(
      `insert into public.module_configs(society_id,module_key,enabled,settings)
       values($1,'core',true,'{}'),($1,'tenancy',true,'{}'),($1,'directory',true,'{}'),
         ($1,'billing',false,'{}'),($2,'core',true,'{}'),($2,'tenancy',true,'{}')`,
      [society, foreignSociety],
    );
    return { society, foreignSociety, unit, occupancies };
  });
  const asActor = <T>(actor: Actor, run: (client: Client) => Promise<T>) =>
    database.asRole('authenticated', { sub: requireId(users, actor) }, run, {
      commit: true,
    });
  const version = async (moveId: string) =>
    database.asSuperuser(
      async (client) =>
        (
          await client.query<{ version: number }>(
            'select version from public.tenancy_moves where id=$1',
            [moveId],
          )
        ).rows[0]!.version,
    );
  const create = async (
    kind: 'move_in' | 'move_out' = 'move_in',
    actor: Actor = 'admin',
    clientId = crypto.randomUUID(),
  ) =>
    (
      await asActor(actor, (client) =>
        client.query<{ id: string }>(
          `select public.tenancy_move_create($1,$2,$3,$4,
          clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day 1 hour',
          $5,null,$6,$7) as id`,
          [
            fixture.society,
            fixture.unit(kind === 'move_in' ? 'A-101' : 'B-201'),
            requireId(memberships, kind === 'move_in' ? 'newTenant' : 'tenant'),
            kind,
            kind === 'move_in'
              ? new Date(Date.now() + 400 * 86_400_000)
                  .toISOString()
                  .slice(0, 10)
              : null,
            clientId,
            crypto.randomUUID(),
          ],
        ),
      )
    ).rows[0]!.id;
  const detail = async (moveId: string, actor: Actor = 'admin') => {
    const result = await asActor(actor, (client) =>
      client.query<{ value: unknown }>(
        'select public.tenancy_move_get($1,$2) as value',
        [fixture.society, moveId],
      ),
    );
    return tenancyMoveDetailSchema.parse(result.rows[0]!.value);
  };
  const page = async (actor: Actor) => {
    const result = await asActor(actor, (client) =>
      client.query<{ value: unknown }>(
        'select public.tenancy_moves_page($1,null,25,0) as value',
        [fixture.society],
      ),
    );
    return tenancyPageSchema.parse(result.rows[0]!.value);
  };
  const upload = async (
    moveId: string,
    actor: Actor = 'owner',
    kind = 'rental_agreement',
    metadata = { mimetype: 'application/pdf', size: 1024 },
  ) => {
    const path = `${fixture.society}/moves/${moveId}/${kind}/${crypto.randomUUID()}.pdf`;
    await asActor(actor, (client) =>
      client.query(
        `insert into storage.objects(bucket_id,name,metadata) values('tenancy-files',$1,$2)`,
        [path, metadata],
      ),
    );
    return path;
  };
  const attach = async (
    moveId: string,
    actor: Actor = 'owner',
    kind = 'rental_agreement',
    metadata = { mimetype: 'application/pdf', size: 1024 },
  ) => {
    const path = await upload(moveId, actor, kind, metadata);
    const expectedVersion = await version(moveId);
    const attached = await asActor(actor, (client) =>
      client.query<{ id: string }>(
        'select public.tenancy_document_attach($1,$2,$3,$4,$5,$6) as id',
        [
          fixture.society,
          moveId,
          kind,
          path,
          expectedVersion,
          crypto.randomUUID(),
        ],
      ),
    );
    return { path, id: attached.rows[0]!.id };
  };
  const consent = async (moveId: string, actor: Actor = 'owner') =>
    asActor(actor, async (client) =>
      client.query('select public.tenancy_move_consent($1,$2,$3,$4)', [
        fixture.society,
        moveId,
        await version(moveId),
        crypto.randomUUID(),
      ]),
    );
  const decide = async (
    moveId: string,
    decision = 'approved',
    actor: Actor = 'admin',
    expectedVersion?: number,
  ) => {
    const currentVersion = expectedVersion ?? (await version(moveId));
    return asActor(actor, (client) =>
      client.query('select public.tenancy_move_decide($1,$2,$3,$4,$5,$6)', [
        fixture.society,
        moveId,
        decision,
        currentVersion,
        decision === 'approved' ? null : 'Synthetic change of plans',
        crypto.randomUUID(),
      ]),
    );
  };
  const complete = async (
    moveId: string,
    actor: Actor = 'admin',
    expectedVersion?: number,
  ) => {
    const currentVersion = expectedVersion ?? (await version(moveId));
    return asActor(actor, (client) =>
      client.query('select public.tenancy_move_complete($1,$2,$3,$4)', [
        fixture.society,
        moveId,
        currentVersion,
        crypto.randomUUID(),
      ]),
    );
  };
  const makeWindowCurrent = (moveId: string) =>
    database.asSuperuser((client) =>
      client.query(
        `update public.tenancy_moves set starts_at=clock_timestamp()-interval '1 minute',
        ends_at=clock_timestamp()+interval '1 hour' where id=$1`,
        [moveId],
      ),
    );
  const completedMoveOut = async () => {
    const move = await create('move_out', 'tenant');
    await decide(move);
    await makeWindowCurrent(move);
    await complete(move);
    return move;
  };
  const prepareNoc = async (moveId: string, actor: Actor = 'admin') => {
    const expectedVersion = await version(moveId);
    const result = await asActor(actor, (client) =>
      client.query<{ value: unknown }>(
        'select public.tenancy_noc_prepare($1,$2,$3,$4) as value',
        [fixture.society, moveId, expectedVersion, crypto.randomUUID()],
      ),
    );
    const preparation = tenancyNocPreparationSchema.parse(
      result.rows[0]!.value,
    );
    if (preparation.status !== 'prepared') {
      throw new Error('Expected a new synthetic NOC preparation.');
    }
    return preparation;
  };
  const uploadNoc = async (
    path: string,
    actor: Actor = 'admin',
    verified = true,
  ) => {
    const result = await asActor(actor, (client) =>
      client.query(
        `insert into storage.objects(bucket_id,name,metadata)
         values('tenancy-files',$1,'{"mimetype":"application/pdf","size":2048}')`,
        [path],
      ),
    );
    if (verified) {
      const moveId = path.split('/')[2];
      if (!moveId) throw new Error('Missing synthetic NOC move.');
      const expectedVersion = await version(moveId);
      await service((client) =>
        client.query('select public.tenancy_noc_attest($1,$2,$3,$4,$5,$6)', [
          fixture.society,
          moveId,
          requireId(users, actor),
          path,
          expectedVersion,
          crypto.randomUUID(),
        ]),
      );
    }
    return result;
  };
  const issueNoc = (
    moveId: string,
    preparation: { path: string; expected_version: number },
    actor: Actor = 'admin',
  ) =>
    asActor(actor, (client) =>
      client.query<{ id: string }>(
        'select public.tenancy_noc_issue($1,$2,$3,$4,$5) as id',
        [
          fixture.society,
          moveId,
          preparation.path,
          preparation.expected_version,
          crypto.randomUUID(),
        ],
      ),
    );
  const service = <T>(run: (client: Client) => Promise<T>) =>
    database.asRole('service_role', null, run, { commit: true });
  return {
    database,
    users,
    memberships,
    asActor,
    create,
    detail,
    page,
    upload,
    attach,
    version,
    consent,
    decide,
    complete,
    makeWindowCurrent,
    completedMoveOut,
    prepareNoc,
    uploadNoc,
    issueNoc,
    service,
    ...fixture,
  };
}

async function withFixture(
  run: (fixture: Awaited<ReturnType<typeof createFixture>>) => Promise<void>,
) {
  const database = await createTestDatabase();
  try {
    await run(await createFixture(database));
  } finally {
    await database.drop();
  }
}

async function raceWithHeldTransaction(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  first: (client: Client) => Promise<unknown>,
  second: () => Promise<unknown>,
  firstIdentity: 'admin' | 'database' = 'admin',
) {
  const started = Promise.withResolvers<void>();
  const runFirst =
    firstIdentity === 'database'
      ? <T>(run: (client: Client) => Promise<T>) =>
          fixture.database.asSuperuser(async (client) => {
            await client.query('begin');
            try {
              const value = await run(client);
              await client.query('commit');
              return value;
            } catch (error) {
              await client.query('rollback');
              throw error;
            }
          })
      : <T>(run: (client: Client) => Promise<T>) =>
          fixture.asActor('admin', run);
  const firstRun = runFirst(async (client) => {
    await first(client);
    started.resolve();
    await expect
      .poll(
        async () =>
          (
            await fixture.database.asSuperuser((observer) =>
              observer.query<{ blocked: boolean }>(
                `select exists(select 1 from pg_stat_activity where datname=current_database()
                   and wait_event_type='Lock') as blocked`,
              ),
            )
          ).rows[0]!.blocked,
        { timeout: 5000 },
      )
      .toBe(true);
  }).catch((error: unknown) => {
    started.reject(error);
    throw error;
  });
  return Promise.allSettled([firstRun, started.promise.then(second)]);
}

describe.skipIf(!hasDatabase)('database tenancy moves', () => {
  it('limits move targets to admins, owned units and the current tenant, never status-only readers', async () => {
    await withFixture(async (f) => {
      const workspace = async (actor: Actor, targets = true) => {
        const result = await f.asActor(actor, (client) =>
          client.query<{ value: unknown }>(
            'select public.tenancy_workspace_get($1,$2) as value',
            [f.society, targets],
          ),
        );
        return tenancyWorkspaceSchema.parse(result.rows[0]!.value);
      };
      const admin = await workspace('admin');
      expect(admin.can_manage).toBe(true);
      expect(admin.units.map((unit) => unit.number)).toEqual([
        'A-101',
        'B-201',
        'C-301',
      ]);
      expect(admin.tenants.map((tenant) => tenant.id).sort()).toEqual(
        (['owner', 'coOwner', 'otherResident', 'tenant', 'newTenant'] as const)
          .map((actor) => requireId(f.memberships, actor))
          .sort(),
      );
      const owner = await workspace('owner');
      expect(owner.units.map((unit) => unit.number)).toEqual(['A-101']);
      expect(owner.tenants.map((tenant) => tenant.id)).toEqual([
        requireId(f.memberships, 'newTenant'),
      ]);
      const tenant = await workspace('tenant');
      expect(tenant.units.map((unit) => unit.number)).toEqual(['B-201']);
      expect(tenant.tenants.map((member) => member.id)).toEqual([
        requireId(f.memberships, 'tenant'),
      ]);
      expect(tenant.occupancies).toHaveLength(1);
      expect((await workspace('otherResident')).tenants).toEqual([]);
      for (const actor of ['committee', 'guard'] as const) {
        expect(await workspace(actor)).toMatchObject({
          can_manage: false,
          can_create: false,
          units: [],
          tenants: [],
          occupancies: [],
          bookings: [],
        });
      }
      expect(await workspace('admin', false)).toMatchObject({
        units: [],
        tenants: [],
        occupancies: [],
        bookings: [],
      });
      for (const actor of ['supervisor', 'foreignAdmin'] as const) {
        expect(await dbError(workspace(actor))).toMatchObject({
          code: '42501',
        });
      }
      await f.asActor('newTenant', (client) =>
        client.query('select public.claim_memberships()'),
      );
      expect(
        (await workspace('newTenant')).tenants.map((member) => member.id),
      ).toEqual([requireId(f.memberships, 'newTenant')]);
      await f.database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled=false where society_id=$1 and module_key='tenancy'`,
          [f.society],
        ),
      );
      expect(await dbError(workspace('admin'))).toMatchObject({
        code: '42501',
      });
    });
  });

  it('scopes proof upload paths to the current tenant/owner/admin and validates exact file limits', async () => {
    await withFixture(async (f) => {
      const move = await f.create();
      await f.asActor('newTenant', (client) =>
        client.query('select public.claim_memberships()'),
      );
      const path = (actor: Actor, kind = 'rental_agreement', size = 5242880) =>
        f.asActor(actor, (client) =>
          client.query<{ path: string }>(
            `select public.tenancy_proof_upload_path($1,$2,$3,'application/pdf',$4) as path`,
            [f.society, move, kind, size],
          ),
        );
      for (const actor of ACTORS) {
        if (
          ['admin', 'adminTwo', 'owner', 'coOwner', 'newTenant'].includes(actor)
        ) {
          expect((await path(actor)).rows[0]!.path).toMatch(
            new RegExp(
              `^${f.society}/moves/${move}/rental_agreement/[0-9a-f-]+\\.pdf$`,
            ),
          );
        } else {
          expect(await dbError(path(actor))).toMatchObject({
            code: ['tenant', 'otherResident'].includes(actor)
              ? 'P0002'
              : '42501',
          });
        }
      }
      for (const size of [0, 5242881]) {
        expect(
          await dbError(path('owner', 'rental_agreement', size)),
        ).toMatchObject({ code: '22023' });
      }
      expect(await dbError(path('owner', 'noc'))).toMatchObject({
        code: '22023',
      });
      await f.attach(move);
      expect(await dbError(path('owner'))).toMatchObject({ code: 'P0002' });
      await f.decide(move, 'cancelled');
      expect(await dbError(path('owner', 'police_verification'))).toMatchObject(
        { code: 'P0002' },
      );
    });
  });

  it('waits for a valid in-flight attachment before classifying a newly aged file as orphaned', async () => {
    await withFixture(async (f) => {
      const move = await f.create();
      const path = await f.upload(move);
      const version = await f.version(move);
      const results = await raceWithHeldTransaction(
        f,
        async (client) => {
          await client.query(
            `select public.tenancy_document_attach($1,$2,'rental_agreement',$3,$4,$5)`,
            [f.society, move, path, version, crypto.randomUUID()],
          );
          await f.database.asSuperuser((clock) =>
            clock.query(
              `update storage.objects set created_at=clock_timestamp()-interval '25 hours'
               where bucket_id='tenancy-files' and name=$1`,
              [path],
            ),
          );
        },
        () =>
          f.service((client) =>
            client.query(
              `select * from public.tenancy_retention_files_list(
                (now() at time zone 'Asia/Kolkata')::date
              )`,
            ),
          ),
      );
      expect(results[0]).toMatchObject({ status: 'fulfilled' });
      expect(results[1]).toMatchObject({
        status: 'fulfilled',
        value: { rows: [] },
      });
      expect(
        (await f.detail(move)).documents.map((document) => document.path),
      ).toEqual([path]);
    });
  });

  it('denies direct issuance or client attestation of an unverified NOC PDF', async () => {
    await withFixture(async (f) => {
      const move = await f.completedMoveOut();
      const prepared = await f.prepareNoc(move);
      await f.uploadNoc(prepared.path, 'admin', false);
      expect(await dbError(f.issueNoc(move, prepared))).toMatchObject({
        code: '42501',
      });
      for (const actor of ['admin', 'owner', 'foreignAdmin'] as const) {
        expect(
          await dbError(
            f.asActor(actor, (client) =>
              client.query(
                'select public.tenancy_noc_attest($1,$2,$3,$4,$5,$6)',
                [
                  f.society,
                  move,
                  requireId(f.users, 'admin'),
                  prepared.path,
                  prepared.expected_version,
                  crypto.randomUUID(),
                ],
              ),
            ),
          ),
        ).toMatchObject({ code: '42501' });
      }
      await f.asActor('admin', async (client) => {
        expect(
          (
            await client.query(
              `update storage.objects set metadata='{"mimetype":"application/pdf","size":1}'
           where bucket_id='tenancy-files' and name=$1`,
              [prepared.path],
            )
          ).rowCount,
        ).toBe(0);
        expect(
          (
            await client.query(
              `delete from storage.objects where bucket_id='tenancy-files' and name=$1`,
              [prepared.path],
            )
          ).rowCount,
        ).toBe(0);
      });
      expect((await f.detail(move)).documents).toEqual([]);
    });
  });

  it('serializes completion with Core resident-role removal before granting access', async () => {
    await withFixture(async (f) => {
      const move = await f.create();
      await f.attach(move);
      await f.consent(move);
      await f.decide(move);
      await f.asActor('newTenant', (client) =>
        client.query('select public.claim_memberships()'),
      );
      await f.makeWindowCurrent(move);
      const results = await raceWithHeldTransaction(
        f,
        (client) =>
          client.query(
            `select public.change_member_roles($1,$2,array['guard']::text[],$3)`,
            [
              f.society,
              requireId(f.memberships, 'newTenant'),
              crypto.randomUUID(),
            ],
          ),
        () => f.complete(move, 'adminTwo'),
      );
      expect(results[0]).toMatchObject({ status: 'fulfilled' });
      expect(results[1]).toMatchObject({
        status: 'rejected',
        reason: { code: '23514' },
      });
      const occupancy = await f.database.asSuperuser((client) =>
        client.query<{ status: string }>(
          'select status from public.unit_occupants where id=$1',
          [requireId(f.occupancies, 'newTenant')],
        ),
      );
      expect(occupancy.rows[0]!.status).toBe('pending');
    });
  });

  it.each([true, false])(
    'serializes proof attachment with Core ending (attachment first: %s)',
    async (attachmentFirst) => {
      await withFixture(async (f) => {
        const move = await f.create();
        const path = await f.upload(move);
        const version = await f.version(move);
        const attach = (client: Client) =>
          client.query(
            `select public.tenancy_document_attach($1,$2,'rental_agreement',$3,$4,$5)`,
            [f.society, move, path, version, crypto.randomUUID()],
          );
        const end = (client: Client) =>
          client.query(
            'select public.end_unit_occupancy($1,$2,current_date,$3)',
            [
              f.society,
              requireId(f.occupancies, 'newTenant'),
              crypto.randomUUID(),
            ],
          );
        const results = await raceWithHeldTransaction(
          f,
          attachmentFirst ? attach : end,
          () => f.asActor('adminTwo', attachmentFirst ? end : attach),
        );
        expect(results[0]).toMatchObject({ status: 'fulfilled' });
        expect(results[1]).toMatchObject(
          attachmentFirst
            ? { status: 'fulfilled' }
            : { status: 'rejected', reason: { code: '42501' } },
        );
        const documents = await f.database.asSuperuser((client) =>
          client.query<{ retained: boolean }>(
            `select purge_after is not null as retained from public.tenancy_documents where move_id=$1`,
            [move],
          ),
        );
        expect(documents.rows).toEqual(
          attachmentFirst ? [{ retained: true }] : [],
        );
        expect(await dbError(f.upload(move))).toMatchObject({ code: '42501' });
      });
    },
  );

  it('issues an admin-bound NOC once, records unchecked dues honestly and enforces the retention deadline', async () => {
    await withFixture(async (f) => {
      const move = await f.create('move_out', 'tenant');
      expect(await dbError(f.prepareNoc(move))).toMatchObject({
        code: '23514',
      });
      await f.decide(move);
      await f.makeWindowCurrent(move);
      await f.complete(move);
      for (const actor of ['tenant', 'owner', 'committee', 'guard'] as const) {
        expect(await dbError(f.prepareNoc(move, actor))).toMatchObject({
          code: '42501',
        });
      }
      const prepared = await f.prepareNoc(move);
      expect(prepared.snapshot).toMatchObject({
        society_name: 'Tenancy A',
        tenant_name: 'Synthetic tenant',
        unit_number: 'B-201',
        issuer_name: 'Synthetic admin',
        dues: { status: 'not_checked', checked_at: null, balance_paise: null },
      });
      expect(await f.prepareNoc(move)).toEqual(prepared);
      expect(
        await dbError(f.uploadNoc(prepared.path, 'adminTwo')),
      ).toMatchObject({
        code: '42501',
      });
      expect(
        await dbError(
          f.uploadNoc(
            `${f.society}/moves/${move}/noc/${crypto.randomUUID()}.pdf`,
          ),
        ),
      ).toMatchObject({ code: '42501' });
      expect(await dbError(f.issueNoc(move, prepared))).toMatchObject({
        code: '22023',
      });
      await f.uploadNoc(prepared.path);
      const issued = (await f.issueNoc(move, prepared)).rows[0]!.id;
      expect((await f.issueNoc(move, prepared)).rows[0]!.id).toBe(issued);
      const document = await f.database.asSuperuser((client) =>
        client.query<{
          dues_status: string;
          dues_checked_at: string | null;
          has_deadline: boolean;
          preparation_cleared: boolean;
        }>(
          `select document.dues_status,document.dues_checked_at,
           document.purge_after>now()+interval '364 days' as has_deadline,
           move.noc_prepared_snapshot is null as preparation_cleared
           from public.tenancy_documents document join public.tenancy_moves move on move.id=document.move_id
           where document.id=$1`,
          [issued],
        ),
      );
      expect(document.rows[0]).toEqual({
        dues_status: 'not_checked',
        dues_checked_at: null,
        has_deadline: true,
        preparation_cleared: true,
      });
      const detail = await f.detail(move, 'tenant');
      expect(detail.documents.map((file) => file.kind)).toEqual(['noc']);
      expect(
        detail.events.filter((event) => event.action === 'noc_issued'),
      ).toHaveLength(1);
      await f.database.asSuperuser((client) =>
        client.query(
          `update public.unit_occupants set started_at=(current_date-interval '2 years')::date,
           ended_at=(current_date-interval '1 year')::date where id=$1`,
          [requireId(f.occupancies, 'tenant')],
        ),
      );
      expect(await dbError(f.prepareNoc(move))).toMatchObject({
        code: '23514',
      });
      expect(await dbError(f.issueNoc(move, prepared))).toMatchObject({
        code: '23514',
      });
      expect((await f.detail(move, 'tenant')).documents).toHaveLength(0);
    });
  });

  it('serializes NOC issuance with new ledger charges and refuses a changed Billing snapshot', async () => {
    await withFixture(async (f) => {
      const move = await f.completedMoveOut();
      await f.database.asSuperuser(async (client) => {
        await client.query(
          `update public.module_configs set enabled=true where society_id=$1 and module_key='billing'`,
          [f.society],
        );
        await client.query(
          `insert into public.billing_ledger_entries(society_id,unit_id,kind,direction,amount_paise,reason,created_by)
           values($1,$2,'adjustment','debit',10000,'Synthetic dues',$3)`,
          [f.society, f.unit('B-201'), requireId(f.users, 'admin')],
        );
      });
      expect(await dbError(f.prepareNoc(move))).toMatchObject({
        code: '23514',
      });
      await f.database.asSuperuser((client) =>
        client.query(
          `insert into public.billing_ledger_entries(society_id,unit_id,kind,direction,amount_paise,reason,created_by)
           values($1,$2,'adjustment','credit',10000,'Synthetic settlement',$3)`,
          [f.society, f.unit('B-201'), requireId(f.users, 'admin')],
        ),
      );
      const prepared = await f.prepareNoc(move);
      expect(prepared.snapshot.dues).toMatchObject({
        status: 'cleared',
        balance_paise: '0',
        checked_at: expect.any(String),
      });
      await f.uploadNoc(prepared.path);
      const results = await raceWithHeldTransaction(
        f,
        (client) =>
          client.query(
            `insert into public.billing_ledger_entries(society_id,unit_id,kind,direction,amount_paise,reason,created_by)
             values($1,$2,'adjustment','debit',100,'Synthetic concurrent charge',$3)`,
            [f.society, f.unit('B-201'), requireId(f.users, 'admin')],
          ),
        () => f.issueNoc(move, prepared, 'admin'),
        'database',
      );
      expect(results[0]).toMatchObject({ status: 'fulfilled' });
      expect(results[1]).toMatchObject({
        status: 'rejected',
        reason: { code: '23514' },
      });
      expect((await f.detail(move)).documents).toHaveLength(0);
      await f.database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled=false where society_id=$1 and module_key='billing'`,
          [f.society],
        ),
      );
      expect(await dbError(f.issueNoc(move, prepared))).toMatchObject({
        code: '23505',
      });
      const unchecked = await f.prepareNoc(move);
      expect(unchecked.path).not.toBe(prepared.path);
      expect(unchecked.snapshot.dues.status).toBe('not_checked');
      await f.uploadNoc(unchecked.path);
      await f.issueNoc(move, unchecked);
      expect((await f.detail(move)).documents.map((file) => file.kind)).toEqual(
        ['noc'],
      );
    });
  });

  it('expires abandoned NOC preparations instead of allowing an old PDF to be issued', async () => {
    await withFixture(async (f) => {
      const move = await f.completedMoveOut();
      const prepared = await f.prepareNoc(move);
      await f.uploadNoc(prepared.path);
      await f.database.asSuperuser((client) =>
        client.query(
          `update public.tenancy_moves set noc_prepared_at=clock_timestamp()-interval '11 minutes' where id=$1`,
          [move],
        ),
      );
      expect(await dbError(f.issueNoc(move, prepared))).toMatchObject({
        code: '23505',
      });
      const refreshed = await f.prepareNoc(move);
      expect(refreshed.path).not.toBe(prepared.path);
      expect(refreshed.expected_version).toBeGreaterThan(
        prepared.expected_version,
      );
      expect((await f.detail(move)).documents).toHaveLength(0);
    });
  });

  it('deduplicates in-app 30/7/0-day reminders for active owners and admins only', async () => {
    await withFixture(async (f) => {
      const move = await f.create();
      await f.attach(move);
      await f.consent(move);
      await f.decide(move);
      await f.asActor('newTenant', (client) =>
        client.query('select public.claim_memberships()'),
      );
      await f.makeWindowCurrent(move);
      await f.complete(move);
      const run = async () =>
        (
          await f.service((client) =>
            client.query<{ count: number }>(
              'select public.tenancy_reminders_run($1,$2) as count',
              [f.society, crypto.randomUUID()],
            ),
          )
        ).rows[0]!.count;
      await f.database.asSuperuser((client) =>
        client.query(
          `update public.tenancy_moves set agreement_expires_on=private.housekeeping_local_date($2)+30 where id=$1;
           `,
          [move, f.society],
        ),
      );
      for (const actor of ['admin', 'owner', 'guard'] as const) {
        expect(
          await dbError(
            f.asActor(actor, (client) =>
              client.query('select public.tenancy_reminders_run($1,$2)', [
                f.society,
                crypto.randomUUID(),
              ]),
            ),
          ),
        ).toMatchObject({ code: '42501' });
      }
      expect(await run()).toBe(4);
      expect(await run()).toBe(0);
      for (const days of [7, 0]) {
        await f.database.asSuperuser((client) =>
          client.query(
            `update public.tenancy_moves set agreement_expires_on=private.housekeeping_local_date($2)+$3::integer where id=$1`,
            [move, f.society, days],
          ),
        );
        expect(await run()).toBe(4);
        expect(await run()).toBe(0);
      }
      const recipients = await f.database.asSuperuser((client) =>
        client.query<{ user_id: string; entity_type: string }>(
          `select distinct user_id,entity_type from public.notifications where society_id=$1 and type='tenancy_expiry'`,
          [f.society],
        ),
      );
      expect(recipients.rows.map((row) => row.user_id).sort()).toEqual(
        (['admin', 'adminTwo', 'owner', 'coOwner'] as const)
          .map((actor) => requireId(f.users, actor))
          .sort(),
      );
      await f.database.asSuperuser(async (client) => {
        await client.query(
          `update public.module_configs set enabled=false where society_id=$1 and module_key='tenancy'`,
          [f.society],
        );
        await client.query(
          `update public.tenancy_moves set last_expiry_reminder_days=null where id=$1`,
          [move],
        );
      });
      expect(await run()).toBe(0);
    });
  });

  it('removes expired and orphan files before marking documents deleted, even with Tenancy disabled', async () => {
    await withFixture(async (f) => {
      const move = await f.create();
      const proof = await f.attach(move);
      const orphan = await f.upload(move, 'owner', 'police_verification');
      await f.database.asSuperuser((client) =>
        client.query(
          `update storage.objects set created_at=clock_timestamp()-interval '25 hours' where bucket_id='tenancy-files' and name=$1`,
          [orphan],
        ),
      );
      const currentVersion = await f.version(move);
      expect(
        await dbError(
          f.asActor('owner', (client) =>
            client.query(
              `select public.tenancy_document_attach($1,$2,'police_verification',$3,$4,$5)`,
              [f.society, move, orphan, currentVersion, crypto.randomUUID()],
            ),
          ),
        ),
      ).toMatchObject({ code: 'P0002' });
      await f.decide(move, 'cancelled');
      const moveOut = await f.completedMoveOut();
      const prepared = await f.prepareNoc(moveOut);
      await f.uploadNoc(prepared.path);
      await f.issueNoc(moveOut, prepared);
      const futureFiles = await f.service((client) =>
        client.query<{ path: string }>(
          `select * from public.tenancy_retention_files_list(current_date+10000)`,
        ),
      );
      expect(futureFiles.rows.map((file) => file.path)).toEqual([orphan]);
      await f.database.asSuperuser(async (client) => {
        await client.query(
          `update public.tenancy_documents set purge_after=clock_timestamp()-interval '1 second' where id=$1`,
          [proof.id],
        );
        await client.query(
          `update public.unit_occupants set started_at=(current_date-interval '2 years')::date,
           ended_at=(current_date-interval '1 year')::date where id=$1`,
          [requireId(f.occupancies, 'tenant')],
        );
        await client.query(
          `update public.module_configs set enabled=false where society_id=$1 and module_key='tenancy'`,
          [f.society],
        );
      });
      const list = async () =>
        (
          await f.service((client) =>
            client.query<{ bucket: string; path: string }>(
              `select * from public.tenancy_retention_files_list((clock_timestamp() at time zone 'Asia/Kolkata')::date)`,
            ),
          )
        ).rows;
      const purge = async () =>
        (
          await f.service((client) =>
            client.query<{
              value: {
                documents_deleted: number;
                preparations_cleared: number;
              };
            }>(
              `select public.tenancy_retention_run((clock_timestamp() at time zone 'Asia/Kolkata')::date,$1) as value`,
              [crypto.randomUUID()],
            ),
          )
        ).rows[0]!.value;
      expect((await list()).map((file) => file.path).sort()).toEqual(
        [proof.path, orphan, prepared.path].sort(),
      );
      expect((await purge()).documents_deleted).toBe(0);
      await f.service((client) =>
        client.query(
          `delete from storage.objects where bucket_id='tenancy-files' and name=any($1::text[])`,
          [[proof.path, orphan, prepared.path]],
        ),
      );
      expect(await purge()).toEqual({
        documents_deleted: 2,
        preparations_cleared: 0,
      });
      expect(await list()).toEqual([]);
      expect((await purge()).documents_deleted).toBe(0);
      const history = await f.database.asSuperuser((client) =>
        client.query<{ moves: number; occupancies: number; events: number }>(
          `select (select count(*)::int from public.tenancy_moves) as moves,
           (select count(*)::int from public.unit_occupants) as occupancies,
           (select count(*)::int from public.tenancy_events) as events`,
        ),
      );
      expect(history.rows[0]).toMatchObject({
        moves: 2,
        occupancies: 5,
        events: expect.any(Number),
      });
      expect(history.rows[0]!.events).toBeGreaterThan(0);
    });
  });

  it('reuses invitations, needs one owner consent, schedules first and activates only on actual completion', async () => {
    await withFixture(async (f) => {
      const clientId = crypto.randomUUID();
      const move = await f.create('move_in', 'admin', clientId);
      expect(await f.create('move_in', 'admin', clientId)).toBe(move);
      expect(await dbError(f.create())).toMatchObject({ code: '23505' });
      expect(await dbError(f.decide(move))).toMatchObject({ code: '23505' });
      await f.attach(move);
      await f.consent(move, 'coOwner');
      await f.decide(move);
      const scheduled = await f.detail(move);
      expect(scheduled.move.status).toBe('approved');
      expect(scheduled.owner_consent_valid).toBe(true);
      expect(await dbError(f.complete(move))).toMatchObject({ code: '23514' });
      await f.asActor('newTenant', (client) =>
        client.query('select public.claim_memberships()'),
      );
      const pending = await f.database.asSuperuser((client) =>
        client.query<{ status: string }>(
          'select status from public.unit_occupants where id=$1',
          [requireId(f.occupancies, 'newTenant')],
        ),
      );
      expect(pending.rows[0]!.status).toBe('pending');
      await f.makeWindowCurrent(move);
      await f.complete(move);
      await f.complete(move, 'admin', 1);
      const final = await f.detail(move, 'newTenant');
      expect(final.move.status).toBe('completed');
      const occupancy = await f.database.asSuperuser((client) =>
        client.query<{
          status: string;
          is_primary: boolean;
          correct_start: boolean;
        }>(
          `select status,is_primary,started_at=(clock_timestamp() at time zone 'Asia/Kolkata')::date as correct_start
         from public.unit_occupants where id=$1`,
          [requireId(f.occupancies, 'newTenant')],
        ),
      );
      expect(occupancy.rows[0]).toMatchObject({
        status: 'active',
        is_primary: false,
        correct_start: true,
      });
      expect(
        final.events.filter((event) => event.action === 'completed'),
      ).toHaveLength(1);
      expect((await f.page('guard')).items[0]!.can_view_details).toBe(false);
    });
  });

  it('denies unrelated targets, consent bypasses, unauthorised roles and cross-society access', async () => {
    await withFixture(async (f) => {
      for (const actor of [
        'committee',
        'guard',
        'supervisor',
        'foreignAdmin',
      ] as const) {
        expect(await dbError(f.create('move_in', actor))).toMatchObject({
          code: '42501',
        });
      }
      expect(await dbError(f.create('move_in', 'otherResident'))).toMatchObject(
        { code: 'P0002' },
      );
      const move = await f.create();
      for (const actor of [
        'admin',
        'committee',
        'guard',
        'supervisor',
      ] as const) {
        expect(await dbError(f.consent(move, actor))).toMatchObject({
          code: '42501',
        });
      }
      expect(await dbError(f.consent(move, 'otherResident'))).toMatchObject({
        code: 'P0002',
      });
      for (const actor of [
        'owner',
        'committee',
        'guard',
        'supervisor',
      ] as const) {
        expect(await dbError(f.decide(move, 'approved', actor))).toMatchObject({
          code: '42501',
        });
        expect(await dbError(f.complete(move, actor))).toMatchObject({
          code: '42501',
        });
      }
      expect((await f.page('otherResident')).total).toBe(0);
      expect(await dbError(f.detail(move, 'otherResident'))).toMatchObject({
        code: 'P0002',
      });
      expect(await dbError(f.detail(move, 'foreignAdmin'))).toMatchObject({
        code: '42501',
      });
      expect(await dbError(f.decide(move, 'cancelled', 'owner'))).toMatchObject(
        { code: 'P0002' },
      );
      const attached = await f.attach(move);
      for (const actor of [
        'committee',
        'guard',
        'otherResident',
        'foreignAdmin',
      ] as const) {
        const files = await f.asActor(actor, (client) =>
          client.query(
            'select name from storage.objects where bucket_id=$1 and name=$2',
            ['tenancy-files', attached.path],
          ),
        );
        expect(files.rows).toHaveLength(0);
      }
      expect(await dbError(f.detail(move, 'committee'))).toMatchObject({
        code: '42501',
      });
      const status = (await f.page('committee')).items[0]!;
      expect(Object.keys(status).sort()).toEqual([
        'can_view_details',
        'ends_at',
        'id',
        'kind',
        'starts_at',
        'status',
        'unit_id',
        'unit_number',
        'version',
      ]);
      expect(status.can_view_details).toBe(false);
      expect((await f.page('guard')).total).toBe(0);
    });
  });

  it('checks private proof metadata and society policy before consent and approval', async () => {
    await withFixture(async (f) => {
      const move = await f.create();
      expect(await dbError(f.consent(move))).toMatchObject({ code: '23514' });
      expect(
        await dbError(
          f.attach(move, 'owner', 'rental_agreement', {
            mimetype: 'application/pdf',
            size: 5242881,
          }),
        ),
      ).toMatchObject({ code: '22023' });
      await f.attach(move);
      await f.asActor('admin', (client) =>
        client.query('select public.tenancy_settings_update($1,true,$2)', [
          f.society,
          crypto.randomUUID(),
        ]),
      );
      expect(await dbError(f.consent(move))).toMatchObject({ code: '23514' });
      await f.attach(move, 'owner', 'police_verification');
      await f.consent(move);
      await f.decide(move);
      expect((await f.detail(move)).documents).toHaveLength(2);
      const duplicate = await dbError(f.attach(move));
      expect(duplicate.code).toBe('42501');
      expect(
        await dbError(
          f.database.asSuperuser((client) =>
            client.query(
              `update public.module_configs set settings='{"aadhaar_required":true}'
         where society_id=$1 and module_key='tenancy'`,
              [f.society],
            ),
          ),
        ),
      ).toMatchObject({ code: '23514' });
    });
  });

  it('rechecks live ownership and prevents stale or competing decisions', async () => {
    await withFixture(async (f) => {
      const move = await f.create();
      await f.attach(move);
      await f.consent(move);
      const oldVersion = await f.version(move);
      const results = await Promise.allSettled([
        f.decide(move, 'approved', 'admin', oldVersion),
        f.decide(move, 'approved', 'adminTwo', oldVersion),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const current = await f.detail(move);
      expect(
        current.events.filter((event) =>
          ['approved', 'rejected'].includes(event.action),
        ),
      ).toHaveLength(1);
      await f.database.asSuperuser((client) =>
        client.query(
          `update public.unit_occupants set status='ended',ended_at=current_date where id=$1`,
          [requireId(f.occupancies, 'owner')],
        ),
      );
      await f.makeWindowCurrent(move);
      expect(await dbError(f.complete(move))).toMatchObject({ code: '23514' });
      expect((await f.detail(move)).owner_consent_valid).toBe(false);
    });
  });

  it('blocks Core activation bypasses but preserves module-off assignment and registration', async () => {
    await withFixture(async (f) => {
      expect(
        await dbError(
          f.asActor('admin', (client) =>
            client.query(
              `select public.assign_unit_occupant($1,$2,$3,'tenant',false,true,current_date,$4)`,
              [
                f.society,
                f.unit('C-301'),
                requireId(f.memberships, 'tenant'),
                crypto.randomUUID(),
              ],
            ),
          ),
        ),
      ).toMatchObject({ code: '23514' });
      await f.database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled=false where society_id=$1 and module_key='tenancy'`,
          [f.society],
        ),
      );
      await f.asActor('admin', (client) =>
        client.query(
          `select public.assign_unit_occupant($1,$2,$3,'tenant',false,true,current_date,$4)`,
          [
            f.society,
            f.unit('C-301'),
            requireId(f.memberships, 'tenant'),
            crypto.randomUUID(),
          ],
        ),
      );
      await f.asActor('newTenant', (client) =>
        client.query('select public.claim_memberships()'),
      );
      const activated = await f.database.asSuperuser((client) =>
        client.query<{ status: string }>(
          'select status from public.unit_occupants where id=$1',
          [requireId(f.occupancies, 'newTenant')],
        ),
      );
      expect(activated.rows[0]!.status).toBe('active');
      expect(await dbError(f.page('admin'))).toMatchObject({ code: '42501' });
      expect(await dbError(f.create())).toMatchObject({ code: '42501' });
    });
  });

  it('blocks positive authoritative dues and ends Core/directory atomically when Billing is off', async () => {
    await withFixture(async (f) => {
      await f.database.asSuperuser((client) =>
        client.query(
          `insert into public.directory_vehicles
          (society_id,unit_id,membership_id,vehicle_type,registration_number,created_by,client_request_id)
         values($1,$2,$3,'car','MH01AB1234',$4,$5)`,
          [
            f.society,
            f.unit('B-201'),
            requireId(f.memberships, 'tenant'),
            requireId(f.users, 'tenant'),
            crypto.randomUUID(),
          ],
        ),
      );
      const move = await f.create('move_out', 'tenant');
      await f.decide(move);
      await f.makeWindowCurrent(move);
      await f.database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled=true where society_id=$1 and module_key='billing';
         `,
          [f.society],
        ),
      );
      await f.database.asSuperuser((client) =>
        client.query(
          `insert into public.billing_ledger_entries(society_id,unit_id,kind,direction,amount_paise,reason,created_by)
         values($1,$2,'adjustment','debit',10000,'Synthetic outstanding dues',$3)`,
          [f.society, f.unit('B-201'), requireId(f.users, 'admin')],
        ),
      );
      expect((await f.detail(move)).dues).toMatchObject({
        status: 'pending',
        balance_paise: '10000',
      });
      expect(await dbError(f.complete(move))).toMatchObject({ code: '23514' });
      await f.database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled=false where society_id=$1 and module_key in ('billing','directory')`,
          [f.society],
        ),
      );
      expect((await f.detail(move)).dues).toEqual({
        status: 'not_checked',
        balance_paise: null,
        checked_at: null,
      });
      await f.complete(move);
      const lifecycle = await f.database.asSuperuser((client) =>
        client.query<{
          occupancy_status: string;
          vehicle_status: string;
          has_retention: boolean;
        }>(
          `select occupant.status as occupancy_status,vehicle.status as vehicle_status,
          vehicle.purge_after is not null as has_retention
         from public.unit_occupants occupant join public.directory_vehicles vehicle
          on vehicle.membership_id=occupant.membership_id and vehicle.unit_id=occupant.unit_id
         where occupant.id=$1`,
          [requireId(f.occupancies, 'tenant')],
        ),
      );
      expect(lifecycle.rows[0]).toEqual({
        occupancy_status: 'ended',
        vehicle_status: 'inactive',
        has_retention: true,
      });
    });
  });

  it('keeps state/history private and append-only and schedules cancellation file retention', async () => {
    await withFixture(async (f) => {
      const move = await f.create('move_in', 'owner');
      await f.attach(move);
      await f.decide(move, 'cancelled', 'owner');
      await f.decide(move, 'cancelled', 'owner', 1);
      const retained = await f.database.asSuperuser((client) =>
        client.query<{
          scheduled: boolean;
          events: number;
        }>(
          `select purge_after>now()+interval '29 days' as scheduled,
          (select count(*)::int from public.tenancy_events where move_id=$1 and action='cancelled') as events
         from public.tenancy_documents where move_id=$1`,
          [move],
        ),
      );
      expect(retained.rows[0]).toEqual({ scheduled: true, events: 1 });
      for (const table of [
        'tenancy_moves',
        'tenancy_documents',
        'tenancy_events',
      ]) {
        expect(
          await dbError(
            f.asActor('admin', (client) =>
              client.query(`select * from public.${table}`),
            ),
          ),
        ).toMatchObject({ code: '42501' });
      }
      expect(
        await dbError(
          f.database.asSuperuser((client) =>
            client.query('delete from public.tenancy_events where move_id=$1', [
              move,
            ]),
          ),
        ),
      ).toMatchObject({ message: expect.stringMatching(/append.only/i) });
      expect(
        await dbError(
          f.database.asSuperuser((client) =>
            client.query('delete from public.tenancy_moves where id=$1', [
              move,
            ]),
          ),
        ),
      ).toMatchObject({ message: expect.stringMatching(/append.only/i) });
      await f.database.asSuperuser((client) =>
        client.query(
          `update public.societies set status='suspended' where id=$1`,
          [f.society],
        ),
      );
      expect((await f.page('owner')).total).toBe(1);
      expect(await dbError(f.create('move_in', 'owner'))).toMatchObject({
        code: '42501',
      });
      await f.database.asSuperuser((client) =>
        client.query(
          `update public.societies set status='archived' where id=$1`,
          [f.society],
        ),
      );
      expect(await dbError(f.page('owner'))).toMatchObject({ code: '42501' });
    });
  });
});
