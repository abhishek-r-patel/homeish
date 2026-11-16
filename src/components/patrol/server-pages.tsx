// Load Patrol screens through authorised operations and map failures to shared route states.
import 'server-only';
import QRCode from 'qrcode';
import { AppError } from '../../core/errors';
import {
  getPatrolAdminWorkspace,
  getPatrolGuardWorkspace,
  getPatrolPrintSheet,
} from '../../core/patrol/operations';
import { patrolQrPayload } from '../../core/patrol/validation';
import { PatrolAdminView } from './admin';
import { PatrolGuardView } from './guard';
import { PatrolPrintSheetView } from './print-sheet';
import { PatrolRouteState } from './shared';

export const PATROL_PAGE_METADATA = {
  title: 'Patrol | Homeish',
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
    <PatrolRouteState
      kind={kind}
      title={title}
      returnHref={returnHref}
      retryHref={kind === 'error' ? retryHref : undefined}
      message={kind === 'error' ? error.message : undefined}
      referenceId={error.referenceId}
    />
  );
}

export async function PatrolAdminPage() {
  let workspace;
  try {
    workspace = await getPatrolAdminWorkspace();
  } catch (error) {
    return pageFailure(error, 'Guard patrol', '/admin', '/admin/patrol');
  }
  return <PatrolAdminView workspace={workspace} />;
}

export async function PatrolGuardPage() {
  let workspace;
  try {
    workspace = await getPatrolGuardWorkspace();
  } catch (error) {
    return pageFailure(error, 'Patrol', '/guard', '/guard/patrol');
  }
  return <PatrolGuardView workspace={workspace} />;
}

export async function PatrolPrintPage() {
  let sheet;
  try {
    sheet = await getPatrolPrintSheet();
  } catch (error) {
    return pageFailure(
      error,
      'Patrol QR sheet',
      '/admin/patrol',
      '/admin/patrol/print',
    );
  }
  const qrCodes = new Map(
    await Promise.all(
      sheet.checkpoints.map(
        async (checkpoint) =>
          [
            checkpoint.id,
            await QRCode.toDataURL(patrolQrPayload(checkpoint.code), {
              errorCorrectionLevel: 'M',
              margin: 1,
              width: 320,
            }),
          ] as const,
      ),
    ),
  );
  return <PatrolPrintSheetView sheet={sheet} qrCodes={qrCodes} />;
}
