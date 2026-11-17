// Upload immutable move proofs and request short-lived, parent-authorised document links.
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { z } from 'zod';
import { publicEnvironment } from '@/core/config/public-env';
import { FILE_CONTENT_TYPES, MAX_FILE_BYTES } from '@/core/files/constraints';
import { TENANCY_DOCUMENT_LABELS } from '@/core/tenancy/moves/presentation';
import {
  tenancyDocumentInputSchema,
  tenancyDocumentPathSchema,
  type TenancyMoveDetail,
  type TenancyProofKind,
} from '@/core/tenancy/moves/validation';
import { attachTenancyProofAction } from '@/app/(resident)/tenancy/actions';
import { Button } from '@/components/ui/button';
import { FileUpload, type UploadFile } from '@/components/ui/file-upload';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { useTenancyPresentation } from './presentation';

const uploadEnvelope = z.object({
  ok: z.literal(true),
  data: z.object({ path: tenancyDocumentPathSchema, signedUrl: z.url() }),
});
const viewEnvelope = z.object({
  ok: z.literal(true),
  data: z.object({
    signedUrl: z.url(),
    expiresIn: z.number().int().min(1).max(300),
  }),
});
const failureEnvelope = z.object({
  ok: z.literal(false),
  error: z.object({
    message: z.string().trim().min(1).max(1000),
    referenceId: z.string().max(128).optional(),
  }),
});

async function fileResult<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(
      'The file service returned an invalid response. Nothing was attached; retry.',
    );
  }
  const failure = failureEnvelope.safeParse(value);
  if (failure.success) {
    throw new Error(
      `${failure.data.error.message}${failure.data.error.referenceId ? ` Reference: ${failure.data.error.referenceId}` : ''}`,
    );
  }
  const success = schema.safeParse(value);
  if (!response.ok || !success.success) {
    throw new Error(
      'The file request was not completed. Retry; no document was attached.',
    );
  }
  return success.data;
}

function storageUrl(value: string, path: string, upload = false) {
  let url: URL;
  let objectPath: string;
  try {
    url = new URL(value);
    objectPath = decodeURIComponent(url.pathname);
  } catch {
    throw new Error(
      'The private file link is invalid. No file was sent; refresh and retry.',
    );
  }
  const configured = new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL);
  const expectedPath = `${configured.pathname.replace(/\/$/, '')}/storage/v1/object/${upload ? 'upload/sign' : 'sign'}/tenancy-files/${path}`;
  if (url.origin !== configured.origin || objectPath !== expectedPath) {
    throw new Error(
      'The private file link is invalid. No file was sent; refresh and retry.',
    );
  }
  return url.href;
}

export function TenancyProofUpload({
  detail,
  kind,
  action = attachTenancyProofAction,
  request = fetch,
}: {
  detail: TenancyMoveDetail;
  kind: TenancyProofKind;
  action?: ModuleFormAction;
  request?: typeof fetch;
}) {
  const { t, translateFeedback } = useTenancyPresentation();
  const id = useId();
  const currentUpload = useRef<AbortController | null>(null);
  const [files, setFiles] = useState<readonly UploadFile[]>([]);
  const [path, setPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const label = t(TENANCY_DOCUMENT_LABELS[kind]);
  useEffect(
    () => () => {
      const active = currentUpload.current;
      currentUpload.current = null;
      active?.abort();
    },
    [],
  );

  async function upload(selected: UploadFile) {
    currentUpload.current?.abort();
    const controller = new AbortController();
    currentUpload.current = controller;
    setFiles([{ file: selected.file, id: selected.id }]);
    setUploading(true);
    setPath(null);
    setMessage('Uploading privately. The proof is not attached yet.');
    const slow = window.setTimeout(() => {
      if (currentUpload.current === controller) {
        setMessage(
          'Still uploading. Remove the file to cancel, or wait for the result.',
        );
      }
    }, 10_000);
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const file = selected.file;
      if (file.size < 1 || file.size > MAX_FILE_BYTES) {
        throw new Error('Choose a non-empty PDF, JPG or PNG up to 5 MiB.');
      }
      const response = await request('/api/files/upload-url', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': crypto.randomUUID(),
        },
        body: JSON.stringify({
          bucket: 'tenancy-files',
          moveId: detail.move.id,
          kind,
          contentType: file.type,
          sizeBytes: file.size,
        }),
        signal: controller.signal,
      });
      const result = await fileResult(response, uploadEnvelope);
      const parts = result.data.path.split('/');
      if (parts[2] !== detail.move.id || parts[3] !== kind) {
        throw new Error(
          'The upload link belongs to a different request. No file was sent; refresh and retry.',
        );
      }
      if (currentUpload.current !== controller || controller.signal.aborted)
        return;
      const stored = await request(
        storageUrl(result.data.signedUrl, result.data.path, true),
        {
          method: 'PUT',
          headers: {
            'content-type': file.type,
            'x-upsert': 'false',
            'cache-control': 'max-age=3600',
          },
          body: file,
          signal: controller.signal,
          redirect: 'error',
        },
      );
      if (!stored.ok)
        throw new Error(
          'The file could not be uploaded. It was not attached; retry or remove it.',
        );
      if (currentUpload.current !== controller) return;
      setPath(result.data.path);
      setMessage(
        'Uploaded privately. Attach the proof below to save it to this request.',
      );
    } catch (error) {
      if (currentUpload.current !== controller) return;
      setFiles([
        {
          ...selected,
          error: controller.signal.aborted
            ? t('The upload timed out. No proof was attached; retry.')
            : error instanceof Error
              ? translateFeedback(error.message)
              : t('The upload failed. No proof was attached; retry.'),
        },
      ]);
      setMessage(null);
    } finally {
      window.clearTimeout(slow);
      window.clearTimeout(timeout);
      if (currentUpload.current === controller) {
        currentUpload.current = null;
        setUploading(false);
      }
    }
  }

  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Attach {label}', { label })}
      submitDisabled={!path || uploading}
      input={() =>
        tenancyDocumentInputSchema.parse({
          moveId: detail.move.id,
          expectedVersion: detail.move.version,
          kind,
          path,
        })
      }
    >
      <FileUpload
        id={id}
        label={label}
        acceptedTypes={FILE_CONTENT_TYPES}
        maxFileBytes={MAX_FILE_BYTES}
        maxFiles={1}
        files={files}
        helpText={t(
          'Private PDF, JPG or PNG, up to 5 MiB. Do not upload Aadhaar or other government ID copies.',
        )}
        onRetry={(file) => void upload(file)}
        onFilesChange={(next) => {
          if (next.length > 0) void upload(next[0]!);
          else {
            currentUpload.current?.abort();
            currentUpload.current = null;
            setFiles([]);
            setPath(null);
            setUploading(false);
            setMessage(
              'File removed from this form. No proof was attached; unused uploads are cleaned up automatically.',
            );
          }
        }}
      />
      {message ? (
        <p role="status" className="text-caption text-ink-muted">
          {t(message)}
        </p>
      ) : null}
    </ModuleActionForm>
  );
}

export function TenancyDocumentLink({
  path,
  label,
  request = fetch,
}: {
  path: string;
  label: string;
  request?: typeof fetch;
}) {
  const { t, translateFeedback } = useTenancyPresentation();
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<{ url: string; expiresIn: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!link) return;
    const timer = window.setTimeout(() => {
      setLink(null);
      setMessage(
        'The private link expired. Request a new link to open this document.',
      );
    }, link.expiresIn * 1000);
    return () => window.clearTimeout(timer);
  }, [link]);

  async function prepare() {
    setPending(true);
    setError(null);
    setLink(null);
    setMessage(null);
    try {
      const result = await fileResult(
        await request('/api/files/url', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-request-id': crypto.randomUUID(),
          },
          body: JSON.stringify({ bucket: 'tenancy-files', path }),
          signal: AbortSignal.timeout(15_000),
          cache: 'no-store',
        }),
        viewEnvelope,
      );
      setLink({
        url: storageUrl(result.data.signedUrl, path),
        expiresIn: result.data.expiresIn,
      });
    } catch (cause) {
      setError(
        cause instanceof Error &&
          cause.name !== 'TimeoutError' &&
          cause.name !== 'AbortError'
          ? cause.message
          : 'Could not open this private document. Retry.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="grid gap-space-2">
      <Button
        loading={pending}
        variant="secondary"
        onClick={() => void prepare()}
      >
        {t(link ? 'Refresh {label} link' : 'View {label}', { label })}
      </Button>
      {link ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {t('Open {label} (private link, up to five minutes)', { label })}
        </a>
      ) : null}
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {translateFeedback(error)}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-caption text-ink-muted">
          {t(message)}
        </p>
      ) : null}
    </div>
  );
}
