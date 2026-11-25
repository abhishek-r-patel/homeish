// Load and announce the current aggregate notice audience as form choices change.
'use client';

import { useEffect, useState, useTransition } from 'react';
import type { ServerActionResult } from '@/core/actions/server-action';
import type { NoticeAudience, NoticeReach } from '@/core/notices/validation';
import { formatNoticeReach } from '@/core/notices/reach';
import { useUiTranslator } from '@/components/ui/language';

export type NoticeReachAction = (
  formData: FormData,
) => Promise<ServerActionResult<NoticeReach>>;

export function NoticeReach({
  action,
  audience,
  blockIds,
  scheduled,
}: {
  action?: NoticeReachAction;
  audience: NoticeAudience;
  blockIds: string[];
  scheduled: boolean;
}) {
  const { translate: t } = useUiTranslator();
  const [pending, startTransition] = useTransition();
  const requestKey = JSON.stringify({ audience, blockIds });
  const [outcome, setOutcome] = useState<{
    key: string;
    reach: NoticeReach | null;
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    if (!action || (audience === 'blocks' && blockIds.length === 0)) return;
    let current = true;
    const formData = new FormData();
    formData.set('input', JSON.stringify({ audience, blockIds }));
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (!current) return;
        if (result.ok && result.data) {
          setOutcome({ key: requestKey, reach: result.data, failed: false });
          return;
        }
        setOutcome({ key: requestKey, reach: null, failed: true });
      } catch {
        if (current) {
          setOutcome({ key: requestKey, reach: null, failed: true });
        }
      }
    });
    return () => {
      current = false;
    };
  }, [action, audience, blockIds, requestKey]);

  const currentOutcome = outcome?.key === requestKey ? outcome : null;
  const waiting =
    action !== undefined &&
    (audience !== 'blocks' || blockIds.length > 0) &&
    !currentOutcome;
  const reach = currentOutcome?.reach ?? null;
  const failed = currentOutcome?.failed ?? false;

  return (
    <p
      aria-live={failed ? undefined : 'polite'}
      className={`text-caption ${failed ? 'text-danger' : 'text-ink-muted'}`}
      role={failed ? 'alert' : 'status'}
    >
      {pending || waiting
        ? t('Counting the current audience…')
        : failed
          ? t('The audience count could not be loaded. Change it or retry.')
          : reach
            ? formatNoticeReach(reach, scheduled, t)
            : t('The reach count will appear after an audience is chosen.')}
    </p>
  );
}
