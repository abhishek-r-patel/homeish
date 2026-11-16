// Share analytics route states (no permission, archived society) across the dashboard and settings pages.
import Link from 'next/link';
import { EmptyState } from '@/components/ui/feedback';

export type AnalyticsRouteStateKind = 'denied' | 'archived';

const linkClass =
  'text-brand underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function AnalyticsRouteState({
  kind,
  returnHref,
  returnLabel = 'Back to Home',
  deniedMessage,
}: {
  kind: AnalyticsRouteStateKind;
  returnHref: string;
  returnLabel?: string;
  deniedMessage?: string;
}) {
  return (
    <EmptyState
      title={
        kind === 'archived'
          ? 'This society is no longer available'
          : 'You do not have access to this page'
      }
      description={
        kind === 'archived'
          ? 'Analytics are not available for an archived society.'
          : (deniedMessage ??
            'Analytics are available to society administrators and committee members.')
      }
      action={
        <Link className={linkClass} href={returnHref}>
          {returnLabel}
        </Link>
      }
    />
  );
}
