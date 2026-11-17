// Localize document metadata without altering titles, files or generated documents.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedDate } from '@/core/i18n/format';
import { formatDocumentDate } from '@/core/document/presentation';

export function useDocumentPresentation() {
  const language = useUiTranslator();
  return {
    ...language,
    t: language.translate,
    date: (value: string) =>
      language.locale === 'hi'
        ? formatLocalizedDate(new Date(value), language.locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'Asia/Kolkata',
          })
        : formatDocumentDate(value),
  };
}
