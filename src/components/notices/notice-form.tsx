// Compose, plan or edit a notice with its audience, expiry, posting day and optional attachment.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  createNoticeAction,
  saveNoticeDraftAction,
  updateNoticeAction,
} from '@/app/(admin)/admin/notices/actions';
import { DatePicker } from '@/components/ui/date-time-inputs';
import type { Notice, NoticeAudience } from '@/core/notices/validation';
import { addDays } from '@/core/toolkit/validation';
import { NoticeActionForm, type NoticeFormAction } from './action-form';
import { NoticeAttachmentUpload } from './attachment-upload';

type Block = { id: string; name: string };
type PostMode = 'now' | 'draft' | 'schedule';

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
  const { translate: t } = useUiTranslator();
  const router = useRouter();
  const [audience, setAudience] = useState<NoticeAudience>(
    notice?.audience ?? 'all',
  );
  const [expiresOn, setExpiresOn] = useState(
    noticeExpiryDate(notice?.expires_at ?? null),
  );
  const selectedBlocks = new Set(notice?.blocks.map(({ id }) => id) ?? []);
  const today = IST_DATE.format(new Date());
  const tomorrow = addDays(today, 1);
  const published = notice?.status === 'published';
  const [postMode, setPostMode] = useState<PostMode>(
    notice?.status === 'scheduled' ? 'schedule' : notice ? 'draft' : 'now',
  );
  const [scheduledOn, setScheduledOn] = useState(notice?.scheduled_for ?? '');
  const [scheduleError, setScheduleError] = useState<string | undefined>();
  const planned = !published && postMode !== 'now';
  const submitLabel = published
    ? t('Save changes')
    : postMode === 'now'
      ? t('Publish notice')
      : postMode === 'schedule'
        ? t('Schedule notice')
        : t('Save draft');

  return (
    <NoticeActionForm
      action={
        action ??
        (published
          ? updateNoticeAction
          : planned
            ? saveNoticeDraftAction
            : createNoticeAction)
      }
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
        if (published && notice) {
          return {
            ...content,
            noticeId: notice.id,
            expectedUpdatedAt: notice.updated_at,
          };
        }
        if (planned) {
          if (postMode === 'schedule' && !scheduledOn) {
            setScheduleError(t('Choose the day to post the notice.'));
            throw new Error('Missing posting day.');
          }
          setScheduleError(undefined);
          return {
            ...content,
            pinned: formData.get('pinned') === 'on',
            scheduledFor: postMode === 'schedule' ? scheduledOn : null,
            noticeId: notice?.id ?? null,
            expectedUpdatedAt: notice?.updated_at ?? null,
            clientRequestId: notice ? null : stableRequestId(),
          };
        }
        return {
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
      submitLabel={submitLabel}
    >
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="notice-title"
      >
        {t('Title')}
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
        {t('Notice')}
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
        <legend className="text-body-strong">{t('Who should see it?')}</legend>
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
            {t(text)}
          </label>
        ))}
      </fieldset>
      {audience === 'blocks' ? (
        <fieldset className="grid min-w-0 gap-space-2 border-0 p-0">
          <legend className="text-body-strong">{t('Blocks')}</legend>
          {blocks.length === 0 ? (
            <p className="text-caption text-ink-muted">
              {t('This society has no active blocks.')}
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
          helpText={t('Residents stop seeing the notice after this day ends.')}
          id="notice-expires"
          label={t('Expires on (optional)')}
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
            {t('Remove expiry')}
          </button>
        ) : null}
      </div>
      {published ? null : (
        <label className="flex min-h-10 items-center gap-space-2 text-body-strong">
          <input
            defaultChecked={notice?.pinned ?? false}
            name="pinned"
            type="checkbox"
          />
          {t('Pin to the top as important')}
        </label>
      )}
      <NoticeAttachmentUpload initialPath={notice?.attachment_path ?? null} />
      {published ? null : (
        <fieldset className="grid min-w-0 gap-space-2 border-0 p-0">
          <legend className="text-body-strong">{t('When to post')}</legend>
          {(
            [
              ...(notice ? [] : ([['now', 'Publish now']] as const)),
              ['draft', 'Save as a draft'],
              ['schedule', 'Schedule for a day'],
            ] as const
          ).map(([value, text]) => (
            <label
              className="flex min-h-10 items-center gap-space-2"
              key={value}
            >
              <input
                checked={postMode === value}
                name="postMode"
                onChange={() => setPostMode(value)}
                type="radio"
                value={value}
              />
              {t(text)}
            </label>
          ))}
          {postMode === 'schedule' ? (
            <DatePicker
              error={scheduleError}
              helpText={t(
                'The notice is posted early that morning and everyone in the audience is notified.',
              )}
              id="notice-scheduled-for"
              label={t('Posting day')}
              min={tomorrow}
              onChange={setScheduledOn}
              required
              value={scheduledOn}
            />
          ) : null}
        </fieldset>
      )}
      {published ? (
        <p className="text-caption text-ink-muted">
          {t(
            'Residents see an “Edited” label. Saving changes does not send a new notification.',
          )}
        </p>
      ) : postMode === 'now' ? (
        <p className="text-caption text-ink-muted">
          {t(
            'Publishing notifies everyone in the audience by push and in the app.',
          )}
        </p>
      ) : (
        <p className="text-caption text-ink-muted">
          {t('Residents do not see the notice until it is posted.')}
        </p>
      )}
    </NoticeActionForm>
  );
}
