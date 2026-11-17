// Render resident Community groups, posts, the marketplace, listings, replies, reports and "My posts".
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { z } from 'zod';
import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedNumber } from '@/core/i18n/format';
import { Button } from '@/components/ui/button';
import { CheckboxInput, RadioGroup } from '@/components/ui/choice-controls';
import { Card, ListItem } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput, TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { ValidationError } from '@/core/errors';
import {
  COMMUNITY_LISTING_TYPE_LABELS,
  COMMUNITY_REPORT_REASON_LABELS,
  canRenewListing,
  excerpt,
  listingStateFromFlags,
  paiseFromRupeeText,
  rupeeTextFromPaise,
} from '@/core/community/presentation';
import {
  COMMUNITY_LISTING_DESCRIPTION_MAX,
  COMMUNITY_LISTING_TITLE_MAX,
  COMMUNITY_LISTING_TYPES,
  COMMUNITY_PAGE_SIZE,
  COMMUNITY_POST_BODY_MAX,
  COMMUNITY_REPLY_BODY_MAX,
  COMMUNITY_REPORT_NOTE_MAX,
  COMMUNITY_REPORT_REASONS,
  COMMUNITY_SEARCH_MAX,
  communityGroupIdInputSchema,
  communityListingCreateInputSchema,
  communityListingIdInputSchema,
  communityListingUpdateInputSchema,
  communityPostCreateInputSchema,
  communityPostIdInputSchema,
  communityPostUpdateInputSchema,
  communityPreferencesInputSchema,
  communityReplyCreateInputSchema,
  communityReplyIdInputSchema,
  communityReportInputSchema,
  type CommunityGroupFeed,
  type CommunityHome,
  type CommunityHomeGroup,
  type CommunityListingDetail,
  type CommunityListingType,
  type CommunityMarketplace,
  type CommunityMute,
  type CommunityMyItems,
  type CommunityMyMute,
  type CommunityPostDetail,
  type CommunityReply,
  type CommunityReplyTargetType,
  type CommunityTargetType,
} from '@/core/community/validation';
import {
  CommunityPhotoField,
  CommunityPhotoGallery,
  CommunityThumbnail,
  useCommunityPhotos,
  type CommunityPhotoUrls,
} from './photos';
import {
  COMMUNITY_LINK_CLASS,
  COMMUNITY_PRIMARY_LINK_CLASS,
  CommunityPageHeader,
  CommunityPager,
  CommunityStatusChip,
  authorLine,
  formatCommunityDateTime,
  formatCommunityPrice,
  muteEndsText,
} from './shared';

export type CommunityResidentActions = {
  prepareUpload: ModuleFormAction;
  joinGroup: ModuleFormAction;
  leaveGroup: ModuleFormAction;
  setPreferences: ModuleFormAction;
  createPost: ModuleFormAction;
  updatePost: ModuleFormAction;
  withdrawPost: ModuleFormAction;
  createListing: ModuleFormAction;
  updateListing: ModuleFormAction;
  withdrawListing: ModuleFormAction;
  closeListing: ModuleFormAction;
  renewListing: ModuleFormAction;
  createReply: ModuleFormAction;
  deleteReply: ModuleFormAction;
  report: ModuleFormAction;
};

type PhotoRequest = { request?: typeof fetch };

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function MuteBanner({ mute }: { mute: CommunityMute | null }) {
  const { locale, translate: t } = useUiTranslator();
  if (!mute) return null;
  return (
    <Banner title={t('Your posting is paused')} tone="warning">
      {t(
        mute.reason
          ? 'An administrator has paused your posts, listings and replies {until}. Reason: {reason} You can still read everything.'
          : 'An administrator has paused your posts, listings and replies {until}. You can still read everything.',
        { until: muteEndsText(mute, locale), reason: mute.reason ?? '' },
      )}
    </Banner>
  );
}

// Stands in for a control the society's mute settings do not allow.
function MutedNote({ mute, action }: { mute: CommunityMute; action: string }) {
  const { locale, translate: t } = useUiTranslator();
  return (
    <p className="text-caption text-ink-muted">
      {t('You are muted {until}. You cannot {action} while muted.', {
        until: muteEndsText(mute, locale),
        action: t(action),
      })}
    </p>
  );
}

function ModerationNote({
  status,
  reason,
}: {
  status: string;
  reason: string | null;
}) {
  const { translate: t } = useUiTranslator();
  if (status === 'pending') {
    return (
      <Banner title={t('Waiting for an administrator')} tone="info">
        {t(
          'Only you and the administrators can see this until it is approved.',
        )}
      </Banner>
    );
  }
  if (status === 'rejected' || status === 'removed' || status === 'hidden') {
    const title =
      status === 'rejected'
        ? 'Not approved'
        : status === 'removed'
          ? 'Removed by an administrator'
          : 'Hidden while an administrator reviews reports';
    return (
      <Banner title={t(title)} tone="warning">
        {reason
          ? t('Reason: {reason}', { reason })
          : t('Other residents cannot see this.')}
      </Banner>
    );
  }
  return null;
}

function Byline({
  name,
  unitLabel,
  at,
}: {
  name: string;
  unitLabel: string | null;
  at: string;
}) {
  const { locale } = useUiTranslator();
  return (
    <p className="text-caption text-ink-muted break-words">
      {authorLine(name, unitLabel, locale)} ·{' '}
      {formatCommunityDateTime(at, locale)} IST
    </p>
  );
}

// Home

function GroupMembershipForm({
  group,
  actions,
}: {
  group: CommunityHomeGroup;
  actions: CommunityResidentActions;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={group.joined ? actions.leaveGroup : actions.joinGroup}
      submitLabel={t(group.joined ? 'Leave {name}' : 'Join {name}', {
        name: group.name,
      })}
      confirmMessage={
        group.joined
          ? t('Leave {name}? You will stop seeing its posts.', {
              name: group.name,
            })
          : undefined
      }
      input={() => communityGroupIdInputSchema.parse({ groupId: group.id })}
    >
      {null}
    </ModuleActionForm>
  );
}

function AlertsForm({
  enabled,
  action,
}: {
  enabled: boolean;
  action: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [checked, setChecked] = useState(enabled);
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Save alert setting')}
      input={() =>
        communityPreferencesInputSchema.parse({ newListingAlerts: checked })
      }
    >
      <CheckboxInput
        id={`${id}-alerts`}
        label={t('Tell me when a new marketplace listing is approved')}
        checked={checked}
        onChange={(event) => setChecked(event.currentTarget.checked)}
      />
    </ModuleActionForm>
  );
}

export function CommunityHomeView({
  home,
  actions,
}: {
  home: CommunityHome;
  actions: CommunityResidentActions;
}) {
  const { locale, translate: t } = useUiTranslator();
  return (
    <section className="grid min-w-0 gap-space-5">
      <CommunityPageHeader
        title={t('Community')}
        description={t(
          'Talk with your neighbours in groups, and buy, sell or give away things in the marketplace. An administrator checks every post and listing before others see it.',
        )}
      />
      <MuteBanner mute={home.myMute} />
      <nav
        aria-label={t('Community pages')}
        className="flex flex-wrap gap-space-3"
      >
        <Link
          className={COMMUNITY_PRIMARY_LINK_CLASS}
          href="/community/marketplace"
        >
          {t('Marketplace')}
        </Link>
        <Link className={COMMUNITY_LINK_CLASS} href="/community/mine">
          {t('My posts and listings')}
        </Link>
      </nav>
      <section aria-labelledby="community-groups" className="grid gap-space-3">
        <h2 id="community-groups" className="text-heading">
          {t('Groups')}
        </h2>
        {home.groups.length === 0 ? (
          <EmptyState
            title={t('No groups yet')}
            description={t(
              'An administrator has not created any groups. Check back later.',
            )}
          />
        ) : (
          <ul className="grid gap-space-3">
            {home.groups.map((group) => (
              <li key={group.id}>
                <Card
                  title={group.name}
                  description={group.description ?? undefined}
                >
                  <div className="grid gap-space-3">
                    <p className="text-caption text-ink-muted">
                      {t(
                        group.memberCount === 1
                          ? '{count} member'
                          : '{count} members',
                        {
                          count: formatLocalizedNumber(
                            group.memberCount,
                            locale ?? 'en',
                          ),
                        },
                      )}
                      {group.latestPostAt
                        ? ` · ${t('Latest post {date} IST', { date: formatCommunityDateTime(group.latestPostAt, locale) })}`
                        : ` · ${t('No posts yet')}`}
                      {group.joined ? ` · ${t('You are a member')}` : ''}
                    </p>
                    {group.joined ? (
                      <Link
                        className={COMMUNITY_LINK_CLASS}
                        href={`/community/groups/${group.id}`}
                      >
                        {t('Open {name}', { name: group.name })}
                      </Link>
                    ) : null}
                    <GroupMembershipForm group={group} actions={actions} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Card
        title={t('Marketplace alerts')}
        description={t(
          "We send a notification when a neighbour's new listing is approved.",
        )}
      >
        <AlertsForm
          enabled={home.preferences.newListingAlerts}
          action={actions.setPreferences}
        />
      </Card>
    </section>
  );
}

// Group feed

export type CommunityGroupPage = {
  group: CommunityHomeGroup;
  myMute: CommunityMute | null;
  feed: CommunityGroupFeed | null;
  photoUrls: CommunityPhotoUrls;
};

function PostForm({
  groupId,
  actions,
  request,
}: {
  groupId: string;
  actions: CommunityResidentActions;
} & PhotoRequest) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [body, setBody] = useState('');
  const photos = useCommunityPhotos({
    prepareUpload: actions.prepareUpload,
    request,
  });
  return (
    <ModuleActionForm
      action={actions.createPost}
      idempotent
      submitLabel={t('Send for review')}
      submitDisabled={photos.uploading}
      onSaved={() => {
        setBody('');
        photos.reset();
      }}
      input={(_form, clientRequestId) =>
        communityPostCreateInputSchema.parse({
          clientRequestId,
          groupId,
          body,
          photoPaths: photos.paths(),
        })
      }
    >
      <TextAreaInput
        id={`${id}-body`}
        label={t('Your post')}
        required
        rows={4}
        maxLength={COMMUNITY_POST_BODY_MAX}
        value={body}
        helpText={t('Your name and flat are shown with the post.')}
        onChange={(event) => setBody(event.currentTarget.value)}
      />
      <CommunityPhotoField id={`${id}-photos`} state={photos} />
    </ModuleActionForm>
  );
}

export function CommunityGroupView({
  page,
  pageNumber,
  actions,
  request,
}: {
  page: CommunityGroupPage;
  pageNumber: number;
  actions: CommunityResidentActions;
} & PhotoRequest) {
  const { locale, translate: t } = useUiTranslator();
  const { group, feed } = page;
  return (
    <section className="grid min-w-0 gap-space-5">
      <Link className={COMMUNITY_LINK_CLASS} href="/community">
        {t('Back to Community')}
      </Link>
      <CommunityPageHeader
        title={group.name}
        description={group.description ?? undefined}
      />
      {!feed ? (
        <EmptyState
          title={t('Join this group to see its posts')}
          description={t(
            'Only members can read and post in a group. You can leave at any time.',
          )}
          action={<GroupMembershipForm group={group} actions={actions} />}
        />
      ) : (
        <>
          <MuteBanner mute={page.myMute} />
          <Card
            title={t('Write a post')}
            description={t(
              'An administrator checks each post before the group sees it.',
            )}
          >
            <PostForm groupId={group.id} actions={actions} request={request} />
          </Card>
          <section aria-labelledby="group-posts" className="grid gap-space-3">
            <h2 id="group-posts" className="text-heading">
              {t('Posts')}
            </h2>
            {feed.items.length === 0 ? (
              <EmptyState
                title={t('No posts yet')}
                description={t(
                  'Be the first to share something with the group.',
                )}
              />
            ) : (
              <ul className="grid gap-space-3">
                {feed.items.map((item) => (
                  <li key={item.id}>
                    <article className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4">
                      <div className="flex flex-wrap items-center gap-space-2">
                        <Byline
                          name={item.authorName}
                          unitLabel={item.authorUnitLabel}
                          at={item.createdAt}
                        />
                        {item.status !== 'approved' ? (
                          <CommunityStatusChip status={item.status} />
                        ) : null}
                      </div>
                      <p className="text-body break-words whitespace-pre-wrap">
                        {excerpt(item.body, 400)}
                      </p>
                      {item.photoPaths.length > 0 ? (
                        <div className="flex flex-wrap gap-space-2">
                          {item.photoPaths.map((path) => (
                            <CommunityThumbnail
                              key={path}
                              path={path}
                              photoUrls={page.photoUrls}
                            />
                          ))}
                        </div>
                      ) : null}
                      <Link
                        className={COMMUNITY_LINK_CLASS}
                        href={`/community/posts/${item.id}`}
                      >
                        {t('Open post')}
                        {item.replyCount > 0
                          ? ` (${t(item.replyCount === 1 ? '{count} reply' : '{count} replies', { count: formatLocalizedNumber(item.replyCount, locale ?? 'en') })})`
                          : ''}
                      </Link>
                    </article>
                  </li>
                ))}
              </ul>
            )}
            <CommunityPager
              page={pageNumber}
              total={feed.total}
              pageSize={COMMUNITY_PAGE_SIZE}
              href={(next) => `/community/groups/${group.id}?page=${next}`}
            />
          </section>
          <GroupMembershipForm group={group} actions={actions} />
        </>
      )}
    </section>
  );
}

// Replies and reports

function ReportForm({
  targetType,
  targetId,
  action,
  noun,
}: {
  targetType: CommunityTargetType;
  targetId: string;
  action: ModuleFormAction;
  noun: string;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [reason, setReason] = useState<string>('spam');
  return (
    <details className="min-w-0 rounded-md border border-rule p-space-3">
      <summary className="min-h-12 cursor-pointer content-center text-body-strong focus-visible:outline-2 focus-visible:outline-focus">
        {t('Report this {item}', { item: t(noun) })}
      </summary>
      <div className="mt-space-3">
        <ModuleActionForm
          action={action}
          submitLabel={t('Send report')}
          input={(form) =>
            communityReportInputSchema.parse({
              targetType,
              targetId,
              reason,
              note: text(form, 'note'),
            })
          }
        >
          <p className="text-caption text-ink-muted">
            {t(
              'The administrators see which flat reported it, but the author does not. When three different flats report something, it is hidden until an administrator checks it.',
            )}
          </p>
          <RadioGroup
            id={`${id}-reason`}
            name={`${id}-reason`}
            label={t('Why are you reporting it?')}
            value={reason}
            onChange={setReason}
            options={COMMUNITY_REPORT_REASONS.map((value) => ({
              value,
              label: t(COMMUNITY_REPORT_REASON_LABELS[value]),
            }))}
          />
          <TextAreaInput
            id={`${id}-note`}
            name="note"
            label={t(
              'Anything else the administrators should know? (optional)',
            )}
            maxLength={COMMUNITY_REPORT_NOTE_MAX}
          />
        </ModuleActionForm>
      </div>
    </details>
  );
}

function ReplyForm({
  targetType,
  targetId,
  action,
}: {
  targetType: CommunityReplyTargetType;
  targetId: string;
  action: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [body, setBody] = useState('');
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Send reply')}
      onSaved={() => setBody('')}
      input={(_form, clientRequestId) =>
        communityReplyCreateInputSchema.parse({
          clientRequestId,
          targetType,
          targetId,
          body,
        })
      }
    >
      <TextAreaInput
        id={`${id}-reply`}
        label={t('Your reply')}
        required
        maxLength={COMMUNITY_REPLY_BODY_MAX}
        value={body}
        helpText={t(
          'Replies appear straight away. Your name and flat are shown.',
        )}
        onChange={(event) => setBody(event.currentTarget.value)}
      />
    </ModuleActionForm>
  );
}

function ReplyItem({
  reply,
  actions,
  reportBlocked,
}: {
  reply: CommunityReply;
  actions: CommunityResidentActions;
  reportBlocked: boolean;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <li className="grid min-w-0 gap-space-2 border-t border-rule pt-space-3">
      <div className="flex flex-wrap items-center gap-space-2">
        <Byline
          name={reply.authorName}
          unitLabel={reply.authorUnitLabel}
          at={reply.createdAt}
        />
        {reply.status !== 'visible' ? (
          <CommunityStatusChip status={reply.status} />
        ) : null}
      </div>
      <p className="text-body break-words whitespace-pre-wrap">{reply.body}</p>
      {reply.mine && reply.status === 'visible' ? (
        <ModuleActionForm
          action={actions.deleteReply}
          submitLabel={t('Delete my reply')}
          confirmMessage={t('Delete your reply? This cannot be undone.')}
          input={() => communityReplyIdInputSchema.parse({ replyId: reply.id })}
        >
          {null}
        </ModuleActionForm>
      ) : null}
      {replyReportable(reply) && !reportBlocked ? (
        <ReportForm
          targetType="reply"
          targetId={reply.id}
          action={actions.report}
          noun="reply"
        />
      ) : null}
    </li>
  );
}

function replyReportable(reply: CommunityReply) {
  return !reply.mine && reply.status === 'visible' && !reply.reportedByMe;
}

function RepliesSection({
  targetType,
  targetId,
  replies,
  canReply,
  closedText,
  actions,
  myMute,
}: {
  targetType: CommunityReplyTargetType;
  targetId: string;
  replies: readonly CommunityReply[];
  canReply: boolean;
  closedText: string;
  actions: CommunityResidentActions;
  myMute: CommunityMyMute | null;
}) {
  const { locale, translate: t } = useUiTranslator();
  const headingId = useId();
  const reportBlocked = Boolean(myMute && !myMute.canReport);
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-space-3">
      <h2 id={headingId} className="text-heading">
        {t('Replies ({count})', {
          count: formatLocalizedNumber(replies.length, locale ?? 'en'),
        })}
      </h2>
      {replies.length === 0 ? (
        <p className="text-body text-ink-muted">{t('No replies yet.')}</p>
      ) : (
        <ul className="grid gap-space-3">
          {replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              actions={actions}
              reportBlocked={reportBlocked}
            />
          ))}
        </ul>
      )}
      {myMute && reportBlocked && replies.some(replyReportable) ? (
        <MutedNote mute={myMute} action="report replies" />
      ) : null}
      {canReply ? (
        <ReplyForm
          targetType={targetType}
          targetId={targetId}
          action={actions.createReply}
        />
      ) : (
        <p className="text-caption text-ink-muted">{t(closedText)}</p>
      )}
    </section>
  );
}

// Post detail

function PostEditForm({
  post,
  version,
  photoPaths,
  photoUrls,
  actions,
  request,
}: {
  post: CommunityPostDetail['post'];
  version: number;
  photoPaths: readonly string[];
  photoUrls: CommunityPhotoUrls;
  actions: CommunityResidentActions;
} & PhotoRequest) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [body, setBody] = useState(post.body);
  const photos = useCommunityPhotos({
    prepareUpload: actions.prepareUpload,
    request,
    initialPaths: photoPaths,
  });
  return (
    <details className="min-w-0 rounded-md border border-rule p-space-3">
      <summary className="min-h-12 cursor-pointer content-center text-body-strong focus-visible:outline-2 focus-visible:outline-focus">
        {t('Edit post')}
      </summary>
      <div className="mt-space-3">
        <ModuleActionForm
          action={actions.updatePost}
          submitLabel={t('Save changes')}
          submitDisabled={photos.uploading}
          input={() =>
            communityPostUpdateInputSchema.parse({
              postId: post.id,
              expectedVersion: version,
              body,
              photoPaths: photos.paths(),
            })
          }
        >
          <TextAreaInput
            id={`${id}-body`}
            label={t('Your post')}
            required
            rows={4}
            maxLength={COMMUNITY_POST_BODY_MAX}
            value={body}
            onChange={(event) => setBody(event.currentTarget.value)}
          />
          <CommunityPhotoField
            id={`${id}-photos`}
            state={photos}
            photoUrls={photoUrls}
          />
        </ModuleActionForm>
      </div>
    </details>
  );
}

export function CommunityPostView({
  detail,
  photoUrls,
  actions,
  request,
}: {
  detail: CommunityPostDetail;
  photoUrls: CommunityPhotoUrls;
  actions: CommunityResidentActions;
} & PhotoRequest) {
  const { translate: t } = useUiTranslator();
  const { post } = detail;
  const paths = [...detail.photos]
    .sort((a, b) => a.position - b.position)
    .map((photo) => photo.path);
  const canWithdraw =
    post.mine && ['pending', 'approved', 'hidden'].includes(post.status);
  const mute = detail.myMute ?? null;
  const editable = post.mine && post.status === 'pending' && post.version;
  const reportable =
    !post.mine && post.status === 'approved' && !detail.reportedByMe;
  return (
    <section className="grid min-w-0 gap-space-5">
      <Link
        className={COMMUNITY_LINK_CLASS}
        href={post.groupId ? `/community/groups/${post.groupId}` : '/community'}
      >
        {post.groupName
          ? t('Back to {name}', { name: post.groupName })
          : t('Back to Community')}
      </Link>
      <article className="grid min-w-0 gap-space-3">
        <div className="flex flex-wrap items-center gap-space-2">
          <h1 className="text-title font-semibold break-words">
            {post.groupName
              ? t('Post in {name}', { name: post.groupName })
              : t('Post')}
          </h1>
          {post.status !== 'approved' ? (
            <CommunityStatusChip status={post.status} />
          ) : null}
        </div>
        <Byline
          name={post.authorName}
          unitLabel={post.authorUnitLabel}
          at={post.createdAt}
        />
        {post.mine ? (
          <ModerationNote status={post.status} reason={post.moderationReason} />
        ) : null}
        <p className="text-body break-words whitespace-pre-wrap">{post.body}</p>
        <CommunityPhotoGallery
          paths={paths}
          photoUrls={photoUrls}
          label={t('Post photos')}
        />
      </article>
      {editable && post.version && (!mute || mute.canEditPending) ? (
        <PostEditForm
          post={post}
          version={post.version}
          photoPaths={paths}
          photoUrls={photoUrls}
          actions={actions}
          request={request}
        />
      ) : null}
      {editable && mute && !mute.canEditPending ? (
        <MutedNote mute={mute} action="edit this post" />
      ) : null}
      {canWithdraw ? (
        <ModuleActionForm
          action={actions.withdrawPost}
          submitLabel={t('Delete my post')}
          confirmMessage={t(
            'Delete your post? Its replies and photos are deleted too.',
          )}
          input={() => communityPostIdInputSchema.parse({ postId: post.id })}
        >
          {null}
        </ModuleActionForm>
      ) : null}
      {reportable && (!mute || mute.canReport) ? (
        <ReportForm
          targetType="post"
          targetId={post.id}
          action={actions.report}
          noun="post"
        />
      ) : null}
      {reportable && mute && !mute.canReport ? (
        <MutedNote mute={mute} action="report this post" />
      ) : null}
      {detail.reportedByMe ? (
        <p className="text-caption text-ink-muted">
          {t('Your flat has reported this post.')}
        </p>
      ) : null}
      {post.status === 'approved' || detail.replies.length > 0 ? (
        <RepliesSection
          targetType="post"
          targetId={post.id}
          replies={detail.replies}
          canReply={detail.canReply}
          closedText="Replies are not open for this post."
          actions={actions}
          myMute={mute}
        />
      ) : null}
    </section>
  );
}

// Marketplace

export type CommunityMarketplaceFilter = {
  type: CommunityListingType | null;
  search: string | null;
  page: number;
};

function marketplaceHref(
  basePath: string,
  filter: Partial<CommunityMarketplaceFilter>,
) {
  const params = new URLSearchParams();
  if (filter.type) params.set('type', filter.type);
  if (filter.search) params.set('q', filter.search);
  if (filter.page && filter.page > 1) params.set('page', String(filter.page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function CommunityMarketplaceView({
  marketplace,
  photoUrls,
  filter,
  basePath = '/community/marketplace',
}: {
  marketplace: CommunityMarketplace;
  photoUrls: CommunityPhotoUrls;
  filter: CommunityMarketplaceFilter;
  basePath?: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  const id = useId();
  return (
    <section className="grid min-w-0 gap-space-5">
      <Link className={COMMUNITY_LINK_CLASS} href="/community">
        {t('Back to Community')}
      </Link>
      <CommunityPageHeader
        title={t('Marketplace')}
        description={t(
          'Items for sale, free to a good home, wanted, lost and found in your society. Listings stay up for 30 days after approval. Homeish does not handle payments.',
        )}
      />
      <div className="flex flex-wrap gap-space-3">
        <Link
          className={COMMUNITY_PRIMARY_LINK_CLASS}
          href="/community/marketplace/new"
        >
          {t('New listing')}
        </Link>
        <Link className={COMMUNITY_LINK_CLASS} href="/community/mine">
          {t('My listings')}
        </Link>
      </div>
      <nav
        aria-label={t('Listing types')}
        className="flex flex-wrap gap-x-space-4 gap-y-space-2"
      >
        {[null, ...COMMUNITY_LISTING_TYPES].map((value) => (
          <Link
            key={value ?? 'all'}
            className={COMMUNITY_LINK_CLASS}
            href={marketplaceHref(basePath, {
              type: value,
              search: filter.search,
            })}
            aria-current={filter.type === value ? 'page' : undefined}
          >
            {t(value ? COMMUNITY_LISTING_TYPE_LABELS[value] : 'All')}
          </Link>
        ))}
      </nav>
      <form
        action={basePath}
        method="get"
        role="search"
        className="grid min-w-0 gap-space-3 medium:grid-cols-[1fr_auto] medium:items-end"
      >
        {filter.type ? (
          <input type="hidden" name="type" value={filter.type} />
        ) : null}
        <TextInput
          id={`${id}-search`}
          name="q"
          type="search"
          label={t('Search listings')}
          defaultValue={filter.search ?? ''}
          maxLength={COMMUNITY_SEARCH_MAX}
          autoComplete="off"
        />
        <Button type="submit" variant="secondary">
          {t('Search')}
        </Button>
      </form>
      {marketplace.items.length === 0 ? (
        <EmptyState
          title={t(
            filter.search || filter.type
              ? 'No matching listings'
              : 'No listings yet',
          )}
          description={t(
            filter.search || filter.type
              ? 'Try another type or search word.'
              : 'Post the first listing for your neighbours.',
          )}
        />
      ) : (
        <ul className="grid gap-space-2">
          {marketplace.items.map((item) => {
            const price = formatCommunityPrice(item.pricePaise, locale);
            return (
              <li key={item.id}>
                <ListItem
                  href={`/community/marketplace/${item.id}`}
                  title={<span className="break-words">{item.title}</span>}
                  secondary={
                    <span className="break-words">
                      {t(COMMUNITY_LISTING_TYPE_LABELS[item.listingType])}
                      {price ? ` · ${price}` : ''} ·{' '}
                      {authorLine(
                        item.authorName,
                        item.authorUnitLabel,
                        locale,
                      )}
                      {item.approvedAt
                        ? ` · ${formatCommunityDateTime(item.approvedAt, locale)} IST`
                        : ''}
                      {item.replyCount > 0
                        ? ` · ${t(item.replyCount === 1 ? '{count} reply' : '{count} replies', { count: formatLocalizedNumber(item.replyCount, locale ?? 'en') })}`
                        : ''}
                    </span>
                  }
                  trailing={
                    <CommunityThumbnail
                      path={item.firstPhotoPath}
                      photoUrls={photoUrls}
                    />
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      <CommunityPager
        page={filter.page}
        total={marketplace.total}
        pageSize={COMMUNITY_PAGE_SIZE}
        href={(page) => marketplaceHref(basePath, { ...filter, page })}
      />
    </section>
  );
}

// Listing form (new and pending edit)

const listingCreatedSchema = z.object({ listingId: z.uuid() });

export function CommunityListingForm({
  listing,
  photoPaths = [],
  photoUrls = {},
  actions,
  request,
  navigate = true,
}: {
  listing?: CommunityListingDetail['listing'] & { version: number };
  photoPaths?: readonly string[];
  photoUrls?: CommunityPhotoUrls;
  actions: CommunityResidentActions;
  navigate?: boolean;
} & PhotoRequest) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const router = useRouter();
  const [type, setType] = useState<CommunityListingType>(
    listing?.listingType ?? 'sale',
  );
  const photos = useCommunityPhotos({
    prepareUpload: actions.prepareUpload,
    request,
    initialPaths: photoPaths,
  });

  function listingInput(form: FormData) {
    const priceText = text(form, 'price').trim();
    let pricePaise: number | null = null;
    if (type === 'sale' && priceText) {
      pricePaise = paiseFromRupeeText(priceText);
      if (pricePaise === null) {
        throw new ValidationError({
          pricePaise: 'Enter the price in rupees, for example 1500 or 1500.50.',
        });
      }
    }
    return {
      listingType: type,
      title: text(form, 'title'),
      description: text(form, 'description'),
      pricePaise,
      contactPhone: text(form, 'contactPhone'),
    };
  }

  return (
    <ModuleActionForm
      action={listing ? actions.updateListing : actions.createListing}
      idempotent={!listing}
      submitLabel={t(listing ? 'Save changes' : 'Send for review')}
      submitDisabled={photos.uploading}
      onSaved={(data) => {
        const created = listingCreatedSchema.safeParse(data);
        if (!listing && navigate && created.success) {
          router.push(`/community/marketplace/${created.data.listingId}`);
        }
      }}
      input={(form, clientRequestId) =>
        listing
          ? communityListingUpdateInputSchema.parse({
              listingId: listing.id,
              expectedVersion: listing.version,
              listing: listingInput(form),
              photoPaths: photos.paths(),
            })
          : communityListingCreateInputSchema.parse({
              clientRequestId,
              listing: listingInput(form),
              photoPaths: photos.paths(),
            })
      }
    >
      <RadioGroup
        id={`${id}-type`}
        name={`${id}-type`}
        label={t('What kind of listing is it?')}
        value={type}
        onChange={(value) =>
          setType(
            (COMMUNITY_LISTING_TYPES as readonly string[]).includes(value)
              ? (value as CommunityListingType)
              : 'sale',
          )
        }
        options={COMMUNITY_LISTING_TYPES.map((value) => ({
          value,
          label: t(COMMUNITY_LISTING_TYPE_LABELS[value]),
        }))}
      />
      <TextInput
        id={`${id}-title`}
        name="title"
        label={t('Title')}
        required
        maxLength={COMMUNITY_LISTING_TITLE_MAX}
        defaultValue={listing?.title ?? ''}
        autoComplete="off"
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label={t('Description (optional)')}
        rows={4}
        maxLength={COMMUNITY_LISTING_DESCRIPTION_MAX}
        defaultValue={listing?.description ?? ''}
      />
      {type === 'sale' ? (
        <AmountInput
          id={`${id}-price`}
          name="price"
          label={t('Price (optional)')}
          defaultValue={rupeeTextFromPaise(listing?.pricePaise ?? null)}
          helpText={t(
            'In rupees. Enter 0 to show it as free. Payment is between you and the buyer.',
          )}
        />
      ) : null}
      <TextInput
        id={`${id}-phone`}
        name="contactPhone"
        label={t('Phone number to share (optional)')}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={16}
        defaultValue={listing?.contactPhone ?? ''}
        helpText={t(
          'Shown to residents of your society with the listing. Leave it empty to be contacted through replies only.',
        )}
      />
      <CommunityPhotoField
        id={`${id}-photos`}
        state={photos}
        photoUrls={photoUrls}
      />
      <p className="text-caption text-ink-muted">
        {t(
          'An administrator checks each listing before neighbours see it. Your name and flat are shown with it.',
        )}
      </p>
    </ModuleActionForm>
  );
}

export function CommunityNewListingView({
  actions,
  request,
  navigate,
}: {
  actions: CommunityResidentActions;
  navigate?: boolean;
} & PhotoRequest) {
  const { translate: t } = useUiTranslator();
  return (
    <section className="grid min-w-0 gap-space-5">
      <Link className={COMMUNITY_LINK_CLASS} href="/community/marketplace">
        {t('Back to Marketplace')}
      </Link>
      <CommunityPageHeader title={t('New listing')} />
      <CommunityListingForm
        actions={actions}
        request={request}
        navigate={navigate}
      />
    </section>
  );
}

// Listing detail

function ListingAuthorActions({
  listing,
  actions,
  mute,
}: {
  listing: CommunityListingDetail['listing'];
  actions: CommunityResidentActions;
  mute: CommunityMyMute | null;
}) {
  const { translate: t } = useUiTranslator();
  const state = listingStateFromFlags(listing);
  const input = () =>
    communityListingIdInputSchema.parse({ listingId: listing.id });
  const renewBlocked =
    canRenewListing(state) && mute !== null && !mute.canRenew;
  return (
    <div className="grid min-w-0 gap-space-3">
      <div className="grid min-w-0 gap-space-3 medium:grid-cols-3">
        {state === 'live' ? (
          <ModuleActionForm
            action={actions.closeListing}
            submitLabel={t('Mark as closed')}
            confirmMessage={t(
              'Close this listing? It leaves the marketplace and no new replies can be sent.',
            )}
            input={input}
          >
            {null}
          </ModuleActionForm>
        ) : null}
        {canRenewListing(state) && !renewBlocked ? (
          <ModuleActionForm
            action={actions.renewListing}
            submitLabel={t('Renew for 30 days')}
            input={input}
          >
            {null}
          </ModuleActionForm>
        ) : null}
        {['pending', 'approved', 'hidden'].includes(listing.status) ? (
          <ModuleActionForm
            action={actions.withdrawListing}
            submitLabel={t('Delete listing')}
            confirmMessage={t(
              'Delete this listing? Its replies and photos are deleted too.',
            )}
            input={input}
          >
            {null}
          </ModuleActionForm>
        ) : null}
      </div>
      {renewBlocked && mute ? (
        <MutedNote mute={mute} action="renew this listing" />
      ) : null}
    </div>
  );
}

export function CommunityListingView({
  detail,
  photoUrls,
  actions,
  request,
}: {
  detail: CommunityListingDetail;
  photoUrls: CommunityPhotoUrls;
  actions: CommunityResidentActions;
} & PhotoRequest) {
  const { locale, translate: t } = useUiTranslator();
  const { listing } = detail;
  const state = listingStateFromFlags(listing);
  const price = formatCommunityPrice(listing.pricePaise, locale);
  const mute = detail.myMute ?? null;
  const editable =
    listing.mine && listing.status === 'pending' && listing.version;
  const reportable =
    !listing.mine && listing.status === 'approved' && !detail.reportedByMe;
  const paths = [...detail.photos]
    .sort((a, b) => a.position - b.position)
    .map((photo) => photo.path);
  return (
    <section className="grid min-w-0 gap-space-5">
      <Link className={COMMUNITY_LINK_CLASS} href="/community/marketplace">
        {t('Back to Marketplace')}
      </Link>
      <article className="grid min-w-0 gap-space-3">
        <div className="flex flex-wrap items-center gap-space-2">
          <h1 className="text-title font-semibold break-words">
            {listing.title}
          </h1>
          {state !== 'live' ? <CommunityStatusChip status={state} /> : null}
        </div>
        <p className="text-body-strong">
          {t(COMMUNITY_LISTING_TYPE_LABELS[listing.listingType])}
          {price ? ` · ${price}` : ''}
        </p>
        <Byline
          name={listing.authorName}
          unitLabel={listing.authorUnitLabel}
          at={listing.approvedAt ?? listing.createdAt}
        />
        {listing.mine ? (
          <ModerationNote
            status={listing.status}
            reason={listing.moderationReason}
          />
        ) : null}
        {state === 'expired' ? (
          <Banner title={t('This listing has expired')} tone="info">
            {t('It is no longer shown in the marketplace.')}
            {listing.mine
              ? ` ${t('Renew it to show it for another 30 days.')}`
              : ''}
          </Banner>
        ) : null}
        {state === 'closed' ? (
          <Banner title={t('This listing is closed')} tone="info">
            {t('The poster has marked it as done.')}
          </Banner>
        ) : null}
        {state === 'live' && listing.expiresAt ? (
          <p className="text-caption text-ink-muted">
            {t('Shown until {date} IST.', {
              date: formatCommunityDateTime(listing.expiresAt, locale),
            })}
          </p>
        ) : null}
        {listing.description ? (
          <p className="text-body break-words whitespace-pre-wrap">
            {listing.description}
          </p>
        ) : null}
        {listing.contactPhone ? (
          <p className="text-body">
            {t('Phone:')}{' '}
            <a
              className={COMMUNITY_LINK_CLASS}
              href={`tel:${listing.contactPhone.replaceAll(' ', '')}`}
            >
              {listing.contactPhone}
            </a>
          </p>
        ) : null}
        <CommunityPhotoGallery
          paths={paths}
          photoUrls={photoUrls}
          label={t('Listing photos')}
        />
      </article>
      {editable && listing.version && (!mute || mute.canEditPending) ? (
        <details className="min-w-0 rounded-md border border-rule p-space-3">
          <summary className="min-h-12 cursor-pointer content-center text-body-strong focus-visible:outline-2 focus-visible:outline-focus">
            {t('Edit listing')}
          </summary>
          <div className="mt-space-3">
            <CommunityListingForm
              listing={{ ...listing, version: listing.version }}
              photoPaths={paths}
              photoUrls={photoUrls}
              actions={actions}
              request={request}
            />
          </div>
        </details>
      ) : null}
      {editable && mute && !mute.canEditPending ? (
        <MutedNote mute={mute} action="edit this listing" />
      ) : null}
      {listing.mine ? (
        <ListingAuthorActions listing={listing} actions={actions} mute={mute} />
      ) : null}
      {reportable && (!mute || mute.canReport) ? (
        <ReportForm
          targetType="listing"
          targetId={listing.id}
          action={actions.report}
          noun="listing"
        />
      ) : null}
      {reportable && mute && !mute.canReport ? (
        <MutedNote mute={mute} action="report this listing" />
      ) : null}
      {detail.reportedByMe ? (
        <p className="text-caption text-ink-muted">
          {t('Your flat has reported this listing.')}
        </p>
      ) : null}
      {listing.status === 'approved' || detail.replies.length > 0 ? (
        <RepliesSection
          targetType="listing"
          targetId={listing.id}
          replies={detail.replies}
          canReply={detail.canReply}
          closedText={
            state === 'closed' || state === 'expired'
              ? 'Replies are closed because this listing is no longer active.'
              : 'Replies are not open for this listing.'
          }
          actions={actions}
          myMute={mute}
        />
      ) : null}
    </section>
  );
}

// My items

export function CommunityMyItemsView({ items }: { items: CommunityMyItems }) {
  const { locale, translate: t } = useUiTranslator();
  const [view, setView] = useState<'listings' | 'posts'>('listings');
  const id = useId();
  return (
    <section className="grid min-w-0 gap-space-5">
      <Link className={COMMUNITY_LINK_CLASS} href="/community">
        {t('Back to Community')}
      </Link>
      <CommunityPageHeader
        title={t('My posts and listings')}
        description={t(
          'Everything you have posted, including items waiting for review, rejected or removed. Rejected, removed and deleted items are erased 30 days later.',
        )}
      />
      <SelectInput
        id={`${id}-view`}
        label={t('Show')}
        value={view}
        options={[
          {
            value: 'listings',
            label: t('Listings ({count})', {
              count: formatLocalizedNumber(
                items.listings.length,
                locale ?? 'en',
              ),
            }),
          },
          {
            value: 'posts',
            label: t('Posts ({count})', {
              count: formatLocalizedNumber(items.posts.length, locale ?? 'en'),
            }),
          },
        ]}
        onChange={(event) =>
          setView(event.currentTarget.value === 'posts' ? 'posts' : 'listings')
        }
      />
      {view === 'listings' ? (
        items.listings.length === 0 ? (
          <EmptyState
            title={t('No listings yet')}
            description={t('Your marketplace listings will appear here.')}
            action={
              <Link
                className={COMMUNITY_LINK_CLASS}
                href="/community/marketplace/new"
              >
                {t('Create a listing')}
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-space-2">
            {items.listings.map((item) => {
              const state = listingStateFromFlags(item);
              return (
                <li key={item.id}>
                  <ListItem
                    href={`/community/marketplace/${item.id}`}
                    title={<span className="break-words">{item.title}</span>}
                    secondary={
                      <span className="break-words">
                        {t(COMMUNITY_LISTING_TYPE_LABELS[item.listingType])} ·{' '}
                        {formatCommunityDateTime(item.createdAt, locale)} IST
                        {item.moderationReason
                          ? ` · ${t('Reason: {reason}', { reason: item.moderationReason })}`
                          : ''}
                      </span>
                    }
                    status={
                      state === 'live'
                        ? 'community.approved'
                        : `community.${state}`
                    }
                  />
                </li>
              );
            })}
          </ul>
        )
      ) : items.posts.length === 0 ? (
        <EmptyState
          title={t('No posts yet')}
          description={t(
            'Join a group and share something with your neighbours.',
          )}
        />
      ) : (
        <ul className="grid gap-space-2">
          {items.posts.map((item) => (
            <li key={item.id}>
              <ListItem
                href={`/community/posts/${item.id}`}
                title={
                  <span className="break-words">{excerpt(item.body, 80)}</span>
                }
                secondary={
                  <span className="break-words">
                    {item.groupName ? `${item.groupName} · ` : ''}
                    {formatCommunityDateTime(item.createdAt, locale)} IST
                    {item.moderationReason
                      ? ` · ${t('Reason: {reason}', { reason: item.moderationReason })}`
                      : ''}
                  </span>
                }
                status={`community.${item.status}`}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
