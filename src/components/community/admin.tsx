// Render the administrator's Community review queue, item decisions, groups and muted residents.
'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import { RadioGroup } from '@/components/ui/choice-controls';
import { Card, ListItem, StatusChip } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { Button } from '@/components/ui/button';
import {
  COMMUNITY_LISTING_TYPE_LABELS,
  COMMUNITY_MUTE_DURATION_LABELS,
  COMMUNITY_REPORT_REASON_LABELS,
  COMMUNITY_TARGET_LABELS,
  authorLine,
  excerpt,
  formatCommunityDateTime,
  formatCommunityPrice,
  muteEndsText,
} from '@/core/community/presentation';
import {
  COMMUNITY_ADMIN_QUEUES,
  COMMUNITY_GROUP_DESCRIPTION_MAX,
  COMMUNITY_GROUP_NAME_MAX,
  COMMUNITY_MUTE_DURATIONS,
  COMMUNITY_PAGE_SIZE,
  COMMUNITY_REASON_MAX,
  COMMUNITY_SEARCH_MAX,
  communityGroupArchiveInputSchema,
  communityGroupSaveInputSchema,
  communityModerateInputSchema,
  communityMuteInputSchema,
  communityUnmuteInputSchema,
  type CommunityAdminGroup,
  type CommunityAdminGroups,
  type CommunityAdminItem,
  type CommunityAdminMutes,
  type CommunityAdminQueue,
  type CommunityAdminQueueResult,
  type CommunityMemberOption,
  type CommunityModerationAction,
  type CommunityMuteDuration,
  type CommunityTargetType,
} from '@/core/community/validation';
import { CommunityPhotoGallery, type CommunityPhotoUrls } from './photos';
import {
  COMMUNITY_LINK_CLASS,
  CommunityPageHeader,
  CommunityPager,
  CommunityStatusChip,
} from './shared';

export type CommunityAdminActions = {
  moderate: ModuleFormAction;
  mute: ModuleFormAction;
  unmute: ModuleFormAction;
  saveGroup: ModuleFormAction;
  archiveGroup: ModuleFormAction;
};

const QUEUE_LABELS: Readonly<Record<CommunityAdminQueue, string>> = {
  pending: 'Waiting for review',
  hidden: 'Hidden by reports',
  reported: 'Reported',
  removed: 'Removed',
};

const QUEUE_EMPTY: Readonly<Record<CommunityAdminQueue, string>> = {
  pending: 'New posts and listings waiting for your approval appear here.',
  hidden: 'Items hidden after three different flats reported them appear here.',
  reported: 'Visible items with open reports appear here.',
  removed: 'Items you removed appear here for 30 days before they are erased.',
};

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function AdminNav({ basePath }: { basePath: string }) {
  return (
    <nav
      aria-label="Community administration"
      className="flex flex-wrap gap-space-4"
    >
      <Link className={COMMUNITY_LINK_CLASS} href={basePath}>
        Review queue
      </Link>
      <Link className={COMMUNITY_LINK_CLASS} href={`${basePath}/groups`}>
        Groups
      </Link>
      <Link className={COMMUNITY_LINK_CLASS} href={`${basePath}/mutes`}>
        Muted residents
      </Link>
    </nav>
  );
}

// Queue

export function CommunityAdminQueueView({
  queue,
  result,
  page,
  basePath = '/admin/community',
}: {
  queue: CommunityAdminQueue;
  result: CommunityAdminQueueResult;
  page: number;
  basePath?: string;
}) {
  const queueHref = (value: CommunityAdminQueue, next = 1) => {
    const params = new URLSearchParams();
    if (value !== 'pending') params.set('queue', value);
    if (next > 1) params.set('page', String(next));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  return (
    <section className="grid min-w-0 gap-space-5">
      <CommunityPageHeader
        title="Community"
        description="Approve new posts and listings, check reported items and manage groups. All times are India time (IST)."
      />
      <AdminNav basePath="/admin/community" />
      <nav
        aria-label="Review queues"
        className="flex flex-wrap gap-x-space-4 gap-y-space-2"
      >
        {COMMUNITY_ADMIN_QUEUES.map((value) => (
          <Link
            key={value}
            className={COMMUNITY_LINK_CLASS}
            href={queueHref(value)}
            aria-current={queue === value ? 'page' : undefined}
          >
            {QUEUE_LABELS[value]}
          </Link>
        ))}
      </nav>
      <h2 className="text-heading">{QUEUE_LABELS[queue]}</h2>
      {result.items.length === 0 ? (
        <EmptyState title="Nothing here" description={QUEUE_EMPTY[queue]} />
      ) : (
        <ul className="grid gap-space-2">
          {result.items.map((item) => (
            <li key={`${item.targetType}-${item.targetId}`}>
              <ListItem
                href={`/admin/community/items/${item.targetType}/${item.targetId}`}
                title={
                  <span className="break-words">
                    {COMMUNITY_TARGET_LABELS[item.targetType]}:{' '}
                    {item.title ?? excerpt(item.excerpt ?? '', 120)}
                  </span>
                }
                secondary={
                  <span className="break-words">
                    {authorLine(item.authorName, item.authorUnitLabel)} ·{' '}
                    {formatCommunityDateTime(item.createdAt)} IST
                    {item.openReports > 0
                      ? ` · ${item.openReports} open ${item.openReports === 1 ? 'report' : 'reports'}`
                      : ''}
                  </span>
                }
                status={`community.${item.status}`}
              />
            </li>
          ))}
        </ul>
      )}
      <CommunityPager
        page={page}
        total={result.total}
        pageSize={COMMUNITY_PAGE_SIZE}
        href={(next) => queueHref(queue, next)}
      />
    </section>
  );
}

// Item detail

function ModerateForm({
  targetType,
  targetId,
  action,
  decision,
  submitLabel,
  confirmMessage,
  reasonLabel,
}: {
  targetType: CommunityTargetType;
  targetId: string;
  action: ModuleFormAction;
  decision: CommunityModerationAction;
  submitLabel: string;
  confirmMessage?: string;
  reasonLabel?: string;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={submitLabel}
      confirmMessage={confirmMessage}
      input={(form) =>
        communityModerateInputSchema.parse({
          targetType,
          targetId,
          action: decision,
          reason: reasonLabel ? text(form, 'reason') : null,
        })
      }
    >
      {reasonLabel ? (
        <TextAreaInput
          id={`${id}-reason`}
          name="reason"
          label={reasonLabel}
          required
          maxLength={COMMUNITY_REASON_MAX}
          helpText="The author sees this reason."
        />
      ) : null}
    </ModuleActionForm>
  );
}

export function CommunityMuteForm({
  membershipId,
  name,
  action,
}: {
  membershipId: string;
  name: string;
  action: ModuleFormAction;
}) {
  const id = useId();
  const [duration, setDuration] = useState<CommunityMuteDuration>('7d');
  return (
    <ModuleActionForm
      action={action}
      submitLabel={`Mute ${name}`}
      input={(form) =>
        communityMuteInputSchema.parse({
          membershipId,
          duration,
          reason: text(form, 'reason'),
        })
      }
    >
      <RadioGroup
        id={`${id}-duration`}
        name={`${id}-duration`}
        label="How long?"
        value={duration}
        onChange={(value) =>
          setDuration(
            (COMMUNITY_MUTE_DURATIONS as readonly string[]).includes(value)
              ? (value as CommunityMuteDuration)
              : '7d',
          )
        }
        options={COMMUNITY_MUTE_DURATIONS.map((value) => ({
          value,
          label: COMMUNITY_MUTE_DURATION_LABELS[value],
        }))}
      />
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label="Reason"
        required
        maxLength={COMMUNITY_REASON_MAX}
        helpText="The resident sees this reason. They can still read posts and listings."
      />
    </ModuleActionForm>
  );
}

function UnmuteForm({
  membershipId,
  name,
  action,
}: {
  membershipId: string;
  name: string;
  action: ModuleFormAction;
}) {
  return (
    <ModuleActionForm
      action={action}
      submitLabel={`Lift mute for ${name}`}
      input={() => communityUnmuteInputSchema.parse({ membershipId })}
    >
      {null}
    </ModuleActionForm>
  );
}

export function CommunityAdminItemView({
  detail,
  photoUrls,
  targetType,
  actions,
}: {
  detail: CommunityAdminItem;
  photoUrls: CommunityPhotoUrls;
  targetType: CommunityTargetType;
  actions: CommunityAdminActions;
}) {
  const { item, reports } = detail;
  const target = COMMUNITY_TARGET_LABELS[targetType];
  const noun = target.toLowerCase();
  const price = formatCommunityPrice(item.pricePaise);
  const paths = [...item.photos]
    .sort((a, b) => a.position - b.position)
    .map((photo) => photo.path);
  const removable = ['approved', 'hidden', 'visible'].includes(item.status);
  const openReports = reports.filter((report) => report.status === 'open');
  return (
    <section className="grid min-w-0 gap-space-5">
      <Link className={COMMUNITY_LINK_CLASS} href="/admin/community">
        Back to the review queue
      </Link>
      <article className="grid min-w-0 gap-space-3">
        <div className="flex flex-wrap items-center gap-space-2">
          <h1 className="text-title font-semibold break-words">
            {item.title ? `${target}: ${item.title}` : target}
          </h1>
          <CommunityStatusChip status={item.status} />
        </div>
        <p className="text-caption text-ink-muted break-words">
          {authorLine(item.authorName, item.authorUnitLabel)} ·{' '}
          {formatCommunityDateTime(item.createdAt)} IST
          {item.groupName ? ` · Group: ${item.groupName}` : ''}
        </p>
        {item.listingType ? (
          <p className="text-body-strong">
            {COMMUNITY_LISTING_TYPE_LABELS[item.listingType]}
            {price ? ` · ${price}` : ''}
          </p>
        ) : null}
        {item.moderationReason ? (
          <Banner title="Recorded reason" tone="info">
            {item.moderationReason}
          </Banner>
        ) : null}
        {item.body ? (
          <p className="text-body break-words whitespace-pre-wrap">
            {item.body}
          </p>
        ) : null}
        {item.description ? (
          <p className="text-body break-words whitespace-pre-wrap">
            {item.description}
          </p>
        ) : null}
        {item.contactPhone ? (
          <p className="text-body">Shared phone: {item.contactPhone}</p>
        ) : null}
        {item.expiresAt ? (
          <p className="text-caption text-ink-muted">
            {item.closedAt
              ? `Closed by the poster on ${formatCommunityDateTime(item.closedAt)} IST.`
              : `Shown until ${formatCommunityDateTime(item.expiresAt)} IST.`}
          </p>
        ) : null}
        <CommunityPhotoGallery
          paths={paths}
          photoUrls={photoUrls}
          label={`${target} photos`}
        />
      </article>
      <Card
        title="Decision"
        description="The author is notified of every decision."
      >
        <div className="grid min-w-0 gap-space-4">
          {item.status === 'pending' ? (
            <>
              <ModerateForm
                targetType={targetType}
                targetId={item.id}
                action={actions.moderate}
                decision="approve"
                submitLabel={`Approve ${noun}`}
              />
              <ModerateForm
                targetType={targetType}
                targetId={item.id}
                action={actions.moderate}
                decision="reject"
                submitLabel={`Reject ${noun}`}
                reasonLabel="Why is it not approved?"
              />
            </>
          ) : null}
          {item.status === 'hidden' ? (
            <ModerateForm
              targetType={targetType}
              targetId={item.id}
              action={actions.moderate}
              decision="restore"
              submitLabel={`Restore ${noun}`}
              confirmMessage={`Restore this ${noun}? Open reports are dismissed and residents can see it again.`}
            />
          ) : null}
          {removable ? (
            <ModerateForm
              targetType={targetType}
              targetId={item.id}
              action={actions.moderate}
              decision="remove"
              submitLabel={`Remove ${noun}`}
              confirmMessage={`Remove this ${noun}? Residents will no longer see it, and it is erased after 30 days.`}
              reasonLabel="Why is it being removed?"
            />
          ) : null}
          {!removable && item.status !== 'pending' ? (
            <p className="text-body text-ink-muted">
              No decision is needed for this {noun} now.
            </p>
          ) : null}
        </div>
      </Card>
      <section
        aria-labelledby="item-reports"
        className="grid min-w-0 gap-space-3"
      >
        <h2 id="item-reports" className="text-heading">
          Reports ({openReports.length} open)
        </h2>
        {reports.length === 0 ? (
          <p className="text-body text-ink-muted">No one has reported it.</p>
        ) : (
          <ul className="grid gap-space-2">
            {reports.map((report, index) => (
              <li
                key={`${report.createdAt}-${index}`}
                className="grid min-w-0 gap-space-1 border-t border-rule pt-space-2"
              >
                <p className="text-body-strong">
                  {COMMUNITY_REPORT_REASON_LABELS[report.reason]}
                  {report.status !== 'open' ? ` (${report.status})` : ''}
                </p>
                <p className="text-caption text-ink-muted">
                  {report.reporterUnitLabel
                    ? `Flat ${report.reporterUnitLabel}`
                    : 'Flat not recorded'}{' '}
                  · {formatCommunityDateTime(report.createdAt)} IST
                </p>
                {report.note ? (
                  <p className="text-body break-words">{report.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {item.authorMembershipId ? (
        <Card
          title={`Mute ${item.authorName}`}
          description="A muted resident can read but cannot post, list or reply."
        >
          {detail.authorMute ? (
            <div className="grid min-w-0 gap-space-3">
              <p className="text-body">
                Muted {muteEndsText(detail.authorMute)}.
                {detail.authorMute.reason
                  ? ` Reason: ${detail.authorMute.reason}`
                  : ''}
              </p>
              <UnmuteForm
                membershipId={item.authorMembershipId}
                name={item.authorName}
                action={actions.unmute}
              />
            </div>
          ) : (
            <CommunityMuteForm
              membershipId={item.authorMembershipId}
              name={item.authorName}
              action={actions.mute}
            />
          )}
        </Card>
      ) : null}
    </section>
  );
}

// Groups

function GroupForm({
  group,
  action,
}: {
  group: CommunityAdminGroup | null;
  action: ModuleFormAction;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={group ? `Save ${group.name}` : 'Create group'}
      input={(form) =>
        communityGroupSaveInputSchema.parse({
          groupId: group?.id ?? null,
          expectedVersion: group?.version ?? null,
          name: text(form, 'name'),
          description: text(form, 'description'),
        })
      }
    >
      <TextInput
        id={`${id}-name`}
        name="name"
        label="Group name"
        required
        maxLength={COMMUNITY_GROUP_NAME_MAX}
        defaultValue={group?.name ?? ''}
        autoComplete="off"
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label="Description (optional)"
        maxLength={COMMUNITY_GROUP_DESCRIPTION_MAX}
        defaultValue={group?.description ?? ''}
      />
    </ModuleActionForm>
  );
}

export function CommunityAdminGroupsView({
  groups,
  actions,
}: {
  groups: CommunityAdminGroups;
  actions: CommunityAdminActions;
}) {
  return (
    <section className="grid min-w-0 gap-space-5">
      <CommunityPageHeader
        title="Community groups"
        description="Residents join the groups they like. Archived groups are hidden from residents and nothing new can be added."
      />
      <AdminNav basePath="/admin/community" />
      <Card title="New group">
        <GroupForm group={null} action={actions.saveGroup} />
      </Card>
      {groups.items.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create the first group, for example Gardening or Parents."
        />
      ) : (
        <ul className="grid gap-space-3">
          {groups.items.map((group) => (
            <li key={group.id}>
              <Card
                title={group.name}
                description={group.description ?? undefined}
              >
                <div className="grid min-w-0 gap-space-3">
                  <div className="flex flex-wrap items-center gap-space-2">
                    <StatusChip status={`community_group.${group.status}`} />
                    <span className="text-caption text-ink-muted">
                      {group.memberCount}{' '}
                      {group.memberCount === 1 ? 'member' : 'members'} ·{' '}
                      {group.postCount}{' '}
                      {group.postCount === 1 ? 'post' : 'posts'}
                    </span>
                  </div>
                  <details className="min-w-0 rounded-md border border-rule p-space-3">
                    <summary className="min-h-12 cursor-pointer content-center text-body-strong focus-visible:outline-2 focus-visible:outline-focus">
                      Rename {group.name}
                    </summary>
                    <div className="mt-space-3">
                      <GroupForm group={group} action={actions.saveGroup} />
                    </div>
                  </details>
                  <ModuleActionForm
                    action={actions.archiveGroup}
                    submitLabel={
                      group.status === 'active'
                        ? `Archive ${group.name}`
                        : `Bring back ${group.name}`
                    }
                    confirmMessage={
                      group.status === 'active'
                        ? `Archive ${group.name}? Residents will no longer see it.`
                        : undefined
                    }
                    input={() =>
                      communityGroupArchiveInputSchema.parse({
                        groupId: group.id,
                        expectedVersion: group.version,
                        archived: group.status === 'active',
                      })
                    }
                  >
                    {null}
                  </ModuleActionForm>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Mutes

export function CommunityAdminMutesView({
  mutes,
  members,
  search,
  actions,
  basePath = '/admin/community/mutes',
}: {
  mutes: CommunityAdminMutes;
  members: readonly CommunityMemberOption[] | null;
  search: string | null;
  actions: CommunityAdminActions;
  basePath?: string;
}) {
  const id = useId();
  return (
    <section className="grid min-w-0 gap-space-5">
      <CommunityPageHeader
        title="Muted residents"
        description="Muted residents can read but cannot post, list or reply until the mute ends or you lift it."
      />
      <AdminNav basePath="/admin/community" />
      {mutes.items.length === 0 ? (
        <EmptyState
          title="No one is muted"
          description="Residents you mute appear here."
        />
      ) : (
        <ul className="grid gap-space-3">
          {mutes.items.map((mute) => (
            <li key={mute.membershipId}>
              <Card title={authorLine(mute.name, mute.unitLabel)}>
                <div className="grid min-w-0 gap-space-3">
                  <p className="text-body break-words">
                    Muted{' '}
                    {muteEndsText({
                      mutedUntil: mute.mutedUntil,
                      untilLifted: mute.duration === 'until_lifted',
                      reason: mute.reason,
                    })}
                    . Reason: {mute.reason}
                  </p>
                  <p className="text-caption text-ink-muted">
                    Since {formatCommunityDateTime(mute.createdAt)} IST
                  </p>
                  <UnmuteForm
                    membershipId={mute.membershipId}
                    name={mute.name}
                    action={actions.unmute}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Card
        title="Mute a resident"
        description="Search by name or flat. Muting replaces any earlier mute."
      >
        <div className="grid min-w-0 gap-space-4">
          <form
            action={basePath}
            method="get"
            role="search"
            className="grid min-w-0 gap-space-3 medium:grid-cols-[1fr_auto] medium:items-end"
          >
            <TextInput
              id={`${id}-search`}
              name="q"
              type="search"
              label="Resident name or flat"
              defaultValue={search ?? ''}
              maxLength={COMMUNITY_SEARCH_MAX}
              autoComplete="off"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
          {members === null ? null : members.length === 0 ? (
            <p className="text-body text-ink-muted">
              No residents match that search.
            </p>
          ) : (
            <ul className="grid gap-space-3">
              {members.map((member) => (
                <li key={member.membershipId}>
                  <details className="min-w-0 rounded-md border border-rule p-space-3">
                    <summary className="min-h-12 cursor-pointer content-center text-body-strong break-words focus-visible:outline-2 focus-visible:outline-focus">
                      {authorLine(member.name, member.unitLabel)}
                    </summary>
                    <div className="mt-space-3">
                      <CommunityMuteForm
                        membershipId={member.membershipId}
                        name={member.name}
                        action={actions.mute}
                      />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </section>
  );
}
