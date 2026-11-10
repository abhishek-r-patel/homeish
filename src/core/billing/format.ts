// Format billing dates and money identically on the server, client and PDFs.
import { rupeesFromPaise } from './validation';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatBillingDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

export function formatBillingPeriod(value: string): string {
  const [year, month] = value.split('-');
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

export function formatRupees(paise: number | string): string {
  return `Rs. ${rupeesFromPaise(paise)}`;
}

export function formatBillingTimestamp(
  value: string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value));
}

export function billDisplayStatus(
  bill: { status: string; due_date: string },
  today: string,
) {
  if (
    (bill.status === 'due' || bill.status === 'partially_paid') &&
    bill.due_date < today
  ) {
    return 'bill.overdue' as const;
  }
  return `bill.${bill.status}` as
    | 'bill.due'
    | 'bill.partially_paid'
    | 'bill.paid'
    | 'bill.waived'
    | 'bill.cancelled';
}

export function todayInTimeZone(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(now);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}
