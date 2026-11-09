// Semantic input variants for common identity, code, amount and search fields.
'use client';

import type {
  ChangeEvent,
  ChangeEventHandler,
  TextareaHTMLAttributes,
} from 'react';
import { useRef, useState } from 'react';
import { TextInput } from './text-input';

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function digitsOnly(value: string, maximumLength: number): string {
  return value.replace(/\D/g, '').slice(0, maximumLength);
}

type SpecializedInputProps = Omit<
  Parameters<typeof TextInput>[0],
  'type' | 'inputMode' | 'autoComplete' | 'maxLength' | 'pattern'
>;

export function EmailInput({
  onBlur,
  onChange,
  ...props
}: SpecializedInputProps & {
  onBlur?: SpecializedInputProps['onBlur'];
  onChange?: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <TextInput
      {...props}
      autoComplete="email"
      inputMode="email"
      onBlur={(event) => {
        const normalized = normalizeEmail(event.currentTarget.value);
        if (normalized !== event.currentTarget.value) {
          event.currentTarget.value = normalized;
          onChange?.(event);
        }
        onBlur?.(event);
      }}
      onChange={(event) => {
        event.currentTarget.value = normalizeEmail(event.currentTarget.value);
        onChange?.(event);
      }}
      type="email"
    />
  );
}

export function CodeInput({
  onChange,
  ...props
}: SpecializedInputProps & {
  onChange?: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <TextInput
      {...props}
      autoComplete="one-time-code"
      className={`tabular-nums tracking-widest ${props.className ?? ''}`}
      inputMode="numeric"
      maxLength={6}
      onChange={(event) => updateDigits(event, 6, onChange)}
      pattern="[0-9]{6}"
      type="text"
    />
  );
}

export function PhoneInput({
  onChange,
  ...props
}: SpecializedInputProps & {
  onChange?: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <TextInput
      {...props}
      autoComplete="tel-national"
      inputMode="numeric"
      maxLength={10}
      onChange={(event) => updateDigits(event, 10, onChange)}
      pattern="[0-9]{10}"
      startAdornment="+91"
      type="tel"
    />
  );
}

export function AmountInput(props: SpecializedInputProps) {
  return (
    <TextInput
      {...props}
      autoComplete="off"
      className={`text-right tabular-nums ${props.className ?? ''}`}
      inputMode="decimal"
      startAdornment="₹"
      type="text"
    />
  );
}

type SearchInputProps = Omit<SpecializedInputProps, 'value' | 'onChange'> & {
  onChange: ChangeEventHandler<HTMLInputElement>;
  onClear: () => void;
  value: string;
};

export function SearchInput({
  onChange,
  onClear,
  value,
  ...props
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <TextInput
      {...props}
      autoComplete="off"
      endAdornment={
        value ? (
          <button
            aria-label="Clear search"
            className="flex size-12 shrink-0 items-center justify-center rounded-md text-ink-muted outline-none hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null
      }
      inputMode="search"
      inputRef={inputRef}
      onChange={onChange}
      startAdornment={
        <svg
          aria-hidden="true"
          className="size-5"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path
            d="m16 16 4 4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>
      }
      type="search"
      value={value}
    />
  );
}

type TextAreaInputProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id' | 'rows'
> & {
  error?: string;
  helpText?: string;
  id: string;
  label: string;
  rows?: number;
};

export function TextAreaInput({
  className = '',
  defaultValue,
  error,
  helpText,
  id,
  label,
  maxLength,
  onChange,
  required,
  rows = 3,
  value,
  ...textareaProps
}: TextAreaInputProps) {
  const [uncontrolledCount, setUncontrolledCount] = useState(
    typeof defaultValue === 'string' ? defaultValue.length : 0,
  );
  const descriptionId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [textareaProps['aria-describedby'], descriptionId, errorId]
      .filter(Boolean)
      .join(' ') || undefined;
  const characterCount =
    typeof value === 'string' ? value.length : uncontrolledCount;

  return (
    <div className="grid gap-space-1">
      <label className="text-body-strong text-ink" htmlFor={id}>
        {label}
        {required ? ' (required)' : ''}
      </label>
      <textarea
        {...textareaProps}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-md border bg-surface px-space-4 py-space-3 text-body text-ink outline-none focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-disabled ${error ? 'border-danger' : 'border-rule-strong'} ${className}`}
        defaultValue={defaultValue}
        id={id}
        maxLength={maxLength}
        onChange={(event) => {
          if (typeof value !== 'string') {
            setUncontrolledCount(event.currentTarget.value.length);
          }
          onChange?.(event);
        }}
        required={required}
        rows={Math.max(3, rows)}
        value={value}
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
      {maxLength !== undefined ? (
        <p className="text-caption text-ink-muted">
          {characterCount} / {maxLength}
        </p>
      ) : null}
    </div>
  );
}

function updateDigits(
  event: ChangeEvent<HTMLInputElement>,
  maximumLength: number,
  onChange?: ChangeEventHandler<HTMLInputElement>,
) {
  event.currentTarget.value = digitsOnly(
    event.currentTarget.value,
    maximumLength,
  );
  onChange?.(event);
}
