// Localize purchase summaries while leaving vendor data and form values unchanged.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
  formatLocalizedDateTime,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import {
  approvalsText,
  formatPaise,
  quoteRuleBasisText,
  quoteRuleText,
  ratingText,
} from '@/core/vendor/presentation';
import type { VendorWorkspace } from '@/core/vendor/validation';

type QuoteRule = VendorWorkspace['requests'][number]['rule'];

export function useVendorPresentation() {
  const language = useUiTranslator();
  const { locale, translate: t } = language;
  const number = (value: number) =>
    formatLocalizedNumber(value, locale ?? 'en');
  const money = (value: number) =>
    locale === 'hi'
      ? formatLocalizedCurrency(value, locale)
      : formatPaise(value);
  return {
    ...language,
    t,
    number,
    money,
    date: (value: string) =>
      formatLocalizedDate(new Date(value), locale ?? 'en', {
        dateStyle: 'medium',
        timeZone: 'Asia/Kolkata',
      }),
    time: (value: string) =>
      formatLocalizedDateTime(new Date(value), locale ?? 'en', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      }),
    quoteRule: (rule: QuoteRule) => {
      if (locale !== 'hi') return quoteRuleText(rule);
      const count = t('{count} of {required} quotes', {
        count: number(rule.quote_count),
        required: number(rule.quotes_required),
      });
      return rule.overridden
        ? t('{count} (rule overridden by an admin)', { count })
        : rule.met
          ? t('{count} (rule met)', { count })
          : count;
    },
    quoteBasis: (rule: QuoteRule) =>
      locale !== 'hi'
        ? quoteRuleBasisText(rule)
        : rule.basis_amount_paise < rule.threshold_paise
          ? t('Below {threshold}, one quote is enough.', {
              threshold: money(rule.threshold_paise),
            })
          : t('At or above {threshold}, {count} quotes are needed.', {
              threshold: money(rule.threshold_paise),
              count: number(rule.quotes_required),
            }),
    approvals: (count: number, required: number) =>
      locale !== 'hi'
        ? approvalsText(count, required)
        : required === 0
          ? t('An admin approves alone')
          : t('{count} of {required} approvals', {
              count: number(count),
              required: number(required),
            }),
    rating: (average: number | null, count: number) =>
      locale !== 'hi'
        ? ratingText(average, count)
        : average === null || count === 0
          ? t('No ratings yet')
          : t('{average} of 5 from {count} ratings', {
              average: formatLocalizedNumber(average, locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }),
              count: number(count),
            }),
  };
}
