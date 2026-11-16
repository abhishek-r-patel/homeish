// Load Utility Metering screens through authorised operations and map failures to shared route states.
import 'server-only';
import { AppError } from '../../core/errors';
import {
  getMeteringAdminWorkspace,
  getMeteringGuardBoard,
  getMeteringResidentWorkspace,
} from '../../core/metering/operations';
import { MeteringAdminView } from './admin';
import { MeteringGuardView } from './guard';
import { MeteringResidentView } from './resident';
import { MeteringRouteState } from './shared';

export type MeteringPageSearch = Record<string, string | string[] | undefined>;
export const METERING_PAGE_METADATA = {
  title: 'Meters | Homeish',
  robots: { index: false, follow: false },
};

function pageFailure(
  error: unknown,
  title: string,
  returnHref: string,
  retryHref: string,
) {
  if (!(error instanceof AppError) || error.code === 'INTERNAL_ERROR')
    throw error;
  const kind =
    error.code === 'MODULE_DISABLED'
      ? 'disabled'
      : error.code === 'FORBIDDEN' || error.code === 'UNAUTHENTICATED'
        ? 'denied'
        : 'error';
  return (
    <MeteringRouteState
      kind={kind}
      title={title}
      returnHref={returnHref}
      retryHref={kind === 'error' ? retryHref : undefined}
      message={kind === 'error' ? error.message : undefined}
      referenceId={error.referenceId}
    />
  );
}

export async function MeteringResidentPage() {
  let workspace;
  try {
    workspace = await getMeteringResidentWorkspace();
  } catch (error) {
    return pageFailure(error, 'Meters', '/', '/metering');
  }
  return <MeteringResidentView workspace={workspace} />;
}

export async function MeteringAdminPage() {
  let workspace;
  try {
    workspace = await getMeteringAdminWorkspace();
  } catch (error) {
    return pageFailure(error, 'Utility meters', '/admin', '/admin/metering');
  }
  return <MeteringAdminView workspace={workspace} />;
}

export async function MeteringGuardPage({
  searchParams,
}: {
  searchParams: Promise<MeteringPageSearch>;
}) {
  let board;
  try {
    const raw = (await searchParams).q;
    const query = typeof raw === 'string' && raw.trim() ? raw : null;
    board = await getMeteringGuardBoard(query);
  } catch (error) {
    return pageFailure(error, 'Meter readings', '/guard', '/guard/metering');
  }
  return <MeteringGuardView board={board} baseHref="/guard/metering" />;
}
