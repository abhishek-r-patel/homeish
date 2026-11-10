// Upload and preview a private society logo with per-file progress and retry.
'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ui/file-upload';
import type { UploadFile } from '@/components/ui/file-upload';
import { publicEnvironment } from '@/core/config/public-env';

type FileEnvelope = {
  ok: boolean;
  data?: { path?: string; signedUrl?: string };
};

async function responseData(response: Response): Promise<FileEnvelope> {
  try {
    return (await response.json()) as FileEnvelope;
  } catch {
    return { ok: false };
  }
}

export function SocietyLogoUpload({
  initialPath,
  onUploadingChange,
  societyId,
}: {
  initialPath: string | null;
  onUploadingChange: (uploading: boolean) => void;
  societyId: string;
}) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [logoPath, setLogoPath] = useState(initialPath ?? '');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const uploadRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    let active = true;
    if (!logoPath) return;
    void fetch('/api/files/url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bucket: 'society-assets', path: logoPath }),
    })
      .then(responseData)
      .then((result) => {
        const signedUrl = result.data?.signedUrl;
        if (active && result.ok && signedUrl) setLogoUrl(signedUrl);
      })
      .catch(() => {
        if (active) setMessage('The saved logo preview could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [logoPath]);

  async function uploadFile(upload: UploadFile) {
    setMessage(null);
    setLogoUrl(null);
    onUploadingChange(true);
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
          contentType: upload.file.type,
          sizeBytes: upload.file.size,
          societyId,
        }),
      });
      const result = await responseData(response);
      const signedUrl = result.data?.signedUrl;
      const path = result.data?.path;
      if (!response.ok || !result.ok || !signedUrl || !path) {
        throw new Error('The upload link could not be issued.');
      }

      const signedOrigin = new URL(signedUrl).origin;
      const storageOrigin = new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL)
        .origin;
      if (signedOrigin !== storageOrigin) {
        throw new Error('The upload link is invalid.');
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadRef.current = xhr;
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('content-type', upload.file.type);
        xhr.setRequestHeader('cache-control', 'max-age=3600');
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
          else reject(new Error('The file could not be uploaded.'));
        };
        xhr.onerror = () =>
          reject(new Error('The file could not be uploaded.'));
        xhr.onabort = () => reject(new Error('The upload was cancelled.'));
        xhr.send(upload.file);
      });

      setLogoPath(path);
      setFiles((current) =>
        current.map((item) =>
          item.id === upload.id ? { ...item, progress: 100 } : item,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The file could not be uploaded.';
      setFiles((current) =>
        current.map((item) =>
          item.id === upload.id ? { ...item, error: message } : item,
        ),
      );
      setMessage(message);
    } finally {
      uploadRef.current = null;
      onUploadingChange(false);
    }
  }

  async function removeUnattachedLogo(path: string) {
    const response = await fetch('/api/files/upload-url', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bucket: 'society-assets', path }),
    });
    if (!response.ok) setMessage('The unused upload could not be removed.');
  }

  function changeFiles(next: readonly UploadFile[]) {
    if (next.length === 0 && files.length > 0) {
      uploadRef.current?.abort();
      const uploadedPath =
        logoPath && logoPath !== initialPath ? logoPath : undefined;
      setFiles([]);
      setLogoPath(initialPath ?? '');
      if (uploadedPath) {
        setLogoUrl(null);
        void removeUnattachedLogo(uploadedPath);
      }
      return;
    }
    setFiles([...next]);
    const added = next.find((item) => !files.some(({ id }) => id === item.id));
    if (added) void uploadFile(added);
  }

  function removeSavedLogo() {
    setLogoPath('');
    setLogoUrl(null);
  }

  return (
    <div className="grid gap-space-3">
      <input name="logoPath" type="hidden" value={logoPath} />
      {logoUrl ? (
        <Image
          alt="Current society logo"
          className="size-20 rounded-md border border-rule object-contain p-space-2"
          height={80}
          src={logoUrl}
          unoptimized
          width={80}
        />
      ) : null}
      {initialPath && logoPath === initialPath ? (
        <Button onClick={removeSavedLogo} type="button" variant="tertiary">
          Remove saved logo
        </Button>
      ) : null}
      <FileUpload
        acceptedTypes={['image/jpeg', 'image/png']}
        files={files}
        helpText="JPG or PNG · Up to 5 MB"
        id={`society-logo-${societyId}`}
        label="Society logo"
        maxFileBytes={5 * 1024 * 1024}
        maxFiles={1}
        onFilesChange={changeFiles}
        onRetry={(upload) => void uploadFile(upload)}
      />
      {message ? (
        <p
          aria-live="polite"
          className="text-caption text-danger"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
