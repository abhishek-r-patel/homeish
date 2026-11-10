// Upload one private visitor photo and expose its verified storage path.
'use client';

import { useEffect, useRef, useState } from 'react';
import { publicEnvironment } from '@/core/config/public-env';

type UploadEnvelope = {
  ok: boolean;
  data?: { path?: string; signedUrl?: string };
};

async function readEnvelope(response: Response): Promise<UploadEnvelope> {
  try {
    return (await response.json()) as UploadEnvelope;
  } catch {
    throw new Error('The upload service returned an invalid response.');
  }
}

export function VisitorPhotoUpload({
  required,
  unitSelectId,
}: {
  required: boolean;
  unitSelectId: string;
}) {
  const [path, setPath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = inputRef.current?.closest('form');
    if (!form) return;
    function reset() {
      setPath('');
      setUploading(false);
      setMessage(null);
    }
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  }, []);

  async function upload(file: File) {
    setMessage(null);
    setUploading(true);
    try {
      const unit = document.getElementById(unitSelectId);
      if (!(unit instanceof HTMLSelectElement) || !unit.value) {
        throw new Error('Choose a unit before uploading the visitor photo.');
      }
      const response = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: 'visitor-photos',
          contentType: file.type,
          sizeBytes: file.size,
          unitId: unit.value,
        }),
      });
      const result = await readEnvelope(response);
      const signedUrl = result.data?.signedUrl;
      const nextPath = result.data?.path;
      if (!response.ok || !result.ok || !signedUrl || !nextPath) {
        throw new Error('A visitor photo upload link could not be issued.');
      }
      if (
        new URL(signedUrl).origin !==
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      ) {
        throw new Error('The visitor photo upload link is invalid.');
      }
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'cache-control': 'max-age=3600',
          'content-type': file.type,
          'x-upsert': 'false',
        },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error('The visitor photo could not be uploaded.');
      }
      setPath(nextPath);
      setMessage('Visitor photo uploaded.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The visitor photo could not be uploaded.',
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-space-2">
      <input name="photoPath" type="hidden" value={path} />
      <input
        name="photoUploadPending"
        type="hidden"
        value={uploading ? 'true' : 'false'}
      />
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor="visitor-photo"
      >
        Visitor photo {required ? '(required)' : '(optional)'}
        <input
          accept="image/jpeg,image/png"
          className="min-h-12 rounded-md border border-rule px-space-3 py-space-2"
          disabled={uploading}
          id="visitor-photo"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void upload(file);
          }}
          required={required && !path}
          ref={inputRef}
          type="file"
        />
      </label>
      {path ? (
        <p className="text-caption text-ink-muted">
          Photo attached to this entry.
        </p>
      ) : null}
      <p
        aria-live="polite"
        className="text-caption text-ink-muted"
        role="status"
      >
        {uploading ? 'Uploading photo…' : message}
      </p>
    </div>
  );
}
