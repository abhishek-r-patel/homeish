// Show the society's asset register with search and filters to the admin and committee.
'use client';
import { useId, useState } from 'react';
import {
  ASSET_STATUS_LABELS,
  EMPTY_ASSET_FILTERS,
  WARRANTY_FILTER_LABELS,
  filterAssets,
  formatAssetDate,
  warrantyText,
  type AssetFilters,
  type WarrantyState,
} from '@/core/asset/presentation';
import {
  ASSET_STATUSES,
  type AssetStatus,
  type AssetWorkspace,
} from '@/core/asset/validation';
import { Card } from '@/components/ui/data-display';
import { EmptyState } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';
import { FilterBar } from '@/components/ui/table-controls';
import { ASSET_BASE_HREF, ASSET_LINK_CLASS } from './shared';

const WARRANTY_STATES: readonly WarrantyState[] = [
  'active',
  'ending_soon',
  'expired',
  'none',
];

export function AssetWorkspaceView({
  workspace,
  initialFilters = EMPTY_ASSET_FILTERS,
}: {
  workspace: AssetWorkspace;
  initialFilters?: AssetFilters;
}) {
  const id = useId();
  const [filters, setFilters] = useState<AssetFilters>(initialFilters);
  const visible = filterAssets(workspace.assets, filters, workspace.today);
  const categoryName = (categoryId: string) =>
    workspace.categories.find((category) => category.id === categoryId)?.name ??
    'Category';
  const applied = [
    filters.categoryId
      ? { id: 'categoryId', label: categoryName(filters.categoryId) }
      : null,
    filters.status
      ? { id: 'status', label: ASSET_STATUS_LABELS[filters.status] }
      : null,
    filters.warranty
      ? { id: 'warranty', label: WARRANTY_FILTER_LABELS[filters.warranty] }
      : null,
  ].filter((item): item is { id: string; label: string } => item !== null);
  const update = (patch: Partial<AssetFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Asset Register</h1>
        <p className="text-body text-ink-muted">
          Society equipment, where it is, its warranty and its maintenance
          history.{' '}
          {workspace.can_manage
            ? 'Only admins can change the register.'
            : 'You can view the register; an admin keeps it up to date.'}
        </p>
        <nav aria-label="Asset register" className="flex flex-wrap gap-space-4">
          {workspace.can_manage ? (
            <a href={`${ASSET_BASE_HREF}/new`} className={ASSET_LINK_CLASS}>
              Add an asset
            </a>
          ) : null}
          <a
            href={`${ASSET_BASE_HREF}/categories`}
            className={ASSET_LINK_CLASS}
          >
            {workspace.can_manage ? 'Manage categories' : 'View categories'}
          </a>
        </nav>
      </header>
      <Card
        title="Assets"
        description={`${workspace.assets.length} ${workspace.assets.length === 1 ? 'asset' : 'assets'} recorded. Retired assets are listed last.`}
      >
        {workspace.assets.length === 0 ? (
          <EmptyState
            title="No assets yet"
            description={
              workspace.can_manage
                ? workspace.categories.some((category) => category.active)
                  ? 'Add the first asset, such as a lift, pump or generator.'
                  : 'Add a category first, such as Lifts or Pumps, then add assets.'
                : 'An admin adds assets to the register.'
            }
          />
        ) : (
          <div className="grid min-w-0 gap-space-4">
            <FilterBar
              appliedFilters={applied}
              onClearAll={() =>
                setFilters({ ...EMPTY_ASSET_FILTERS, search: filters.search })
              }
              onRemoveFilter={(filterId) =>
                update({ [filterId]: '' } as Partial<AssetFilters>)
              }
              searchLabel="Search assets"
              searchValue={filters.search}
              onSearchChange={(search) => update({ search })}
            >
              <SelectInput
                id={`${id}-category`}
                label="Category"
                value={filters.categoryId}
                options={[
                  { value: '', label: 'All categories' },
                  ...workspace.categories.map((category) => ({
                    value: category.id,
                    label: category.active
                      ? category.name
                      : `${category.name} (inactive)`,
                  })),
                ]}
                onChange={(event) =>
                  update({ categoryId: event.currentTarget.value })
                }
              />
              <SelectInput
                id={`${id}-status`}
                label="Status"
                value={filters.status}
                options={[
                  { value: '', label: 'All statuses' },
                  ...ASSET_STATUSES.map((status) => ({
                    value: status,
                    label: ASSET_STATUS_LABELS[status],
                  })),
                ]}
                onChange={(event) =>
                  update({
                    status: event.currentTarget.value as AssetStatus | '',
                  })
                }
              />
              <SelectInput
                id={`${id}-warranty`}
                label="Warranty"
                value={filters.warranty}
                options={[
                  { value: '', label: 'Any warranty' },
                  ...WARRANTY_STATES.map((state) => ({
                    value: state,
                    label: WARRANTY_FILTER_LABELS[state],
                  })),
                ]}
                onChange={(event) =>
                  update({
                    warranty: event.currentTarget.value as WarrantyState | '',
                  })
                }
              />
            </FilterBar>
            <p role="status" className="text-caption text-ink-muted">
              Showing {visible.length} of {workspace.assets.length}.
              {workspace.truncated
                ? ' Only the first 1,000 assets are loaded, so search and filters cover those assets only.'
                : null}
            </p>
            {visible.length === 0 ? (
              <EmptyState
                title="No assets match"
                description="Change the search or clear the filters."
              />
            ) : (
              <ul className="grid gap-space-3">
                {visible.map((asset) => (
                  <li
                    key={asset.id}
                    className="grid min-w-0 gap-space-1 rounded-md border border-rule p-space-4"
                  >
                    <a
                      href={`${ASSET_BASE_HREF}/${asset.id}`}
                      className={`${ASSET_LINK_CLASS} text-body-strong break-words`}
                    >
                      {asset.name}
                    </a>
                    <p className="text-caption break-words text-ink-muted">
                      {asset.category_name} · {asset.location} ·{' '}
                      {ASSET_STATUS_LABELS[asset.status]}
                    </p>
                    <p className="text-caption break-words">
                      {warrantyText(asset.warranty_end_date, workspace.today)}
                      {asset.last_maintenance_on
                        ? ` · Last maintained ${formatAssetDate(asset.last_maintenance_on)}`
                        : ' · No maintenance recorded'}
                      {workspace.amc_enabled && asset.amc_linked
                        ? ' · Linked to an AMC'
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
