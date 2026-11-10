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
});
