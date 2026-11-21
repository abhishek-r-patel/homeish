// Show the building layout to admins and committee; admins also manage blocks and units here.
import { BuildingLayoutDesigner } from '@/components/structure/building-layout-designer';
import { Card } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import {
  CreateBlockForm,
  CreateUnitForm,
  StructureRows,
  UnitImportControl,
} from '@/components/structure/structure-controls';
import { getBuildingLayout } from '@/core/structure/building-layout-operations';
import { getStructure } from '@/core/structure/operations';
import { AppError } from '@/core/errors';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Society Structure | Homeish',
  robots: { index: false, follow: false },
};

export default async function StructurePage({
  searchParams,
}: {
  searchParams: Promise<{ building?: string | string[] }>;
}) {
  const locale = await getRequestLocale();
  const { building } = await searchParams;
  const t = (source: string) => translateMessage(locale, source);
  let view: Awaited<ReturnType<typeof getBuildingLayout>>;
  let structure: Awaited<ReturnType<typeof getStructure>> | null = null;
  try {
    view = await getBuildingLayout(building);
    if (view.isAdmin) structure = await getStructure();
  } catch (error) {
    if (error instanceof AppError && error.code === 'FORBIDDEN') {
      return (
        <ErrorPanel
          message={t('Sign in with an administrator account for this society.')}
          title={t('Structure access is restricted')}
        />
      );
    }
    throw error;
  }

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Society Structure')}</h1>
        <p className="text-body text-ink-muted">
          {structure
            ? t(
                'Manage blocks and units. Deactivated records remain available in history.',
              )
            : t('See how each building is laid out floor by floor.')}
        </p>
      </header>
      <BuildingLayoutDesigner
        key={view.layout.selected ?? 'none'}
        layout={view.layout}
        canEdit={view.canEdit}
        canOpenUnits={view.isAdmin}
        basePath="/admin/structure"
      />
      {structure ? (
        <>
          <Card title={t('Add a block')}>
            <CreateBlockForm />
          </Card>
          <Card title={t('Add a unit')}>
            <CreateUnitForm blocks={structure.blocks} />
          </Card>
          <Card
            title={t('Import units from CSV')}
            description={t(
              'Preview every row before importing. Maximum file size is 512 KB and 1,000 rows.',
            )}
          >
            <UnitImportControl />
          </Card>
          <Card title={t('Current structure')}>
            <StructureRows blocks={structure.blocks} units={structure.units} />
          </Card>
        </>
      ) : null}
    </section>
  );
}
