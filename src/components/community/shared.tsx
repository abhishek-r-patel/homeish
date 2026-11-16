// Share Community & Marketplace route states, link styles, status chips and page links.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatusChip } from '@/components/ui/data-display';
import { EmptyState, ErrorPanel } from '@/components/ui/feedback';
import type { CommunityListingState } from '@/core/community/presentation';
import type {
  CommunityItemStatus,
  CommunityReplyStatus,
} from '@/core/community/validation';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';

export type CommunityRouteStateKind =
  'disabled' | 'denied' | 'error' | 'not-found';

export const COMMUNITY_LINK_CLASS =
  'text-brand underline focus-visible:outline-2 focus-visible:outline-focus';
export const COMMUNITY_PRIMARY_LINK_CLASS =
  'inline-flex min-h-12 items-center justify-center rounded-md bg-brand px-space-4 text-body-strong text-on-brand outline-none hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function CommunityStatusChip({
  status,
}: {
  status: CommunityItemStatus | CommunityReplyStatus | CommunityListingState;
}) {
  return (
    <StatusChip
      status={status === 'live' ? 'community.approved' : `community.${status}`}
    />
  );
}

export function CommunityPageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-space-1">
      <h1 className="text-title font-semibold break-words">{title}</h1>
      {description ? (
        <p className="text-body text-ink-muted">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

export function CommunityPager({
  page,
  total,
  pageSize,
  href,
}: {
  page: number;
  total: number;
  pageSize: number;
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav
      aria-label="Pages"
      className="flex flex-wrap items-center gap-space-4 text-body"
    >
      {page > 1 ? (
        <Link className={COMMUNITY_LINK_CLASS} href={href(page - 1)}>
          Newer
        </Link>
      ) : null}
      <span className="text-ink-muted">
        Page {Math.min(page, pages)} of {pages}
      </span>
      {page < pages ? (
        <Link className={COMMUNITY_LINK_CLASS} href={href(page + 1)}>
          Older
        </Link>
      ) : null}
    </nav>
  );
}

export function CommunityRouteState({
  kind,
  returnHref,
  retryHref,
  message,
  referenceId,
}: {
  kind: CommunityRouteStateKind;
  returnHref: string;
  retryHref?: string;
  message?: string;
  referenceId?: string;
}) {
  if (kind === 'disabled') {
    return (
      <ModuleDisabledPage
        embedded
        moduleKey="community"
        returnHref={returnHref}
      />
    );
  }
  if (kind === 'denied') {
    return (
      <EmptyState
        title="You do not have access to this page"
        description="Return to your Homeish home page."
        action={
          <Link className={COMMUNITY_LINK_CLASS} href={returnHref}>
            Back
          </Link>
        }
      />
    );
  }
  if (kind === 'not-found') {
    return (
      <EmptyState
        title="We cannot find this"
        description="It may have been deleted or removed by an administrator, or it may not be open to you."
        action={
          <Link className={COMMUNITY_LINK_CLASS} href={returnHref}>
            Back to Community
          </Link>
        }
      />
    );
  }
  return (
    <ErrorPanel
      title="Something went wrong"
      message={
        message ?? 'We could not load this page. Refresh the page and retry.'
      }
      referenceId={referenceId}
      action={
        <div className="flex flex-wrap gap-space-3">
          {retryHref ? (
            <Link className={COMMUNITY_LINK_CLASS} href={retryHref}>
              Retry
            </Link>
          ) : null}
          <Link className={COMMUNITY_LINK_CLASS} href={returnHref}>
            Back
          </Link>
        </div>
      }
    />
  );
}
