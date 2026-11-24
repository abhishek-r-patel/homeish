// Render the administrator's Community review queue, item decisions, groups and muted residents.
'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedNumber } from '@/core/i18n/format';
import { CheckboxInput, RadioGroup } from '@/components/ui/choice-controls';
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
  excerpt,
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
  communitySettingsInputSchema,
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
  type CommunitySettingsResult,
  type CommunityTargetType,
} from '@/core/community/validation';
import { CommunityPhotoGallery, type CommunityPhotoUrls } from './photos';
import {
  COMMUNITY_LINK_CLASS,
  CommunityPageHeader,
  CommunityPager,
  CommunityStatusChip,
  authorLine,
  formatCommunityDateTime,
  formatCommunityPrice,
  muteEndsText,
} from './shared';

export type CommunityAdminActions = {
  moderate: ModuleFormAction;
  mute: ModuleFormAction;
  unmute: ModuleFormAction;
  saveGroup: ModuleFormAction;
  archiveGroup: ModuleFormAction;
  saveSettings: ModuleFormAction;
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
  const { translate: t } = useUiTranslator();
  return (
    <nav
      aria-label={t('Community administration')}
      className="flex flex-wrap gap-space-4"
    >
      <Link className={COMMUNITY_LINK_CLASS} href={basePath}>
        {t('Review queue')}
      </Link>
      <Link className={COMMUNITY_LINK_CLASS} href={`${basePath}/groups`}>
        {t('Groups')}
      </Link>
      <Link className={COMMUNITY_LINK_CLASS} href={`${basePath}/mutes`}>
        {t('Muted residents')}
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
  const { locale, translate: t } = useUiTranslator();
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
        title={t('Community')}
        description={t(
          'Approve new posts and listings, check reported items and manage groups. All times are India time (IST).',
        )}
      />
      <AdminNav basePath="/admin/community" />
      <nav
        aria-label={t('Review queues')}
        className="flex flex-wrap gap-x-space-4 gap-y-space-2"
      >
        {COMMUNITY_ADMIN_QUEUES.map((value) => (
          <Link
            key={value}
            className={COMMUNITY_LINK_CLASS}
            href={queueHref(value)}
            aria-current={queue === value ? 'page' : undefined}
          >
            {t(QUEUE_LABELS[value])}
          </Link>
        ))}
      </nav>
      <h2 className="text-heading">{t(QUEUE_LABELS[queue])}</h2>
      {result.items.length === 0 ? (
        <EmptyState
          title={t('Nothing here')}
          description={t(QUEUE_EMPTY[queue])}
        />
      ) : (
        <ul className="grid gap-space-2">
          {result.items.map((item) => (
            <li key={`${item.targetType}-${item.targetId}`}>
              <ListItem
                href={`/admin/community/items/${item.targetType}/${item.targetId}`}
                title={
                  <span className="break-words">
                    {t(COMMUNITY_TARGET_LABELS[item.targetType])}:{' '}
                    {item.title ?? excerpt(item.excerpt ?? '', 120)}
                  </span>
                }
                secondary={
                  <span className="break-words">
                    {authorLine(item.authorName, item.authorUnitLabel, locale)}{' '}
                    · {formatCommunityDateTime(item.createdAt, locale)} IST
                    {item.openReports > 0
                      ? ` · ${t(item.openReports === 1 ? '{count} open report' : '{count} open reports', { count: formatLocalizedNumber(item.openReports, locale ?? 'en') })}`
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
  const { translate: t } = useUiTranslator();
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
          helpText={t('The author sees this reason.')}
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
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [duration, setDuration] = useState<CommunityMuteDuration>('7d');
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Mute {name}', { name })}
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
        label={t('How long?')}
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
          label: t(COMMUNITY_MUTE_DURATION_LABELS[value]),
        }))}
      />
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label={t('Reason')}
        required
        maxLength={COMMUNITY_REASON_MAX}
        helpText={t(
          'The resident sees this reason. They can still read posts and listings.',
        )}
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
  const { translate: t } = useUiTranslator();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Lift mute for {name}', { name })}
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
  const { locale, translate: t } = useUiTranslator();
  const { item, reports } = detail;
  const target = t(COMMUNITY_TARGET_LABELS[targetType]);
  const noun = t(COMMUNITY_TARGET_LABELS[targetType].toLowerCase());
  const price = formatCommunityPrice(item.pricePaise, locale);
  const paths = [...item.photos]
    .sort((a, b) => a.position - b.position)
    .map((photo) => photo.path);
  const removable = ['approved', 'hidden', 'visible'].includes(item.status);
  const openReports = reports.filter((report) => report.status === 'open');
  return (
    <section className="grid min-w-0 gap-space-5">
      <Link className={COMMUNITY_LINK_CLASS} href="/admin/community">
        {t('Back to the review queue')}
      </Link>
      <article className="grid min-w-0 gap-space-3">
        <div className="flex flex-wrap items-center gap-space-2">
          <h1 className="text-title font-semibold break-words">
            {item.title ? `${target}: ${item.title}` : target}
          </h1>
          <CommunityStatusChip status={item.status} />
        </div>
        <p className="text-caption text-ink-muted break-words">
          {authorLine(item.authorName, item.authorUnitLabel, locale)} ·{' '}
          {formatCommunityDateTime(item.createdAt, locale)} IST
          {item.groupName
            ? ` · ${t('Group: {name}', { name: item.groupName })}`
            : ''}
        </p>
        {item.listingType ? (
          <p className="text-body-strong">
            {t(COMMUNITY_LISTING_TYPE_LABELS[item.listingType])}
            {price ? ` · ${price}` : ''}
          </p>
        ) : null}
        {item.moderationReason ? (
          <Banner title={t('Recorded reason')} tone="info">
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
          <p className="text-body">
            {t('Shared phone: {phone}', { phone: item.contactPhone })}
          </p>
        ) : null}
        {item.expiresAt ? (
          <p className="text-caption text-ink-muted">
            {item.closedAt
              ? t('Closed by the poster on {date} IST.', {
                  date: formatCommunityDateTime(item.closedAt, locale),
                })
              : t('Shown until {date} IST.', {
                  date: formatCommunityDateTime(item.expiresAt, locale),
                })}
          </p>
        ) : null}
        <CommunityPhotoGallery
          paths={paths}
          photoUrls={photoUrls}
          label={t('{item} photos', { item: target })}
        />
      </article>
      <Card
        title={t('Decision')}
        description={t('The author is notified of every decision.')}
      >
        <div className="grid min-w-0 gap-space-4">
          {item.status === 'pending' ? (
            <>
              <ModerateForm
                targetType={targetType}
                targetId={item.id}
                action={actions.moderate}
                decision="approve"
                submitLabel={t('Approve {item}', { item: noun })}
              />
              <ModerateForm
                targetType={targetType}
                targetId={item.id}
                action={actions.moderate}
                decision="reject"
                submitLabel={t('Reject {item}', { item: noun })}
                reasonLabel={t('Why is it not approved?')}
              />
            </>
          ) : null}
          {item.status === 'hidden' ? (
            <ModerateForm
              targetType={targetType}
              targetId={item.id}
              action={actions.moderate}
              decision="restore"
              submitLabel={t('Restore {item}', { item: noun })}
              confirmMessage={t(
                'Restore this {item}? Open reports are dismissed and residents can see it again.',
                { item: noun },
              )}
            />
          ) : null}
          {removable ? (
            <ModerateForm
              targetType={targetType}
              targetId={item.id}
              action={actions.moderate}
              decision="remove"
              submitLabel={t('Remove {item}', { item: noun })}
              confirmMessage={t(
                'Remove this {item}? Residents will no longer see it, and it is erased after 30 days.',
                { item: noun },
              )}
              reasonLabel={t('Why is it being removed?')}
            />
          ) : null}
          {!removable && item.status !== 'pending' ? (
            <p className="text-body text-ink-muted">
              {t('No decision is needed for this {item} now.', { item: noun })}
            </p>
          ) : null}
        </div>
      </Card>
      <section
        aria-labelledby="item-reports"
        className="grid min-w-0 gap-space-3"
      >
        <h2 id="item-reports" className="text-heading">
          {t('Reports ({count} open)', {
            count: formatLocalizedNumber(openReports.length, locale ?? 'en'),
          })}
        </h2>
        {reports.length === 0 ? (
          <p className="text-body text-ink-muted">
            {t('No one has reported it.')}
          </p>
        ) : (
          <ul className="grid gap-space-2">
            {reports.map((report, index) => (
              <li
                key={`${report.createdAt}-${index}`}
                className="grid min-w-0 gap-space-1 border-t border-rule pt-space-2"
              >
                <p className="text-body-strong">
                  {t(COMMUNITY_REPORT_REASON_LABELS[report.reason])}
                  {report.status !== 'open' ? ` (${t(report.status)})` : ''}
                </p>
                <p className="text-caption text-ink-muted">
                  {report.reporterUnitLabel
                    ? t('Flat {label}', { label: report.reporterUnitLabel })
                    : t('Flat not recorded')}{' '}
                  · {formatCommunityDateTime(report.createdAt, locale)} IST
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
          title={t('Mute {name}', { name: item.authorName })}
          description={t(
            'A muted resident can read but cannot post, list or reply.',
          )}
        >
          {detail.authorMute ? (
            <div className="grid min-w-0 gap-space-3">
              <p className="text-body">
                {t('Muted {until}.', {
                  until: muteEndsText(detail.authorMute, locale),
                })}
                {detail.authorMute.reason
                  ? ` ${t('Reason: {reason}', { reason: detail.authorMute.reason })}`
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
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={
        group ? t('Save {name}', { name: group.name }) : t('Create group')
      }
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
        label={t('Group name')}
        required
        maxLength={COMMUNITY_GROUP_NAME_MAX}
        defaultValue={group?.name ?? ''}
        autoComplete="off"
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label={t('Description (optional)')}
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
  const { locale, translate: t } = useUiTranslator();
  const number = (value: number) =>
    formatLocalizedNumber(value, locale ?? 'en');
  return (
    <section className="grid min-w-0 gap-space-5">
      <CommunityPageHeader
        title={t('Community groups')}
        description={t(
          'Residents join the groups they like. Archived groups are hidden from residents and nothing new can be added.',
        )}
      />
      <AdminNav basePath="/admin/community" />
      <Card title={t('New group')}>
        <GroupForm group={null} action={actions.saveGroup} />
      </Card>
      {groups.items.length === 0 ? (
        <EmptyState
          title={t('No groups yet')}
          description={t(
            'Create the first group, for example Gardening or Parents.',
          )}
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
                      {t(
                        group.memberCount === 1
                          ? '{count} member'
                          : '{count} members',
                        { count: number(group.memberCount) },
                      )}{' '}
                      ·{' '}
                      {t(
                        group.postCount === 1
                          ? '{count} post'
                          : '{count} posts',
                        { count: number(group.postCount) },
                      )}
                    </span>
                  </div>
                  <details className="min-w-0 rounded-md border border-rule p-space-3">
                    <summary className="min-h-12 cursor-pointer content-center text-body-strong focus-visible:outline-2 focus-visible:outline-focus">
                      {t('Rename {name}', { name: group.name })}
                    </summary>
                    <div className="mt-space-3">
                      <GroupForm group={group} action={actions.saveGroup} />
                    </div>
                  </details>
                  <ModuleActionForm
                    action={actions.archiveGroup}
                    submitLabel={t(
                      group.status === 'active'
                        ? 'Archive {name}'
                        : 'Bring back {name}',
                      { name: group.name },
                    )}
                    confirmMessage={
                      group.status === 'active'
                        ? t(
                            'Archive {name}? Residents will no longer see it.',
                            { name: group.name },
                          )
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

const MUTED_SETTING_LABELS = [
  {
    key: 'muted_can_edit_pending',
    label: 'Edit their posts and listings still waiting for review',
  },
  { key: 'muted_can_report', label: 'Report posts, listings and replies' },
  { key: 'muted_can_renew', label: 'Renew their marketplace listings' },
] as const;

function CommunityMuteSettingsCard({
  settings,
  action,
}: {
  settings: CommunitySettingsResult;
  action: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <Card
      title={t('What muted residents can still do')}
      description={t(
        'Muted residents can always read, delete their own posts and listings, and close listings. They can never post, list or reply. Choose what else they may do.',
      )}
    >
      <ModuleActionForm
        key={settings.updatedAt}
        action={action}
        submitLabel={t('Save settings')}
        input={(form) =>
          communitySettingsInputSchema.parse({
            settings: Object.fromEntries(
              MUTED_SETTING_LABELS.map(({ key }) => [
                key,
                form.get(key) === 'on',
              ]),
            ),
            expectedUpdatedAt: settings.updatedAt,
          })
        }
      >
        <fieldset className="grid gap-space-1">
          <legend className="sr-only">{t('Allowed while muted')}</legend>
          {MUTED_SETTING_LABELS.map(({ key, label }) => (
            <CheckboxInput
              key={key}
              id={`${id}-${key}`}
              name={key}
              label={t(label)}
              defaultChecked={settings.settings[key]}
            />
          ))}
        </fieldset>
      </ModuleActionForm>
    </Card>
  );
}

export function CommunityAdminMutesView({
  mutes,
  members,
  search,
  settings,
  canEditSettings = true,
  actions,
  basePath = '/admin/community/mutes',
}: {
  mutes: CommunityAdminMutes;
  members: readonly CommunityMemberOption[] | null;
  search: string | null;
  settings: CommunitySettingsResult;
  canEditSettings?: boolean;
  actions: CommunityAdminActions;
  basePath?: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  const id = useId();
  return (
    <section className="grid min-w-0 gap-space-5">
      <CommunityPageHeader
        title={t('Muted residents')}
        description={t(
          'Muted residents can read but cannot post, list or reply until the mute ends or you lift it.',
        )}
      />
      <AdminNav basePath="/admin/community" />
      {canEditSettings ? (
        <CommunityMuteSettingsCard
          settings={settings}
          action={actions.saveSettings}
        />
      ) : null}
      {mutes.items.length === 0 ? (
        <EmptyState
          title={t('No one is muted')}
          description={t('Residents you mute appear here.')}
        />
      ) : (
        <ul className="grid gap-space-3">
          {mutes.items.map((mute) => (
            <li key={mute.membershipId}>
              <Card title={authorLine(mute.name, mute.unitLabel, locale)}>
                <div className="grid min-w-0 gap-space-3">
                  <p className="text-body break-words">
                    {t('Muted {until}. Reason: {reason}', {
                      until: muteEndsText(
                        {
                          mutedUntil: mute.mutedUntil,
                          untilLifted: mute.duration === 'until_lifted',
                          reason: mute.reason,
                        },
                        locale,
                      ),
                      reason: mute.reason,
                    })}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {t('Since {date} IST', {
                      date: formatCommunityDateTime(mute.createdAt, locale),
                    })}
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
        title={t('Mute a resident')}
        description={t(
          'Search by name or flat. Muting replaces any earlier mute.',
        )}
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
              label={t('Resident name or flat')}
              defaultValue={search ?? ''}
              maxLength={COMMUNITY_SEARCH_MAX}
              autoComplete="off"
            />
            <Button type="submit" variant="secondary">
              {t('Search')}
            </Button>
          </form>
          {members === null ? null : members.length === 0 ? (
            <p className="text-body text-ink-muted">
              {t('No residents match that search.')}
            </p>
          ) : (
            <ul className="grid gap-space-3">
              {members.map((member) => (
                <li key={member.membershipId}>
                  <details className="min-w-0 rounded-md border border-rule p-space-3">
                    <summary className="min-h-12 cursor-pointer content-center text-body-strong break-words focus-visible:outline-2 focus-visible:outline-focus">
                      {authorLine(member.name, member.unitLabel, locale)}
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
