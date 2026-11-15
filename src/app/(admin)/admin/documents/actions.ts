// Run admin document changes through audited operations and the shared action envelope.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import { prepareDocumentUpload } from '@/core/document/files';
import {
  addDocumentVersion,
  createDocument,
  saveDocumentFolder,
  setDocumentArchived,
  setDocumentFolderArchived,
  setDocumentVersionArchived,
  updateDocument,
} from '@/core/document/operations';

const ROUTE = '/admin/documents';

export async function prepareDocumentUploadAction(form: FormData) {
  return runServerAction<{ path: string; signedUrl: string }>(
    ROUTE,
    async (requestId) => ({
      data: await prepareDocumentUpload(readModuleActionInput(form), requestId),
    }),
  );
}

export async function saveDocumentFolderAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await saveDocumentFolder(readModuleActionInput(form), requestId);
    return 'Folder saved. Documents in it now follow this audience.';
  });
}

export async function setDocumentFolderArchivedAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    const folder = await setDocumentFolderArchived(
      readModuleActionInput(form),
      requestId,
    );
    return folder.archived_at
      ? 'Folder archived. Residents no longer see it; nothing was deleted.'
      : 'Folder restored.';
  });
}

export async function createDocumentAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await createDocument(readModuleActionInput(form), requestId);
    return 'Document published. Its audience has been notified.';
  });
}

export async function addDocumentVersionAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await addDocumentVersion(readModuleActionInput(form), requestId);
    return 'New version published. Earlier versions remain in the history.';
  });
}

export async function updateDocumentAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await updateDocument(readModuleActionInput(form), requestId);
    return 'Document details saved.';
  });
}

export async function setDocumentArchivedAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    const document = await setDocumentArchived(
      readModuleActionInput(form),
      requestId,
    );
    return document.archived_at
      ? 'Document archived. Residents no longer see it; nothing was deleted.'
      : 'Document restored.';
  });
}

export async function setDocumentVersionArchivedAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await setDocumentVersionArchived(readModuleActionInput(form), requestId);
    return 'Version updated. Residents see the latest active version.';
  });
}
