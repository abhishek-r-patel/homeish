// Edit a published notice without notifying residents again.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Card } from '@/components/ui/data-display';
import { NoticeForm } from '@/components/notices/notice-form';
import {
  getNoticeComposeOptions,
  getNoticeDetail,
} from '@/core/notices/operations';

export const metadata = {
  title: 'Edit notice | Homeish',
  robots: { index: false, follow: false },
};

export default async function EditNoticePage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const { noticeId } = await params;
  if (!z.uuid().safeParse(noticeId).success) notFound();
  const [{ notice }, { blocks }] = await Promise.all([
    getNoticeDetail(noticeId),
    getNoticeComposeOptions(),
  ]);
  const backLink = (
    <Link
      className="text-body text-brand underline"
      href={`/admin/notices/${notice.id}`}
    >
      Back to notice
    </Link>
  );
  if (!notice.can_manage || notice.status === 'withdrawn') {
    return (
      <section className="grid min-w-0 gap-space-5">
        {backLink}
        <h1 className="text-title font-semibold">Edit notice</h1>
        <p className="text-body text-ink-muted">
          {notice.status === 'withdrawn'
            ? 'A withdrawn notice can no longer be edited.'
            : 'Only the author or an administrator can edit this notice.'}
        </p>
      </section>
    );
  }
  return (
    <section className="grid min-w-0 max-w-content-narrow gap-space-5">
      <header className="grid gap-space-2">
        {backLink}
        <h1 className="text-title font-semibold">Edit notice</h1>
      </header>
      <Card className="min-w-0">
        <NoticeForm blocks={blocks} notice={notice} />
      </Card>
    </section>
  );
}
