// Authorize inventory requests and invoke exact, transaction-safe stock operations.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId } from '../errors';
import { callModuleRpc, parseModuleInput as parse } from '../db/validated-rpc';
import { authorizeRequest } from '../permissions/authorize';
import { sendNotificationPushesForRequest } from '../privileged/notification-delivery';
import { buildRequestContext } from '../tenancy/request-context';
import {
  inventoryItemInputSchema,
  inventoryItemSchema,
  inventoryReportRangeSchema,
  inventoryTransactionSchema,
  stockTransactionInputSchema,
} from './validation';

async function inventoryContext(write = false, requestId = createRequestId()) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'housekeeping',
    permission: write ? 'stock:manage' : 'stock:list',
    write,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

export async function getInventoryWorkspace() {
  const { context, societyId } = await inventoryContext();
  const items = await callModuleRpc(
    context,
    'housekeeping_items_list',
    { p_society_id: societyId },
    z.array(inventoryItemSchema),
    'Could not load the inventory.',
  );
  const { data, error } = await context.db
    .from('societies')
    .select('timezone')
    .eq('id', societyId)
    .single();
  if (error || !data)
    throw new Error('Could not load the society timezone.', { cause: error });
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: data.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value;
  const today = z.iso
    .date()
    .parse(`${part('year')}-${part('month')}-${part('day')}`);
  return {
    items,
    today,
    canManage: context.roles.some(
      (role) => role === 'admin' || role === 'hk_supervisor',
    ),
  };
}

export async function saveInventoryItem(input: unknown, requestId: string) {
  const { context, societyId } = await inventoryContext(true, requestId);
  const value = parse(inventoryItemInputSchema, input);
  const id = await callModuleRpc(
    context,
    'housekeeping_item_save',
    {
      p_society_id: societyId,
      p_item_id: value.itemId,
      p_name: value.name,
      p_unit_of_measure: value.unitOfMeasure,
      p_category: value.category,
      p_minimum_stock: value.minimumStock,
      p_active: value.active,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the inventory details. A unit of measure cannot change after stock is recorded.',
  );
  await sendNotificationPushesForRequest(requestId);
  return id;
}

export async function recordInventoryStock(input: unknown, requestId: string) {
  const { context, societyId } = await inventoryContext(true, requestId);
  const value = parse(stockTransactionInputSchema, input);
  const id = await callModuleRpc(
    context,
    'housekeeping_stock_record',
    {
      p_society_id: societyId,
      p_item_id: value.itemId,
      p_kind: value.kind,
      p_quantity: value.quantity,
      p_effective_date: value.effectiveDate,
      p_vendor: value.vendor,
      p_purpose: value.purpose,
      p_cost_paise: value.costRupees,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'This entry is invalid or would make stock negative on its date or a later date.',
  );
  await sendNotificationPushesForRequest(requestId);
  return id;
}

export async function getInventoryReport(input: unknown) {
  const { context, societyId } = await inventoryContext();
  const value = parse(inventoryReportRangeSchema, input);
  const [items, transactions] = await Promise.all([
    callModuleRpc(
      context,
      'housekeeping_items_list',
      { p_society_id: societyId },
      z.array(inventoryItemSchema),
      'Could not load the current stock.',
    ),
    callModuleRpc(
      context,
      'housekeeping_transactions_list',
      {
        p_society_id: societyId,
        p_item_id: value.itemId,
        p_from: value.from,
        p_to: value.to,
      },
      z.array(inventoryTransactionSchema),
      'Could not load the stock history.',
    ),
  ]);
  if (value.itemId && !items.some(({ id }) => id === value.itemId)) {
    throw new AppError('NOT_FOUND');
  }
  return {
    items: value.itemId ? items.filter(({ id }) => id === value.itemId) : items,
    transactions,
  };
}
