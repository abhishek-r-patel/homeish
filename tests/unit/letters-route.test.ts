// Verify the letter PDF route enforces origin, role, module and source checks before logging a download.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  enforceRateLimit: vi.fn(),
  getBillingBill: vi.fn(),
  logUnexpectedError: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));
vi.mock('../../src/core/logging/error-logger', () => ({
  logUnexpectedError: mocks.logUnexpectedError,
}));
vi.mock('../../src/core/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock('../../src/core/billing/operations', () => ({
  getBillingBill: mocks.getBillingBill,
  listBillingBills: vi.fn(),
}));
vi.mock('../../src/core/members/operations', () => ({
  listSocietyMembers: vi.fn(),
}));
vi.mock('../../src/core/amenity/operations', () => ({
  getAmenityWorkspace: vi.fn(),
}));
vi.mock('../../src/core/vendor/operations', () => ({
  getVendorWorkOrders: vi.fn(),
}));
vi.mock('../../src/core/service-requests/queries', () => ({
  readServiceRequest: vi.fn(),
  readServiceRequests: vi.fn(),
}));

import { POST } from '../../src/app/api/letters/route';
import { AppError } from '../../src/core/errors';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const billId = '0b7a3c52-4d1e-4f8a-9b6c-2e5d7f9a1c30';

function context(roles: string[], modules = ['core', 'billing']) {
  return {
    requestId: 'request-1',
    userId: '5a696d6f-774c-41d1-ae47-6254d4a8f4cf',
    societyId,
    societyStatus: 'active',
    roles,
    enabledModules: new Set(modules),
    isDeveloper: false,
    mfaVerified: true,
    db: {
      from: () => ({
        select: () => ({ eq: () => ({ single: mocks.single }) }),
      }),
      rpc: mocks.rpc,
    },
  };
}

function letterRequest(body: unknown, origin = 'https://homeish.test') {
  return new Request('https://homeish.test/api/letters', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const circular = {
  letterType: 'circular',
  sourceId: null,
  sourceDate: null,
  letterDate: '2026-11-20',
  recipient: 'All Residents',
  subject: 'Water tank cleaning',
  body: 'Dear Residents,\n\nThe tank will be cleaned on Saturday.',
};

const reminder = {
  ...circular,
  letterType: 'dues_reminder',
  sourceId: billId,
  recipient: 'The Resident\nUnit A-101',
  subject: 'Reminder: Maintenance for Unit A-101',
  body: 'Outstanding: Rs. 2500.00. Please pay or contact the office.',
};

async function errorCode(response: Response) {
  const body = (await response.json()) as { error?: { code?: string } };
  return body.error?.code;
}

describe('letter PDF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildRequestContext.mockResolvedValue(context(['admin']));
    mocks.single.mockResolvedValue({
      data: {
        name: 'Synthetic Greens CHS',
        address: '1 Test Lane',
        city: 'Pune',
        contact_email: null,
        contact_phone: null,
        timezone: 'Asia/Kolkata',
      },
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: '6a696d6f-774c-41d1-ae47-6254d4a8f4cf',
      error: null,
    });
    mocks.getBillingBill.mockResolvedValue({
      id: billId,
      status: 'due',
      outstanding_paise: 250000,
    });
  });

  it('returns an unsaved PDF and records the generation', async () => {
    const response = await POST(letterRequest(circular));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain(
      'letter-circular-2026-11-20.pdf',
    );
    expect(mocks.rpc).toHaveBeenCalledWith('letter_generation_record', {
      p_society_id: societyId,
      p_letter_type: 'circular',
      p_source_type: null,
      p_source_id: null,
      p_request_id: 'request-1',
    });
  });

  it('checks the bill through the existing billing read before logging', async () => {
    const response = await POST(letterRequest(reminder));
    expect(response.status).toBe(200);
    expect(mocks.getBillingBill).toHaveBeenCalledWith(billId);
    expect(mocks.rpc).toHaveBeenCalledWith(
      'letter_generation_record',
      expect.objectContaining({
        p_source_type: 'billing_bill',
        p_source_id: billId,
      }),
    );
  });

  it('refuses a bill the viewer cannot read or that has nothing due', async () => {
    mocks.getBillingBill.mockRejectedValueOnce(new AppError('FORBIDDEN'));
    expect((await POST(letterRequest(reminder))).status).toBe(403);
    mocks.getBillingBill.mockResolvedValueOnce({
      id: billId,
      status: 'paid',
      outstanding_paise: 0,
    });
    const paid = await POST(letterRequest(reminder));
    expect(await errorCode(paid)).toBe('NOT_FOUND');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('allows only administrators and committee members', async () => {
    mocks.buildRequestContext.mockResolvedValue(context(['resident']));
    const response = await POST(letterRequest(circular));
    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.buildRequestContext.mockResolvedValue(context(['committee']));
    expect((await POST(letterRequest(circular))).status).toBe(200);
  });

  it('refuses letter types whose module is turned off', async () => {
    mocks.buildRequestContext.mockResolvedValue(context(['admin'], ['core']));
    const response = await POST(letterRequest(reminder));
    expect(await errorCode(response)).toBe('MODULE_DISABLED');
    expect(mocks.getBillingBill).not.toHaveBeenCalled();
  });

  it('rejects cross-origin requests and threatening wording', async () => {
    const crossOrigin = await POST(
      letterRequest(circular, 'https://evil.test'),
    );
    expect(crossOrigin.status).toBe(403);
    expect(mocks.buildRequestContext).not.toHaveBeenCalled();

    const threat = await POST(
      letterRequest({
        ...reminder,
        body: 'Pay now or we will take legal action.',
      }),
    );
    expect(await errorCode(threat)).toBe('VALIDATION_FAILED');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
