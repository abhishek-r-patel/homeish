// Verify the community retention job: due rows and files only, cascades, audit summaries and service-role gating.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  approvedListing,
  approvedPost,
  call,
  callService,
  createCommunityFixture,
  createListing,
  createPost,
  createReply,
  expectCode,
  groupWithMembers,
  moderate,
  query,
  report,
  requestId,
  retentionFiles,
  setModule,
  societyToday,
  uploadPhoto,
  withReplicaRole,
  type CommunityFixture,
} from './support/community-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('community retention database contracts', () => {
  let database: TestDatabase;
  let fixture: CommunityFixture;
  let other: CommunityFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createCommunityFixture(database);
    other = await createCommunityFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  const ageItem = (
    table: 'community_posts' | 'community_listings',
    id: string,
    days: number,
  ) =>
    withReplicaRole(
      database,
      `update public.${table}
       set status_changed_at = now() - make_interval(days => $2::int),
           moderated_at = case when moderated_at is null then null
             else now() - make_interval(days => $2::int) end,
           updated_at = now() - make_interval(days => $2::int)
       where id=$1`,
      [id, days],
    );

  const ageReply = (id: string, days: number) =>
    withReplicaRole(
      database,
      `update public.community_replies
       set status_changed_at = now() - make_interval(days => $2::int),
           moderated_at = case when moderated_at is null then null
             else now() - make_interval(days => $2::int) end
       where id=$1`,
      [id, days],
    );

  const exists = async (table: string, id: string) =>
    (await query(database, `select 1 from public.${table} where id=$1`, [id]))
      .length === 1;

  const photoRows = async (paths: string[]) =>
    (
      await query<{ storage_path: string }>(
        database,
        'select storage_path from public.community_photos where storage_path = any($1)',
        [paths],
      )
    ).map((row) => row.storage_path);

  const run = (trace: string, today = societyToday()) =>
    callService(database, 'community_retention_run', [today, trace]);

  it('is available to the service role only and validates its arguments', async () => {
    await expectCode(
      call(fixture, 'admin', 'community_retention_run', [
        societyToday(),
        'synthetic-trace',
      ]),
      '42501',
    );
    await expectCode(
      database.asRole(
        'authenticated',
        { sub: fixture.actors.admin },
        (client) =>
          client.query(
            'select * from public.community_retention_files_list($1)',
            [societyToday()],
          ),
      ),
      '42501',
    );
    await expectCode(run('synthetic-trace', null as never), '22023');
    await expectCode(run(''), '22023');
    await expectCode(run('t'.repeat(129)), '22023');
  });

  it('lists and deletes only content and files that are due, keeping audit history', async () => {
    const groupId = await groupWithMembers(fixture, [
      'owner',
      'owner2',
      'owner3',
    ]);

    // Due: removed 31 days ago, with a photo, a reply and a report that must cascade.
    const removedPhoto = await uploadPhoto(fixture, 'owner');
    const removedPost = await approvedPost(fixture, 'owner', groupId, 'Old', [
      removedPhoto,
    ]);
    const cascadeReply = await createReply(
      fixture,
      'owner2',
      'post',
      removedPost,
    );
    await report(fixture, 'owner2', 'post', removedPost);
    const removeRequest = requestId('retention-remove');
    await moderate(
      fixture,
      'post',
      removedPost,
      'remove',
      'Synthetic removal',
      removeRequest,
    );
    await ageItem('community_posts', removedPost, 31);

    // Not yet due: removed 5 days ago.
    const recentPhoto = await uploadPhoto(fixture, 'owner');
    const recentRemoved = await approvedPost(
      fixture,
      'owner',
      groupId,
      'Recent',
      [recentPhoto],
    );
    await moderate(
      fixture,
      'post',
      recentRemoved,
      'remove',
      'Synthetic removal',
    );
    await ageItem('community_posts', recentRemoved, 5);

    // Due: rejected listing with a photo, and a withdrawn listing.
    const rejectedPhoto = await uploadPhoto(fixture, 'owner2');
    const rejectedListing = await createListing(fixture, 'owner2', {}, [
      rejectedPhoto,
    ]);
    await moderate(
      fixture,
      'listing',
      rejectedListing,
      'reject',
      'Synthetic rejection',
    );
    await ageItem('community_listings', rejectedListing, 31);
    const withdrawnPhoto = await uploadPhoto(fixture, 'owner3');
    const withdrawnListing = await createListing(fixture, 'owner3', {}, [
      withdrawnPhoto,
    ]);
    await call(fixture, 'owner3', 'community_listing_withdraw', [
      fixture.societyId,
      withdrawnListing,
      requestId('withdraw'),
    ]);
    await ageItem('community_listings', withdrawnListing, 40);

    // Not due: a withdrawn post from today, an old approved post and a long-expired listing.
    const recentWithdrawn = await createPost(fixture, 'owner', groupId);
    await call(fixture, 'owner', 'community_post_withdraw', [
      fixture.societyId,
      recentWithdrawn,
      requestId('withdraw'),
    ]);
    const keptPhoto = await uploadPhoto(fixture, 'owner');
    const oldApproved = await approvedPost(fixture, 'owner', groupId, 'Kept', [
      keptPhoto,
    ]);
    await ageItem('community_posts', oldApproved, 60);
    await withReplicaRole(
      database,
      `update public.community_posts set created_at = now() - interval '60 days' where id=$1`,
      [oldApproved],
    );
    const expiredPhoto = await uploadPhoto(fixture, 'owner3');
    const expiredListing = await approvedListing(fixture, 'owner3', {}, [
      expiredPhoto,
    ]);
    await withReplicaRole(
      database,
      `update public.community_listings
       set approved_at = now() - interval '70 days', expires_at = now() - interval '40 days'
       where id=$1`,
      [expiredListing],
    );

    // Replies removed long ago are due; recently removed ones are not.
    const oldReply = await createReply(fixture, 'owner2', 'post', oldApproved);
    await call(fixture, 'owner2', 'community_reply_delete', [
      fixture.societyId,
      oldReply,
      requestId('reply-delete'),
    ]);
    await ageReply(oldReply, 31);
    const recentReply = await createReply(
      fixture,
      'owner3',
      'post',
      oldApproved,
    );
    await moderate(fixture, 'reply', recentReply, 'remove', 'Synthetic reason');
    const visibleReply = await createReply(
      fixture,
      'owner',
      'post',
      oldApproved,
    );

    // Unattached uploads: one two days old (due), one fresh.
    const staleOrphan = await uploadPhoto(fixture, 'owner2');
    const freshOrphan = await uploadPhoto(fixture, 'owner2');
    await database.asSuperuser((client) =>
      client.query(
        `update storage.objects set created_at = now() - interval '2 days'
         where bucket_id='community-photos' and name=$1`,
        [staleOrphan],
      ),
    );

    // Another society with the module switched off still gets its due content cleaned up.
    const otherGroup = await groupWithMembers(other, ['owner']);
    const otherPhoto = await uploadPhoto(other, 'owner');
    const otherPost = await createPost(other, 'owner', otherGroup, 'Other', [
      otherPhoto,
    ]);
    await moderate(other, 'post', otherPost, 'reject', 'Synthetic rejection');
    await ageItem('community_posts', otherPost, 31);
    await setModule(other, false);

    const listed = await retentionFiles(database, societyToday());
    expect(listed.every((row) => row.bucket === 'community-photos')).toBe(true);
    const paths = listed.map((row) => row.path);
    for (const due of [
      removedPhoto,
      rejectedPhoto,
      withdrawnPhoto,
      staleOrphan,
      otherPhoto,
    ]) {
      expect(paths).toContain(due);
    }
    for (const kept of [recentPhoto, keptPhoto, expiredPhoto, freshOrphan]) {
      expect(paths).not.toContain(kept);
    }

    // The app deletes the listed files before running the row clean-up.
    await database.asSuperuser((client) =>
      client.query(
        `delete from storage.objects where bucket_id='community-photos' and name = any($1)`,
        [paths],
      ),
    );
    const trace = `synthetic-retention-${crypto.randomUUID()}`;
    const result = await run(trace);
    expect(result).toMatchObject({ postsDeleted: 2, listingsDeleted: 2 });
    expect(Number(result.repliesDeleted)).toBeGreaterThanOrEqual(1);

    for (const [table, id] of [
      ['community_posts', removedPost],
      ['community_posts', otherPost],
      ['community_listings', rejectedListing],
      ['community_listings', withdrawnListing],
      ['community_replies', cascadeReply],
      ['community_replies', oldReply],
    ] as const) {
      expect(await exists(table, id)).toBe(false);
    }
    expect(
      await query(
        database,
        'select 1 from public.community_reports where post_id=$1',
        [removedPost],
      ),
    ).toEqual([]);
    expect(
      await photoRows([
        removedPhoto,
        rejectedPhoto,
        withdrawnPhoto,
        otherPhoto,
      ]),
    ).toEqual([]);

    for (const [table, id] of [
      ['community_posts', recentRemoved],
      ['community_posts', recentWithdrawn],
      ['community_posts', oldApproved],
      ['community_listings', expiredListing],
      ['community_replies', recentReply],
      ['community_replies', visibleReply],
    ] as const) {
      expect(await exists(table, id)).toBe(true);
    }
    expect(
      (await photoRows([recentPhoto, keptPhoto, expiredPhoto])).sort(),
    ).toEqual([recentPhoto, keptPhoto, expiredPhoto].sort());

    const audit = await query<{ society_id: string; action: string }>(
      database,
      `select society_id::text as society_id, action from public.audit_logs where request_id=$1`,
      [trace],
    );
    expect(audit.map((row) => row.society_id).sort()).toEqual(
      [fixture.societyId, other.societyId].sort(),
    );
    expect(audit.every((row) => row.action.startsWith('community.'))).toBe(
      true,
    );
    expect(
      (
        await query(
          database,
          'select 1 from public.audit_logs where request_id=$1',
          [removeRequest],
        )
      ).length,
    ).toBeGreaterThan(0);

    const again = await run(`synthetic-retention-${crypto.randomUUID()}`);
    expect(again).toEqual({
      postsDeleted: 0,
      listingsDeleted: 0,
      repliesDeleted: 0,
    });
    const relisted = (await retentionFiles(database, societyToday())).map(
      (row) => row.path,
    );
    expect(relisted).not.toContain(staleOrphan);
    expect(relisted).not.toContain(freshOrphan);
    await setModule(other, true);
  });
});
