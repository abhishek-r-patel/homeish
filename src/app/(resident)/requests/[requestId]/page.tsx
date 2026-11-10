// Shared resident and administrator service request detail.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Card, StatusChip } from '@/components/ui/data-display';
import { ServiceRequestDetailControls } from '@/components/service-requests/detail-controls';
import {
  getServiceRequestAssignees,
  getServiceRequestDetail,
} from '@/core/service-requests/operations';

export const metadata = {
  title: 'Request | Homeish',
  robots: { index: false, follow: false },
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export default async function ServiceRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
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
          Back to requests
        </Link>
        <div className="flex flex-wrap items-center gap-space-3">
          <h1 className="text-title font-semibold">{request.category_name}</h1>
          <StatusChip status={`request.${request.status}`} />
          {request.is_overdue ? <StatusChip status="request.overdue" /> : null}
        </div>
        <p className="text-body text-ink-muted">
          {request.location_type === 'unit'
            ? `Unit ${request.unit_number ?? ''}`
            : 'Common area'}
          {' · '}Submitted {dateTime(request.created_at)}
        </p>
      </header>
      <Card className="min-w-0" title="Issue">
        <div className="grid gap-space-3">
          <p className="whitespace-pre-wrap text-body">{request.description}</p>
          <p className="text-caption text-ink-muted">
            Priority: {request.priority}
            {request.sla_due_at
              ? ` · Response target ${dateTime(request.sla_due_at)}`
              : ''}
          </p>
          <p className="text-caption text-ink-muted">
            Assigned to:{' '}
            {request.assignee_name ??
              request.assigned_vendor_name ??
              'Not assigned'}
          </p>
        </div>
      </Card>
      {detail.attachments.length ? (
        <Card className="min-w-0" title="Photos">
          <ul className="grid gap-space-2">
            {detail.attachments.map((attachment, index) => (
              <li key={attachment.id}>
                <a
                  className="text-body text-brand underline"
                  href={attachment.signed_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  View photo {index + 1}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card className="min-w-0" title="Updates">
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
                  {event.actor_name ?? 'Homeish'} · {dateTime(event.created_at)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-ink-muted">No updates yet.</p>
        )}
      </Card>
      <Card className="min-w-0" title="Comments">
        {detail.comments.length ? (
          <ul className="grid gap-space-3">
            {detail.comments.map((comment) => (
              <li className="border-b border-rule pb-space-3" key={comment.id}>
                <p className="whitespace-pre-wrap text-body">{comment.body}</p>
                <p className="text-caption text-ink-muted">
                  {comment.author_name ?? 'Member'} ·{' '}
                  {dateTime(comment.created_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">No comments yet.</p>
        )}
      </Card>
      <ServiceRequestDetailControls
        assignees={assignees}
        canManage={detail.capabilities.canManage}
        canUpdate={detail.capabilities.canUpdate}
        isRequester={detail.capabilities.isRequester}
        rated={request.rating !== null}
        requestId={request.id}
        status={request.status}
      />
    </section>
  );
}
