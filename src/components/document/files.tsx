// Upload admin documents privately and open audited, short-lived document links.
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { z } from 'zod';
import type { ServerActionResult } from '@/core/actions/server-action';
import { publicEnvironment } from '@/core/config/public-env';
import { FILE_CONTENT_TYPES, MAX_FILE_BYTES } from '@/core/files/constraints';
import {
  DOCUMENT_PATH_PATTERN,
  documentContentTypeSchema,
  documentPathSchema,
} from '@/core/document/validation';
import { documentFileNameFromUpload } from '@/core/document/presentation';
import { Button } from '@/components/ui/button';
import { FileUpload, type UploadFile } from '@/components/ui/file-upload';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import {
  addDocumentVersionAction,
  createDocumentAction,
  prepareDocumentUploadAction,
  saveDocumentFolderAction,
  setDocumentArchivedAction,
  setDocumentFolderArchivedAction,
  setDocumentVersionArchivedAction,
  updateDocumentAction,
} from '@/app/(admin)/admin/documents/actions';
import { documentDownloadAction } from '@/app/(resident)/documents/actions';

export type DocumentActions = {
  download: (form: FormData) => Promise<
    ServerActionResult<{
      signedUrl: string;
      expiresIn: number;
      fileName: string;
    }>
  >;
  prepareUpload: (
    form: FormData,
  ) => Promise<ServerActionResult<{ path: string; signedUrl: string }>>;
  saveFolder: ModuleFormAction;
  setFolderArchived: ModuleFormAction;
  create: ModuleFormAction;
  addVersion: ModuleFormAction;
  update: ModuleFormAction;
  setArchived: ModuleFormAction;
  setVersionArchived: ModuleFormAction;
};

export const DEFAULT_DOCUMENT_ACTIONS: DocumentActions = {
  download: documentDownloadAction,
  prepareUpload: prepareDocumentUploadAction,
  saveFolder: saveDocumentFolderAction,
  setFolderArchived: setDocumentFolderArchivedAction,
  create: createDocumentAction,
  addVersion: addDocumentVersionAction,
  update: updateDocumentAction,
  setArchived: setDocumentArchivedAction,
  setVersionArchived: setDocumentVersionArchivedAction,
};

const uploadResult = z.object({
  path: documentPathSchema,
  signedUrl: z.url(),
});
const downloadResult = z.object({
  signedUrl: z.url(),
  expiresIn: z.number().int().min(1).max(300),
  fileName: z.string().min(1),
});

function storagePrefix(upload: boolean) {
  const configured = new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL);
  return {
    origin: configured.origin,
    prefix: `${configured.pathname.replace(/\/$/, '')}/storage/v1/object/${upload ? 'upload/sign' : 'sign'}/document-files/`,
  };
}

export function documentStorageUrl(value: string, path?: string): string {
  const url = new URL(value);
  const { origin, prefix } = storagePrefix(path !== undefined);
  const objectPath = decodeURIComponent(url.pathname);
  const remainder = objectPath.startsWith(prefix)
    ? objectPath.slice(prefix.length)
    : null;
  if (
    url.origin !== origin ||
    remainder === null ||
    !DOCUMENT_PATH_PATTERN.test(remainder) ||
    (path !== undefined && remainder !== path)
  ) {
    throw new Error(
      'The private file link is invalid. Nothing was sent; refresh and retry.',
    );
  }
  return url.href;
}

function actionInput(value: unknown) {
  const form = new FormData();
  form.set('input', JSON.stringify(value));
  return form;
}

function failureText(result: Extract<ServerActionResult, { ok: false }>) {
  return `${result.message}${result.referenceId ? ` Reference: ${result.referenceId}` : ''}`;
}

export type UploadedDocumentFile = { path: string; fileName: string };

export function DocumentFilePicker({
  label,
  prepareUpload,
  request = fetch,
  onChange,
}: {
  label: string;
  prepareUpload: DocumentActions['prepareUpload'];
  request?: typeof fetch;
  onChange: (file: UploadedDocumentFile | null) => void;
}) {
  const id = useId();
  const current = useRef<AbortController | null>(null);
  const [files, setFiles] = useState<readonly UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(
    () => () => {
      const active = current.current;
      current.current = null;
      active?.abort();
    },
    [],
  );

  async function upload(selected: UploadFile) {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setFiles([{ file: selected.file, id: selected.id }]);
    setUploading(true);
    onChange(null);
    setMessage('Uploading privately. Nothing is published yet.');
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const file = selected.file;
      const contentType = documentContentTypeSchema.safeParse(file.type);
      if (!contentType.success || file.size < 1 || file.size > MAX_FILE_BYTES) {
        throw new Error('Choose a non-empty PDF, JPG or PNG up to 5 MB.');
      }
      const prepared = await prepareUpload(
        actionInput({ contentType: contentType.data, sizeBytes: file.size }),
      );
      if (!prepared.ok) throw new Error(failureText(prepared));
      const target = uploadResult.safeParse(prepared.data);
      if (!target.success) {
        throw new Error('The upload could not be prepared. Retry.');
      }
      if (current.current !== controller || controller.signal.aborted) return;
      const stored = await request(
        documentStorageUrl(target.data.signedUrl, target.data.path),
        {
          method: 'PUT',
          headers: {
            'content-type': contentType.data,
            'x-upsert': 'false',
            'cache-control': 'max-age=3600',
          },
          body: file,
          signal: controller.signal,
          redirect: 'error',
        },
      );
      if (!stored.ok) {
        throw new Error(
          'The file could not be uploaded. Nothing was published; retry.',
        );
      }
      if (current.current !== controller) return;
      onChange({
        path: target.data.path,
        fileName: documentFileNameFromUpload(file.name),
      });
      setMessage('Uploaded privately. Publish below to share it.');
    } catch (error) {
      if (current.current !== controller) return;
      setFiles([
        {
          ...selected,
          error: controller.signal.aborted
            ? 'The upload timed out. Nothing was published; retry.'
            : error instanceof Error
              ? error.message
              : 'The upload failed. Nothing was published; retry.',
        },
      ]);
      setMessage(null);
    } finally {
      window.clearTimeout(timeout);
      if (current.current === controller) {
        current.current = null;
        setUploading(false);
      }
    }
  }

  return (
    <div className="grid gap-space-2">
      <input type="hidden" name="uploadPending" value={String(uploading)} />
      <FileUpload
        id={id}
        label={label}
        acceptedTypes={FILE_CONTENT_TYPES}
        maxFileBytes={MAX_FILE_BYTES}
        maxFiles={1}
        files={files}
        helpText="PDF, JPG or PNG, up to 5 MB. Stored privately."
        onRetry={(file) => void upload(file)}
        onFilesChange={(next) => {
          if (next.length > 0) void upload(next[0]!);
          else {
            current.current?.abort();
            current.current = null;
            setFiles([]);
            setUploading(false);
            onChange(null);
            setMessage('File removed. Nothing was published.');
          }
        }}
      />
      {message ? (
        <p role="status" className="text-caption text-ink-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function DocumentDownloadButton({
  versionId,
  label,
  download,
}: {
  versionId: string;
  label: string;
  download: DocumentActions['download'];
}) {
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
      setMessage('The private link expired. Request a new one to open it.');
    }, link.expiresIn * 1000);
    return () => window.clearTimeout(timer);
  }, [link]);

  async function prepare() {
    setPending(true);
    setError(null);
    setLink(null);
    setMessage(null);
    try {
      const result = await download(actionInput({ versionId }));
      if (!result.ok) throw new Error(failureText(result));
      const data = downloadResult.parse(result.data);
      setLink({
        url: documentStorageUrl(data.signedUrl),
        expiresIn: data.expiresIn,
      });
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Could not open this document. Retry.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-space-2">
      <Button
        variant="secondary"
        loading={pending}
        onClick={() => void prepare()}
      >
        {link ? `Refresh link: ${label}` : `Get ${label}`}
      </Button>
      {link ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          Download {label} (private link, valid for five minutes)
        </a>
      ) : null}
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-caption text-ink-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}
