// Upload one optional private notice attachment (image or PDF) before saving.
'use client';

import { useRef, useState } from 'react';
import { publicEnvironment } from '@/core/config/public-env';

type UploadEnvelope = {
  ok: boolean;
  data?: { path?: string; signedUrl?: string };
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

async function readEnvelope(response: Response): Promise<UploadEnvelope> {
  try {
    return (await response.json()) as UploadEnvelope;
  } catch {
    throw new Error('The upload service returned an invalid response.');
  }
}

export function NoticeAttachmentUpload({
  initialPath = null,
}: {
  initialPath?: string | null;
}) {
  const [path, setPath] = useState<string | null>(initialPath);
  const [label, setLabel] = useState<string | null>(
    initialPath ? 'Current attachment' : null,
  );
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setUploading(true);
    try {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        throw new Error('Choose a JPEG, PNG or PDF file.');
      }
      if (file.size < 1 || file.size > MAX_FILE_BYTES) {
        throw new Error('The attachment must be 5 MB or smaller.');
      }
      const response = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: 'notice-files',
          contentType: file.type,
          sizeBytes: file.size,
          requestId: crypto.randomUUID(),
        }),
      });
      const result = await readEnvelope(response);
      const signedUrl = result.data?.signedUrl;
      const uploadedPath = result.data?.path;
      if (!response.ok || !result.ok || !signedUrl || !uploadedPath) {
        throw new Error('An attachment upload link could not be issued.');
      }
      if (
        new URL(signedUrl).origin !==
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      ) {
        throw new Error('The attachment upload link is invalid.');
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
        throw new Error('The attachment could not be uploaded.');
      }
      setPath(uploadedPath);
      setLabel(file.name);
      setMessage('Attachment uploaded.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The attachment could not be uploaded.',
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="grid min-w-0 gap-space-2">
      <input name="attachmentPath" type="hidden" value={path ?? ''} />
      <input
        name="uploadPending"
        type="hidden"
        value={uploading ? 'true' : 'false'}
      />
      <label
        className="grid min-w-0 gap-space-1 text-body-strong"
        htmlFor="notice-attachment"
      >
        Attachment (optional: JPEG, PNG or PDF up to 5 MB)
        <input
          accept={ACCEPTED_TYPES.join(',')}
          className="min-h-12 w-full min-w-0 max-w-full rounded-md border border-rule px-space-3 py-space-2"
          disabled={uploading}
          id="notice-attachment"
          onChange={(event) => void upload(event.currentTarget.files?.[0])}
          ref={inputRef}
          type="file"
        />
      </label>
      {path ? (
        <div className="flex items-center justify-between gap-space-3 text-caption">
          <span className="min-w-0 break-words">{label}</span>
          <button
            className="min-h-10 rounded-md px-space-2 text-danger underline focus-visible:outline-2 focus-visible:outline-focus"
            onClick={() => {
              setPath(null);
              setLabel(null);
              setMessage('Attachment removed.');
            }}
            type="button"
          >
            Remove attachment
          </button>
        </div>
      ) : null}
      <p className="text-caption text-ink-muted" role="status">
        {uploading ? 'Uploading attachment…' : message}
      </p>
    </div>
  );
}
