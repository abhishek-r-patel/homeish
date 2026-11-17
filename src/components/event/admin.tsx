// Render the events workspace for administrators and committee: list, details, totals, RSVPs and lifecycle.
'use client';
import Link from 'next/link';
import { useId } from 'react';
import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedNumber } from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';
import { translateMessage } from '@/core/i18n/messages';
import { Card, ListItem } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { DataTable } from '@/components/ui/table-controls';
import {
  EVENT_ADMIN_FILTERS,
  EVENT_REASON_MAX,
  eventCancelInputSchema,
  eventVersionInputSchema,
  type EventAdminDetail,
  type EventAdminFilter,
  type EventAdminList,
  type EventBlockOption,
} from '@/core/event/validation';
import {
  EVENT_LINK_CLASS,
  EVENT_PRIMARY_LINK_CLASS,
  EventRsvpChip,
  EventStatusChip,
  describeContribution,
  formatEventDateTime,
  formatEventMoney,
} from './shared';

const FILTER_LABELS: Readonly<Record<EventAdminFilter, string>> = {
  upcoming: 'Upcoming',
  past: 'Past',
  drafts: 'Drafts',
  cancelled: 'Cancelled',
  all: 'All',
};

export type EventAdminWorkspace = EventAdminList & { billingEnabled: boolean };

export type EventAdminActions = {
  publish: ModuleFormAction;
  cancel: ModuleFormAction;
  deleteDraft: ModuleFormAction;
};

function formText(form: FormData, key: string) {
  return String(form.get(key) ?? '');
}

function goingSummary(
  item: EventAdminList['items'][number],
  locale: Locale | null,
) {
  const language = locale ?? 'en';
  return translateMessage(
    language,
    item.capacity === null
      ? '{people} going · {flats}'
      : '{people}/{capacity} going · {flats}',
    {
      people: formatLocalizedNumber(item.goingHeadcount, language),
      capacity:
        item.capacity === null
          ? ''
          : formatLocalizedNumber(item.capacity, language),
      flats: translateMessage(
        language,
        item.goingUnits === 1 ? '{count} flat' : '{count} flats',
        { count: formatLocalizedNumber(item.goingUnits, language) },
      ),
    },
  );
}

export function EventAdminListView({
  workspace,
  filter,
  basePath = '/admin/events',
}: {
  workspace: EventAdminWorkspace;
  filter: EventAdminFilter;
  basePath?: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  const needsBilling =
    !workspace.billingEnabled &&
    workspace.items.some(
      (item) => item.contributionType !== 'none' && item.status !== 'cancelled',
    );
  return (
    <section className="grid min-w-0 gap-space-4">
      <div className="flex flex-wrap items-start justify-between gap-space-3">
        <div className="grid gap-space-1">
          <h1 className="text-title font-semibold">{t('Events')}</h1>
          <p className="text-body text-ink-muted">
            {t(
              'Plan society events, collect RSVPs and optional contributions. All times are India time (IST).',
            )}
          </p>
        </div>
        <Link className={EVENT_PRIMARY_LINK_CLASS} href="/admin/events/new">
          {t('New Event')}
        </Link>
      </div>
      {needsBilling ? (
        <Banner title={t('Billing is turned off')} tone="warning">
          {t(
            'Some events have a contribution. Residents cannot RSVP going to them until Billing is turned on.',
          )}
        </Banner>
      ) : null}
      <nav
        aria-label={t('Filter events')}
        className="flex flex-wrap gap-space-3"
      >
        {EVENT_ADMIN_FILTERS.map((value) => (
          <Link
            key={value}
            className={EVENT_LINK_CLASS}
            href={
              value === 'upcoming' ? basePath : `${basePath}?filter=${value}`
            }
            aria-current={filter === value ? 'page' : undefined}
          >
            {t(FILTER_LABELS[value])}
          </Link>
        ))}
      </nav>
      {workspace.items.length === 0 ? (
        <EmptyState
          title={t(
            filter === 'upcoming'
              ? 'No upcoming events'
              : 'No events match this filter',
          )}
          description={t(
            'Create an event draft, then publish it to notify residents.',
          )}
          action={
            <Link className={EVENT_LINK_CLASS} href="/admin/events/new">
              {t('Create an event')}
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-space-2">
          {workspace.items.map((item) => (
            <li key={item.id}>
              <ListItem
                href={`/admin/events/${item.id}`}
                title={<span className="break-words">{item.title}</span>}
                secondary={
                  <span className="break-words">
                    {formatEventDateTime(item.startsAt, locale)} IST
                    {item.venue ? ` · ${item.venue}` : ''} ·{' '}
                    {describeContribution(
                      item.contributionType,
                      item.contributionPaise,
                      locale,
                    )}
                    {item.status === 'draft'
                      ? ''
                      : ` · ${goingSummary(item, locale)}`}
                  </span>
                }
                status={
                  item.status === 'published' && item.past
                    ? 'event.past'
                    : `event.${item.status}`
                }
              />
            </li>
          ))}
        </ul>
      )}
      {workspace.total > workspace.items.length ? (
        <p className="text-caption text-ink-muted">
          {t('Showing {count} of {total} events.', {
            count: formatLocalizedNumber(
              workspace.items.length,
              locale ?? 'en',
            ),
            total: formatLocalizedNumber(workspace.total, locale ?? 'en'),
          })}
        </p>
      ) : null}
    </section>
  );
}

function VersionAction({
  action,
  eventId,
  version,
  label,
  confirmMessage,
  note,
  disabled = false,
}: {
  action: ModuleFormAction;
  eventId: string;
  version: number;
  label: string;
  confirmMessage: string;
  note: string;
  disabled?: boolean;
}) {
  return (
    <ModuleActionForm
      action={action}
      submitLabel={label}
      confirmMessage={confirmMessage}
      submitDisabled={disabled}
      input={() =>
        eventVersionInputSchema.parse({ eventId, expectedVersion: version })
      }
    >
      <p className="text-caption text-ink-muted">{note}</p>
    </ModuleActionForm>
  );
}

function CancelAction({
  action,
  eventId,
  version,
  hasContribution,
}: {
  action: ModuleFormAction;
  eventId: string;
  version: number;
  hasContribution: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Cancel Event')}
      confirmMessage={t(
        hasContribution
          ? 'Cancel this event? Residents will be notified and every contribution will be credited back.'
          : 'Cancel this event? Residents will be notified.',
      )}
      input={(form) =>
        eventCancelInputSchema.parse({
          eventId,
          expectedVersion: version,
          reason: formText(form, 'reason'),
        })
      }
    >
      <TextAreaInput
        id={`${id}-reason`}
        name="reason"
        label={t('Reason for cancelling')}
        helpText={t('Residents see this reason.')}
        maxLength={EVENT_REASON_MAX}
        rows={2}
        required
      />
    </ModuleActionForm>
  );
}

function EventLifecycle({
  detail,
  actions,
}: {
  detail: EventAdminDetail;
  actions: EventAdminActions;
}) {
  const { translate: t } = useUiTranslator();
  const { event } = detail;
  const billingBlocked =
    event.contributionType !== 'none' && !detail.billingEnabled;
  if (event.status === 'draft') {
    return (
      <Card title={t('Draft actions')}>
        <div className="grid gap-space-4">
          <Link
            className={EVENT_LINK_CLASS}
            href={`/admin/events/${event.id}/edit`}
          >
            {t('Edit draft')}
          </Link>
          <VersionAction
            action={actions.publish}
            eventId={event.id}
            version={event.version}
            label={t('Publish and Notify')}
            confirmMessage={t(
              'Publish this event? Residents in the audience will be notified.',
            )}
            note={t(
              billingBlocked
                ? 'Turn on Billing, or remove the contribution, before publishing.'
                : 'Publishing notifies residents and opens RSVPs. The contribution cannot be changed afterwards.',
            )}
            disabled={billingBlocked}
          />
          <VersionAction
            action={actions.deleteDraft}
            eventId={event.id}
            version={event.version}
            label={t('Delete Draft')}
            confirmMessage={t('Delete this draft? This cannot be undone.')}
            note={t('Only a draft can be deleted.')}
          />
        </div>
      </Card>
    );
  }
  if (event.status === 'published' && !event.past) {
    return (
      <Card title={t('Event actions')}>
        <div className="grid gap-space-4">
          <Link
            className={EVENT_LINK_CLASS}
            href={`/admin/events/${event.id}/edit`}
          >
            {t('Edit event')}
          </Link>
          <CancelAction
            action={actions.cancel}
            eventId={event.id}
            version={event.version}
            hasContribution={event.contributionType !== 'none'}
          />
        </div>
      </Card>
    );
  }
  return null;
}

function audienceText(
  audience: EventAdminDetail['event']['audience'],
  blocks: readonly EventBlockOption[],
  locale: Locale | null,
) {
  if (audience.scope === 'all')
    return translateMessage(locale ?? 'en', 'Every active flat');
  const names = audience.blockIds.map(
    (blockId) =>
      blocks.find((block) => block.blockId === blockId)?.name ??
      translateMessage(locale ?? 'en', 'An inactive block'),
  );
  return names.length === 0
    ? translateMessage(locale ?? 'en', 'No blocks chosen yet')
    : names.join(', ');
}

type RsvpRow = EventAdminDetail['rsvps'][number];

function RsvpTable({ detail }: { detail: EventAdminDetail }) {
  const { locale, translate: t } = useUiTranslator();
  if (detail.rsvps.length === 0) {
    return (
      <Card title={t('RSVPs')}>
        <p className="text-body text-ink-muted">{t('No RSVPs yet.')}</p>
      </Card>
    );
  }
  const showCharges = detail.event.contributionType !== 'none';
  return (
    <Card title={t('RSVPs')} description={t('One response per flat.')}>
      <DataTable<RsvpRow>
        caption={t('RSVPs by flat')}
        rows={detail.rsvps}
        getRowId={(row) => row.rsvpId}
        getRowLabel={(row) => row.unitLabel}
        mobilePrimary={(row) => t('Flat {label}', { label: row.unitLabel })}
        mobileSecondary={(row) =>
          [
            row.status === 'going'
              ? t('{count} going', {
                  count: formatLocalizedNumber(row.headcount, locale ?? 'en'),
                })
              : null,
            showCharges ? formatEventMoney(row.netChargePaise, locale) : null,
            `${row.respondedByName ?? t('A resident')} · ${formatEventDateTime(row.respondedAt, locale)} IST`,
          ]
            .filter(Boolean)
            .join(' · ')
        }
        mobileStatus={(row) => `event_rsvp.${row.status}`}
        columns={[
          {
            id: 'unit',
            header: t('Flat'),
            render: (row) => row.unitLabel,
          },
          {
            id: 'status',
            header: t('Response'),
            render: (row) => <EventRsvpChip status={row.status} />,
          },
          {
            id: 'headcount',
            header: t('People'),
            align: 'right',
            render: (row) =>
              formatLocalizedNumber(row.headcount, locale ?? 'en'),
          },
          ...(showCharges
            ? [
                {
                  id: 'charge',
                  header: t('Charged'),
                  align: 'right' as const,
                  render: (row: RsvpRow) =>
                    formatEventMoney(row.netChargePaise, locale),
                },
              ]
            : []),
          {
            id: 'responded',
            header: t('Answered by'),
            render: (row) =>
              `${row.respondedByName ?? t('A resident')} · ${formatEventDateTime(row.respondedAt, locale)} IST`,
          },
        ]}
      />
    </Card>
  );
}

export function EventAdminDetailView({
  detail,
  blocks,
  actions,
  backHref = '/admin/events',
}: {
  detail: EventAdminDetail;
  blocks: readonly EventBlockOption[];
  actions: EventAdminActions;
  backHref?: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  const number = (value: number) =>
    formatLocalizedNumber(value, locale ?? 'en');
  const { event, totals } = detail;
  return (
    <section className="grid min-w-0 gap-space-4">
      <Link className={EVENT_LINK_CLASS} href={backHref}>
        {t('Back to Events')}
      </Link>
      <div className="flex flex-wrap items-center gap-space-2">
        <h1 className="text-title font-semibold break-words">{event.title}</h1>
        <EventStatusChip status={event.status} past={event.past} />
      </div>
      {event.status === 'cancelled' ? (
        <Banner title={t('This event was cancelled')} tone="warning">
          {event.cancellationReason ?? t('No reason was recorded.')}
        </Banner>
      ) : null}
      {event.contributionType !== 'none' &&
      !detail.billingEnabled &&
      event.status !== 'cancelled' ? (
        <Banner title={t('Billing is turned off')} tone="warning">
          {t(
            'This event has a contribution. It cannot be published, and residents cannot RSVP going, until Billing is turned on.',
          )}
        </Banner>
      ) : null}
      <Card title={t('When and where')}>
        <dl className="grid gap-space-2 text-body">
          <div>
            <dt className="text-caption text-ink-muted">{t('Starts (IST)')}</dt>
            <dd>{formatEventDateTime(event.startsAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t('Ends (IST)')}</dt>
            <dd>{formatEventDateTime(event.endsAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t('Venue')}</dt>
            <dd className="break-words">{event.venue ?? t('Not set')}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">
              {t('RSVP deadline (IST)')}
            </dt>
            <dd>
              {event.rsvpDeadline
                ? formatEventDateTime(event.rsvpDeadline, locale)
                : t('When the event starts')}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">
              {t('Who is invited')}
            </dt>
            <dd className="break-words">
              {audienceText(event.audience, blocks, locale)}
            </dd>
          </div>
        </dl>
        {event.description ? (
          <p className="mt-space-3 break-words whitespace-pre-line text-body">
            {event.description}
          </p>
        ) : null}
      </Card>
      <Card title={t('Limits and contribution')}>
        <dl className="grid gap-space-2 text-body">
          <div>
            <dt className="text-caption text-ink-muted">{t('Capacity')}</dt>
            <dd>
              {event.capacity === null
                ? t('No limit')
                : t('{count} people', { count: number(event.capacity) })}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">
              {t('Limit per flat')}
            </dt>
            <dd>
              {event.maxPerUnit === null
                ? t('No limit')
                : t(
                    event.maxPerUnit === 1
                      ? '{count} person'
                      : '{count} people',
                    { count: number(event.maxPerUnit) },
                  )}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t('Contribution')}</dt>
            <dd>
              {describeContribution(
                event.contributionType,
                event.contributionPaise,
                locale,
              )}
            </dd>
          </div>
        </dl>
      </Card>
      {event.status !== 'draft' ? (
        <Card title={t('Totals')}>
          <dl className="grid gap-space-3 text-body medium:grid-cols-2">
            <div>
              <dt className="text-caption text-ink-muted">
                {t('People going')}
              </dt>
              <dd className="text-body-strong">
                {event.capacity === null
                  ? number(totals.goingHeadcount)
                  : t('{count} of {total}', {
                      count: number(totals.goingHeadcount),
                      total: number(event.capacity),
                    })}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-ink-muted">
                {t('Flats going')}
              </dt>
              <dd className="text-body-strong">
                {t('{count} of {total} invited', {
                  count: number(totals.goingUnits),
                  total: number(totals.audienceUnits),
                })}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-ink-muted">
                {t('Flats not going')}
              </dt>
              <dd className="text-body-strong">
                {number(totals.notGoingUnits)}
              </dd>
            </div>
            {event.contributionType !== 'none' ? (
              <div>
                <dt className="text-caption text-ink-muted">
                  {t('Contributions on bills')}
                </dt>
                <dd className="text-body-strong">
                  {formatEventMoney(totals.collectedPaise, locale)}
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>
      ) : null}
      <EventLifecycle detail={detail} actions={actions} />
      {event.status !== 'draft' ? <RsvpTable detail={detail} /> : null}
    </section>
  );
}
