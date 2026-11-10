// Searchable accessible option picker with a compact bottom sheet and desktop popover.
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import type { SelectOption } from './select-input';

type ComboboxProps = {
  disabled?: boolean;
  emptyMessage?: ReactNode;
  error?: string;
  helpText?: string;
  id: string;
  label: string;
  onChange: (value: string | null) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  required?: boolean;
  value: string | null;
};

export function Combobox({
  disabled = false,
  emptyMessage = 'No matching options',
  error,
  helpText,
  id,
  label,
  onChange,
  options,
  placeholder = 'Search options',
  required = false,
  value,
}: ComboboxProps) {
  const reactId = useId();
  const listboxId = `${id}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const activeOption = filteredOptions[activeIndex];
  const helpId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [isOpen]);

  function openOptions() {
    setQuery(selected?.label ?? '');
    setActiveIndex(0);
    setIsOpen(true);
  }

  function chooseOption(option: SelectOption) {
    onChange(option.value);
    setQuery(option.label);
    setIsOpen(false);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.currentTarget.value);
    setActiveIndex(0);
    setIsOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        openOptions();
      } else {
        setActiveIndex((index) =>
          Math.min(index + 1, filteredOptions.length - 1),
        );
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (isOpen) {
        setActiveIndex((index) => Math.max(index - 1, 0));
      }
    } else if (event.key === 'Enter' && isOpen && activeOption) {
      event.preventDefault();
      chooseOption(activeOption);
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      setQuery(selected?.label ?? '');
    } else if (event.key === 'Tab') {
      setIsOpen(false);
    }
  }

  return (
    <div className="grid gap-space-1">
      <label className="text-body-strong text-ink" htmlFor={id}>
        {label}
        {required ? ' (required)' : ''}
      </label>
      <div className="relative" ref={containerRef}>
        <input
          aria-activedescendant={
            isOpen && activeOption
              ? `${reactId}-option-${activeIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-controls={isOpen ? listboxId : undefined}
          aria-describedby={describedBy}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          className={`min-h-12 w-full rounded-md border bg-surface px-space-4 pr-space-8 text-body text-ink outline-none focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-disabled ${error ? 'border-danger' : 'border-rule-strong'}`}
          disabled={disabled}
          id={id}
          onChange={handleChange}
          onFocus={openOptions}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          value={isOpen ? query : (selected?.label ?? '')}
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-space-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
        {isOpen ? (
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-96 overflow-auto rounded-t-lg border border-rule bg-surface p-space-2 shadow-overlay medium:absolute medium:inset-x-0 medium:top-full medium:bottom-auto medium:mt-space-1 medium:rounded-md">
            {filteredOptions.length > 0 ? (
              <div
                aria-label={`${label} options`}
                id={listboxId}
                role="listbox"
              >
                {filteredOptions.map((option, index) => (
                  <div
                    aria-selected={value === option.value}
                    className={`flex min-h-12 cursor-pointer items-center justify-between rounded-md px-space-4 text-body ${activeIndex === index ? 'bg-brand-tint text-ink' : 'text-ink hover:bg-surface-sunken'}`}
                    id={`${reactId}-option-${index}`}
                    key={option.value}
                    onClick={() => chooseOption(option)}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    role="option"
                  >
                    {option.label}
                    {value === option.value ? (
                      <span aria-hidden="true" className="text-brand">
                        ✓
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="px-space-4 py-space-3 text-body text-ink-muted"
                role="status"
              >
                {emptyMessage}
              </div>
            )}
          </div>
        ) : null}
      </div>
      <p aria-live="polite" className="sr-only">
        {isOpen
          ? `${filteredOptions.length} result${filteredOptions.length === 1 ? '' : 's'} available`
          : ''}
      </p>
      {helpText ? (
        <p className="text-caption text-ink-muted" id={helpId}>
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p className="text-caption text-danger" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
