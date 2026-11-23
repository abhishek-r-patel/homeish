// Upload one optional private P50.1b structural-audit report.
'use client';
import { useRef, useState } from 'react';
import { useUiTranslator } from '@/components/ui/language';
import { publicEnvironment } from '@/core/config/public-env';
import { FILE_CONTENT_TYPES } from '@/core/files/constraints';
import { MAJOR_WORKS_FILE_BYTES } from '@/core/major-works/validation';

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

export function MajorWorksAuditFileUpload({
  fieldName = 'reportPath',
  initialPath = null,
  kind = 'audit_report',
  label = 'Private report (optional: JPEG, PNG or PDF up to 10 MB)',
}: {
  fieldName?: string;
  initialPath?: string | null;
  kind?: 'audit_report' | 'quote' | 'proposal' | 'consent_form';
  label?: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const [path, setPath] = useState(initialPath);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    setUploading(true);
    try {
      if (!FILE_CONTENT_TYPES.some((type) => type === file.type)) {
        throw new Error('Choose a JPEG, PNG or PDF file.');
      }
      if (file.size < 1 || file.size > MAJOR_WORKS_FILE_BYTES) {
        throw new Error('The audit report must be 10 MB or smaller.');
      }
      const response = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: 'major-works-files',
          kind,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const result = await readEnvelope(response);
      const signedUrl = result.data?.signedUrl;
      const uploadedPath = result.data?.path;
      if (!response.ok || !result.ok || !signedUrl || !uploadedPath) {
        throw new Error('An audit report upload link could not be issued.');
      }
      if (
        new URL(signedUrl).origin !==
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      ) {
        throw new Error('The audit report upload link is invalid.');
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
        throw new Error('The audit report could not be uploaded.');
      }
      setPath(uploadedPath);
      setMessage('Audit report uploaded.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The audit report could not be uploaded.',
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="grid min-w-0 gap-space-2">
      <input name={fieldName} type="hidden" value={path ?? ''} />
      <input
        name="uploadPending"
        type="hidden"
        value={uploading ? 'true' : 'false'}
      />
      <label className="grid min-w-0 gap-space-1 text-body-strong">
        {t(label)}
        <input
          accept={FILE_CONTENT_TYPES.join(',')}
          className="min-h-12 w-full min-w-0 max-w-full rounded-md border border-rule px-space-3 py-space-2"
          disabled={uploading}
          onChange={(event) => void upload(event.currentTarget.files?.[0])}
          ref={inputRef}
          type="file"
        />
      </label>
      {path ? (
        <button
          className="justify-self-start text-brand underline"
          onClick={() => {
            setPath(null);
            setMessage('Audit report removed.');
          }}
          type="button"
        >
          {t('Remove report')}
        </button>
      ) : null}
      <p className="text-caption text-ink-muted" role="status">
        {uploading
          ? t('Uploading report...')
          : message
            ? translateFeedback(message)
            : null}
      </p>
    </div>
  );
}
