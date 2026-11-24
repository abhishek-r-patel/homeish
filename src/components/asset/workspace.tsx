// Show the society's asset register with search and filters to the admin and committee.
'use client';
import { useId, useState } from 'react';
import {
  ASSET_STATUS_LABELS,
  EMPTY_ASSET_FILTERS,
  WARRANTY_FILTER_LABELS,
  filterAssets,
  type AssetFilters,
  type WarrantyState,
} from '@/core/asset/presentation';
import {
  ASSET_STATUSES,
  type AssetStatus,
  type AssetWorkspace,
} from '@/core/asset/validation';
import { Card } from '@/components/ui/data-display';
import { BulkImportControl } from '@/components/home/bulk-import';
import { EmptyState } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';
import { FilterBar } from '@/components/ui/table-controls';
import {
  ASSET_BASE_HREF,
  ASSET_LINK_CLASS,
  assetDisplayDate,
  assetWarrantyText,
  useAssetCopy,
} from './shared';
import { formatLocalizedNumber } from '@/core/i18n/format';

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
  const { locale, t } = useAssetCopy();
  const id = useId();
  const [filters, setFilters] = useState<AssetFilters>(initialFilters);
  const visible = filterAssets(workspace.assets, filters, workspace.today);
  const categoryName = (categoryId: string) =>
    workspace.categories.find((category) => category.id === categoryId)?.name ??
    t('Category');
  const applied = [
    filters.categoryId
      ? { id: 'categoryId', label: categoryName(filters.categoryId) }
      : null,
    filters.status
      ? { id: 'status', label: t(ASSET_STATUS_LABELS[filters.status]) }
      : null,
    filters.warranty
      ? { id: 'warranty', label: t(WARRANTY_FILTER_LABELS[filters.warranty]) }
      : null,
  ].filter((item): item is { id: string; label: string } => item !== null);
  const update = (patch: Partial<AssetFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Asset Register')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Society equipment, where it is, its warranty and its maintenance history.',
          )}
          {workspace.can_manage
            ? ` ${t('Only admins can change the register.')}`
            : ` ${t('You can view the register; an admin keeps it up to date.')}`}
        </p>
        <nav
          aria-label={t('Asset register')}
          className="flex flex-wrap gap-space-4"
        >
          {workspace.can_manage ? (
            <a href={`${ASSET_BASE_HREF}/new`} className={ASSET_LINK_CLASS}>
              {t('Add an asset')}
            </a>
          ) : null}
          <a
            href={`${ASSET_BASE_HREF}/categories`}
            className={ASSET_LINK_CLASS}
          >
            {t(workspace.can_manage ? 'Manage categories' : 'View categories')}
          </a>
        </nav>
      </header>
      {workspace.can_manage ? (
        <Card
          title={t('Import assets from CSV')}
          description={t(
            'Preview every row, then save all asset records together or save none.',
          )}
        >
          <BulkImportControl kind="assets" />
        </Card>
      ) : null}
      <Card
        title={t('Assets')}
        description={t(
          '{count} assets recorded. Retired assets are listed last.',
          {
            count: formatLocalizedNumber(workspace.assets.length, locale),
          },
        )}
      >
        {workspace.assets.length === 0 ? (
          <EmptyState
            title={t('No assets yet')}
            description={
              workspace.can_manage
                ? workspace.categories.some((category) => category.active)
                  ? t('Add the first asset, such as a lift, pump or generator.')
                  : t(
                      'Add a category first, such as Lifts or Pumps, then add assets.',
                    )
                : t('An admin adds assets to the register.')
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
              searchLabel={t('Search assets')}
              searchValue={filters.search}
              onSearchChange={(search) => update({ search })}
            >
              <SelectInput
                id={`${id}-category`}
                label={t('Category')}
                value={filters.categoryId}
                options={[
                  { value: '', label: t('All categories') },
                  ...workspace.categories.map((category) => ({
                    value: category.id,
                    label: category.active
                      ? category.name
                      : t('{name} (inactive)', { name: category.name }),
                  })),
                ]}
                onChange={(event) =>
                  update({ categoryId: event.currentTarget.value })
                }
              />
              <SelectInput
                id={`${id}-status`}
                label={t('Status')}
                value={filters.status}
                options={[
                  { value: '', label: t('All statuses') },
                  ...ASSET_STATUSES.map((status) => ({
                    value: status,
                    label: t(ASSET_STATUS_LABELS[status]),
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
                label={t('Warranty')}
                value={filters.warranty}
                options={[
                  { value: '', label: t('Any warranty') },
                  ...WARRANTY_STATES.map((state) => ({
                    value: state,
                    label: t(WARRANTY_FILTER_LABELS[state]),
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
              {t('Showing {visible} of {total}.', {
                visible: formatLocalizedNumber(visible.length, locale),
                total: formatLocalizedNumber(workspace.assets.length, locale),
              })}
              {workspace.truncated
                ? ` ${t(
                    'Only the first {count} assets are loaded, so search and filters cover those assets only.',
                    {
                      count: formatLocalizedNumber(1000, locale),
                    },
                  )}`
                : null}
            </p>
            {visible.length === 0 ? (
              <EmptyState
                title={t('No assets match')}
                description={t('Change the search or clear the filters.')}
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
                      {t(ASSET_STATUS_LABELS[asset.status])}
                    </p>
                    <p className="text-caption break-words">
                      {assetWarrantyText(
                        asset.warranty_end_date,
                        workspace.today,
                        locale,
                        t,
                      )}
                      {asset.last_maintenance_on
                        ? ` · ${t('Last maintained {date}', { date: assetDisplayDate(asset.last_maintenance_on, locale) })}`
                        : ` · ${t('No maintenance recorded')}`}
                      {workspace.amc_enabled && asset.amc_linked
                        ? ` · ${t('Linked to an AMC')}`
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
