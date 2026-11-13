// Pin, unpin, edit or withdraw a notice the current manager may change.
'use client';

import Link from 'next/link';
import {
  setNoticePinnedAction,
  withdrawNoticeAction,
} from '@/app/(admin)/admin/notices/actions';
import { NoticeActionForm } from './action-form';

export function NoticeManageControls({
  noticeId,
  pinned,
  withdrawn,
}: {
  noticeId: string;
  pinned: boolean;
  withdrawn: boolean;
}) {
  if (withdrawn) {
    return (
      <p className="text-body text-ink-muted">
        This notice was withdrawn and can no longer be changed.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-start gap-space-3">
      <Link
        className="inline-flex min-h-12 items-center rounded-md border border-rule-strong px-space-4 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
        href={`/admin/notices/${noticeId}/edit`}
      >
        Edit notice
      </Link>
      <NoticeActionForm
        action={setNoticePinnedAction}
        className="grid gap-space-2"
        input={() => ({ noticeId, pinned: !pinned })}
        submitLabel={pinned ? 'Unpin notice' : 'Pin notice'}
        submitVariant="secondary"
      />
      <NoticeActionForm
        action={withdrawNoticeAction}
        className="grid gap-space-2"
        confirmMessage="Withdraw this notice? Residents will no longer see it."
        input={() => ({ noticeId })}
        submitLabel="Withdraw notice"
        submitVariant="destructive"
      />
    </div>
  );
}
