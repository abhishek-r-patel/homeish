// Verify document input rules, presentation helpers and the RPC contracts behind every screen.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  documentCreateInputSchema,
  documentFolderInputSchema,
  documentGovernanceSaveInputSchema,
  documentListInputSchema,
  documentPathSchema,
  documentSearchSchema,
  documentSettingsSchema,
  documentUploadInputSchema,
} from '../../src/core/document/validation';
import {
  documentFileNameFromUpload,
  documentUnitLabel,
  documentUploadPath,
  formatDocumentFileSize,
} from '../../src/core/document/presentation';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  invokeUntypedRpc: vi.fn(),
  enforceRateLimit: vi.fn(),
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

import {
  getDocumentWorkspace,
  saveGovernanceRecord,
  saveDocumentFolder,
  setDocumentVersionArchived,
  updateDocumentReminderSettings,
} from '../../src/core/document/operations';

const societyId = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const folderId = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const unitId = 'b0d55fc3-0751-4b79-86c1-5b3e25942392';
const fileId = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const path = `${societyId}/documents/${fileId}.pdf`;
const createInput = {
  folderId,
  unitId: null,
  unitAudience: null,
  title: 'Bylaws',
  description: '  ',
  path,
  fileName: 'bylaws.pdf',
  clientRequestId: fileId,
};

function context(roles: string[], enabled = true) {
  return {
    requestId: 'request-1',
    userId: unitId,
    db: {},
    memberships: [],
    societyId,
    societyStatus: 'active',
    roles,
    enabledModules: new Set(enabled ? ['core', 'document'] : ['core']),
    isDeveloper: false,
    isDeveloperAccount: false,
    mfaVerified: false,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

describe('document validation', () => {
  it('requires linked evidence for verified governance records', () => {
    const input = {
      recordId: null,
      kind: 'validity',
      title: 'Registration certificate',
      state: 'verified',
      source: null,
      approvingResolutionId: null,
      details: {
        issuingAuthority: 'Registrar',
        reference: 'REG-1',
        issueDate: '2026-01-01',
        expiryKind: 'dated',
        expiryDate: '2027-01-01',
      },
      expectedVersion: null,
      reason: null,
      clientRequestId: fileId,
    };
    expect(documentGovernanceSaveInputSchema.safeParse(input).success).toBe(
      false,
    );
    expect(
      documentGovernanceSaveInputSchema.safeParse({
        ...input,
        source: { kind: 'document_version', id: fileId },
      }).success,
    ).toBe(true);
  });

  it('limits dated expiry, house-rule length and correction reasons', () => {
    expect(
      documentGovernanceSaveInputSchema.safeParse({
        recordId: null,
        kind: 'validity',
        title: 'Certificate',
        state: 'draft',
        source: null,
        approvingResolutionId: null,
        details: {
          issuingAuthority: null,
          reference: null,
          issueDate: null,
          expiryKind: 'perpetual',
          expiryDate: '2027-01-01',
        },
        expectedVersion: null,
        reason: null,
        clientRequestId: fileId,
      }).success,
    ).toBe(false);
    expect(
      documentGovernanceSaveInputSchema.safeParse({
        recordId: folderId,
        kind: 'house_rule',
        title: 'Rule',
        state: 'verified',
        source: { kind: 'document_version', id: fileId },
        approvingResolutionId: fileId,
        details: {
          text: 'x'.repeat(5001),
          approvalDate: '2026-01-01',
          effectiveDate: '2026-01-02',
        },
        expectedVersion: 1,
        reason: 'Correct the text',
        clientRequestId: unitId,
      }).success,
    ).toBe(false);
  });

  it('keeps the empty Documents settings compatible and defaults reminders off', () => {
    expect(documentSettingsSchema.parse({})).toEqual({});
    expect(
      documentSettingsSchema.parse({ expiry_reminders_enabled: true }),
    ).toEqual({ expiry_reminders_enabled: true });
    expect(
      documentSettingsSchema.safeParse({ case_reminders_enabled: true })
        .success,
    ).toBe(false);
  });

  it('requires exactly one target and a unit audience only for units', () => {
    expect(documentCreateInputSchema.parse(createInput).description).toBe(null);
    expect(
      documentCreateInputSchema.safeParse({ ...createInput, unitId }).success,
    ).toBe(false);
    expect(
      documentCreateInputSchema.safeParse({
        ...createInput,
        folderId: null,
        unitId,
      }).success,
    ).toBe(false);
    expect(
      documentCreateInputSchema.safeParse({
        ...createInput,
        folderId: null,
        unitId,
        unitAudience: 'owners_only',
      }).success,
    ).toBe(true);
    expect(
      documentListInputSchema.safeParse({ folderId: null, unitId: null })
        .success,
    ).toBe(false);
  });

  it('accepts only private document paths and supported files', () => {
    expect(documentPathSchema.safeParse(path).success).toBe(true);
    for (const bad of [
      `${societyId}/moves/${fileId}.pdf`,
      `${societyId}/documents/${fileId}.gif`,
      `${societyId}/documents/../${fileId}.pdf`,
    ]) {
      expect(documentPathSchema.safeParse(bad).success).toBe(false);
    }
    expect(
      documentUploadInputSchema.safeParse({
        contentType: 'image/gif',
        sizeBytes: 10,
      }).success,
    ).toBe(false);
    expect(
      documentUploadInputSchema.safeParse({
        contentType: 'application/pdf',
        sizeBytes: 5 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false);
  });

  it('pairs a folder id with its expected version', () => {
    const folder = { name: 'Minutes', audience: 'all_residents' };
    expect(
      documentFolderInputSchema.safeParse({
        ...folder,
        folderId: null,
        expectedVersion: null,
      }).success,
    ).toBe(true);
    expect(
      documentFolderInputSchema.safeParse({
        ...folder,
        folderId,
        expectedVersion: null,
      }).success,
    ).toBe(false);
  });

  it('ignores invalid search parameters instead of failing the page', () => {
    expect(
      documentSearchSchema.parse({
        folder: 'nope',
        unit: unitId,
        archived: 'yes',
        offset: '-4',
      }),
    ).toEqual({
      folder: undefined,
      unit: unitId,
      archived: false,
      offset: 0,
      governanceKind: 'validity',
      governanceSourceKind: 'document_version',
      governanceSourceOffset: 0,
      governanceArchived: false,
      governanceOffset: 0,
    });
  });
});

describe('document presentation', () => {
  it('formats sizes, unit labels, upload paths and file names', () => {
    expect(formatDocumentFileSize(300)).toBe('1 KB');
    expect(formatDocumentFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    expect(documentUnitLabel({ number: '402', block_name: 'Tower A' })).toBe(
      'Tower A · 402',
    );
    expect(documentUnitLabel({ number: '7', block_name: null })).toBe('7');
    expect(documentUploadPath(societyId, 'image/jpeg', fileId)).toBe(
      `${societyId}/documents/${fileId}.jpg`,
    );
    expect(() => documentUploadPath(societyId, 'image/gif', fileId)).toThrow();
    expect(documentFileNameFromUpload(' a/b\\c.pdf ')).toBe('a b c.pdf');
    expect(documentFileNameFromUpload('   ')).toBe('document');
  });
});

describe('document operations', () => {
  beforeEach(() => {
    mocks.buildRequestContext.mockReset();
    mocks.invokeUntypedRpc.mockReset();
    mocks.enforceRateLimit.mockReset();
  });

  it('refuses reads when the module is disabled', async () => {
    mocks.buildRequestContext.mockResolvedValue(context(['resident'], false));
    await expect(getDocumentWorkspace()).rejects.toMatchObject({
      code: 'MODULE_DISABLED',
    });
    expect(mocks.invokeUntypedRpc).not.toHaveBeenCalled();
  });

  it('lets only admins write and rate-limits each write', async () => {
    mocks.buildRequestContext.mockResolvedValue(context(['committee']));
    await expect(
      saveDocumentFolder(
        {
          folderId: null,
          name: 'Plans',
          audience: 'owners_only',
          expectedVersion: null,
        },
        'request-1',
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    mocks.buildRequestContext.mockResolvedValue(context(['admin']));
    mocks.invokeUntypedRpc.mockResolvedValue({
      id: folderId,
      name: 'Plans',
      audience: 'owners_only',
      system_key: null,
      sort_order: 1000,
      version: 1,
      archived_at: null,
      updated_at: '2026-11-16T10:00:00Z',
      document_count: 0,
    });
    await saveDocumentFolder(
      {
        folderId: null,
        name: ' Plans ',
        audience: 'owners_only',
        expectedVersion: null,
      },
      'request-1',
    );
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'otherWritesUserMinute',
      unitId,
      'request-1',
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledWith(
      {},
      'document_folder_save',
      {
        p_society_id: societyId,
        p_folder_id: null,
        p_name: 'Plans',
        p_audience: 'owners_only',
        p_expected_version: null,
        p_request_id: 'request-1',
      },
    );
  });

  it('maps a stale version to a conflict', async () => {
    mocks.buildRequestContext.mockResolvedValue(context(['admin']));
    mocks.invokeUntypedRpc.mockRejectedValue(
      new Error('stale', { cause: { code: '40001' } }),
    );
    await expect(
      setDocumentVersionArchived(
        { versionId: fileId, archived: true, expectedVersion: 2 },
        'request-1',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('maps governance sources and reminder settings without widening access', async () => {
    mocks.buildRequestContext.mockResolvedValue(context(['admin']));
    mocks.invokeUntypedRpc.mockResolvedValue({
      id: folderId,
      kind: 'validity',
      title: 'Registration certificate',
      state: 'verified',
      source: {
        state: 'available',
        kind: 'document_version',
        id: fileId,
        label: 'Certificate',
      },
      version: 1,
      archivedAt: null,
      createdAt: '2026-11-22T10:00:00Z',
      updatedAt: '2026-11-22T10:00:00Z',
      validity: {
        issuingAuthority: 'Registrar',
        reference: 'REG-1',
        issueDate: '2026-01-01',
        expiryKind: 'dated',
        expiryDate: '2027-01-01',
      },
    });
    await saveGovernanceRecord(
      {
        recordId: null,
        kind: 'validity',
        title: 'Registration certificate',
        state: 'verified',
        source: { kind: 'document_version', id: fileId },
        approvingResolutionId: null,
        details: {
          issuingAuthority: 'Registrar',
          reference: 'REG-1',
          issueDate: '2026-01-01',
          expiryKind: 'dated',
          expiryDate: '2027-01-01',
        },
        expectedVersion: null,
        reason: null,
        clientRequestId: fileId,
      },
      'request-1',
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledWith(
      {},
      'document_governance_save',
      expect.objectContaining({
        p_document_version_id: fileId,
        p_tenancy_document_id: null,
        p_resolution_id: null,
        p_approving_resolution_id: null,
      }),
    );
    mocks.invokeUntypedRpc.mockResolvedValue({
      expiry_reminders_enabled: true,
    });
    await updateDocumentReminderSettings(
      { expiryRemindersEnabled: true },
      'request-1',
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenLastCalledWith(
      {},
      'document_settings_update',
      {
        p_society_id: societyId,
        p_expiry_reminders_enabled: true,
        p_request_id: 'request-1',
      },
    );
  });
});
