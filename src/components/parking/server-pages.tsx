// Load Parking screens through authorised operations and map failures to shared route states.
import 'server-only';
import { AppError } from '../../core/errors';
import {
  getParkingAdminWorkspace,
  getParkingGuardBoard,
  getParkingResidentWorkspace,
  getParkingSummary,
} from '../../core/parking/operations';
import { ParkingAdminView } from './admin';
import { ParkingGuardView } from './guard';
import { ParkingResidentView } from './resident';
import { ParkingRouteState } from './shared';

export type ParkingPageSearch = Record<string, string | string[] | undefined>;
export const PARKING_PAGE_METADATA = {
  title: 'Parking | Homeish',
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
    <ParkingRouteState
      kind={kind}
      title={title}
      returnHref={returnHref}
      retryHref={kind === 'error' ? retryHref : undefined}
      message={kind === 'error' ? error.message : undefined}
      referenceId={error.referenceId}
    />
  );
}

export async function ParkingResidentPage() {
  let workspace;
  try {
    workspace = await getParkingResidentWorkspace();
  } catch (error) {
    return pageFailure(error, 'Parking', '/', '/parking');
  }
  return <ParkingResidentView workspace={workspace} />;
}

export async function ParkingAdminPage() {
  let workspace;
  let summary;
  try {
    [workspace, summary] = await Promise.all([
      getParkingAdminWorkspace(),
      getParkingSummary(),
    ]);
  } catch (error) {
    return pageFailure(error, 'Society parking', '/admin', '/admin/parking');
  }
  return <ParkingAdminView workspace={workspace} summary={summary} />;
}

export async function ParkingGuardPage({
  searchParams,
}: {
  searchParams: Promise<ParkingPageSearch>;
}) {
  let board;
  try {
    const raw = (await searchParams).q;
    const query = typeof raw === 'string' && raw.trim() ? raw : null;
    board = await getParkingGuardBoard(query);
  } catch (error) {
    return pageFailure(error, 'Parking', '/guard', '/guard/parking');
  }
  return <ParkingGuardView board={board} baseHref="/guard/parking" />;
}
