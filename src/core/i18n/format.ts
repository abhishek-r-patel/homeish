// Format visible numbers and dates without changing stored values or time zones.
import type { Locale } from './locale';
import { INDIA_TIME_ZONE } from '../../lib/india-time';

function localeTag(locale: Locale): 'en-IN' | 'hi-IN' {
  return locale === 'hi' ? 'hi-IN' : 'en-IN';
}

export function formatLocalizedNumber(
  value: number | bigint,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(localeTag(locale), {
    ...options,
    numberingSystem: 'latn',
  }).format(value);
}

export function formatLocalizedCurrency(
  amountPaise: number | bigint | string,
  locale: Locale,
): string {
  if (
    (typeof amountPaise === 'number' && !Number.isSafeInteger(amountPaise)) ||
    (typeof amountPaise === 'string' && !/^-?\d+$/.test(amountPaise))
  ) {
    throw new RangeError('Money must be an integer amount in paise.');
  }
  const paise = BigInt(amountPaise);
  const negative = paise < BigInt(0);
  const absolute = negative ? -paise : paise;
  const rupees = absolute / BigInt(100);
  const fraction = String(absolute % BigInt(100)).padStart(2, '0');
  const value = negative ? (rupees === BigInt(0) ? -0 : -rupees) : rupees;
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'currency',
    currency: 'INR',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  })
    .formatToParts(value)
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('');
}

export function formatLocalizedDate(
  value: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    ...options,
    timeZone: options.timeZone ?? INDIA_TIME_ZONE,
    numberingSystem: 'latn',
  }).format(value);
}

export function formatLocalizedTime(
  value: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: 'numeric',
    minute: '2-digit',
    ...options,
    timeZone: options.timeZone ?? INDIA_TIME_ZONE,
    hourCycle: 'h12',
    numberingSystem: 'latn',
  }).format(value);
}

export function formatLocalizedDateTime(
  value: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  },
): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    ...options,
    timeZone: options.timeZone ?? INDIA_TIME_ZONE,
    hourCycle: 'h12',
    numberingSystem: 'latn',
  }).format(value);
}
