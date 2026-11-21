// Draw one building's floors and spots for the layout designer and the Unit 360 spot picker.
'use client';

import { Fragment } from 'react';
import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedNumber } from '@/core/i18n/format';
import {
  KIND_NAMES,
  MAX_BASEMENTS,
  MAX_FLOORS,
  MAX_SPACES,
  SPACE_KINDS,
  columnsOf,
  type LayoutFloor,
  type LayoutSpace,
  type SpaceKind,
} from '@/core/structure/building-layout';

export const KIND_STYLES: Record<SpaceKind, string> = {
  unit: 'rounded-t-md border-2 border-b-4 border-rule-strong bg-surface',
  parking: 'rounded-md border-2 border-rule-strong bg-neutral-tint',
  amenity: 'rounded-md border-2 border-success bg-success-tint',
  shop: 'rounded-md border-2 border-warning bg-warning-tint',
  service: 'rounded-md border-2 border-dashed border-rule-strong bg-paper',
  gap: 'rounded-md border-2 border-dashed border-rule bg-transparent',
};

export function useLayoutNames() {
  const { translate: t, locale } = useUiTranslator();
  const number = (value: number) =>
    formatLocalizedNumber(value, locale ?? 'en');
  const defaultFloorName = (level: number) =>
    level < 0
      ? t('Basement {number}', { number: number(-level) })
      : level === 0
        ? t('Ground')
        : t('Floor {floor}', { floor: number(level) });
  const floorName = (floor: Pick<LayoutFloor, 'label' | 'level'>) =>
    floor.label.trim() || defaultFloorName(floor.level);
  const kindName = (kind: SpaceKind) => t(KIND_NAMES[kind]);
  const spaceName = (space: LayoutSpace) =>
    space.kind === 'unit' || space.kind === 'upper'
      ? space.unit
        ? t('Unit {unit}', { unit: space.unit.number })
        : t('Free unit spot')
      : space.name.trim() || kindName(space.kind);
  // Older drafts saved the English type name as the name; show it only once.
  const wholeUseName = (space: LayoutSpace, separator: string) => {
    if (space.kind === 'upper') return spaceName(space);
    const name = space.name.trim();
    const kind = kindName(space.kind);
    const repeatsKind = [KIND_NAMES[space.kind], kind].some(
      (value) => value.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    return name && !repeatsKind ? `${kind}${separator}${name}` : kind;
  };
  return {
    t,
    number,
    defaultFloorName,
    floorName,
    kindName,
    spaceName,
    wholeUseName,
  };
}

function PlusButton({
  label,
  disabled,
  tooltipAbove = false,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  tooltipAbove?: boolean;
  onClick: () => void;
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-brand bg-surface text-brand outline-none hover:bg-brand-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="size-5"
        >
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none invisible absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-space-2 py-space-1 text-caption text-surface group-focus-within:visible group-hover:visible ${tooltipAbove ? 'bottom-full mb-space-1' : 'top-full mt-space-1'}`}
      >
        {label}
      </span>
    </span>
  );
}

export function BuildingDrawing({
  name,
  floors,
  mode,
  selectedFloor,
  selectedSpace,
  currentUnitId,
  onFloor,
  onSpace,
  onAddFloor,
  onAddBasement,
  onAddSpace,
}: {
  name: string;
  floors: LayoutFloor[];
  mode: 'view' | 'edit' | 'pick';
  selectedFloor?: string;
  selectedSpace?: string;
  currentUnitId?: string;
  onFloor?: (floorKey: string) => void;
  onSpace: (floorKey: string, spaceKey: string) => void;
  onAddFloor?: () => void;
  onAddBasement?: () => void;
  onAddSpace?: (floorKey: string) => void;
}) {
  const { t, number, floorName, kindName, spaceName, wholeUseName } =
    useLayoutNames();
  const editing = mode === 'edit';
  const columns = columnsOf(floors);
  const gridColumns = editing ? columns + 1 : columns;
  const spaces = floors.flatMap((floor) => floor.spaces);
  const aboveGround = floors.filter(({ level }) => level > 0).length;
  const basements = floors.filter(({ level }) => level < 0).length;
  return (
    <div className="max-w-full overflow-x-auto p-space-2">
      <div className="w-max">
        <div className="relative mx-space-5 flex h-14 items-end justify-between border-x-4 border-t-4 border-rule-strong bg-surface-sunken px-space-4">
          <span
            aria-hidden="true"
            className="h-5 w-10 border-x-2 border-t-2 border-rule-strong bg-surface"
          />
          {editing && onAddFloor ? (
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <PlusButton
                label={t('Add new floor on top')}
                disabled={aboveGround >= MAX_FLOORS}
                onClick={onAddFloor}
              />
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className="h-6 w-14 rounded-t-md border-2 border-rule-strong bg-surface"
          />
        </div>
        <div className="border-x-4 border-t-8 border-rule-strong bg-surface-sunken">
          <div className="flex flex-wrap items-center justify-between gap-x-space-4 border-b-4 border-rule-strong p-space-3">
            <span className="text-body-strong">{name}</span>
            <span className="text-caption text-ink-muted">
              {t(
                '{floors} floors · {basements} basements · {placed} units placed · {free} free spots',
                {
                  floors: number(aboveGround),
                  basements: number(basements),
                  placed: number(spaces.filter(({ unit }) => unit).length),
                  free: number(
                    spaces.filter(({ kind, unit }) => kind === 'unit' && !unit)
                      .length,
                  ),
                },
              )}
            </span>
          </div>
          <div
            className="grid px-space-2"
            style={{
              gridTemplateColumns: `9rem repeat(${gridColumns}, 6rem)`,
              gridAutoRows: '4rem',
            }}
          >
            {floors.map((row, index) => {
              const selectedRow = row.key === selectedFloor && !selectedSpace;
              const rowName = floorName(row);
              return (
                <Fragment key={row.key}>
                  <div
                    aria-hidden="true"
                    style={{ gridRow: index + 1, gridColumn: '1 / -1' }}
                    className={`border-b-4 ${row.level === 0 ? 'border-rule-strong' : 'border-rule'} ${row.level < 0 ? 'bg-neutral-tint' : ''} ${selectedRow ? 'bg-surface ring-2 ring-inset ring-brand' : ''}`}
                  />
                  {onFloor ? (
                    <button
                      type="button"
                      aria-label={
                        editing
                          ? t('Edit {floor}', { floor: rowName })
                          : rowName
                      }
                      aria-pressed={selectedRow}
                      onClick={() => onFloor(row.key)}
                      style={{ gridRow: index + 1, gridColumn: 1 }}
                      className="relative z-10 m-space-1 flex min-w-0 items-center rounded-md px-space-1 text-left text-body-strong text-brand outline-none hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <span className="truncate">{rowName}</span>
                    </button>
                  ) : (
                    <span
                      style={{ gridRow: index + 1, gridColumn: 1 }}
                      className="relative z-10 m-space-1 flex min-w-0 items-center px-space-1 text-body-strong"
                    >
                      <span className="truncate">{rowName}</span>
                    </span>
                  )}
                  {row.spaces.map((cell, position) => {
                    if (cell.kind === 'upper') return null;
                    const description = row.whole
                      ? t('{floor}, whole floor: {use}', {
                          floor: rowName,
                          use: wholeUseName(cell, ', '),
                        })
                      : t('{floor}, spot {spot}: {space}', {
                          floor: rowName,
                          spot: number(position + 1),
                          space: cell.duplex
                            ? t('Duplex with {floor}, {space}', {
                                floor: floorName(floors[index - 1] ?? row),
                                space: spaceName(cell),
                              })
                            : spaceName(cell),
                        });
                    const current = Boolean(
                      currentUnitId && cell.unit?.id === currentUnitId,
                    );
                    const pickable =
                      mode !== 'pick' ||
                      (cell.kind === 'unit' && (!cell.unit || current));
                    const label =
                      mode === 'edit'
                        ? t('Edit {label}', { label: description })
                        : mode === 'pick' && current
                          ? t('Current spot: {label}', { label: description })
                          : mode === 'pick' && pickable
                            ? t('Place here: {label}', { label: description })
                            : description;
                    const selectedCell =
                      cell.key === selectedSpace ||
                      (mode === 'pick' && current);
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        aria-label={label}
                        title={description}
                        aria-pressed={selectedCell}
                        disabled={!pickable}
                        onClick={() =>
                          row.whole && onFloor
                            ? onFloor(row.key)
                            : onSpace(row.key, cell.key)
                        }
                        style={{
                          gridRow: cell.duplex
                            ? `${index} / span 2`
                            : index + 1,
                          gridColumn: row.whole
                            ? `2 / span ${columns}`
                            : position + 2,
                        }}
                        className={`relative z-10 m-space-1 flex min-w-0 flex-col items-center justify-center overflow-hidden px-space-2 text-center text-caption font-semibold leading-tight text-ink outline-none hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 ${cell.duplex ? 'rounded-t-md border-2 border-b-4 border-brand bg-brand-tint' : KIND_STYLES[cell.kind]} ${selectedCell ? 'ring-4 ring-brand' : ''}`}
                      >
                        <span className="line-clamp-2 break-words">
                          {row.whole
                            ? wholeUseName(cell, ' · ')
                            : cell.kind === 'unit'
                              ? (cell.unit?.number ?? '—')
                              : cell.kind === 'gap'
                                ? ''
                                : cell.name.trim() || kindName(cell.kind)}
                        </span>
                        {cell.duplex ? (
                          <span className="font-normal text-ink-muted">
                            {t('Duplex')}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                  {editing && onAddSpace && !row.whole ? (
                    <div
                      style={{
                        gridRow: index + 1,
                        gridColumn: row.spaces.length + 2,
                      }}
                      className="relative z-10 flex items-center justify-center"
                    >
                      <PlusButton
                        label={t('Add new unit spot to {floor}', {
                          floor: rowName,
                        })}
                        tooltipAbove
                        disabled={row.spaces.length >= MAX_SPACES}
                        onClick={() => onAddSpace(row.key)}
                      />
                    </div>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
          <div className="relative flex h-14 items-end justify-center">
            <span
              aria-hidden="true"
              className="h-8 w-16 border-x-4 border-t-4 border-rule-strong bg-surface"
            />
            {editing && onAddBasement ? (
              <span className="absolute left-space-3 top-1/2 -translate-y-1/2">
                <PlusButton
                  label={t('Add basement below')}
                  tooltipAbove
                  disabled={basements >= MAX_BASEMENTS}
                  onClick={onAddBasement}
                />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LayoutLegend() {
  const { t, kindName } = useLayoutNames();
  return (
    <ul
      aria-label={t('Legend')}
      className="flex flex-wrap gap-space-3 text-caption text-ink-muted"
    >
      {SPACE_KINDS.map((kind) => (
        <li key={kind} className="flex items-center gap-space-1">
          <span aria-hidden="true" className={`size-4 ${KIND_STYLES[kind]}`} />
          {kindName(kind)}
        </li>
      ))}
      <li className="flex items-center gap-space-1">
        <span
          aria-hidden="true"
          className="h-6 w-4 rounded-t-md border-2 border-brand bg-brand-tint"
        />
        {t('Duplex (two floors)')}
      </li>
    </ul>
  );
}
