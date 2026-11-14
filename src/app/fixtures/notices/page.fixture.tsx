// Exercise notice composing and the resident board with synthetic in-memory data.
'use client';

import { useState } from 'react';
import { NoticeForm } from '@/components/notices/notice-form';
import { NoticeListItem } from '@/components/notices/notice-list-item';
import type { NoticeFormAction } from '@/components/notices/action-form';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { publicEnvironment } from '@/core/config/public-env';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  noticeCreateInputSchema,
  type Notice,
} from '@/core/notices/validation';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const authorId = '8a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const blocks = [
  { id: '9a696d6f-774c-41d1-ae47-6254d4a8f4cf', name: 'A' },
  { id: '9b696d6f-774c-41d1-ae47-6254d4a8f4cf', name: 'B' },
];

const existingNotice: Notice = {
  id: '6a696d6f-774c-41d1-ae47-6254d4a8f4cf',
  society_id: societyId,
  created_at: '2026-11-10T09:00:00.000Z',
  created_by: authorId,
  updated_at: '2026-11-10T09:00:00.000Z',
  title: 'Water tank cleaning',
  body: 'Water supply will be off on Sunday from 10 am to 2 pm.',
  audience: 'all',
  pinned: false,
  expires_at: null,
  status: 'published',
  edited_at: null,
  withdrawn_at: null,
  attachment_path: null,
  attachment_content_type: null,
  attachment_size_bytes: null,
  author_name: 'Society office',
  blocks: [],
  is_expired: false,
  has_read: true,
  read_count: 12,
  can_manage: true,
};

function failure(message: string): ServerActionResult<unknown> {
  return { ok: false, code: 'VALIDATION_FAILED', message };
}

export default function NoticesFixturePage() {
  const [notices, setNotices] = useState<Notice[]>([existingNotice]);

  const createAction: NoticeFormAction = async (formData) => {
    let input: unknown;
    try {
      input = JSON.parse(String(formData.get('input') ?? ''));
    } catch {
      return failure('The fixture notice was invalid.');
    }
    const parsed = noticeCreateInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure(
        parsed.error.issues[0]?.message ?? 'Check the notice details.',
      );
    }
    const { data } = parsed;
    const notice: Notice = {
      ...existingNotice,
      id: '7a696d6f-774c-41d1-ae47-6254d4a8f4cf',
      created_at: '2026-11-11T09:00:00.000Z',
      updated_at: '2026-11-11T09:00:00.000Z',
      title: data.title,
      body: data.body,
      audience: data.audience,
      blocks: blocks.filter(({ id }) => data.blockIds.includes(id)),
      pinned: data.pinned,
      expires_at: data.expiresAt,
      attachment_path: data.attachmentPath,
      attachment_content_type: data.attachmentPath ? 'application/pdf' : null,
      attachment_size_bytes: data.attachmentPath ? 1024 : null,
      has_read: false,
      read_count: 0,
    };
    setNotices((current) =>
      [notice, ...current].sort(
        (left, right) => Number(right.pinned) - Number(left.pinned),
      ),
    );
    return { ok: true, message: 'The notice was published.', data: notice };
  };

  return (
    <main
      className="mx-auto grid min-h-dvh w-full min-w-0 max-w-content-default grid-cols-1 gap-space-5 px-space-4 py-space-6 text-ink"
      data-storage-origin={
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      }
    >
      <Banner title="Synthetic notice board fixture" tone="info">
        Development-only in-memory data. No notice is written to a database.
        Reload to reset.
      </Banner>
      <h1 className="text-title font-semibold">Notice board</h1>
      <Card className="min-w-0" title="New notice">
        <NoticeForm action={createAction} blocks={blocks} onSaved={() => {}} />
      </Card>
      <section
        aria-label="Current notices"
        className="grid min-w-0 gap-space-3"
      >
        <h2 className="text-heading font-semibold">Current notices</h2>
        <ul className="grid gap-space-3">
          {notices.map((notice) => (
            <NoticeListItem
              href="/fixtures/notices"
              key={notice.id}
              notice={notice}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}
