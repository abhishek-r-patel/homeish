// Verify community tables, storage bucket, RPC ACLs, record guards, the module-disabled refusal and the
// pre-moderated post happy path with a private photo.
import type { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  type TestDatabase,
} from './support/database';

const COMMUNITY_TABLES = [
  'community_groups',
  'community_group_members',
  'community_posts',
  'community_listings',
  'community_replies',
  'community_photos',
  'community_reports',
  'community_mutes',
  'community_preferences',
];

const SERVICE_ONLY = [
  'community_retention_files_list',
  'community_retention_run',
];

interface Fixture {
  societyId: string;
  admin: string;
  committee: string;
  resident: string;
  neighbour: string;
  guard: string;
}

const requestId = (label: string) => `test-${label}-${crypto.randomUUID()}`;

describe.skipIf(!hasDatabase)('community database foundation', () => {
  let database: TestDatabase;
  let fixture: Fixture;

  const call = async (
    userId: string | null,
    name: string,
    args: unknown[],
  ): Promise<Record<string, unknown>> => {
    const parameters = args.map((_, index) => `$${index + 1}`).join(',');
    const run = (client: Client) =>
      client.query<{ value: Record<string, unknown> }>(
        `select public.${name}(${parameters}) as value`,
        args,
      );
    const result =
      userId === null
        ? await database.asRole('service_role', {}, run, { commit: true })
        : await database.asRole('authenticated', { sub: userId }, run, {
            commit: true,
          });
    return result.rows[0]!.value;
  };

  const setModule = (enabled: boolean) =>
    database.asSuperuser((client) =>
      client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,'community',$2,'{}') on conflict(society_id,module_key)
         do update set enabled=excluded.enabled`,
        [fixture.societyId, enabled],
      ),
    );

  const uploadPhoto = async (userId: string) => {
    const path = (await call(userId, 'community_photo_upload_path', [
      fixture.societyId,
      'image/jpeg',
      1024,
    ])) as unknown as string;
    await database.asRole(
      'authenticated',
      { sub: userId },
      (client) =>
        client.query(
          `insert into storage.objects(bucket_id,name,owner,metadata)
           values('community-photos',$1,$2,'{"mimetype":"image/jpeg","size":1024}')`,
          [path, userId],
        ),
      { commit: true },
    );
    return path;
  };

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await database.asSuperuser(async (client) => {
      const ids = Array.from({ length: 5 }, () => crypto.randomUUID());
      const [admin, committee, resident, neighbour, guard] = ids as [
        string,
        string,
        string,
        string,
        string,
      ];
      await client.query(
        `insert into auth.users(id,email) select id, id::text || '@example.test'
         from unnest($1::uuid[]) as id`,
        [ids],
      );
      await client.query(
        `insert into public.profiles(id,email,full_name)
         select id, id::text || '@example.test', 'Synthetic community member'
         from unnest($1::uuid[]) as id`,
        [ids],
      );
      const societyId = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by)
           values('Synthetic Community Society',$1) returning id`,
          [admin],
        )
      ).rows[0]!.id;
      const members = await client.query<{ id: string; user_id: string }>(
        `insert into public.memberships(society_id,user_id,roles,status)
         values($1,$2,'{admin}','active'),($1,$3,'{committee}','active'),
               ($1,$4,'{resident}','active'),($1,$5,'{resident}','active'),
               ($1,$6,'{guard}','active')
         returning id,user_id`,
        [societyId, admin, committee, resident, neighbour, guard],
      );
      await client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,'core',true,'{}'),($1,'community',true,'{}')
         on conflict(society_id,module_key) do update set enabled=true`,
        [societyId],
      );
      const blockId = (
        await client.query<{ id: string }>(
          `insert into public.blocks(society_id,name,created_by)
           values($1,'A',$2) returning id`,
          [societyId, admin],
        )
      ).rows[0]!.id;
      for (const [userId, number] of [
        [resident, '101'],
        [neighbour, '102'],
      ] as const) {
        const unitId = (
          await client.query<{ id: string }>(
            `insert into public.units(society_id,block_id,number,created_by)
             values($1,$2,$3,$4) returning id`,
            [societyId, blockId, number, admin],
          )
        ).rows[0]!.id;
        await client.query(
          `insert into public.unit_occupants(society_id,unit_id,membership_id,relationship,is_primary,status,created_by)
           values($1,$2,$3,'owner',true,'active',$4)`,
          [
            societyId,
            unitId,
            members.rows.find((row) => row.user_id === userId)!.id,
            admin,
          ],
        );
      }
      return { societyId, admin, committee, resident, neighbour, guard };
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps every community table tenant-scoped, RLS-enabled and inaccessible directly', async () => {
    const tables = await database.asSuperuser((client) =>
      client.query(
        `select c.relname as table_name,
          coalesce((select column_info.is_nullable='NO' from information_schema.columns column_info
            where column_info.table_schema='public' and column_info.table_name=c.relname
              and column_info.column_name='society_id'),false) as society_id_required,
          c.relrowsecurity as rls_enabled,
          exists(select 1 from pg_policies policy
            where policy.schemaname='public' and policy.tablename=c.relname
              and policy.policyname=c.relname || '_no_direct_access'
              and policy.qual='false' and policy.with_check='false') as deny_policy,
          has_table_privilege('anon', c.oid, 'select') as anon_select,
          has_table_privilege('authenticated', c.oid, 'select') as authenticated_select,
          has_table_privilege('authenticated', c.oid, 'insert') as authenticated_insert,
          has_table_privilege('service_role', c.oid, 'select') as service_select,
          exists(select 1 from pg_trigger trigger_info
            where trigger_info.tgrelid=c.oid and not trigger_info.tgisinternal
              and (trigger_info.tgtype & 32)<>0) as truncate_guard
         from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relname=any($1::text[])
         order by c.relname`,
        [COMMUNITY_TABLES],
      ),
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(
      [...COMMUNITY_TABLES].sort(),
    );
    for (const table of tables.rows) {
      expect(table).toMatchObject({
        society_id_required: true,
        rls_enabled: true,
        deny_policy: true,
        anon_select: false,
        authenticated_select: false,
        authenticated_insert: false,
        service_select: false,
        truncate_guard: true,
      });
    }
  });

  it('exposes final SECURITY DEFINER RPC signatures only to their intended roles', async () => {
    const functions = await database.asSuperuser((client) =>
      client.query(
        `select p.proname as name,
          p.proargnames[1] as first_arg,
          p.prosecdef as is_definer,
          'search_path=""'=any(p.proconfig) as safe_search_path,
          exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
            where acl.grantee=0 and acl.privilege_type='EXECUTE') as public_execute,
          has_function_privilege('anon',p.oid,'execute') as anon_execute,
          has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
          has_function_privilege('service_role',p.oid,'execute') as service_execute
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname like 'community\\_%' escape '\\'
         order by p.proname`,
      ),
    );
    expect(functions.rows.map((row) => row.name)).toEqual([
      'community_admin_groups',
      'community_admin_item_get',
      'community_admin_mutes',
      'community_admin_queue',
      'community_group_archive',
      'community_group_feed',
      'community_group_join',
      'community_group_leave',
      'community_group_save',
      'community_home',
      'community_listing_close',
      'community_listing_create',
      'community_listing_get',
      'community_listing_renew',
      'community_listing_update',
      'community_listing_withdraw',
      'community_marketplace',
      'community_member_options',
      'community_moderate',
      'community_mute',
      'community_my_items',
      'community_photo_access',
      'community_photo_upload_path',
      'community_post_create',
      'community_post_get',
      'community_post_update',
      'community_post_withdraw',
      'community_preferences_set',
      'community_reply_create',
      'community_reply_delete',
      'community_report',
      'community_retention_files_list',
      'community_retention_run',
      'community_settings_get',
      'community_settings_update',
      'community_unmute',
    ]);
    for (const fn of functions.rows) {
      const serviceOnly = SERVICE_ONLY.includes(fn.name);
      expect(fn).toMatchObject({
        first_arg: serviceOnly ? 'p_today' : 'p_society_id',
        is_definer: true,
        safe_search_path: true,
        public_execute: false,
        anon_execute: false,
        authenticated_execute: !serviceOnly,
        service_execute: serviceOnly,
      });
    }
  });

  it('creates a private photo bucket whose storage policies follow ownership', async () => {
    const storage = await database.asSuperuser((client) =>
      client.query(
        `select bucket.public, bucket.file_size_limit::integer as size_limit,
           bucket.allowed_mime_types as mime_types,
           (select array_agg(policy.policyname::text order by policy.policyname) from pg_policies policy
             where policy.schemaname='storage' and policy.tablename='objects'
               and policy.policyname like 'community\\_photos\\_%' escape '\\') as policies
         from storage.buckets bucket where bucket.id='community-photos'`,
      ),
    );
    expect(storage.rows).toEqual([
      {
        public: false,
        size_limit: 5_242_880,
        mime_types: ['image/jpeg', 'image/png'],
        policies: ['community_photos_insert', 'community_photos_read'],
      },
    ]);
    const path = (await call(fixture.resident, 'community_photo_upload_path', [
      fixture.societyId,
      'image/png',
      2048,
    ])) as unknown as string;
    expect(path).toMatch(
      new RegExp(
        `^${fixture.societyId}/${fixture.resident}/[0-9a-f-]{36}\\.png$`,
      ),
    );
    const otherFolder = path.replace(fixture.resident, fixture.neighbour);
    expect(
      (
        await dbError(
          database.asRole(
            'authenticated',
            { sub: fixture.resident },
            (client) =>
              client.query(
                `insert into storage.objects(bucket_id,name,owner,metadata)
               values('community-photos',$1,$2,'{"mimetype":"image/png","size":2048}')`,
                [otherFolder, fixture.resident],
              ),
          ),
        )
      ).code,
    ).toBe('42501');
    for (const [contentType, size] of [
      ['image/gif', 100],
      ['image/png', 5_242_881],
    ] as const) {
      expect(
        (
          await dbError(
            call(fixture.resident, 'community_photo_upload_path', [
              fixture.societyId,
              contentType,
              size,
            ]),
          )
        ).code,
      ).toBe('22023');
    }
  });

  it('pre-moderates a post with a photo and guards stored records', async () => {
    const group = await call(fixture.admin, 'community_group_save', [
      fixture.societyId,
      null,
      null,
      'Gardening',
      'Plants and balconies',
      requestId('group'),
    ]);
    expect(group).toMatchObject({ version: 1 });
    for (const userId of [fixture.resident, fixture.neighbour]) {
      expect(
        await call(userId, 'community_group_join', [
          fixture.societyId,
          group.groupId,
          requestId('join'),
        ]),
      ).toEqual({ groupId: group.groupId, joined: true });
    }
    const photoPath = await uploadPhoto(fixture.resident);
    const clientRequestId = crypto.randomUUID();
    const createArgs = [
      fixture.societyId,
      group.groupId,
      clientRequestId,
      '  Spare tomato seedlings on the terrace.  ',
      [photoPath],
      requestId('post'),
    ];
    const created = await call(
      fixture.resident,
      'community_post_create',
      createArgs,
    );
    expect(created).toMatchObject({ status: 'pending' });
    expect(
      await call(fixture.resident, 'community_post_create', createArgs),
    ).toEqual(created);

    expect(
      (
        await dbError(
          call(fixture.neighbour, 'community_post_get', [
            fixture.societyId,
            created.postId,
          ]),
        )
      ).code,
    ).toBe('P0002');
    expect(
      await call(fixture.neighbour, 'community_photo_access', [
        fixture.societyId,
        photoPath,
      ]),
    ).toBe(false);

    expect(
      await call(fixture.admin, 'community_moderate', [
        fixture.societyId,
        'post',
        created.postId,
        'approve',
        null,
        requestId('approve'),
      ]),
    ).toEqual({ targetId: created.postId, status: 'approved' });

    const feed = await call(fixture.neighbour, 'community_group_feed', [
      fixture.societyId,
      group.groupId,
      20,
      0,
    ]);
    expect(feed).toMatchObject({
      total: 1,
      items: [
        {
          id: created.postId,
          body: 'Spare tomato seedlings on the terrace.',
          authorUnitLabel: 'A-101',
          photoPaths: [photoPath],
          mine: false,
        },
      ],
    });
    expect(
      await call(fixture.neighbour, 'community_photo_access', [
        fixture.societyId,
        photoPath,
      ]),
    ).toBe(true);

    const audit = await database.asSuperuser((client) =>
      client.query<{ action: string; after: Record<string, unknown> }>(
        `select action, "after" from public.audit_logs
         where society_id=$1 and entity_id=$2 order by created_at, action`,
        [fixture.societyId, created.postId],
      ),
    );
    expect(audit.rows.map((row) => row.action)).toEqual([
      'community.post.create',
      'community.post.approve',
    ]);
    expect(JSON.stringify(audit.rows)).not.toContain('tomato');

    for (const sql of [
      'update public.community_posts set author_user_id=$2 where id=$1',
      'update public.community_photos set position=2 where post_id=$1',
    ]) {
      expect(
        (
          await dbError(
            database.asSuperuser((client) =>
              client.query(
                sql,
                sql.includes('$2')
                  ? [created.postId, fixture.neighbour]
                  : [created.postId],
              ),
            ),
          )
        ).code,
      ).toBe('55000');
    }
    for (const table of COMMUNITY_TABLES) {
      expect(
        (
          await dbError(
            database.asSuperuser((client) =>
              client.query(`truncate public.${table} cascade`),
            ),
          )
        ).code,
      ).toBe('55000');
    }
  });

  it('refuses guards, committee-only members and every call while the module is disabled', async () => {
    for (const userId of [fixture.guard, fixture.committee]) {
      for (const [name, args] of [
        ['community_home', [fixture.societyId]],
        ['community_admin_queue', [fixture.societyId, 'pending', 20, 0]],
        ['community_photo_upload_path', [fixture.societyId, 'image/jpeg', 100]],
      ] as const) {
        expect((await dbError(call(userId, name, [...args]))).code).toBe(
          '42501',
        );
      }
    }
    await setModule(false);
    try {
      for (const [user, name, args] of [
        [fixture.resident, 'community_home', [fixture.societyId]],
        [fixture.admin, 'community_admin_groups', [fixture.societyId]],
        [
          fixture.resident,
          'community_preferences_set',
          [fixture.societyId, false, requestId('prefs')],
        ],
      ] as const) {
        expect((await dbError(call(user, name, [...args]))).code).toBe('42501');
      }
      expect(
        await call(null, 'community_retention_run', [
          new Date().toISOString().slice(0, 10),
          requestId('retention'),
        ]),
      ).toEqual({ postsDeleted: 0, listingsDeleted: 0, repliesDeleted: 0 });
    } finally {
      await setModule(true);
    }
    expect(
      (
        await dbError(
          call(fixture.admin, 'community_retention_run', [
            new Date().toISOString().slice(0, 10),
            requestId('retention'),
          ]),
        )
      ).code,
    ).toBe('42501');
  });
});
