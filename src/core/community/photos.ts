// Issue private community photo upload links and sign view links only for photos the caller may see.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError } from '../errors';
import type { RequestContext } from '../tenancy/request-context';
import {
  communityPhotoPathSchema,
  communityPhotoUploadInputSchema,
  type CommunityPhotoUploadResult,
} from './validation';

export const COMMUNITY_PHOTO_BUCKET = 'community-photos';
const VIEW_SECONDS = 300;

export type CommunityPhotoUrls = Readonly<Record<string, string>>;

export async function issueCommunityPhotoUpload(
  context: RequestContext,
  societyId: string,
  input: unknown,
): Promise<CommunityPhotoUploadResult> {
  const file = parseModuleInput(communityPhotoUploadInputSchema, input);
  const path = await callModuleRpc(
    context,
    'community_photo_upload_path',
    {
      p_society_id: societyId,
      p_content_type: file.contentType,
      p_size_bytes: file.sizeBytes,
    },
    communityPhotoPathSchema,
    'The photo upload is unavailable. Use a JPG or PNG up to 5 MiB.',
  );
  const { data, error } = await context.db.storage
    .from(COMMUNITY_PHOTO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error('Could not issue the community photo upload token.', {
      cause: error,
    });
  }
  return { path, signedUrl: data.signedUrl };
}

async function verifiedPaths(
  context: RequestContext,
  societyId: string,
  paths: readonly string[],
) {
  const checks = await Promise.all(
    paths.map(async (path) => {
      if (path.split('/')[0] !== societyId) throw new AppError('FORBIDDEN');
      const allowed = await callModuleRpc(
        context,
        'community_photo_access',
        { p_society_id: societyId, p_path: path },
        z.boolean(),
        'Could not verify access to this photo. Refresh and retry.',
      );
      return allowed ? path : null;
    }),
  );
  return checks.filter((path): path is string => path !== null);
}

// Detail pages check each path through the database; lists rely on the bucket's read policy for the caller.
export async function signCommunityPhotos(
  context: RequestContext,
  societyId: string,
  paths: readonly string[],
  { verify }: { verify: boolean },
): Promise<CommunityPhotoUrls> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return {};
  const allowed = verify
    ? await verifiedPaths(context, societyId, unique)
    : unique.filter((path) => path.split('/')[0] === societyId);
  if (allowed.length === 0) return {};
  const { data, error } = await context.db.storage
    .from(COMMUNITY_PHOTO_BUCKET)
    .createSignedUrls(allowed, VIEW_SECONDS);
  if (error || !data) return {};
  const urls: Record<string, string> = {};
  for (const entry of data) {
    if (!entry.error && entry.path && entry.signedUrl) {
      urls[entry.path] = entry.signedUrl;
    }
  }
  return urls;
}
