// Issue private vendor upload tokens and audited, short-lived download links.
import 'server-only';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { enforceRateLimit } from '../rate-limit';
import { getVendorContext } from './operations';
import { vendorUploadPath } from './presentation';
import {
  vendorFileInputSchema,
  vendorFileIssueSchema,
  vendorUploadInputSchema,
} from './validation';

export const VENDOR_BUCKET = 'vendor-files';
export const VENDOR_LINK_SECONDS = 300;

/** Admins upload vendor documents; admins and committee upload quote files. */
export async function prepareVendorUpload(
  input: unknown,
  purpose: 'document' | 'quote',
  requestId: string,
) {
  const { context, societyId } = await getVendorContext(
    purpose === 'document' ? 'vendor:manage' : 'vendor:request',
    true,
    requestId,
  );
  const upload = parseModuleInput(vendorUploadInputSchema, input);
  await enforceRateLimit(
    'fileUploadUserHourly',
    context.userId,
    context.requestId,
  );
  const path = vendorUploadPath(
    societyId,
    context.userId,
    upload.contentType,
    crypto.randomUUID(),
  );
  const { data, error } = await context.db.storage
    .from(VENDOR_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error('Could not issue the vendor upload token.', {
      cause: error,
    });
  }
  return { path, signedUrl: data.signedUrl };
}

export async function createVendorFileLink(input: unknown, requestId: string) {
  const { context, societyId } = await getVendorContext(
    'vendor:list',
    false,
    requestId,
  );
  const { path } = parseModuleInput(vendorFileInputSchema, input);
  await enforceRateLimit(
    'otherWritesUserMinute',
    context.userId,
    context.requestId,
  );
  const file = await callModuleRpc(
    context,
    'vendor_file_issue',
    { p_society_id: societyId, p_path: path, p_request_id: context.requestId },
    vendorFileIssueSchema,
    'Could not open this file. Refresh and retry.',
  );
  const { data, error } = await context.db.storage
    .from(VENDOR_BUCKET)
    .createSignedUrl(file.path, VENDOR_LINK_SECONDS, {
      download: file.file_name,
    });
  if (error || !data) {
    throw new Error('Could not issue the vendor file link.', { cause: error });
  }
  return {
    signedUrl: data.signedUrl,
    expiresIn: VENDOR_LINK_SECONDS,
    fileName: file.file_name,
  };
}
