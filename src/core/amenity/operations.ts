// Enforce amenity access and invoke atomic reservations, immutable charges and full credits.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId } from '../errors';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import { todayInTimeZone } from '../billing/format';
import { sendNotificationPushesForRequest } from '../privileged/notification-delivery';
import { getModuleSettingAccess } from '../modules/setting-access';
import {
  amenityActivityInputSchema,
  amenityCalendarSchema,
  amenityCalendarSettingsSchema,
  amenityCalendarVisibilityInputSchema,
  amenityDepositEventInputSchema,
  amenityDepositOverrideInputSchema,
  amenityDepositPolicyInputSchema,
  amenityDepositVoidInputSchema,
  amenityFacilitiesReportSchema,
  amenityInputSchema,
  amenityBookingInputSchema,
  amenityCancelInputSchema,
  amenityMonthSchema,
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
      p_deposit_paise: v.depositRupees === 0 ? null : v.depositRupees,
      p_deposit_required_before_confirmation:
        v.depositRequired && v.depositRupees > 0,
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

export async function getAmenityCalendarMonth(month?: string) {
  const { context, societyId } = await contextFor();
  let selected = month;
  if (selected === undefined) {
    const { data, error } = await context.db
      .from('societies')
      .select('timezone')
      .eq('id', societyId)
      .single();
    if (error || !data)
      throw new Error('Could not load the calendar timezone.', {
        cause: error,
      });
    selected = todayInTimeZone(data.timezone).slice(0, 7);
  }
  return callModuleRpc(
    context,
    'amenity_calendar_month',
    {
      p_society_id: societyId,
      p_month: `${parseModuleInput(amenityMonthSchema, selected)}-01`,
      p_limit: 500,
    },
    amenityCalendarSchema,
    'Could not load the amenity calendar. Refresh and retry.',
  );
}

export async function getAmenityCalendarSettings() {
  const { context, societyId } = await contextFor();
  const [settings, settingAccess] = await Promise.all([
    callModuleRpc(
      context,
      'amenity_calendar_settings_get',
      { p_society_id: societyId },
      amenityCalendarSettingsSchema,
      'Could not load amenity calendar settings.',
    ),
    getModuleSettingAccess('amenity', context),
  ]);
  return { ...settings, settingsAccess: Object.fromEntries(settingAccess) };
}

export async function saveAmenityCalendarVisibility(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor(
    'amenity:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(amenityCalendarVisibilityInputSchema, input);
  await callModuleRpc(
    context,
    'amenity_calendar_visibility_save',
    {
      p_society_id: societyId,
      p_resident_calendar_identity: values.identity,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not save the amenity calendar setting. Refresh and retry.',
  );
}

export async function saveAmenityDepositPolicy(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor(
    'amenity:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(amenityDepositPolicyInputSchema, input);
  await callModuleRpc(
    context,
    'amenity_deposit_policy_save',
    {
      p_society_id: societyId,
      p_policy: values.policy,
      p_request_id: context.requestId,
    },
    z.null(),
    'Could not save the amenity deposit policy. Refresh and retry.',
  );
}

export async function overrideAmenityDeposit(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor(
    'amenity:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(amenityDepositOverrideInputSchema, input);
  return callModuleRpc(
    context,
    'amenity_deposit_override',
    {
      p_society_id: societyId,
      p_booking_id: values.bookingId,
      p_amount_paise: values.amountRupees,
      p_reason: values.reason,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The deposit could not be changed. It may already be received or confirmed.',
  );
}

export async function recordAmenityDepositEvent(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor(
    'amenity:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(amenityDepositEventInputSchema, input);
  return callModuleRpc(
    context,
    'amenity_deposit_event_record',
    {
      p_society_id: societyId,
      p_booking_id: values.bookingId,
      p_kind: values.kind,
      p_amount_paise: values.amountRupees,
      p_event_date: values.eventDate,
      p_account_id: values.accountId,
      p_reference: values.reference,
      p_reason: values.reason,
      p_evidence_path: values.evidencePath,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The deposit event could not be recorded. Check the held balance, account, date and evidence.',
  );
}

export async function voidAmenityDepositEvent(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await contextFor(
    'amenity:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(amenityDepositVoidInputSchema, input);
  return callModuleRpc(
    context,
    'amenity_deposit_event_void',
    {
      p_society_id: societyId,
      p_event_id: values.eventId,
      p_reason: values.reason,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The deposit event could not be voided. Review the booking and recorded cash.',
  );
}

export async function getAmenityFacilitiesReport() {
  const { context, societyId } = await contextFor();
  return callModuleRpc(
    context,
    'amenity_facilities_report',
    { p_society_id: societyId, p_limit: 100, p_offset: 0 },
    amenityFacilitiesReportSchema,
    'Could not load the facilities report. Refresh and retry.',
  );
}

export async function recordAmenityActivity(input: unknown, requestId: string) {
  const { context, societyId } = await contextFor(
    'amenity:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(amenityActivityInputSchema, input);
  return callModuleRpc(
    context,
    'amenity_activity_record',
    {
      p_society_id: societyId,
      p_source_kind: values.sourceType,
      p_source_id: values.sourceId,
      p_activity_kind: values.activityKind,
      p_occurred_at_local: values.occurredAtLocal,
      p_note: values.note,
      p_client_request_id: values.clientRequestId,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'The facility activity was not saved. Choose an enabled, existing source and retry.',
  );
}
