// Load the P57 public contact email independently from the static marketing page.
'use client';

import { useEffect, useState } from 'react';
import { getPublicWebsiteSettingsAction } from '@/app/website-actions';
import type { ServerActionResult } from '@/core/actions/server-action';

type ContactState =
  | { status: 'loading' }
  | { status: 'ready'; email: string | null }
  | { status: 'error' };

export function WebsiteContactActions({
  settingsAction = getPublicWebsiteSettingsAction,
}: {
  settingsAction?: () => Promise<
    ServerActionResult<{
      contactEmail: string | null;
      enquiryHourlyLimit: number;
    }>
  >;
}) {
  const [state, setState] = useState<ContactState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    void settingsAction().then((result) => {
      if (!active) return;
      setState(
        result.ok
          ? { status: 'ready', email: result.data?.contactEmail ?? null }
          : { status: 'error' },
      );
    });
    return () => {
      active = false;
    };
  }, [settingsAction]);

  return (
    <div className="flex flex-wrap items-start gap-space-3">
      {state.status === 'loading' ? (
        <p className="text-caption text-ink-muted">Loading contact options…</p>
      ) : state.status === 'ready' && state.email ? (
        <a
          className="inline-flex min-h-12 items-center rounded-md border border-rule-strong px-space-4 font-semibold text-brand underline underline-offset-4"
          href={`mailto:${state.email}`}
        >
          Talk to us
        </a>
      ) : (
        <p className="text-caption text-ink-muted">
          {state.status === 'error'
            ? 'Contact email is temporarily unavailable; use the enquiry form below.'
            : 'No public email is set; use the enquiry form below.'}
        </p>
      )}
      <a
        className="inline-flex min-h-12 items-center rounded-md bg-brand px-space-4 font-semibold text-on-brand"
        href="#enquiry"
      >
        Send an enquiry
      </a>
    </div>
  );
}
