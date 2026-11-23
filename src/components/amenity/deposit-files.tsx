// Upload and open private P35 amenity deposit evidence.
'use client';

import { useRef, useState, useTransition } from 'react';
import { publicEnvironment } from '@/core/config/public-env';
import { AMENITY_DEPOSIT_EVIDENCE_TYPES } from '@/core/amenity/validation';
import { Button } from '@/components/ui/button';
import { useUiTranslator } from '@/components/ui/language';

export function AmenityDepositEvidenceUpload({
  bookingId,
  onUploaded,
}: {
  bookingId: string;
  onUploaded: (path: string) => void;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setMessage(null);
    try {
      if (
        !AMENITY_DEPOSIT_EVIDENCE_TYPES.some((type) => type === file.type) ||
        file.size < 1 ||
        file.size > 5 * 1024 * 1024
      )
        throw new Error('Choose a JPG, PNG or PDF up to 5 MiB.');
      const response = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: 'amenity-deposit-evidence',
          bookingId,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { path?: string; signedUrl?: string };
      };
      if (
        !response.ok ||
        !result.ok ||
        !result.data?.path ||
        !result.data.signedUrl
      )
        throw new Error(
          'The deposit evidence upload link could not be issued.',
        );
      const signedUrl = result.data.signedUrl;
      if (
        new URL(signedUrl).origin !==
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      )
        throw new Error('The deposit evidence upload link is invalid.');
      const uploaded = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'cache-control': 'max-age=3600',
          'content-type': file.type,
          'x-upsert': 'false',
        },
        body: file,
      });
      if (!uploaded.ok)
        throw new Error('The deposit evidence could not be uploaded.');
      onUploaded(result.data.path);
      setMessage('Deposit evidence uploaded.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The evidence upload failed.',
      );
    } finally {
      setPending(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="grid gap-space-2">
      <label className="grid gap-space-1 font-semibold">
        {t('Private deduction evidence')}
        <input
          accept={AMENITY_DEPOSIT_EVIDENCE_TYPES.join(',')}
          className="min-h-12 w-full min-w-0 rounded-md border border-rule px-space-3 py-space-2"
          disabled={pending}
          onChange={(event) => void upload(event.currentTarget.files?.[0])}
          ref={input}
          type="file"
        />
      </label>
      <input name="uploadPending" type="hidden" value={String(pending)} />
      <p className="text-caption text-ink-muted" role="status">
        {pending
          ? t('Uploading deposit evidence...')
          : message
            ? translateFeedback(message)
            : null}
      </p>
    </div>
  );
}

export function AmenityDepositEvidenceLink({ path }: { path: string }) {
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
                body: JSON.stringify({
                  bucket: 'amenity-deposit-evidence',
                  path,
                }),
              });
              const result = (await response.json()) as {
                ok: boolean;
                data?: { signedUrl?: string };
              };
              const signedUrl = result.data?.signedUrl;
              if (!response.ok || !result.ok || !signedUrl)
                throw new Error('Could not open the deposit evidence.');
              if (
                new URL(signedUrl).origin !==
                new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
              )
                throw new Error('The deposit evidence link is invalid.');
              window.open(signedUrl, '_blank', 'noopener,noreferrer');
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'Could not open the deposit evidence.',
              );
            }
          })
        }
      >
        {t('View deposit evidence')}
      </Button>
      {error ? (
        <p className="text-caption text-danger" role="alert">
          {translateFeedback(error)}
        </p>
      ) : null}
    </div>
  );
}
