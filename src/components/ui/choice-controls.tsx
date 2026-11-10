// Accessible checkbox, radio, option-card and immediate-effect switch controls.
'use client';

import type { ChangeEventHandler, InputHTMLAttributes, ReactNode } from 'react';

type ChoiceInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type'
> & {
  description?: string;
  id: string;
  label: ReactNode;
};

function ChoiceDescription({ id, text }: { id: string; text?: string }) {
  return text ? (
    <span className="block text-caption text-ink-muted" id={id}>
      {text}
    </span>
  ) : null;
}

export function CheckboxInput({
  description,
  id,
  label,
  ...inputProps
}: ChoiceInputProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const describedBy =
    [inputProps['aria-describedby'], descriptionId].filter(Boolean).join(' ') ||
    undefined;

  return (
    <label className="relative flex min-h-12 cursor-pointer items-center gap-space-2 text-body text-ink">
      <span className="relative size-6 shrink-0">
        <input
          {...inputProps}
          aria-describedby={describedBy}
          className="peer absolute inset-0 size-full opacity-0"
          id={id}
          type="checkbox"
        />
        <span className="absolute inset-0 rounded-sm border border-rule-strong bg-surface peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:cursor-not-allowed peer-disabled:bg-surface-sunken" />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-6 p-space-1 text-on-brand opacity-0 peer-checked:opacity-100"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            d="m4 10 4 4 8-8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </span>
      <span className="flex-1">
        {label}
        <ChoiceDescription id={descriptionId ?? ''} text={description} />
      </span>
    </label>
  );
}

export function RadioInput({
  description,
  id,
  label,
  ...inputProps
}: ChoiceInputProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const describedBy =
    [inputProps['aria-describedby'], descriptionId].filter(Boolean).join(' ') ||
    undefined;

  return (
    <label className="relative flex min-h-12 cursor-pointer items-center gap-space-2 text-body text-ink">
      <span className="relative size-6 shrink-0">
        <input
          {...inputProps}
          aria-describedby={describedBy}
          className="peer absolute inset-0 size-full opacity-0"
          id={id}
          type="radio"
        />
        <span className="absolute inset-0 rounded-full border border-rule-strong bg-surface peer-checked:border-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:bg-surface-sunken" />
        <span className="pointer-events-none absolute inset-0 m-auto size-3 rounded-full bg-brand opacity-0 peer-checked:opacity-100" />
      </span>
      <span className="flex-1">
        {label}
        <ChoiceDescription id={descriptionId ?? ''} text={description} />
      </span>
    </label>
  );
}

type RadioOption = {
  description?: string;
  label: string;
  value: string;
};

type RadioGroupProps = {
  id: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  options: readonly RadioOption[];
  required?: boolean;
  value: string;
  variant?: 'standard' | 'cards';
};

export function RadioGroup({
  id,
  label,
  name,
  onChange,
  options,
  required = false,
  value,
  variant = 'standard',
}: RadioGroupProps) {
  return (
    <fieldset className="grid gap-space-2">
      <legend className="text-body-strong text-ink">
        {label}
        {required ? ' (required)' : ''}
      </legend>
      {options.map((option, index) => {
        const sharedProps = {
          checked: value === option.value,
          description: option.description,
          id: `${id}-option-${index}`,
          key: option.value,
          label: option.label,
          name,
          onChange: () => onChange(option.value),
          required,
          value: option.value,
        };
        return variant === 'cards' ? (
          <OptionCard {...sharedProps} />
        ) : (
          <RadioInput {...sharedProps} />
        );
      })}
    </fieldset>
  );
}

type OptionCardProps = Omit<ChoiceInputProps, 'description'> & {
  description?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

export function OptionCard({
  description,
  id,
  label,
  ...inputProps
}: OptionCardProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const describedBy =
    [inputProps['aria-describedby'], descriptionId].filter(Boolean).join(' ') ||
    undefined;

  return (
    <label className="relative block min-h-14 w-full cursor-pointer">
      <input
        {...inputProps}
        aria-describedby={describedBy}
        className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
        id={id}
        type="radio"
      />
      <span className="pointer-events-none flex min-h-14 items-center justify-between gap-space-3 rounded-md border-2 border-rule-strong bg-surface px-space-4 text-body text-ink peer-checked:border-brand peer-checked:bg-brand-tint peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:bg-surface-sunken">
        <span className="pr-space-8">
          <span className="block">{label}</span>
          <ChoiceDescription id={descriptionId ?? ''} text={description} />
        </span>
      </span>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-space-4 top-1/2 size-5 -translate-y-1/2 text-brand opacity-0 peer-checked:opacity-100"
        fill="none"
        viewBox="0 0 20 20"
      >
        <path
          d="m4 10 4 4 8-8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </label>
  );
}

type SwitchInputProps = {
  checked: boolean;
  disabled?: boolean;
  id: string;
  label: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

export function SwitchInput({
  checked,
  disabled = false,
  id,
  label,
  onChange,
}: SwitchInputProps) {
  return (
    <label className="inline-flex min-h-12 cursor-pointer items-center gap-space-3 text-body text-ink">
      <span id={`${id}-label`}>{label}</span>
      <span className="relative h-6 w-11 shrink-0">
        <input
          checked={checked}
          className="peer absolute inset-0 z-10 size-full opacity-0"
          disabled={disabled}
          id={id}
          onChange={onChange}
          aria-labelledby={`${id}-label`}
          role="switch"
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-rule-strong transition-colors duration-motion-fast peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-60 motion-reduce:transition-none"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-space-1 top-space-1 size-4 rounded-full bg-surface transition-transform duration-motion-fast peer-checked:translate-x-5 motion-reduce:transition-none"
        />
      </span>
      <span className="text-caption text-ink-muted">
        {checked ? 'On' : 'Off'}
      </span>
    </label>
  );
}
