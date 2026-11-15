// Authorise Parking operations and validate their transactional database contracts.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  parkingAdminWorkspaceSchema,
  parkingAllocateInputSchema,
  parkingAllocationEndInputSchema,
  parkingGuardBoardSchema,
  parkingGuardQuerySchema,
  parkingPassCancelInputSchema,
  parkingPassInputSchema,
  parkingReportInputSchema,
  parkingReportResolveInputSchema,
  parkingRequestCancelInputSchema,
  parkingRequestInputSchema,
  parkingResidentWorkspaceSchema,
  parkingSettingsInputSchema,
  parkingSlotArchiveInputSchema,
  parkingSlotInputSchema,
  parkingVehicleLinkInputSchema,
} from './validation';

// Mirrors the per-user hourly cap enforced by parking_report_create.
const PARKING_REPORTS_PER_HOUR = 10;

function databaseCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const parsed = z.object({ code: z.string() }).safeParse(current);
    if (parsed.success) return parsed.data.code;
    current = current instanceof Error ? current.cause : undefined;
  }
  return undefined;
}

async function getContext(
  permission: string,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'parking', permission, write });
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

export async function getParkingResidentWorkspace() {
  const { context, societyId } = await getContext('parking:request');
  return callModuleRpc(
    context,
    'parking_resident_workspace',
    { p_society_id: societyId },
    parkingResidentWorkspaceSchema,
    'Could not load your parking. Refresh and retry.',
  );
}

export async function getParkingAdminWorkspace() {
  const { context, societyId } = await getContext('parking:list');
  return callModuleRpc(
    context,
    'parking_admin_workspace',
    { p_society_id: societyId },
    parkingAdminWorkspaceSchema,
    'Could not load society parking. Refresh and retry.',
  );
}

export async function getParkingGuardBoard(query: unknown = null) {
  const { context, societyId } = await getContext('parking:guard');
  const search = parseModuleInput(parkingGuardQuerySchema, query);
  return callModuleRpc(
    context,
    'parking_guard_board',
    { p_society_id: societyId, p_query: search },
    parkingGuardBoardSchema,
    'Could not search parking. Enter a slot label or vehicle number up to 40 characters.',
  );
}

export async function saveParkingSettings(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'parking:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(parkingSettingsInputSchema, input);
  await callModuleRpc(
    context,
    'parking_settings_update',
    {
      p_society_id: societyId,
      p_photo_retention_days: values.photoRetentionDays,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not save the photo retention period. Choose 1 to 90 days.',
  );
}

export async function saveParkingSlot(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'parking:manage',
    true,
    requestId,
  );
  const slot = parseModuleInput(parkingSlotInputSchema, input);
  return callModuleRpc(
    context,
    'parking_slot_save',
    {
      p_society_id: societyId,
      p_slot_id: slot.slotId,
      p_label: slot.label,
      p_slot_type: slot.slotType,
      p_location_note: slot.locationNote,
      p_expected_version: slot.expectedVersion,
      p_client_request_id: slot.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The slot was not saved. Use a label that no other active slot uses, and do not change the type of an existing slot.',
  );
}

export async function archiveParkingSlot(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'parking:manage',
    true,
    requestId,
  );
  const slot = parseModuleInput(parkingSlotArchiveInputSchema, input);
  await callModuleRpc(
    context,
    'parking_slot_archive',
    {
      p_society_id: societyId,
      p_slot_id: slot.slotId,
      p_expected_version: slot.expectedVersion,
      p_request_id: context.requestId,
    },
    z.null(),
    'The slot was not archived. End its allocation first, then retry.',
  );
}

export async function createParkingRequest(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'parking:request',
    true,
    requestId,
  );
  const request = parseModuleInput(parkingRequestInputSchema, input);
  return callModuleRpc(
    context,
    'parking_request_create',
    {
      p_society_id: societyId,
      p_unit_id: request.unitId,
      p_slot_type: request.slotType,
      p_note: request.note,
      p_client_request_id: request.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The request was not added. Choose a car, two-wheeler or EV slot for one of your units.',
  );
}

export async function cancelParkingRequest(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'parking:request',
    true,
    requestId,
  );
  const values = parseModuleInput(parkingRequestCancelInputSchema, input);
  await callModuleRpc(
    context,
    'parking_request_cancel',
    {
      p_society_id: societyId,
      p_waitlist_request_id: values.waitlistRequestId,
      p_request_id: context.requestId,
    },
    z.null(),
    'Only a waiting request can be cancelled. Refresh and retry.',
  );
}

export async function allocateParkingSlot(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'parking:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(parkingAllocateInputSchema, input);
  return callModuleRpc(
    context,
    'parking_allocate',
    {
      p_society_id: societyId,
      p_slot_id: values.slotId,
      p_unit_id: values.unitId,
      p_skip_reason: values.skipReason,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The slot was not allocated. Visitor and archived slots cannot be allocated, and allocating before the next unit in the waitlist needs a reason.',
  );
}

export async function endParkingAllocation(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'parking:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(parkingAllocationEndInputSchema, input);
  await callModuleRpc(
    context,
    'parking_allocation_end',
    {
      p_society_id: societyId,
      p_allocation_id: values.allocationId,
      p_request_id: context.requestId,
    },
    z.null(),
    'The allocation was not ended. Refresh and retry.',
  );
}

export async function setParkingVehicleLink(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'parking:list',
    true,
    requestId,
  );
  const values = parseModuleInput(parkingVehicleLinkInputSchema, input);
  await callModuleRpc(
    context,
    'parking_vehicle_link_set',
    {
      p_society_id: societyId,
      p_allocation_id: values.allocationId,
      p_vehicle_id: values.vehicleId,
      p_linked: values.linked,
      p_request_id: context.requestId,
    },
    z.null(),
    'The vehicle was not linked. A car or EV slot holds one car plus two-wheelers, a two-wheeler slot holds two-wheelers only, and each vehicle can use one slot.',
  );
}

export async function createParkingPass(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'parking:visitor_pass',
    true,
    requestId,
  );
  const pass = parseModuleInput(parkingPassInputSchema, input);
  return callModuleRpc(
    context,
    'parking_pass_create',
    {
      p_society_id: societyId,
      p_unit_id: pass.unitId,
      p_slot_id: pass.slotId,
      p_starts_at: pass.startsAt,
      p_ends_at: pass.endsAt,
      p_visitor_name: pass.visitorName,
      p_vehicle_number: pass.vehicleNumber,
      p_visitor_entry_id: pass.visitorEntryId,
      p_client_request_id: pass.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The visitor pass was not created. Choose a free visitor slot and a pass of up to 24 hours starting within 30 days. Visitor passes need the Visitors module.',
  );
}

export async function cancelParkingPass(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'parking:visitor_pass',
    true,
    requestId,
  );
  const values = parseModuleInput(parkingPassCancelInputSchema, input);
  await callModuleRpc(
    context,
    'parking_pass_cancel',
    {
      p_society_id: societyId,
      p_pass_id: values.passId,
      p_request_id: context.requestId,
    },
    z.null(),
    'Only an upcoming or current pass can be cancelled. Refresh and retry.',
  );
}

export async function createParkingReport(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'parking:report',
    true,
    requestId,
  );
  const report = parseModuleInput(parkingReportInputSchema, input);
  try {
    return await callModuleRpc(
      context,
      'parking_report_create',
      {
        p_society_id: societyId,
        p_slot_id: report.slotId,
        p_vehicle_number: report.vehicleNumber,
        p_note: report.note,
        p_photo_path: report.photoPath,
        p_client_request_id: report.clientRequestId,
        p_request_id: context.requestId,
      },
      z.uuid(),
      'The report was not sent. Choose a slot or enter a vehicle number, and upload the photo again as a JPG or PNG up to 5 MiB.',
    );
  } catch (error) {
    if (!(error instanceof AppError) && databaseCode(error) === '54000') {
      throw new AppError('RATE_LIMITED', {
        message: `You can send ${PARKING_REPORTS_PER_HOUR} wrong-parking reports an hour. Try again later.`,
      });
    }
    throw error;
  }
}

export async function resolveParkingReport(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'parking:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(parkingReportResolveInputSchema, input);
  await callModuleRpc(
    context,
    'parking_report_resolve',
    {
      p_society_id: societyId,
      p_report_id: values.reportId,
      p_resolution_note: values.resolutionNote,
      p_request_id: context.requestId,
    },
    z.null(),
    'The report was not resolved. Keep the note within 500 characters.',
  );
}
