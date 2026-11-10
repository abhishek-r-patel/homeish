// Tenant-scoped block and unit operations for the Core Platform.
import { z } from 'zod';
import { AppError, ValidationError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';

const optionalText = (limit: number) =>
  z
    .string()
    .trim()
    .max(limit)
    .transform((value) => value || null);

export const blockInputSchema = z
  .object({ name: z.string().trim().min(1).max(60) })
  .strict();

export const blockStatusSchema = z
  .object({ blockId: z.uuid(), active: z.enum(['true', 'false']) })
  .strict()
  .transform(({ blockId, active }) => ({
    blockId,
    active: active === 'true',
  }));

export const blockUpdateSchema = z
  .object({ blockId: z.uuid(), name: z.string().trim().min(1).max(60) })
  .strict();

export const unitInputSchema = z
  .object({
    blockId: z
      .preprocess((value) => (value === '' ? null : value), z.uuid().nullable())
      .default(null),
    number: z.string().trim().min(1).max(20),
    floor: z
      .preprocess(
        (value) => (value === '' || value === null ? null : Number(value)),
        z.number().int().nullable(),
      )
      .default(null),
    unitType: optionalText(30),
    areaSqft: z
      .preprocess(
        (value) => (value === '' || value === null ? null : Number(value)),
        z.number().positive().max(999999.99).nullable(),
      )
      .default(null),
  })
  .strict();

export const unitUpdateSchema = unitInputSchema
  .extend({ unitId: z.uuid() })
  .strict();

export const unitStatusSchema = z
  .object({ unitId: z.uuid(), active: z.enum(['true', 'false']) })
  .strict()
  .transform(({ unitId, active }) => ({
    unitId,
    active: active === 'true',
  }));

async function getStructureContext(
  permission: 'structure:read' | 'structure:manage',
  write = false,
) {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, {
    moduleKey: 'core',
    permission,
    write,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

function parseForm<T>(schema: z.ZodType<T>, formData: FormData): T {
  const values = Object.fromEntries(
    [...formData.entries()].filter(([name]) => !name.startsWith('$ACTION_')),
  );
  const parsed = schema.safeParse(values);
  if (parsed.success) return parsed.data;
  throw new ValidationError(
    Object.fromEntries(
      parsed.error.issues.map((issue) => [
        String(issue.path[0] ?? 'form'),
        issue.message,
      ]),
    ),
  );
}

export async function getStructure() {
  const { context, societyId } = await getStructureContext('structure:manage');
  const [blocksResult, unitsResult] = await Promise.all([
    context.db
      .from('blocks')
      .select('id, name, active')
      .eq('society_id', societyId)
      .order('name'),
    context.db
      .from('units')
      .select('id, block_id, number, floor, unit_type, area_sqft, active')
      .eq('society_id', societyId)
      .order('number'),
  ]);
  if (blocksResult.error) {
    throw new Error('Could not load society blocks.', {
      cause: blocksResult.error,
    });
  }
  if (unitsResult.error) {
    throw new Error('Could not load society units.', {
      cause: unitsResult.error,
    });
  }
  return { blocks: blocksResult.data, units: unitsResult.data };
}

export async function createBlock(formData: FormData) {
  const { context, societyId } = await getStructureContext(
    'structure:manage',
    true,
  );
  const { name } = parseForm(blockInputSchema, formData);
  const { error } = await context.db
    .from('blocks')
    .insert({ society_id: societyId, name });
  if (error?.code === '23505') {
    throw new ValidationError({
      name: 'A block with this name already exists.',
    });
  }
  if (error) throw new Error('Could not create the block.', { cause: error });
}

export async function setBlockActive(formData: FormData) {
  const { context, societyId } = await getStructureContext(
    'structure:manage',
    true,
  );
  const { blockId, active } = parseForm(blockStatusSchema, formData);
  const { data, error } = await context.db
    .from('blocks')
    .update({ active })
    .eq('id', blockId)
    .eq('society_id', societyId)
    .select('id')
    .maybeSingle();
  if (error) throw new Error('Could not update the block.', { cause: error });
  if (!data) throw new AppError('NOT_FOUND');
}

export async function updateBlock(formData: FormData) {
  const { context, societyId } = await getStructureContext(
    'structure:manage',
    true,
  );
  const { blockId, name } = parseForm(blockUpdateSchema, formData);
  const { data, error } = await context.db
    .from('blocks')
    .update({ name })
    .eq('id', blockId)
    .eq('society_id', societyId)
    .select('id')
    .maybeSingle();
  if (error?.code === '23505') {
    throw new ValidationError({
      name: 'A block with this name already exists.',
    });
  }
  if (error) throw new Error('Could not update the block.', { cause: error });
  if (!data) throw new AppError('NOT_FOUND');
}

export async function createUnit(formData: FormData) {
  const { context, societyId } = await getStructureContext(
    'structure:manage',
    true,
  );
  const input = parseForm(unitInputSchema, formData);
  const { error } = await context.db.from('units').insert({
    society_id: societyId,
    block_id: input.blockId,
    number: input.number,
    floor: input.floor,
    unit_type: input.unitType,
    area_sqft: input.areaSqft,
  });
  if (error?.code === '23505') {
    throw new ValidationError({
      number: 'This unit number already exists in the selected block.',
    });
  }
  if (error) throw new Error('Could not create the unit.', { cause: error });
}

export async function updateUnit(formData: FormData) {
  const { context, societyId } = await getStructureContext(
    'structure:manage',
    true,
  );
  const input = parseForm(unitUpdateSchema, formData);
  const { data, error } = await context.db
    .from('units')
    .update({
      block_id: input.blockId,
      number: input.number,
      floor: input.floor,
      unit_type: input.unitType,
      area_sqft: input.areaSqft,
    })
    .eq('id', input.unitId)
    .eq('society_id', societyId)
    .select('id')
    .maybeSingle();
  if (error?.code === '23505') {
    throw new ValidationError({
      number: 'This unit number already exists in the selected block.',
    });
  }
  if (error) throw new Error('Could not update the unit.', { cause: error });
  if (!data) throw new AppError('NOT_FOUND');
}

export async function setUnitActive(formData: FormData) {
  const { context, societyId } = await getStructureContext(
    'structure:manage',
    true,
  );
  const { unitId, active } = parseForm(unitStatusSchema, formData);
  const { data, error } = await context.db
    .from('units')
    .update({ active })
    .eq('id', unitId)
    .eq('society_id', societyId)
    .select('id')
    .maybeSingle();
  if (error) throw new Error('Could not update the unit.', { cause: error });
  if (!data) throw new AppError('NOT_FOUND');
}
