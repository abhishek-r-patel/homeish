// Upload up to three private request photos before submitting a request.
'use client';

import { useEffect, useRef, useState } from 'react';
import { publicEnvironment } from '@/core/config/public-env';

type UploadEnvelope = {
  ok: boolean;
  data?: { path?: string; signedUrl?: string };
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 3;

async function readEnvelope(response: Response): Promise<UploadEnvelope> {
  try {
    return (await response.json()) as UploadEnvelope;
  } catch {
    throw new Error('The upload service returned an invalid response.');
  }
}

export function ServiceRequestPhotoUpload({
  getRequestId,
  requestId,
}: {
  getRequestId: () => string;
  requestId: string;
}) {
  const [paths, setPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = inputRef.current?.closest('form');
    if (!form) return;
    function reset() {
      setPaths([]);
      setUploading(false);
      setMessage(null);
    }
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  }, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    if (paths.length + files.length > MAX_FILES) {
      setMessage('A request can include at most three photos.');
      return;
    }
    setUploading(true);
    const uploadedPaths = [...paths];
    try {
      const uploadRequestId = requestId || getRequestId();
      for (const file of Array.from(files)) {
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
          throw new Error('Choose a JPEG or PNG image.');
        }
        if (file.size < 1 || file.size > MAX_FILE_BYTES) {
          throw new Error('Each photo must be 5 MB or smaller.');
        }
        const response = await fetch('/api/files/upload-url', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            bucket: 'request-files',
            contentType: file.type,
            sizeBytes: file.size,
            requestId: uploadRequestId,
          }),
        });
        const result = await readEnvelope(response);
        const signedUrl = result.data?.signedUrl;
        const path = result.data?.path;
        if (!response.ok || !result.ok || !signedUrl || !path) {
          throw new Error('A request photo upload link could not be issued.');
        }
        if (
          new URL(signedUrl).origin !==
          new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
        ) {
          throw new Error('The request photo upload link is invalid.');
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
          throw new Error('A request photo could not be uploaded.');
        }
        uploadedPaths.push(path);
        setPaths([...uploadedPaths]);
      }
      setPaths(uploadedPaths);
      setMessage('Request photos uploaded.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'A request photo could not be uploaded.',
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="grid min-w-0 gap-space-2">
      <input name="attachments" type="hidden" value={JSON.stringify(paths)} />
      <input
        name="uploadPending"
        type="hidden"
        value={uploading ? 'true' : 'false'}
      />
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="request-photos"
      >
        Photos (optional, up to 3)
        <input
          accept="image/jpeg,image/png"
          className="min-h-12 w-full min-w-0 max-w-full rounded-md border border-rule px-space-3 py-space-2"
          disabled={uploading || paths.length >= MAX_FILES}
          id="request-photos"
          multiple
          onChange={(event) => void upload(event.currentTarget.files)}
          ref={inputRef}
          type="file"
        />
      </label>
      {paths.map((path) => (
        <div
          className="flex items-center justify-between gap-space-3 text-caption"
          key={path}
        >
          <span>Photo attached</span>
          <button
            className="min-h-10 rounded-md px-space-2 text-danger underline"
            onClick={() =>
              setPaths((current) => current.filter((item) => item !== path))
            }
            type="button"
          >
            Remove photo
          </button>
        </div>
      ))}
      <p
        aria-live="polite"
        className="text-caption text-ink-muted"
        role="status"
      >
        {uploading ? 'Uploading photos…' : message}
      </p>
    </div>
  );
}
