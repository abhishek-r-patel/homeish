// Open one authorized private handover file through a five-minute URL.
'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useUiTranslator } from '@/components/ui/language';
import { publicEnvironment } from '@/core/config/public-env';

export function UnitHandoverFileLink({
  path,
  label,
}: {
  path: string;
  label: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-space-1">
      <Button
        loading={pending}
        variant="secondary"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const response = await fetch('/api/files/url', {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'x-request-id': crypto.randomUUID(),
                },
                body: JSON.stringify({ bucket: 'handover-photos', path }),
              });
              const result = (await response.json()) as {
                ok: boolean;
                data?: { signedUrl?: string };
              };
              const signedUrl = result.data?.signedUrl;
              if (!response.ok || !result.ok || !signedUrl)
                throw new Error('Could not open the handover file.');
              if (
                new URL(signedUrl).origin !==
                new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
              )
                throw new Error('The handover file link is invalid.');
              window.open(signedUrl, '_blank', 'noopener,noreferrer');
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'Could not open the handover file.',
              );
            }
          })
        }
      >
        {t('View {label}', { label })}
      </Button>
      {error ? (
        <p className="text-caption text-danger" role="alert">
          {translateFeedback(error)}
        </p>
      ) : null}
    </div>
  );
}
