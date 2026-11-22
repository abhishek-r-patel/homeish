// Present transfer tracker labels and clear, status-derived certificate wording.
import type { CertificatePreparation } from './validation';
import { formatTenancyBalance } from '../moves/presentation';

export const TRANSFER_STAGE_LABELS = {
  received: 'Received',
  documents_checked: 'Documents checked',
  committee_decision: 'Committee decision',
  dues_settled: 'Dues cleared / handover agreed',
  completed: 'Completed',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
} as const;

export const TRANSFER_DECISION_LABELS = {
  approved: 'Approved',
  approved_with_conditions: 'Approved with conditions',
  rejected: 'Rejected',
  deferred: 'Deferred',
} as const;

export const CERTIFICATE_KIND_LABELS = {
  clearance: 'Clearance NOC',
  conditional: 'Conditional NOC',
  not_checked: 'Not-checked NOC',
} as const;

export function certificateText(
  preparation: Extract<CertificatePreparation, { status: 'prepared' }>,
  approval?: {
    approval_reference: string | null;
    approved_at: string | null;
    responsible_name: string | null;
    approving_admin: string | null;
  },
) {
  const parties = preparation.parties
    .map((party) => `${party.name} (${party.role})`)
    .join(', ');
  const dues =
    preparation.kind === 'clearance'
      ? `No dues were outstanding as of ${preparation.dues.checked_at}.`
      : preparation.kind === 'not_checked'
        ? 'Dues were not checked because Billing is disabled.'
        : `Outstanding unit dues at check time total ${formatTenancyBalance(preparation.dues.total_paise ?? '0')}. ${preparation.dues.bills
            .map(
              (bill) =>
                `${bill.number} ${formatTenancyBalance(bill.outstanding_paise)}`,
            )
            .join(
              '; ',
            )}. Responsibility: ${approval?.responsible_name ?? 'recorded party'}. Approved by ${approval?.approving_admin ?? 'the recorded administrator'} under reference ${approval?.approval_reference ?? 'recorded approval'} on ${approval?.approved_at ?? 'the recorded approval time'}.`;
  return [
    CERTIFICATE_KIND_LABELS[preparation.kind],
    `Unit: ${preparation.unit.number}. Parties: ${parties}.`,
    `Purpose: ${preparation.purpose}.`,
    dues,
    `Issued by ${preparation.signatory_name}, ${preparation.signatory_designation}.`,
    'This society record is not legal advice and is not proof of transfer of legal title.',
  ].join(' ');
}
