// Copy published meeting minutes into Documents as a PDF without ever failing the publish.
import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { callModuleRpc } from '../db/validated-rpc';
import { createDocument, getDocumentWorkspace } from '../document/operations';
import { DOCUMENT_BUCKET } from '../document/files';
import { documentUploadPath } from '../document/presentation';
import { ValidationError } from '../errors';
import type { RequestContext } from '../tenancy/request-context';
import { meetingMinutesFileName, meetingMinutesPdf } from './minutes-pdf';
import {
  meetingAdminGetSchema,
  meetingDocumentLinkResultSchema,
  type MeetingType,
} from './validation';

const MAX_PDF_BYTES = 5 * 1024 * 1024;

export type MeetingDocumentFolder = {
  id: string;
  name: string;
  audience: string;
  system_key: string | null;
  archived_at: string | null;
};

export type MeetingDocumentCopyResult =
  | { copied: true; documentId: string }
  | {
      copied: false;
      reason:
        | 'document_disabled'
        | 'no_folder'
        | 'not_published'
        | 'unsupported_text'
        | 'too_large'
        | 'failed';
    };

export function eligibleMinutesFolders<T extends MeetingDocumentFolder>(
  folders: readonly T[],
  meetingType: MeetingType,
): T[] {
  return folders.filter(
    (folder) =>
      folder.archived_at === null &&
      (meetingType !== 'committee' || folder.audience === 'committee_admins'),
  );
}

// Committee minutes must stay in admin/committee-only folders, so the default may differ by type.
export function defaultMinutesFolderId(
  folders: readonly MeetingDocumentFolder[],
  meetingType: MeetingType,
): string | null {
  const eligible = eligibleMinutesFolders(folders, meetingType);
  return (
    eligible.find((folder) => folder.system_key === 'minutes')?.id ??
    (meetingType === 'committee' ? (eligible[0]?.id ?? null) : null)
  );
}

// One stable id per meeting lets a retry reuse a document that was created before a later step failed.
export function minutesDocumentRequestId(meetingId: string) {
  const hex = createHash('sha256')
    .update(`meeting-minutes-document:${meetingId}`)
    .digest('hex');
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function copyMinutesToDocuments(input: {
  context: RequestContext;
  societyId: string;
  meetingId: string;
  folderId: string | null;
  requestId: string;
}): Promise<MeetingDocumentCopyResult> {
  const { context, societyId, meetingId, requestId } = input;
  if (!context.enabledModules.has('document')) {
    return { copied: false, reason: 'document_disabled' };
  }
  try {
    const detail = await callModuleRpc(
      context,
      'meeting_admin_get',
      { p_society_id: societyId, p_meeting_id: meetingId },
      meetingAdminGetSchema,
      'Could not load this meeting.',
    );
    if (detail.minutes?.status !== 'published') {
      return { copied: false, reason: 'not_published' };
    }
    if (detail.minutes.documentId) {
      return { copied: true, documentId: detail.minutes.documentId };
    }
    const workspace = await getDocumentWorkspace();
    const eligible = eligibleMinutesFolders(
      workspace.folders,
      detail.meeting.meetingType,
    );
    const folderId = input.folderId
      ? (eligible.find((folder) => folder.id === input.folderId)?.id ?? null)
      : defaultMinutesFolderId(workspace.folders, detail.meeting.meetingType);
    if (!folderId) return { copied: false, reason: 'no_folder' };

    const bytes = await meetingMinutesPdf(detail);
    if (bytes.byteLength > MAX_PDF_BYTES) {
      return { copied: false, reason: 'too_large' };
    }
    const path = documentUploadPath(
      societyId,
      'application/pdf',
      crypto.randomUUID(),
    );
    const { error: uploadError } = await context.db.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, bytes, { contentType: 'application/pdf', upsert: false });
    if (uploadError) {
      throw new Error('Could not upload the minutes PDF.', {
        cause: uploadError,
      });
    }
    const document = await createDocument(
      {
        folderId,
        unitId: null,
        unitAudience: null,
        title: `Minutes: ${detail.meeting.title}`.slice(0, 120),
        description: null,
        path,
        fileName: meetingMinutesFileName(detail.meeting.title),
        clientRequestId: minutesDocumentRequestId(meetingId),
      },
      requestId,
    );
    const linked = await callModuleRpc(
      context,
      'meeting_minutes_document_link',
      {
        p_society_id: societyId,
        p_meeting_id: meetingId,
        p_document_id: z.uuid().parse(document.id),
        p_request_id: requestId,
      },
      meetingDocumentLinkResultSchema,
      'Could not link the minutes document.',
    );
    return { copied: true, documentId: linked.documentId };
  } catch (error) {
    if (error instanceof ValidationError && error.fieldErrors?.minutes) {
      return { copied: false, reason: 'unsupported_text' };
    }
    context.logger.warn('meeting.minutes_document_copy_failed', {
      meetingId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return { copied: false, reason: 'failed' };
  }
}
