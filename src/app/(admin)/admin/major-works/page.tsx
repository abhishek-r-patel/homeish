// Show P50.1 repair projects, approved budget sources and source-linked spend.
import Link from 'next/link';
import { Banner } from '@/components/ui/feedback';
import { MajorWorksProjectList } from '@/components/major-works/project-list';
import { listMajorWorksProjects } from '@/core/major-works/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Major works | Homeish',
  robots: { index: false, follow: false },
};

export default async function MajorWorksPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const data = await listMajorWorksProjects();
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Major works')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Track repair projects, recorded approvals, budgets and Accounts-linked spend without approving work in Homeish.',
          )}
        </p>
        <Link className="text-brand underline" href="/admin/major-works/audits">
          {t('Structural audits')}
        </Link>
        <Link
          className="text-brand underline"
          href="/admin/major-works/summary"
        >
          {t('Summary')}
        </Link>
        <Link
          className="text-brand underline"
          href="/admin/major-works/redevelopment"
        >
          {t('Redevelopment')}
        </Link>
      </header>
      <Banner title={t('Record only')} tone="warning">
        {t(
          'Homeish does not approve work, create bills or change Accounts. Approval links record the society’s decision from elsewhere.',
        )}
      </Banner>
      <MajorWorksProjectList data={data} locale={locale} />
    </section>
  );
}
