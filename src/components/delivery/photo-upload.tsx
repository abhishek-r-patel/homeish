// Upload one private delivery photo and attach its verified storage path.
'use client';

import { useEffect, useRef, useState } from 'react';
import { publicEnvironment } from '@/core/config/public-env';

type UploadEnvelope = {
  ok: boolean;
  data?: { path?: string; signedUrl?: string };
};

export function DeliveryPhotoUpload({
  unitSelectId,
}: {
  unitSelectId: string;
}) {
  const [path, setPath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = inputRef.current?.closest('form');
    const unit = document.getElementById(unitSelectId);
    if (!form || !(unit instanceof HTMLSelectElement)) return;
    function reset() {
      setPath('');
      setUploading(false);
      setMessage(null);
      if (inputRef.current) inputRef.current.value = '';
    }
    function clearForUnitChange() {
      reset();
      setMessage('Choose a new photo for the selected unit.');
    }
    form.addEventListener('reset', reset);
    unit.addEventListener('change', clearForUnitChange);
    return () => {
      form.removeEventListener('reset', reset);
      unit.removeEventListener('change', clearForUnitChange);
    };
  }, [unitSelectId]);

  async function upload(file: File) {
    setMessage(null);
    setUploading(true);
    try {
      const unit = document.getElementById(unitSelectId);
      if (!(unit instanceof HTMLSelectElement) || !unit.value) {
        throw new Error('Choose a unit before uploading the delivery photo.');
      }
      const response = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: 'delivery-photos',
          contentType: file.type,
          sizeBytes: file.size,
          unitId: unit.value,
        }),
      });
      const result = (await response.json()) as UploadEnvelope;
      const signedUrl = result.data?.signedUrl;
      const nextPath = result.data?.path;
      if (!response.ok || !result.ok || !signedUrl || !nextPath) {
        throw new Error('A delivery photo upload link could not be issued.');
      }
      if (
        new URL(signedUrl).origin !==
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      ) {
        throw new Error('The delivery photo upload link is invalid.');
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
        throw new Error('The delivery photo could not be uploaded.');
      }
      setPath(nextPath);
      setMessage('Delivery photo uploaded.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The delivery photo could not be uploaded.',
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
        htmlFor="delivery-photo"
      >
        Delivery photo (optional)
        <input
          accept="image/jpeg,image/png"
          className="min-h-12 rounded-md border border-rule px-space-3 py-space-2"
          disabled={uploading}
          id="delivery-photo"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void upload(file);
          }}
          ref={inputRef}
          type="file"
        />
      </label>
      {path ? (
        <p className="text-caption text-ink-muted">
          Photo attached to this delivery.
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
