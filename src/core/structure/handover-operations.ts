// Authorize D-85 unit handover reads and mutations through Core caller-session RPCs.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import {
  unitHandoverAcknowledgeInputSchema,
  unitHandoverCloseInputSchema,
  unitHandoverCreateInputSchema,
  unitHandoverItemsInputSchema,
  unitHandoverPhotoInputSchema,
  unitHandoverReadingInputSchema,
  unitHandoverTemplateInputSchema,
  unitHandoverWorkspaceSchema,
} from './handover-validation';

async function handoverContext(
  permission: 'structure:read' | 'structure:manage',
  write: boolean,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'core', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

export async function getUnitHandoverWorkspace(unitId: unknown) {
  const { context, societyId } = await handoverContext('structure:read', false);
  return callModuleRpc(
    context,
    'unit_handover_workspace',
    {
      p_society_id: societyId,
      p_unit_id: parseModuleInput(z.uuid(), unitId),
    },
    unitHandoverWorkspaceSchema,
    'Could not load this unit’s handovers.',
  );
}

export async function saveUnitHandoverTemplate(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await handoverContext(
    'structure:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(unitHandoverTemplateInputSchema, input);
  await enforceRateLimit('otherWritesUserMinute', context.userId, requestId);
  return callModuleRpc(
    context,
    'unit_handover_template_save',
    {
      p_society_id: societyId,
      p_items: value.items,
      p_expected_version: value.expectedVersion,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the handover checklist and refresh the current version.',
  );
}

export async function createUnitHandover(input: unknown, requestId: string) {
  const { context, societyId } = await handoverContext(
    'structure:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(unitHandoverCreateInputSchema, input);
  await enforceRateLimit('otherWritesUserMinute', context.userId, requestId);
  return callModuleRpc(
    context,
    'unit_handover_create',
    {
      p_society_id: societyId,
      p_unit_id: value.unitId,
      p_event_type: value.eventType,
      p_move_id: value.moveId,
      p_transfer_case_id: value.transferCaseId,
      p_handover_on: value.handoverOn,
      p_note: value.note,
      p_party_membership_ids: value.partyMembershipIds,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the unit, handover type, date, linked record and active parties.',
  );
}

export async function saveUnitHandoverItems(input: unknown, requestId: string) {
  const { context, societyId } = await handoverContext(
    'structure:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(unitHandoverItemsInputSchema, input);
  return callModuleRpc(
    context,
    'unit_handover_items_save',
    {
      p_society_id: societyId,
      p_handover_id: value.handoverId,
      p_items: value.items.map((item) => ({
        item_id: item.itemId,
        response: item.response,
        note: item.note,
      })),
      p_reason: value.reason,
      p_expected_version: value.expectedVersion,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Answer every current handover item and refresh if the handover changed.',
  );
}

export async function linkUnitHandoverReading(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await handoverContext(
    'structure:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(unitHandoverReadingInputSchema, input);
  return callModuleRpc(
    context,
    'unit_handover_reading_link',
    {
      p_society_id: societyId,
      p_handover_id: value.handoverId,
      p_reading_id: value.readingId,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Choose an approved reading for this unit.',
  );
}

export async function addUnitHandoverPhoto(input: unknown, requestId: string) {
  const { context, societyId } = await handoverContext(
    'structure:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(unitHandoverPhotoInputSchema, input);
  return callModuleRpc(
    context,
    'unit_handover_photo_add',
    {
      p_society_id: societyId,
      p_handover_id: value.handoverId,
      p_path: value.path,
      p_content_type: value.contentType,
      p_size_bytes: value.sizeBytes,
      p_client_request_id: value.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Upload a JPG, PNG or PDF again before attaching it.',
  );
}

export async function acknowledgeUnitHandover(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await handoverContext(
    'structure:read',
    true,
    requestId,
  );
  const value = parseModuleInput(unitHandoverAcknowledgeInputSchema, input);
  return callModuleRpc(
    context,
    'unit_handover_acknowledge',
    {
      p_society_id: societyId,
      p_handover_id: value.handoverId,
      p_note: value.note,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Only an active party can acknowledge this handover.',
  );
}

export async function closeUnitHandover(input: unknown, requestId: string) {
  const { context, societyId } = await handoverContext(
    'structure:manage',
    true,
    requestId,
  );
  const value = parseModuleInput(unitHandoverCloseInputSchema, input);
  return callModuleRpc(
    context,
    'unit_handover_close',
    {
      p_society_id: societyId,
      p_handover_id: value.handoverId,
      p_expected_version: value.expectedVersion,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Refresh the open handover before closing it.',
  );
}
