// Inspect one scrubbed error record by its internal record identifier.
import Link from 'next/link';
import { ErrorStatusControl } from '@/components/developer/console-controls';
import { Card, StatusChip } from '@/components/ui/data-display';
import { getDeveloperError } from '@/core/developer/console';
import { ErrorPanel } from '@/components/ui/feedback';

export const metadata = {
  title: 'Error Details | Developer Console | Homeish',
  robots: { index: false, follow: false },
};

type ErrorDetailProps = {
  params: Promise<{ errorId: string }>;
};

export default async function DeveloperErrorDetailPage({
  params,
}: ErrorDetailProps) {
  const { errorId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      errorId,
    )
  ) {
    return (
      <ErrorPanel
        message="Check the error address and try again."
        title="Error record not found"
      />
    );
  }
  const error = await getDeveloperError(errorId);

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <Link
          className="text-caption text-dev-label underline"
          href="/developer/errors"
        >
          Back to Error Logs
        </Link>
        <h1 className="text-title font-semibold">Error Details</h1>
      </header>
      <Card
        title={error.message}
        description={`Reference ID: ${error.reference_id}`}
      >
        <dl className="grid gap-space-3 medium:grid-cols-2">
          <div>
            <dt className="text-caption text-ink-muted">Time</dt>
            <dd className="text-body">
              {new Intl.DateTimeFormat('en', {
                dateStyle: 'full',
                timeStyle: 'long',
                timeZone: 'Asia/Kolkata',
              }).format(new Date(error.created_at))}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Severity</dt>
            <dd className="mt-space-1">
              <StatusChip
                status={
                  error.severity === 'critical'
                    ? 'severity.critical'
                    : error.severity === 'warning'
                      ? 'severity.warning'
                      : error.severity === 'info'
                        ? 'severity.info'
                        : 'severity.error'
                }
              />
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Status</dt>
            <dd className="mt-space-1">
              <StatusChip
                status={
                  error.status === 'resolved'
                    ? 'error_log.resolved'
                    : error.status === 'ignored'
                      ? 'error_log.ignored'
                      : 'error_log.open'
                }
              />
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Route</dt>
            <dd className="break-all font-mono text-body">
              {error.route ?? 'Not recorded'}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Source</dt>
            <dd className="text-body">{error.source}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Module</dt>
            <dd className="text-body">{error.module_key ?? 'Core'}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Request ID</dt>
            <dd className="break-all font-mono text-body">
              {error.request_id ?? 'Not recorded'}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">App version</dt>
            <dd className="text-body">{error.app_version ?? 'Not recorded'}</dd>
          </div>
        </dl>
        <div className="mt-space-5 grid gap-space-2">
          <h2 className="text-subheading">Resolution</h2>
          {error.status === 'open' ? (
            <ErrorStatusControl
              currentStatus={error.status}
              errorId={error.id}
            />
          ) : (
            <p className="text-body">
              {error.status === 'resolved' ? 'Resolved' : 'Ignored'}
              {error.resolve_note ? `: ${error.resolve_note}` : ''}
            </p>
          )}
        </div>
      </Card>
      {error.stack ? (
        <Card title="Stack details">
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-sunken p-space-3 font-mono text-caption">
            {error.stack}
          </pre>
        </Card>
      ) : null}
      {error.device ? (
        <Card title="Device details">
          <pre className="overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-sunken p-space-3 font-mono text-caption">
            {JSON.stringify(error.device, null, 2)}
          </pre>
        </Card>
      ) : null}
    </section>
  );
}
