// Shared status, identity and record display components.
'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { Button } from './button';
import { Toast } from './feedback';

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

type StatusDefinition = {
  icon: string;
  label: string;
  tone: StatusTone;
};

export const statusMap = {
  'visitor.pending': { icon: '◷', label: 'Pending', tone: 'warning' },
  'visitor.approved': { icon: '✓', label: 'Approved', tone: 'success' },
  'visitor.denied': { icon: '×', label: 'Denied', tone: 'danger' },
  'visitor.expired': { icon: '◷', label: 'Expired', tone: 'neutral' },
  'visitor.no_response': {
    icon: '◷',
    label: 'No response',
    tone: 'neutral',
  },
  'visitor.checked_in': { icon: '↓', label: 'Checked in', tone: 'info' },
  'visitor.checked_out': { icon: '↑', label: 'Checked out', tone: 'neutral' },
  'visitor.still_inside': { icon: '!', label: 'Still inside', tone: 'warning' },
  'delivery.pending': {
    icon: '◷',
    label: 'Pending response',
    tone: 'warning',
  },
  'delivery.allowed': { icon: '✓', label: 'Allowed', tone: 'info' },
  'delivery.left_at_gate': { icon: '▣', label: 'Left at gate', tone: 'info' },
  'delivery.denied': { icon: '×', label: 'Denied', tone: 'danger' },
  'delivery.collected': { icon: '✓', label: 'Collected', tone: 'success' },
  'delivery.closed': { icon: '✓', label: 'Closed', tone: 'neutral' },
  'bill.due': { icon: '▤', label: 'Due', tone: 'info' },
  'bill.overdue': { icon: '!', label: 'Overdue', tone: 'danger' },
  'bill.paid': { icon: '✓', label: 'Paid', tone: 'success' },
  'bill.partially_paid': {
    icon: '◐',
    label: 'Partially paid',
    tone: 'warning',
  },
  'bill.waived': { icon: '/', label: 'Waived', tone: 'neutral' },
  'bill.cancelled': { icon: '/', label: 'Cancelled', tone: 'neutral' },
  'payment.awaiting_confirmation': {
    icon: '◷',
    label: 'Awaiting confirmation',
    tone: 'warning',
  },
  'payment.confirmed': { icon: '✓', label: 'Confirmed', tone: 'success' },
  'payment.rejected': { icon: '×', label: 'Rejected', tone: 'danger' },
  'request.open': { icon: '•', label: 'Open', tone: 'info' },
  'request.assigned': { icon: '●', label: 'Assigned', tone: 'info' },
  'request.in_progress': { icon: '↻', label: 'In progress', tone: 'info' },
  'request.resolved': { icon: '✓', label: 'Resolved', tone: 'success' },
  'request.closed': { icon: '✓', label: 'Closed', tone: 'neutral' },
  'request.rejected': { icon: '×', label: 'Rejected', tone: 'danger' },
  'request.reopened': { icon: '↻', label: 'Reopened', tone: 'warning' },
  'request.overdue': { icon: '!', label: 'Overdue', tone: 'danger' },
  'amc.active': { icon: '✓', label: 'Active', tone: 'success' },
  'amc.expiring_soon': { icon: '◷', label: 'Expiring soon', tone: 'warning' },
  'amc.expired': { icon: '!', label: 'Expired', tone: 'danger' },
  'stock.low': { icon: '!', label: 'Low', tone: 'warning' },
  'society.trial': { icon: '•', label: 'Trial', tone: 'info' },
  'society.active': { icon: '✓', label: 'Active', tone: 'success' },
  'society.suspended': { icon: '!', label: 'Suspended', tone: 'danger' },
  'society.archived': { icon: '/', label: 'Archived', tone: 'neutral' },
  'error_log.open': { icon: '!', label: 'Open', tone: 'danger' },
  'error_log.resolved': { icon: '✓', label: 'Resolved', tone: 'success' },
  'error_log.ignored': { icon: '/', label: 'Ignored', tone: 'neutral' },
  'job.queued': { icon: '◷', label: 'Queued', tone: 'neutral' },
  'job.running': { icon: '↻', label: 'Running', tone: 'info' },
  'job.succeeded': { icon: '✓', label: 'Succeeded', tone: 'success' },
  'job.partial': { icon: '!', label: 'Partial', tone: 'warning' },
  'job.failed': { icon: '×', label: 'Failed', tone: 'danger' },
  'module.on': { icon: '✓', label: 'On', tone: 'success' },
  'module.off': { icon: '/', label: 'Off', tone: 'neutral' },
  'severity.critical': { icon: '!', label: 'Critical', tone: 'danger' },
  'severity.error': { icon: '×', label: 'Error', tone: 'danger' },
  'severity.warning': { icon: '!', label: 'Warning', tone: 'warning' },
  'severity.info': { icon: 'i', label: 'Info', tone: 'info' },
} as const satisfies Record<string, StatusDefinition>;

export type ProductStatus = keyof typeof statusMap;

const toneClasses: Record<StatusTone, string> = {
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
  neutral: 'bg-neutral-tint text-neutral',
  info: 'bg-info-tint text-info',
};

type StatusChipProps = {
  status: ProductStatus;
};

export function StatusChip({ status }: StatusChipProps) {
  const { icon, label, tone } = statusMap[status];

  return (
    <span
      className={`inline-flex min-h-6 items-center gap-space-1 rounded-sm px-space-2 text-micro ${toneClasses[tone]}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

type CardProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  title?: string;
};

export function Card({
  action,
  children,
  className = '',
  description,
  title,
}: CardProps) {
  const headingId = useId();
  const content = (
    <>
      {title || action ? (
        <header className="mb-space-4 flex items-start justify-between gap-space-3">
          {title ? (
            <div className="grid gap-space-1">
              <h2 className="text-subheading" id={headingId}>
                {title}
              </h2>
              {description ? (
                <p className="text-caption text-ink-muted">{description}</p>
              ) : null}
            </div>
          ) : null}
          {action}
        </header>
      ) : null}
      {children}
    </>
  );
  const classNames = `rounded-md border border-rule bg-surface p-space-4 medium:p-space-5 ${className}`;

  return title ? (
    <section aria-labelledby={headingId} className={classNames}>
      {content}
    </section>
  ) : (
    <div className={classNames}>{content}</div>
  );
}

type ListItemBaseProps = {
  className?: string;
  secondary?: ReactNode;
  status?: ProductStatus;
  title: ReactNode;
  trailing?: ReactNode;
};

type ListItemProps = ListItemBaseProps &
  (
    | { href: string; onClick?: never }
    | { href?: never; onClick: () => void }
    | { href?: never; onClick?: never }
  );

export function ListItem({
  className = '',
  href,
  onClick,
  secondary,
  status,
  title,
  trailing,
}: ListItemProps) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-body-strong">{title}</span>
        {secondary ? (
          <span className="mt-space-1 block text-caption text-ink-muted">
            {secondary}
          </span>
        ) : null}
      </span>
      {status ? <StatusChip status={status} /> : null}
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
      {href ? (
        <span aria-hidden="true" className="text-ink-muted">
          ›
        </span>
      ) : null}
    </>
  );
  const classNames = `flex min-h-14 w-full items-center gap-space-3 border-b border-rule px-space-4 py-space-3 text-left text-ink ${className}`;

  if (href) {
    return (
      <a className={classNames} href={href}>
        {content}
      </a>
    );
  }
  if (onClick) {
    return (
      <button className={classNames} onClick={onClick} type="button">
        {content}
      </button>
    );
  }
  return <div className={classNames}>{content}</div>;
}

type StatTileProps = {
  context?: ReactNode;
  href?: string;
  label: string;
  value: ReactNode;
};

export function StatTile({ context, href, label, value }: StatTileProps) {
  const content = (
    <>
      <span className="block text-caption text-ink-muted">{label}</span>
      <span className="mt-space-1 block text-display font-semibold tabular-nums">
        {value}
      </span>
      {context ? (
        <span className="mt-space-1 block text-caption text-ink-muted">
          {context}
        </span>
      ) : null}
    </>
  );
  const className =
    'block rounded-md border border-rule bg-surface p-space-4 medium:p-space-5';

  return href ? (
    <a
      className={`${className} underline-offset-4 hover:underline focus-visible:underline`}
      href={href}
    >
      <span className="flex items-start justify-between gap-space-2">
        <span className="min-w-0 flex-1">{content}</span>
        <span aria-hidden="true" className="text-ink-muted">
          ›
        </span>
      </span>
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

type AvatarProps = {
  name: string;
  photoUrl?: string;
  size?: 'default' | 'guard';
  unit?: string;
};

function AvatarMark({
  name,
  photoUrl,
  size,
}: {
  name: string;
  photoUrl?: string;
  size: 'default' | 'guard';
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  const sizeClasses =
    size === 'guard' ? 'size-24 text-title' : 'size-10 text-body-strong';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-tint text-neutral ${sizeClasses}`}
    >
      {photoUrl && !imageFailed ? (
        <Image
          alt=""
          className="size-full object-cover"
          height={size === 'guard' ? 96 : 40}
          onError={() => setImageFailed(true)}
          src={photoUrl}
          unoptimized
          width={size === 'guard' ? 96 : 40}
        />
      ) : (
        initials || '?'
      )}
    </span>
  );
}

export function Avatar({
  name,
  photoUrl,
  size = 'default',
  unit,
}: AvatarProps) {
  return (
    <div className="inline-flex min-w-0 items-center gap-space-3">
      <AvatarMark key={photoUrl} name={name} photoUrl={photoUrl} size={size} />
      <span className="min-w-0">
        <span className="block break-words text-body-strong">{name}</span>
        {unit ? (
          <span className="block break-words text-caption text-ink-muted">
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export type TimelineEvent = {
  action: ReactNode;
  actor: string;
  at: string;
  id: string;
  reason?: ReactNode;
};

type TimelineProps = {
  events: readonly TimelineEvent[];
  now: string;
};

function formatRelativeTime(date: Date, now: number) {
  const differenceSeconds = Math.round((date.getTime() - now) / 1000);
  const absoluteSeconds = Math.abs(differenceSeconds);
  if (absoluteSeconds < 60) {
    return differenceSeconds > 0 ? 'in less than a minute' : 'just now';
  }
  const unit =
    absoluteSeconds < 60 * 60
      ? 'minute'
      : absoluteSeconds < 24 * 60 * 60
        ? 'hour'
        : 'day';
  const divisor =
    unit === 'minute' ? 60 : unit === 'hour' ? 60 * 60 : 24 * 60 * 60;
  const value = Math.round(differenceSeconds / divisor);
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
    value,
    unit,
  );
}

export function Timeline({ events, now }: TimelineProps) {
  const nowTimestamp = new Date(now).getTime();

  return (
    <ol className="grid">
      {events.map((event, index) => {
        const date = new Date(event.at);
        const absolute = new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(date);
        const withinDay =
          Math.abs(nowTimestamp - date.getTime()) < 24 * 60 * 60 * 1000;

        return (
          <li
            className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-space-3 pb-space-4 last:pb-0"
            key={event.id}
          >
            <span aria-hidden="true" className="relative flex justify-center">
              <span className="mt-1 size-2 rounded-full bg-brand" />
              {index < events.length - 1 ? (
                <span className="absolute bottom-0 top-3 w-px bg-rule" />
              ) : null}
            </span>
            <div className="min-w-0">
              <p className="text-body">
                <span className="font-semibold">{event.actor}</span>{' '}
                {event.action}
              </p>
              {event.reason ? (
                <p className="mt-space-1 text-caption text-ink-muted">
                  {event.reason}
                </p>
              ) : null}
              <time
                aria-label={`${withinDay ? formatRelativeTime(date, nowTimestamp) : absolute}; ${absolute}`}
                className="mt-space-1 inline-block text-caption text-ink-muted"
                dateTime={event.at}
                suppressHydrationWarning
                tabIndex={0}
                title={absolute}
              >
                {withinDay ? formatRelativeTime(date, nowTimestamp) : absolute}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type CodeDisplayProps = {
  label: string;
  onShare?: () => void;
  qrCode?: ReactNode;
  singleUse?: boolean;
  validity?: ReactNode;
  value: string;
};

export function CodeDisplay({
  label,
  onShare,
  qrCode,
  singleUse = false,
  validity,
  value,
}: CodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setCopyError(null);
    } catch {
      setCopied(false);
      setCopyError('Could not copy. Select and copy the code manually.');
    }
  }

  return (
    <section className="grid gap-space-3 rounded-md border border-rule bg-surface p-space-4 medium:p-space-5">
      <p className="text-caption text-ink-muted">{label}</p>
      <div className="flex flex-col items-start gap-space-4 medium:flex-row medium:items-center">
        {qrCode ? <div className="shrink-0">{qrCode}</div> : null}
        <div className="grid min-w-0 gap-space-3">
          <code
            className={`inline-block w-fit rounded-sm bg-surface-sunken px-space-3 py-space-2 font-mono tabular-nums ${qrCode ? 'text-display tracking-widest' : 'text-code'}`}
          >
            {value}
          </code>
          <div className="flex flex-wrap gap-space-2">
            <Button onClick={copyCode} variant="secondary">
              Copy
            </Button>
            {onShare ? (
              <Button onClick={onShare} variant="secondary">
                Share
              </Button>
            ) : null}
          </div>
          {validity ? (
            <p className="text-caption text-ink-muted">{validity}</p>
          ) : null}
          {singleUse ? (
            <p className="text-caption text-ink-muted">Single use</p>
          ) : null}
          {copyError ? (
            <p className="text-caption text-danger" role="alert">
              {copyError}
            </p>
          ) : null}
        </div>
      </div>
      {copied ? (
        <Toast message="Copied" onDismiss={() => setCopied(false)} />
      ) : null}
    </section>
  );
}
