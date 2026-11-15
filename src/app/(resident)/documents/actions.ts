// Issue audited, short-lived document links through the shared action envelope.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import { createDocumentDownloadLink } from '@/core/document/files';

export async function documentDownloadAction(form: FormData) {
  return runServerAction<{
    signedUrl: string;
    expiresIn: number;
    fileName: string;
  }>('/documents', async (requestId) => ({
    data: await createDocumentDownloadLink(
      readModuleActionInput(form),
      requestId,
    ),
  }));
}
