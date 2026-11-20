// Localize job summaries while preserving exported rows and user-supplied values.
'use client';

import type { ReactNode } from 'react';
import type { Json } from '../../core/db/database.types';
import { formatLocalizedNumber } from '../../core/i18n/format';
import { billingDate, billingMoney } from '../billing/presentation';
import { useUiTranslator } from '../ui/language';

const FIELD_LABELS: Readonly<Record<string, string>> = {
  totalRows: 'Total rows',
  importedRows: 'Imported rows',
  failedRows: 'Failed rows',
  errors: 'Row errors',
  rowNumber: 'Row number',
  message: 'Message',
  period_start: 'Billing period',
  generated_bill_count: 'Bills generated',
  generated_line_count: 'Charges generated',
  already_generated_count: 'Charges already generated',
  total_paise: 'Total',
  utility: 'Utility charge details',
  module: 'Module',
  report: 'Report',
  from: 'From date',
  to: 'To date',
  row_count: 'Rows exported',
  columns: 'Export columns (English)',
  rows: 'Export rows (English)',
};

const REPORT_LABELS: Readonly<Record<string, string>> = {
  dues_by_unit: 'Dues by unit',
  collections: 'Collections',
  defaulters: 'Defaulters',
  collections_by_mode: 'Collections by payment mode',
  block_totals: 'Wing totals',
  bill_status: 'Bill status summary',
  unapplied_credit: 'Unapplied advance credit',
};

export function JobResult({ summary }: { summary: Json }) {
  const { locale, translate: t, translateFeedback } = useUiTranslator();
  function content(value: Json | undefined, field = ''): ReactNode {
    if (value === null || value === undefined) return '—';
    if (field === 'rows' || field === 'columns') {
      return (
        <div className="grid gap-space-2">
          <p className="text-caption text-ink-muted">
            {t('CSV exports remain in English.')}
          </p>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-sunken p-space-3 font-mono text-caption">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      );
    }
    if (typeof value === 'string') {
      if (field === 'message') return translateFeedback(value);
      if (field === 'total_paise') return billingMoney(value, locale);
      if (['period_start', 'from', 'to'].includes(field)) {
        return billingDate(value, locale);
      }
      if (field === 'report' && REPORT_LABELS[value]) {
        return t(REPORT_LABELS[value]);
      }
      if (field === 'module' && value === 'billing') return t('Billing');
      return value;
    }
    if (typeof value === 'number') {
      return field === 'total_paise'
        ? billingMoney(value, locale)
        : formatLocalizedNumber(value, locale ?? 'en');
    }
    if (typeof value === 'boolean') return t(value ? 'Yes' : 'No');
    if (Array.isArray(value)) {
      return value.length ? (
        <ol className="grid list-inside list-decimal gap-space-3">
          {value.map((item, index) => (
            <li key={index}>{content(item)}</li>
          ))}
        </ol>
      ) : (
        '—'
      );
    }
    return (
      <dl className="grid min-w-0 gap-space-3">
        {Object.entries(value).map(([key, item]) => (
          <div className="min-w-0" key={key}>
            <dt className="text-caption text-ink-muted">
              {FIELD_LABELS[key] ? t(FIELD_LABELS[key]) : <code>{key}</code>}
            </dt>
            <dd className="mt-space-1 min-w-0 break-words text-body">
              {content(item, key)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return content(summary);
}
