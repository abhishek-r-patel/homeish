// Run Asset Register changes through audited operations and the shared action envelope.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  addAssetMaintenance,
  removeAssetMaintenance,
  saveAsset,
  saveAssetCategory,
  setAssetCategoryActive,
} from '@/core/asset/operations';

const ROUTE = '/admin/assets';

export async function saveAssetCategoryAction(form: FormData) {
  return runServerAction<string>(ROUTE, async (requestId) => ({
    data: await saveAssetCategory(readModuleActionInput(form), requestId),
    message: 'Category saved.',
  }));
}

export async function setAssetCategoryActiveAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await setAssetCategoryActive(readModuleActionInput(form), requestId);
    return 'Category updated. Inactive categories cannot be chosen for new assets.';
  });
}

export async function saveAssetAction(form: FormData) {
  return runServerAction<string>(ROUTE, async (requestId) => ({
    data: await saveAsset(readModuleActionInput(form), requestId),
    message: 'Asset saved.',
  }));
}

export async function addAssetMaintenanceAction(form: FormData) {
  return runServerAction<string>(ROUTE, async (requestId) => ({
    data: await addAssetMaintenance(readModuleActionInput(form), requestId),
    message: 'Maintenance entry added.',
  }));
}

export async function removeAssetMaintenanceAction(form: FormData) {
  return runServerAction(ROUTE, async (requestId) => {
    await removeAssetMaintenance(readModuleActionInput(form), requestId);
    return 'Maintenance entry removed. The change is kept in the audit log.';
  });
}
