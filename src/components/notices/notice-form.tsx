// Compose or edit a notice with its audience, expiry and optional attachment.
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  createNoticeAction,
  updateNoticeAction,
} from '@/app/(admin)/admin/notices/actions';
import { DatePicker } from '@/components/ui/date-time-inputs';
import type { Notice, NoticeAudience } from '@/core/notices/validation';
import { NoticeActionForm, type NoticeFormAction } from './action-form';
import { NoticeAttachmentUpload } from './attachment-upload';

type Block = { id: string; name: string };

const fieldClass =
  'min-h-12 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-space-3 text-body focus-visible:outline-2 focus-visible:outline-focus';
const STORAGE_KEY = 'homeish:notice:create';
const IST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Returns the Asia/Kolkata calendar date (YYYY-MM-DD) of an instant. */
function noticeExpiryDate(value: string | null) {
  return value ? IST_DATE.format(new Date(value)) : '';
}

/** A notice chosen to expire on a date stays visible until that day ends in India. */
function noticeExpiryInstant(date: string) {
  return date ? `${date}T23:59:59+05:30` : null;
}

function stableRequestId() {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    const id = existing ?? crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function NoticeForm({
  action,
  blocks,
  notice,
  onSaved,
}: {
  /** Overrides the server action; fixtures pass an in-memory action. */
  action?: NoticeFormAction;
  blocks: Block[];
  notice?: Notice;
  /** Replaces the default navigation to the saved notice. */
  onSaved?: (data: unknown) => void;
}) {
  const router = useRouter();
  const [audience, setAudience] = useState<NoticeAudience>(
    notice?.audience ?? 'all',
  );
  const [expiresOn, setExpiresOn] = useState(
    noticeExpiryDate(notice?.expires_at ?? null),
  );
  const selectedBlocks = new Set(notice?.blocks.map(({ id }) => id) ?? []);
  const today = IST_DATE.format(new Date());

  return (
    <NoticeActionForm
      action={action ?? (notice ? updateNoticeAction : createNoticeAction)}
      input={(formData) => {
        const content = {
          title: String(formData.get('title') ?? ''),
          body: String(formData.get('body') ?? ''),
          audience,
          blockIds:
            audience === 'blocks'
              ? formData.getAll('blockIds').map(String)
              : [],
          expiresAt: noticeExpiryInstant(expiresOn),
          attachmentPath: String(formData.get('attachmentPath') ?? '') || null,
        };
        return notice
          ? {
              ...content,
              noticeId: notice.id,
              expectedUpdatedAt: notice.updated_at,
            }
          : {
              ...content,
              pinned: formData.get('pinned') === 'on',
              clientRequestId: stableRequestId(),
            };
      }}
      onSuccess={(data) => {
        if (!notice) {
          try {
            sessionStorage.removeItem(STORAGE_KEY);
          } catch {
            // Storage can be unavailable in private browsing; nothing to clear.
          }
        }
        if (onSaved) {
          onSaved(data);
          return;
        }
        const id =
          typeof data === 'object' && data !== null && 'id' in data
            ? String(data.id)
            : notice?.id;
        if (id) router.push(`/admin/notices/${id}`);
      }}
      refresh={!onSaved}
      submitLabel={notice ? 'Save changes' : 'Publish notice'}
    >
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="notice-title"
      >
        Title
        <input
          className={fieldClass}
          defaultValue={notice?.title}
          id="notice-title"
          maxLength={120}
          name="title"
          required
        />
      </label>
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="notice-body"
      >
        Notice
        <textarea
          className="min-h-40 rounded-md border border-rule-strong bg-surface p-space-3 text-body focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue={notice?.body}
          id="notice-body"
          maxLength={5000}
          name="body"
          required
        />
      </label>
      <fieldset className="grid min-w-0 gap-space-2 border-0 p-0">
        <legend className="text-body-strong">Who should see it?</legend>
        {(
          [
            ['all', 'All residents'],
            ['blocks', 'Residents of chosen blocks'],
            ['owners', 'Owners only'],
          ] as const
        ).map(([value, text]) => (
          <label className="flex min-h-10 items-center gap-space-2" key={value}>
            <input
              checked={audience === value}
              name="audience"
              onChange={() => setAudience(value)}
              type="radio"
              value={value}
            />
            {text}
          </label>
        ))}
      </fieldset>
      {audience === 'blocks' ? (
        <fieldset className="grid min-w-0 gap-space-2 border-0 p-0">
          <legend className="text-body-strong">Blocks</legend>
          {blocks.length === 0 ? (
            <p className="text-caption text-ink-muted">
              This society has no active blocks.
            </p>
          ) : (
            blocks.map((block) => (
              <label
                className="flex min-h-10 items-center gap-space-2"
                key={block.id}
              >
                <input
                  defaultChecked={selectedBlocks.has(block.id)}
                  name="blockIds"
                  type="checkbox"
                  value={block.id}
                />
                {block.name}
              </label>
            ))
          )}
        </fieldset>
      ) : null}
      <div className="grid min-w-0 gap-space-1">
        <DatePicker
          helpText="Residents stop seeing the notice after this day ends."
          id="notice-expires"
          label="Expires on (optional)"
          min={notice ? undefined : today}
          onChange={setExpiresOn}
          value={expiresOn}
        />
        {expiresOn ? (
          <button
            className="min-h-10 justify-self-start rounded-md px-space-2 text-body text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
            onClick={() => setExpiresOn('')}
            type="button"
          >
            Remove expiry
          </button>
        ) : null}
      </div>
      {notice ? null : (
        <label className="flex min-h-10 items-center gap-space-2 text-body-strong">
          <input name="pinned" type="checkbox" />
          Pin to the top as important
        </label>
      )}
      <NoticeAttachmentUpload initialPath={notice?.attachment_path ?? null} />
      {notice ? (
        <p className="text-caption text-ink-muted">
          Residents see an “Edited” label. Saving changes does not send a new
          notification.
        </p>
      ) : (
        <p className="text-caption text-ink-muted">
          Publishing notifies everyone in the audience by push and in the app.
        </p>
      )}
    </NoticeActionForm>
  );
}
