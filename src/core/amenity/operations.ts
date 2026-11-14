// Enforce amenity access and invoke atomic reservations, immutable charges and full credits.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId } from '../errors';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import { todayInTimeZone } from '../billing/format';
import { sendNotificationPushesForRequest } from '../privileged/notification-delivery';
import {
  amenityInputSchema,
  amenityBookingInputSchema,
  amenityCancelInputSchema,
  amenityWorkspaceSchema,
} from './validation';
async function contextFor(
  permission = 'amenity:list',
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'amenity', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}
export async function getAmenityWorkspace(date?: string) {
  const { context, societyId } = await contextFor();
  let selected = date;
  if (selected === undefined) {
    const { data, error } = await context.db
      .from('societies')
      .select('timezone')
      .eq('id', societyId)
      .single();
    if (error || !data)
      throw new Error('Could not load the booking timezone.', { cause: error });
    const today = z.iso.date().parse(todayInTimeZone(data.timezone));
    const tomorrow = new Date(`${today}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    selected = tomorrow.toISOString().slice(0, 10);
  }
  return callModuleRpc(
    context,
    'amenity_workspace',
    {
      p_society_id: societyId,
      p_date: parseModuleInput(z.iso.date(), selected),
    },
    amenityWorkspaceSchema,
    'Could not load amenity availability.',
  );
}
export async function saveAmenity(input: unknown, requestId: string) {
  const { context, societyId } = await contextFor(
    'amenity:manage',
    true,
    requestId,
  );
  const v = parseModuleInput(amenityInputSchema, input);
  return callModuleRpc(
    context,
    'amenity_save',
    {
      p_society_id: societyId,
      p_amenity_id: v.amenityId,
      p_name: v.name,
      p_capacity: v.capacity,
      p_fee_paise: v.feeRupees,
      p_rules: v.rules,
      p_active: v.active,
      p_slots: v.slots,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check recurring slots. Paid amenities require billing to be enabled.',
  );
}
export async function bookAmenity(input: unknown, requestId: string) {
  const { context, societyId } = await contextFor(
    'amenity:book',
    true,
    requestId,
  );
  const v = parseModuleInput(amenityBookingInputSchema, input);
  return callModuleRpc(
    context,
    'amenity_book',
    {
      p_society_id: societyId,
      p_amenity_id: v.amenityId,
      p_slot_id: v.slotId,
      p_date: v.date,
      p_unit_id: v.unitId,
      p_guest_count: v.guestCount,
      p_rules_accepted: v.rulesAccepted,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'This slot is unavailable. Check the 24-hour lead, guests, rules and billing status.',
  );
}
export async function cancelAmenity(input: unknown, requestId: string) {
  const { context, societyId } = await contextFor(
    'amenity:cancel',
    true,
    requestId,
  );
  const v = parseModuleInput(amenityCancelInputSchema, input);
  const id = await callModuleRpc(
    context,
    'amenity_cancel',
    {
      p_society_id: societyId,
      p_booking_id: v.bookingId,
      p_reason: v.reason,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Resident cancellation ends when the slot starts. Administrators must provide a reason.',
  );
  await sendNotificationPushesForRequest(requestId);
  return id;
}
