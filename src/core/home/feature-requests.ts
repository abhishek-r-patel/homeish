// Load the P55 module catalogue and enforce admin-only feature requests.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { MODULE_KEYS, MODULE_REGISTRY, type ModuleKey } from '../modules';
import { buildRequestContext } from '../tenancy/request-context';

const featureRequestSchema = z.object({
  id: z.uuid(),
  module_key: z.enum(MODULE_KEYS),
  note: z.string().nullable(),
  status: z.enum(['new', 'agreed', 'declined']),
  created_at: z.iso.datetime({ offset: true }),
});
const requestInputSchema = z
  .object({
    moduleKey: z.enum(MODULE_KEYS),
    note: z.string().trim().max(500),
  })
  .strict();

export async function getFeatureList() {
  const context = await buildRequestContext(createRequestId());
  if (
    !context.societyId ||
    !context.roles.some((role) => role === 'admin' || role === 'committee')
  ) {
    throw new AppError('FORBIDDEN');
  }
  const requests = await callModuleRpc(
    context,
    'society_feature_requests_get',
    { p_society_id: context.societyId },
    z.array(featureRequestSchema),
    'Feature requests could not be loaded.',
  );
  const latestByModule = new Map<ModuleKey, (typeof requests)[number]>();
  for (const request of requests) {
    if (!latestByModule.has(request.module_key)) {
      latestByModule.set(request.module_key, request);
    }
  }
  return {
    canRequest: context.roles.includes('admin'),
    features: MODULE_KEYS.map((moduleKey) => ({
      key: moduleKey,
      name: MODULE_REGISTRY[moduleKey].name,
      description: `${MODULE_REGISTRY[moduleKey].name} tools and records for this society.`,
      enabled: moduleKey === 'core' || context.enabledModules.has(moduleKey),
      request: latestByModule.get(moduleKey) ?? null,
    })),
  };
}

export async function createFeatureRequest(input: unknown) {
  const values = parseModuleInput(requestInputSchema, input);
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId || !context.roles.includes('admin')) {
    throw new AppError('FORBIDDEN');
  }
  if (
    values.moduleKey === 'core' ||
    context.enabledModules.has(values.moduleKey)
  ) {
    throw new AppError('FORBIDDEN');
  }
  return callModuleRpc(
    context,
    'society_feature_request_create',
    {
      p_society_id: context.societyId,
      p_module_key: values.moduleKey,
      p_note: values.note,
    },
    z.uuid(),
    'The feature request could not be saved.',
  );
}
