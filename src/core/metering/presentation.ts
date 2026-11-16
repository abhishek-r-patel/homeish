// Shared Utility Metering labels, exact decimal arithmetic, charge estimates and usage flags.
import {
  formatBillingDate,
  formatBillingPeriod,
  formatRupees,
} from '../billing/format';
import type { MeteringReport, MeteringScope, MeteringType } from './validation';

export const METERING_TIME_ZONE = 'Asia/Kolkata';

export const METERING_TYPE_LABELS: Record<MeteringType, string> = {
  water: 'Water',
  electricity: 'Electricity',
  dg: 'DG (generator) power',
  gas: 'Piped gas',
};

/** Unit of consumption per meter type: water in kilolitres, power in kWh, gas in standard cubic metres. */
export const METERING_UNIT_LABELS: Record<MeteringType, string> = {
  water: 'kL',
  electricity: 'kWh',
  dg: 'kWh',
  gas: 'SCM',
};

export const METERING_SCOPE_LABELS: Record<MeteringScope, string> = {
  unit: 'Unit meter',
  common: 'Common area',
};

export const METERING_STATUS_LABELS = {
  pending: 'Waiting for review',
  approved: 'Approved',
  rejected: 'Rejected',
} as const;

export const METERING_SOURCE_LABELS = {
  admin: 'Admin',
  guard: 'Guard',
  resident: 'Resident',
} as const;

export const METERING_CHARGE_LABELS = {
  pending: 'To be billed',
  billed: 'Billed',
  no_charge: 'No charge',
} as const;

const SCALE = BigInt(1000);
const HALF = BigInt(500);
const ZERO = BigInt(0);

/** Exact thousandths of a unit from decimal text such as "12.345". */
export function meterThousandths(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) throw new RangeError(`Not a meter value: ${value}`);
  return (
    BigInt(match[1] ?? '0') * SCALE + BigInt((match[2] ?? '').padEnd(3, '0'))
  );
}

/** Canonical decimal text for thousandths, without trailing zeros. */
export function formatThousandths(value: bigint): string {
  const negative = value < ZERO;
  const absolute = negative ? -value : value;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE)
    .toString()
    .padStart(3, '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function formatMeterValue(value: string) {
  return formatThousandths(meterThousandths(value));
}

export function formatConsumption(value: string, meterType: MeteringType) {
  return `${formatMeterValue(value)} ${METERING_UNIT_LABELS[meterType]}`;
}

/**
 * Mirrors the database rule: consumption is the reading minus the previous approved reading (or the
 * meter's initial reading). A lower reading is a reset (meter replaced or rolled over): its consumption
 * is 0 and it becomes the new baseline.
 */
export function meteringConsumption(previous: string, current: string) {
  const delta = meterThousandths(current) - meterThousandths(previous);
  return delta < ZERO
    ? { consumption: '0', isReset: true }
    : { consumption: formatThousandths(delta), isReset: false };
}

/** Mirrors private.metering_billing_post: consumption x rate, rounded half up to whole paise. */
export function meteringChargePaise(consumption: string, ratePaise: number) {
  if (!Number.isInteger(ratePaise) || ratePaise < 0)
    throw new RangeError('The rate must be whole paise.');
  return Number(
    (meterThousandths(consumption) * BigInt(ratePaise) + HALF) / SCALE,
  );
}

export function formatRatePaise(ratePaise: number, meterType: MeteringType) {
  return `${formatRupees(ratePaise)} per ${METERING_UNIT_LABELS[meterType]}`;
}

export function formatMeteringPaise(paise: number) {
  return formatRupees(paise);
}

export function formatMeteringDate(value: string) {
  return formatBillingDate(value);
}

export function formatMeteringMonth(value: string) {
  return formatBillingPeriod(value);
}

export function formatMeteringTime(
  value: string,
  timeZone = METERING_TIME_ZONE,
) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value));
}

export type MeteringUsageFlag = 'high' | 'zero';

export const METERING_USAGE_FLAG_LABELS: Record<MeteringUsageFlag, string> = {
  high: 'Unusually high',
  zero: 'No usage',
};

/** A month is flagged high when its consumption is more than this multiple of the previous 3-month average. */
export const METERING_HIGH_USAGE_MULTIPLE = 2;
export const METERING_USAGE_LOOKBACK = 3;

type ReportMeter = MeteringReport['meters'][number];
type ReportPeriod = ReportMeter['periods'][number];

/**
 * Unusual-usage rule for one month of a meter:
 * - high: consumption is more than 2x the average of the previous 3 months, when each of those months
 *   has at least one approved reading and their average is above 0;
 * - zero: a unit meter whose unit has an active occupant used nothing in a month that has at least one
 *   approved reading that is not a reset (a reset alone says nothing about usage).
 * Months without readings are never flagged.
 */
export function meteringUsageFlag(
  meter: Pick<ReportMeter, 'scope' | 'unit_occupied'>,
  periods: ReportPeriod[],
  index: number,
): MeteringUsageFlag | null {
  const period = periods[index];
  if (!period || period.readings === 0) return null;
  const consumption = meterThousandths(period.consumption);
  if (consumption === ZERO) {
    return meter.scope === 'unit' &&
      meter.unit_occupied &&
      period.readings > period.resets
      ? 'zero'
      : null;
  }
  if (index < METERING_USAGE_LOOKBACK) return null;
  const previous = periods.slice(index - METERING_USAGE_LOOKBACK, index);
  if (previous.some((item) => item.readings === 0)) return null;
  const total = previous.reduce(
    (sum, item) => sum + meterThousandths(item.consumption),
    ZERO,
  );
  if (total === ZERO) return null;
  // consumption > multiple x (total / lookback), compared exactly in integers.
  return consumption * BigInt(METERING_USAGE_LOOKBACK) >
    BigInt(METERING_HIGH_USAGE_MULTIPLE) * total
    ? 'high'
    : null;
}

/** Rupee text such as "8.50" to whole paise, or null when it is not a valid non-negative amount. */
export function meteringRatePaiseFromRupees(value: string) {
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}
