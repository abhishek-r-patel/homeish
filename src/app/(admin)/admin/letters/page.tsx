// Show the admin and committee letter maker with sources the viewer can already read.
import { LettersWorkspace } from '@/components/letters/letters-workspace';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { getLettersWorkspace } from '@/core/letters/operations';

export const metadata = {
  title: 'Letters | Homeish',
  robots: { index: false, follow: false },
};

export default async function LettersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; source?: string; date?: string }>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  const search = await searchParams;
  const workspace = await getLettersWorkspace(search.date);
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <div className="grid gap-space-1">
        <h1 className="text-title font-semibold">{t('Letters')}</h1>
        <p className="text-caption text-ink-muted">
          {t(
            'Prepare a draft letter on the society letterhead, review it and download a PDF. Homeish does not send or store the letter.',
          )}
        </p>
      </div>
      <LettersWorkspace
        key={`${search.type ?? ''}:${search.source ?? ''}:${workspace.amenityDate}`}
        workspace={workspace}
        initialType={search.type}
        initialSourceId={search.source}
      />
    </section>
  );
}
