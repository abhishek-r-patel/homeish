// Compose a single unit's current records through existing module permissions.
import 'server-only';
import { z } from 'zod';
import { getBillingLedger } from '../billing/operations';
import { listDocuments } from '../document/operations';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { getParkingAdminWorkspace } from '../parking/operations';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import { loadBuildingLayout } from './building-layout-operations';
import { unitRecordEdit, unitRecordsSchema } from './unit-records';

async function optionalSource<T>(load: () => Promise<T>) {
  try {
    return { kind: 'available' as const, data: await load() };
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === 'MODULE_DISABLED' || error.code === 'FORBIDDEN')
    ) {
      return { kind: 'unavailable' as const };
    }
    throw error;
  }
}

export async function getUnitWorkspace(input: unknown, building?: unknown) {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'structure:manage',
  });
  const { db, societyId } = context;
  if (!societyId) throw new AppError('FORBIDDEN');
  const id = z.uuid().safeParse(input);
  if (!id.success) throw new AppError('NOT_FOUND');
  const unitId = id.data;
  const unit = await db
    .from('units')
    .select('id, number, floor, block_id, active, unit_type, area_sqft')
    .eq('society_id', societyId)
    .eq('id', unitId)
    .maybeSingle();
  if (unit.error)
    throw new Error('Could not load the unit register.', { cause: unit.error });
  if (!unit.data) throw new AppError('NOT_FOUND');
  const blockId = unit.data.block_id;

  const [block, occupants, billing, parking, documents, records] =
    await Promise.all([
      blockId === null
        ? null
        : db
            .from('blocks')
            .select('name')
            .eq('society_id', societyId)
            .eq('id', blockId)
            .maybeSingle(),
      db
        .from('unit_occupants')
        .select('relationship')
        .eq('society_id', societyId)
        .eq('unit_id', unitId)
        .eq('status', 'active'),
      optionalSource(async () => {
        const entries = await getBillingLedger(unitId);
        return entries.at(-1)?.balance_paise ?? '0';
      }),
      optionalSource(async () => {
        const { slots } = await getParkingAdminWorkspace();
        return slots
          .filter((slot) => slot.allocation?.unit_id === unitId)
          .map(({ id, label }) => ({ id, label }));
      }),
      optionalSource(async () => {
        const { items, total } = await listDocuments({
          folderId: null,
          unitId,
          limit: 10,
        });
        return {
          items: items.map(({ id, title }) => ({ id, title })),
          total,
        };
      }),
      callModuleRpc(
        context,
        'unit_records_get',
        { p_society_id: societyId, p_unit_id: unitId },
        unitRecordsSchema,
        'Could not load unit records.',
      ),
    ]);
  if (block?.error || occupants.error) {
    throw new Error('Could not load current unit records.', {
      cause: block?.error ?? occupants.error,
    });
  }
  const layout = await loadBuildingLayout(
    { ...context, societyId },
    building ?? records.placement?.block_id ?? blockId,
  );

  return {
    unit: unit.data,
    block: block?.data?.name ?? null,
    occupancy: occupants.data.reduce(
      (counts, { relationship }) => {
        if (relationship === 'owner') counts.owner++;
        if (relationship === 'tenant') counts.tenant++;
        if (relationship === 'family') counts.family++;
        return counts;
      },
      { owner: 0, tenant: 0, family: 0 },
    ),
    billing,
    parking,
    documents,
    records,
    layout,
    canWrite:
      context.societyStatus === 'active' || context.societyStatus === 'trial',
  };
}

export async function saveUnitRecord(
  unitId: unknown,
  clientRequestId: unknown,
  input: unknown,
  requestId: string,
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'structure:manage',
    write: true,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const { action, ...values } = parseModuleInput(unitRecordEdit, input);
  await enforceRateLimit('otherWritesUserMinute', context.userId, requestId);
  await callModuleRpc(
    context,
    'unit_records_save',
    {
      p_society_id: context.societyId,
      p_unit_id: parseModuleInput(z.uuid(), unitId),
      p_kind: action,
      p_values: values,
      p_client_request_id: parseModuleInput(z.uuid(), clientRequestId),
      p_request_trace: requestId,
    },
    z.literal(true),
    'Check the unit record and try again.',
  );
}
