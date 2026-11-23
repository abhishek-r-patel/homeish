// Authorize and validate P40.9 repair forecast reads and mutations.
import 'server-only';
import { z } from 'zod';
import { createRequestId, AppError } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { buildRequestContext } from '../tenancy/request-context';
import {
  expenseRepairForecastArchiveInputSchema,
  expenseRepairForecastFundInputSchema,
  expenseRepairForecastItemInputSchema,
  expenseRepairForecastSchema,
} from './repair-forecast-validation';

type Access = 'read' | 'manage';
const PERMISSIONS: Record<Access, string> = {
  read: 'expense:list',
  manage: 'expense:manage',
};

async function contextFor(access: Access, requestId = createRequestId()) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'expense',
    permission: PERMISSIONS[access],
    write: access === 'manage',
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

export async function getExpenseRepairForecast(includeArchived = false) {
  const { context, societyId } = await contextFor('read');
  return callModuleRpc(
    context,
    'expense_repair_forecast_get',
    {
      p_society_id: societyId,
      p_include_archived: includeArchived,
    },
    expenseRepairForecastSchema,
    'Could not load the repair forecast.',
  );
}

export async function saveExpenseRepairForecastItem(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(expenseRepairForecastItemInputSchema, input);
  return callModuleRpc(
    context,
    'expense_repair_forecast_item_save',
    {
      p_society_id: societyId,
      p_item_id: value.itemId,
      p_name: value.name,
      p_category: value.category,
      p_last_done_year: value.lastDoneYear,
      p_cycle_years: value.cycleYears,
      p_manual_next_due_year: value.manualNextDueYear,
      p_current_cost_paise: value.currentCostRupees,
      p_inflation_bp: value.inflationPercent,
      p_notes: value.notes,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the repair item, cycle, due year, cost and inflation.',
  );
}

export async function archiveExpenseRepairForecastItem(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(
    expenseRepairForecastArchiveInputSchema,
    input,
  );
  return callModuleRpc(
    context,
    'expense_repair_forecast_item_archive',
    {
      p_society_id: societyId,
      p_item_id: value.itemId,
      p_archive: value.archive,
      p_reason: value.reason,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Give an archive reason and refresh if the item changed.',
  );
}

export async function setExpenseRepairForecastFund(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor('manage', requestId);
  const value = parseModuleInput(expenseRepairForecastFundInputSchema, input);
  return callModuleRpc(
    context,
    'expense_repair_forecast_fund_set',
    {
      p_society_id: societyId,
      p_gap_fund_id: value.gapFundId,
      p_expected_updated_at: value.expectedUpdatedAt,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose an active fund for the estimated gap.',
  );
}
