// Read redacted society change history and perform guarded settings undo.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';

const accessSchema = z.object({
  isAdmin: z.boolean(),
  canView: z.boolean(),
  committeeEnabled: z.boolean(),
});
const jsonValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);
const rowSchema = z.object({
  id: z.string().regex(/^\d+$/),
  action: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  actorName: z.string().min(1).max(120),
  actorRole: z.string().max(50).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  before: jsonValue.nullable(),
  after: jsonValue.nullable(),
  canUndo: z.boolean(),
  undoReason: z.string().max(160).nullable(),
});
const filterSchema = z
  .object({
    from: z.iso.datetime({ offset: true }).nullable(),
    before: z.iso.datetime({ offset: true }).nullable(),
    category: z.string().trim().max(80).nullable(),
  })
  .refine(
    (value) =>
      !value.from ||
      !value.before ||
      Date.parse(value.from) < Date.parse(value.before),
  );

export type AuditHistoryRow = z.infer<typeof rowSchema>;

export async function getAuditHistoryAccess() {
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return callModuleRpc(
    context,
    'audit_history_access_get',
    { p_society_id: context.societyId },
    accessSchema,
    'Change-history access could not be loaded.',
  );
}

export async function getAuditHistory(input: unknown) {
  const filters = filterSchema.parse(input);
  const access = await getAuditHistoryAccess();
  if (!access.canView) throw new AppError('FORBIDDEN');
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId) throw new AppError('FORBIDDEN');
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'audit:read',
  });
  return callModuleRpc(
    context,
    'audit_history_get',
    {
      p_society_id: context.societyId,
      p_from: filters.from,
      p_before: filters.before,
      p_category: filters.category,
      p_limit: 100,
      p_offset: 0,
    },
    z.array(rowSchema),
    'Change history could not be loaded.',
  );
}

export async function undoAuditSetting(input: unknown, requestId: string) {
  const parsed = z
    .object({
      auditId: z.string().regex(/^\d+$/),
    })
    .parse(input);
  const context = await buildRequestContext(requestId);
  if (!context.societyId) throw new AppError('FORBIDDEN');
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'audit:undo',
    write: true,
  });
  return callModuleRpc(
    context,
    'audit_setting_undo',
    {
      p_society_id: context.societyId,
      p_audit_id: parsed.auditId,
      p_request_id: context.requestId,
    },
    z.object({ undoneAuditId: z.string().regex(/^\d+$/) }),
    'The setting could not be undone.',
  );
}
