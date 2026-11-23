// Upload one private P36.7 handover JPG, PNG or PDF and expose its signed path.
'use client';
import { useRef, useState } from 'react';
import { publicEnvironment } from '@/core/config/public-env';
import { HANDOVER_FILE_CONTENT_TYPES } from '@/core/structure/handover-validation';
import { useUiTranslator } from '@/components/ui/language';

type UploadResult = {
  ok: boolean;
  data?: { path?: string; signedUrl?: string };
};

export function HandoverFileUpload({
  handoverId,
  onUploaded,
}: {
  handoverId: string;
  onUploaded: (file: {
    path: string;
    contentType: string;
    sizeBytes: number;
  }) => void;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setUploading(true);
    try {
      if (
        !HANDOVER_FILE_CONTENT_TYPES.some((type) => type === file.type) ||
        file.size < 1 ||
        file.size > 5 * 1024 * 1024
      )
        throw new Error('Choose a JPG, PNG or PDF up to 5 MiB.');
      const response = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: 'handover-photos',
          handoverId,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const result = (await response.json()) as UploadResult;
      const path = result.data?.path;
      const signedUrl = result.data?.signedUrl;
      if (!response.ok || !result.ok || !path || !signedUrl)
        throw new Error('The handover upload link could not be issued.');
      if (
        new URL(signedUrl).origin !==
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      )
        throw new Error('The handover upload link is invalid.');
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
        throw new Error('The handover file could not be uploaded.');
      onUploaded({ path, contentType: file.type, sizeBytes: file.size });
      setMessage('Handover file uploaded.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The handover upload failed.',
      );
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="grid gap-space-2">
      <label className="grid gap-space-1 font-semibold">
        {t('Private handover file (optional)')}
        <input
          ref={input}
          type="file"
          accept={HANDOVER_FILE_CONTENT_TYPES.join(',')}
          disabled={uploading}
          className="min-h-12 w-full min-w-0 max-w-full rounded-md border border-rule px-space-3 py-space-2"
          onChange={(event) => void upload(event.currentTarget.files?.[0])}
        />
      </label>
      <p className="text-caption text-ink-muted" role="status">
        {uploading
          ? t('Uploading handover file...')
          : message
            ? translateFeedback(message)
            : null}
      </p>
    </div>
  );
}
