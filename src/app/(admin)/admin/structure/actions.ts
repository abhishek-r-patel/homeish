// Authorize and validate structure changes at the server-action boundary.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  createBlock,
  createUnit,
  setBlockActive,
  setUnitActive,
  updateBlock,
  updateUnit,
} from '@/core/structure/operations';
import {
  confirmUnitsImport,
  previewUnitsImport,
} from '@/core/structure/units-csv';
import { ValidationError } from '@/core/errors';
import { saveUnitRecord } from '@/core/structure/unit-workspace';
import {
  placeBuildingUnit,
  saveBuildingLayout,
} from '@/core/structure/building-layout-operations';

export async function saveBuildingLayoutAction(
  blockId: string | null,
  clientRequestId: string,
  payload: unknown,
) {
  return runServerAction('structure.layout.save', async (requestId) => {
    const id = await saveBuildingLayout(
      blockId,
      clientRequestId,
      payload,
      requestId,
    );
    revalidatePath('/admin/structure');
    return { message: 'Building layout saved.', data: id };
  });
}

export async function placeBuildingUnitAction(
  unitId: string,
  clientRequestId: string,
  payload: unknown,
) {
  return runServerAction('structure.layout.place', async (requestId) => {
    await placeBuildingUnit(unitId, clientRequestId, payload, requestId);
    revalidatePath(`/admin/structure/units/${unitId}`);
    revalidatePath('/admin/structure');
    return 'Unit placement saved.';
  });
}

export async function saveUnitRecordAction(
  unitId: string,
  clientRequestId: string,
  payload: unknown,
) {
  return runServerAction('structure.units.saveRecord', async (requestId) => {
    await saveUnitRecord(unitId, clientRequestId, payload, requestId);
    revalidatePath(`/admin/structure/units/${unitId}`);
    return 'Unit record saved.';
  });
}

export async function createBlockAction(formData: FormData) {
  return runServerAction('structure.blocks.create', async () => {
    await createBlock(formData);
    revalidatePath('/admin/structure');
    return 'Block created.';
  });
}

export async function setBlockActiveAction(formData: FormData) {
  return runServerAction('structure.blocks.update', async () => {
    await setBlockActive(formData);
    revalidatePath('/admin/structure');
    return 'Block status updated.';
  });
}

export async function updateBlockAction(formData: FormData) {
  return runServerAction('structure.blocks.update', async () => {
    await updateBlock(formData);
    revalidatePath('/admin/structure');
    return 'Block details saved.';
  });
}

export async function createUnitAction(formData: FormData) {
  return runServerAction('structure.units.create', async () => {
    await createUnit(formData);
    revalidatePath('/admin/structure');
    return 'Unit created.';
  });
}

export async function updateUnitAction(formData: FormData) {
  return runServerAction('structure.units.update', async () => {
    await updateUnit(formData);
    revalidatePath('/admin/structure');
    return 'Unit details saved.';
  });
}

export async function setUnitActiveAction(formData: FormData) {
  return runServerAction('structure.units.deactivate', async () => {
    await setUnitActive(formData);
    revalidatePath('/admin/structure');
    return 'Unit status updated.';
  });
}

export async function previewUnitsImportAction(csv: string) {
  return runServerAction('structure.units.importPreview', async () => {
    if (typeof csv !== 'string') {
      throw new ValidationError({ file: 'Choose a CSV file to preview.' });
    }
    return { data: await previewUnitsImport(csv) };
  });
}

export async function confirmUnitsImportAction(csv: string) {
  return runServerAction('structure.units.importConfirm', async (requestId) => {
    if (typeof csv !== 'string') {
      throw new ValidationError({ file: 'Choose a CSV file to import.' });
    }
    const jobId = await confirmUnitsImport(csv, requestId);
    revalidatePath('/admin/structure');
    revalidatePath('/admin/jobs');
    return {
      message: 'Import completed. Review the job results.',
      data: jobId,
    };
  });
}
