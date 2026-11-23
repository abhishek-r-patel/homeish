// Show one unit's live records in the admin Structure workspace.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UnitRecordPanels } from '@/components/structure/unit-record-panels';
import { UnitPlacement } from '@/components/structure/unit-placement';
import { UnitHandoversPanel } from '@/components/structure/unit-handovers';
import { Card } from '@/components/ui/data-display';
import { Banner, ErrorPanel } from '@/components/ui/feedback';
import { AppError } from '@/core/errors';
import {
  formatLocalizedCurrency,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import { translateMessage } from '@/core/i18n/messages';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { getUnitWorkspace } from '@/core/structure/unit-workspace';
import {
  addUnitHandoverPhotoAction,
  closeUnitHandoverAction,
  createUnitHandoverAction,
  linkUnitHandoverReadingAction,
  saveUnitHandoverItemsAction,
  saveUnitHandoverTemplateAction,
} from '../../actions';

export const metadata = {
  title: 'Unit 360 | Homeish',
  robots: { index: false, follow: false },
};

export default async function UnitWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ building?: string | string[] }>;
}) {
  const { unitId } = await params;
  const { building } = await searchParams;
  const locale = await getRequestLocale();
  const t = (source: string, values?: Record<string, string | number>) =>
    translateMessage(locale, source, values);
  let workspace: Awaited<ReturnType<typeof getUnitWorkspace>>;
  try {
    workspace = await getUnitWorkspace(
      unitId,
      typeof building === 'string' ? building : undefined,
    );
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'NOT_FOUND') notFound();
      if (
        error.code === 'FORBIDDEN' ||
        error.code === 'UNAUTHENTICATED' ||
        error.code === 'SOCIETY_ARCHIVED'
      ) {
        return (
          <ErrorPanel
            title={t('Structure access is restricted')}
            message={t(
              'Sign in with an administrator account for this society.',
            )}
          />
        );
      }
    }
    throw error;
  }
  const {
    unit,
    block,
    occupancy,
    records,
    billing,
    parking,
    documents,
    canWrite,
  } = workspace;
  const linkStyle = 'inline-flex min-h-12 items-center text-brand underline';
  return (
    <section className="grid gap-space-5 [overflow-wrap:anywhere]">
      <header className="grid gap-space-1">
        <Link className={linkStyle} href="/admin/structure">
          {t('Society Structure')}
        </Link>
        <h1 className="text-title font-semibold">
          {t('Unit 360')}: {unit.number}
        </h1>
        <p>
          {block ?? t('No block')} ·{' '}
          {unit.floor === null
            ? t('Floor not recorded')
            : t('Floor {floor}', {
                floor: formatLocalizedNumber(unit.floor, locale),
              })}{' '}
          · {t(unit.active ? 'Active' : 'Inactive')}
        </p>
      </header>
      {!canWrite ? (
        <Banner tone="warning">{t('This society is read-only.')}</Banner>
      ) : null}
      <Card title={t('Current occupancy')}>
        <dl className="grid gap-space-2">
          <div>
            <dt>{t('Owners')}</dt>
            <dd>{formatLocalizedNumber(occupancy.owner, locale)}</dd>
          </div>
          <div>
            <dt>{t('Tenants')}</dt>
            <dd>{formatLocalizedNumber(occupancy.tenant, locale)}</dd>
          </div>
          <div>
            <dt>{t('Family members')}</dt>
            <dd>{formatLocalizedNumber(occupancy.family, locale)}</dd>
          </div>
        </dl>
        <p className="text-caption text-ink-muted">
          {t('Core occupancy is not proof of title or vacancy.')}
        </p>
      </Card>
      <Card title={t('Billing')}>
        {billing.kind === 'unavailable' ? (
          <p>{t('Unavailable')}</p>
        ) : (
          <>
            <p>
              {t('Ledger balance')}:{' '}
              {formatLocalizedCurrency(billing.data, locale)}
            </p>
            <Link
              className={linkStyle}
              href={`/admin/billing/units/${unit.id}`}
            >
              {t('Ledger')}
            </Link>
          </>
        )}
      </Card>
      <Card title={t('Parking')}>
        {parking.kind === 'unavailable' ? (
          <p>{t('Unavailable')}</p>
        ) : (
          <>
            {parking.data.length ? (
              <ul>
                {parking.data.map((slot) => (
                  <li key={slot.id}>{slot.label}</li>
                ))}
              </ul>
            ) : (
              <p>{t('No allocated parking slots.')}</p>
            )}
            <Link className={linkStyle} href="/admin/parking">
              {t('Parking')}
            </Link>
          </>
        )}
      </Card>
      <Card title={t('Documents')}>
        {documents.kind === 'unavailable' ? (
          <p>{t('Unavailable')}</p>
        ) : (
          <>
            {documents.data.items.length ? (
              <ul>
                {documents.data.items.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      className={linkStyle}
                      href={`/admin/documents?unit=${unit.id}&document=${doc.id}`}
                    >
                      {doc.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t('No unit documents are available.')}</p>
            )}
            <Link
              className={linkStyle}
              href={`/admin/documents?unit=${unit.id}`}
            >
              {t('Documents')} (
              {formatLocalizedNumber(documents.data.total, locale)})
            </Link>
          </>
        )}
      </Card>
      {records.placement || workspace.layout.buildings.length ? (
        <UnitPlacement
          key={workspace.layout.selected ?? 'none'}
          unitId={unit.id}
          placement={records.placement}
          layout={workspace.layout}
          canWrite={canWrite}
        />
      ) : null}
      <UnitRecordPanels unit={unit} records={records} canWrite={canWrite} />
      <UnitHandoversPanel
        unitId={unit.id}
        workspace={workspace.handovers}
        actions={{
          template: saveUnitHandoverTemplateAction,
          create: createUnitHandoverAction,
          items: saveUnitHandoverItemsAction,
          reading: linkUnitHandoverReadingAction,
          photo: addUnitHandoverPhotoAction,
          close: closeUnitHandoverAction,
        }}
      />
    </section>
  );
}
