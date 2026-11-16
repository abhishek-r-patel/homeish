// Verify Home-Services isolation, role matrix, suggestion review, one rating per resident and comment moderation.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';
import {
  homeServicesAdminWorkspaceSchema,
  homeServicesDirectorySchema,
  homeServicesProviderDetailSchema,
} from '../../src/core/home-services/validation';

const ACTORS = [
  'admin',
  'committee',
  'residentA',
  'residentB',
  'guard',
  'foreignAdmin',
] as const;
type Actor = (typeof ACTORS)[number];

describe.skipIf(!hasDatabase)('home services database contracts', () => {
  let database: TestDatabase;
  const users = new Map<Actor, string>();
  let society = '';
  let foreignSociety = '';

  const user = (actor: Actor) => {
    const id = users.get(actor);
    if (!id) throw new Error(`Missing synthetic ${actor}.`);
    return id;
  };
  const asActor = <T>(actor: Actor, run: (client: Client) => Promise<T>) =>
    database.asRole('authenticated', { sub: user(actor) }, run, {
      commit: true,
    });
  const call = async (actor: Actor, name: string, args: unknown[]) => {
    const placeholders = args.map((_, index) => `$${index + 1}`).join(',');
    const result = await asActor(actor, (client) =>
      client.query<{ value: unknown }>(
        `select public.${name}(${placeholders}) as value`,
        args,
      ),
    );
    return result.rows[0]?.value;
  };
  const code = async (promise: Promise<unknown>) =>
    (await dbError(promise)).code;
  const setModule = (enabled: boolean) =>
    database.asSuperuser((client) =>
      client.query(
        `update public.module_configs set enabled=$2
         where society_id=$1 and module_key='home_services'`,
        [society, enabled],
      ),
    );
  const saveProvider = async (
    name: string,
    actor: Actor = 'admin',
    targetSociety = society,
    serviceType = 'plumber',
  ) =>
    (await call(actor, 'home_services_provider_save', [
      targetSociety,
      null,
      name,
      serviceType,
      '98765 43210',
      'Sector 5',
      null,
      null,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ])) as string;
  const suggest = async (name: string, requestId = crypto.randomUUID()) =>
    (await call('committee', 'home_services_provider_suggest', [
      society,
      name,
      'electrician',
      '+91 98111 22233',
      null,
      'Recommended by tower B',
      crypto.randomUUID(),
      requestId,
    ])) as string;
  const rate = async (
    actor: Actor,
    provider: string,
    stars: number,
    comment: string | null = null,
  ) =>
    (await call(actor, 'home_services_rating_save', [
      society,
      provider,
      stars,
      comment,
      crypto.randomUUID(),
    ])) as string;
  const directory = async (actor: Actor) =>
    homeServicesDirectorySchema.parse(
      await call(actor, 'home_services_directory', [society]),
    );
  const detail = async (actor: Actor, provider: string) =>
    homeServicesProviderDetailSchema.parse(
      await call(actor, 'home_services_provider_detail', [society, provider]),
    );
  const workspace = async (actor: Actor = 'admin') =>
    homeServicesAdminWorkspaceSchema.parse(
      await call(actor, 'home_services_admin_workspace', [society]),
    );
  const version = async (provider: string) =>
    (await workspace()).providers.find((item) => item.id === provider)!.version;

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      for (const actor of ACTORS) {
        const email = `home-services-${actor.toLowerCase()}@example.test`;
        const id = await newAuthUser(client, email);
        users.set(actor, id);
        await client.query(
          `insert into public.profiles(id,email,full_name) values($1,$2,$3)
           on conflict(id) do update set full_name=excluded.full_name`,
          [id, email, `Synthetic ${actor}`],
        );
      }
      society = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by) values('Services A',$1) returning id`,
          [user('admin')],
        )
      ).rows[0]!.id;
      foreignSociety = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by) values('Services B',$1) returning id`,
          [user('foreignAdmin')],
        )
      ).rows[0]!.id;
      for (const actor of ACTORS) {
        const role =
          actor === 'admin' || actor === 'foreignAdmin'
            ? 'admin'
            : actor === 'committee' || actor === 'guard'
              ? actor
              : 'resident';
        await client.query(
          `insert into public.memberships(society_id,user_id,roles,status)
           values($1,$2,array[$3]::text[],'active')`,
          [
            actor === 'foreignAdmin' ? foreignSociety : society,
            user(actor),
            role,
          ],
        );
      }
      await client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,'core',true,'{}'),($1,'home_services',true,'{}'),
           ($2,'core',true,'{}'),($2,'home_services',true,'{}')`,
        [society, foreignSociety],
      );
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps tables private and isolates societies', async () => {
    const own = await saveProvider('Own Plumbing');
    const foreign = await saveProvider(
      'Foreign Plumbing',
      'foreignAdmin',
      foreignSociety,
    );
    for (const table of ['home_services_providers', 'home_services_ratings']) {
      expect(
        await code(
          asActor('admin', (client) =>
            client.query(`select * from public.${table}`),
          ),
        ),
      ).toBe('42501');
    }
    expect(
      await code(
        call('foreignAdmin', 'home_services_admin_workspace', [society]),
      ),
    ).toBe('42501');
    expect(
      await code(call('foreignAdmin', 'home_services_directory', [society])),
    ).toBe('42501');
    expect(await code(saveProvider('Intruder', 'foreignAdmin', society))).toBe(
      '42501',
    );
    expect(await code(detail('admin', foreign))).toBe('P0002');
    expect(await code(rate('residentA', foreign, 5))).toBe('P0002');
    expect((await workspace()).providers.map((item) => item.id)).toEqual([own]);
  });

  it('enforces the role matrix on every operation', async () => {
    const provider = await saveProvider('Matrix Electricals');
    expect(await code(saveProvider('Committee Add', 'committee'))).toBe(
      '42501',
    );
    expect(await code(saveProvider('Resident Add', 'residentA'))).toBe('42501');
    expect(
      await code(
        call('admin', 'home_services_provider_suggest', [
          society,
          'Admin Suggestion',
          'painter',
          '9876543210',
          null,
          null,
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('42501');
    expect(await code(rate('admin', provider, 4))).toBe('42501');
    expect(await code(rate('committee', provider, 4))).toBe('42501');
    expect(await code(rate('guard', provider, 4))).toBe('42501');
    for (const actor of ['residentA', 'guard'] as const) {
      expect(
        await code(call(actor, 'home_services_admin_workspace', [society])),
      ).toBe('42501');
    }
    expect(await code(directory('guard'))).toBe('42501');
    const committee = await workspace('committee');
    expect(committee.can_manage).toBe(false);
    expect(committee.can_suggest).toBe(true);
    expect((await workspace()).can_manage).toBe(true);
    expect((await directory('residentA')).can_rate).toBe(true);
    expect((await directory('committee')).can_rate).toBe(false);
    expect(
      await code(
        call('committee', 'home_services_provider_archive', [
          society,
          provider,
          await version(provider),
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('42501');
  });

  it('validates provider fields and keeps edits current', async () => {
    expect(
      await code(
        call('admin', 'home_services_provider_save', [
          society,
          null,
          'Bad Phone',
          'plumber',
          'call me',
          null,
          null,
          null,
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('22023');
    expect(
      await code(saveProvider('Bad Type', 'admin', society, 'astrologer')),
    ).toBe('22023');
    const clientRequestId = crypto.randomUUID();
    const args = [
      society,
      null,
      '  Retry Carpentry  ',
      'carpenter',
      '9876543210',
      '',
      null,
      null,
      clientRequestId,
      crypto.randomUUID(),
    ];
    const first = (await call(
      'admin',
      'home_services_provider_save',
      args,
    )) as string;
    expect(await call('admin', 'home_services_provider_save', args)).toBe(
      first,
    );
    const provider = (await workspace()).providers.find(
      (item) => item.id === first,
    )!;
    expect(provider).toMatchObject({
      name: 'Retry Carpentry',
      area: null,
      status: 'approved',
      origin: 'admin',
      version: 1,
    });
    await call('admin', 'home_services_provider_save', [
      society,
      first,
      'Retry Carpentry Works',
      'carpenter',
      '9876543210',
      'Phase 2',
      'Weekends only',
      1,
      null,
      crypto.randomUUID(),
    ]);
    expect(
      await code(
        call('admin', 'home_services_provider_save', [
          society,
          first,
          'Stale',
          'carpenter',
          '9876543210',
          null,
          null,
          1,
          null,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('40001');
    await call('admin', 'home_services_provider_archive', [
      society,
      first,
      2,
      crypto.randomUUID(),
    ]);
    expect(
      await code(
        call('admin', 'home_services_provider_save', [
          society,
          first,
          'After Archive',
          'carpenter',
          '9876543210',
          null,
          null,
          3,
          null,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('23514');
    expect(
      (await directory('residentA')).providers.some(
        (item) => item.id === first,
      ),
    ).toBe(false);
    expect(await code(detail('residentA', first))).toBe('P0002');
    expect((await detail('committee', first)).is_listed).toBe(false);
  });

  it('hides suggestions from residents until an administrator approves them', async () => {
    const requestId = crypto.randomUUID();
    const suggested = await suggest('Suggested Sparks', requestId);
    const notified = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ user_id: string; entity_type: string }>(
            'select user_id,entity_type from public.notifications where request_id=$1',
            [requestId],
          )
        ).rows,
    );
    expect(notified).toEqual([
      { user_id: user('admin'), entity_type: 'home_services_admin' },
    ]);
    expect(
      (await directory('residentA')).providers.some(
        (item) => item.id === suggested,
      ),
    ).toBe(false);
    expect(await code(detail('residentA', suggested))).toBe('P0002');
    expect(await code(rate('residentA', suggested, 5))).toBe('P0002');
    const pending = (await workspace('committee')).providers[0]!;
    expect(pending).toMatchObject({
      id: suggested,
      status: 'pending',
      origin: 'suggestion',
      suggested_by_name: 'Synthetic committee',
    });
    expect(
      await code(
        call('admin', 'home_services_provider_archive', [
          society,
          suggested,
          pending.version,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('23505');
    expect(
      await code(
        call('committee', 'home_services_suggestion_review', [
          society,
          suggested,
          true,
          null,
          pending.version,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('42501');
    const approveId = crypto.randomUUID();
    await call('admin', 'home_services_suggestion_review', [
      society,
      suggested,
      true,
      null,
      pending.version,
      approveId,
    ]);
    expect(
      (await directory('residentA')).providers.some(
        (item) => item.id === suggested,
      ),
    ).toBe(true);
    expect(
      await code(
        call('admin', 'home_services_suggestion_review', [
          society,
          suggested,
          false,
          null,
          pending.version + 1,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('23505');
    const approvalNotice = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ user_id: string; type: string }>(
            'select user_id,type from public.notifications where request_id=$1',
            [approveId],
          )
        ).rows,
    );
    expect(approvalNotice).toEqual([
      { user_id: user('committee'), type: 'home_services_suggestion_approved' },
    ]);

    const rejected = await suggest('Rejected Rewiring');
    await call('admin', 'home_services_suggestion_review', [
      society,
      rejected,
      false,
      'Several complaints from residents.',
      1,
      crypto.randomUUID(),
    ]);
    const rejectedRow = (await workspace('committee')).providers.find(
      (item) => item.id === rejected,
    )!;
    expect(rejectedRow).toMatchObject({
      status: 'rejected',
      review_reason: 'Several complaints from residents.',
    });
    expect(
      (await directory('residentA')).providers.some(
        (item) => item.id === rejected,
      ),
    ).toBe(false);
    expect(
      await code(
        call('admin', 'home_services_provider_save', [
          society,
          rejected,
          'Rejected Rewiring',
          'electrician',
          '9876543210',
          null,
          null,
          rejectedRow.version,
          null,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('23514');
  });

  it('caps the administrator notification fan-out for a suggestion', async () => {
    await database.asSuperuser(async (client) => {
      for (let index = 0; index < 22; index += 1) {
        const email = `home-services-extra-admin-${index}@example.test`;
        const id = await newAuthUser(client, email);
        await client.query(
          'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
          [id, email, `Synthetic extra admin ${index}`],
        );
        await client.query(
          `insert into public.memberships(society_id,user_id,roles,status)
           values($1,$2,array['admin']::text[],'active')`,
          [society, id],
        );
      }
    });
    const requestId = crypto.randomUUID();
    await suggest('Capped Fan-out Electric', requestId);
    const count = await database.asSuperuser(
      async (client) =>
        (
          await client.query<{ count: string }>(
            'select count(*) from public.notifications where request_id=$1',
            [requestId],
          )
        ).rows[0]!.count,
    );
    expect(Number(count)).toBe(20);
  });

  it('keeps one editable rating per resident and averages them', async () => {
    const provider = await saveProvider(
      'Rated Pest Control',
      'admin',
      society,
      'pest_control',
    );
    const first = await rate('residentA', provider, 2, 'Late, but fixed it.');
    const second = await rate(
      'residentA',
      provider,
      4,
      '  Came back and did it well.  ',
    );
    expect(second).toBe(first);
    await rate('residentB', provider, 5);
    const listed = (await directory('residentA')).providers.find(
      (item) => item.id === provider,
    )!;
    expect(listed).toMatchObject({
      average_stars: 4.5,
      rating_count: 2,
      my_stars: 4,
    });
    const view = await detail('residentA', provider);
    expect(view.my_rating).toMatchObject({
      id: first,
      stars: 4,
      comment: 'Came back and did it well.',
      comment_hidden: false,
    });
    expect(view.comments.map((item) => item.comment)).toEqual([
      'Came back and did it well.',
    ]);
    expect(view.comments[0]!.rater_name).toBeNull();
    expect(await code(rate('residentA', provider, 6))).toBe('22023');
    expect(await code(rate('residentA', provider, 0))).toBe('22023');
    expect(await code(rate('residentA', provider, 3, 'x'.repeat(501)))).toBe(
      '22023',
    );
    const audits = await database.asSuperuser(async (client) =>
      (
        await client.query<{ action: string }>(
          `select action from public.audit_logs where entity_id=$1 order by id`,
          [first],
        )
      ).rows.map((row) => row.action),
    );
    expect(audits).toEqual([
      'home_services.rating.create',
      'home_services.rating.update',
    ]);
  });

  it('lets an administrator hide and show a comment while the rating still counts', async () => {
    const provider = await saveProvider(
      'Moderated Cleaning',
      'admin',
      society,
      'cleaning',
    );
    const rude = await rate(
      'residentB',
      provider,
      1,
      'Synthetic rude comment.',
    );
    const plain = await rate('residentA', provider, 3);
    expect(
      await code(
        call('residentA', 'home_services_comment_visibility_set', [
          society,
          rude,
          true,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('42501');
    expect(
      await code(
        call('admin', 'home_services_comment_visibility_set', [
          society,
          plain,
          true,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('22023');
    await call('admin', 'home_services_comment_visibility_set', [
      society,
      rude,
      true,
      crypto.randomUUID(),
    ]);
    const other = await detail('residentA', provider);
    expect(other.comments).toEqual([]);
    expect(other.provider).toMatchObject({ average_stars: 2, rating_count: 2 });
    const author = await detail('residentB', provider);
    expect(author.my_rating?.comment_hidden).toBe(true);
    expect(author.comments[0]).toMatchObject({
      is_mine: true,
      comment_hidden: true,
      comment: 'Synthetic rude comment.',
      rater_name: null,
    });
    const committeeDetail = await detail('committee', provider);
    expect(committeeDetail.can_moderate).toBe(false);
    expect(committeeDetail.comments[0]).toMatchObject({
      id: rude,
      comment_hidden: true,
      comment: null,
      rater_name: 'Synthetic residentB',
    });
    await rate('residentB', provider, 2, 'Synthetic edited comment.');
    expect((await detail('residentA', provider)).comments).toEqual([]);
    const admin = await detail('admin', provider);
    expect(admin.can_moderate).toBe(true);
    expect(admin.comments[0]).toMatchObject({
      comment_hidden: true,
      comment: 'Synthetic edited comment.',
      rater_name: 'Synthetic residentB',
    });
    const moderated = (await workspace('committee')).comments.find(
      (item) => item.id === rude,
    )!;
    expect(moderated).toMatchObject({
      comment_hidden: true,
      comment: null,
      rater_name: 'Synthetic residentB',
    });
    expect(
      (await workspace('admin')).comments.find((item) => item.id === rude),
    ).toMatchObject({
      comment_hidden: true,
      comment: 'Synthetic edited comment.',
      rater_name: 'Synthetic residentB',
    });
    expect(
      await code(
        call('admin', 'home_services_comment_visibility_set', [
          society,
          rude,
          true,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('23505');
    await call('admin', 'home_services_comment_visibility_set', [
      society,
      rude,
      false,
      crypto.randomUUID(),
    ]);
    expect(
      (await detail('residentA', provider)).comments.map(
        (item) => item.comment,
      ),
    ).toEqual(['Synthetic edited comment.']);
  });

  it('settles concurrent retries and first ratings without duplicates', async () => {
    const clientRequestId = crypto.randomUUID();
    const suggestOnce = () =>
      call('committee', 'home_services_provider_suggest', [
        society,
        'Concurrent Carpentry',
        'carpenter',
        '9876543210',
        null,
        null,
        clientRequestId,
        crypto.randomUUID(),
      ]);
    const [firstId, secondId] = await Promise.all([
      suggestOnce(),
      suggestOnce(),
    ]);
    expect(secondId).toBe(firstId);
    const provider = await saveProvider(
      'Concurrent Painting',
      'admin',
      society,
      'painter',
    );
    const [ratingA, ratingB] = await Promise.all([
      rate('residentA', provider, 3),
      rate('residentA', provider, 4),
    ]);
    expect(ratingB).toBe(ratingA);
    const actions = await database.asSuperuser(async (client) =>
      (
        await client.query<{ entity_id: string; action: string }>(
          `select entity_id,action from public.audit_logs
           where entity_id = any($1::text[]) order by action`,
          [[firstId, ratingA]],
        )
      ).rows.map(
        (row) =>
          `${row.entity_id === firstId ? 'provider' : 'rating'}:${row.action}`,
      ),
    );
    expect(actions).toEqual([
      'provider:home_services.provider.suggest',
      'rating:home_services.rating.create',
      'rating:home_services.rating.update',
    ]);
  });

  it('refuses reads and writes while the module is disabled', async () => {
    const provider = await saveProvider(
      'Disabled Appliance Repair',
      'admin',
      society,
      'appliance_repair',
    );
    await setModule(false);
    try {
      expect(await code(directory('residentA'))).toBe('42501');
      expect(await code(workspace())).toBe('42501');
      expect(await code(rate('residentA', provider, 4))).toBe('42501');
      expect(await code(saveProvider('While Disabled'))).toBe('42501');
      expect(await code(suggest('While Disabled'))).toBe('42501');
    } finally {
      await setModule(true);
    }
    expect((await directory('residentA')).providers.length).toBeGreaterThan(0);
  });

  it('flags provider lists that reach the 500-row cap', async () => {
    expect((await directory('residentA')).truncated).toBe(false);
    expect((await workspace()).truncated).toBe(false);
    await database.asSuperuser((client) =>
      client.query(
        `insert into public.home_services_providers(
           society_id,name,service_type,phone,origin,status,client_request_id,created_by,updated_by)
         select $1,'Bulk provider '||n,'other','9876543210','admin','approved',
           gen_random_uuid(),$2,$2
         from generate_series(1,500) as n`,
        [society, user('admin')],
      ),
    );
    const listed = await directory('residentA');
    expect(listed.providers).toHaveLength(500);
    expect(listed.truncated).toBe(true);
    const managed = await workspace();
    expect(managed.providers).toHaveLength(500);
    expect(managed.truncated).toBe(true);
  });
});
