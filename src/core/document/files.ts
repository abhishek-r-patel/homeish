// Issue private document upload tokens and audited, short-lived download links.
import 'server-only';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { enforceRateLimit } from '../rate-limit';
import { getDocumentContext } from './operations';
import { documentUploadPath } from './presentation';
import {
  documentDownloadInputSchema,
  documentDownloadSchema,
  documentUploadInputSchema,
} from './validation';

export const DOCUMENT_BUCKET = 'document-files';
export const DOCUMENT_LINK_SECONDS = 300;

export async function prepareDocumentUpload(input: unknown, requestId: string) {
  const { context, societyId } = await getDocumentContext(
    'document:manage',
    true,
    requestId,
  );
  const upload = parseModuleInput(documentUploadInputSchema, input);
  await enforceRateLimit(
    'fileUploadUserHourly',
    context.userId,
    context.requestId,
  );
  const path = documentUploadPath(
    societyId,
    upload.contentType,
    crypto.randomUUID(),
  );
  const { data, error } = await context.db.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error('Could not issue the document upload token.', {
      cause: error,
    });
  }
  return { path, signedUrl: data.signedUrl };
}

export async function createDocumentDownloadLink(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getDocumentContext(
    'document:list',
    false,
    requestId,
  );
  const { versionId } = parseModuleInput(documentDownloadInputSchema, input);
  await enforceRateLimit(
    'otherWritesUserMinute',
    context.userId,
    context.requestId,
  );
  const file = await callModuleRpc(
    context,
    'document_download_issue',
    {
      p_society_id: societyId,
      p_version_id: versionId,
      p_request_id: context.requestId,
    },
    documentDownloadSchema,
    'Could not open this document. Refresh and retry.',
  );
  const { data, error } = await context.db.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(file.path, DOCUMENT_LINK_SECONDS, {
      download: file.file_name,
    });
  if (error || !data) {
    throw new Error('Could not issue the document link.', { cause: error });
  }
  return {
    signedUrl: data.signedUrl,
    expiresIn: DOCUMENT_LINK_SECONDS,
    fileName: file.file_name,
  };
}
