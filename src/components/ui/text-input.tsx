// Shared labelled input with accessible helper, error and adornment slots.
'use client';

import type { InputHTMLAttributes, ReactNode, Ref } from 'react';

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  endAdornment?: ReactNode;
  error?: string;
  helpText?: string;
  id: string;
  inputRef?: Ref<HTMLInputElement>;
  label: string;
  startAdornment?: ReactNode;
};

export function TextInput({
  className = '',
  endAdornment,
  error,
  helpText,
  id,
  inputRef,
  label,
  required,
  startAdornment,
  ...inputProps
}: TextInputProps) {
  const descriptionId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [inputProps['aria-describedby'], descriptionId, errorId]
      .filter(Boolean)
      .join(' ') || undefined;
  const controlStyle = inputProps.readOnly
    ? 'border-transparent bg-surface-sunken'
    : error
      ? 'border-danger bg-surface focus-within:outline-focus'
      : 'border-rule-strong bg-surface focus-within:border-brand focus-within:outline-focus';

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-space-1">
      <label
        className="w-full min-w-0 break-words text-body-strong text-ink"
        htmlFor={id}
      >
        {label}
        {required ? ' (required)' : ''}
      </label>
      <div
        className={`flex min-h-12 w-full items-center gap-space-2 rounded-md border px-space-4 outline-none transition-colors duration-motion-fast focus-within:outline-2 focus-within:outline-offset-2 ${controlStyle} ${inputProps.disabled ? 'bg-surface-sunken text-ink-disabled' : ''}`}
      >
        {startAdornment ? (
          <span className="shrink-0 text-body text-ink-muted">
            {startAdornment}
          </span>
        ) : null}
        <input
          {...inputProps}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={`min-h-12 min-w-0 flex-1 bg-transparent py-space-2 text-body text-ink outline-none placeholder:text-ink-muted disabled:cursor-not-allowed disabled:text-ink-disabled read-only:cursor-text ${className}`}
          id={id}
          ref={inputRef}
          required={required}
          tabIndex={inputProps.readOnly ? -1 : inputProps.tabIndex}
        />
        {error ? (
          <svg
            aria-hidden="true"
            className="size-5 shrink-0 text-danger"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 8v5m0 3h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13.1a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        ) : null}
        {endAdornment}
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
