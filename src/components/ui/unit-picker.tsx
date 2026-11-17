// Block-first unit selection with the documented admin CSV-import guidance.
'use client';

import type { SelectOption } from './select-input';
import { Combobox } from './combobox';
import { useUiTranslator } from './language';

export type UnitBlock = {
  id: string;
  label: string;
  units: readonly SelectOption[];
};

export type UnitSelection = {
  blockId: string;
  unitId: string | null;
};

type UnitPickerProps = {
  blocks: readonly UnitBlock[];
  id: string;
  isAdmin?: boolean;
  onChange: (selection: UnitSelection | null) => void;
  required?: boolean;
  value: UnitSelection | null;
};

export function UnitPicker({
  blocks,
  id,
  isAdmin = false,
  onChange,
  required = false,
  value,
}: UnitPickerProps) {
  const { translate } = useUiTranslator();
  const blockOptions = blocks.map(({ id: blockId, label }) => ({
    label,
    value: blockId,
  }));
  const selectedBlock = blocks.find((block) => block.id === value?.blockId);

  return (
    <div className="grid gap-space-4">
      <Combobox
        id={`${id}-block`}
        label={translate('Block')}
        onChange={(blockId) =>
          onChange(blockId ? { blockId, unitId: null } : null)
        }
        options={blockOptions}
        placeholder={translate('Search blocks')}
        required={required}
        value={value?.blockId ?? null}
      />
      <Combobox
        disabled={!selectedBlock}
        emptyMessage={
          <>
            <p>{translate('No matching unit')}</p>
            {isAdmin ? (
              <p className="mt-space-1">
                {translate(
                  'Import the unit list from a CSV in society settings.',
                )}
              </p>
            ) : null}
          </>
        }
        id={`${id}-unit`}
        label={translate('Unit')}
        onChange={(unitId) =>
          selectedBlock && value ? onChange({ ...value, unitId }) : undefined
        }
        options={selectedBlock?.units ?? []}
        placeholder={translate(
          selectedBlock ? 'Search units' : 'Select a block first',
        )}
        required={required}
        value={value?.unitId ?? null}
      />
    </div>
  );
}
