// Visual building blocks for the resident home: greeting, holographic dues card and pending rows.
'use client';

import Link from 'next/link';
import { motion, type Variants } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { ModuleIconTile } from '@/components/ui/module-icon';
import type { ModuleKey } from '@/core/modules';

// Transform-only entrance: fading would briefly lower text contrast.
export const riseIn: Variants = {
  hidden: { y: 14, scale: 0.985 },
  shown: {
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 26 },
  },
};

export const staggerChildren: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.05 } },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts.at(-1)] : parts;
  return letters
    .map((part) => part?.charAt(0).toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

export function HomeGreeting({
  eyebrow,
  name,
  title,
  children,
}: {
  eyebrow: string;
  name: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <motion.header
      className="flex items-start justify-between gap-space-4"
      variants={riseIn}
    >
      <div className="grid min-w-0 gap-space-1">
        <p className="text-caption text-ink-muted">{eyebrow}</p>
        <h1 className="break-words text-display font-bold tracking-tight">
          {title}
        </h1>
        {children}
      </div>
      <span
        aria-hidden="true"
        className="holo-surface grid size-12 shrink-0 place-items-center rounded-full text-body-strong"
      >
        <span className="relative z-10">{initials(name)}</span>
      </span>
    </motion.header>
  );
}

export function DuesCard({
  amount,
  dueLine,
  isOverdue,
  label,
  actionLabel,
}: {
  amount: string;
  dueLine: string | null;
  isOverdue: boolean;
  label: string;
  actionLabel: string;
}) {
  return (
    <motion.div
      className="holo-surface rounded-lg p-space-5 medium:p-space-6"
      variants={riseIn}
    >
      <div className="relative z-10 grid gap-space-4">
        <div className="flex flex-wrap items-start justify-between gap-space-2">
          <h3 className="text-body-strong">{label}</h3>
          {dueLine ? (
            <span
              className={`rounded-full bg-surface px-space-3 py-space-1 text-micro font-semibold ${isOverdue ? 'text-danger' : 'text-ink'}`}
            >
              {dueLine}
            </span>
          ) : null}
        </div>
        <p className="break-all text-display font-extrabold tracking-tight tabular-nums">
          {amount}
        </p>
        <div>
          <Link
            className="inline-flex min-h-12 items-center gap-space-2 rounded-full bg-holo-action px-space-5 text-body-strong text-on-holo-action transition duration-motion-fast ease-out hover:gap-space-3 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            href="/bills"
          >
            {actionLabel}
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export function PendingRow({
  href,
  label,
  moduleKey,
}: {
  href: string;
  label: string;
  moduleKey: ModuleKey;
}) {
  return (
    <Link
      className="flex min-h-16 items-center gap-space-3 rounded-lg border border-rule bg-surface p-space-3 pr-space-4 text-body-strong shadow-card transition duration-motion-base ease-out hover:-translate-y-0.5 hover:border-brand/40 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={href}
    >
      <ModuleIconTile moduleKey={moduleKey} size="sm" />
      <span className="min-w-0 flex-1">{label}</span>
      <span aria-hidden="true" className="live-dot text-danger" />
      <ChevronRight aria-hidden="true" className="size-5 text-ink-muted" />
    </Link>
  );
}
