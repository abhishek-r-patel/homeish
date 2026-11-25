// Show a refresh-safe completion result and move focus to its outcome.
'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

type ResultAction = {
  href: string;
  label: string;
  primary?: boolean;
};

export function ResultScreen({
  actions,
  outcome,
  summary,
  title,
}: {
  actions: ResultAction[];
  outcome: string;
  summary: { label: string; value: string }[];
  title: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section className="mx-auto grid max-w-content-narrow gap-space-5 py-space-5">
      <div aria-live="polite" className="grid justify-items-center gap-space-3">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-success-tint text-title font-semibold text-success"
        >
          ✓
        </span>
        <h1
          className="text-center text-title font-semibold outline-none"
          ref={heading}
          tabIndex={-1}
        >
          {title}
        </h1>
        <p className="max-w-prose text-center text-body text-ink-muted">
          {outcome}
        </p>
      </div>
      <dl className="grid gap-space-3 rounded-md border border-rule bg-surface p-space-5">
        {summary.map((item) => (
          <div className="grid gap-space-1" key={item.label}>
            <dt className="text-caption font-semibold text-ink-muted">
              {item.label}
            </dt>
            <dd className="text-body">{item.value}</dd>
          </div>
        ))}
      </dl>
      <nav aria-label="Next steps" className="flex flex-wrap gap-space-3">
        {actions.map((action) => (
          <Link
            className={`inline-flex min-h-12 items-center justify-center rounded-md border px-space-4 text-body-strong outline-none focus-visible:outline-2 focus-visible:outline-focus ${
              action.primary
                ? 'border-brand bg-brand text-on-brand'
                : 'border-rule-strong bg-surface text-ink'
            }`}
            href={action.href}
            key={`${action.href}:${action.label}`}
          >
            {action.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
