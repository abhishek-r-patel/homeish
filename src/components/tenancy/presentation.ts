// Localize moving dates and exact balances without changing document generation.
'use client';

import { useUiTranslator } from '../ui/language';
import {
  formatLocalizedDate,
  formatLocalizedDateTime,
  formatLocalizedNumber,
} from '../../core/i18n/format';
import {
  formatTenancyBalance,
  formatTenancyDate,
  formatTenancyTimestamp,
} from '../../core/tenancy/moves/presentation';

export function useTenancyPresentation() {
  const language = useUiTranslator();
  const { locale } = language;
  return {
    ...language,
    t: language.translate,
    date: (value: string) =>
      locale === 'hi'
        ? formatLocalizedDate(new Date(`${value}T00:00:00Z`), locale, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
          })
        : formatTenancyDate(value),
    time: (value: string, timeZone: string) =>
      locale === 'hi'
        ? formatLocalizedDateTime(new Date(value), locale, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
            timeZone,
          })
        : formatTenancyTimestamp(value, timeZone),
    balance: (value: string) => {
      if (locale !== 'hi') return formatTenancyBalance(value);
      // Balances can exceed Number's exact range; keep their integer paise intact.
      const signed = BigInt(value);
      const amount = signed < BigInt(0) ? -signed : signed;
      const whole = formatLocalizedNumber(amount / BigInt(100), locale, {
        maximumFractionDigits: 0,
      });
      return `${signed < BigInt(0) ? '-' : ''}₹${whole}.${String(amount % BigInt(100)).padStart(2, '0')}`;
    },
  };
}
