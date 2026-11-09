// Accessible data tables, sorting, filters and exact-total pagination.
'use client';

import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './button';
import { Dialog } from './dialog';
import type { ProductStatus } from './data-display';
import { StatusChip } from './data-display';
import { SearchInput } from './specialized-inputs';
import { SelectInput } from './select-input';

export type SortDirection = 'asc' | 'desc';

type SortHeaderProps = {
  direction: SortDirection | null;
  label: string;
  onSort: (direction: SortDirection) => void;
};

export function SortHeader({ direction, label, onSort }: SortHeaderProps) {
  const nextDirection = direction === 'asc' ? 'desc' : 'asc';
  const icon = direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕';

  return (
    <button
      aria-label={`Sort by ${label} ${nextDirection === 'asc' ? 'ascending' : 'descending'}`}
      className="inline-flex min-h-12 items-center gap-space-2 font-semibold text-ink hover:text-brand"
      onClick={() => onSort(nextDirection)}
      type="button"
    >
      {label}
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

export type DataTableColumn<Row> = {
  align?: 'left' | 'right';
  header: string;
  id: string;
  render: (row: Row) => ReactNode;
  sortKey?: string;
};

type DataTableProps<Row> = {
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  bulkActions?: ReactNode;
  getRowId: (row: Row) => string;
  getRowLabel: (row: Row) => string;
  getRowHref?: (row: Row) => string | undefined;
  mobilePrimary: (row: Row) => ReactNode;
  mobileSecondary?: (row: Row) => ReactNode;
  mobileStatus?: (row: Row) => ProductStatus | undefined;
  onSelectRow?: (id: string, selected: boolean) => void;
  onSort?: (key: string, direction: SortDirection) => void;
  rows: readonly Row[];
  scrollable?: boolean;
  selectedIds?: readonly string[];
  sort?: { direction: SortDirection; key: string };
};

export function DataTable<Row>({
  caption,
  columns,
  bulkActions,
  getRowHref,
  getRowId,
  getRowLabel,
  mobilePrimary,
  mobileSecondary,
  mobileStatus,
  onSelectRow,
  onSort,
  rows,
  scrollable = false,
  selectedIds = [],
  sort,
}: DataTableProps<Row>) {
  const selected = new Set(selectedIds);
  const selectionEnabled = onSelectRow !== undefined;
  const wrapperProps = scrollable
    ? {
        'aria-label': caption,
        role: 'region' as const,
        tabIndex: 0,
      }
    : {};

  return (
    <div className="grid gap-space-4">
      {selectionEnabled && selectedIds.length > 0 && bulkActions ? (
        <div
          aria-label="Bulk actions"
          className="flex flex-col gap-space-3 rounded-md border border-brand bg-brand-tint p-space-3 medium:flex-row medium:items-center medium:justify-between"
          role="region"
        >
          <p className="text-body-strong">{selectedIds.length} selected</p>
          <div className="flex flex-wrap gap-space-2">{bulkActions}</div>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-body text-ink-muted" role="status">
          No results.
        </p>
      ) : null}
      <div
        {...wrapperProps}
        className={`hidden overflow-x-auto medium:block ${scrollable ? 'rounded-md border border-rule' : ''}`}
      >
        <table className="min-w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-sunken text-subheading">
            <tr>
              {selectionEnabled ? (
                <th scope="col">
                  <span className="sr-only">Select row</span>
                </th>
              ) : null}
              {columns.map((column, index) => {
                const sortKey = column.sortKey;
                const direction =
                  sortKey && sort?.key === sortKey ? sort.direction : null;
                const ariaSort =
                  direction === 'asc'
                    ? 'ascending'
                    : direction === 'desc'
                      ? 'descending'
                      : 'none';
                return (
                  <th
                    aria-sort={column.sortKey ? ariaSort : undefined}
                    className={`border-b border-rule px-space-4 py-space-2 ${column.align === 'right' ? 'text-right' : 'text-left'} ${scrollable && index === 0 ? 'sticky left-0 z-10 bg-surface-sunken' : ''}`}
                    key={column.id}
                    scope="col"
                  >
                    {sortKey && onSort ? (
                      <SortHeader
                        direction={direction}
                        label={column.header}
                        onSort={(nextDirection) =>
                          onSort(sortKey, nextDirection)
                        }
                      />
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = getRowId(row);
              const isSelected = selected.has(id);
              return (
                <tr
                  className={`border-b border-rule hover:bg-brand-tint ${isSelected ? 'bg-brand-tint' : ''}`}
                  key={id}
                >
                  {selectionEnabled ? (
                    <td className="px-space-2 py-space-1">
                      <input
                        aria-label={`Select ${getRowLabel(row)}`}
                        checked={isSelected}
                        className="size-6 accent-brand"
                        onChange={(event) =>
                          onSelectRow?.(id, event.currentTarget.checked)
                        }
                        type="checkbox"
                      />
                    </td>
                  ) : null}
                  {columns.map((column, index) => {
                    const content = column.render(row);
                    const href = index === 0 ? getRowHref?.(row) : undefined;
                    return (
                      <td
                        className={`px-space-4 py-space-3 ${column.align === 'right' ? 'text-right tabular-nums' : 'text-left'} ${scrollable && index === 0 ? `sticky left-0 z-10 ${isSelected ? 'bg-brand-tint' : 'bg-surface'}` : ''} ${isSelected && index === 0 ? 'border-l-4 border-brand' : ''}`}
                        key={column.id}
                      >
                        {href ? (
                          <a
                            className="underline-offset-4 hover:underline focus-visible:underline"
                            href={href}
                          >
                            {content}
                          </a>
                        ) : (
                          content
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="grid medium:hidden">
        {rows.map((row) => {
          const id = getRowId(row);
          const isSelected = selected.has(id);
          const href = getRowHref?.(row);
          const status = mobileStatus?.(row);
          const content = (
            <span className="flex min-w-0 flex-1 items-start justify-between gap-space-3">
              <span className="min-w-0">
                <span className="block text-body-strong">
                  {mobilePrimary(row)}
                </span>
                {mobileSecondary ? (
                  <span className="mt-space-1 block text-caption text-ink-muted">
                    {mobileSecondary(row)}
                  </span>
                ) : null}
              </span>
              {status ? <StatusChip status={status} /> : null}
            </span>
          );
          return (
            <li
              className={`flex min-h-14 items-center gap-space-3 border-b border-rule px-space-3 py-space-2 ${isSelected ? 'border-l-4 border-brand bg-brand-tint' : 'border-l-4 border-transparent'}`}
              key={id}
            >
              {selectionEnabled ? (
                <input
                  aria-label={`Select ${getRowLabel(row)}`}
                  checked={isSelected}
                  className="size-6 shrink-0 accent-brand"
                  onChange={(event) =>
                    onSelectRow?.(id, event.currentTarget.checked)
                  }
                  type="checkbox"
                />
              ) : null}
              {href ? (
                <a className="flex min-w-0 flex-1 items-center" href={href}>
                  {content}
                  <span
                    aria-hidden="true"
                    className="ml-space-2 text-ink-muted"
                  >
                    ›
                  </span>
                </a>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type PageSize = 10 | 25 | 50 | 100;

type PaginationProps = {
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  page: number;
  pageSize: PageSize;
  total: number;
};

const pageSizeOptions: readonly PageSize[] = [10, 25, 50, 100];

function isPageSize(value: number): value is PageSize {
  return pageSizeOptions.some((pageSize) => pageSize === value);
}

export function Pagination({
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  total,
}: PaginationProps) {
  const id = useId();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-space-3 border-t border-rule py-space-4 expanded:flex-row expanded:items-center expanded:justify-between"
    >
      <p className="text-caption text-ink-muted" aria-live="polite">
        Page {page} of {totalPages} · {total} results
      </p>
      <div className="flex flex-wrap items-end gap-space-2">
        <SelectInput
          className="min-w-28"
          id={`page-size-${id}`}
          label="Rows per page"
          onChange={(event) => {
            const value = Number(event.currentTarget.value);
            if (isPageSize(value)) {
              onPageSizeChange(value);
            }
          }}
          options={pageSizeOptions.map((value) => ({
            label: String(value),
            value: String(value),
          }))}
          value={String(pageSize)}
        />
        <Button
          aria-label="First page"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          variant="secondary"
        >
          First
        </Button>
        <Button
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          variant="secondary"
        >
          Previous
        </Button>
        <Button
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          variant="secondary"
        >
          Next
        </Button>
        <Button
          aria-label="Last page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          variant="secondary"
        >
          Last
        </Button>
      </div>
    </nav>
  );
}

export type AppliedFilter = {
  id: string;
  label: string;
};

type FilterBarProps = {
  appliedFilters: readonly AppliedFilter[];
  children: ReactNode;
  onClearAll: () => void;
  onRemoveFilter: (id: string) => void;
  onSearchChange: (value: string) => void;
  searchLabel: string;
  searchValue: string;
};

export function FilterBar({
  appliedFilters,
  children,
  onClearAll,
  onRemoveFilter,
  onSearchChange,
  searchLabel,
  searchValue,
}: FilterBarProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="grid min-w-0 gap-space-3">
      <div className="flex min-w-0 flex-col gap-space-3 medium:flex-row medium:items-end">
        <div className="min-w-0 w-full flex-1">
          <SearchInput
            id={`list-search-${id}`}
            label={searchLabel}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            onClear={() => onSearchChange('')}
            value={searchValue}
          />
        </div>
        <Button
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={`filters-${id}`}
          buttonRef={triggerRef}
          onClick={() => setOpen(true)}
          variant="secondary"
        >
          Filters
          {appliedFilters.length > 0 ? ` (${appliedFilters.length})` : ''}
        </Button>
      </div>
      {appliedFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-space-2">
          {appliedFilters.map((filter) => (
            <span
              className="inline-flex min-h-12 items-center gap-space-1 rounded-sm bg-neutral-tint py-space-1 pl-space-3 pr-space-1 text-body"
              key={filter.id}
            >
              {filter.label}
              <Button
                aria-label={`Remove filter ${filter.label}`}
                iconOnly
                leadingIcon={<span aria-hidden="true">×</span>}
                onClick={() => onRemoveFilter(filter.id)}
                variant="tertiary"
              />
            </span>
          ))}
          <Button
            disabled={appliedFilters.length === 0}
            onClick={onClearAll}
            variant="tertiary"
          >
            Clear all
          </Button>
        </div>
      ) : (
        <Button disabled onClick={onClearAll} variant="tertiary">
          Clear all
        </Button>
      )}
      <Dialog
        className="medium:top-16 medium:left-auto medium:right-space-5 medium:translate-x-0 medium:translate-y-0 medium:max-w-content-narrow medium:backdrop:bg-transparent"
        id={`filters-${id}`}
        onOpenChange={setOpen}
        open={open}
        title="Filters"
      >
        {children}
        <div className="mt-space-4 flex justify-end">
          <Button onClick={() => setOpen(false)} variant="primary">
            Apply filters
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
