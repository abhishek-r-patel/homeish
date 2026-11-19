// Verify vendor GSTIN validation, rupee conversion, quote-rule wording and P47 register inputs.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  callModuleRpc: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));
vi.mock('../../src/core/db/validated-rpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/core/db/validated-rpc')>()),
  callModuleRpc: mocks.callModuleRpc,
}));
vi.mock('../../src/core/rate-limit', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('../../src/core/permissions/authorize', () => ({
  authorizeRequest: vi.fn(),
}));

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
  isValidVendorPan,
  vendorInputSchema,
  vendorBlacklistInputSchema,
  vendorQuoteOverrideInputSchema,
  vendorFilePathSchema,
  vendorBillInputSchema,
  vendorContractInputSchema,
  vendorStaffDayCheckInputSchema,
  vendorWorkOrderStatusInputSchema,
} from '../../src/core/vendor/validation';
import {
  createVendorWorkOrder,
  setVendorWorkOrderStatus,
} from '../../src/core/vendor/operations';
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
      pan: 'abcde1234f',
      paymentTermsDays: 0,
      onboardedDate: '',
      notes: '',
      expectedVersion: null,
      clientRequestId: ID,
    });
    expect(vendor).toMatchObject({
      name: 'Shree Plumbing',
      contactPerson: null,
      gstin: '27ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      paymentTermsDays: 0,
      onboardedDate: null,
    });
    expect(
      vendorInputSchema.safeParse({ ...vendor, gstin: 'NOT-A-GSTIN' }).success,
    ).toBe(false);
    expect(
      vendorInputSchema.safeParse({ ...vendor, expectedVersion: 2 }).success,
    ).toBe(false);
    expect(
      vendorInputSchema.safeParse({ ...vendor, pan: 'NOT-A-PAN' }).success,
    ).toBe(false);
    expect(
      vendorInputSchema.safeParse({ ...vendor, paymentTermsDays: 366 }).success,
    ).toBe(false);
    expect(
      vendorInputSchema.safeParse({ ...vendor, onboardedDate: '2026-02-30' })
        .success,
    ).toBe(false);
    expect(isValidVendorPan('abcde1234f')).toBe(true);
    expect(isValidVendorPan('ABCDE12345')).toBe(false);
  });

  it('requires a reason and a current vendor version for blacklist changes', () => {
    const input = {
      vendorId: ID,
      blacklisted: true,
      expectedVersion: 1,
    };
    expect(
      vendorBlacklistInputSchema.safeParse({ ...input, reason: '   ' }).success,
    ).toBe(false);
    expect(
      vendorBlacklistInputSchema.parse({
        ...input,
        reason: 'Repeated missed appointments.',
      }).reason,
    ).toBe('Repeated missed appointments.');
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

describe('P47 register validation', () => {
  const contract = {
    contractId: null,
    vendorId: ID,
    scope: 'Security staff',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    annualValuePaise: 1_200_000,
    paymentFrequency: 'monthly',
    autoRenew: false,
    noticeDays: 30,
    documentPath: null,
    defaultSanctionedDays: 26,
    deductionPerDayPaise: 100_000,
    expectedVersion: null,
    clientRequestId: ID,
  };

  it('requires a vendor, an ordered period and a version only when editing a contract', () => {
    expect(vendorContractInputSchema.safeParse(contract).success).toBe(true);
    for (const change of [
      { vendorId: null },
      { endDate: '2026-03-31' },
      { expectedVersion: 1 },
      { paymentFrequency: 'weekly' },
      { defaultSanctionedDays: 32 },
    ])
      expect(
        vendorContractInputSchema.safeParse({ ...contract, ...change }).success,
      ).toBe(false);
    expect(
      vendorContractInputSchema.safeParse({
        ...contract,
        contractId: ID,
        vendorId: null,
        expectedVersion: 2,
        clientRequestId: null,
      }).success,
    ).toBe(true);
  });

  it('allows a rate or a manual deduction but not both, and needs a reason to edit a check', () => {
    const check = {
      checkId: null,
      contractId: ID,
      month: '2026-10-01',
      sanctionedDays: 26,
      actualDays: 24,
      contractedAmountPaise: 2_600_000,
      ratePaise: 100_000,
      manualDeductionPaise: null,
      manualDeductionReason: '',
      billRaisedPaise: null,
      editReason: '',
      expectedVersion: null,
      clientRequestId: ID,
    };
    expect(vendorStaffDayCheckInputSchema.safeParse(check).success).toBe(true);
    expect(
      vendorStaffDayCheckInputSchema.safeParse({
        ...check,
        manualDeductionPaise: 50_000,
        manualDeductionReason: 'Guard absent',
      }).success,
    ).toBe(false);
    expect(
      vendorStaffDayCheckInputSchema.safeParse({
        ...check,
        ratePaise: null,
        manualDeductionPaise: 50_000,
      }).success,
    ).toBe(false);
    const edit = {
      ...check,
      checkId: ID,
      expectedVersion: 1,
      clientRequestId: null,
    };
    expect(vendorStaffDayCheckInputSchema.safeParse(edit).success).toBe(false);
    expect(
      vendorStaffDayCheckInputSchema.safeParse({
        ...edit,
        editReason: 'Corrected attendance',
      }).success,
    ).toBe(true);
  });

  it('needs a completion date to complete and a reason to cancel a work order', () => {
    const base = { workOrderId: ID, expectedVersion: 1 };
    expect(
      vendorWorkOrderStatusInputSchema.safeParse({
        ...base,
        status: 'completed',
        completedOn: '',
        reason: '',
      }).success,
    ).toBe(false);
    expect(
      vendorWorkOrderStatusInputSchema.safeParse({
        ...base,
        status: 'cancelled',
        completedOn: '',
        reason: ' ',
      }).success,
    ).toBe(false);
    expect(
      vendorWorkOrderStatusInputSchema.safeParse({
        ...base,
        status: 'issued',
        completedOn: '',
        reason: '',
      }).success,
    ).toBe(false);
  });

  it('pairs a bill edit with its loaded version', () => {
    const bill = {
      billId: null,
      vendorId: ID,
      invoiceNumber: 'INV-1',
      invoiceDate: '2026-11-01',
      amountPaise: 500_000,
      expectedVersion: null,
      clientRequestId: ID,
    };
    expect(vendorBillInputSchema.safeParse(bill).success).toBe(true);
    expect(
      vendorBillInputSchema.safeParse({ ...bill, billId: ID }).success,
    ).toBe(false);
    expect(
      vendorBillInputSchema.safeParse({ ...bill, amountPaise: 0 }).success,
    ).toBe(false);
  });
});

describe('P47 register operations', () => {
  beforeEach(() => {
    mocks.callModuleRpc.mockReset();
    mocks.buildRequestContext.mockResolvedValue({
      societyId: ID,
      userId: ID,
      requestId: 'request-1',
    });
  });

  it('sends a null due date when a work order is issued without one', async () => {
    mocks.callModuleRpc.mockResolvedValue(ID);
    await createVendorWorkOrder(
      {
        purchaseRequestId: ID,
        description: '',
        valuePaise: null,
        issuedOn: '2026-11-20',
        dueOn: '',
        clientRequestId: ID,
      },
      'request-1',
    );
    expect(mocks.callModuleRpc).toHaveBeenCalledWith(
      expect.anything(),
      'vendor_work_order_create',
      expect.objectContaining({
        p_description: null,
        p_issued_on: '2026-11-20',
        p_due_on: null,
      }),
      expect.anything(),
      expect.any(String),
    );
  });

  it('sends only the field that matches the new work order status', async () => {
    mocks.callModuleRpc.mockResolvedValue(null);
    await setVendorWorkOrderStatus(
      {
        workOrderId: ID,
        status: 'completed',
        completedOn: '2026-11-19',
        reason: 'Leftover text',
        expectedVersion: 3,
      },
      'request-1',
    );
    expect(mocks.callModuleRpc.mock.calls[0]?.[2]).toMatchObject({
      p_status: 'completed',
      p_completed_on: '2026-11-19',
      p_reason: null,
      p_expected_version: 3,
    });
    await expect(
      setVendorWorkOrderStatus(
        {
          workOrderId: ID,
          status: 'cancelled',
          completedOn: '',
          reason: '',
          expectedVersion: 3,
        },
        'request-1',
      ),
    ).rejects.toThrow();
    expect(mocks.callModuleRpc).toHaveBeenCalledTimes(1);
  });
});
