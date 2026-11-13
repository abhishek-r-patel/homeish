// Read notice board data through permission-checked, schema-validated RPCs.
import 'server-only';
import { z } from 'zod';
import { AppError, CONFLICT_REASONS, ValidationError } from '../errors';
import { retryOnceOnDuplicate } from '../db/retry-on-duplicate';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { authorizeRequest } from '../permissions/authorize';
import type { RequestContext } from '../tenancy/request-context';
import {
  noticeDetailSchema,
  noticeListSchema,
  type NoticeView,
} from './validation';

export async function noticeRpc<T>(
  context: RequestContext,
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
  options: { retryOnDuplicate?: boolean } = {},
): Promise<T> {
  let result: unknown;
  try {
    const call = () => invokeUntypedRpc<unknown>(context.db, name, args);
    result = await (options.retryOnDuplicate
      ? retryOnceOnDuplicate(call)
      : call());
  } catch (error) {
    const cause = z
      .object({
        code: z.string().optional(),
        hint: z.string().nullish(),
      })
      .safeParse(error instanceof Error ? error.cause : null);
    const code = cause.success ? cause.data.code : undefined;
    if (code === '42501') throw new AppError('FORBIDDEN');
    if (code === 'P0002') throw new AppError('NOT_FOUND');
    if (code === '23505') {
      const hint = cause.success ? cause.data.hint : undefined;
      const reason =
        hint === 'stale_record'
          ? 'stale_version'
          : (CONFLICT_REASONS.find((candidate) => candidate === hint) ??
            'invalid_state');
      throw new AppError('CONFLICT', {
        reason,
        message:
          reason === 'stale_version'
            ? 'This notice changed in another session. Refresh and retry.'
            : 'This notice can no longer be changed.',
      });
    }
    if (code === '22023' || code === '23514' || code === '23502') {
      throw new ValidationError({
        form: 'Check the notice details and try again.',
      });
    }
    throw new Error('The notice database operation failed.', {
      cause: { code: code ?? 'unknown' },
    });
  }
  return schema.parse(result);
}

function requireSociety(context: RequestContext, societyId: string) {
  if (context.societyId !== societyId) throw new AppError('FORBIDDEN');
}

export async function readNotices(
  context: RequestContext,
  societyId: string,
  options: { view?: NoticeView; limit?: number; offset?: number } = {},
) {
  requireSociety(context, societyId);
  const view = options.view ?? 'current';
  authorizeRequest(context, {
    moduleKey: 'notice',
    permission: view === 'archive' ? 'notice:archive' : 'notice:list',
  });
  return noticeRpc(
    context,
    'notice_list',
    {
      p_society_id: societyId,
      p_view: view,
      p_limit: options.limit ?? 50,
      p_offset: options.offset ?? 0,
    },
    noticeListSchema,
  );
}

export async function readNotice(
  context: RequestContext,
  societyId: string,
  noticeId: string,
) {
  requireSociety(context, societyId);
  authorizeRequest(context, { moduleKey: 'notice', permission: 'notice:list' });
  return noticeRpc(
    context,
    'notice_get',
    { p_society_id: societyId, p_notice_id: noticeId },
    noticeDetailSchema,
  );
}
