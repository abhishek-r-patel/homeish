// Verify community access, groups, pre-moderated posts and listings, replies, photos and own-item reads.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  approvedListing,
  approvedPost,
  auditRows,
  call,
  callRaw,
  createListing,
  createPost,
  createReply,
  expectCode,
  expectDomainError,
  feed,
  getListing,
  getPost,
  groupVersion,
  groupWithMembers,
  insertStorageObject,
  joinGroup,
  leaveGroup,
  listingInput,
  marketplace,
  moderate,
  notificationsFor,
  photoAccess,
  query,
  records,
  requestId,
  rowStatus,
  rowVersion,
  saveGroup,
  setModule,
  uploadPathFor,
  uploadPhoto,
  uploadPhotos,
  withReplicaRole,
  type CommunityActor,
  type CommunityFixture,
  createCommunityFixture,
} from './support/community-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

const MEMBERS: CommunityActor[] = [
  'owner',
  'tenant',
  'owner2',
  'owner3',
  'multi',
  'committeeResident',
];

describe.skipIf(!hasDatabase)('community content database contracts', () => {
  let database: TestDatabase;
  let fixture: CommunityFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createCommunityFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  const home = (actor: CommunityActor) =>
    call(fixture, actor, 'community_home', [fixture.societyId]);

  const homeGroups = async (actor: CommunityActor) =>
    records((await home(actor)).groups);

  const listingRow = async (listingId: string) =>
    (
      await query<{
        status: string;
        approved_at: Date | null;
        expires_at: Date | null;
        closed_at: Date | null;
      }>(
        database,
        `select status,approved_at,expires_at,closed_at from public.community_listings
         where society_id=$1 and id=$2`,
        [fixture.societyId, listingId],
      )
    )[0]!;

  describe('access', () => {
    it('lets residents with an active flat take part, including committee members who are residents', async () => {
      for (const actor of [
        'owner',
        'tenant',
        'family',
        'committeeResident',
      ] as const) {
        const result = await home(actor);
        expect(Array.isArray(result.groups)).toBe(true);
        expect(result).toHaveProperty('myMute', null);
        expect(result).toMatchObject({
          preferences: { newListingAlerts: true },
        });
      }
    });

    it('refuses guards, supervisors, committee-only members, residents without an active flat and outsiders', async () => {
      const groupId = await groupWithMembers(fixture, ['owner']);
      for (const actor of [
        'guard',
        'hkSupervisor',
        'committee',
        'unhoused',
        'formerOwner',
        'outsider',
        'foreignAdmin',
      ] as const) {
        await expectCode(home(actor), '42501');
        await expectCode(joinGroup(fixture, actor, groupId), '42501');
        await expectCode(createListing(fixture, actor), '42501');
        await expectCode(uploadPathFor(fixture, actor), '42501');
      }
    });

    it('keeps moderation and group management to admins only', async () => {
      const groupId = await groupWithMembers(fixture, ['owner']);
      const postId = await createPost(fixture, 'owner', groupId);
      for (const actor of [
        'owner',
        'committee',
        'committeeResident',
        'guard',
      ] as const) {
        await expectCode(
          saveGroup(fixture, 'Not allowed', null, null, null, actor),
          '42501',
        );
        await expectCode(
          call(fixture, actor, 'community_admin_queue', [
            fixture.societyId,
            'pending',
            10,
            0,
          ]),
          '42501',
        );
        await expectCode(
          moderate(
            fixture,
            'post',
            postId,
            'approve',
            null,
            requestId(),
            actor,
          ),
          '42501',
        );
        await expectCode(
          call(fixture, actor, 'community_mute', [
            fixture.societyId,
            fixture.memberships.tenant,
            '7d',
            'Synthetic reason',
            requestId(),
          ]),
          '42501',
        );
        await expectCode(
          call(fixture, actor, 'community_admin_groups', [fixture.societyId]),
          '42501',
        );
      }
      expect(await rowStatus(database, 'community_posts', postId)).toBe(
        'pending',
      );
    });

    it('refuses every call while the module is disabled', async () => {
      const groupId = await groupWithMembers(fixture, ['owner']);
      await setModule(fixture, false);
      try {
        await expectCode(home('owner'), '42501');
        await expectCode(createPost(fixture, 'owner', groupId), '42501');
        await expectCode(createListing(fixture, 'owner'), '42501');
        await expectCode(uploadPathFor(fixture, 'owner'), '42501');
        await expectCode(
          call(fixture, 'admin', 'community_admin_queue', [
            fixture.societyId,
            'pending',
            10,
            0,
          ]),
          '42501',
        );
        await expectCode(saveGroup(fixture, 'While disabled'), '42501');
      } finally {
        await setModule(fixture, true);
      }
    });
  });

  describe('groups', () => {
    it('lets the admin create, rename and archive groups with validation and optimistic versions', async () => {
      await expectCode(saveGroup(fixture, ''), '22023');
      await expectCode(saveGroup(fixture, 'x'.repeat(81)), '22023');
      await expectCode(
        saveGroup(fixture, 'Long description', 'd'.repeat(501)),
        '22023',
      );
      const created = await saveGroup(
        fixture,
        'Synthetic gardening club',
        'Plants and seeds',
      );
      const renamed = await saveGroup(
        fixture,
        'Synthetic garden circle',
        null,
        created.groupId,
        created.version,
      );
      expect(renamed.groupId).toBe(created.groupId);
      expect(renamed.version).toBeGreaterThan(created.version);
      await expectCode(
        saveGroup(
          fixture,
          'Stale rename',
          null,
          created.groupId,
          created.version,
        ),
        '40001',
      );

      const groups = records(
        (
          await call(fixture, 'admin', 'community_admin_groups', [
            fixture.societyId,
          ])
        ).items,
      );
      expect(
        groups.find((group) => group.id === created.groupId),
      ).toMatchObject({
        name: 'Synthetic garden circle',
        description: null,
        status: 'active',
        memberCount: 0,
        postCount: 0,
        version: renamed.version,
      });
    });

    it('lets residents join and leave active groups idempotently and shows membership on the home screen', async () => {
      const { groupId } = await saveGroup(fixture, 'Synthetic book club');
      expect(await joinGroup(fixture, 'owner', groupId)).toEqual({
        groupId,
        joined: true,
      });
      expect(await joinGroup(fixture, 'owner', groupId)).toEqual({
        groupId,
        joined: true,
      });
      await joinGroup(fixture, 'owner2', groupId);
      const ownerView = (await homeGroups('owner')).find(
        (group) => group.id === groupId,
      );
      expect(ownerView).toMatchObject({
        name: 'Synthetic book club',
        memberCount: 2,
        joined: true,
      });
      expect(
        (await homeGroups('owner3')).find((group) => group.id === groupId),
      ).toMatchObject({ joined: false, memberCount: 2 });

      expect(await leaveGroup(fixture, 'owner', groupId)).toEqual({
        groupId,
        joined: false,
      });
      expect(await leaveGroup(fixture, 'owner', groupId)).toEqual({
        groupId,
        joined: false,
      });
      expect(
        (await homeGroups('owner')).find((group) => group.id === groupId),
      ).toMatchObject({ joined: false, memberCount: 1 });
    });

    it('hides archived groups from residents and refuses joins and posts there', async () => {
      const groupId = await groupWithMembers(fixture, ['owner']);
      const archived = await call(fixture, 'admin', 'community_group_archive', [
        fixture.societyId,
        groupId,
        await groupVersion(fixture, groupId),
        true,
        requestId('archive'),
      ]);
      expect(archived).toMatchObject({ groupId, status: 'archived' });
      expect(
        (await homeGroups('owner')).some((group) => group.id === groupId),
      ).toBe(false);
      await expectDomainError(
        joinGroup(fixture, 'owner2', groupId),
        'community_group_archived',
      );
      await expectDomainError(
        createPost(fixture, 'owner', groupId),
        'community_group_archived',
      );
      const adminGroups = records(
        (
          await call(fixture, 'admin', 'community_admin_groups', [
            fixture.societyId,
          ])
        ).items,
      );
      expect(adminGroups.find((group) => group.id === groupId)).toMatchObject({
        status: 'archived',
      });

      const restored = await call(fixture, 'admin', 'community_group_archive', [
        fixture.societyId,
        groupId,
        await groupVersion(fixture, groupId),
        false,
        requestId('unarchive'),
      ]);
      expect(restored).toMatchObject({ groupId, status: 'active' });
      expect(
        (await homeGroups('owner')).some((group) => group.id === groupId),
      ).toBe(true);
    });

    it('lets only group members read the feed and post or reply in it', async () => {
      const groupId = await groupWithMembers(fixture, ['owner', 'owner2']);
      const postId = await approvedPost(fixture, 'owner', groupId);
      await expectDomainError(
        createPost(fixture, 'owner3', groupId),
        'community_not_member',
      );
      await expectDomainError(
        feed(fixture, 'owner3', groupId),
        'community_not_member',
      );
      await expectCode(getPost(fixture, 'owner3', postId), ['P0002', 'P0001']);
      await expectCode(createReply(fixture, 'owner3', 'post', postId), [
        'P0002',
        'P0001',
      ]);
      await joinGroup(fixture, 'owner3', groupId);
      const visible = await feed(fixture, 'owner3', groupId);
      expect(visible.items.map((item) => item.id)).toContain(postId);
      await leaveGroup(fixture, 'owner3', groupId);
      await expectDomainError(
        feed(fixture, 'owner3', groupId),
        'community_not_member',
      );
    });
  });

  describe('posts', () => {
    it('keeps a new post pending and visible only to its author and admins, then shows it after approval', async () => {
      const groupId = await groupWithMembers(fixture, MEMBERS);
      const body = 'Synthetic pending post body zqxbody';
      const clientRequestId = crypto.randomUUID();
      const createRequest = requestId('post-create');
      const postId = await createPost(
        fixture,
        'owner',
        groupId,
        body,
        [],
        clientRequestId,
        createRequest,
      );
      expect(
        await createPost(fixture, 'owner', groupId, body, [], clientRequestId),
      ).toBe(postId);
      expect(
        (
          await query(
            database,
            'select id from public.community_posts where society_id=$1 and client_request_id=$2',
            [fixture.societyId, clientRequestId],
          )
        ).length,
      ).toBe(1);

      const adminNotes = await notificationsFor(database, createRequest);
      expect(adminNotes).toEqual([
        expect.objectContaining({
          user_id: fixture.actors.admin,
          entity_type: 'community_admin',
        }),
      ]);
      const audit = await auditRows(database, createRequest);
      expect(audit.length).toBeGreaterThan(0);
      expect(audit.every((row) => row.action.startsWith('community.'))).toBe(
        true,
      );
      expect(JSON.stringify(audit)).not.toContain('zqxbody');

      const authorFeed = await feed(fixture, 'owner', groupId);
      expect(authorFeed.items.find((item) => item.id === postId)).toMatchObject(
        {
          body,
          mine: true,
          status: 'pending',
          authorName: fixture.names.owner,
          authorUnitLabel: 'A-101',
        },
      );
      const otherFeed = await feed(fixture, 'owner2', groupId);
      expect(otherFeed.items.some((item) => item.id === postId)).toBe(false);
      await expectCode(getPost(fixture, 'owner2', postId), 'P0002');
      await expectCode(getPost(fixture, 'tenant', postId), 'P0002');
      expect((await getPost(fixture, 'owner', postId)).post).toMatchObject({
        status: 'pending',
        mine: true,
      });
      expect(
        (
          await call(fixture, 'admin', 'community_admin_item_get', [
            fixture.societyId,
            'post',
            postId,
          ])
        ).item,
      ).toMatchObject({ body });

      const approveRequest = requestId('approve');
      expect(
        await moderate(
          fixture,
          'post',
          postId,
          'approve',
          null,
          approveRequest,
        ),
      ).toMatchObject({ targetId: postId, status: 'approved' });
      expect(await notificationsFor(database, approveRequest)).toEqual([
        expect.objectContaining({
          user_id: fixture.actors.owner,
          entity_type: 'community_post',
          entity_id: postId,
        }),
      ]);
      const approvedFeed = await feed(fixture, 'owner2', groupId);
      expect(
        approvedFeed.items.find((item) => item.id === postId),
      ).toMatchObject({
        body,
        mine: false,
        authorName: fixture.names.owner,
        authorUnitLabel: 'A-101',
        replyCount: 0,
      });
      const read = await getPost(fixture, 'owner2', postId);
      expect(read).toMatchObject({
        post: { status: 'approved', mine: false },
        canReply: true,
        reportedByMe: false,
      });
      expect(
        (await homeGroups('owner2')).find((group) => group.id === groupId)
          ?.latestPostAt,
      ).toBeTruthy();
      await expectDomainError(
        moderate(fixture, 'post', postId, 'approve'),
        'community_invalid_state',
      );
    });

    it('lets the author edit only while pending, with optimistic versions', async () => {
      const groupId = await groupWithMembers(fixture, MEMBERS);
      const postId = await createPost(fixture, 'owner', groupId, 'First draft');
      const version = await rowVersion(fixture, 'community_posts', postId);
      const updated = await call(fixture, 'owner', 'community_post_update', [
        fixture.societyId,
        postId,
        version,
        'Second draft',
        [],
        requestId('post-update'),
      ]);
      expect(updated).toMatchObject({ postId, version: version + 1 });
      await expectCode(
        call(fixture, 'owner', 'community_post_update', [
          fixture.societyId,
          postId,
          version,
          'Stale draft',
          [],
          requestId('post-update'),
        ]),
        '40001',
      );
      await expectCode(
        call(fixture, 'owner2', 'community_post_update', [
          fixture.societyId,
          postId,
          version + 1,
          'Not my post',
          [],
          requestId('post-update'),
        ]),
        ['P0002', '42501'],
      );
      await expectCode(
        call(fixture, 'owner', 'community_post_update', [
          fixture.societyId,
          postId,
          version + 1,
          '',
          [],
          requestId('post-update'),
        ]),
        '22023',
      );
      await moderate(fixture, 'post', postId, 'approve');
      await expectDomainError(
        call(fixture, 'owner', 'community_post_update', [
          fixture.societyId,
          postId,
          await rowVersion(fixture, 'community_posts', postId),
          'Edited after approval',
          [],
          requestId('post-update'),
        ]),
        'community_invalid_state',
      );
      expect(
        ((await getPost(fixture, 'owner2', postId)).post as { body: string })
          .body,
      ).toBe('Second draft');
    });

    it('validates post bodies', async () => {
      const groupId = await groupWithMembers(fixture, ['owner']);
      await expectCode(createPost(fixture, 'owner', groupId, ''), '22023');
      await expectCode(
        createPost(fixture, 'owner', groupId, 'b'.repeat(4001)),
        '22023',
      );
      await expectCode(
        call(fixture, 'owner', 'community_post_create', [
          fixture.societyId,
          groupId,
          crypto.randomUUID(),
          'Synthetic body',
          [],
          '',
        ]),
        '22023',
      );
    });

    it('lets the author withdraw an approved post, hiding it from everyone else', async () => {
      const groupId = await groupWithMembers(fixture, MEMBERS);
      const postId = await approvedPost(fixture, 'owner', groupId);
      await expectCode(
        call(fixture, 'owner2', 'community_post_withdraw', [
          fixture.societyId,
          postId,
          requestId('withdraw'),
        ]),
        ['P0002', '42501'],
      );
      expect(
        await call(fixture, 'owner', 'community_post_withdraw', [
          fixture.societyId,
          postId,
          requestId('withdraw'),
        ]),
      ).toEqual({ postId, status: 'withdrawn' });
      expect(
        (await feed(fixture, 'owner2', groupId)).items.some(
          (item) => item.id === postId,
        ),
      ).toBe(false);
      await expectCode(getPost(fixture, 'owner2', postId), 'P0002');
      await expectDomainError(
        call(fixture, 'owner', 'community_post_withdraw', [
          fixture.societyId,
          postId,
          requestId('withdraw'),
        ]),
        'community_invalid_state',
      );
    });

    it('requires a reason to reject and shows the reason only to the author and admins', async () => {
      const groupId = await groupWithMembers(fixture, MEMBERS);
      const postId = await createPost(fixture, 'owner', groupId);
      await expectCode(moderate(fixture, 'post', postId, 'reject'), '22023');
      await expectCode(
        moderate(fixture, 'post', postId, 'reject', 'r'.repeat(501)),
        '22023',
      );
      const rejectRequest = requestId('reject');
      expect(
        await moderate(
          fixture,
          'post',
          postId,
          'reject',
          'Synthetic off-topic reason',
          rejectRequest,
        ),
      ).toMatchObject({ targetId: postId, status: 'rejected' });
      expect(await notificationsFor(database, rejectRequest)).toEqual([
        expect.objectContaining({ user_id: fixture.actors.owner }),
      ]);
      expect((await getPost(fixture, 'owner', postId)).post).toMatchObject({
        status: 'rejected',
        moderationReason: 'Synthetic off-topic reason',
      });
      await expectCode(getPost(fixture, 'owner2', postId), 'P0002');
      await expectDomainError(
        moderate(fixture, 'post', postId, 'approve'),
        'community_invalid_state',
      );
      await expectDomainError(
        call(fixture, 'owner', 'community_post_withdraw', [
          fixture.societyId,
          postId,
          requestId('withdraw'),
        ]),
        'community_invalid_state',
      );
    });

    it('paginates the feed newest first', async () => {
      const groupId = await groupWithMembers(fixture, ['owner', 'owner2']);
      const ids: string[] = [];
      for (let index = 0; index < 3; index += 1) {
        ids.push(
          await approvedPost(fixture, 'owner', groupId, `Page post ${index}`),
        );
      }
      const first = await feed(fixture, 'owner2', groupId, 2, 0);
      const second = await feed(fixture, 'owner2', groupId, 2, 2);
      expect(first.total).toBe(3);
      expect(first.items.map((item) => item.id)).toEqual([ids[2], ids[1]]);
      expect(second.items.map((item) => item.id)).toEqual([ids[0]]);
      await expectCode(feed(fixture, 'owner2', groupId, 0, 0), '22023');
    });
  });

  describe('listings', () => {
    it('validates listing input', async () => {
      const bad = [
        { listingType: 'rent' },
        { title: '' },
        { title: 't'.repeat(121) },
        { description: 'd'.repeat(4001) },
        { listingType: 'give_away', pricePaise: 100 },
        { pricePaise: -1 },
        { pricePaise: 1_000_000_001 },
        { contactPhone: '12345' },
        { contactPhone: 'call-me-maybe' },
      ] as const;
      for (const overrides of bad) {
        await expectCode(
          createListing(fixture, 'owner', overrides as never),
          '22023',
        );
      }
      const free = await createListing(fixture, 'owner', {
        listingType: 'give_away',
        pricePaise: null,
        contactPhone: null,
        description: null,
      });
      expect(await rowStatus(database, 'community_listings', free)).toBe(
        'pending',
      );
    });

    it('keeps listings pending until approved, then shows them in the marketplace for 30 days', async () => {
      const clientRequestId = crypto.randomUUID();
      const createRequest = requestId('listing-create');
      const listingId = await createListing(
        fixture,
        'owner',
        { title: 'Synthetic marketplace cycle 4410' },
        [],
        clientRequestId,
        createRequest,
      );
      expect(
        await createListing(
          fixture,
          'owner',
          { title: 'Synthetic marketplace cycle 4410' },
          [],
          clientRequestId,
        ),
      ).toBe(listingId);
      expect(
        (await notificationsFor(database, createRequest)).map(
          (row) => row.entity_type,
        ),
      ).toEqual(['community_admin']);
      expect(
        (await marketplace(fixture, 'owner2')).items.some(
          (item) => item.id === listingId,
        ),
      ).toBe(false);
      await expectCode(getListing(fixture, 'owner2', listingId), 'P0002');
      expect(
        (await getListing(fixture, 'owner', listingId)).listing,
      ).toMatchObject({ status: 'pending', mine: true });

      await moderate(fixture, 'listing', listingId, 'approve');
      const row = await listingRow(listingId);
      expect(row.status).toBe('approved');
      expect(
        row.expires_at!.getTime() - row.approved_at!.getTime(),
      ).toBeCloseTo(30 * 86_400_000, -4);
      const market = await marketplace(fixture, 'owner2');
      expect(market.items.find((item) => item.id === listingId)).toMatchObject({
        listingType: 'sale',
        title: 'Synthetic marketplace cycle 4410',
        pricePaise: 150_000,
        authorName: fixture.names.owner,
        authorUnitLabel: 'A-101',
        replyCount: 0,
        firstPhotoPath: null,
      });
      expect(
        (await getListing(fixture, 'owner2', listingId)).listing,
      ).toMatchObject({
        contactPhone: '+91 98000 00000',
        expired: false,
        closed: false,
        mine: false,
      });
      expect(
        (await getListing(fixture, 'admin', listingId)).listing,
      ).toMatchObject({ contactPhone: '+91 98000 00000' });
    });

    it('filters the marketplace by type and search text', async () => {
      const lost = await approvedListing(fixture, 'owner2', {
        listingType: 'lost',
        title: 'Synthetic lost umbrella zq81',
        pricePaise: null,
      });
      const sale = await approvedListing(fixture, 'owner3', {
        title: 'Synthetic bicycle zq82',
      });
      const lostOnly = await marketplace(fixture, 'owner', 'lost');
      expect(lostOnly.items.every((item) => item.listingType === 'lost')).toBe(
        true,
      );
      expect(lostOnly.items.map((item) => item.id)).toContain(lost);
      expect(lostOnly.items.map((item) => item.id)).not.toContain(sale);
      const searched = await marketplace(
        fixture,
        'owner',
        null,
        'BICYCLE zq82',
      );
      expect(searched.items.map((item) => item.id)).toEqual([sale]);
      expect(searched.total).toBe(1);
      await expectCode(marketplace(fixture, 'owner', 'rent' as never), '22023');
    });

    it('lets the author edit only while pending and withdraw', async () => {
      const listingId = await createListing(fixture, 'owner');
      const version = await rowVersion(
        fixture,
        'community_listings',
        listingId,
      );
      expect(
        await call(fixture, 'owner', 'community_listing_update', [
          fixture.societyId,
          listingId,
          version,
          listingInput({ title: 'Synthetic edited title', pricePaise: 99 }),
          [],
          requestId('listing-update'),
        ]),
      ).toMatchObject({ listingId, version: version + 1 });
      await expectCode(
        call(fixture, 'owner', 'community_listing_update', [
          fixture.societyId,
          listingId,
          version,
          listingInput(),
          [],
          requestId('listing-update'),
        ]),
        '40001',
      );
      await moderate(fixture, 'listing', listingId, 'approve');
      await expectDomainError(
        call(fixture, 'owner', 'community_listing_update', [
          fixture.societyId,
          listingId,
          await rowVersion(fixture, 'community_listings', listingId),
          listingInput(),
          [],
          requestId('listing-update'),
        ]),
        'community_invalid_state',
      );
      await expectCode(
        call(fixture, 'owner2', 'community_listing_withdraw', [
          fixture.societyId,
          listingId,
          requestId('listing-withdraw'),
        ]),
        ['P0002', '42501'],
      );
      expect(
        await call(fixture, 'owner', 'community_listing_withdraw', [
          fixture.societyId,
          listingId,
          requestId('listing-withdraw'),
        ]),
      ).toMatchObject({ listingId, status: 'withdrawn' });
      expect(
        (await marketplace(fixture, 'owner2')).items.some(
          (item) => item.id === listingId,
        ),
      ).toBe(false);
    });

    it('lets the author close a listing, which removes it from the marketplace and stops replies', async () => {
      const listingId = await approvedListing(fixture, 'owner');
      await expectCode(
        call(fixture, 'owner2', 'community_listing_close', [
          fixture.societyId,
          listingId,
          requestId('close'),
        ]),
        ['P0002', '42501'],
      );
      await call(fixture, 'owner', 'community_listing_close', [
        fixture.societyId,
        listingId,
        requestId('close'),
      ]);
      const row = await listingRow(listingId);
      expect(row.status).toBe('approved');
      expect(row.closed_at).not.toBeNull();
      expect(
        (await marketplace(fixture, 'owner2')).items.some(
          (item) => item.id === listingId,
        ),
      ).toBe(false);
      const read = await getListing(fixture, 'owner2', listingId);
      expect(read).toMatchObject({
        listing: { closed: true },
        canReply: false,
      });
      await expectDomainError(
        createReply(fixture, 'owner2', 'listing', listingId),
        'community_invalid_state',
      );
    });

    it('treats listings past expiry as expired until the author renews them', async () => {
      const listingId = await approvedListing(fixture, 'owner');
      const pending = await createListing(fixture, 'owner');
      await expectDomainError(
        call(fixture, 'owner', 'community_listing_renew', [
          fixture.societyId,
          pending,
          requestId('renew'),
        ]),
        'community_invalid_state',
      );
      await withReplicaRole(
        database,
        `update public.community_listings set approved_at = now() - interval '31 days',
           expires_at = now() - interval '1 day' where id=$1`,
        [listingId],
      );
      expect(
        (await marketplace(fixture, 'owner2')).items.some(
          (item) => item.id === listingId,
        ),
      ).toBe(false);
      expect(await getListing(fixture, 'owner', listingId)).toMatchObject({
        listing: { expired: true, mine: true },
        canReply: false,
      });
      await expectDomainError(
        createReply(fixture, 'owner2', 'listing', listingId),
        'community_invalid_state',
      );
      await expectCode(
        call(fixture, 'owner2', 'community_listing_renew', [
          fixture.societyId,
          listingId,
          requestId('renew'),
        ]),
        ['P0002', '42501'],
      );
      const renewed = await call(fixture, 'owner', 'community_listing_renew', [
        fixture.societyId,
        listingId,
        requestId('renew'),
      ]);
      expect(renewed.listingId).toBe(listingId);
      const expiresAt = new Date(String(renewed.expiresAt)).getTime();
      expect(expiresAt - Date.now()).toBeGreaterThan(29 * 86_400_000);
      expect(expiresAt - Date.now()).toBeLessThan(31 * 86_400_000);
      expect(
        (await marketplace(fixture, 'owner2')).items.some(
          (item) => item.id === listingId,
        ),
      ).toBe(true);
    });

    it('hides the phone number when the poster did not share it', async () => {
      const listingId = await approvedListing(fixture, 'owner', {
        contactPhone: null,
      });
      expect(
        (await getListing(fixture, 'owner2', listingId)).listing,
      ).toMatchObject({ contactPhone: null });
    });
  });

  describe('replies', () => {
    it('shows replies at once, notifies the author unless self-replying, and lets the replier delete', async () => {
      const groupId = await groupWithMembers(fixture, MEMBERS);
      const postId = await approvedPost(fixture, 'owner', groupId);
      const replyRequest = requestId('reply');
      const clientRequestId = crypto.randomUUID();
      const replyId = await createReply(
        fixture,
        'owner2',
        'post',
        postId,
        'Synthetic reply zqxreply',
        clientRequestId,
        replyRequest,
      );
      expect(
        await createReply(
          fixture,
          'owner2',
          'post',
          postId,
          'Synthetic reply zqxreply',
          clientRequestId,
        ),
      ).toBe(replyId);
      expect(await notificationsFor(database, replyRequest)).toEqual([
        expect.objectContaining({
          user_id: fixture.actors.owner,
          entity_type: 'community_post',
          entity_id: postId,
        }),
      ]);
      expect(
        JSON.stringify(await auditRows(database, replyRequest)),
      ).not.toContain('zqxreply');
      const selfRequest = requestId('self-reply');
      await createReply(
        fixture,
        'owner',
        'post',
        postId,
        'Synthetic self reply',
        crypto.randomUUID(),
        selfRequest,
      );
      expect(await notificationsFor(database, selfRequest)).toEqual([]);

      const read = await getPost(fixture, 'owner3', postId);
      const replies = records(read.replies);
      expect(replies.find((reply) => reply.id === replyId)).toMatchObject({
        body: 'Synthetic reply zqxreply',
        authorName: fixture.names.owner2,
        authorUnitLabel: 'A-201',
        mine: false,
        status: 'visible',
      });
      expect(
        (await feed(fixture, 'owner3', groupId)).items.find(
          (item) => item.id === postId,
        ),
      ).toMatchObject({ replyCount: 2 });

      await expectCode(
        call(fixture, 'owner3', 'community_reply_delete', [
          fixture.societyId,
          replyId,
          requestId('reply-delete'),
        ]),
        ['P0002', '42501'],
      );
      expect(
        await call(fixture, 'owner2', 'community_reply_delete', [
          fixture.societyId,
          replyId,
          requestId('reply-delete'),
        ]),
      ).toEqual({ deleted: true });
      expect(await rowStatus(database, 'community_replies', replyId)).toBe(
        'removed',
      );
      expect(
        records((await getPost(fixture, 'owner3', postId)).replies).some(
          (reply) => reply.id === replyId && reply.status === 'visible',
        ),
      ).toBe(false);
    });

    it('refuses replies to pending posts and validates reply bodies', async () => {
      const groupId = await groupWithMembers(fixture, MEMBERS);
      const pending = await createPost(fixture, 'owner', groupId);
      await expectCode(createReply(fixture, 'owner2', 'post', pending), [
        'P0002',
        'P0001',
      ]);
      await expectDomainError(
        createReply(fixture, 'owner', 'post', pending),
        'community_invalid_state',
      );
      const approved = await approvedPost(fixture, 'owner', groupId);
      await expectCode(
        createReply(fixture, 'owner2', 'post', approved, ''),
        '22023',
      );
      await expectCode(
        createReply(fixture, 'owner2', 'post', approved, 'r'.repeat(2001)),
        '22023',
      );
      await expectCode(
        call(fixture, 'owner2', 'community_reply_create', [
          fixture.societyId,
          'event',
          approved,
          crypto.randomUUID(),
          'Synthetic body',
          requestId(),
        ]),
        '22023',
      );
    });

    it('lets any resident reply to a listing and notifies the poster', async () => {
      const listingId = await approvedListing(fixture, 'owner3');
      const request = requestId('listing-reply');
      await createReply(
        fixture,
        'owner4',
        'listing',
        listingId,
        'Synthetic is it available?',
        crypto.randomUUID(),
        request,
      );
      expect(await notificationsFor(database, request)).toEqual([
        expect.objectContaining({
          user_id: fixture.actors.owner3,
          entity_type: 'community_listing',
          entity_id: listingId,
        }),
      ]);
      const read = await getListing(fixture, 'owner', listingId);
      expect(records(read.replies)).toHaveLength(1);
      expect(
        (await marketplace(fixture, 'owner')).items.find(
          (item) => item.id === listingId,
        ),
      ).toMatchObject({ replyCount: 1 });
    });
  });

  describe('photos', () => {
    it('issues upload paths in the caller folder for JPG and PNG up to 5 MiB', async () => {
      const jpg = await uploadPathFor(fixture, 'owner');
      expect(jpg).toMatch(
        new RegExp(
          `^${fixture.societyId}/${fixture.actors.owner}/[0-9a-f-]{36}\\.jpg$`,
        ),
      );
      expect(await uploadPathFor(fixture, 'owner', 'image/png')).toMatch(
        /\.png$/,
      );
      await expectCode(uploadPathFor(fixture, 'owner', 'image/gif'), '22023');
      await expectCode(
        uploadPathFor(fixture, 'owner', 'image/jpeg', 5 * 1024 * 1024 + 1),
        '22023',
      );
      await expectCode(
        uploadPathFor(fixture, 'owner', 'image/jpeg', 0),
        '22023',
      );
    });

    it('stops uploads into another resident folder', async () => {
      await expectCode(
        insertStorageObject(
          fixture,
          fixture.actors.owner,
          `${fixture.societyId}/${fixture.actors.owner2}/${crypto.randomUUID()}.jpg`,
        ),
        '42501',
      );
      await expectCode(
        insertStorageObject(
          fixture,
          fixture.actors.guard,
          `${fixture.societyId}/${fixture.actors.guard}/${crypto.randomUUID()}.jpg`,
        ),
        '42501',
      );
    });

    it('attaches up to three of the caller own uploaded photos once', async () => {
      const groupId = await groupWithMembers(fixture, MEMBERS);
      const mine = await uploadPhotos(fixture, 'owner', 4);
      await expectDomainError(
        createPost(fixture, 'owner', groupId, 'Too many photos', mine),
        'community_photo_invalid',
      );
      const othersPhoto = await uploadPhoto(fixture, 'owner2');
      await expectDomainError(
        createPost(fixture, 'owner', groupId, 'Someone else photo', [
          othersPhoto,
        ]),
        'community_photo_invalid',
      );
      const neverUploaded = await uploadPathFor(fixture, 'owner');
      await expectDomainError(
        createPost(fixture, 'owner', groupId, 'Missing object', [
          neverUploaded,
        ]),
        'community_photo_invalid',
      );
      const postId = await createPost(
        fixture,
        'owner',
        groupId,
        'Three photos',
        mine.slice(0, 3),
      );
      const photos = await query<{ storage_path: string; position: number }>(
        database,
        'select storage_path,position from public.community_photos where post_id=$1 order by position',
        [postId],
      );
      expect(photos).toEqual(
        mine.slice(0, 3).map((path, index) => ({
          storage_path: path,
          position: index + 1,
        })),
      );
      await expectDomainError(
        createListing(fixture, 'owner', {}, [mine[0]!]),
        'community_photo_invalid',
      );
      const listingId = await createListing(fixture, 'owner', {}, [mine[3]!]);
      await moderate(fixture, 'listing', listingId, 'approve');
      expect(
        (await marketplace(fixture, 'owner2')).items.find(
          (item) => item.id === listingId,
        ),
      ).toMatchObject({ firstPhotoPath: mine[3] });
      expect(
        records((await getListing(fixture, 'owner2', listingId)).photos),
      ).toEqual([expect.objectContaining({ path: mine[3], position: 1 })]);
    });

    it('lets the author replace photos while editing a pending post', async () => {
      const groupId = await groupWithMembers(fixture, ['owner']);
      const [first, second] = await uploadPhotos(fixture, 'owner', 2);
      const postId = await createPost(fixture, 'owner', groupId, 'With photo', [
        first!,
      ]);
      await call(fixture, 'owner', 'community_post_update', [
        fixture.societyId,
        postId,
        await rowVersion(fixture, 'community_posts', postId),
        'With another photo',
        [second!],
        requestId('post-update'),
      ]);
      const photos = await query<{ storage_path: string }>(
        database,
        'select storage_path from public.community_photos where post_id=$1',
        [postId],
      );
      expect(photos.map((photo) => photo.storage_path)).toEqual([second]);
    });

    it('grants photo access only to people who can see the item', async () => {
      const groupId = await groupWithMembers(fixture, ['owner', 'owner2']);
      const path = await uploadPhoto(fixture, 'owner');
      const postId = await createPost(fixture, 'owner', groupId, 'Photo post', [
        path,
      ]);
      expect(await photoAccess(fixture, 'owner', path)).toBe(true);
      expect(await photoAccess(fixture, 'admin', path)).toBe(true);
      expect(await photoAccess(fixture, 'owner2', path)).toBe(false);
      await moderate(fixture, 'post', postId, 'approve');
      expect(await photoAccess(fixture, 'owner2', path)).toBe(true);
      expect(await photoAccess(fixture, 'owner3', path)).toBe(false);

      const visibleTo = async (actor: CommunityActor) =>
        (
          await database.asRole(
            'authenticated',
            { sub: fixture.actors[actor] },
            (client) =>
              client.query(
                `select name from storage.objects where bucket_id='community-photos' and name=$1`,
                [path],
              ),
          )
        ).rows.length;
      expect(await visibleTo('owner2')).toBe(1);
      expect(await visibleTo('owner3')).toBe(0);
      expect(await visibleTo('guard')).toBe(0);

      const feedItem = (await feed(fixture, 'owner2', groupId)).items.find(
        (item) => item.id === postId,
      );
      expect(feedItem).toMatchObject({ photoPaths: [path] });
      expect(
        records((await getPost(fixture, 'owner2', postId)).photos),
      ).toEqual([expect.objectContaining({ path, position: 1 })]);
    });
  });

  describe('own items and preferences', () => {
    it('lists every status of the caller own posts and listings', async () => {
      const groupId = await groupWithMembers(
        fixture,
        ['owner4'],
        'Synthetic mine group',
      );
      const pendingPost = await createPost(fixture, 'owner4', groupId);
      const rejectedPost = await createPost(fixture, 'owner4', groupId);
      await moderate(
        fixture,
        'post',
        rejectedPost,
        'reject',
        'Synthetic reason',
      );
      const listing = await approvedListing(fixture, 'owner4');
      await call(fixture, 'owner4', 'community_listing_close', [
        fixture.societyId,
        listing,
        requestId('close'),
      ]);
      const mine = await call(fixture, 'owner4', 'community_my_items', [
        fixture.societyId,
      ]);
      const posts = records(mine.posts);
      expect(posts.find((post) => post.id === pendingPost)).toMatchObject({
        status: 'pending',
        groupName: 'Synthetic mine group',
      });
      expect(posts.find((post) => post.id === rejectedPost)).toMatchObject({
        status: 'rejected',
      });
      expect(
        records(mine.listings).find((item) => item.id === listing),
      ).toMatchObject({ status: 'approved', closed: true, expired: false });
      const other = await call(fixture, 'owner3', 'community_my_items', [
        fixture.societyId,
      ]);
      expect(records(other.posts).some((post) => post.id === pendingPost)).toBe(
        false,
      );
    });

    it('stores the new-listing alert preference per member', async () => {
      expect(
        await call(fixture, 'tenant', 'community_preferences_set', [
          fixture.societyId,
          false,
          requestId('prefs'),
        ]),
      ).toEqual({ newListingAlerts: false });
      expect(await home('tenant')).toMatchObject({
        preferences: { newListingAlerts: false },
      });
      expect(await home('owner')).toMatchObject({
        preferences: { newListingAlerts: true },
      });
      await expectCode(
        call(fixture, 'tenant', 'community_preferences_set', [
          fixture.societyId,
          null,
          requestId('prefs'),
        ]),
        '22023',
      );
      await call(fixture, 'tenant', 'community_preferences_set', [
        fixture.societyId,
        true,
        requestId('prefs'),
      ]);
    });

    it('does not let the raw function return values leak across societies', async () => {
      await expectCode(
        callRaw(fixture, 'outsider', 'community_marketplace', [
          fixture.societyId,
          null,
          null,
          10,
          0,
        ]),
        '42501',
      );
    });
  });
});
