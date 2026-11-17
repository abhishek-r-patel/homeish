// Render resident event lists, event details and the per-flat RSVP form with a contribution preview.
'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedNumber } from '@/core/i18n/format';
import { RadioGroup } from '@/components/ui/choice-controls';
import { Card, ListItem } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { TextInput } from '@/components/ui/text-input';
import { rsvpChargePreview } from '@/core/event/pricing';
import { memberRsvpStatus } from '@/core/event/summary';
import {
  EVENT_HEADCOUNT_MAX,
  eventRsvpInputSchema,
  type EventMemberDetail,
  type EventMemberFilter,
  type EventMemberList,
  type EventMemberUnit,
  type EventRsvpStatus,
} from '@/core/event/validation';
import {
  EVENT_LINK_CLASS,
  EventRsvpChip,
  EventStatusChip,
  describeContribution,
  formatEventDateTime,
  formatEventMoney,
} from './shared';

const FILTER_LABELS: Readonly<Record<EventMemberFilter, string>> = {
  upcoming: 'Upcoming',
  past: 'Past',
};

function listStatus(item: EventMemberList['items'][number]) {
  if (item.status === 'cancelled') return 'event.cancelled' as const;
  const status = memberRsvpStatus(item.myRsvps);
  if (status === 'going') return 'event_rsvp.going' as const;
  if (status === 'not_going') return 'event_rsvp.not_going' as const;
  return undefined;
}

export function ResidentEventListView({
  list,
  filter,
  basePath = '/events',
}: {
  list: EventMemberList;
  filter: EventMemberFilter;
  basePath?: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  function memberRsvpSummary(item: EventMemberList['items'][number]) {
    if (item.status === 'cancelled') return t('Cancelled');
    if (item.myRsvps.length === 0) return t('No RSVP yet');
    const reply = (rsvp: (typeof item.myRsvps)[number]) =>
      rsvp.status === 'going'
        ? t('Going · {people}', {
            people: t(
              rsvp.headcount === 1 ? '{count} person' : '{count} people',
              {
                count: formatLocalizedNumber(
                  rsvp.headcount ?? 0,
                  locale ?? 'en',
                ),
              },
            ),
          })
        : t(rsvp.status === 'not_going' ? 'Not going' : 'No RSVP yet');
    return item.myRsvps.length === 1
      ? reply(item.myRsvps[0]!)
      : item.myRsvps.map((rsvp) => `${rsvp.label}: ${reply(rsvp)}`).join('; ');
  }
  return (
    <section className="grid min-w-0 gap-space-5">
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold">{t('Events')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Society events open to your home. Tell the organisers who is coming. All times are India time (IST).',
          )}
        </p>
      </div>
      <nav aria-label={t('Event lists')} className="flex flex-wrap gap-space-4">
        {(Object.keys(FILTER_LABELS) as EventMemberFilter[]).map((value) => (
          <Link
            key={value}
            className={EVENT_LINK_CLASS}
            href={value === 'upcoming' ? basePath : `${basePath}?view=${value}`}
            aria-current={filter === value ? 'page' : undefined}
          >
            {t(FILTER_LABELS[value])}
          </Link>
        ))}
      </nav>
      {list.items.length === 0 ? (
        <EmptyState
          title={t(filter === 'past' ? 'No past events' : 'No upcoming events')}
          description={t(
            filter === 'past'
              ? 'Events that have ended or were cancelled will appear here.'
              : 'You will be notified when a new event is announced.',
          )}
        />
      ) : (
        <ul className="grid gap-space-2">
          {list.items.map((item) => (
            <li key={item.id}>
              <ListItem
                href={`/events/${item.id}`}
                title={<span className="break-words">{item.title}</span>}
                secondary={
                  <span className="break-words">
                    {formatEventDateTime(item.startsAt, locale)} IST
                    {item.venue ? ` · ${item.venue}` : ''} ·{' '}
                    {describeContribution(
                      item.contributionType,
                      item.contributionPaise,
                      locale,
                    )}{' '}
                    · {memberRsvpSummary(item)}
                  </span>
                }
                status={listStatus(item)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContributionPreview({
  event,
  currentChargePaise,
  status,
  headcount,
}: {
  event: EventMemberDetail['event'];
  currentChargePaise: number;
  status: EventRsvpStatus;
  headcount: number;
}) {
  const { locale, translate: t } = useUiTranslator();
  if (event.contributionType === 'none') return null;
  const { chargePaise, changePaise } = rsvpChargePreview(
    event.contributionType,
    event.contributionPaise,
    currentChargePaise,
    { status, headcount },
  );
  if (changePaise > 0) {
    return (
      <p role="status" className="text-body text-ink">
        {t(
          currentChargePaise > 0
            ? '{amount} will be added to your flat’s bill (total {total} for this event).'
            : '{amount} will be added to your flat’s bill.',
          {
            amount: formatEventMoney(changePaise, locale),
            total: formatEventMoney(chargePaise, locale),
          },
        )}
      </p>
    );
  }
  if (changePaise < 0) {
    return (
      <p role="status" className="text-body text-ink">
        {t('{amount} will be credited back to your flat’s bill.', {
          amount: formatEventMoney(-changePaise, locale),
        })}
      </p>
    );
  }
  return (
    <p role="status" className="text-body text-ink-muted">
      {chargePaise > 0
        ? t('No change to the {amount} already on your flat’s bill.', {
            amount: formatEventMoney(chargePaise, locale),
          })
        : t('Nothing will be added to your flat’s bill.')}
    </p>
  );
}

function UnitRsvpForm({
  detail,
  unit,
  action,
}: {
  detail: EventMemberDetail;
  unit: EventMemberUnit;
  action: ModuleFormAction;
}) {
  const { locale, translate: t } = useUiTranslator();
  const id = useId();
  const { event } = detail;
  const [status, setStatus] = useState<EventRsvpStatus>(
    unit.rsvp?.status ?? 'going',
  );
  const [headcount, setHeadcount] = useState(
    String(unit.rsvp && unit.rsvp.headcount > 0 ? unit.rsvp.headcount : 1),
  );
  const parsedHeadcount = Number(headcount);
  const maxHeadcount = event.maxPerUnit ?? EVENT_HEADCOUNT_MAX;
  const validHeadcount =
    Number.isInteger(parsedHeadcount) &&
    parsedHeadcount >= 1 &&
    parsedHeadcount <= maxHeadcount;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Save RSVP for {label}', { label: unit.label })}
      input={() =>
        eventRsvpInputSchema.parse({
          eventId: event.id,
          unitId: unit.unitId,
          status,
          headcount: status === 'going' ? parsedHeadcount : 0,
          expectedVersion: unit.rsvp?.version ?? null,
        })
      }
    >
      <RadioGroup
        id={`${id}-status`}
        name={`${id}-status`}
        label={t('Is {label} coming?', { label: unit.label })}
        value={status}
        onChange={(value) =>
          setStatus(value === 'not_going' ? 'not_going' : 'going')
        }
        options={[
          { value: 'going', label: t('Going') },
          { value: 'not_going', label: t('Not going') },
        ]}
      />
      {status === 'going' ? (
        <TextInput
          id={`${id}-headcount`}
          label={t('How many people are coming?')}
          type="number"
          inputMode="numeric"
          min={1}
          max={maxHeadcount}
          step={1}
          required
          value={headcount}
          helpText={
            event.maxPerUnit
              ? t('Up to {count} per flat.', {
                  count: formatLocalizedNumber(
                    event.maxPerUnit,
                    locale ?? 'en',
                  ),
                })
              : t('Include everyone from your home who is coming.')
          }
          error={
            headcount !== '' && !validHeadcount
              ? t('Enter a number from 1 to {count}.', {
                  count: formatLocalizedNumber(maxHeadcount, locale ?? 'en'),
                })
              : undefined
          }
          onChange={(nextEvent) => setHeadcount(nextEvent.currentTarget.value)}
        />
      ) : null}
      <ContributionPreview
        event={event}
        currentChargePaise={unit.rsvp?.netChargePaise ?? 0}
        status={status}
        headcount={validHeadcount ? parsedHeadcount : 0}
      />
      {event.contributionType !== 'none' ? (
        <p className="text-caption text-ink-muted">
          {t(
            'If you change to not going before RSVPs close on {date} IST, the contribution is credited back in full. After that, it cannot be refunded unless the event is cancelled.',
            { date: formatEventDateTime(event.rsvpClosesAt, locale) },
          )}
        </p>
      ) : null}
    </ModuleActionForm>
  );
}

function UnitRsvp({
  detail,
  unit,
  action,
}: {
  detail: EventMemberDetail;
  unit: EventMemberUnit;
  action: ModuleFormAction;
}) {
  const { locale, translate: t } = useUiTranslator();
  const { event } = detail;
  const current = unit.rsvp ? (
    <div className="flex flex-wrap items-center gap-space-2 text-body">
      <EventRsvpChip status={unit.rsvp.status} />
      {unit.rsvp.status === 'going' ? (
        <span>
          {t(unit.rsvp.headcount === 1 ? '{count} person' : '{count} people', {
            count: formatLocalizedNumber(unit.rsvp.headcount, locale ?? 'en'),
          })}
        </span>
      ) : null}
      {unit.rsvp.netChargePaise > 0 ? (
        <span className="text-ink-muted">
          ·{' '}
          {t('{amount} on your bill', {
            amount: formatEventMoney(unit.rsvp.netChargePaise, locale),
          })}
        </span>
      ) : null}
    </div>
  ) : (
    <p className="text-body text-ink-muted">{t('No RSVP yet.')}</p>
  );
  let body;
  if (event.status === 'cancelled') {
    body = (
      <p className="text-body text-ink-muted">
        {t(
          'This event was cancelled. Any contribution was credited back to your flat’s bill.',
        )}
      </p>
    );
  } else if (!event.rsvpOpen) {
    body = (
      <p className="text-body text-ink-muted">
        {t('RSVPs closed on {date} IST.', {
          date: formatEventDateTime(event.rsvpClosesAt, locale),
        })}
      </p>
    );
  } else if (!unit.canRsvp) {
    body = (
      <p className="text-body text-ink-muted">
        {t(
          'You cannot RSVP for this flat. Only people currently living in it can.',
        )}
      </p>
    );
  } else {
    body = <UnitRsvpForm detail={detail} unit={unit} action={action} />;
  }
  return (
    <li className="grid min-w-0 gap-space-3">
      <p className="text-body-strong break-words">
        {t('Flat {label}', { label: unit.label })}
      </p>
      {current}
      {body}
    </li>
  );
}

export function ResidentEventDetailView({
  detail,
  rsvpAction,
  backHref = '/events',
}: {
  detail: EventMemberDetail;
  rsvpAction: ModuleFormAction;
  backHref?: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  const number = (value: number) =>
    formatLocalizedNumber(value, locale ?? 'en');
  const { event } = detail;
  const hasContribution = event.contributionType !== 'none';
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
          {event.cancellationReason ?? t('No reason was given.')}
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
              {t('RSVPs close (IST)')}
            </dt>
            <dd>{formatEventDateTime(event.rsvpClosesAt, locale)}</dd>
          </div>
        </dl>
        {event.description ? (
          <p className="mt-space-3 break-words whitespace-pre-line text-body">
            {event.description}
          </p>
        ) : null}
      </Card>
      <Card title={t('Places and contribution')}>
        <dl className="grid gap-space-2 text-body">
          <div>
            <dt className="text-caption text-ink-muted">{t('Places left')}</dt>
            <dd>
              {detail.spotsLeft === null
                ? t('No limit')
                : detail.spotsLeft === 0
                  ? t('Full')
                  : t('{count} of {total}', {
                      count: number(detail.spotsLeft),
                      total: number(event.capacity ?? detail.spotsLeft),
                    })}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">{t('People going')}</dt>
            <dd>{number(detail.goingHeadcount)}</dd>
          </div>
          {event.maxPerUnit ? (
            <div>
              <dt className="text-caption text-ink-muted">
                {t('Limit per flat')}
              </dt>
              <dd>
                {t(
                  event.maxPerUnit === 1 ? '{count} person' : '{count} people',
                  { count: number(event.maxPerUnit) },
                )}
              </dd>
            </div>
          ) : null}
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
        {hasContribution ? (
          <p className="mt-space-3 text-caption text-ink-muted">
            {t(
              'The contribution is added to your flat’s bill as soon as you RSVP going.',
            )}
          </p>
        ) : null}
      </Card>
      {event.status === 'published' &&
      event.rsvpOpen &&
      detail.spotsLeft === 0 ? (
        <Banner title={t('This event is full')} tone="warning">
          {t(
            'New RSVPs or larger groups cannot be accepted. You can still say you are not going.',
          )}
        </Banner>
      ) : null}
      {hasContribution && !detail.billingEnabled && event.rsvpOpen ? (
        <Banner title={t('RSVPs are paused')} tone="warning">
          {t(
            'This event has a contribution, but billing is turned off for your society. Ask the committee to turn it on before you RSVP going.',
          )}
        </Banner>
      ) : null}
      <Card title={t('Your RSVP')}>
        {detail.myUnits.length === 0 ? (
          <p className="text-body text-ink-muted">
            {t('None of your flats are invited to this event.')}
          </p>
        ) : (
          <ul className="grid gap-space-5">
            {detail.myUnits.map((unit) => (
              <UnitRsvp
                key={unit.unitId}
                detail={detail}
                unit={unit}
                action={rsvpAction}
              />
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
