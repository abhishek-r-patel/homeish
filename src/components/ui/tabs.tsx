// Keyboard-accessible tabs and segmented choices for related views and filters.
'use client';

import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export type TabItem = {
  id: string;
  label: string;
  panel: ReactNode;
};

type TabsProps = {
  items: readonly TabItem[];
  label: string;
  onChange: (id: string) => void;
  value: string;
};

export function Tabs({ items, label, onChange, value }: TabsProps) {
  const id = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = items.findIndex((item) => item.id === value);

  if (items.length === 0) {
    return null;
  }
  if (selectedIndex < 0) {
    throw new RangeError('The selected tab must match an item ID.');
  }

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      tabRefs.current[nextIndex]?.focus();
    }
  }

  const selected = items[selectedIndex];

  return (
    <div className="w-full min-w-0">
      <div className="relative min-w-0 after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-space-5 after:bg-gradient-to-l after:from-paper after:to-transparent medium:after:hidden">
        <div
          aria-label={label}
          aria-orientation="horizontal"
          className="flex min-w-0 overflow-x-auto border-b border-rule"
          role="tablist"
        >
          {items.map((item, index) => {
            const selectedTab = index === selectedIndex;
            return (
              <button
                aria-controls={`${id}-panel-${item.id}`}
                aria-selected={selectedTab}
                className={`min-h-12 shrink-0 whitespace-nowrap border-b-2 px-space-4 text-body ${selectedTab ? 'border-brand font-semibold text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}
                id={`${id}-tab-${item.id}`}
                key={item.id}
                onClick={() => onChange(item.id)}
                onKeyDown={(event) => moveFocus(event, index)}
                role="tab"
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                tabIndex={selectedTab ? 0 : -1}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <div
        aria-labelledby={`${id}-tab-${selected.id}`}
        className="pt-space-4"
        id={`${id}-panel-${selected.id}`}
        role="tabpanel"
        tabIndex={0}
      >
        {selected.panel}
      </div>
    </div>
  );
}

export type SegmentOption = {
  id: string;
  label: string;
};

type SegmentedControlProps = {
  label: string;
  onChange: (id: string) => void;
  options: readonly SegmentOption[];
  value: string;
};

export function SegmentedControl({
  label,
  onChange,
  options,
  value,
}: SegmentedControlProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.id === value);

  if (options.length > 5) {
    throw new RangeError(
      'Use a select input when a segmented control has more than five options.',
    );
  }
  if (options.length > 0 && selectedIndex < 0) {
    throw new RangeError('The selected segment must match an option ID.');
  }

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = options.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      buttonRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div
      aria-label={label}
      className="inline-flex max-w-full overflow-x-auto rounded-md border border-rule-strong bg-surface p-space-1"
      role="group"
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            aria-pressed={selected}
            className={`min-h-12 shrink-0 whitespace-nowrap rounded-sm border px-space-3 text-body ${selected ? 'border-brand bg-brand-tint font-semibold text-brand' : 'border-transparent text-ink hover:bg-surface-sunken'}`}
            key={option.id}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => moveFocus(event, index)}
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

type DateRangePreset = 'today' | '7days' | 'month' | 'custom';

type DateRangePresetsProps = {
  onChange: (preset: DateRangePreset) => void;
  value: DateRangePreset;
};

const dateRangeOptions: readonly (SegmentOption & { id: DateRangePreset })[] = [
  { id: 'today', label: 'Today' },
  { id: '7days', label: '7 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

export function DateRangePresets({ onChange, value }: DateRangePresetsProps) {
  return (
    <SegmentedControl
      label="Date range"
      onChange={(id) => {
        if (
          id === 'today' ||
          id === '7days' ||
          id === 'month' ||
          id === 'custom'
        ) {
          onChange(id);
        }
      }}
      options={dateRangeOptions}
      value={value}
    />
  );
}
