// List member contact log entries with status filters and let admins and committee members add or update them.
'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  CONTACT_CHANNELS,
  CONTACT_CHANNEL_LABELS,
  CONTACT_DIRECTIONS,
  CONTACT_DIRECTION_LABELS,
  CONTACT_LOG_FILTERS,
  CONTACT_LOG_HREF,
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  CONTACT_SUMMARY_MAX,
  CONTACT_TYPES,
  CONTACT_TYPE_LABELS,
  contactLogSaveInputSchema,
  type ContactLogEntry,
  type ContactLogFilter,
  type ContactLogPage,
} from '@/core/communication/validation';
import { useToolkitDates } from '@/components/toolkit/shared';

const FILTER_LABELS: Readonly<Record<ContactLogFilter, string>> = {
  all: 'All',
  open: 'Open',
  closed: 'Closed',
};

export type ContactLogActions = { saveLog: ModuleFormAction };

export function ContactLogScreen({
  view,
  filter,
  today,
  actions,
}: {
  view: ContactLogPage & { currentUserId: string };
  filter: ContactLogFilter;
  today: string;
  actions: ContactLogActions;
}) {
  const { translate: t } = useUiTranslator();
  const [adding, setAdding] = useState(false);
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Contact log')}</h1>
        <p className="text-ink-muted">
          {t(
            'Record queries, complaints and other contacts with members that happen outside Homeish, and follow them up until they are closed.',
          )}
        </p>
      </header>
      <Banner tone="info">
        {t(
          'Only admins and committee members can see this log. Keep summaries short and leave out phone numbers, health details and other private information. Closed entries are deleted three years after they close.',
        )}
      </Banner>
      <nav
        aria-label={t('Contact log filter')}
        className="flex flex-wrap gap-space-2"
      >
        {CONTACT_LOG_FILTERS.map((key) => (
          <Link
            key={key}
            href={
              key === 'all'
                ? CONTACT_LOG_HREF
                : `${CONTACT_LOG_HREF}?status=${key}`
            }
            aria-current={filter === key ? 'page' : undefined}
            className={`inline-flex min-h-12 items-center rounded-md px-space-3 ${filter === key ? 'bg-brand text-on-brand' : 'border border-rule'}`}
          >
            {t(FILTER_LABELS[key])}
          </Link>
        ))}
      </nav>
      {adding ? (
        <div className="grid gap-space-3 rounded-md border border-rule p-space-4">
          <h2 className="text-body-strong">{t('Add contact')}</h2>
          <ContactLogForm
            view={view}
            today={today}
            action={actions.saveLog}
            onSaved={() => setAdding(false)}
          />
          <Button variant="secondary" onClick={() => setAdding(false)}>
            {t('Cancel')}
          </Button>
        </div>
      ) : (
        <div>
          <Button onClick={() => setAdding(true)}>{t('Add contact')}</Button>
        </div>
      )}
      {view.logs.length === 0 ? (
        <EmptyState
          title={t('No contacts logged')}
          description={
            filter === 'all'
              ? t(
                  'Add a contact when a member reaches the office outside Homeish.',
                )
              : t('No entries match this filter.')
          }
        />
      ) : (
        <ul className="grid min-w-0 gap-space-3">
          {view.logs.map((entry) => (
            <ContactLogRow
              key={entry.id}
              entry={entry}
              view={view}
              today={today}
              action={actions.saveLog}
            />
          ))}
        </ul>
      )}
      {view.logs.length >= 200 ? (
        <p className="text-caption text-ink-muted">
          {t('Showing the latest 200 entries.')}
        </p>
      ) : null}
    </section>
  );
}

function ContactLogRow({
  entry,
  view,
  today,
  action,
}: {
  entry: ContactLogEntry;
  view: ContactLogPage & { currentUserId: string };
  today: string;
  action: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const dates = useToolkitDates();
  const [editing, setEditing] = useState(false);
  const request = view.requests.find(
    (item) => item.id === entry.service_request_id,
  );
  return (
    <li
      className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4"
      aria-label={t('Contact on {date}', {
        date: dates.date(entry.contact_on),
      })}
    >
      <div className="flex flex-wrap items-center gap-space-2">
        <StatusChip status={`contact.${entry.status}`} />
        {entry.follow_up_overdue ? (
          <StatusChip status="contact.follow_up_overdue" />
        ) : null}
        <span className="text-caption text-ink-muted">
          {dates.date(entry.contact_on)} ·{' '}
          {t(CONTACT_TYPE_LABELS[entry.contact_type])} ·{' '}
          {t(CONTACT_CHANNEL_LABELS[entry.channel])}
        </span>
      </div>
      <p className="whitespace-pre-line">{entry.summary}</p>
      <dl className="grid min-w-0 gap-space-1 medium:grid-cols-2">
        <div>
          <dt className="text-caption text-ink-muted">{t('Unit')}</dt>
          <dd>{entry.unit_label ?? t('Not linked')}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{t('Handled by')}</dt>
          <dd>{entry.handled_by_name ?? t('Former member')}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">{t('Direction')}</dt>
          <dd>{t(CONTACT_DIRECTION_LABELS[entry.direction])}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-muted">
            {entry.status === 'closed' ? t('Closed') : t('Days open')}
          </dt>
          <dd>
            {entry.status === 'closed' && entry.closed_at
              ? dates.date(entry.closed_at.slice(0, 10))
              : entry.days_open}
          </dd>
        </div>
        {entry.follow_up_on ? (
          <div>
            <dt className="text-caption text-ink-muted">
              {t('Follow-up date')}
            </dt>
            <dd>{dates.date(entry.follow_up_on)}</dd>
          </div>
        ) : null}
        {entry.service_request_id ? (
          <div>
            <dt className="text-caption text-ink-muted">
              {t('Service request')}
            </dt>
            <dd>{request?.label ?? t('Linked request')}</dd>
          </div>
        ) : null}
      </dl>
      {editing ? (
        <div className="grid gap-space-3">
          <ContactLogForm
            view={view}
            today={today}
            entry={entry}
            action={action}
            onSaved={() => setEditing(false)}
          />
          <Button variant="secondary" onClick={() => setEditing(false)}>
            {t('Cancel')}
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {t('Update')}
          </Button>
        </div>
      )}
    </li>
  );
}

function ContactLogForm({
  view,
  today,
  entry,
  action,
  onSaved,
}: {
  view: ContactLogPage & { currentUserId: string };
  today: string;
  entry?: ContactLogEntry;
  action: ModuleFormAction;
  onSaved: () => void;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const handlers = view.handlers.some(
    (handler) => handler.id === entry?.handled_by,
  )
    ? view.handlers
    : entry
      ? [
          ...view.handlers,
          {
            id: entry.handled_by,
            name: entry.handled_by_name ?? t('Former member'),
          },
        ]
      : view.handlers;
  const defaultHandler =
    entry?.handled_by ??
    (view.handlers.some((handler) => handler.id === view.currentUserId)
      ? view.currentUserId
      : (view.handlers[0]?.id ?? ''));
  return (
    <ModuleActionForm
      action={action}
      idempotent={!entry}
      onSaved={onSaved}
      submitLabel={entry ? t('Save contact') : t('Add contact')}
      input={(form) =>
        contactLogSaveInputSchema.parse({
          logId: entry?.id ?? null,
          expectedUpdatedAt: entry?.updated_at ?? null,
          clientRequestId: entry ? null : crypto.randomUUID(),
          contactOn: String(form.get('contactOn') ?? ''),
          unitId: String(form.get('unitId') ?? ''),
          contactType: form.get('contactType'),
          channel: form.get('channel'),
          direction: form.get('direction'),
          summary: String(form.get('summary') ?? ''),
          handledBy: form.get('handledBy'),
          followUpOn: String(form.get('followUpOn') ?? ''),
          status: form.get('status'),
          serviceRequestId: String(form.get('serviceRequestId') ?? ''),
        })
      }
    >
      <TextInput
        id={`${id}-contact-on`}
        name="contactOn"
        type="date"
        label={t('Contact date')}
        max={today}
        required
        defaultValue={entry?.contact_on ?? today}
      />
      <SelectInput
        id={`${id}-type`}
        name="contactType"
        label={t('Contact type')}
        defaultValue={entry?.contact_type ?? 'query'}
        options={CONTACT_TYPES.map((value) => ({
          value,
          label: t(CONTACT_TYPE_LABELS[value]),
        }))}
      />
      <SelectInput
        id={`${id}-channel`}
        name="channel"
        label={t('Channel')}
        defaultValue={entry?.channel ?? 'in_person'}
        options={CONTACT_CHANNELS.map((value) => ({
          value,
          label: t(CONTACT_CHANNEL_LABELS[value]),
        }))}
      />
      <SelectInput
        id={`${id}-direction`}
        name="direction"
        label={t('Direction')}
        defaultValue={entry?.direction ?? 'incoming'}
        options={CONTACT_DIRECTIONS.map((value) => ({
          value,
          label: t(CONTACT_DIRECTION_LABELS[value]),
        }))}
      />
      <SelectInput
        id={`${id}-unit`}
        name="unitId"
        label={t('Unit')}
        defaultValue={entry?.unit_id ?? ''}
        options={[
          { value: '', label: t('Not linked') },
          ...view.units.map((unit) => ({ value: unit.id, label: unit.label })),
        ]}
      />
      <TextAreaInput
        id={`${id}-summary`}
        name="summary"
        label={t('Summary')}
        helpText={t(
          'A short note of what was raised. Leave out private details.',
        )}
        maxLength={CONTACT_SUMMARY_MAX}
        required
        defaultValue={entry?.summary ?? ''}
      />
      <SelectInput
        id={`${id}-handler`}
        name="handledBy"
        label={t('Handled by')}
        defaultValue={defaultHandler}
        options={handlers.map((handler) => ({
          value: handler.id,
          label: handler.name ?? t('Former member'),
        }))}
      />
      <SelectInput
        id={`${id}-status`}
        name="status"
        label={t('Status')}
        defaultValue={entry?.status ?? 'open'}
        options={CONTACT_STATUSES.map((value) => ({
          value,
          label: t(CONTACT_STATUS_LABELS[value]),
        }))}
      />
      <TextInput
        id={`${id}-follow-up`}
        name="followUpOn"
        type="date"
        label={t('Follow-up date')}
        helpText={t('Required when the status is Follow-up.')}
        defaultValue={entry?.follow_up_on ?? ''}
      />
      {view.requests.length > 0 || entry?.service_request_id ? (
        <SelectInput
          id={`${id}-request`}
          name="serviceRequestId"
          label={t('Service request')}
          helpText={t('Optional. Link the request this contact is about.')}
          defaultValue={entry?.service_request_id ?? ''}
          options={[
            { value: '', label: t('Not linked') },
            ...view.requests.map((request) => ({
              value: request.id,
              label: request.label,
            })),
            ...(entry?.service_request_id &&
            !view.requests.some(
              (request) => request.id === entry.service_request_id,
            )
              ? [
                  {
                    value: entry.service_request_id,
                    label: t('Linked request'),
                  },
                ]
              : []),
          ]}
        />
      ) : null}
    </ModuleActionForm>
  );
}
