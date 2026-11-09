// Shared labelled text input with accessible helper and error relationships.
import type { InputHTMLAttributes } from 'react';

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  error?: string;
  helpText?: string;
  id: string;
  label: string;
};

export function TextInput({
  error,
  helpText,
  id,
  label,
  required,
  ...inputProps
}: TextInputProps) {
  const descriptionId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="grid gap-space-1">
      <label className="text-body-strong text-ink" htmlFor={id}>
        {label}
        {required ? ' (required)' : ''}
      </label>
      <input
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={`min-h-12 w-full rounded-md border bg-surface px-space-4 text-body text-ink outline-none focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:bg-surface-sunken disabled:text-ink-disabled ${error ? 'border-danger' : 'border-rule-strong'}`}
        id={id}
        required={required}
        {...inputProps}
      />
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
