// Pin, unpin, edit, publish or withdraw a notice the current manager may change.
'use client';

import { useUiTranslator } from '@/components/ui/language';
import Link from 'next/link';
import {
  publishNoticeDraftAction,
  setNoticePinnedAction,
  withdrawNoticeAction,
} from '@/app/(admin)/admin/notices/actions';
import { NoticeActionForm } from './action-form';

export function NoticeManageControls({
  noticeId,
  pinned,
  status,
  updatedAt,
}: {
  noticeId: string;
  pinned: boolean;
  status: 'draft' | 'scheduled' | 'published' | 'withdrawn';
  updatedAt: string;
}) {
  const { translate: t } = useUiTranslator();
  if (status === 'withdrawn') {
    return (
      <p className="text-body text-ink-muted">
        {t('This notice was withdrawn and can no longer be changed.')}
      </p>
    );
  }
  const planned = status === 'draft' || status === 'scheduled';
  return (
    <div className="flex flex-wrap items-start gap-space-3">
      <Link
        className="inline-flex min-h-12 items-center rounded-md border border-rule-strong px-space-4 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
        href={`/admin/notices/${noticeId}/edit`}
      >
        {t('Edit notice')}
      </Link>
      {planned ? (
        <NoticeActionForm
          action={publishNoticeDraftAction}
          className="grid gap-space-2"
          confirmMessage={t(
            'Publish this notice now? Everyone in the audience is notified.',
          )}
          input={() => ({ noticeId, expectedUpdatedAt: updatedAt })}
          submitLabel={t('Publish now')}
        />
      ) : (
        <NoticeActionForm
          action={setNoticePinnedAction}
          className="grid gap-space-2"
          input={() => ({ noticeId, pinned: !pinned })}
          submitLabel={pinned ? t('Unpin notice') : t('Pin notice')}
          submitVariant="secondary"
        />
      )}
      <NoticeActionForm
        action={withdrawNoticeAction}
        className="grid gap-space-2"
        confirmMessage={
          planned
            ? t('Withdraw this planned notice? It will not be posted.')
            : t('Withdraw this notice? Residents will no longer see it.')
        }
        input={() => ({ noticeId })}
        submitLabel={t('Withdraw notice')}
        submitVariant="destructive"
      />
    </div>
  );
}
