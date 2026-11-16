// Authorise Asset Register operations and validate their transactional database contracts.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  assetCategoryActiveInputSchema,
  assetCategoryInputSchema,
  assetDetailSchema,
  assetFormOptionsSchema,
  assetInputSchema,
  assetMaintenanceInputSchema,
  assetMaintenanceRemoveInputSchema,
  assetWorkspaceSchema,
} from './validation';

export async function getAssetContext(
  permission: string,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'asset', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  if (write) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      context.userId,
      context.requestId,
    );
  }
  return { context, societyId: context.societyId };
}

export async function getAssetWorkspace() {
  const { context, societyId } = await getAssetContext('asset:list');
  return callModuleRpc(
    context,
    'asset_workspace_get',
    { p_society_id: societyId },
    assetWorkspaceSchema,
    'Could not load the asset register. Refresh and retry.',
  );
}

export async function getAssetDetail(assetId: string) {
  const { context, societyId } = await getAssetContext('asset:list');
  const id = parseModuleInput(z.uuid(), assetId);
  return callModuleRpc(
    context,
    'asset_get',
    { p_society_id: societyId, p_asset_id: id },
    assetDetailSchema,
    'Could not load this asset. Refresh and retry.',
  );
}

export async function getAssetFormOptions() {
  const { context, societyId } = await getAssetContext('asset:manage');
  return callModuleRpc(
    context,
    'asset_form_options_get',
    { p_society_id: societyId },
    assetFormOptionsSchema,
    'Could not load the asset form. Refresh and retry.',
  );
}

export async function saveAssetCategory(input: unknown, requestId: string) {
  const { context, societyId } = await getAssetContext(
    'asset:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(assetCategoryInputSchema, input);
  return callModuleRpc(
    context,
    'asset_category_save',
    {
      p_society_id: societyId,
      p_category_id: values.categoryId,
      p_name: values.name,
      p_expected_version: values.expectedVersion,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The category was not saved. Use a name of up to 60 characters that no other category uses; a society can have up to 200 categories.',
  );
}

export async function setAssetCategoryActive(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getAssetContext(
    'asset:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(assetCategoryActiveInputSchema, input);
  await callModuleRpc(
    context,
    'asset_category_set_active',
    {
      p_society_id: societyId,
      p_category_id: values.categoryId,
      p_active: values.active,
      p_expected_version: values.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The category was not changed. Refresh and retry.',
  );
}

export async function saveAsset(input: unknown, requestId: string) {
  const { context, societyId } = await getAssetContext(
    'asset:manage',
    true,
    requestId,
  );
  const asset = parseModuleInput(assetInputSchema, input);
  return callModuleRpc(
    context,
    'asset_save',
    {
      p_society_id: societyId,
      p_asset_id: asset.assetId,
      p_category_id: asset.categoryId,
      p_name: asset.name,
      p_location: asset.location,
      p_make: asset.make,
      p_model: asset.model,
      p_serial_number: asset.serialNumber,
      p_purchase_date: asset.purchaseDate,
      p_purchase_cost_paise: asset.purchaseCostPaise,
      p_supplier: asset.supplier,
      p_warranty_end_date: asset.warrantyEndDate,
      p_status: asset.status,
      p_notes: asset.notes,
      p_amc_contract_id: asset.amcContractId,
      p_expected_amc_enabled: asset.expectedAmcEnabled,
      p_expected_version: asset.expectedVersion,
      p_client_request_id: asset.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The asset was not saved. Choose an active category, keep the purchase date in the past and the warranty end on or after it, or reload and retry.',
  );
}

export async function addAssetMaintenance(input: unknown, requestId: string) {
  const { context, societyId } = await getAssetContext(
    'asset:manage',
    true,
    requestId,
  );
  const entry = parseModuleInput(assetMaintenanceInputSchema, input);
  return callModuleRpc(
    context,
    'asset_maintenance_add',
    {
      p_society_id: societyId,
      p_asset_id: entry.assetId,
      p_performed_on: entry.performedOn,
      p_description: entry.description,
      p_cost_paise: entry.costPaise,
      p_done_by: entry.doneBy,
      p_client_request_id: entry.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The maintenance entry was not saved. Use a date that is not in the future.',
  );
}

export async function removeAssetMaintenance(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getAssetContext(
    'asset:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(assetMaintenanceRemoveInputSchema, input);
  await callModuleRpc(
    context,
    'asset_maintenance_remove',
    {
      p_society_id: societyId,
      p_entry_id: values.entryId,
      p_request_id: context.requestId,
    },
    z.null(),
    'The maintenance entry was not removed. Refresh and retry.',
  );
}
