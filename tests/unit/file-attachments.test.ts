// Verify attach-time metadata rechecks for private society logo objects.
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/core/errors';
import {
  SOCIETY_LOGO_CONTENT_TYPES,
  verifyFileAttachment,
} from '../../src/core/files/attachments';
import type { RequestContext } from '../../src/core/tenancy/request-context';

vi.mock('server-only', () => ({}));

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const path = `${societyId}/logos/44a696d6-774c-41d1-ae47-6254d4a8f4cf.png`;

function contextFor(list: ReturnType<typeof vi.fn>) {
  return {
    db: {
      storage: {
        from: () => ({ list }),
      },
    },
  } as unknown as RequestContext;
}

describe('verifyFileAttachment', () => {
  it('accepts only an existing allowed object with matching metadata', async () => {
    const list = vi.fn().mockResolvedValue({
      data: [
        {
          name: path.split('/').at(-1),
          metadata: { mimetype: 'image/png', size: 8192 },
        },
      ],
      error: null,
    });

    await expect(
      verifyFileAttachment(contextFor(list), {
        bucket: 'society-assets',
        contentTypes: SOCIETY_LOGO_CONTENT_TYPES,
        ownerPath: `${societyId}/logos`,
        path,
        societyId,
      }),
    ).resolves.toEqual({ contentType: 'image/png', sizeBytes: 8192 });
    expect(list).toHaveBeenCalledWith(`${societyId}/logos`, {
      limit: 3,
      search: path.split('/').at(-1),
    });
  });

  it('can recheck another bucket when the owning operation supplies its exact path', async () => {
    const requestId = '7a696d6f-774c-41d1-ae47-6254d4a8f4cf';
    const requestPath = `${societyId}/${requestId}/receipt.pdf`;
    const list = vi.fn().mockResolvedValue({
      data: [
        {
          name: 'receipt.pdf',
          metadata: { mimetype: 'application/pdf', size: 900 },
        },
      ],
      error: null,
    });

    await expect(
      verifyFileAttachment(contextFor(list), {
        bucket: 'request-files',
        contentTypes: ['application/pdf'],
        ownerPath: `${societyId}/${requestId}`,
        path: requestPath,
        societyId,
      }),
    ).resolves.toEqual({ contentType: 'application/pdf', sizeBytes: 900 });
  });

  it('rejects missing objects, disallowed types and actual oversize objects', async () => {
    const missing = vi.fn().mockResolvedValue({ data: [], error: null });
    await expect(
      verifyFileAttachment(contextFor(missing), {
        bucket: 'society-assets',
        contentTypes: SOCIETY_LOGO_CONTENT_TYPES,
        ownerPath: `${societyId}/logos`,
        path,
        societyId,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    for (const metadata of [
      { mimetype: 'application/pdf', size: 200 },
      { mimetype: 'image/png', size: 5 * 1024 * 1024 + 1 },
    ]) {
      const list = vi.fn().mockResolvedValue({
        data: [{ name: path.split('/').at(-1), metadata }],
        error: null,
      });
      await expect(
        verifyFileAttachment(contextFor(list), {
          bucket: 'society-assets',
          contentTypes: SOCIETY_LOGO_CONTENT_TYPES,
          ownerPath: `${societyId}/logos`,
          path,
          societyId,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    }
  });

  it('rejects a path whose society prefix or MIME extension does not match', async () => {
    const list = vi.fn();
    await expect(
      verifyFileAttachment(contextFor(list), {
        bucket: 'society-assets',
        contentTypes: SOCIETY_LOGO_CONTENT_TYPES,
        ownerPath: `${societyId}/logos`,
        path: path.replace(societyId, '7a696d6f-774c-41d1-ae47-6254d4a8f4cf'),
        societyId,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const wrongExtension = vi.fn().mockResolvedValue({
      data: [
        {
          name: path.split('/').at(-1),
          metadata: { mimetype: 'image/jpeg', size: 200 },
        },
      ],
      error: null,
    });
    await expect(
      verifyFileAttachment(contextFor(wrongExtension), {
        bucket: 'society-assets',
        contentTypes: SOCIETY_LOGO_CONTENT_TYPES,
        ownerPath: `${societyId}/logos`,
        path,
        societyId,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
