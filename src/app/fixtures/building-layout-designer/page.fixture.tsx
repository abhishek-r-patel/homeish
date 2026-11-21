// Render the real building layout designer with synthetic data for local browser coverage only.
import { BuildingLayoutDesigner } from '@/components/structure/building-layout-designer';
import { fixtureLayout } from './synthetic-layout';

export default async function BuildingLayoutDesignerFixture({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; building?: string; empty?: string }>;
}) {
  const { role, building, empty } = await searchParams;
  const layout = fixtureLayout(building, empty !== undefined);
  return (
    <main className="mx-auto grid max-w-content-wide gap-space-5 p-space-4">
      <h1 className="text-title">Society Structure</h1>
      <BuildingLayoutDesigner
        key={`${role}-${layout.selected}`}
        layout={layout}
        canEdit={role !== 'committee'}
        canOpenUnits={role !== 'committee'}
        basePath="/fixtures/building-layout-designer"
      />
    </main>
  );
}
