// Compose and publish a new notice.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { NoticeForm } from '@/components/notices/notice-form';
import { getNoticeComposeOptions } from '@/core/notices/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { getNoticeReachAction } from '../actions';

export const metadata = {
  title: 'New notice | Homeish',
  robots: { index: false, follow: false },
};

export default async function NewNoticePage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const { blocks } = await getNoticeComposeOptions();

  return (
    <section className="grid min-w-0 max-w-content-narrow gap-space-5">
      <header className="grid gap-space-2">
        <Link className="text-body text-brand underline" href="/admin/notices">
          {t('Back to notices')}
        </Link>
        <h1 className="text-title font-semibold">{t('New notice')}</h1>
      </header>
      <Card className="min-w-0">
        <NoticeForm blocks={blocks} reachAction={getNoticeReachAction} />
      </Card>
    </section>
  );
}
