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
import { saveBulkImport } from '@/core/csv/bulk-import-operations';
import { previewUnitsImport } from '@/core/structure/units-csv';
import { ValidationError } from '@/core/errors';
import { saveUnitRecord } from '@/core/structure/unit-workspace';
import {
  placeBuildingUnit,
  saveBuildingLayout,
} from '@/core/structure/building-layout-operations';
import {
  addUnitHandoverPhoto,
  acknowledgeUnitHandover,
  closeUnitHandover,
  createUnitHandover,
  linkUnitHandoverReading,
  saveUnitHandoverItems,
  saveUnitHandoverTemplate,
} from '@/core/structure/handover-operations';

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

export async function saveUnitHandoverTemplateAction(
  unitId: string,
  payload: unknown,
) {
  return runServerAction(
    'structure.handover.template.save',
    async (requestId) => {
      await saveUnitHandoverTemplate(payload, requestId);
      revalidatePath(`/admin/structure/units/${unitId}`);
      return 'Handover checklist saved.';
    },
  );
}

export async function createUnitHandoverAction(
  unitId: string,
  payload: unknown,
) {
  return runServerAction<string>(
    'structure.handover.create',
    async (requestId) => {
      const id = await createUnitHandover(payload, requestId);
      revalidatePath(`/admin/structure/units/${unitId}`);
      return { data: id, message: 'Unit handover created.' };
    },
  );
}

export async function saveUnitHandoverItemsAction(
  unitId: string,
  payload: unknown,
) {
  return runServerAction('structure.handover.items.save', async (requestId) => {
    await saveUnitHandoverItems(payload, requestId);
    revalidatePath(`/admin/structure/units/${unitId}`);
    return 'Handover checklist saved.';
  });
}

export async function linkUnitHandoverReadingAction(
  unitId: string,
  payload: unknown,
) {
  return runServerAction(
    'structure.handover.reading.link',
    async (requestId) => {
      await linkUnitHandoverReading(payload, requestId);
      revalidatePath(`/admin/structure/units/${unitId}`);
      return 'Meter reading linked.';
    },
  );
}

export async function addUnitHandoverPhotoAction(
  unitId: string,
  payload: unknown,
) {
  return runServerAction('structure.handover.photo.add', async (requestId) => {
    await addUnitHandoverPhoto(payload, requestId);
    revalidatePath(`/admin/structure/units/${unitId}`);
    return 'Handover file attached.';
  });
}

export async function acknowledgeUnitHandoverAction(payload: unknown) {
  return runServerAction(
    'structure.handover.acknowledge',
    async (requestId) => {
      await acknowledgeUnitHandover(payload, requestId);
      return 'Handover acknowledged.';
    },
  );
}

export async function closeUnitHandoverAction(
  unitId: string,
  payload: unknown,
) {
  return runServerAction('structure.handover.close', async (requestId) => {
    await closeUnitHandover(payload, requestId);
    revalidatePath(`/admin/structure/units/${unitId}`);
    return 'Unit handover closed.';
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
  return runServerAction('structure.units.importConfirm', async () => {
    if (typeof csv !== 'string') {
      throw new ValidationError({ file: 'Choose a CSV file to import.' });
    }
    const jobId = await saveBulkImport({ kind: 'units', csv });
    revalidatePath('/admin/structure');
    revalidatePath('/admin/jobs');
    return {
      message: 'Import completed. Review the job results.',
      data: jobId,
    };
  });
}
