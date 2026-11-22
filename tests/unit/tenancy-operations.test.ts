// Verify the move permission matrix, validated contracts and explicit failure paths.
import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/core/db/database.types';
import type { RequestContext } from '../../src/core/tenancy/request-context';
import { MODULE_REGISTRY } from '../../src/core/modules';
import { SOCIETY_ROLES } from '../../src/core/permissions';
import {
  tenancyDocumentInputSchema,
  tenancyAgreementMetadataInputSchema,
  tenancyDuesSchema,
  tenancyMoveInputSchema,
  tenancyListSearchSchema,
  tenancyMoveDetailSchema,
  tenancyWorkspaceSchema,
  tenancyVerificationInputSchema,
} from '../../src/core/tenancy/moves/validation';
import {
  formatTenancyBalance,
  formatTenancyDate,
  formatTenancyTimestamp,
  tenancyProofsReady,
  tenancyTenantChoices,
} from '../../src/core/tenancy/moves/presentation';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  invokeUntypedRpc: vi.fn(),
  enforceRateLimit: vi.fn(),
  storePreparedTenancyNoc: vi.fn(),
  attestTenancyNocPrivileged: vi.fn(),
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
vi.mock('../../src/core/tenancy/moves/files', () => ({
  storePreparedTenancyNoc: mocks.storePreparedTenancyNoc,
}));
vi.mock('../../src/core/privileged', () => ({
  attestTenancyNocPrivileged: mocks.attestTenancyNocPrivileged,
}));

import {
  attachTenancyDocument,
  completeTenancyMove,
  consentTenancyMove,
  createTenancyMove,
  decideTenancyMove,
  getTenancyMove,
  getTenancyWorkspace,
  listTenancyMoves,
  issueTenancyNoc,
  saveTenancySettings,
} from '../../src/core/tenancy/moves/operations';

const societyId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const moveId = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const userId = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';
const requestId = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const startsAt = '2027-01-02T03:30:00Z';
const endsAt = '2027-01-02T04:30:00Z';
const moveInput = {
  unitId: societyId,
  tenantMembershipId: userId,
  kind: 'move_in',
  startsAt,
  endsAt,
  agreementExpiresOn: '2027-12-31',
  amenityBookingId: null,
  clientRequestId: requestId,
};
const moveVersion = { moveId, expectedVersion: 3 };
const summary = {
  id: moveId,
  unit_id: societyId,
  unit_number: 'A-101',
  kind: 'move_in',
  status: 'pending_review',
  starts_at: startsAt,
  ends_at: endsAt,
  version: 3,
  can_view_details: true,
};
const detail = {
  move: summary,
  tenant_membership_id: userId,
  tenant_name: 'Synthetic Tenant',
  agreement_expires_on: '2027-12-31',
  amenity_booking_id: null,
  completed_at: null,
  owner_consent_valid: true,
  police_verification_required: false,
  can_manage: true,
  can_consent: false,
  can_cancel: true,
  documents: [],
  events: [],
  dues: null,
};
const page = { items: [summary], total: 1, limit: 25, offset: 0 };
const workspace = {
  today: '2027-01-02',
  timezone: 'Asia/Kolkata',
  unit_label: 'Flat',
  can_manage: true,
  can_create: true,
  can_write: true,
  police_verification_required: false,
  amenity_enabled: false,
  units: [],
  tenants: [],
  occupancies: [],
  bookings: [],
};
const nocPath = `${societyId}/moves/${moveId}/noc/${requestId}.pdf`;
const preparation = {
  status: 'prepared',
  path: nocPath,
  expected_version: 4,
  snapshot: {
    society_name: 'Synthetic Society',
    tenant_name: 'Synthetic Tenant',
    unit_number: 'A-101',
    move_date: '2027-01-02',
    issuer_name: 'Synthetic Admin',
    issued_at: startsAt,
    timezone: 'Asia/Kolkata',
    dues: {
      status: 'not_checked',
      balance_paise: null,
      checked_at: null,
    },
  },
};

function context(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId,
    userId,
    db: createClient<Database>('http://localhost:54321', 'test-anon-key'),
    memberships: [],
    societyId,
    societyStatus: 'active',
    roles: ['admin'],
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
    ...overrides,
  };
}

const operationCases = [
  {
    name: 'workspace',
    permissions: ['tenancy:list', 'tenancy:guard'],
    run: () => getTenancyWorkspace(),
    result: workspace,
  },
  {
    name: 'list',
    permissions: ['tenancy:list', 'tenancy:guard'],
    run: () => listTenancyMoves(),
    result: page,
  },
  {
    name: 'private detail',
    permissions: ['tenancy:files'],
    run: () => getTenancyMove(moveId),
    result: detail,
  },
  {
    name: 'create',
    permissions: ['tenancy:create'],
    run: () => createTenancyMove(moveInput, requestId),
    result: moveId,
  },
  {
    name: 'consent',
    permissions: ['tenancy:consent'],
    run: () => consentTenancyMove(moveVersion, requestId),
    result: null,
  },
  {
    name: 'approve',
    permissions: ['tenancy:manage'],
    run: () =>
      decideTenancyMove(
        { ...moveVersion, decision: 'approved', reason: null },
        requestId,
      ),
    result: null,
  },
  {
    name: 'cancel',
    permissions: ['tenancy:create'],
    run: () =>
      decideTenancyMove(
        { ...moveVersion, decision: 'cancelled', reason: 'Plans changed' },
        requestId,
      ),
    result: null,
  },
  {
    name: 'complete',
    permissions: ['tenancy:manage'],
    run: () => completeTenancyMove(moveVersion, requestId),
    result: userId,
  },
  {
    name: 'attach proof',
    permissions: ['tenancy:files'],
    run: () =>
      attachTenancyDocument(
        {
          ...moveVersion,
          kind: 'rental_agreement',
          path: `${societyId}/moves/${moveId}/rental_agreement/${requestId}.pdf`,
        },
        requestId,
      ),
    result: userId,
  },
  {
    name: 'issue NOC',
    permissions: ['tenancy:manage'],
    run: () => issueTenancyNoc(moveVersion, requestId),
    result: { status: 'issued', document_id: userId, path: nocPath },
  },
  {
    name: 'settings',
    permissions: ['tenancy:manage'],
    run: () =>
      saveTenancySettings(
        {
          policeVerificationRequired: true,
          verificationTrackingEnabled: false,
          clearanceHandoverBasis: 'bills',
          clearanceAgreementEvidence: 'admin_note',
        },
        requestId,
      ),
    result: null,
  },
];

describe('tenancy operation boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildRequestContext.mockResolvedValue(context());
    mocks.invokeUntypedRpc.mockResolvedValue(null);
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.storePreparedTenancyNoc.mockResolvedValue(
      new Uint8Array([37, 80, 68, 70]),
    );
    mocks.attestTenancyNocPrivileged.mockResolvedValue(undefined);
  });

  for (const operation of operationCases) {
    for (const role of SOCIETY_ROLES) {
      const allowed = operation.permissions.some((permission) =>
        MODULE_REGISTRY.tenancy.permissions[permission]?.includes(role),
      );
      it(`${allowed ? 'allows' : 'denies'} ${role} to ${operation.name}`, async () => {
        mocks.buildRequestContext.mockResolvedValue(context({ roles: [role] }));
        mocks.invokeUntypedRpc.mockResolvedValue(operation.result);
        if (allowed) {
          await operation.run();
          expect(mocks.invokeUntypedRpc).toHaveBeenCalledOnce();
        } else {
          await expect(operation.run()).rejects.toMatchObject({
            code: 'FORBIDDEN',
          });
          expect(mocks.invokeUntypedRpc).not.toHaveBeenCalled();
        }
      });
    }
  }

  it('derives society and trace from the verified context, not form input', async () => {
    mocks.invokeUntypedRpc.mockResolvedValue(moveId);
    await expect(
      createTenancyMove({ ...moveInput, societyId: userId }, requestId),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mocks.invokeUntypedRpc).not.toHaveBeenCalled();
    await createTenancyMove(moveInput, requestId);
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledWith(
      expect.any(Object),
      'tenancy_move_create',
      expect.objectContaining({
        p_society_id: societyId,
        p_request_id: requestId,
      }),
    );
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'otherWritesUserMinute',
      userId,
      requestId,
    );
  });

  it('blocks disabled modules and writes to suspended societies before calling the database', async () => {
    mocks.buildRequestContext.mockResolvedValue(
      context({ enabledModules: new Set(['core']) }),
    );
    await expect(listTenancyMoves()).rejects.toMatchObject({
      code: 'MODULE_DISABLED',
    });
    mocks.buildRequestContext.mockResolvedValue(
      context({ societyStatus: 'suspended' }),
    );
    await expect(
      completeTenancyMove(moveVersion, requestId),
    ).rejects.toMatchObject({ code: 'SOCIETY_SUSPENDED' });
    expect(mocks.invokeUntypedRpc).not.toHaveBeenCalled();
  });

  it('enforces bounded pages and rejects unexpected identity fields in the schedule projection', async () => {
    await expect(listTenancyMoves({ limit: 101 })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    mocks.invokeUntypedRpc.mockResolvedValue({
      ...page,
      items: [{ ...summary, tenant_name: 'Must not reach the status list' }],
    });
    await expect(listTenancyMoves()).rejects.toThrow();
    mocks.invokeUntypedRpc.mockResolvedValue({
      ...page,
      items: [summary, summary],
      total: 1,
    });
    await expect(listTenancyMoves()).rejects.toThrow(
      'Move page items exceed the declared bounds.',
    );
  });

  it('surfaces stale versions as refresh conflicts and never reports an RPC failure as success', async () => {
    mocks.invokeUntypedRpc.mockRejectedValueOnce(
      new Error('RPC failed', { cause: { code: '40001' } }),
    );
    await expect(
      completeTenancyMove(moveVersion, requestId),
    ).rejects.toMatchObject({ code: 'CONFLICT', reason: 'stale_version' });
    mocks.invokeUntypedRpc.mockRejectedValueOnce(
      new Error('RPC failed', { cause: { code: 'XX000' } }),
    );
    await expect(completeTenancyMove(moveVersion, requestId)).rejects.toThrow(
      'Move completion was not saved.',
    );
  });

  it('does not contact the database after rate limiting fails', async () => {
    mocks.enforceRateLimit.mockRejectedValueOnce(
      new Error('Synthetic rate limit'),
    );
    await expect(createTenancyMove(moveInput, requestId)).rejects.toThrow(
      'Synthetic rate limit',
    );
    expect(mocks.invokeUntypedRpc).not.toHaveBeenCalled();
  });

  it('rejects a financial response that treats disabled Billing as zero/cleared', async () => {
    mocks.invokeUntypedRpc.mockResolvedValue({
      ...detail,
      dues: { status: 'not_checked', balance_paise: '0', checked_at: null },
    });
    await expect(getTenancyMove(moveId)).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ['dues', 'balance_paise'] }),
      ]),
    });
  });

  it('stores and attests the exact prepared PDF before the final authoritative NOC check', async () => {
    mocks.invokeUntypedRpc
      .mockResolvedValueOnce(preparation)
      .mockResolvedValueOnce(userId);
    await expect(issueTenancyNoc(moveVersion, requestId)).resolves.toBe(userId);
    expect(mocks.storePreparedTenancyNoc).toHaveBeenCalledWith(
      expect.objectContaining({ societyId, userId }),
      preparation,
    );
    expect(mocks.attestTenancyNocPrivileged).toHaveBeenCalledWith({
      societyId,
      moveId,
      issuerId: userId,
      path: nocPath,
      expectedVersion: 4,
      expectedBytes: new Uint8Array([37, 80, 68, 70]),
      requestId,
    });
    expect(mocks.invokeUntypedRpc).toHaveBeenLastCalledWith(
      expect.any(Object),
      'tenancy_noc_issue',
      expect.objectContaining({
        p_society_id: societyId,
        p_path: nocPath,
        p_expected_version: 4,
        p_request_id: requestId,
      }),
    );
    expect(
      mocks.storePreparedTenancyNoc.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.attestTenancyNocPrivileged.mock.invocationCallOrder[0] ?? 0,
    );
    expect(
      mocks.attestTenancyNocPrivileged.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.invokeUntypedRpc.mock.invocationCallOrder[1] ?? 0);
  });

  it('does not finalise an unverified NOC artifact', async () => {
    mocks.invokeUntypedRpc.mockResolvedValueOnce(preparation);
    mocks.attestTenancyNocPrivileged.mockRejectedValueOnce(
      new Error('Synthetic artifact verification failure'),
    );
    await expect(issueTenancyNoc(moveVersion, requestId)).rejects.toThrow(
      'Synthetic artifact verification failure',
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledOnce();
  });

  it('does not finalise a NOC after storage fails and surfaces a failed dues lookup', async () => {
    mocks.invokeUntypedRpc.mockResolvedValueOnce(preparation);
    mocks.storePreparedTenancyNoc.mockRejectedValueOnce(
      new Error('Synthetic Storage failure'),
    );
    await expect(issueTenancyNoc(moveVersion, requestId)).rejects.toThrow(
      'Synthetic Storage failure',
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledOnce();
    mocks.invokeUntypedRpc.mockRejectedValueOnce(
      new Error('RPC failed', { cause: { code: 'XX000' } }),
    );
    await expect(issueTenancyNoc(moveVersion, requestId)).rejects.toThrow(
      'The NOC was not issued.',
    );
    expect(mocks.storePreparedTenancyNoc).toHaveBeenCalledOnce();
  });
});

describe('tenancy inputs', () => {
  it('formats signed bigint balances and society-local dates without precision loss or a day shift', () => {
    expect(formatTenancyBalance('900719925474099300001')).toBe(
      'Rs. 9007199254740993000.01',
    );
    expect(formatTenancyBalance('-900719925474099300001')).toBe(
      '-Rs. 9007199254740993000.01',
    );
    expect(formatTenancyBalance('-1')).toBe('-Rs. 0.01');
    expect(formatTenancyDate('2028-02-29')).toBe('29 Feb 2028');
    expect(
      formatTenancyTimestamp('2026-11-15T20:00:00Z', 'Asia/Kolkata'),
    ).toMatch(/16 Nov 2026.*01:30.*am/i);
  });

  it('requires all enabled move-in proofs but no new proofs for move-out', () => {
    const move = tenancyMoveDetailSchema.parse(detail);
    const agreement = {
      id: requestId,
      kind: 'rental_agreement' as const,
      path: 'synthetic.pdf',
      content_type: 'application/pdf' as const,
      size_bytes: 1,
      created_at: startsAt,
    };
    expect(tenancyProofsReady(move)).toBe(false);
    expect(tenancyProofsReady({ ...move, documents: [agreement] })).toBe(true);
    expect(
      tenancyProofsReady({
        ...move,
        police_verification_required: true,
        documents: [agreement],
      }),
    ).toBe(false);
    expect(
      tenancyProofsReady({
        ...move,
        police_verification_required: true,
        documents: [agreement, { ...agreement, kind: 'police_verification' }],
      }),
    ).toBe(true);
    expect(
      tenancyProofsReady({ ...move, move: { ...move.move, kind: 'move_out' } }),
    ).toBe(true);
  });

  it('offers only pending tenants for move-in and active tenants for move-out, with new targets limited to admins', () => {
    const options = tenancyWorkspaceSchema.parse({
      ...workspace,
      tenants: [
        { id: userId, name: 'Pending tenant', status: 'active' },
        { id: requestId, name: 'Active tenant', status: 'active' },
        { id: societyId, name: 'Active owner', status: 'active' },
        { id: moveId, name: 'Unassigned invitation', status: 'invited' },
      ],
      occupancies: [
        {
          unit_id: societyId,
          membership_id: userId,
          is_tenant: true,
          status: 'pending',
        },
        {
          unit_id: societyId,
          membership_id: requestId,
          is_tenant: true,
          status: 'active',
        },
        {
          unit_id: societyId,
          membership_id: societyId,
          is_tenant: false,
          status: 'active',
        },
      ],
    });
    expect(
      tenancyTenantChoices(options, societyId, 'move_in').map(({ id }) => id),
    ).toEqual([userId, moveId]);
    expect(
      tenancyTenantChoices(
        { ...options, can_manage: false },
        societyId,
        'move_in',
      ).map(({ id }) => id),
    ).toEqual([userId]);
    expect(
      tenancyTenantChoices(options, societyId, 'move_out').map(({ id }) => id),
    ).toEqual([requestId]);
    expect(tenancyTenantChoices(options, null, 'move_in')).toEqual([]);
  });

  it('parses exact-total UI pages and rejects unsupported, repeated or out-of-range query values', () => {
    expect(
      tenancyListSearchSchema.parse({
        status: 'approved',
        limit: '100',
        offset: '25',
      }),
    ).toEqual({ status: 'approved', limit: 100, offset: 25 });
    for (const input of [
      { limit: '11' },
      { limit: '101' },
      { limit: ['10', '25'] },
      { offset: '-1' },
      { offset: '2147483648' },
      { status: 'unknown' },
    ]) {
      expect(tenancyListSearchSchema.safeParse(input).success).toBe(false);
    }
  });

  it('requires the amount sign to agree with authoritative dues status without losing precision', () => {
    for (const [status, amount, valid] of [
      ['cleared', '0', true],
      ['cleared', '-9007199254740993', true],
      ['cleared', '1', false],
      ['pending', '9007199254740993', true],
      ['pending', '0', false],
      ['pending', '-1', false],
      ['pending', 'not-an-amount', false],
    ] as const) {
      expect(
        tenancyDuesSchema.safeParse({
          status,
          balance_paise: amount,
          checked_at: startsAt,
        }).success,
      ).toBe(valid);
    }
  });
  it('requires an agreement expiry only for move-in and a correctly ordered window', () => {
    expect(
      tenancyMoveInputSchema.safeParse({
        ...moveInput,
        agreementExpiresOn: null,
      }).success,
    ).toBe(false);
    expect(
      tenancyMoveInputSchema.safeParse({ ...moveInput, kind: 'move_out' })
        .success,
    ).toBe(false);
    expect(
      tenancyMoveInputSchema.safeParse({ ...moveInput, endsAt: startsAt })
        .success,
    ).toBe(false);
    expect(
      tenancyMoveInputSchema.safeParse({
        ...moveInput,
        kind: 'move_out',
        agreementExpiresOn: null,
      }).success,
    ).toBe(true);
  });

  it('refuses arbitrary identity-document categories and client-issued NOCs', () => {
    for (const kind of ['aadhaar', 'government_id', 'noc']) {
      expect(
        tenancyDocumentInputSchema.safeParse({
          ...moveVersion,
          kind,
          path: 'synthetic.pdf',
        }).success,
      ).toBe(false);
    }
  });

  it('limits optional tenancy metadata to approved tracking values without identity copies', () => {
    expect(
      tenancyVerificationInputSchema.parse({
        moveId,
        expectedVersion: 4,
        status: 'verified',
        recordedOn: '2026-11-22',
        reference: 'Police receipt 123',
      }),
    ).toMatchObject({ status: 'verified' });
    expect(
      tenancyVerificationInputSchema.safeParse({
        moveId,
        expectedVersion: 4,
        status: 'compliant',
        recordedOn: '2026-11-22',
        reference: '123',
      }).success,
    ).toBe(false);
    expect(
      tenancyAgreementMetadataInputSchema.safeParse({
        moveId,
        expectedVersion: 4,
        agreementType: 'company_lease',
        startsOn: '2026-11-01',
        expiresOn: '2027-10-31',
      }).success,
    ).toBe(true);
    expect(
      tenancyAgreementMetadataInputSchema.safeParse({
        moveId,
        expectedVersion: 4,
        agreementType: 'company_lease',
        startsOn: '2026-11-01',
        expiresOn: '2027-10-31',
        identityDocument: 'forbidden.pdf',
      }).success,
    ).toBe(false);
  });
});
