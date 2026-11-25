// Render published platform updates and mark them read without email or push.
'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { ServerActionResult } from '@/core/actions/server-action';
import type { PlatformUpdate } from '@/core/updates/operations';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';

export function PlatformUpdateList({
  markReadAction,
  updates,
}: {
  updates: PlatformUpdate[];
  markReadAction: (formData: FormData) => Promise<ServerActionResult<unknown>>;
}) {
  const { locale, translate: t } = useUiTranslator();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');

  function markRead(updateId: string) {
    const formData = new FormData();
    formData.set('updateId', updateId);
    startTransition(async () => {
      const result = await markReadAction(formData);
      setMessage(result.message ?? t('Release note marked read.'));
    });
  }

  if (updates.length === 0) {
    return (
      <EmptyState
        description={t('Published developer release notes will appear here.')}
        title={t('Nothing new yet')}
      />
    );
  }

  return (
    <div className="grid gap-space-4">
      {message ? (
        <p aria-live="polite" className="text-caption text-ink-muted">
          {message}
        </p>
      ) : null}
      <ol className="grid gap-space-4">
        {updates.map((update) => (
          <li
            className="rounded-md border border-rule bg-surface p-space-5"
            key={update.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-space-3">
              <div>
                <h2 className="text-heading font-semibold">{update.title}</h2>
                <p className="mt-space-1 text-caption text-ink-muted">
                  {update.publishedAt
                    ? new Intl.DateTimeFormat(
                        locale === 'hi' ? 'hi-IN' : 'en-IN',
                        {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: 'Asia/Kolkata',
                        },
                      ).format(new Date(update.publishedAt))
                    : null}
                </p>
              </div>
              {!update.hasRead ? (
                <span className="rounded-full bg-brand px-space-2 py-space-1 text-micro font-semibold text-on-brand">
                  {t('New')}
                </span>
              ) : null}
            </div>
            <p className="mt-space-4 whitespace-pre-wrap text-body">
              {update.body}
            </p>
            <div className="mt-space-4 flex flex-wrap gap-space-3">
              {update.href ? (
                <Link
                  className="inline-flex min-h-12 items-center text-brand underline"
                  href={update.href}
                >
                  {t('Open related page')}
                </Link>
              ) : null}
              {!update.hasRead ? (
                <Button
                  disabled={pending}
                  loading={pending}
                  onClick={() => markRead(update.id)}
                  type="button"
                  variant="secondary"
                >
                  {t('Mark as read')}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
