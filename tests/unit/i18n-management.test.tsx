// Verify management language boundaries, exact display values and preserved resident content.
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  LanguageContext,
  type LanguageContextValue,
} from '../../src/components/language-context';
import { ResidentDirectory } from '../../src/components/directory/resident-directory';
import { JobResult } from '../../src/components/structure/job-result';
import {
  billingDate,
  billingMoney,
  billingPeriod,
  billingTimestamp,
} from '../../src/components/billing/presentation';
import { useTenancyPresentation } from '../../src/components/tenancy/presentation';
import {
  paymentDetailsInputSchema,
  rupeesSchema,
} from '../../src/core/billing/validation';
import {
  translateFeedbackMessage,
  translateMessage,
} from '../../src/core/i18n/messages';

vi.mock('../../src/app/directory/actions', () => ({
  getDirectoryResidentsPageAction: vi.fn(),
}));

const hindi: LanguageContextValue = {
  locale: 'hi',
  hindiAvailable: true,
  pending: false,
  changeLocale: async () => ({ status: 'saved' }),
  translate: (source, values) => translateMessage('hi', source, values),
};

function render(content: ReactNode, language?: LanguageContextValue) {
  return renderToStaticMarkup(
    language ? (
      <LanguageContext.Provider value={language}>
        {content}
      </LanguageContext.Provider>
    ) : (
      content
    ),
  );
}

const directory = {
  items: [
    {
      membership_id: 'a0d55fc3-0751-4b79-86c1-5b3e25942392',
      unit_id: 'a0d55fc3-0751-4b79-86c1-5b3e25942393',
      full_name: 'Resident Alpha',
      unit_number: 'A-101',
      phone: '+12025550123',
    },
  ],
  total: 1,
  limit: 10,
  offset: 0,
};

describe('management Hindi interfaces', () => {
  it('localizes directory controls and accessible labels without changing contact data', () => {
    const markup = render(<ResidentDirectory residents={directory} />, hindi);
    expect(markup).toContain('निवासी डायरेक्टरी');
    expect(markup).toContain('नाम या यूनिट से खोजें');
    expect(markup).toContain('Resident Alpha को +12025550123 पर कॉल करें');
    expect(markup).toContain('href="tel:+12025550123"');
    expect(markup).toContain('A-101');
    expect(markup).not.toContain('Search by name or unit');
  });

  it('preserves English fixtures and distinguishes a Hindi empty directory', () => {
    const english = render(<ResidentDirectory residents={directory} />);
    expect(english).toContain('Search by name or unit');
    expect(english).toContain('1 directory entry available');
    expect(english).not.toContain('1 directory entries available');
    const empty = render(
      <ResidentDirectory residents={{ ...directory, items: [], total: 0 }} />,
      hindi,
    );
    expect(empty).toContain('दिखाने के लिए कोई निवासी नहीं है');
    expect(empty).not.toContain('Resident Alpha');
    expect(empty).not.toContain('href="tel:');
  });

  it('uses Hindi months, Indian money grouping and a 12-hour clock without changing English bills', () => {
    expect(billingMoney(12345678, 'hi')).toBe('₹1,23,456.78');
    expect(billingMoney(12345678, null)).toBe('Rs. 123456.78');
    expect(billingDate('2026-03-05', 'hi')).toContain('मार्च');
    expect(billingPeriod('2026-03-01', 'hi')).toContain('मार्च');
    expect(billingDate('2026-03-05', null)).toBe('05 Mar 2026');
    expect(billingTimestamp('2026-03-05T13:05:00Z', 'UTC', 'hi')).toMatch(
      /1:05/,
    );
    expect(billingTimestamp('2026-03-05T13:05:00Z', 'UTC', 'hi')).not.toMatch(
      /13:05|[०-९]/,
    );
  });

  it('keeps large tenant balances exact instead of rounding through a JavaScript number', () => {
    function Balance() {
      const { balance } = useTenancyPresentation();
      return <output>{balance('-900719925474099312345')}</output>;
    }
    expect(render(<Balance />, hindi)).toContain(
      '-₹90,07,19,92,54,74,09,93,123.45',
    );
    expect(render(<Balance />)).toContain('-Rs. 9007199254740993123.45');
  });

  it('keeps a large billing balance exact in Hindi', () => {
    expect(billingMoney('9007199255804991', 'hi')).toBe(
      '₹9,00,71,99,25,58,049.91',
    );
  });

  it('translates job counts and row failures while preserving entered content and English export records', () => {
    const markup = render(
      <JobResult
        summary={{
          importedRows: 1000,
          failedRows: 1,
          errors: [
            {
              rowNumber: 1002,
              message: 'Unit number already exists in this block.',
            },
          ],
          note: 'Resident Alpha / A-101',
          rows: [{ unit: 'A-101', description: 'Original exported content' }],
        }}
      />,
      hindi,
    );
    expect(markup).toContain('आयात की गई पंक्तियाँ');
    expect(markup).toContain('1,000');
    expect(markup).toContain('इस ब्लॉक में यूनिट नंबर पहले से है।');
    expect(markup).toContain('Resident Alpha / A-101');
    expect(markup).toContain(
      translateMessage('hi', 'CSV exports remain in English.'),
    );
    expect(markup).toContain('Original exported content');
    expect(markup).toContain('&quot;unit&quot;');
  });

  it('localizes actual billing validation feedback without changing accepted UPI and money values', () => {
    const amount = rupeesSchema.safeParse('12.345');
    expect(amount.success).toBe(false);
    if (!amount.success) {
      expect(
        translateFeedbackMessage('hi', amount.error.issues[0]!.message),
      ).toMatch(/रुपये.*दशमलव/);
    }
    const payment = paymentDetailsInputSchema.safeParse({
      upiId: 'invalid-upi',
      payeeName: 'Synthetic Society',
      qrPath: null,
      expectedUpdatedAt: null,
    });
    expect(payment.success).toBe(false);
    if (!payment.success) {
      const feedback = translateFeedbackMessage(
        'hi',
        payment.error.issues[0]!.message,
      );
      expect(feedback).toContain('name@handle');
      expect(feedback).toMatch(/[अ-ह]/);
    }
    expect(rupeesSchema.parse('123456.78')).toBe(12345678);
    expect(
      paymentDetailsInputSchema.parse({
        upiId: 'synthetic@bank',
        payeeName: 'Synthetic Society',
        qrPath: null,
        expectedUpdatedAt: null,
      }).upiId,
    ).toBe('synthetic@bank');
  });
});
