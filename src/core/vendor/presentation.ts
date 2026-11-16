// Format Vendors & Purchases values for screens without touching the database.
import type { VendorRequestDetail, VendorWorkspace } from './validation';

type RequestStatus = VendorWorkspace['requests'][number]['status'];
type QuoteRule = VendorWorkspace['requests'][number]['rule'];
type ExpenseDraftStatus = NonNullable<
  VendorRequestDetail['request']['expense_draft_status']
>;

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Formats a whole number of paise as Indian rupees, for example ₹25,000. */
export function formatPaise(paise: number): string {
  return rupees.format(paise / 100);
}

/** Converts a rupee amount typed in a form, such as "25,000.50", to paise. */
export function rupeesToPaise(value: string): number | null {
  const cleaned = value.replace(/[₹,\s]/g, '');
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = '0', fraction = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** Shows paise as a plain rupee value for a form field, for example "25000.5". */
export function paiseToRupeesInput(paise: number): string {
  const whole = Math.floor(paise / 100);
  const fraction = paise % 100;
  return fraction === 0
    ? String(whole)
    : `${whole}.${String(fraction).padStart(2, '0')}`;
}

export const VENDOR_REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const VENDOR_EXPENSE_DRAFT_LABELS: Record<ExpenseDraftStatus, string> = {
  created: 'Expense draft created and waiting for committee approval.',
  skipped_disabled: 'No expense draft: the Expenses module is off.',
  skipped_no_account:
    'No expense draft yet: add an active bank or cash account in Expenses, then retry.',
  skipped_no_category:
    'No expense draft yet: add an expense category in Expenses, then retry.',
  skipped_month_closed:
    'No expense draft yet: this month is closed in Expenses. Reopen it, then retry.',
};

/** Describes the quote rule, for example "2 of 3 quotes". */
export function quoteRuleText(rule: QuoteRule): string {
  const counted = `${rule.quote_count} of ${rule.quotes_required} ${
    rule.quotes_required === 1 ? 'quote' : 'quotes'
  }`;
  if (rule.overridden) return `${counted} (rule overridden by an admin)`;
  return rule.met ? `${counted} (rule met)` : counted;
}

/** Explains why a quote count applies, for example below or above ₹25,000. */
export function quoteRuleBasisText(rule: QuoteRule): string {
  const threshold = formatPaise(rule.threshold_paise);
  return rule.basis_amount_paise < rule.threshold_paise
    ? `Below ${threshold}, one quote is enough.`
    : `At or above ${threshold}, ${rule.quotes_required} quotes are needed.`;
}

export function approvalsText(approvals: number, required: number): string {
  if (required === 0) return 'An admin approves alone';
  return `${approvals} of ${required} ${required === 1 ? 'approval' : 'approvals'}`;
}

export function ratingText(average: number | null, count: number): string {
  if (average === null || count === 0) return 'No ratings yet';
  return `${average.toFixed(1)} of 5 from ${count} ${count === 1 ? 'rating' : 'ratings'}`;
}

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export function vendorFileExtension(contentType: string): string {
  const extension = EXTENSIONS[contentType];
  if (!extension) throw new Error('Unsupported vendor file type.');
  return extension;
}

/** The private storage path the database accepts for a vendor file. */
export function vendorUploadPath(
  societyId: string,
  userId: string,
  contentType: string,
  fileId: string,
): string {
  return `${societyId}/vendors/${userId}/${fileId}.${vendorFileExtension(contentType)}`;
}
