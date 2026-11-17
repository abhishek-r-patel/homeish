// Verify the admin queue, reports with distinct-flat auto-hide, restore/remove, mutes and notification fan-out.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addBulkMembers,
  adminQueue,
  approvedListing,
  approvedPost,
  auditRows,
  call,
  createCommunityFixture,
  createListing,
  createPost,
  createReply,
  expectCode,
  expectDomainError,
  feed,
  getListing,
  getPost,
  groupWithMembers,
  insertStorageObject,
  marketplace,
  moderate,
  mute,
  notificationsFor,
  query,
  records,
  report,
  requestId,
  rowStatus,
  rowVersion,
  unmute,
  uploadPathFor,
  withReplicaRole,
  type CommunityActor,
  type CommunityFixture,
} from './support/community-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

const MEMBERS: CommunityActor[] = [
  'owner',
  'tenant',
  'family',
  'owner2',
  'multi',
  'owner3',
  'owner4',
  'committeeResident',
];

describe.skipIf(!hasDatabase)('community moderation database contracts', () => {
  let database: TestDatabase;
  let fixture: CommunityFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createCommunityFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  const reportStatuses = async (column: string, id: string) =>
    (
      await query<{ status: string }>(
        database,
        `select status from public.community_reports where ${column}=$1 order by status`,
        [id],
      )
    ).map((row) => row.status);

  const adminItem = (targetType: string, targetId: string) =>
    call(fixture, 'admin', 'community_admin_item_get', [
      fixture.societyId,
      targetType,
      targetId,
    ]);

  describe('admin queue', () => {
    it('lists pending posts and listings with author details for the admin', async () => {
      const groupId = await groupWithMembers(fixture, ['owner2']);
      const longBody = `Synthetic queue post ${'x'.repeat(400)}`;
      const postId = await createPost(fixture, 'owner2', groupId, longBody);
      const listingId = await createListing(fixture, 'owner3', {
        title: 'Synthetic queue listing',
      });
      const queue = await adminQueue(fixture, 'pending');
      const post = queue.items.find((item) => item.targetId === postId);
      expect(post).toMatchObject({
        targetType: 'post',
        authorName: fixture.names.owner2,
        authorUnitLabel: 'A-201',
        authorMembershipId: fixture.memberships.owner2,
        status: 'pending',
        openReports: 0,
      });
      const excerpt = String(post!.excerpt ?? post!.title);
      expect(excerpt.length).toBeLessThanOrEqual(200);
      expect(excerpt.startsWith('Synthetic queue post')).toBe(true);
      expect(
        queue.items.find((item) => item.targetId === listingId),
      ).toMatchObject({
        targetType: 'listing',
        authorName: fixture.names.owner3,
        authorUnitLabel: 'B-101',
        status: 'pending',
      });
      expect(queue.total).toBeGreaterThanOrEqual(2);
      await expectCode(adminQueue(fixture, 'everything' as never), '22023');
      expect((await adminItem('post', postId)).item).toMatchObject({
        body: longBody,
      });
      expect((await adminItem('post', postId)).authorMute).toBeNull();
    });
  });

  describe('reports', () => {
    it('validates reports and refuses own, unseen and repeat reports from the same person or flat', async () => {
      const groupId = await groupWithMembers(fixture, MEMBERS);
      const pending = await createPost(fixture, 'owner3', groupId);
      await expectCode(report(fixture, 'owner', 'post', pending), 'P0002');
      const postId = await approvedPost(fixture, 'owner3', groupId);
      await expectDomainError(
        report(fixture, 'owner3', 'post', postId),
        'community_own_item',
      );
      await expectCode(
        report(fixture, 'owner', 'post', postId, 'boring'),
        '22023',
      );
      await expectCode(
        report(fixture, 'owner', 'post', postId, 'other', 'n'.repeat(501)),
        '22023',
      );
      expect(
        await report(
          fixture,
          'owner',
          'post',
          postId,
          'offensive',
          'Synthetic note',
        ),
      ).toMatchObject({ reportId: expect.any(String), hidden: false });
      await expectDomainError(
        report(fixture, 'owner', 'post', postId),
        'community_already_reported',
      );
      // Same flat (A-101) as the first reporter.
      await expectDomainError(
        report(fixture, 'tenant', 'post', postId),
        'community_already_reported',
      );
      expect((await getPost(fixture, 'owner', postId)).reportedByMe).toBe(true);
      expect((await getPost(fixture, 'owner2', postId)).reportedByMe).toBe(
        false,
      );
      const outsiderGroup = await groupWithMembers(fixture, ['owner2']);
      const unseen = await approvedPost(fixture, 'owner2', outsiderGroup);
      await expectCode(report(fixture, 'owner', 'post', unseen), [
        'P0002',
        'P0001',
      ]);
    });

    it('hides an item automatically once three different flats report it, and the admin can restore it', async () => {
      const groupId = await groupWithMembers(fixture, MEMBERS);
      const postId = await approvedPost(fixture, 'owner3', groupId);
      expect(await report(fixture, 'owner', 'post', postId)).toMatchObject({
        hidden: false,
      });
      // multi's first flat by label is A-201, so owner2 (A-201) counts as the same flat.
      expect(
        await report(fixture, 'multi', 'post', postId, 'scam'),
      ).toMatchObject({ hidden: false });
      await expectDomainError(
        report(fixture, 'owner2', 'post', postId),
        'community_already_reported',
      );
      expect(await rowStatus(database, 'community_posts', postId)).toBe(
        'approved',
      );
      const reported = await adminQueue(fixture, 'reported');
      expect(
        reported.items.find((item) => item.targetId === postId),
      ).toMatchObject({ openReports: 2, status: 'approved' });

      const hideRequest = requestId('report-hide');
      expect(
        await report(
          fixture,
          'owner4',
          'post',
          postId,
          'other',
          null,
          hideRequest,
        ),
      ).toMatchObject({ hidden: true });
      expect(await rowStatus(database, 'community_posts', postId)).toBe(
        'hidden',
      );
      const notified = (await notificationsFor(database, hideRequest)).map(
        (row) => row.user_id,
      );
      expect(notified).toContain(fixture.actors.owner3);
      expect(notified).toContain(fixture.actors.admin);
      expect(notified).not.toContain(fixture.actors.owner4);

      expect(
        (await feed(fixture, 'owner', groupId)).items.some(
          (item) => item.id === postId,
        ),
      ).toBe(false);
      await expectCode(getPost(fixture, 'owner', postId), 'P0002');
      expect(
        (await feed(fixture, 'owner3', groupId)).items.find(
          (item) => item.id === postId,
        ),
      ).toMatchObject({ status: 'hidden', mine: true });
      const hidden = await adminQueue(fixture, 'hidden');
      expect(
        hidden.items.find((item) => item.targetId === postId),
      ).toMatchObject({ status: 'hidden', openReports: 3 });
      const detail = await adminItem('post', postId);
      expect(
        records(detail.reports)
          .map((row) => row.reporterUnitLabel)
          .sort(),
      ).toEqual(['A-101', 'A-201', 'B-201']);
      expect(
        records(detail.reports).every((row) => row.status === 'open'),
      ).toBe(true);

      await expectDomainError(
        moderate(fixture, 'post', postId, 'approve'),
        'community_invalid_state',
      );
      expect(await moderate(fixture, 'post', postId, 'restore')).toMatchObject({
        targetId: postId,
        status: 'approved',
      });
      expect(await reportStatuses('post_id', postId)).toEqual([
        'dismissed',
        'dismissed',
        'dismissed',
      ]);
      expect(
        (await feed(fixture, 'owner', groupId)).items.some(
          (item) => item.id === postId,
        ),
      ).toBe(true);
      expect(
        (await adminQueue(fixture, 'reported')).items.some(
          (item) => item.targetId === postId,
        ),
      ).toBe(false);
      await expectDomainError(
        moderate(fixture, 'post', postId, 'restore'),
        'community_invalid_state',
      );
    });

    it('lets the admin remove a reported item with a reason, actioning its reports', async () => {
      const groupId = await groupWithMembers(fixture, MEMBERS);
      const postId = await approvedPost(
        fixture,
        'owner3',
        groupId,
        'Synthetic removable zqxremove',
      );
      await report(fixture, 'owner', 'post', postId);
      await expectCode(moderate(fixture, 'post', postId, 'remove'), '22023');
      const removeRequest = requestId('remove');
      expect(
        await moderate(
          fixture,
          'post',
          postId,
          'remove',
          'Synthetic rule breach',
          removeRequest,
        ),
      ).toMatchObject({ targetId: postId, status: 'removed' });
      expect(await reportStatuses('post_id', postId)).toEqual(['actioned']);
      expect(await notificationsFor(database, removeRequest)).toEqual([
        expect.objectContaining({ user_id: fixture.actors.owner3 }),
      ]);
      const audit = await auditRows(database, removeRequest);
      expect(audit.some((row) => row.action.startsWith('community.'))).toBe(
        true,
      );
      expect(JSON.stringify(audit.map((row) => row.after))).not.toContain(
        'zqxremove',
      );
      expect(
        (await feed(fixture, 'owner', groupId)).items.some(
          (item) => item.id === postId,
        ),
      ).toBe(false);
      expect((await getPost(fixture, 'owner3', postId)).post).toMatchObject({
        status: 'removed',
        moderationReason: 'Synthetic rule breach',
      });
      expect(
        (await adminQueue(fixture, 'removed')).items.some(
          (item) => item.targetId === postId,
        ),
      ).toBe(true);
      await expectDomainError(
        moderate(fixture, 'post', postId, 'remove', 'Again'),
        'community_invalid_state',
      );
      const pending = await createPost(fixture, 'owner3', groupId);
      await expectDomainError(
        moderate(fixture, 'post', pending, 'remove', 'Synthetic reason'),
        'community_invalid_state',
      );
    });

    it('auto-hides and restores replies, and removes them on request', async () => {
      const groupId = await groupWithMembers(fixture, MEMBERS);
      const postId = await approvedPost(fixture, 'owner', groupId);
      const replyId = await createReply(fixture, 'owner3', 'post', postId);
      // Replies are never pre-moderated, so approving one is not a valid action.
      await expectCode(moderate(fixture, 'reply', replyId, 'approve'), [
        '22023',
        'P0001',
      ]);
      await report(fixture, 'owner', 'reply', replyId);
      await report(fixture, 'owner2', 'reply', replyId);
      expect(await report(fixture, 'owner4', 'reply', replyId)).toMatchObject({
        hidden: true,
      });
      expect(await rowStatus(database, 'community_replies', replyId)).toBe(
        'hidden',
      );
      expect(
        records((await getPost(fixture, 'owner2', postId)).replies).some(
          (reply) => reply.id === replyId,
        ),
      ).toBe(false);
      expect(
        await moderate(fixture, 'reply', replyId, 'restore'),
      ).toMatchObject({ targetId: replyId, status: 'visible' });
      expect(
        records((await getPost(fixture, 'owner2', postId)).replies).some(
          (reply) => reply.id === replyId,
        ),
      ).toBe(true);
      expect(
        await moderate(fixture, 'reply', replyId, 'remove', 'Synthetic reason'),
      ).toMatchObject({ targetId: replyId, status: 'removed' });
      expect(
        records((await getPost(fixture, 'owner2', postId)).replies).some(
          (reply) => reply.id === replyId && reply.status === 'visible',
        ),
      ).toBe(false);
    });

    it('auto-hides listings from the marketplace', async () => {
      const listingId = await approvedListing(fixture, 'owner');
      await report(fixture, 'owner2', 'listing', listingId);
      await report(fixture, 'owner3', 'listing', listingId);
      await report(fixture, 'owner4', 'listing', listingId);
      expect(await rowStatus(database, 'community_listings', listingId)).toBe(
        'hidden',
      );
      expect(
        (await marketplace(fixture, 'family')).items.some(
          (item) => item.id === listingId,
        ),
      ).toBe(false);
      await expectCode(getListing(fixture, 'family', listingId), 'P0002');
      await moderate(fixture, 'listing', listingId, 'restore');
      expect(
        (await marketplace(fixture, 'family')).items.some(
          (item) => item.id === listingId,
        ),
      ).toBe(true);
    });
  });

  describe('mutes', () => {
    it('blocks a muted resident from writing but not reading, and replaces an existing mute', async () => {
      const groupId = await groupWithMembers(fixture, ['owner2', 'owner']);
      const existing = await approvedPost(fixture, 'owner', groupId);
      const listingId = await approvedListing(fixture, 'owner');
      const pendingUpload = await uploadPathFor(fixture, 'owner2');

      await expectCode(mute(fixture, 'owner2', '1d' as never), '22023');
      await expectCode(mute(fixture, 'owner2', '7d', ''), '22023');
      await expectCode(mute(fixture, 'owner2', '7d', 'r'.repeat(501)), '22023');

      const muteRequest = requestId('mute');
      const muted = await mute(
        fixture,
        'owner2',
        '7d',
        'Synthetic cool-off',
        muteRequest,
      );
      expect(muted.muteId).toEqual(expect.any(String));
      const until = new Date(String(muted.mutedUntil)).getTime();
      expect(until - Date.now()).toBeGreaterThan(6.9 * 86_400_000);
      expect(until - Date.now()).toBeLessThan(7.1 * 86_400_000);
      expect(await notificationsFor(database, muteRequest)).toEqual([
        expect.objectContaining({ user_id: fixture.actors.owner2 }),
      ]);

      const { detail } = await expectDomainError(
        createPost(fixture, 'owner2', groupId),
        'community_muted',
      );
      expect(detail).toBeTruthy();
      await expectDomainError(
        createListing(fixture, 'owner2'),
        'community_muted',
      );
      await expectDomainError(
        createReply(fixture, 'owner2', 'post', existing),
        'community_muted',
      );
      await expectDomainError(
        createReply(fixture, 'owner2', 'listing', listingId),
        'community_muted',
      );
      await expectDomainError(
        uploadPathFor(fixture, 'owner2'),
        'community_muted',
      );
      await expectCode(
        insertStorageObject(fixture, fixture.actors.owner2, pendingUpload),
        '42501',
      );

      expect(
        (await feed(fixture, 'owner2', groupId)).items.some(
          (item) => item.id === existing,
        ),
      ).toBe(true);
      await getListing(fixture, 'owner2', listingId);
      const home = await call(fixture, 'owner2', 'community_home', [
        fixture.societyId,
      ]);
      expect(home.myMute).toMatchObject({
        untilLifted: false,
        reason: 'Synthetic cool-off',
      });

      const replaced = await mute(
        fixture,
        'owner2',
        'until_lifted',
        'Synthetic longer',
      );
      expect(replaced.mutedUntil).toBeNull();
      const active = await query<{ duration: string }>(
        database,
        `select duration from public.community_mutes
         where society_id=$1 and membership_id=$2 and lifted_at is null`,
        [fixture.societyId, fixture.memberships.owner2],
      );
      expect(active).toEqual([{ duration: 'until_lifted' }]);
      const { detail: liftDetail } = await expectDomainError(
        createPost(fixture, 'owner2', groupId),
        'community_muted',
      );
      expect(liftDetail?.toLowerCase()).toContain('until lifted');
      expect(
        (await call(fixture, 'owner2', 'community_home', [fixture.societyId]))
          .myMute,
      ).toMatchObject({ mutedUntil: null, untilLifted: true });
      const list = records(
        (
          await call(fixture, 'admin', 'community_admin_mutes', [
            fixture.societyId,
          ])
        ).items,
      ).filter((row) => row.membershipId === fixture.memberships.owner2);
      expect(list).toEqual([
        expect.objectContaining({
          name: fixture.names.owner2,
          unitLabel: 'A-201',
          duration: 'until_lifted',
          mutedUntil: null,
          reason: 'Synthetic longer',
        }),
      ]);

      const unmuteRequest = requestId('unmute');
      expect(await unmute(fixture, 'owner2', unmuteRequest)).toEqual({
        lifted: true,
      });
      expect(await notificationsFor(database, unmuteRequest)).toEqual([
        expect.objectContaining({ user_id: fixture.actors.owner2 }),
      ]);
      expect(await unmute(fixture, 'owner2')).toEqual({ lifted: false });
      await createPost(fixture, 'owner2', groupId);
      expect(
        (await call(fixture, 'owner2', 'community_home', [fixture.societyId]))
          .myMute,
      ).toBeNull();
      expect(
        records(
          (
            await call(fixture, 'admin', 'community_admin_mutes', [
              fixture.societyId,
            ])
          ).items,
        ).some((row) => row.membershipId === fixture.memberships.owner2),
      ).toBe(false);
    });

    it('lets a timed mute expire on its own', async () => {
      const groupId = await groupWithMembers(fixture, ['owner4']);
      await mute(fixture, 'owner4', '30d');
      await expectDomainError(
        createPost(fixture, 'owner4', groupId),
        'community_muted',
      );
      const othersListing = await createListing(fixture, 'owner');
      expect((await adminItem('listing', othersListing)).authorMute).toBeNull();

      await withReplicaRole(
        database,
        `update public.community_mutes set created_at = now() - interval '31 days',
           muted_until = now() - interval '1 minute'
         where society_id=$1 and membership_id=$2 and lifted_at is null`,
        [fixture.societyId, fixture.memberships.owner4],
      );
      await createPost(fixture, 'owner4', groupId);
      expect(
        (await call(fixture, 'owner4', 'community_home', [fixture.societyId]))
          .myMute,
      ).toBeNull();
      expect(
        records(
          (
            await call(fixture, 'admin', 'community_admin_mutes', [
              fixture.societyId,
            ])
          ).items,
        ).some((row) => row.membershipId === fixture.memberships.owner4),
      ).toBe(false);
    });

    it('shows the author mute on the admin item view and offers members to mute', async () => {
      const groupId = await groupWithMembers(fixture, ['family']);
      const postId = await createPost(fixture, 'family', groupId);
      await mute(fixture, 'family', '7d', 'Synthetic family mute');
      expect((await adminItem('post', postId)).authorMute).toMatchObject({
        reason: 'Synthetic family mute',
      });
      await unmute(fixture, 'family');

      const options = records(
        (
          await call(fixture, 'admin', 'community_member_options', [
            fixture.societyId,
            'owner2',
            20,
          ])
        ).items,
      );
      expect(options).toContainEqual(
        expect.objectContaining({
          membershipId: fixture.memberships.owner2,
          name: fixture.names.owner2,
          unitLabel: 'A-201',
        }),
      );
      expect(
        options.some((row) => row.membershipId === fixture.memberships.guard),
      ).toBe(false);
      await expectCode(
        call(fixture, 'owner', 'community_member_options', [
          fixture.societyId,
          null,
          20,
        ]),
        '42501',
      );
      await expectCode(
        call(fixture, 'committee', 'community_admin_mutes', [
          fixture.societyId,
        ]),
        '42501',
      );
    });

    const getSettings = () =>
      call(fixture, 'admin', 'community_settings_get', [fixture.societyId]);
    const saveSettings = async (settings: Record<string, unknown>) =>
      call(fixture, 'admin', 'community_settings_update', [
        fixture.societyId,
        settings,
        (await getSettings()).updatedAt,
        requestId('settings'),
      ]);
    const NO_EXCEPTIONS = {
      muted_can_edit_pending: false,
      muted_can_report: false,
      muted_can_renew: false,
    };

    it('lets the admin settings decide what a muted resident may still do', async () => {
      const groupId = await groupWithMembers(fixture, ['owner', 'owner4']);
      const othersPost = await approvedPost(fixture, 'owner', groupId);
      const othersListing = await approvedListing(fixture, 'owner');
      const pendingPost = await createPost(fixture, 'owner4', groupId);
      const pendingListing = await createListing(fixture, 'owner4');
      const liveListing = await approvedListing(fixture, 'owner4');
      const closable = await approvedListing(fixture, 'owner4');
      const withdrawablePost = await createPost(fixture, 'owner4', groupId);
      const withdrawableListing = await createListing(fixture, 'owner4');
      const editPost = async () =>
        call(fixture, 'owner4', 'community_post_update', [
          fixture.societyId,
          pendingPost,
          await rowVersion(fixture, 'community_posts', pendingPost),
          'Synthetic edited body',
          null,
          requestId('post-update'),
        ]);
      const editListing = async () =>
        call(fixture, 'owner4', 'community_listing_update', [
          fixture.societyId,
          pendingListing,
          await rowVersion(fixture, 'community_listings', pendingListing),
          { listingType: 'wanted', title: 'Synthetic edited listing' },
          null,
          requestId('listing-update'),
        ]);
      const renew = () =>
        call(fixture, 'owner4', 'community_listing_renew', [
          fixture.societyId,
          liveListing,
          requestId('renew'),
        ]);

      expect(await getSettings()).toMatchObject({ settings: NO_EXCEPTIONS });
      await mute(fixture, 'owner4', '7d');
      try {
        await expectDomainError(editPost(), 'community_muted');
        await expectDomainError(editListing(), 'community_muted');
        await expectDomainError(
          report(fixture, 'owner4', 'post', othersPost),
          'community_muted',
        );
        await expectDomainError(renew(), 'community_muted');
        expect(
          (await getPost(fixture, 'owner4', pendingPost)).myMute,
        ).toMatchObject({
          untilLifted: false,
          canEditPending: false,
          canReport: false,
          canRenew: false,
        });

        // Deleting and closing stay available whatever the settings say.
        await call(fixture, 'owner4', 'community_post_withdraw', [
          fixture.societyId,
          withdrawablePost,
          requestId('post-withdraw'),
        ]);
        await call(fixture, 'owner4', 'community_listing_withdraw', [
          fixture.societyId,
          withdrawableListing,
          requestId('listing-withdraw'),
        ]);
        await call(fixture, 'owner4', 'community_listing_close', [
          fixture.societyId,
          closable,
          requestId('listing-close'),
        ]);

        expect(
          await saveSettings({ muted_can_edit_pending: true }),
        ).toMatchObject({
          settings: { ...NO_EXCEPTIONS, muted_can_edit_pending: true },
        });
        await editPost();
        await editListing();
        await expectDomainError(
          report(fixture, 'owner4', 'listing', othersListing),
          'community_muted',
        );
        await expectDomainError(renew(), 'community_muted');

        await saveSettings({ muted_can_report: true, muted_can_renew: true });
        await report(fixture, 'owner4', 'listing', othersListing);
        await renew();
        expect(
          (await getListing(fixture, 'owner4', liveListing)).myMute,
        ).toMatchObject({
          canEditPending: true,
          canReport: true,
          canRenew: true,
        });
        // Settings never let a muted resident create anything.
        await expectDomainError(
          createPost(fixture, 'owner4', groupId),
          'community_muted',
        );
      } finally {
        await saveSettings(NO_EXCEPTIONS);
        await unmute(fixture, 'owner4');
      }
      expect((await getPost(fixture, 'owner4', pendingPost)).myMute).toBeNull();
    });

    it('validates the settings, refuses stale saves and is admin only', async () => {
      const before = await getSettings();
      await expectCode(saveSettings({ muted_can_mute: true }), '22023');
      await expectCode(saveSettings({ muted_can_report: 'yes' }), '22023');
      await expectCode(
        call(fixture, 'admin', 'community_settings_update', [
          fixture.societyId,
          '[]',
          before.updatedAt,
          requestId('settings'),
        ]),
        '22023',
      );
      const saveRequest = requestId('settings');
      const saved = await call(fixture, 'admin', 'community_settings_update', [
        fixture.societyId,
        { muted_can_report: true },
        before.updatedAt,
        saveRequest,
      ]);
      expect(saved.updatedAt).not.toEqual(before.updatedAt);
      expect(
        (await auditRows(database, saveRequest)).map((row) => row.action),
      ).toContain('community.settings.update');
      await expectCode(
        call(fixture, 'admin', 'community_settings_update', [
          fixture.societyId,
          { muted_can_report: false },
          before.updatedAt,
          requestId('settings'),
        ]),
        '40001',
      );
      for (const actor of ['committee', 'owner'] as const) {
        await expectCode(
          call(fixture, actor, 'community_settings_get', [fixture.societyId]),
          '42501',
        );
        await expectCode(
          call(fixture, actor, 'community_settings_update', [
            fixture.societyId,
            NO_EXCEPTIONS,
            saved.updatedAt,
            requestId('settings'),
          ]),
          '42501',
        );
      }
      await expectCode(
        query(
          database,
          `update public.module_configs set settings='{"muted_can_renew":1}'
           where society_id=$1 and module_key='community'`,
          [fixture.societyId],
        ),
        '23514',
      );
      await saveSettings(NO_EXCEPTIONS);
    });
  });

  describe('restore notifications', () => {
    it('tells only the author when a hidden post or reply is visible again', async () => {
      const groupId = await groupWithMembers(fixture, MEMBERS);
      const postId = await approvedPost(fixture, 'owner3', groupId);
      const replyId = await createReply(fixture, 'owner3', 'post', postId);
      // Reply first: a reply cannot be reported once its post is hidden.
      for (const target of [
        ['reply', replyId],
        ['post', postId],
      ] as const) {
        for (const actor of ['owner', 'owner2', 'owner4'] as const) {
          await report(fixture, actor, target[0], target[1]);
        }
      }
      const postRequest = requestId('restore-post');
      await moderate(fixture, 'post', postId, 'restore', null, postRequest);
      const replyRequest = requestId('restore-reply');
      await moderate(fixture, 'reply', replyId, 'restore', null, replyRequest);
      for (const request of [postRequest, replyRequest]) {
        expect(await notificationsFor(database, request)).toEqual([
          {
            user_id: fixture.actors.owner3,
            entity_type: 'community_post',
            entity_id: postId,
          },
        ]);
      }
      expect(
        await query(
          database,
          `select type,title from public.notifications
           where request_id=any($1::text[]) order by title`,
          [[postRequest, replyRequest]],
        ),
      ).toEqual([
        { type: 'community_restored', title: 'Your post is visible again' },
        { type: 'community_restored', title: 'Your reply is visible again' },
      ]);
    });
  });

  describe('notifications', () => {
    it('alerts residents about a newly approved listing, skipping the author and anyone who opted out', async () => {
      await call(fixture, 'tenant', 'community_preferences_set', [
        fixture.societyId,
        false,
        requestId('prefs'),
      ]);
      const approveRequest = requestId('listing-approve');
      const listingId = await approvedListing(
        fixture,
        'owner3',
        {},
        [],
        approveRequest,
      );
      const rows = await notificationsFor(database, approveRequest);
      expect(
        rows.every(
          (row) =>
            row.entity_type === 'community_listing' &&
            row.entity_id === listingId,
        ),
      ).toBe(true);
      const users = rows.map((row) => row.user_id);
      for (const actor of [
        'owner',
        'family',
        'owner2',
        'multi',
        'owner4',
        'committeeResident',
      ] as const) {
        expect(
          users.filter((user) => user === fixture.actors[actor]),
        ).toHaveLength(1);
      }
      // One approval notice for the author, no new-listing alert.
      expect(
        users.filter((user) => user === fixture.actors.owner3),
      ).toHaveLength(1);
      for (const actor of [
        'tenant',
        'admin',
        'committee',
        'guard',
        'hkSupervisor',
        'outsider',
        'foreignAdmin',
      ] as const) {
        expect(users).not.toContain(fixture.actors[actor]);
      }

      const groupId = await groupWithMembers(fixture, MEMBERS);
      const postApprove = requestId('post-approve');
      const postId = await createPost(fixture, 'owner', groupId);
      await moderate(fixture, 'post', postId, 'approve', null, postApprove);
      expect(
        (await notificationsFor(database, postApprove)).map(
          (row) => row.user_id,
        ),
      ).toEqual([fixture.actors.owner]);
      await call(fixture, 'tenant', 'community_preferences_set', [
        fixture.societyId,
        true,
        requestId('prefs'),
      ]);
    });

    it('caps the new-listing alert fan-out at 2000 and the admin fan-out at 50', async () => {
      const big = await createCommunityFixture(database);
      await addBulkMembers(big, 2005, 55);
      const createRequest = requestId('cap-create');
      const listingId = await createListing(
        big,
        'owner',
        {},
        [],
        crypto.randomUUID(),
        createRequest,
      );
      const adminNotes = await notificationsFor(database, createRequest);
      expect(adminNotes).toHaveLength(50);
      expect(
        adminNotes.every((row) => row.entity_type === 'community_admin'),
      ).toBe(true);

      const approveRequest = requestId('cap-approve');
      await moderate(
        big,
        'listing',
        listingId,
        'approve',
        null,
        approveRequest,
        'admin',
      );
      const alerts = (await notificationsFor(database, approveRequest)).filter(
        (row) => row.user_id !== big.actors.owner,
      );
      expect(alerts).toHaveLength(2000);
      expect(new Set(alerts.map((row) => row.user_id)).size).toBe(2000);
    }, 120_000);
  });
});
