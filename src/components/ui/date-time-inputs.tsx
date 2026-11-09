// Responsive date and explicit 12-hour time inputs for shared forms.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './button';
import { SelectInput } from './select-input';
import { TextInput } from './text-input';

const dateLocale = 'en-IN';

type DatePickerProps = {
  error?: string;
  helpText?: string;
  id: string;
  label: string;
  max?: string;
  min?: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
};

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
    ? date
    : null;
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat(dateLocale, options).format(date) : '';
}

export function DatePicker({
  error,
  helpText,
  id,
  label,
  max,
  min,
  onChange,
  required = false,
  value,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<{
    month: number;
    year: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedDayRef = useRef<HTMLButtonElement>(null);
  const expandedErrorId = error ? `${id}-expanded-error` : undefined;
  const expandedHelpId = helpText ? `${id}-expanded-help` : undefined;
  const describedBy =
    [expandedHelpId, expandedErrorId].filter(Boolean).join(' ') || undefined;
  const selectedDateText = formatDate(value, { dateStyle: 'long' });

  useEffect(() => {
    if (!open) {
      return;
    }

    function dismiss(event: KeyboardEvent | PointerEvent) {
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      } else if (
        event instanceof PointerEvent &&
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', dismiss);
    selectedDayRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', dismiss);
    };
  }, [open, visibleMonth]);

  function showCalendar() {
    const current = parseDate(value) ?? new Date();
    setVisibleMonth({ month: current.getMonth(), year: current.getFullYear() });
    setOpen((currentlyOpen) => !currentlyOpen);
  }

  function changeMonth(offset: number) {
    if (!visibleMonth) {
      return;
    }
    const date = new Date(visibleMonth.year, visibleMonth.month + offset, 1);
    setVisibleMonth({ month: date.getMonth(), year: date.getFullYear() });
  }

  const monthDate = visibleMonth
    ? new Date(visibleMonth.year, visibleMonth.month, 1)
    : null;
  const monthStartDay = monthDate?.getDay() ?? 0;
  const calendarMonth = visibleMonth;
  const calendarDays = calendarMonth
    ? Array.from(
        { length: 42 },
        (_, index) =>
          new Date(
            calendarMonth.year,
            calendarMonth.month,
            index - monthStartDay + 1,
          ),
      )
    : [];
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(dateLocale, { weekday: 'short' }).format(
      new Date(2026, 0, 4 + index),
    ),
  );

  return (
    <div className="grid gap-space-1">
      <div className="block expanded:hidden">
        <TextInput
          error={error}
          helpText={helpText}
          id={id}
          label={label}
          max={max}
          min={min}
          onChange={(event) => onChange(event.currentTarget.value)}
          required={required}
          type="date"
          value={value}
        />
      </div>
      <div className="relative hidden expanded:block">
        <p className="text-body-strong text-ink" id={`${id}-label`}>
          {label}
          {required ? ' (required)' : ''}
        </p>
        <button
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-labelledby={`${id}-label ${id}-value`}
          className={`mt-space-1 flex min-h-12 w-full items-center justify-between gap-space-3 rounded-md border bg-surface px-space-4 text-left text-body outline-none focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${error ? 'border-danger' : 'border-rule-strong'}`}
          id={`${id}-expanded`}
          onClick={showCalendar}
          ref={triggerRef}
          type="button"
        >
          <span id={`${id}-value`}>{selectedDateText || 'Choose a date'}</span>
          <span aria-hidden="true">▦</span>
        </button>
        {open && monthDate && visibleMonth ? (
          <div
            aria-label="Choose a date"
            className="absolute left-0 top-full z-40 mt-space-2 w-content-narrow max-w-full rounded-md border border-rule bg-surface p-space-4 shadow-overlay"
            ref={rootRef}
            role="dialog"
          >
            <div className="mb-space-3 flex items-center justify-between gap-space-2">
              <Button
                aria-label="Previous month"
                iconOnly
                leadingIcon={<span aria-hidden="true">‹</span>}
                onClick={() => changeMonth(-1)}
                variant="secondary"
              />
              <p aria-live="polite" className="text-subheading">
                {new Intl.DateTimeFormat(dateLocale, {
                  month: 'long',
                  year: 'numeric',
                }).format(monthDate)}
              </p>
              <Button
                aria-label="Next month"
                iconOnly
                leadingIcon={<span aria-hidden="true">›</span>}
                onClick={() => changeMonth(1)}
                variant="secondary"
              />
            </div>
            <div
              aria-hidden="true"
              className="mb-space-1 grid grid-cols-7 text-center text-caption text-ink-muted"
            >
              {weekdays.map((weekday, index) => (
                <span key={`${weekday}-${index}`}>{weekday}</span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((date) => {
                const dateValue = toDateValue(date);
                const inVisibleMonth =
                  date.getMonth() === visibleMonth.month &&
                  date.getFullYear() === visibleMonth.year;
                const unavailable =
                  !inVisibleMonth ||
                  (min !== undefined && dateValue < min) ||
                  (max !== undefined && dateValue > max);
                if (!inVisibleMonth) {
                  return (
                    <span
                      aria-hidden="true"
                      className="min-h-12"
                      key={dateValue}
                    />
                  );
                }
                const selected = dateValue === value;
                return (
                  <button
                    aria-label={formatDate(dateValue, { dateStyle: 'full' })}
                    aria-pressed={selected}
                    className={`min-h-12 rounded-sm text-body hover:bg-brand-tint focus-visible:outline-2 focus-visible:outline-focus ${selected ? 'bg-brand text-on-brand' : ''}`}
                    disabled={unavailable}
                    key={dateValue}
                    onClick={() => {
                      onChange(dateValue);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    ref={
                      selected || date.getDate() === 1
                        ? selectedDayRef
                        : undefined
                    }
                    type="button"
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {helpText ? (
          <p
            className="mt-space-1 text-caption text-ink-muted"
            id={expandedHelpId}
          >
            {helpText}
          </p>
        ) : null}
        {error ? (
          <p
            className="mt-space-1 text-caption text-danger"
            id={expandedErrorId}
          >
            {error}
          </p>
        ) : null}
      </div>
      {value ? (
        <p className="text-caption text-ink-muted" aria-live="polite">
          Selected date: {selectedDateText}
        </p>
      ) : null}
    </div>
  );
}

export type TimeParts = {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
};

type TimePickerProps = {
  error?: string;
  helpText?: string;
  id: string;
  label: string;
  onChange: (value: TimeParts) => void;
  required?: boolean;
  timeZone?: string;
  value: TimeParts;
};

const hourOptions = Array.from({ length: 12 }, (_, index) => {
  const hour = String(index + 1);
  return { label: hour, value: hour };
});

const minuteOptions = Array.from({ length: 60 }, (_, index) => {
  const minute = String(index).padStart(2, '0');
  return { label: minute, value: minute };
});

export function TimePicker({
  error,
  helpText,
  id,
  label,
  onChange,
  required = false,
  timeZone,
  value,
}: TimePickerProps) {
  const describedBy =
    [helpText ? `${id}-help` : undefined, error ? `${id}-error` : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <fieldset className="grid gap-space-2 border-0 p-0">
      <legend className="text-body-strong text-ink">
        {label}
        {required ? ' (required)' : ''}
      </legend>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-space-2">
        <SelectInput
          id={`${id}-hour`}
          label="Hour"
          onChange={(event) =>
            onChange({ ...value, hour: event.currentTarget.value })
          }
          options={hourOptions}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
          required={required}
          value={value.hour}
        />
        <SelectInput
          id={`${id}-minute`}
          label="Minute"
          onChange={(event) =>
            onChange({ ...value, minute: event.currentTarget.value })
          }
          options={minuteOptions}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
          required={required}
          value={value.minute}
        />
        <SelectInput
          id={`${id}-period`}
          label="AM/PM"
          onChange={(event) => {
            const period = event.currentTarget.value;
            if (period === 'AM' || period === 'PM') {
              onChange({ ...value, period });
            }
          }}
          options={[
            { label: 'AM', value: 'AM' },
            { label: 'PM', value: 'PM' },
          ]}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
          required={required}
          value={value.period}
        />
      </div>
      {timeZone ? (
        <p className="text-caption text-ink-muted">Time zone: {timeZone}</p>
      ) : null}
      {helpText ? (
        <p className="text-caption text-ink-muted" id={`${id}-help`}>
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p className="text-caption text-danger" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
