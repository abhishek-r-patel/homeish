// Present private moving records and derive scoped form choices without precision loss.
import { rupeesFromPaise } from '../../../lib/money';
import type {
  TenancyMoveDetail,
  TenancyMoveInput,
  TenancyStatus,
  TenancyWorkspace,
} from './validation';

export const TENANCY_KIND_LABELS = {
  move_in: 'Move-in',
  move_out: 'Move-out',
} as const;

export const TENANCY_DOCUMENT_LABELS = {
  rental_agreement: 'Rental agreement',
  police_verification: 'Police-verification proof',
  noc: 'Move-out NOC',
} as const;

export const TENANCY_EVENT_LABELS = {
  created: 'Request created',
  document_attached: 'Private proof attached',
  consented: 'Owner consent recorded',
  approved: 'Schedule approved',
  rejected: 'Request rejected',
  cancelled: 'Request cancelled',
  completed: 'Actual move completed',
  noc_issued: 'Move-out NOC issued',
} as const;

export function isTenancyOpen(status: TenancyStatus) {
  return (
    status === 'awaiting_consent' ||
    status === 'pending_review' ||
    status === 'approved'
  );
}

export function tenancyProofsReady(detail: TenancyMoveDetail) {
  return (
    detail.move.kind === 'move_out' ||
    (detail.documents.some(
      (document) => document.kind === 'rental_agreement',
    ) &&
      (!detail.police_verification_required ||
        detail.documents.some(
          (document) => document.kind === 'police_verification',
        )))
  );
}

export function tenancyTenantChoices(
  workspace: TenancyWorkspace,
  unitId: string | null,
  kind: TenancyMoveInput['kind'],
) {
  if (!unitId) return [];
  return workspace.tenants.filter((tenant) => {
    const occupancy = workspace.occupancies.find(
      (item) => item.unit_id === unitId && item.membership_id === tenant.id,
    );
    if (kind === 'move_out')
      return occupancy?.is_tenant && occupancy.status === 'active';
    return occupancy
      ? occupancy.is_tenant && occupancy.status === 'pending'
      : workspace.can_manage;
  });
}

export function formatTenancyDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function formatTenancyTimestamp(
  value: string,
  timeZone: string,
  seconds = false,
) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' as const } : {}),
    timeZoneName: 'short',
    timeZone,
  }).format(new Date(value));
}

export function formatTenancyBalance(value: string) {
  const amount = BigInt(value);
  return `${amount < BigInt(0) ? '-' : ''}Rs. ${rupeesFromPaise(String(amount < BigInt(0) ? -amount : amount))}`;
}
