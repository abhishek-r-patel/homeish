// Load moving screens through authorised operations while preserving each role's privacy boundary.
import 'server-only';
import type { ComponentProps } from 'react';
import { z } from 'zod';
import { AppError } from '../../core/errors';
import {
  getTenancyMove,
  getTenancyMoveProgress,
  getTenancyWorkspace,
  listTenancyMoves,
} from '../../core/tenancy/moves/operations';
import { tenancyListSearchSchema } from '../../core/tenancy/moves/validation';
import {
  getClearanceHandover,
  listClearanceHandovers,
} from '../../core/tenancy/transfers/operations';
import {
  TenancyMoveView,
  TenancyRouteState,
  TenancyWorkspaceView,
  type TenancyAudience,
} from './workspace';

export type TenancyPageSearch = Record<string, string | string[] | undefined>;
export const TENANCY_PAGE_METADATA = {
  title: 'Move-in / Move-out | Homeish',
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
        : error.code === 'NOT_FOUND'
          ? 'not_found'
          : 'error';
  return (
    <TenancyRouteState
      kind={kind}
      returnHref={returnHref}
      retryHref={kind === 'error' ? retryHref : undefined}
      message={kind === 'error' ? error.message : undefined}
      referenceId={error.referenceId}
    />
  );
}

export async function TenancyIndexPage({
  audience,
  baseHref,
  searchParams,
}: {
  audience: TenancyAudience;
  baseHref: string;
  searchParams: Promise<TenancyPageSearch>;
}) {
  let content:
    | { kind: 'invalid_filters' }
    | { kind: 'ready'; props: ComponentProps<typeof TenancyWorkspaceView> };
  try {
    const query = tenancyListSearchSchema.safeParse(await searchParams);
    if (!query.success) {
      await getTenancyWorkspace(false);
      content = { kind: 'invalid_filters' };
    } else {
      const [access, page] = await Promise.all([
        getTenancyWorkspace(false),
        listTenancyMoves(query.data),
      ]);
      const needsTargets =
        access.can_write &&
        (audience === 'management'
          ? access.can_manage
          : audience === 'resident' && access.can_create);
      const workspace = needsTargets ? await getTenancyWorkspace(true) : access;
      content = {
        kind: 'ready',
        props: {
          workspace,
          page,
          status: query.data.status,
          audience,
          baseHref,
        },
      };
    }
  } catch (error) {
    return pageFailure(error, audience === 'guard' ? '/guard' : '/', baseHref);
  }
  return content.kind === 'ready' ? (
    <TenancyWorkspaceView {...content.props} />
  ) : (
    <TenancyRouteState kind={content.kind} returnHref={baseHref} />
  );
}

export async function TenancyDetailPage({
  audience,
  baseHref,
  params,
}: {
  audience: Exclude<TenancyAudience, 'guard'>;
  baseHref: string;
  params: Promise<{ id: string }>;
}) {
  let retryHref = baseHref;
  let content:
    | { kind: 'denied' | 'not_found' }
    | { kind: 'ready'; props: ComponentProps<typeof TenancyMoveView> };
  try {
    const workspace = await getTenancyWorkspace(false);
    if (audience === 'management' && !workspace.can_manage) {
      content = { kind: 'denied' };
    } else {
      const id = z.uuid().safeParse((await params).id);
      if (!id.success) {
        content = { kind: 'not_found' };
      } else {
        retryHref = `${baseHref}/${id.data}`;
        const [detail, progress, handovers] = await Promise.all([
          getTenancyMove(id.data),
          getTenancyMoveProgress(id.data),
          listClearanceHandovers({
            moveId: id.data,
            caseId: null,
            limit: 25,
            offset: 0,
          }),
        ]);
        const handoverDetails = await Promise.all(
          handovers.items.map((handover) => getClearanceHandover(handover.id)),
        );
        content = {
          kind: 'ready',
          props: {
            detail,
            progress,
            workspace,
            audience,
            baseHref,
            handovers: handovers.items,
            handoverDetails,
          },
        };
      }
    }
  } catch (error) {
    return pageFailure(error, baseHref, retryHref);
  }
  return content.kind === 'ready' ? (
    <TenancyMoveView {...content.props} />
  ) : (
    <TenancyRouteState kind={content.kind} returnHref={baseHref} />
  );
}
