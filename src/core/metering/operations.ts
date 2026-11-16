// Authorise Utility Metering operations and validate their transactional database contracts.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, ValidationError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  meteringAdminWorkspaceSchema,
  meteringBillingResultSchema,
  meteringBillingRunInputSchema,
  meteringGuardBoardSchema,
  meteringGuardQuerySchema,
  meteringMeterInputSchema,
  meteringRateInputSchema,
  meteringReadingInputSchema,
  meteringResidentWorkspaceSchema,
  meteringReviewInputSchema,
} from './validation';

const READING_FAILURE =
  'The reading was not saved. Use a date from the last year that is after the latest reading and not in the future, and give a reason when the reading is lower than the last one.';

async function getContext(
  permission: string,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'metering', permission, write });
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

export async function getMeteringResidentWorkspace() {
  const { context, societyId } = await getContext('metering:submit');
  return callModuleRpc(
    context,
    'metering_resident_workspace',
    { p_society_id: societyId },
    meteringResidentWorkspaceSchema,
    'Could not load your meters. Refresh and retry.',
  );
}

export async function getMeteringAdminWorkspace() {
  const { context, societyId } = await getContext('metering:list');
  return callModuleRpc(
    context,
    'metering_admin_workspace',
    { p_society_id: societyId },
    meteringAdminWorkspaceSchema,
    'Could not load society metering. Refresh and retry.',
  );
}

export async function getMeteringGuardBoard(query: unknown = null) {
  const { context, societyId } = await getContext('metering:record');
  const search = parseModuleInput(meteringGuardQuerySchema, query);
  return callModuleRpc(
    context,
    'metering_guard_board',
    { p_society_id: societyId, p_query: search },
    meteringGuardBoardSchema,
    'Could not search meters. Enter a unit, label or serial up to 40 characters.',
  );
}

export async function saveMeteringMeter(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'metering:manage',
    true,
    requestId,
  );
  const meter = parseModuleInput(meteringMeterInputSchema, input);
  return callModuleRpc(
    context,
    'metering_meter_save',
    {
      p_society_id: societyId,
      p_meter_id: meter.meterId,
      p_meter_type: meter.meterType,
      p_scope: meter.scope,
      p_unit_id: meter.unitId,
      p_label: meter.label,
      p_serial_number: meter.serialNumber,
      p_initial_reading: meter.initialReading,
      p_active: meter.active,
      p_expected_version: meter.expectedVersion,
      p_client_request_id: meter.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The meter was not saved. Use a label no other meter uses, and do not change the initial reading after readings exist.',
  );
}

export async function setMeteringRate(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'metering:manage',
    true,
    requestId,
  );
  const rate = parseModuleInput(meteringRateInputSchema, input);
  return callModuleRpc(
    context,
    'metering_rate_set',
    {
      p_society_id: societyId,
      p_meter_type: rate.meterType,
      p_rate_paise: rate.ratePaise,
      p_client_request_id: rate.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The rate was not saved. Enter Rs 0 to Rs 1,00,000 per unit.',
  );
}

async function saveReading(
  permission: 'metering:record' | 'metering:submit',
  rpc: 'metering_reading_record' | 'metering_reading_submit',
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(permission, true, requestId);
  const reading = parseModuleInput(meteringReadingInputSchema, input);
  if (rpc === 'metering_reading_submit' && reading.photoPath === null) {
    throw new ValidationError({ photoPath: 'Add a photo of the meter.' });
  }
  return callModuleRpc(
    context,
    rpc,
    {
      p_society_id: societyId,
      p_meter_id: reading.meterId,
      p_reading_value: reading.readingValue,
      p_reading_date: reading.readingDate,
      p_lower_reason: reading.lowerReason,
      p_photo_path: reading.photoPath,
      p_client_request_id: reading.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    rpc === 'metering_reading_submit'
      ? `${READING_FAILURE} Only one reading per meter can wait for review, with its photo attached.`
      : READING_FAILURE,
  );
}

export function recordMeteringReading(input: unknown, requestId: string) {
  return saveReading(
    'metering:record',
    'metering_reading_record',
    input,
    requestId,
  );
}

export function submitMeteringReading(input: unknown, requestId: string) {
  return saveReading(
    'metering:submit',
    'metering_reading_submit',
    input,
    requestId,
  );
}

export async function reviewMeteringReading(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'metering:manage',
    true,
    requestId,
  );
  const review = parseModuleInput(meteringReviewInputSchema, input);
  await callModuleRpc(
    context,
    'metering_reading_review',
    {
      p_society_id: societyId,
      p_reading_id: review.readingId,
      p_decision: review.decision,
      p_reason: review.reason,
      p_request_id: context.requestId,
    },
    z.null(),
    review.decision === 'approve'
      ? 'The reading was not approved. A lower reading needs a reason, the meter must be active, and no reading may already be approved for that day or later.'
      : 'The reading was not rejected. Give a reason of 3 to 300 characters.',
  );
}

export async function runMeteringBilling(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'metering:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(meteringBillingRunInputSchema, input);
  return callModuleRpc(
    context,
    'metering_billing_run',
    {
      p_society_id: societyId,
      p_bill_date: values.billDate,
      p_request_id: context.requestId,
    },
    meteringBillingResultSchema,
    'Utility charges were not billed. Turn on Billing and choose a bill date from the last year that is not in the future.',
  );
}
