// Upload one private staff portrait before saving the staff profile.
'use client';

import { useId, useRef, useState } from 'react';
import { publicEnvironment } from '@/core/config/public-env';

type UploadEnvelope = {
  ok: boolean;
  data?: { path?: string; signedUrl?: string };
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];

async function readEnvelope(response: Response): Promise<UploadEnvelope> {
  try {
    return (await response.json()) as UploadEnvelope;
  } catch {
    throw new Error('The upload service returned an invalid response.');
  }
}

export function StaffPhotoUpload({
  initialPath = null,
  required = true,
}: {
  initialPath?: string | null;
  required?: boolean;
}) {
  const [path, setPath] = useState<string | null>(initialPath);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function upload(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setUploading(true);
    try {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        throw new Error('Choose a JPEG or PNG photo.');
      }
      if (file.size < 1 || file.size > MAX_FILE_BYTES) {
        throw new Error('The staff photo must be 5 MB or smaller.');
      }
      const response = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: 'staff-photos',
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const result = await readEnvelope(response);
      const signedUrl = result.data?.signedUrl;
      const uploadedPath = result.data?.path;
      if (!response.ok || !result.ok || !signedUrl || !uploadedPath) {
        throw new Error('A staff photo upload link could not be issued.');
      }
      if (
        new URL(signedUrl).origin !==
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      ) {
        throw new Error('The staff photo upload link is invalid.');
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
        throw new Error('The staff photo could not be uploaded.');
      }
      setPath(uploadedPath);
      setMessage('Photo uploaded.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The photo could not be uploaded.',
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removePhoto() {
    if (!path) return;
    setMessage(null);
    setRemoving(true);
    try {
      if (path !== initialPath) {
        const response = await fetch('/api/files/upload-url', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ bucket: 'staff-photos', path }),
        });
        const result = await readEnvelope(response);
        if (!response.ok || !result.ok) {
          throw new Error('The unattached staff photo could not be removed.');
        }
      }
      setPath(null);
      setMessage('Photo removed. Save the profile to apply this change.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The photo could not be removed.',
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="grid gap-space-2">
      <input
        name="uploadPending"
        type="hidden"
        value={uploading || removing ? 'true' : 'false'}
      />
      <input name="photoPath" type="hidden" value={path ?? ''} />
      <label className="grid gap-space-1 text-body-strong" htmlFor={inputId}>
        Staff photo (JPEG or PNG, up to 5 MB)
        <input
          accept={ACCEPTED_TYPES.join(',')}
          className="min-h-12 w-full min-w-0 rounded-md border border-rule px-space-3 py-space-2 focus-visible:outline-2 focus-visible:outline-focus"
          disabled={uploading}
          id={inputId}
          onChange={(event) => void upload(event.currentTarget.files?.[0])}
          ref={inputRef}
          required={required && !path}
          type="file"
        />
      </label>
      {path ? (
        <div className="flex items-center justify-between gap-space-3">
          <span className="text-caption text-ink-muted">
            {initialPath === path ? 'Current photo' : 'Photo uploaded'}
          </span>
          <button
            className="min-h-10 rounded-md px-space-2 text-danger underline focus-visible:outline-2 focus-visible:outline-focus"
            disabled={uploading || removing}
            onClick={() => void removePhoto()}
            type="button"
          >
            {removing ? 'Removing…' : 'Remove photo'}
          </button>
        </div>
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
