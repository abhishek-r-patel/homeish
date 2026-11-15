// Enforce directory access and validate every database response and mutation.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId } from '../errors';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  directoryEmergencyContactIdInputSchema,
  directoryEmergencyContactInputSchema,
  directoryEmergencyContactSchema,
  directoryGuardVehicleSchema,
  directoryHouseholdSchema,
  directoryPageInputSchema,
  directoryPageSchema,
  directoryResidentSchema,
  directoryVehicleIdInputSchema,
  directoryVehicleInputSchema,
  directoryVehicleSchema,
  directoryVehicleVerificationInputSchema,
  directoryVisibilityInputSchema,
  directoryVisibilitySchema,
} from './validation';

const directoryResidentPageSchema = directoryPageSchema(
  directoryResidentSchema,
);
const directoryVehiclePageSchema = directoryPageSchema(directoryVehicleSchema);
const directoryEmergencyContactPageSchema = directoryPageSchema(
  directoryEmergencyContactSchema,
);

async function getContext(
  permission: string,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'directory', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

async function getManagementContext(requestId: string) {
  const context = await buildRequestContext(requestId);
  const permission = context.roles.includes('admin')
    ? 'directory:manage'
    : 'directory:manage_household';
  authorizeRequest(context, {
    moduleKey: 'directory',
    permission,
    write: true,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

export async function getDirectoryResidents(input: unknown = {}) {
  const { context, societyId } = await getContext('directory:list');
  const page = parseModuleInput(directoryPageInputSchema, input);
  return callModuleRpc(
    context,
    'directory_resident_list',
    {
      p_society_id: societyId,
      p_search: page.search || null,
      p_limit: page.limit,
      p_offset: page.offset,
    },
    directoryResidentPageSchema,
    'Could not load the resident directory.',
  );
}

export async function getDirectoryVehicles(input: unknown = {}) {
  const { context, societyId } = await getContext('directory:list');
  const page = parseModuleInput(directoryPageInputSchema, input);
  return callModuleRpc(
    context,
    'directory_vehicle_list',
    {
      p_society_id: societyId,
      p_limit: page.limit,
      p_offset: page.offset,
    },
    directoryVehiclePageSchema,
    'Could not load directory vehicles.',
  );
}

export async function getDirectoryEmergencyContacts(
  unitId: unknown,
  input: unknown = {},
) {
  const { context, societyId } = await getContext('directory:list');
  const parsedUnitId = parseModuleInput(z.uuid(), unitId);
  const page = parseModuleInput(directoryPageInputSchema, input);
  return callModuleRpc(
    context,
    'directory_emergency_contacts_list',
    {
      p_society_id: societyId,
      p_unit_id: parsedUnitId,
      p_limit: page.limit,
      p_offset: page.offset,
    },
    directoryEmergencyContactPageSchema,
    'Could not load emergency contacts.',
  );
}

export async function getDirectoryMyPreferences() {
  const { context, societyId } = await getContext('directory:manage_household');
  const rows = await callModuleRpc(
    context,
    'directory_my_preferences',
    { p_society_id: societyId },
    z.array(directoryVisibilitySchema).length(1),
    'Could not load directory visibility settings.',
  );
  return rows[0]!;
}

export async function getDirectoryMyHouseholds() {
  const { context, societyId } = await getContext('directory:manage_household');
  return callModuleRpc(
    context,
    'directory_my_households',
    { p_society_id: societyId },
    z.array(directoryHouseholdSchema),
    'Could not load your active household units.',
  );
}

export async function lookupDirectoryVehicle(
  registrationNumber: unknown,
  requestId = createRequestId(),
) {
  const { context, societyId } = await getContext(
    'directory:lookup_vehicle',
    false,
    requestId,
  );
  await enforceRateLimit(
    'otherWritesUserMinute',
    context.userId,
    context.requestId,
  );
  const registration = parseModuleInput(
    z
      .string()
      .trim()
      .min(1)
      .max(32)
      .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9]{4,16}$/)),
    registrationNumber,
  );
  return callModuleRpc(
    context,
    'directory_guard_vehicle_lookup',
    { p_society_id: societyId, p_registration_number: registration },
    z.array(directoryGuardVehicleSchema),
    'Could not look up the vehicle.',
  );
}

export async function assertDirectoryLookupAccess() {
  await getContext('directory:lookup_vehicle');
}

export async function getDirectoryManagementAccess() {
  const { context } = await getContext('directory:list');
  if (!context.roles.some((role) => role === 'admin' || role === 'committee')) {
    throw new AppError('FORBIDDEN');
  }
  return { canManage: context.roles.includes('admin') };
}

export async function setDirectoryVisibility(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'directory:manage_household',
    true,
    requestId,
  );
  const values = parseModuleInput(directoryVisibilityInputSchema, input);
  await callModuleRpc(
    context,
    'directory_set_visibility',
    {
      p_society_id: societyId,
      p_name_visible: values.nameVisible,
      p_unit_visible: values.unitVisible,
      p_phone_visible: values.phoneVisible,
    },
    z.null(),
    'Could not save directory visibility settings.',
  );
}

export async function saveDirectoryVehicle(input: unknown, requestId: string) {
  const { context, societyId } = await getManagementContext(requestId);
  const vehicle = parseModuleInput(directoryVehicleInputSchema, input);
  return callModuleRpc(
    context,
    'directory_vehicle_save',
    {
      p_society_id: societyId,
      p_vehicle_id: vehicle.vehicleId,
      p_unit_id: vehicle.unitId,
      p_membership_id: vehicle.membershipId,
      p_vehicle_type: vehicle.vehicleType,
      p_registration_number: vehicle.registrationNumber,
      p_tag_number: vehicle.tagNumber,
      p_client_request_id: vehicle.clientRequestId,
    },
    z.uuid(),
    'Could not save the vehicle. Check the registration number and try again.',
  );
}

export async function verifyDirectoryVehicle(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'directory:manage',
    true,
    requestId,
  );
  const values = parseModuleInput(
    directoryVehicleVerificationInputSchema,
    input,
  );
  await callModuleRpc(
    context,
    'directory_vehicle_verify',
    {
      p_society_id: societyId,
      p_vehicle_id: values.vehicleId,
      p_is_verified: values.isVerified,
    },
    z.null(),
    'Could not update vehicle verification.',
  );
}

export async function deactivateDirectoryVehicle(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getManagementContext(requestId);
  const { vehicleId } = parseModuleInput(directoryVehicleIdInputSchema, input);
  await callModuleRpc(
    context,
    'directory_vehicle_deactivate',
    { p_society_id: societyId, p_vehicle_id: vehicleId },
    z.null(),
    'Could not deactivate the vehicle.',
  );
}

export async function saveDirectoryEmergencyContact(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getManagementContext(requestId);
  const contact = parseModuleInput(directoryEmergencyContactInputSchema, input);
  return callModuleRpc(
    context,
    'directory_emergency_contact_save',
    {
      p_society_id: societyId,
      p_contact_id: contact.contactId,
      p_unit_id: contact.unitId,
      p_membership_id: contact.membershipId,
      p_full_name: contact.fullName,
      p_relationship: contact.relationship,
      p_phone: contact.phone,
      p_client_request_id: contact.clientRequestId,
    },
    z.uuid(),
    'Could not save the emergency contact. Check the contact details.',
  );
}

export async function deactivateDirectoryEmergencyContact(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getManagementContext(requestId);
  const { contactId } = parseModuleInput(
    directoryEmergencyContactIdInputSchema,
    input,
  );
  await callModuleRpc(
    context,
    'directory_emergency_contact_deactivate',
    { p_society_id: societyId, p_contact_id: contactId },
    z.null(),
    'Could not deactivate the emergency contact.',
  );
}
