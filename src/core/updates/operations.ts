// Read and manage platform release notes through narrow audited RPCs.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc } from '../db/validated-rpc';
import { AppError, createRequestId, ValidationError } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import {
  buildRequestContext,
  type RequestContext,
} from '../tenancy/request-context';

const timestamp = z.iso.datetime({ offset: true });
const updateSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  href: z.string().min(1).max(500).nullable(),
  publishedAt: timestamp.nullable(),
  withdrawnAt: timestamp.nullable().optional(),
  updatedAt: timestamp.optional(),
  hasRead: z.boolean().optional(),
});
export type PlatformUpdate = z.infer<typeof updateSchema>;

const saveSchema = z
  .object({
    updateId: z.uuid().nullable(),
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(2000),
    href: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .refine((value) => value === null || /^\/(?![\\/])/.test(value), {
        message: 'Use an in-app page path beginning with /.',
      }),
    publish: z.boolean(),
    expectedUpdatedAt: timestamp.nullable(),
  })
  .strict();

export async function getDeveloperPlatformUpdates() {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, { developer: true, requireRecentMfa: true });
  return callModuleRpc(
    context,
    'developer_platform_updates_get',
    {},
    z.array(updateSchema),
    'Release notes could not be loaded.',
  );
}

export async function getPlatformUpdates() {
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId) throw new AppError('FORBIDDEN');
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'updates:read',
  });
  return callModuleRpc(
    context,
    'platform_updates_get',
    {},
    z.array(updateSchema),
    'What is new could not be loaded.',
  );
}

export async function saveDeveloperPlatformUpdate(
  context: RequestContext,
  input: unknown,
) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError({
      form: parsed.error.issues[0]?.message ?? 'Check the release note.',
    });
  }
  authorizeRequest(context, { developer: true, requireRecentMfa: true });
  return callModuleRpc(
    context,
    'developer_platform_update_save',
    {
      p_update_id: parsed.data.updateId,
      p_title: parsed.data.title,
      p_body: parsed.data.body,
      p_href: parsed.data.href,
      p_publish: parsed.data.publish,
      p_expected_updated_at: parsed.data.expectedUpdatedAt,
      p_request_id: context.requestId,
    },
    z.object({ id: z.uuid() }),
    'The release note could not be saved.',
  );
}

export async function withdrawDeveloperPlatformUpdate(
  context: RequestContext,
  updateId: string,
  expectedUpdatedAt: string,
) {
  authorizeRequest(context, { developer: true, requireRecentMfa: true });
  return callModuleRpc(
    context,
    'developer_platform_update_withdraw',
    {
      p_update_id: z.uuid().parse(updateId),
      p_expected_updated_at: timestamp.parse(expectedUpdatedAt),
      p_request_id: context.requestId,
    },
    z.null(),
    'The release note could not be withdrawn.',
  );
}

export async function markPlatformUpdateRead(updateId: string) {
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId) throw new AppError('FORBIDDEN');
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'updates:read',
  });
  return callModuleRpc(
    context,
    'platform_update_mark_read',
    { p_update_id: z.uuid().parse(updateId) },
    z.null(),
    'The release note could not be marked read.',
  );
}
