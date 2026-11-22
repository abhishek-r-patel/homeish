// Verify P51 input boundaries, role checks and prepare–attest–issue ordering.
import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/core/db/database.types';
import type { RequestContext } from '../../src/core/tenancy/request-context';
import {
  CLEARANCE_WARNING,
  clearanceHandoverDraftInputSchema,
  transferCaseInputSchema,
} from '../../src/core/tenancy/transfers/validation';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  invokeUntypedRpc: vi.fn(),
  enforceRateLimit: vi.fn(),
  attest: vi.fn(),
  store: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));
vi.mock('../../src/core/db/untyped-rpc', () => ({
  invokeUntypedRpc: mocks.invokeUntypedRpc,
}));
vi.mock('../../src/core/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock('../../src/core/privileged', () => ({
  attestTenancyCertificatePrivileged: mocks.attest,
}));
vi.mock('../../src/core/tenancy/transfers/files', () => ({
  storePreparedTenancyCertificate: mocks.store,
  prepareClearanceFileUpload: vi.fn(),
}));

import {
  acknowledgeClearanceWarning,
  checkClearanceDues,
  issueTenancyCertificate,
  listTransferCases,
  saveTransferCase,
} from '../../src/core/tenancy/transfers/operations';

const societyId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const userId = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';
const caseId = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const requestId = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const unitId = 'e0d55fc3-0751-4b79-86c1-5b3e25942392';

function context(roles: RequestContext['roles'] = ['admin']): RequestContext {
  return {
    requestId,
    userId,
    db: createClient<Database>('http://localhost:54321', 'test-anon-key'),
    memberships: [],
    societyId,
    societyStatus: 'active',
    roles,
    enabledModules: new Set(['core', 'tenancy']),
    isDeveloper: false,
    isDeveloperAccount: false,
    isHindiEnabled: false,
    languagePreference: 'en',
    mfaVerified: false,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.buildRequestContext.mockResolvedValue(context());
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.invokeUntypedRpc.mockResolvedValue(null);
  mocks.store.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
});

describe('P51 operations', () => {
  it('acknowledges the exact approved warning and derives society from session', async () => {
    mocks.invokeUntypedRpc.mockResolvedValue('2026-11-22T12:00:00+00:00');
    await acknowledgeClearanceWarning(
      { warningText: CLEARANCE_WARNING, clientRequestId: requestId },
      requestId,
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledWith(
      expect.any(Object),
      'tenancy_clearance_acknowledge',
      expect.objectContaining({
        p_society_id: societyId,
        p_warning_text: CLEARANCE_WARNING,
        p_request_id: requestId,
      }),
    );
  });

  it('allows committee reads but denies all transfer writes before an RPC', async () => {
    mocks.buildRequestContext.mockResolvedValue(context(['committee']));
    mocks.invokeUntypedRpc.mockResolvedValue({
      items: [],
      total: 0,
      limit: 25,
      offset: 0,
    });
    await listTransferCases();
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledOnce();
    await expect(
      acknowledgeClearanceWarning(
        { warningText: CLEARANCE_WARNING, clientRequestId: requestId },
        requestId,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledOnce();
  });

  it('maps the transfer form to the migration RPC without client society fields', async () => {
    mocks.invokeUntypedRpc.mockResolvedValue(caseId);
    const input = {
      caseId: null,
      unitId,
      receivedOn: '2026-11-22',
      sellers: [{ membershipId: userId }],
      buyer: {
        name: 'Synthetic Buyer',
        membershipId: null,
        phone: null,
        email: null,
      },
      expectedVersion: null,
      clientRequestId: requestId,
    };
    await saveTransferCase(input, requestId);
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledWith(
      expect.any(Object),
      'tenancy_transfer_case_save',
      expect.objectContaining({
        p_society_id: societyId,
        p_sellers: [{ membership_id: userId }],
        p_buyer: expect.objectContaining({
          name: 'Synthetic Buyer',
          membership_id: null,
        }),
      }),
    );
    await expect(
      saveTransferCase({ ...input, societyId }, requestId),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('rejects ambiguous handover targets and parties', () => {
    expect(
      clearanceHandoverDraftInputSchema.safeParse({
        moveId: caseId,
        caseId,
        responsibleTransferPartyId: null,
        responsibleMembershipId: userId,
        responsibleRole: 'tenant',
        adminNote: null,
        clientRequestId: requestId,
      }).success,
    ).toBe(false);
  });

  it('requires the prepare, exact artifact attestation and caller-session issue sequence', async () => {
    const preparation = {
      status: 'prepared',
      path: `${societyId}/tenancy-certificates/f0d55fc3-0751-4b79-86c1-5b3e25942392.pdf`,
      issued_by: userId,
      source_version: 2,
      prepared_at: '2026-11-22T12:00:00+00:00',
      purpose: 'Transfer',
      kind: 'not_checked',
      signatory_name: 'Synthetic Admin',
      signatory_designation: 'Secretary',
      handover_id: null,
      dues: {
        status: 'not_checked',
        bills: [],
        total_paise: null,
        checked_at: null,
      },
      parties: [
        { role: 'buyer', name: 'Synthetic Buyer', membership_id: null },
      ],
      unit: { society_id: societyId, unit_id: unitId, number: 'A-101' },
      expected_version: 3,
      client_request_id: requestId,
      artifact_hash: null,
      artifact_verified_at: null,
    };
    mocks.invokeUntypedRpc
      .mockResolvedValueOnce(preparation)
      .mockResolvedValueOnce(caseId);
    await issueTenancyCertificate(
      {
        moveId: null,
        caseId,
        purpose: 'Transfer',
        signatoryDesignation: 'Secretary',
        clientRequestId: requestId,
      },
      requestId,
    );
    expect(mocks.store).toHaveBeenCalledWith(
      expect.any(Object),
      preparation,
      null,
      null,
      null,
    );
    expect(mocks.attest).toHaveBeenCalledWith(
      expect.objectContaining({
        societyId,
        caseId,
        path: preparation.path,
        expectedBytes: new Uint8Array([37, 80, 68, 70]),
      }),
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenLastCalledWith(
      expect.any(Object),
      'tenancy_certificate_issue',
      expect.objectContaining({ p_expected_version: 3 }),
    );
  });

  it('surfaces a failed authoritative dues lookup and never turns it into cleared', async () => {
    mocks.invokeUntypedRpc.mockRejectedValueOnce(
      new Error('RPC failed', { cause: { code: 'XX000' } }),
    );
    await expect(checkClearanceDues({ moveId: null, caseId })).rejects.toThrow(
      'Could not recheck authoritative dues',
    );
  });

  it('requires a seller and received date without extra fields', () => {
    expect(
      transferCaseInputSchema.safeParse({
        caseId: null,
        unitId,
        receivedOn: '2026-11-22',
        sellers: [],
        buyer: {
          name: 'Buyer',
          membershipId: null,
          phone: null,
          email: null,
        },
        expectedVersion: null,
        clientRequestId: requestId,
      }).success,
    ).toBe(false);
  });
});
