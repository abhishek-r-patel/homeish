// Load emergency SOS screens through authorised operations for each role.
import 'server-only';
import type { ComponentProps } from 'react';
import { AppError } from '../../core/errors';
import { getSosWorkspace } from '../../core/sos/operations';
import { sosHistorySearchSchema } from '../../core/sos/validation';
import { SosRouteState, SosWorkspaceView, type SosAudience } from './workspace';

export type SosPageSearch = Record<string, string | string[] | undefined>;
export const SOS_PAGE_METADATA = {
  title: 'Emergency SOS | Homeish',
  robots: { index: false, follow: false },
};

function pageFailure(error: unknown, returnHref: string, retryHref: string) {
  if (!(error instanceof AppError) || error.code === 'INTERNAL_ERROR')
    throw error;
  const kind =
    error.code === 'MODULE_DISABLED'
      ? 'disabled'
      : error.code === 'FORBIDDEN' || error.code === 'UNAUTHENTICATED'
        ? 'denied'
        : 'error';
  return (
    <SosRouteState
      kind={kind}
      returnHref={returnHref}
      retryHref={kind === 'error' ? retryHref : undefined}
      message={kind === 'error' ? error.message : undefined}
      referenceId={error.referenceId}
    />
  );
}

export async function SosIndexPage({
  audience,
  baseHref,
  searchParams,
}: {
  audience: SosAudience;
  baseHref: string;
  searchParams: Promise<SosPageSearch>;
}) {
  const returnHref =
    audience === 'guard'
      ? '/guard'
      : audience === 'management'
        ? '/admin'
        : '/';
  let content:
    | { kind: 'invalid_filters' | 'denied' }
    | { kind: 'ready'; props: ComponentProps<typeof SosWorkspaceView> };
  try {
    const query = sosHistorySearchSchema.safeParse(await searchParams);
    const workspace = await getSosWorkspace(
      query.success ? query.data : undefined,
    );
    if (!query.success) content = { kind: 'invalid_filters' };
    else if (
      (audience === 'management' && !workspace.can_respond) ||
      (audience === 'guard' && !workspace.can_raise)
    )
      content = { kind: 'denied' };
    else content = { kind: 'ready', props: { workspace, audience, baseHref } };
  } catch (error) {
    return pageFailure(error, returnHref, baseHref);
  }
  return content.kind === 'ready' ? (
    <SosWorkspaceView {...content.props} />
  ) : (
    <SosRouteState
      kind={content.kind}
      returnHref={content.kind === 'invalid_filters' ? baseHref : returnHref}
    />
  );
}
