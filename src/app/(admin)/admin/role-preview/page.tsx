// Preview the active society's role navigation without impersonation or real data.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { Banner } from '@/components/ui/feedback';
import { AppError, createRequestId } from '@/core/errors';
import {
  buildRolePreview,
  parseRolePreviewRole,
  ROLE_PREVIEW_LABELS,
  ROLE_PREVIEW_ROLES,
} from '@/core/home/role-preview';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Role preview | Homeish',
  robots: { index: false, follow: false },
};

export default async function RolePreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  const context = await buildRequestContext(createRequestId());
  if (!context.roles.includes('admin')) throw new AppError('FORBIDDEN');
  const params = await searchParams;
  const role = parseRolePreviewRole(params.role);
  const preview = buildRolePreview(role, [...context.enabledModules]);

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Role preview')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Check what another role can navigate to in this society. No real person is signed in.',
          )}
        </p>
      </header>
      <form className="flex max-w-sm flex-wrap items-end gap-space-3">
        <label className="grid flex-1 gap-space-1 text-body-strong">
          {t('Role')}
          <select
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
            defaultValue={role}
            name="role"
          >
            {ROLE_PREVIEW_ROLES.map((value) => (
              <option key={value} value={value}>
                {t(ROLE_PREVIEW_LABELS[value])}
              </option>
            ))}
          </select>
        </label>
        <button
          className="min-h-12 rounded-md border border-brand bg-brand px-space-4 font-semibold text-on-brand"
          type="submit"
        >
          {t('Preview role')}
        </button>
      </form>
      <Banner tone="info" title={t('Preview only')}>
        {t('Nothing inside the frame can be opened, pressed or saved.')}
      </Banner>
      <div className="grid items-start gap-space-5 expanded:grid-cols-[minmax(0,24rem)_1fr]">
        <Card title={t('{role} phone preview', { role: t(preview.label) })}>
          <div
            aria-hidden="true"
            className="mx-auto grid min-h-[44rem] w-full max-w-sm content-start gap-space-4 overflow-hidden rounded-lg border-8 border-ink bg-paper p-space-4 shadow-card"
            inert
          >
            <div className="grid gap-space-1 border-b border-rule pb-space-3">
              <p className="text-caption font-semibold text-brand">
                {t('Synthetic role preview')}
              </p>
              <p className="text-title font-semibold">
                {t('{role} Home', { role: t(preview.label) })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-space-2">
              {preview.actions.slice(0, 4).map((action) => (
                <div
                  className="grid min-h-20 content-between rounded-md border border-rule bg-surface p-space-3 text-caption font-semibold"
                  key={action}
                >
                  <span className="text-brand">→</span>
                  {action}
                </div>
              ))}
            </div>
            <div className="grid gap-space-2">
              {preview.groups.map((group) => (
                <div
                  className="rounded-md border border-rule bg-surface p-space-3"
                  key={group.name}
                >
                  <p className="text-caption font-semibold">{group.name}</p>
                  <p className="mt-space-1 text-micro text-ink-muted">
                    {group.items.join(' · ')}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-auto flex justify-around rounded-md border border-rule bg-surface p-space-2 text-micro">
              {preview.tabs.map((tab) => (
                <span key={tab}>{tab}</span>
              ))}
            </div>
          </div>
        </Card>
        <Card title={t('Accessible text list')}>
          <div className="grid gap-space-5">
            <section>
              <h2 className="text-body-strong">{t('Phone tabs')}</h2>
              <p className="mt-space-2 text-body text-ink-muted">
                {preview.tabs.map((tab) => t(tab)).join(', ') ||
                  t('No tabs for this role')}
              </p>
            </section>
            <section>
              <h2 className="text-body-strong">{t('Available actions')}</h2>
              <ul className="mt-space-2 list-disc pl-space-5 text-body">
                {preview.actions.length ? (
                  preview.actions.map((action) => (
                    <li key={action}>{t(action)}</li>
                  ))
                ) : (
                  <li>{t('No quick actions')}</li>
                )}
              </ul>
            </section>
            {preview.groups.map((group) => (
              <section key={group.name}>
                <h2 className="text-body-strong">{t(group.name)}</h2>
                <ul className="mt-space-2 list-disc pl-space-5 text-body">
                  {group.items.map((item) => (
                    <li key={item}>{t(item)}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Card>
      </div>
      <Link className="text-body text-brand underline" href="/admin/history">
        {t('Review change history')}
      </Link>
    </section>
  );
}
