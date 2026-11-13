// Enforce notice permissions, validate inputs and re-check notice attachments.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId, ValidationError } from '../errors';
import { MAX_FILE_BYTES, verifyFileAttachment } from '../files/attachments';
import { authorizeRequest } from '../permissions/authorize';
import { sendNotificationPushesForRequest } from '../privileged/notification-delivery';
import {
  buildRequestContext,
  type RequestContext,
} from '../tenancy/request-context';
import { noticeRpc, readNotice, readNotices } from './queries';
import {
  NOTICE_ATTACHMENT_CONTENT_TYPES,
  noticeCreateInputSchema,
  noticeFileFolder,
  noticeIdInputSchema,
  noticePinInputSchema,
  noticeSchema,
  noticeUpdateInputSchema,
  noticeViewSchema,
  type Notice,
} from './validation';

type NoticePermission =
  'notice:list' | 'notice:create' | 'notice:manage' | 'notice:archive';

async function getContext(
  permission: NoticePermission,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'notice', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
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

function isManager(context: RequestContext) {
  return context.roles.some((role) => role === 'admin' || role === 'committee');
}

function requireFutureExpiry(expiresAt: string | null) {
  if (expiresAt !== null && Date.parse(expiresAt) <= Date.now()) {
    throw new ValidationError({ expiresAt: 'Choose a future expiry time.' });
  }
}

async function verifiedAttachment(
  context: RequestContext,
  societyId: string,
  path: string | null,
  currentPath: string | null = null,
) {
  if (path === null) return null;
  // The database keeps the stored metadata when the current file is unchanged.
  if (path === currentPath) return { path };
  const ownerPath = noticeFileFolder(path, societyId);
  if (!ownerPath) {
    throw new ValidationError({ attachmentPath: 'Upload the file again.' });
  }
  const file = await verifyFileAttachment(context, {
    bucket: 'notice-files',
    contentTypes: NOTICE_ATTACHMENT_CONTENT_TYPES,
    maxBytes: MAX_FILE_BYTES,
    ownerPath,
    path,
    societyId,
  });
  return {
    path,
    content_type: file.contentType,
    size_bytes: String(file.sizeBytes),
  };
}

export async function getNoticeBoard(view: unknown = 'current') {
  const parsedView = parseInput(noticeViewSchema, view);
  const { context, societyId } = await getContext(
    parsedView === 'archive' ? 'notice:archive' : 'notice:list',
  );
  const notices = await readNotices(context, societyId, {
    view: parsedView,
    limit: 100,
  });
  return {
    notices,
    view: parsedView,
    canCreate: isManager(context),
    canSeeArchive: isManager(context),
  };
}

export async function getNoticeComposeOptions() {
  const { context, societyId } = await getContext('notice:create');
  const { data, error } = await context.db
    .from('blocks')
    .select('id, name')
    .eq('society_id', societyId)
    .eq('active', true)
    .order('name');
  if (error) {
    throw new Error('Could not load the blocks for notices.', {
      cause: error,
    });
  }
  return { blocks: data };
}

export async function getNoticeDetail(noticeId: string) {
  const id = parseInput(z.uuid(), noticeId);
  const { context, societyId } = await getContext('notice:list');
  const notice = await readNotice(context, societyId, id);
  let attachmentUrl: string | null = null;
  if (notice.attachment_path) {
    const { data, error } = await context.db.storage
      .from('notice-files')
      .createSignedUrl(notice.attachment_path, 300);
    if (error || !data) {
      throw new Error('The notice attachment could not be loaded.', {
        cause: error,
      });
    }
    attachmentUrl = data.signedUrl;
  }
  return {
    notice,
    attachmentUrl,
    canSeeAdminWorkspace: isManager(context),
  };
}

export async function markNoticeRead(noticeId: string) {
  const id = parseInput(z.uuid(), noticeId);
  const { context, societyId } = await getContext('notice:list');
  await noticeRpc(
    context,
    'notice_mark_read',
    { p_society_id: societyId, p_notice_id: id },
    z.unknown(),
  );
}

export async function createNotice(
  input: unknown,
  requestId: string,
): Promise<Notice> {
  const { context, societyId } = await getContext(
    'notice:create',
    true,
    requestId,
  );
  const parsed = parseInput(noticeCreateInputSchema, input);
  requireFutureExpiry(parsed.expiresAt);
  const attachment = await verifiedAttachment(
    context,
    societyId,
    parsed.attachmentPath,
  );
  const notice = await noticeRpc(
    context,
    'notice_create',
    {
      p_society_id: societyId,
      p_title: parsed.title,
      p_body: parsed.body,
      p_audience: parsed.audience,
      p_block_ids: parsed.blockIds,
      p_pinned: parsed.pinned,
      p_expires_at: parsed.expiresAt,
      p_attachment: attachment,
      p_client_request_id: parsed.clientRequestId,
      p_request_trace: context.requestId,
    },
    noticeSchema,
    { retryOnDuplicate: true },
  );
  await sendNotificationPushesForRequest(context.requestId);
  return notice;
}

export async function updateNotice(
  input: unknown,
  requestId: string,
): Promise<Notice> {
  const { context, societyId } = await getContext(
    'notice:manage',
    true,
    requestId,
  );
  const parsed = parseInput(noticeUpdateInputSchema, input);
  const current = await readNotice(context, societyId, parsed.noticeId);
  if (!current.can_manage) throw new AppError('FORBIDDEN');
  const currentExpiry =
    current.expires_at === null ? null : Date.parse(current.expires_at);
  const nextExpiry =
    parsed.expiresAt === null ? null : Date.parse(parsed.expiresAt);
  if (nextExpiry !== currentExpiry) requireFutureExpiry(parsed.expiresAt);
  const attachment = await verifiedAttachment(
    context,
    societyId,
    parsed.attachmentPath,
    current.attachment_path,
  );
  const saved = await noticeRpc(
    context,
    'notice_update',
    {
      p_society_id: societyId,
      p_notice_id: parsed.noticeId,
      p_title: parsed.title,
      p_body: parsed.body,
      p_audience: parsed.audience,
      p_block_ids: parsed.blockIds,
      p_expires_at: parsed.expiresAt,
      p_attachment: attachment,
      p_expected_updated_at: parsed.expectedUpdatedAt,
      p_request_trace: context.requestId,
    },
    noticeSchema,
  );
  const previousPath = current.attachment_path;
  if (previousPath && previousPath !== saved.attachment_path) {
    try {
      const { error } = await context.db.storage
        .from('notice-files')
        .remove([previousPath]);
      if (error) throw new Error('Notice attachment cleanup failed.');
    } catch {
      context.logger.warn('notice.attachment_cleanup_failed');
    }
  }
  return saved;
}

export async function setNoticePinned(
  input: unknown,
  requestId: string,
): Promise<Notice> {
  const { context, societyId } = await getContext(
    'notice:manage',
    true,
    requestId,
  );
  const parsed = parseInput(noticePinInputSchema, input);
  return noticeRpc(
    context,
    'notice_set_pinned',
    {
      p_society_id: societyId,
      p_notice_id: parsed.noticeId,
      p_pinned: parsed.pinned,
      p_request_trace: context.requestId,
    },
    noticeSchema,
  );
}

export async function withdrawNotice(
  input: unknown,
  requestId: string,
): Promise<Notice> {
  const { context, societyId } = await getContext(
    'notice:manage',
    true,
    requestId,
  );
  const parsed = parseInput(noticeIdInputSchema, input);
  return noticeRpc(
    context,
    'notice_withdraw',
    {
      p_society_id: societyId,
      p_notice_id: parsed.noticeId,
      p_request_trace: context.requestId,
    },
    noticeSchema,
  );
}
