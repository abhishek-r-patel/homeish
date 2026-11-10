// Manage active blocks and units for the current society.
import { Card } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import {
  CreateBlockForm,
  CreateUnitForm,
  StructureRows,
  UnitImportControl,
} from '@/components/structure/structure-controls';
import { getStructure } from '@/core/structure/operations';
import { AppError } from '@/core/errors';

export const metadata = {
  title: 'Society Structure | Homeish',
  robots: { index: false, follow: false },
};

export default async function StructurePage() {
  let structure: Awaited<ReturnType<typeof getStructure>>;
  try {
    structure = await getStructure();
  } catch (error) {
    if (error instanceof AppError && error.code === 'FORBIDDEN') {
      return (
        <ErrorPanel
          message="Sign in with an administrator account for this society."
          title="Structure access is restricted"
        />
      );
    }
    throw error;
  }

  const { blocks, units } = structure;
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Society Structure</h1>
        <p className="text-body text-ink-muted">
          Manage blocks and units. Deactivated records remain available in
          history.
        </p>
      </header>
      <Card title="Add a block">
        <CreateBlockForm />
      </Card>
      <Card title="Add a unit">
        <CreateUnitForm blocks={blocks} />
      </Card>
      <Card
        title="Import units from CSV"
        description="Preview every row before importing. Maximum file size is 512 KB and 1,000 rows."
      >
        <UnitImportControl />
      </Card>
      <Card title="Current structure">
        <StructureRows blocks={blocks} units={units} />
      </Card>
    </section>
  );
}
