// Verify the approved NOC wording, rendered PDF content and safe upload retries.
import { createClient } from '@supabase/supabase-js';
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/core/db/database.types';
import type { RequestContext } from '../../src/core/tenancy/request-context';
import {
  tenancyNocPdf,
  tenancyNocText,
} from '../../src/core/tenancy/moves/documents';
import {
  tenancyNocPreparationSchema,
  type TenancyNocSnapshot,
} from '../../src/core/tenancy/moves/validation';

const privilegedMocks = vi.hoisted(() => ({
  download: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('../../src/core/privileged/server-client', () => ({
  privilegedClient: {
    storage: { from: () => ({ download: privilegedMocks.download }) },
  },
}));
vi.mock('../../src/core/db/untyped-rpc', () => ({
  invokeUntypedRpc: privilegedMocks.rpc,
}));
import { storePreparedTenancyNoc } from '../../src/core/tenancy/moves/files';
import { attestTenancyNocPrivileged } from '../../src/core/privileged/tenancy';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const snapshot: TenancyNocSnapshot = {
  society_name: 'Synthetic Society',
  tenant_name: 'Synthetic Tenant',
  unit_number: 'A-101',
  move_date: '2026-11-15',
  issuer_name: 'Synthetic Admin',
  issued_at: '2026-11-15T10:00:00Z',
  timezone: 'Asia/Kolkata',
  dues: { status: 'not_checked', balance_paise: null, checked_at: null },
};

async function renderedPdfText(bytes: Uint8Array) {
  const document = await PDFDocument.load(bytes);
  const lines: string[] = [];
  for (const page of document.getPages()) {
    const streams = page.node.Contents();
    if (!(streams instanceof PDFArray))
      throw new Error('NOC content is missing.');
    for (const reference of streams.asArray()) {
      const stream = document.context.lookup(reference);
      if (!(stream instanceof PDFRawStream))
        throw new Error('NOC text stream is missing.');
      const content = Buffer.from(decodePDFRawStream(stream).decode()).toString(
        'latin1',
      );
      for (const match of content.matchAll(/<([0-9A-Fa-f]+)> Tj/g)) {
        const hex = match[1];
        if (hex) lines.push(Buffer.from(hex, 'hex').toString('latin1'));
      }
    }
  }
  return lines.join(' ').replace(/\s+/g, ' ');
}

describe('tenancy NOC documents', () => {
  it('uses the approved template and never describes disabled Billing as cleared', () => {
    expect(tenancyNocText(snapshot)).toBe(
      'Synthetic Society has no objection to the approved move-out of Synthetic Tenant from A-101 on 15 Nov 2026. ' +
        'Dues status at issue: not checked because Billing is disabled. ' +
        "Issued by Synthetic Admin on 15 Nov 2026, 03:30:00 pm IST. This records the society's move-out approval.",
    );
    expect(tenancyNocText(snapshot)).not.toContain('cleared');
    expect(
      tenancyNocText({
        ...snapshot,
        dues: {
          status: 'cleared',
          balance_paise: '-100',
          checked_at: snapshot.issued_at,
        },
      }),
    ).toContain('Dues status at issue: cleared as of 15 Nov 2026');
  });

  it('renders the complete wording and produces identical bytes for an issue retry', async () => {
    const bytes = await tenancyNocPdf(snapshot);
    expect(await renderedPdfText(bytes)).toContain(tenancyNocText(snapshot));
    expect(await tenancyNocPdf(snapshot)).toEqual(bytes);
  });

  it.each(['Ren\u00e9e', 'Rene\u0301e'])(
    'preserves supported names faithfully without stripping accents: %s',
    async (tenantName) => {
      const prepared = {
        ...snapshot,
        society_name: 'R\u00e9sidence Test',
        tenant_name: tenantName,
        issuer_name: 'Fran\u00e7ois',
      };
      expect(await renderedPdfText(await tenancyNocPdf(prepared))).toContain(
        tenancyNocText(prepared).normalize('NFC'),
      );
    },
  );

  it.each([
    'society_name',
    'tenant_name',
    'unit_number',
    'issuer_name',
  ] as const)(
    'blocks an unsupported %s instead of replacing its characters',
    async (field) => {
      await expect(
        tenancyNocPdf({ ...snapshot, [field]: '\u0928\u093e\u092e' }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        message: expect.stringContaining('font cannot render'),
      });
    },
  );

  it('verifies a duplicate upload against the exact prepared PDF instead of overwriting it', async () => {
    const db = createClient<Database>(
      'http://127.0.0.1:54321',
      'test-anon-key',
    );
    const bucket = db.storage.from('tenancy-files');
    vi.spyOn(db.storage, 'from').mockReturnValue(bucket);
    const upload = vi.fn().mockResolvedValue({
      data: null,
      error: { statusCode: '409', message: 'Already exists' },
    });
    const download = vi.fn().mockResolvedValue({
      data: new Blob([Buffer.from(await tenancyNocPdf(snapshot))]),
      error: null,
    });
    vi.spyOn(bucket, 'upload').mockImplementation(upload);
    vi.spyOn(bucket, 'download').mockImplementation(download);
    const context: RequestContext = {
      db,
      requestId: 'synthetic-noc',
      userId: societyId,
      societyId,
      societyStatus: 'active',
      roles: ['admin'],
      memberships: [],
      enabledModules: new Set(['core', 'tenancy']),
      isDeveloper: false,
      isDeveloperAccount: false,
      mfaVerified: false,
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };
    const preparation = tenancyNocPreparationSchema.parse({
      status: 'prepared',
      expected_version: 4,
      snapshot,
      path: `${societyId}/moves/${societyId}/noc/${societyId}.pdf`,
    });
    if (preparation.status !== 'prepared')
      throw new Error('Invalid synthetic preparation.');
    await expect(
      storePreparedTenancyNoc(context, preparation),
    ).resolves.toEqual(await tenancyNocPdf(snapshot));
    expect(upload).toHaveBeenCalledWith(
      preparation.path,
      expect.any(Uint8Array),
      { contentType: 'application/pdf', upsert: false },
    );
    download.mockResolvedValueOnce({
      data: new Blob(['Wrong PDF']),
      error: null,
    });
    await expect(
      storePreparedTenancyNoc(context, preparation),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      reason: 'invalid_state',
    });
    upload.mockResolvedValueOnce({ data: null, error: { statusCode: '503' } });
    await expect(storePreparedTenancyNoc(context, preparation)).rejects.toThrow(
      'Could not store the prepared NOC PDF.',
    );
    expect(download).toHaveBeenCalledTimes(2);
    upload.mockClear();
    await expect(
      storePreparedTenancyNoc(context, {
        ...preparation,
        snapshot: { ...snapshot, tenant_name: '\u0928\u093e\u092e' },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(upload).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('attests only exact immutable PDF bytes within the verified move scope', async () => {
    const bytes = await tenancyNocPdf(snapshot);
    const input = {
      societyId,
      moveId: societyId,
      issuerId: societyId,
      path: `${societyId}/moves/${societyId}/noc/${societyId}.pdf`,
      expectedVersion: 4,
      expectedBytes: bytes,
      requestId: 'synthetic-noc-verification',
    };
    privilegedMocks.download.mockReset().mockResolvedValue({
      data: new Blob([Buffer.from(bytes)]),
      error: null,
    });
    privilegedMocks.rpc.mockReset().mockResolvedValue(null);
    await attestTenancyNocPrivileged(input);
    expect(privilegedMocks.rpc).toHaveBeenCalledWith(
      expect.any(Object),
      'tenancy_noc_attest',
      {
        p_society_id: societyId,
        p_move_id: societyId,
        p_issuer_id: societyId,
        p_path: input.path,
        p_expected_version: 4,
        p_request_id: input.requestId,
      },
    );
    privilegedMocks.rpc.mockClear();
    for (const path of [
      input.path.replace('/noc/', '/rental_agreement/'),
      input.path.replace(societyId, '5a696d6f-774c-41d1-ae47-6254d4a8f4cf'),
    ]) {
      await expect(
        attestTenancyNocPrivileged({ ...input, path }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }
    expect(privilegedMocks.download).toHaveBeenCalledOnce();
    privilegedMocks.download.mockResolvedValueOnce({
      data: new Blob(['Substituted PDF']),
      error: null,
    });
    await expect(attestTenancyNocPrivileged(input)).rejects.toMatchObject({
      code: 'CONFLICT',
      reason: 'invalid_state',
    });
    privilegedMocks.download.mockResolvedValueOnce({
      data: null,
      error: new Error('Synthetic storage failure'),
    });
    await expect(attestTenancyNocPrivileged(input)).rejects.toThrow(
      'Could not verify the stored NOC PDF.',
    );
    expect(privilegedMocks.rpc).not.toHaveBeenCalled();
  });
});
