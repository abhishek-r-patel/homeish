// Shared resident and administrator service request detail.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Card, StatusChip } from '@/components/ui/data-display';
import { ServiceRequestDetailControls } from '@/components/service-requests/detail-controls';
import {
  ESCALATION_RESPONSE_LABELS,
  ServiceRequestHelpdeskControls,
} from '@/components/service-requests/helpdesk-controls';
import { INTAKE_SOURCE_LABELS } from '@/components/service-requests/log-form';
import { ServiceRequestUpvote } from '@/components/service-requests/upvote';
import { AmcRequestLinkForm } from '@/components/amc/controls';
import {
  getServiceRequestAssignees,
  getServiceRequestDetail,
} from '@/core/service-requests/operations';
import { setServiceRequestUpvoteAction } from '../actions';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage, type MessageValues } from '@/core/i18n/messages';
import {
  formatLocalizedDateTime,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';

export const metadata = {
  title: 'Request | Homeish',
  robots: { index: false, follow: false },
};

function dateTime(value: string, locale: Locale) {
  return formatLocalizedDateTime(new Date(value), locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

export default async function ServiceRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: MessageValues) =>
    translateMessage(locale, source, values);
  const { requestId } = await params;
  if (!z.uuid().safeParse(requestId).success) notFound();
  const detail = await getServiceRequestDetail(requestId);
  const assignees = detail.capabilities.canManage
    ? await getServiceRequestAssignees()
    : [];
  const request = detail.request;
  const backHref = detail.capabilities.canSeeAdminWorkspace
    ? '/admin/requests'
    : '/requests';

  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <Link className="text-body text-brand underline" href={backHref}>
          {t('Back to requests')}
        </Link>
        <div className="flex flex-wrap items-center gap-space-3">
          <h1 className="text-title font-semibold">{request.category_name}</h1>
          <StatusChip status={`request.${request.status}`} />
          <StatusChip status={`request.priority_${request.priority}`} />
          {request.on_hold_since ? (
            <StatusChip
              detail={t('{count} days', { count: request.held_days ?? 0 })}
              status="request.on_hold"
            />
          ) : request.is_overdue ? (
            <StatusChip status="request.overdue" />
          ) : null}
          {detail.capabilities.canSeeAdminWorkspace &&
          request.escalation_level !== 'none' ? (
            <StatusChip
              status={`request.escalated_${request.escalation_level}`}
            />
          ) : null}
        </div>
        <p className="text-body text-ink-muted">
          {request.location_type === 'unit'
            ? t('Unit {unit}', { unit: request.unit_number ?? '' })
            : t('Common area')}
          {' · '}
          {t('Submitted {date}', {
            date: dateTime(request.created_at, locale),
          })}
          {detail.capabilities.canSeeAdminWorkspace
            ? ` · ${t('Arrived by {source}', {
                source: t(INTAKE_SOURCE_LABELS[request.intake_source]),
              })}`
            : ''}
        </p>
        {request.location_type === 'common_area' ? (
          <ServiceRequestUpvote
            action={setServiceRequestUpvoteAction}
            canVote={detail.capabilities.canUpvote}
            count={request.upvote_count}
            requestId={request.id}
            upvoted={request.has_upvoted}
          />
        ) : null}
      </header>
      {request.on_hold_reason ? (
        <Card className="min-w-0" title={t('On hold')}>
          <p className="whitespace-pre-wrap text-body">
            {request.on_hold_reason}
          </p>
        </Card>
      ) : null}
      <Card className="min-w-0" title={t('Issue')}>
        <div className="grid gap-space-3">
          <p className="whitespace-pre-wrap text-body">{request.description}</p>
          {request.sla_due_at ? (
            <p className="text-caption text-ink-muted">
              {t('Response target {date}', {
                date: dateTime(request.sla_due_at, locale),
              })}
            </p>
          ) : null}
          <p className="text-caption text-ink-muted">
            {t('Assigned to:')}{' '}
            {request.assignee_name ??
              request.assigned_vendor_name ??
              t('Not assigned')}
          </p>
        </div>
      </Card>
      {request.rating !== null ? (
        <Card className="min-w-0" title={t('Feedback')}>
          <div className="grid gap-space-2">
            <p className="text-body">
              {t('Overall {score} of 5', { score: request.rating })}
              {request.rating_quality !== null
                ? ` · ${t('Quality {score}', { score: request.rating_quality })} · ${t('Speed {score}', { score: request.rating_speed ?? 0 })} · ${t('Behaviour {score}', { score: request.rating_behaviour ?? 0 })}`
                : ''}
            </p>
            {request.rating_comment ? (
              <p className="whitespace-pre-wrap text-body">
                {request.rating_comment}
              </p>
            ) : null}
            {detail.capabilities.canManage && request.feedback_follow_up ? (
              <p className="text-caption text-ink-muted">
                {request.feedback_follow_up === 'needed'
                  ? t('Follow-up needed')
                  : t('Follow-up done')}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}
      {detail.escalations.length ? (
        <Card className="min-w-0" title={t('Escalation response')}>
          <ul className="grid gap-space-3">
            {detail.escalations.map((step) => (
              <li
                className="grid gap-space-1 border-b border-rule pb-space-3"
                key={step.level}
              >
                <p className="text-body-strong">
                  {step.level === 'committee'
                    ? t('Committee escalation')
                    : t('Admin escalation')}
                  {' · '}
                  {t(ESCALATION_RESPONSE_LABELS[step.response_status])}
                </p>
                {step.response_note ? (
                  <p className="whitespace-pre-wrap text-body">
                    {step.response_note}
                  </p>
                ) : null}
                <p className="text-caption text-ink-muted">
                  {step.responded_at
                    ? t('{name} responded {date} · {count} days to respond', {
                        name: step.responder_name ?? t('Member'),
                        date: dateTime(step.responded_at, locale),
                        count: step.days_to_respond ?? 0,
                      })
                    : t('Escalated on {date}', { date: step.escalated_on })}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {detail.amc.assetLabel || detail.amc.contracts.length ? (
        <Card className="min-w-0" title={t('AMC asset')}>
          <p>{detail.amc.assetLabel ?? t('No AMC asset linked.')}</p>
          {detail.capabilities.canManage && detail.amc.contracts.length ? (
            <AmcRequestLinkForm
              requestId={request.id}
              contracts={detail.amc.contracts}
              contractId={detail.amc.contractId}
            />
          ) : null}
        </Card>
      ) : null}
      {detail.attachments.length ? (
        <Card className="min-w-0" title={t('Photos')}>
          <ul className="grid gap-space-2">
            {detail.attachments.map((attachment, index) => (
              <li key={attachment.id}>
                <a
                  className="text-body text-brand underline"
                  href={attachment.signed_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t('View photo {number}', {
                    number: formatLocalizedNumber(index + 1, locale),
                  })}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card className="min-w-0" title={t('Updates')}>
        {detail.events.length ? (
          <ol className="grid gap-space-3">
            {detail.events.map((event) => (
              <li className="border-l-2 border-rule pl-space-3" key={event.id}>
                <p className="text-body-strong">
                  {event.event_type.replaceAll('_', ' ')}
                  {event.to_status
                    ? ` · ${event.to_status.replaceAll('_', ' ')}`
                    : ''}
                </p>
                {event.note ? <p className="text-body">{event.note}</p> : null}
                <p className="text-caption text-ink-muted">
                  {event.actor_name ?? 'Homeish'} ·{' '}
                  {dateTime(event.created_at, locale)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-ink-muted">{t('No updates yet.')}</p>
        )}
      </Card>
      <Card className="min-w-0" title={t('Comments')}>
        {detail.comments.length ? (
          <ul className="grid gap-space-3">
            {detail.comments.map((comment) => (
              <li className="border-b border-rule pb-space-3" key={comment.id}>
                <p className="whitespace-pre-wrap text-body">{comment.body}</p>
                <p className="text-caption text-ink-muted">
                  {comment.author_name ?? t('Member')} ·{' '}
                  {dateTime(comment.created_at, locale)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">{t('No comments yet.')}</p>
        )}
      </Card>
      <ServiceRequestHelpdeskControls
        canManage={detail.capabilities.canManage}
        escalations={detail.escalations}
        followUp={request.feedback_follow_up}
        onHold={request.on_hold_since !== null}
        priority={request.priority}
        rated={request.rating !== null}
        requestId={request.id}
        respondLevels={detail.capabilities.respondLevels}
        status={request.status}
      />
      <ServiceRequestDetailControls
        assignees={assignees}
        canManage={detail.capabilities.canManage}
        canUpdate={detail.capabilities.canUpdate}
        isRequester={detail.capabilities.isRequester}
        rated={request.rating !== null}
        requestId={request.id}
        status={request.status}
        vendors={detail.vendors}
      />
    </section>
  );
}
