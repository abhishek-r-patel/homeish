// Load vendor screens through authorised operations and map failures to safe route states.
import 'server-only';
import { AppError } from '../../core/errors';
import {
  getPurchaseRequestDetail,
  getVendorBills,
  getVendorContracts,
  getVendorDetail,
  getVendorStaffDayChecks,
  getVendorSummary,
  getVendorWorkOrders,
  getVendorWorkspace,
  type VendorRegisterScope,
} from '../../core/vendor/operations';
import type { RegisterLoad, VendorRegisterLoads } from './registers';
import { PurchaseRequestView } from './request-detail';
import { VENDOR_BASE_HREF, VendorRouteState } from './shared';
import { VendorDetailView } from './vendor-detail';
import { VendorWorkspaceView } from './workspace';

export const VENDOR_PAGE_METADATA = {
  title: 'Vendors & Purchases | Homeish',
  robots: { index: false, follow: false },
};

function pageFailure(error: unknown, retryHref: string, returnHref: string) {
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
    <VendorRouteState
      kind={kind}
      returnHref={kind === 'not_found' ? VENDOR_BASE_HREF : returnHref}
      retryHref={kind === 'error' ? retryHref : undefined}
      message={kind === 'error' ? error.message : undefined}
      referenceId={error.referenceId}
    />
  );
}

async function loadRegister<T>(
  read: () => Promise<T>,
): Promise<RegisterLoad<T>> {
  try {
    return { ok: true, data: await read() };
  } catch (error) {
    if (!(error instanceof AppError) || error.code === 'INTERNAL_ERROR')
      throw error;
    return {
      ok: false,
      message: error.message,
      referenceId: error.referenceId,
    };
  }
}

/** Reads every register in parallel; one failing view does not hide the others. */
async function loadRegisters(
  scope: VendorRegisterScope,
): Promise<VendorRegisterLoads> {
  const [summary, contracts, checks, workOrders, bills] = await Promise.all([
    loadRegister(() => getVendorSummary(scope)),
    loadRegister(() => getVendorContracts(scope)),
    loadRegister(() => getVendorStaffDayChecks(scope)),
    loadRegister(() => getVendorWorkOrders(scope)),
    loadRegister(() => getVendorBills(scope)),
  ]);
  return { summary, contracts, checks, workOrders, bills };
}

export async function VendorIndexPage() {
  let workspace;
  try {
    workspace = await getVendorWorkspace();
  } catch (error) {
    return pageFailure(error, VENDOR_BASE_HREF, '/');
  }
  const registers = await loadRegisters({});
  return <VendorWorkspaceView workspace={workspace} registers={registers} />;
}

export async function VendorPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  let detail;
  try {
    detail = await getVendorDetail(vendorId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'VALIDATION_FAILED') {
      return (
        <VendorRouteState kind="not_found" returnHref={VENDOR_BASE_HREF} />
      );
    }
    return pageFailure(error, `${VENDOR_BASE_HREF}/${vendorId}`, '/');
  }
  const registers = await loadRegisters({ vendorId: detail.vendor.id });
  return <VendorDetailView detail={detail} registers={registers} />;
}

export async function PurchaseRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  let detail;
  try {
    detail = await getPurchaseRequestDetail(requestId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'VALIDATION_FAILED') {
      return (
        <VendorRouteState kind="not_found" returnHref={VENDOR_BASE_HREF} />
      );
    }
    return pageFailure(error, `${VENDOR_BASE_HREF}/requests/${requestId}`, '/');
  }
  return <PurchaseRequestView detail={detail} />;
}
