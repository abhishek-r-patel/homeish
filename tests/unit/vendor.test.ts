// Verify vendor GSTIN validation, rupee conversion and quote-rule wording.
import { describe, expect, it } from 'vitest';
import {
  formatPaise,
  paiseToRupeesInput,
  quoteRuleBasisText,
  quoteRuleText,
  rupeesToPaise,
  vendorUploadPath,
} from '../../src/core/vendor/presentation';
import {
  isValidGstin,
  vendorInputSchema,
  vendorQuoteOverrideInputSchema,
  vendorFilePathSchema,
} from '../../src/core/vendor/validation';
import { notificationPath } from '../../src/core/notifications/links';

const ID = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const rule = {
  basis_amount_paise: 3_000_000,
  threshold_paise: 2_500_000,
  quote_count: 2,
  quotes_required: 3,
  overridden: false,
  met: false,
};

describe('vendor validation', () => {
  it('accepts Indian GSTINs in any case and rejects malformed ones', () => {
    expect(isValidGstin('27abcde1234f1z5')).toBe(true);
    expect(isValidGstin(' 27ABCDE1234F1Z5 ')).toBe(true);
    expect(isValidGstin('27ABCDE1234F1X5')).toBe(false);
    expect(isValidGstin('27ABCDE1234F0Z5')).toBe(false);
    expect(isValidGstin('2ABCDE1234F1Z5')).toBe(false);
  });

  it('normalises vendor input and blanks optional fields', () => {
    const vendor = vendorInputSchema.parse({
      vendorId: null,
      name: ' Shree Plumbing ',
      category: 'Plumbing',
      contactPerson: '',
      phone: '',
      email: '',
      gstin: '27abcde1234f1z5',
      notes: '',
      expectedVersion: null,
      clientRequestId: ID,
    });
    expect(vendor).toMatchObject({
      name: 'Shree Plumbing',
      contactPerson: null,
      gstin: '27ABCDE1234F1Z5',
    });
    expect(
      vendorInputSchema.safeParse({ ...vendor, gstin: 'NOT-A-GSTIN' }).success,
    ).toBe(false);
    expect(
      vendorInputSchema.safeParse({ ...vendor, expectedVersion: 2 }).success,
    ).toBe(false);
  });

  it('requires an override reason of at least five characters, or none to clear it', () => {
    const base = { purchaseRequestId: ID, expectedVersion: 1 };
    expect(
      vendorQuoteOverrideInputSchema.safeParse({ ...base, reason: 'abc' })
        .success,
    ).toBe(false);
    expect(
      vendorQuoteOverrideInputSchema.parse({ ...base, reason: '' }).reason,
    ).toBeNull();
  });

  it('accepts only private vendor paths inside the society folder', () => {
    const path = vendorUploadPath(ID, ID, 'image/png', ID);
    expect(path).toBe(`${ID}/vendors/${ID}/${ID}.png`);
    expect(vendorFilePathSchema.safeParse(path).success).toBe(true);
    expect(
      vendorFilePathSchema.safeParse(`${ID}/documents/${ID}/${ID}.png`).success,
    ).toBe(false);
    expect(() => vendorUploadPath(ID, ID, 'text/plain', ID)).toThrow();
  });
});

describe('vendor presentation', () => {
  it('converts rupees typed in forms to paise and back', () => {
    expect(rupeesToPaise('25,000')).toBe(2_500_000);
    expect(rupeesToPaise('₹1250.5')).toBe(125_050);
    expect(rupeesToPaise('12.345')).toBeNull();
    expect(rupeesToPaise('-5')).toBeNull();
    expect(paiseToRupeesInput(125_050)).toBe('1250.50');
    expect(paiseToRupeesInput(2_500_000)).toBe('25000');
    expect(formatPaise(2_500_000)).toBe('₹25,000');
  });

  it('describes the quote rule as a count with its basis', () => {
    expect(quoteRuleText(rule)).toBe('2 of 3 quotes');
    expect(quoteRuleText({ ...rule, quote_count: 3, met: true })).toBe(
      '3 of 3 quotes (rule met)',
    );
    expect(quoteRuleText({ ...rule, overridden: true, met: true })).toBe(
      '2 of 3 quotes (rule overridden by an admin)',
    );
    expect(
      quoteRuleText({ ...rule, quote_count: 1, quotes_required: 1, met: true }),
    ).toBe('1 of 1 quote (rule met)');
    expect(quoteRuleBasisText(rule)).toBe(
      'At or above ₹25,000, 3 quotes are needed.',
    );
    expect(quoteRuleBasisText({ ...rule, basis_amount_paise: 2_499_999 })).toBe(
      'Below ₹25,000, one quote is enough.',
    );
  });

  it('links purchase request notifications to the request page', () => {
    expect(notificationPath('vendor_purchase_request', ID, () => true)).toBe(
      `/admin/vendors/requests/${ID}`,
    );
  });
});
