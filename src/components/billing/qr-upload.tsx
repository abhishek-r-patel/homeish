// Upload one private society QR image with progress, retry and unused-file cleanup.
'use client';

import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FileUpload, type UploadFile } from '@/components/ui/file-upload';
import { publicEnvironment } from '@/core/config/public-env';

const uploadResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({ path: z.string(), signedUrl: z.url() }),
});

export function BillingQrUpload({
  initialPath,
  onChange,
  onErrorChange,
  onUploadingChange,
  societyId,
}: {
  initialPath: string | null;
  onChange: (path: string | null) => void;
  onErrorChange: (failed: boolean) => void;
  onUploadingChange: (uploading: boolean) => void;
  societyId: string;
}) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [path, setPath] = useState(initialPath);
  const [message, setMessage] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const busyRef = useRef(false);

  useEffect(() => () => xhrRef.current?.abort(), []);

  async function removeUnused(uploadedPath: string) {
    const response = await fetch('/api/files/upload-url', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bucket: 'society-assets', path: uploadedPath }),
    });
    if (!response.ok) {
      throw new Error(
        'The unused QR image could not be removed. Retry before uploading another.',
      );
    }
  }

  async function uploadFile(upload: UploadFile) {
    if (busyRef.current) return;
    busyRef.current = true;
    onUploadingChange(true);
    onErrorChange(false);
    setMessage(null);
    setFiles((current) =>
      current.map((item) =>
        item.id === upload.id
          ? { ...item, error: undefined, progress: 0 }
          : item,
      ),
    );
    try {
      const response = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: 'society-assets',
          purpose: 'billing-qr',
          societyId,
          contentType: upload.file.type,
          sizeBytes: upload.file.size,
        }),
      });
      const result = uploadResponseSchema.safeParse(await response.json());
      if (!response.ok || !result.success) {
        throw new Error(
          'The QR image upload link could not be issued. Remove any unused upload and retry.',
        );
      }
      const { signedUrl, path: nextPath } = result.data.data;
      if (
        new URL(signedUrl).origin !==
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      ) {
        throw new Error('The QR image upload link is invalid.');
      }
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('PUT', signedUrl);
        xhr.timeout = 60_000;
        xhr.setRequestHeader('content-type', upload.file.type);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const progress = Math.round((event.loaded / event.total) * 100);
          setFiles((current) =>
            current.map((item) =>
              item.id === upload.id ? { ...item, progress } : item,
            ),
          );
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else
            reject(
              new Error(
                'The QR image could not be uploaded. Retry or remove it.',
              ),
            );
        };
        xhr.onerror = () =>
          reject(
            new Error(
              'The QR image could not be uploaded. Check your connection and retry.',
            ),
          );
        xhr.ontimeout = () =>
          reject(
            new Error('The QR image upload timed out. Retry or remove it.'),
          );
        xhr.onabort = () =>
          reject(new Error('The QR image upload was cancelled.'));
        xhr.send(upload.file);
      });
      setPath(nextPath);
      onChange(nextPath);
      setFiles((current) =>
        current.map((item) =>
          item.id === upload.id ? { ...item, progress: 100 } : item,
        ),
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'The QR image could not be uploaded.';
      setMessage(errorMessage);
      onErrorChange(true);
      setFiles((current) =>
        current.map((item) =>
          item.id === upload.id ? { ...item, error: errorMessage } : item,
        ),
      );
    } finally {
      xhrRef.current = null;
      busyRef.current = false;
      onUploadingChange(false);
    }
  }

  async function changeFiles(next: readonly UploadFile[]) {
    if (busyRef.current) {
      setMessage(
        'Wait for the current upload to finish before changing the QR image.',
      );
      return;
    }
    if (next.length === 0) {
      if (path && path !== initialPath) {
        busyRef.current = true;
        onUploadingChange(true);
        try {
          await removeUnused(path);
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'The unused upload could not be removed.',
          );
          return;
        } finally {
          busyRef.current = false;
          onUploadingChange(false);
        }
      }
      setFiles([]);
      setPath(initialPath);
      onChange(initialPath);
      setMessage(null);
      onErrorChange(false);
      return;
    }
    setFiles([...next]);
    const added = next.find((item) => !files.some(({ id }) => id === item.id));
    if (added) await uploadFile(added);
  }

  return (
    <div className="grid gap-space-2">
      {initialPath && path === initialPath ? (
        <Button
          onClick={() => {
            setPath(null);
            onChange(null);
          }}
          variant="tertiary"
        >
          Remove Saved QR Image
        </Button>
      ) : null}
      <FileUpload
        acceptedTypes={['image/jpeg', 'image/png']}
        files={files}
        helpText="Optional JPG or PNG, up to 5 MB. Check that the QR belongs to the displayed UPI account."
        id="billing-qr-upload"
        label="UPI QR image"
        maxFileBytes={5 * 1024 * 1024}
        maxFiles={1}
        onFilesChange={(next) => void changeFiles(next)}
        onRetry={(upload) => void uploadFile(upload)}
      />
      {message ? (
        <p className="text-caption text-danger" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
