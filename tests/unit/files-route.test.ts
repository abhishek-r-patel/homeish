// Verify same-origin file routes enforce owner, count, type and URL lifetimes.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  createSignedUrl: vi.fn(),
  enforceRateLimit: vi.fn(),
  list: vi.fn(),
  logUnexpectedError: vi.fn(),
  maybeSingle: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
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

import {
  DELETE as deleteUpload,
  POST as issueUpload,
} from '../../src/app/api/files/upload-url/route';
import { POST as issueView } from '../../src/app/api/files/url/route';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const otherSocietyId = '7a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const path = `${societyId}/logos/44a696d6-774c-41d1-ae47-6254d4a8f4cf.png`;
const deliveryPhotoPath = `${societyId}/6a696d6f-774c-41d1-ae47-6254d4a8f4cf/deliveries/44a696d6-774c-41d1-ae47-6254d4a8f4cf.png`;

function request(
  url: string,
  body: unknown,
  method = 'POST',
  origin = 'https://homeish.test',
) {
  return new Request(`https://homeish.test${url}`, {
    method,
    headers: {
      origin,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function responseBody(response: Response) {
  return response.json() as Promise<{
    ok: boolean;
    data?: { expiresIn?: number; path?: string; signedUrl?: string };
    error?: { code: string };
  }>;
}

describe('private file URL routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.maybeSingle.mockResolvedValue({
      data: { id: societyId, logo_path: null },
      error: null,
    });
    mocks.list.mockResolvedValue({ data: [], error: null });
    mocks.createSignedUploadUrl.mockImplementation(
      async (uploadPath: string) => ({
        data: {
          path: uploadPath,
          signedUrl: 'https://storage.test/signed-upload',
        },
        error: null,
      }),
    );
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.test/signed-view' },
      error: null,
    });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.logUnexpectedError.mockResolvedValue('safe-reference');
    mocks.buildRequestContext.mockResolvedValue({
      db: {
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: mocks.maybeSingle }),
          }),
        }),
        storage: {
          from: () => ({
            createSignedUploadUrl: mocks.createSignedUploadUrl,
            createSignedUrl: mocks.createSignedUrl,
            list: mocks.list,
            remove: mocks.remove,
          }),
        },
      },
      isDeveloperAccount: true,
      isDeveloper: true,
      mfaVerified: true,
      memberships: [],
      roles: [],
      societyId: null,
      societyStatus: null,
      requestId: 'test-request-id',
      userId: '4a696d6f-774c-41d1-ae47-6254d4a8f4cf',
      enabledModules: new Set(),
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
  });

  it('issues a private logo upload link after owner, type, size and count checks', async () => {
    const response = await issueUpload(
      request('/api/files/upload-url', {
        bucket: 'society-assets',
        contentType: 'image/png',
        sizeBytes: 1200,
        societyId,
      }),
    );

    expect(response.status).toBe(200);
    expect((await responseBody(response)).data).toMatchObject({
      path: expect.stringMatching(new RegExp(`^${societyId}/logos/.*\\.png$`)),
      signedUrl: 'https://storage.test/signed-upload',
    });
    expect(mocks.createSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${societyId}/logos/.*\\.png$`)),
    );
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'fileUploadUserHourly',
      societyId,
      'test-request-id',
    );
  });
  it('issues owner-scoped AMC PDF uploads only to admins with the module enabled', async () => {
    const base = await mocks.buildRequestContext();
    const context = {
      ...base,
      isDeveloper: false,
      isDeveloperAccount: false,
      roles: ['admin'],
      societyId,
      societyStatus: 'active',
      memberships: [{ societyId, roles: ['admin'] }],
      enabledModules: new Set(['amc']),
    };
    mocks.buildRequestContext.mockResolvedValue(context);
    const body = {
      bucket: 'amc-files',
      contentType: 'application/pdf',
      sizeBytes: 50,
      requestId: societyId,
    };
    const allowed = await issueUpload(request('/api/files/upload-url', body));
    expect(allowed.status).toBe(200);
    expect((await responseBody(allowed)).data?.path).toMatch(
      new RegExp(`^${societyId}/${context.userId}/amc/[0-9a-f-]+\\.pdf$`),
    );
    for (const roles of [['committee'], ['resident']]) {
      mocks.buildRequestContext.mockResolvedValue({ ...context, roles });
      expect(
        (await issueUpload(request('/api/files/upload-url', body))).status,
      ).toBe(403);
    }
    mocks.buildRequestContext.mockResolvedValue({
      ...context,
      enabledModules: new Set(),
    });
    expect(
      (await issueUpload(request('/api/files/upload-url', body))).status,
    ).toBe(403);
    expect(mocks.createSignedUploadUrl).toHaveBeenCalledTimes(1);
  });

  it('lets residents delete only their own unreferenced staff photos', async () => {
    const userId = '8a696d6f-774c-41d1-ae47-6254d4a8f4cf';
    const otherUploaderId = '9a696d6f-774c-41d1-ae47-6254d4a8f4cf';
    const staffPhotoPath = `${societyId}/staff/${userId}/44a696d6-774c-41d1-ae47-6254d4a8f4cf.png`;
    mocks.buildRequestContext.mockResolvedValue({
      db: {
        storage: {
          from: () => ({ remove: mocks.remove }),
        },
      },
      isDeveloperAccount: false,
      isDeveloper: false,
      mfaVerified: false,
      memberships: [],
      roles: ['resident'],
      societyId,
      societyStatus: 'active',
      requestId: 'test-request-id',
      userId,
      enabledModules: new Set(['staff']),
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    mocks.remove.mockResolvedValueOnce({
      data: [{ name: staffPhotoPath }],
      error: null,
    });

    const allowed = await deleteUpload(
      request(
        '/api/files/upload-url',
        { bucket: 'staff-photos', path: staffPhotoPath },
        'DELETE',
      ),
    );
    expect(allowed.status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith([staffPhotoPath]);

    const denied = await deleteUpload(
      request(
        '/api/files/upload-url',
        {
          bucket: 'staff-photos',
          path: `${societyId}/staff/${otherUploaderId}/44a696d6-774c-41d1-ae47-6254d4a8f4cf.png`,
        },
        'DELETE',
      ),
    );
    expect(denied.status).toBe(403);
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  function billingContext(roles = ['admin'], enabled = true) {
    mocks.buildRequestContext.mockResolvedValue({
      db: {
        rpc: mocks.rpc,
        storage: {
          from: () => ({
            createSignedUploadUrl: mocks.createSignedUploadUrl,
            createSignedUrl: mocks.createSignedUrl,
            list: mocks.list,
            remove: mocks.remove,
          }),
        },
      },
      isDeveloperAccount: false,
      isDeveloper: false,
      mfaVerified: false,
      memberships: [{ societyId, roles }],
      roles,
      societyId,
      societyStatus: 'active',
      requestId: 'billing-file-test',
      userId: societyId,
      enabledModules: new Set(enabled ? ['billing'] : []),
    });
  }

  it('scopes billing QR uploads to a writable enabled society and limits pending files', async () => {
    billingContext();
    const body = {
      bucket: 'society-assets',
      purpose: 'billing-qr',
      contentType: 'image/png',
      sizeBytes: 1200,
      societyId,
    };
    const response = await issueUpload(request('/api/files/upload-url', body));
    expect(response.status).toBe(200);
    expect((await responseBody(response)).data?.path).toMatch(
      new RegExp(`^${societyId}/billing-qr/.*\\.png$`),
    );
    mocks.list.mockResolvedValueOnce({
      data: [{ name: 'unused.png' }],
      error: null,
    });
    expect(
      (await issueUpload(request('/api/files/upload-url', body))).status,
    ).toBe(409);
    expect(
      (
        await issueUpload(
          request('/api/files/upload-url', {
            ...body,
            societyId: otherSocietyId,
          }),
        )
      ).status,
    ).toBe(403);
    billingContext(['committee']);
    expect(
      (await issueUpload(request('/api/files/upload-url', body))).status,
    ).toBe(403);
    billingContext(['admin'], false);
    expect(
      (
        await responseBody(
          await issueUpload(request('/api/files/upload-url', body)),
        )
      ).error?.code,
    ).toBe('MODULE_DISABLED');
  });

  it('allows members to view only the published QR and prevents removing an attached image', async () => {
    const qrPath = `${societyId}/billing-qr/44a696d6-774c-41d1-ae47-6254d4a8f4cf.png`;
    const otherQrPath = `${societyId}/billing-qr/54a696d6-774c-41d1-ae47-6254d4a8f4cf.png`;
    mocks.rpc.mockResolvedValue({
      data: {
        society_id: societyId,
        upi_id: 'homeish-test@example',
        payee_name: 'Synthetic Society',
        qr_path: qrPath,
        updated_at: '2026-11-10T12:00:00.123456+00:00',
        updated_by: societyId,
        updated_by_name: 'Test Admin',
      },
      error: null,
    });
    billingContext(['resident']);
    expect(
      (
        await issueView(
          request('/api/files/url', {
            bucket: 'society-assets',
            path: qrPath,
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await issueView(
          request('/api/files/url', {
            bucket: 'society-assets',
            path: otherQrPath,
          }),
        )
      ).status,
    ).toBe(403);
    billingContext();
    expect(
      (
        await deleteUpload(
          request(
            '/api/files/upload-url',
            { bucket: 'society-assets', path: qrPath },
            'DELETE',
          ),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await deleteUpload(
          request(
            '/api/files/upload-url',
            { bucket: 'society-assets', path: otherQrPath },
            'DELETE',
          ),
        )
      ).status,
    ).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith([otherQrPath]);
  });

  it('issues a private delivery photo link only for an active delivery unit', async () => {
    mocks.buildRequestContext.mockResolvedValueOnce({
      db: {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
            }),
          }),
        }),
        storage: {
          from: () => ({
            createSignedUploadUrl: mocks.createSignedUploadUrl,
          }),
        },
      },
      isDeveloperAccount: false,
      isDeveloper: false,
      mfaVerified: false,
      memberships: [],
      roles: ['guard'],
      societyId,
      societyStatus: 'active',
      userId: '4a696d6f-774c-41d1-ae47-6254d4a8f4cf',
      enabledModules: new Set(['delivery']),
    });

    const response = await issueUpload(
      request('/api/files/upload-url', {
        bucket: 'delivery-photos',
        contentType: 'image/png',
        sizeBytes: 1200,
        unitId: '6a696d6f-774c-41d1-ae47-6254d4a8f4cf',
      }),
    );

    expect(response.status).toBe(200);
    expect((await responseBody(response)).data).toMatchObject({
      path: expect.stringMatching(
        new RegExp(
          `^${societyId}/6a696d6f-774c-41d1-ae47-6254d4a8f4cf/deliveries/.*\\.png$`,
        ),
      ),
      signedUrl: 'https://storage.test/signed-upload',
    });
  });

  it('issues owner-scoped request photo links only for enabled request access', async () => {
    const userId = '8a696d6f-774c-41d1-ae47-6254d4a8f4cf';
    const requestId = '9a696d6f-774c-41d1-ae47-6254d4a8f4cf';
    mocks.buildRequestContext.mockResolvedValue({
      db: {
        storage: {
          from: () => ({ createSignedUploadUrl: mocks.createSignedUploadUrl }),
        },
      },
      isDeveloperAccount: false,
      isDeveloper: false,
      mfaVerified: false,
      memberships: [{ societyId, roles: ['resident'] }],
      roles: ['resident'],
      societyId,
      societyStatus: 'active',
      requestId: 'request-file-test',
      userId,
      enabledModules: new Set(['service_request']),
    });

    const response = await issueUpload(
      request('/api/files/upload-url', {
        bucket: 'request-files',
        contentType: 'image/jpeg',
        sizeBytes: 1200,
        requestId,
      }),
    );

    expect(response.status).toBe(200);
    expect((await responseBody(response)).data?.path).toMatch(
      new RegExp(
        `^${societyId}/${userId}/requests/${requestId}/[0-9a-f-]+\\.jpg$`,
      ),
    );
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'fileUploadUserHourly',
      userId,
      'request-file-test',
    );

    mocks.buildRequestContext.mockResolvedValueOnce({
      db: { storage: { from: vi.fn() } },
      isDeveloperAccount: false,
      isDeveloper: false,
      mfaVerified: false,
      memberships: [{ societyId, roles: ['resident'] }],
      roles: ['resident'],
      societyId,
      societyStatus: 'active',
      userId,
      enabledModules: new Set(),
    });
    const disabled = await issueUpload(
      request('/api/files/upload-url', {
        bucket: 'request-files',
        contentType: 'image/jpeg',
        sizeBytes: 1200,
        requestId,
      }),
    );
    expect(disabled.status).toBe(403);
    expect(mocks.createSignedUploadUrl).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported MIME types, oversize files, cross-origin and excess count', async () => {
    const wrongType = await issueUpload(
      request('/api/files/upload-url', {
        bucket: 'society-assets',
        contentType: 'application/pdf',
        sizeBytes: 1200,
        societyId,
      }),
    );
    const tooLarge = await issueUpload(
      request('/api/files/upload-url', {
        bucket: 'society-assets',
        contentType: 'image/png',
        sizeBytes: 5 * 1024 * 1024 + 1,
        societyId,
      }),
    );
    const crossOrigin = await issueUpload(
      request(
        '/api/files/upload-url',
        {
          bucket: 'society-assets',
          contentType: 'image/png',
          sizeBytes: 1200,
          societyId,
        },
        'POST',
        'https://attacker.test',
      ),
    );
    const oversizedBody = await issueUpload(
      request('/api/files/upload-url', 'x'.repeat(9_000)),
    );
    mocks.list.mockResolvedValueOnce({
      data: [{ name: 'previous-unattached.png' }],
      error: null,
    });
    const excessCount = await issueUpload(
      request('/api/files/upload-url', {
        bucket: 'society-assets',
        contentType: 'image/png',
        sizeBytes: 1200,
        societyId,
      }),
    );

    expect(wrongType.status).toBe(400);
    expect(tooLarge.status).toBe(400);
    expect(crossOrigin.status).toBe(403);
    expect(oversizedBody.status).toBe(400);
    expect(excessCount.status).toBe(409);
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('denies a society the caller cannot manage and does not query its owner', async () => {
    mocks.buildRequestContext.mockResolvedValueOnce({
      db: { from: vi.fn(), storage: { from: vi.fn() } },
      isDeveloperAccount: false,
      isDeveloper: false,
      mfaVerified: false,
      memberships: [],
      roles: ['admin'],
      societyId: otherSocietyId,
      societyStatus: 'active',
    });

    const response = await issueUpload(
      request('/api/files/upload-url', {
        bucket: 'society-assets',
        contentType: 'image/png',
        sizeBytes: 1200,
        societyId,
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('issues five-minute view links only to a member or verified developer', async () => {
    const response = await issueView(
      request('/api/files/url', { bucket: 'society-assets', path }),
    );

    expect(response.status).toBe(200);
    expect((await responseBody(response)).data).toEqual({
      expiresIn: 300,
      signedUrl: 'https://storage.test/signed-view',
    });
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(path, 300);
  });

  it('allows delivery photo views to gate and management roles only', async () => {
    mocks.buildRequestContext.mockResolvedValueOnce({
      db: {
        from: vi.fn(),
        storage: {
          from: () => ({ createSignedUrl: mocks.createSignedUrl }),
        },
      },
      isDeveloperAccount: false,
      isDeveloper: false,
      mfaVerified: false,
      memberships: [],
      roles: ['guard'],
      societyId,
      societyStatus: 'active',
      userId: '4a696d6f-774c-41d1-ae47-6254d4a8f4cf',
      enabledModules: new Set(['delivery']),
    });
    const response = await issueView(
      request('/api/files/url', {
        bucket: 'delivery-photos',
        path: deliveryPhotoPath,
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(deliveryPhotoPath, 300);

    mocks.buildRequestContext.mockResolvedValueOnce({
      db: { from: vi.fn(), storage: { from: vi.fn() } },
      isDeveloperAccount: false,
      isDeveloper: false,
      mfaVerified: false,
      memberships: [],
      roles: ['resident'],
      societyId,
      societyStatus: 'active',
      userId: '4a696d6f-774c-41d1-ae47-6254d4a8f4cf',
      enabledModules: new Set(['delivery']),
    });
    const residentView = await issueView(
      request('/api/files/url', {
        bucket: 'delivery-photos',
        path: deliveryPhotoPath,
      }),
    );
    expect(residentView.status).toBe(403);
    expect(mocks.createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('rejects a path whose society segment contains regular-expression syntax', async () => {
    const response = await issueView(
      request('/api/files/url', {
        bucket: 'society-assets',
        path: ['.*', 'logos', path.split('/').at(-1)].join('/'),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects cross-society view paths and only deletes unattached logo uploads', async () => {
    mocks.buildRequestContext.mockResolvedValueOnce({
      db: {
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: mocks.maybeSingle }),
          }),
        }),
        storage: {
          from: () => ({
            createSignedUrl: mocks.createSignedUrl,
            list: mocks.list,
            remove: mocks.remove,
          }),
        },
      },
      isDeveloperAccount: false,
      isDeveloper: false,
      mfaVerified: false,
      memberships: [{ societyId, roles: ['admin'] }],
      roles: ['admin'],
      societyId,
      societyStatus: 'active',
    });
    const foreignPath = path.replace(societyId, otherSocietyId);
    const deniedView = await issueView(
      request('/api/files/url', {
        bucket: 'society-assets',
        path: foreignPath,
      }),
    );
    expect(deniedView.status).toBe(403);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();

    const attachedPath = await deleteUpload(
      request(
        '/api/files/upload-url',
        { bucket: 'society-assets', path },
        'DELETE',
      ),
    );
    expect(attachedPath.status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith([path]);

    mocks.maybeSingle.mockResolvedValueOnce({
      data: { id: societyId, logo_path: path },
      error: null,
    });
    const denyAttachedDelete = await deleteUpload(
      request(
        '/api/files/upload-url',
        { bucket: 'society-assets', path },
        'DELETE',
      ),
    );
    expect(denyAttachedDelete.status).toBe(409);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });

  it('issues payment proof uploads only for units the caller actively occupies', async () => {
    const unitId = '6a696d6f-774c-41d1-ae47-6254d4a8f4cf';
    const userId = '8a696d6f-774c-41d1-ae47-6254d4a8f4cf';
    const occupancyFilters: [string, unknown][] = [];
    const occupancy = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 'occupant' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    function chain(table: string) {
      const builder = {
        eq: (column: string, value: unknown) => {
          if (table === 'unit_occupants')
            occupancyFilters.push([column, value]);
          return builder;
        },
        limit: () => occupancy(),
        maybeSingle: async () => ({ data: { id: unitId }, error: null }),
        select: () => builder,
      };
      return builder;
    }
    mocks.buildRequestContext.mockResolvedValue({
      db: {
        from: chain,
        storage: {
          from: () => ({ createSignedUploadUrl: mocks.createSignedUploadUrl }),
        },
      },
      isDeveloperAccount: false,
      isDeveloper: false,
      mfaVerified: false,
      memberships: [{ societyId, roles: ['resident'] }],
      roles: ['resident'],
      societyId,
      societyStatus: 'active',
      requestId: 'test-request-id',
      userId,
      enabledModules: new Set(['billing']),
    });
    const body = {
      bucket: 'payment-proofs',
      contentType: 'image/jpeg',
      sizeBytes: 1200,
      unitId,
    };

    const allowed = await issueUpload(request('/api/files/upload-url', body));
    expect(allowed.status).toBe(200);
    expect((await responseBody(allowed)).data?.path).toMatch(
      new RegExp(`^${societyId}/${unitId}/payments/.*\\.jpg$`),
    );
    expect(occupancyFilters).toEqual(
      expect.arrayContaining([
        ['unit_id', unitId],
        ['memberships.user_id', userId],
        ['memberships.status', 'active'],
      ]),
    );
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'billingSubmitUserHourly',
      userId,
      'test-request-id',
    );

    const denied = await issueUpload(request('/api/files/upload-url', body));
    expect(denied.status).toBe(404);
    expect(mocks.createSignedUploadUrl).toHaveBeenCalledTimes(1);
  });
});
