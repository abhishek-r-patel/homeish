// Shared banners, success toasts, error states, empty states and loading feedback.
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { FocusEvent, ReactNode } from 'react';
import { Button } from './button';

type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

type BannerProps = {
  action?: ReactNode;
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  title?: string;
  tone?: BannerTone;
};

const bannerToneClasses: Record<BannerTone, string> = {
  info: 'border-info bg-info-tint text-info',
  success: 'border-success bg-success-tint text-success',
  warning: 'border-warning bg-warning-tint text-warning',
  danger: 'border-danger bg-danger-tint text-danger',
  neutral: 'border-rule-strong bg-neutral-tint text-neutral',
};

const bannerIcons: Record<BannerTone, string> = {
  info: 'i',
  success: '✓',
  warning: '!',
  danger: '!',
  neutral: '•',
};

export function Banner({
  action,
  children,
  dismissible = false,
  onDismiss,
  title,
  tone = 'info',
}: BannerProps) {
  return (
    <div
      className={`flex w-full items-start gap-space-3 rounded-md border p-space-4 ${bannerToneClasses[tone]}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-body-strong"
      >
        {bannerIcons[tone]}
      </span>
      <div className="min-w-0 flex-1 text-body">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
        {action ? <div className="mt-space-2">{action}</div> : null}
      </div>
      {dismissible && onDismiss ? (
        <Button
          aria-label="Dismiss message"
          iconOnly
          leadingIcon={
            <svg fill="none" viewBox="0 0 24 24">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          }
          onClick={onDismiss}
          variant="tertiary"
        />
      ) : null}
    </div>
  );
}

type ToastProps = {
  durationMs?: number;
  message: string;
  onDismiss: () => void;
  onUndo?: () => void;
};

export function Toast({
  durationMs = 5000,
  message,
  onDismiss,
  onUndo,
}: ToastProps) {
  const [paused, setPaused] = useState(false);
  const remainingMs = useRef(durationMs);

  useEffect(() => {
    if (paused) {
      return;
    }
    const startedAt = Date.now();
    const timer = window.setTimeout(onDismiss, remainingMs.current);
    return () => {
      window.clearTimeout(timer);
      remainingMs.current = Math.max(
        0,
        remainingMs.current - (Date.now() - startedAt),
      );
    };
  }, [onDismiss, paused]);

  return (
    <div
      aria-atomic="true"
      className="fixed inset-x-space-4 bottom-space-4 z-50 flex w-auto max-w-content-narrow items-center gap-space-3 rounded-md border border-success bg-surface p-space-4 text-ink shadow-overlay medium:bottom-space-5 medium:left-space-5 medium:right-auto"
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setPaused(false);
        }
      }}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" className="text-success">
        ✓
      </span>
      <p className="min-w-0 flex-1 text-body">{message}</p>
      {onUndo ? (
        <Button onClick={onUndo} variant="tertiary">
          Undo
        </Button>
      ) : null}
      <Button
        aria-label="Dismiss notification"
        iconOnly
        leadingIcon={
          <svg fill="none" viewBox="0 0 24 24">
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
        }
        onClick={onDismiss}
        variant="tertiary"
      />
    </div>
  );
}

export type FormError = {
  fieldId: string;
  label: string;
  message: string;
};

type ErrorSummaryProps = {
  errors: readonly FormError[];
  title?: string;
};

export function ErrorSummary({
  errors,
  title = 'There is a problem',
}: ErrorSummaryProps) {
  const id = useId();
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [errors]);

  if (errors.length === 0) {
    return null;
  }

  return (
    <div
      aria-labelledby={`${id}-title`}
      className="rounded-md border border-danger bg-danger-tint p-space-4 text-danger"
      ref={summaryRef}
      role="alert"
      tabIndex={-1}
    >
      <h2 className="text-subheading" id={`${id}-title`}>
        {title}
      </h2>
      <ul className="mt-space-2 list-inside list-disc">
        {errors.map((error) => (
          <li key={`${error.fieldId}-${error.message}`}>
            <a className="underline" href={`#${error.fieldId}`}>
              {error.label}: {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ErrorPanelProps = {
  action?: ReactNode;
  message: string;
  referenceId?: string;
  title?: string;
};

export function ErrorPanel({
  action,
  message,
  referenceId,
  title = 'We could not complete that request',
}: ErrorPanelProps) {
  const id = useId();

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="grid gap-space-3 rounded-md border border-danger bg-danger-tint p-space-5 text-ink"
      role="alert"
    >
      <h2 className="text-heading" id={`${id}-title`}>
        {title}
      </h2>
      <p className="text-body">{message}</p>
      {referenceId ? (
        <p className="text-caption text-ink-muted">
          Reference ID: <code className="font-mono">{referenceId}</code>
        </p>
      ) : null}
      {action}
    </section>
  );
}

type EmptyStateProps = {
  action?: ReactNode;
  description: ReactNode;
  icon?: ReactNode;
  title: string;
};

export function EmptyState({
  action,
  description,
  icon,
  title,
}: EmptyStateProps) {
  return (
    <section className="grid justify-items-center gap-space-3 p-space-6 text-center">
      {icon ? (
        <div
          aria-hidden="true"
          className="flex size-8 items-center justify-center text-ink-muted"
        >
          {icon}
        </div>
      ) : null}
      <h2 className="text-heading">{title}</h2>
      <div className="max-w-content-narrow text-body text-ink-muted">
        {description}
      </div>
      {action}
    </section>
  );
}

type SkeletonProps = {
  label?: string;
  rows?: number;
};

export function Skeleton({
  label = 'Loading content',
  rows = 3,
}: SkeletonProps) {
  const rowCount = Math.max(1, Math.min(rows, 8));

  return (
    <div aria-busy="true" aria-label={label} role="status">
      <div aria-hidden="true" className="grid gap-space-3">
        {Array.from({ length: rowCount }, (_, index) => (
          <span
            className="h-4 w-full animate-pulse rounded-sm bg-surface-sunken motion-reduce:animate-none"
            key={index}
          />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

type SpinnerProps = {
  label?: string;
};

export function Spinner({ label = 'Loading' }: SpinnerProps) {
  return (
    <span aria-label={label} role="status">
      <span
        aria-hidden="true"
        className="inline-block size-6 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
      />
    </span>
  );
}
