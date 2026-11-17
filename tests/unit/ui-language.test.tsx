// Verify Hindi support and optional English fallback for generic UI controls.
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  LanguageContext,
  type LanguageContextValue,
} from '../../src/components/language-context';
import { Combobox } from '../../src/components/ui/combobox';
import { ConfirmDialog } from '../../src/components/ui/dialog';
import { DatePicker } from '../../src/components/ui/date-time-inputs';
import { SwitchInput } from '../../src/components/ui/choice-controls';
import { TextInput } from '../../src/components/ui/text-input';
import { translateMessage } from '../../src/core/i18n/messages';

const hindiLanguage: LanguageContextValue = {
  changeLocale: async () => ({ status: 'saved' }),
  hindiAvailable: true,
  locale: 'hi',
  pending: false,
  translate: (source, values) => translateMessage('hi', source, values),
};

function render(element: ReactNode, language?: LanguageContextValue) {
  const content = language ? (
    <LanguageContext.Provider value={language}>
      {element}
    </LanguageContext.Provider>
  ) : (
    element
  );
  return renderToStaticMarkup(content);
}

describe('generic UI language support', () => {
  it('translates fixed combobox copy but preserves its supplied label', () => {
    const markup = render(
      <Combobox
        id="unit"
        label="Unit A-104"
        onChange={() => {}}
        options={[]}
        required
        value={null}
      />,
      hindiLanguage,
    );

    expect(markup).toContain('Unit A-104 (ज़रूरी)');
    expect(markup).toContain('placeholder="विकल्प खोजें"');
  });

  it('translates dialog controls and uses the existing common Cancel message', () => {
    const markup = render(
      <ConfirmDialog
        actionLabel="Remove unit A-104"
        description="This unit will remain in the history."
        id="confirm-remove"
        onConfirm={() => {}}
        onOpenChange={() => {}}
        open
        title="Remove unit A-104?"
      />,
      hindiLanguage,
    );

    expect(markup).toContain('aria-label="डायलॉग बंद करें"');
    expect(markup).toContain('रद्द करें');
    expect(markup).toContain('Remove unit A-104?');
  });

  it('localizes calendar dates and the selected-date label', () => {
    const markup = render(
      <DatePicker
        id="move-in-date"
        label="Move-in date"
        onChange={() => {}}
        value="2026-03-05"
      />,
      hindiLanguage,
    );

    expect(markup).toContain('मार्च');
    expect(markup).toContain('चुनी गई तारीख');
    expect(markup).toContain('Move-in date');
  });

  it('keeps existing English copy when no language provider is present', () => {
    const markup = render(
      <>
        <TextInput id="name" label="Full name" required />
        <SwitchInput checked id="enabled" label="Enabled" onChange={() => {}} />
      </>,
    );

    expect(markup).toContain('Full name (required)');
    expect(markup).toContain('>On</span>');
  });
});
