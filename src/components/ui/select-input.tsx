// Native select for short option lists with consistent field feedback.
'use client';

import type { SelectHTMLAttributes } from 'react';

export type SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

type SelectInputProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children' | 'id'
> & {
  error?: string;
  helpText?: string;
  id: string;
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
};

export function SelectInput({
  className = '',
  error,
  helpText,
  id,
  label,
  options,
  placeholder,
  required,
  ...selectProps
}: SelectInputProps) {
  const descriptionId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [selectProps['aria-describedby'], descriptionId, errorId]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-space-1">
      <label
        className="w-full min-w-0 break-words text-body-strong text-ink"
        htmlFor={id}
      >
        {label}
        {required ? ' (required)' : ''}
      </label>
      <div className="relative">
        <select
          {...selectProps}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={`min-h-12 w-full appearance-none rounded-md border bg-surface px-space-4 pr-space-8 text-body text-ink outline-none focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-disabled ${error ? 'border-danger' : 'border-rule-strong'} ${className}`}
          id={id}
          required={required}
        >
          {placeholder ? (
            <option disabled value="">
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option
              disabled={option.disabled}
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
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
      </div>
      {helpText ? (
        <p className="text-caption text-ink-muted" id={descriptionId}>
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
