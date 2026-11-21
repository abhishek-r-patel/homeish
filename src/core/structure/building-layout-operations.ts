// Load, save and place units in building layouts through the audited layout RPCs.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, ValidationError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import {
  buildRequestContext,
  type RequestContext,
} from '../tenancy/request-context';
import {
  buildingLayoutInput,
  buildingLayoutSchema,
  buildingPlacementInput,
} from './building-layout';

export function loadBuildingLayout(
  context: RequestContext & { societyId: string },
  blockId: unknown,
) {
  const id = z.uuid().safeParse(blockId);
  return callModuleRpc(
    context,
    'building_layout_get',
    {
      p_society_id: context.societyId,
      p_block_id: id.success ? id.data : null,
    },
    buildingLayoutSchema,
    'Could not load the building layout.',
  );
}

export async function getBuildingLayout(blockId: unknown) {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'structure:layout:read',
  });
  const { societyId } = context;
  if (!societyId) throw new AppError('FORBIDDEN');
  const isAdmin = context.roles.includes('admin');
  return {
    layout: await loadBuildingLayout({ ...context, societyId }, blockId),
    isAdmin,
    canEdit:
      isAdmin &&
      (context.societyStatus === 'active' || context.societyStatus === 'trial'),
  };
}

async function writeContext(requestId: string) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'structure:manage',
    write: true,
  });
  const { societyId } = context;
  if (!societyId) throw new AppError('FORBIDDEN');
  return { context, societyId };
}

export async function saveBuildingLayout(
  blockId: unknown,
  clientRequestId: unknown,
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await writeContext(requestId);
  const target = parseModuleInput(z.uuid().nullable(), blockId);
  const values = parseModuleInput(buildingLayoutInput, input);
  const requestKey = parseModuleInput(z.uuid(), clientRequestId);
  await enforceRateLimit('otherWritesUserMinute', context.userId, requestId);
  // The RPC reports name clashes as generic invalid input, so name them here first.
  const sameName = await context.db
    .from('blocks')
    .select('id')
    .eq('society_id', societyId)
    .eq('name', values.name)
    .limit(2);
  if (sameName.error)
    throw new Error('Could not check the building name.', {
      cause: sameName.error,
    });
  if (sameName.data.some(({ id }) => id !== target))
    throw new ValidationError({
      form: 'A block with this name already exists.',
    });
  return callModuleRpc(
    context,
    'building_layout_save',
    {
      p_society_id: societyId,
      p_block_id: target,
      p_values: values,
      p_client_request_id: requestKey,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the building layout and try again.',
  );
}

export async function placeBuildingUnit(
  unitId: unknown,
  clientRequestId: unknown,
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await writeContext(requestId);
  const unit = parseModuleInput(z.uuid(), unitId);
  const { blockId, spaceId, version } = parseModuleInput(
    buildingPlacementInput,
    input,
  );
  const requestKey = parseModuleInput(z.uuid(), clientRequestId);
  await enforceRateLimit('otherWritesUserMinute', context.userId, requestId);
  if (spaceId) {
    // Placing moves the unit into this building, where its number must stay unique.
    const current = await context.db
      .from('units')
      .select('number, block_id')
      .eq('society_id', societyId)
      .eq('id', unit)
      .maybeSingle();
    if (current.error)
      throw new Error('Could not load the unit.', { cause: current.error });
    if (!current.data) throw new AppError('NOT_FOUND');
    if (current.data.block_id !== blockId) {
      const clash = await context.db
        .from('units')
        .select('id')
        .eq('society_id', societyId)
        .eq('block_id', blockId)
        .eq('number', current.data.number)
        .neq('id', unit)
        .limit(1);
      if (clash.error)
        throw new Error('Could not check the unit number.', {
          cause: clash.error,
        });
      if (clash.data.length > 0)
        throw new ValidationError({
          form: 'Another unit in this building already uses this number.',
        });
    }
  }
  await callModuleRpc(
    context,
    'building_unit_place',
    {
      p_society_id: societyId,
      p_unit_id: unit,
      p_block_id: blockId,
      p_space_id: spaceId,
      p_version: version,
      p_client_request_id: requestKey,
      p_request_trace: requestId,
    },
    z.literal(true),
    'Choose a free unit spot and try again.',
  );
}
