// Expose the shared P56 CSV preview and atomic save boundary.
'use server';

import { runServerAction } from '@/core/actions/server-action';
import {
  previewBulkImport,
  saveBulkImport,
} from '@/core/csv/bulk-import-operations';

export async function previewBulkImportAction(input: unknown) {
  return runServerAction('import.preview', async () => ({
    data: await previewBulkImport(input),
  }));
}

export async function saveBulkImportAction(input: unknown) {
  return runServerAction('import.save', async () => ({
    data: await saveBulkImport(input),
    message: 'Import saved. Every row was added together.',
  }));
}
