// Upload P51 agreement evidence and request short-lived links through the shared file routes.
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { z } from 'zod';
import { attachClearanceFileAction } from '@/app/(resident)/tenancy/actions';
import { publicEnvironment } from '@/core/config/public-env';
import { FILE_CONTENT_TYPES, MAX_FILE_BYTES } from '@/core/files/constraints';
import {
  clearanceFileInputSchema,
  transferFilePathSchema,
  clearanceUploadPathSchema,
  type ClearanceHandover,
} from '@/core/tenancy/transfers/validation';
import { Button } from '@/components/ui/button';
import { FileUpload, type UploadFile } from '@/components/ui/file-upload';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { useTenancyPresentation } from './presentation';

const uploadEnvelope = z.object({
  ok: z.literal(true),
  data: z.object({ path: clearanceUploadPathSchema, signedUrl: z.url() }),
});
const viewEnvelope = z.object({
  ok: z.literal(true),
  data: z.object({
    signedUrl: z.url(),
    expiresIn: z.number().int().min(1).max(300),
  }),
});

async function result<T>(response: Response, schema: z.ZodType<T>) {
  const value: unknown = await response.json().catch(() => null);
  const failure = z
    .object({
      ok: z.literal(false),
      error: z.object({
        message: z.string(),
        referenceId: z.string().optional(),
      }),
    })
    .safeParse(value);
  if (failure.success) {
    throw new Error(
      `${failure.data.error.message}${failure.data.error.referenceId ? ` Reference: ${failure.data.error.referenceId}` : ''}`,
    );
  }
  const parsed = schema.safeParse(value);
  if (!response.ok || !parsed.success) {
    throw new Error(
      'The private file request failed. Nothing is confirmed; retry.',
    );
  }
  return parsed.data;
}

function trustedUrl(value: string, path: string, upload = false) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('The private file link is invalid. No file was sent.');
  }
  const expected = new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL);
  const objectPath = decodeURIComponent(url.pathname);
  const prefix = `${expected.pathname.replace(/\/$/, '')}/storage/v1/object/${upload ? 'upload/sign' : 'sign'}/tenancy-files/`;
  if (url.origin !== expected.origin || objectPath !== `${prefix}${path}`) {
    throw new Error('The private file link is invalid. No file was sent.');
  }
  return url.href;
}

export function ClearanceAgreementUpload({
  handover,
  coveredTransferPartyId,
  coveredMembershipId,
  action = attachClearanceFileAction,
  request = fetch,
}: {
  handover: ClearanceHandover;
  coveredTransferPartyId: string | null;
  coveredMembershipId: string | null;
  action?: ModuleFormAction;
  request?: typeof fetch;
}) {
  const { t, translateFeedback } = useTenancyPresentation();
  const id = useId();
  const active = useRef<AbortController | null>(null);
  const [files, setFiles] = useState<readonly UploadFile[]>([]);
  const [path, setPath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => () => active.current?.abort(), []);

  async function upload(file: UploadFile) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setFiles([file]);
    setPath(null);
    setUploading(true);
    setMessage('Uploading the private agreement. It is not attached yet.');
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      if (file.file.size < 1 || file.file.size > MAX_FILE_BYTES) {
        throw new Error('Choose a non-empty PDF, JPG or PNG up to 5 MiB.');
      }
      const prepared = await result(
        await request('/api/files/upload-url', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-request-id': crypto.randomUUID(),
          },
          body: JSON.stringify({
            bucket: 'tenancy-files',
            handoverId: handover.id,
            coveredTransferPartyId,
            coveredMembershipId,
            contentType: file.file.type,
            sizeBytes: file.file.size,
          }),
          signal: controller.signal,
        }),
        uploadEnvelope,
      );
      if (prepared.data.path.split('/')[2] !== handover.id) {
        throw new Error('The private upload belongs to another handover.');
      }
      const stored = await request(
        trustedUrl(prepared.data.signedUrl, prepared.data.path, true),
        {
          method: 'PUT',
          headers: {
            'content-type': file.file.type,
            'x-upsert': 'false',
            'cache-control': 'max-age=3600',
          },
          body: file.file,
          signal: controller.signal,
          redirect: 'error',
        },
      );
      if (!stored.ok)
        throw new Error('The private agreement upload failed; retry.');
      if (active.current !== controller) return;
      setPath(prepared.data.path);
      setMessage('Uploaded privately. Attach it to the draft handover.');
    } catch (error) {
      if (active.current !== controller) return;
      setFiles([
        {
          ...file,
          error:
            error instanceof Error
              ? translateFeedback(error.message)
              : t('The private agreement upload failed; retry.'),
        },
      ]);
      setMessage(null);
    } finally {
      window.clearTimeout(timeout);
      if (active.current === controller) {
        active.current = null;
        setUploading(false);
      }
    }
  }

  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Attach signed agreement')}
      submitDisabled={!path || uploading}
      input={() =>
        clearanceFileInputSchema.parse({
          handoverId: handover.id,
          expectedVersion: handover.version,
          coveredTransferPartyId,
          coveredMembershipId,
          path,
        })
      }
    >
      <FileUpload
        id={id}
        acceptedTypes={FILE_CONTENT_TYPES}
        files={files}
        label={t('Signed agreement')}
        maxFileBytes={MAX_FILE_BYTES}
        maxFiles={1}
        onRetry={(file) => void upload(file)}
        onFilesChange={(next) => {
          if (next[0]) void upload(next[0]);
          else {
            active.current?.abort();
            active.current = null;
            setFiles([]);
            setPath(null);
            setUploading(false);
            setMessage('Agreement removed from this form; it is not attached.');
          }
        }}
      />
      {message ? (
        <p className="text-caption text-ink-muted" role="status">
          {t(message)}
        </p>
      ) : null}
    </ModuleActionForm>
  );
}

export function TransferDocumentLink({
  path,
  label,
  request = fetch,
}: {
  path: string;
  label: string;
  request?: typeof fetch;
}) {
  const { t } = useTenancyPresentation();
  const [link, setLink] = useState<{ url: string; expiresIn: number } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!link) return;
    const timeout = window.setTimeout(
      () => setLink(null),
      link.expiresIn * 1000,
    );
    return () => window.clearTimeout(timeout);
  }, [link]);
  return (
    <div className="grid gap-space-2">
      <Button
        loading={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const value = await result(
              await request('/api/files/url', {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'x-request-id': crypto.randomUUID(),
                },
                body: JSON.stringify({ bucket: 'tenancy-files', path }),
                cache: 'no-store',
              }),
              viewEnvelope,
            );
            transferFilePathSchema.parse(path);
            setLink({
              url: trustedUrl(value.data.signedUrl, path),
              expiresIn: value.data.expiresIn,
            });
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : 'Could not open this file.',
            );
          } finally {
            setPending(false);
          }
        }}
        variant="secondary"
      >
        {t('View {label}', { label })}
      </Button>
      {link ? (
        <a
          className="inline-flex min-h-12 items-center text-brand underline"
          href={link.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t('Open {label} (private link, up to five minutes)', { label })}
        </a>
      ) : null}
      {error ? (
        <p className="text-caption text-danger" role="alert">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}
