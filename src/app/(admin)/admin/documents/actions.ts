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
  saveGovernanceRecord,
  saveDocumentFolder,
  setGovernanceRecordArchived,
  setDocumentArchived,
  setDocumentFolderArchived,
  setDocumentVersionArchived,
  updateDocument,
  updateDocumentReminderSettings,
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

export async function saveGovernanceRecordAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await saveGovernanceRecord(readModuleActionInput(form), requestId);
    return 'Governance record saved. It remains factual and is not a legal-compliance finding.';
  });
}

export async function setGovernanceRecordArchivedAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    const record = await setGovernanceRecordArchived(
      readModuleActionInput(form),
      requestId,
    );
    return record.archivedAt
      ? 'Record archived. Its private history was kept.'
      : 'Record restored as a draft. Recheck its evidence before verifying it.';
  });
}

export async function updateDocumentReminderSettingsAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await updateDocumentReminderSettings(
      readModuleActionInput(form),
      requestId,
    );
    return 'Document expiry reminder setting saved.';
  });
}
