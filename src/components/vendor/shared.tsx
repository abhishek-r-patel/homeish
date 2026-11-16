// Shared Vendors & Purchases route states, private file upload and audited file links.
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { z } from 'zod';
import type { ServerActionResult } from '@/core/actions/server-action';
import { publicEnvironment } from '@/core/config/public-env';
import { FILE_CONTENT_TYPES, MAX_FILE_BYTES } from '@/core/files/constraints';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import {
  VENDOR_FILE_PATH_PATTERN,
  vendorFileContentTypeSchema,
  vendorFilePathSchema,
} from '@/core/vendor/validation';
import {
  addPurchaseQuoteAction,
  addVendorDocumentAction,
  approvePurchaseRequestAction,
  archiveVendorDocumentAction,
  cancelPurchaseRequestAction,
  overrideQuoteRuleAction,
  prepareVendorDocumentUploadAction,
  prepareVendorQuoteUploadAction,
  rejectPurchaseRequestAction,
  removePurchaseQuoteAction,
  retryPurchaseExpenseDraftAction,
  savePurchaseRequestAction,
  saveVendorAction,
  saveVendorRatingAction,
  saveVendorSettingsAction,
  selectPurchaseQuoteAction,
  setVendorActiveAction,
  submitPurchaseRequestAction,
  vendorFileLinkAction,
} from '@/app/(admin)/admin/vendors/actions';
import { Button } from '@/components/ui/button';
import { ErrorPanel, Skeleton } from '@/components/ui/feedback';
import { FileUpload, type UploadFile } from '@/components/ui/file-upload';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';

type PrepareUpload = (
  form: FormData,
) => Promise<ServerActionResult<{ path: string; signedUrl: string }>>;
type FileLink = (form: FormData) => Promise<
  ServerActionResult<{
    signedUrl: string;
    expiresIn: number;
    fileName: string;
  }>
>;

export type VendorActions = {
  prepareDocumentUpload: PrepareUpload;
  prepareQuoteUpload: PrepareUpload;
  fileLink: FileLink;
  saveSettings: ModuleFormAction;
  saveVendor: ModuleFormAction;
  setActive: ModuleFormAction;
  addDocument: ModuleFormAction;
  archiveDocument: ModuleFormAction;
  saveRating: ModuleFormAction;
  saveRequest: ModuleFormAction;
  addQuote: ModuleFormAction;
  removeQuote: ModuleFormAction;
  selectQuote: ModuleFormAction;
  overrideRule: ModuleFormAction;
  submit: ModuleFormAction;
  approve: ModuleFormAction;
  reject: ModuleFormAction;
  cancel: ModuleFormAction;
  retryExpense: ModuleFormAction;
  /** Lets fixtures replace the private storage upload request. */
  uploadRequest?: typeof fetch;
};

export const VENDOR_ACTIONS: VendorActions = {
  prepareDocumentUpload: prepareVendorDocumentUploadAction,
  prepareQuoteUpload: prepareVendorQuoteUploadAction,
  fileLink: vendorFileLinkAction,
  saveSettings: saveVendorSettingsAction,
  saveVendor: saveVendorAction,
  setActive: setVendorActiveAction,
  addDocument: addVendorDocumentAction,
  archiveDocument: archiveVendorDocumentAction,
  saveRating: saveVendorRatingAction,
  saveRequest: savePurchaseRequestAction,
  addQuote: addPurchaseQuoteAction,
  removeQuote: removePurchaseQuoteAction,
  selectQuote: selectPurchaseQuoteAction,
  overrideRule: overrideQuoteRuleAction,
  submit: submitPurchaseRequestAction,
  approve: approvePurchaseRequestAction,
  reject: rejectPurchaseRequestAction,
  cancel: cancelPurchaseRequestAction,
  retryExpense: retryPurchaseExpenseDraftAction,
};

export const VENDOR_BASE_HREF = '/admin/vendors';

export type VendorRouteStateKind =
  'loading' | 'error' | 'disabled' | 'denied' | 'not_found';

export function VendorRouteState({
  kind,
  title = 'Vendors & Purchases',
  returnHref = '/',
  retryHref,
  referenceId,
  message,
}: {
  kind: VendorRouteStateKind;
  title?: string;
  returnHref?: string;
  retryHref?: string;
  referenceId?: string;
  message?: string;
}) {
  if (kind === 'disabled')
    return (
      <ModuleDisabledPage embedded moduleKey="vendor" returnHref={returnHref} />
    );
  const copy = {
    loading: {
      title: 'Loading vendors and purchases',
      message: 'Loading vendors and purchases.',
    },
    denied: {
      title: 'Vendors & Purchases is for the admin and committee',
      message:
        'You do not have access to this view. Return to your workspace or ask an administrator to review your access.',
    },
    not_found: {
      title: 'Not found',
      message:
        'This vendor or purchase request does not exist in your society.',
    },
    error: {
      title: 'Could not load vendors and purchases',
      message: 'Nothing has changed. Retry in a moment.',
    },
  }[kind];
  return (
    <section className="grid min-w-0 gap-space-4">
      <h1 className="text-title font-semibold">{title}</h1>
      {kind === 'loading' ? (
        <Skeleton label={copy.title} rows={5} />
      ) : (
        <ErrorPanel
          title={copy.title}
          message={message ?? copy.message}
          referenceId={referenceId}
          action={
            <div className="flex flex-wrap gap-space-3">
              {retryHref ? (
                <a
                  href={retryHref}
                  className="inline-flex min-h-12 items-center text-brand underline"
                >
                  Retry
                </a>
              ) : null}
              <a
                href={returnHref}
                className="inline-flex min-h-12 items-center text-brand underline"
              >
                Back
              </a>
            </div>
          }
        />
      )}
    </section>
  );
}

/** Keep a small one-button action, such as select or approve, consistent everywhere. */
export function VendorQuickAction({
  action,
  input,
  label,
  confirmMessage,
}: {
  action: ModuleFormAction;
  input: unknown;
  label: string;
  confirmMessage?: string;
}) {
  return (
    <ModuleActionForm
      action={action}
      input={() => input}
      submitLabel={label}
      confirmMessage={confirmMessage}
    >
      {null}
    </ModuleActionForm>
  );
}

const uploadResult = z.object({
  path: vendorFilePathSchema,
  signedUrl: z.url(),
});
const linkResult = z.object({
  signedUrl: z.url(),
  expiresIn: z.number().int().min(1).max(300),
  fileName: z.string().min(1),
});

/** Accept only Supabase storage links for a valid private vendor file path. */
export function vendorStorageUrl(value: string, path?: string): string {
  const url = new URL(value);
  const configured = new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL);
  const prefix = `${configured.pathname.replace(/\/$/, '')}/storage/v1/object/${
    path !== undefined ? 'upload/sign' : 'sign'
  }/vendor-files/`;
  const objectPath = decodeURIComponent(url.pathname);
  const remainder = objectPath.startsWith(prefix)
    ? objectPath.slice(prefix.length)
    : null;
  if (
    url.origin !== configured.origin ||
    remainder === null ||
    !VENDOR_FILE_PATH_PATTERN.test(remainder) ||
    (path !== undefined && remainder !== path)
  ) {
    throw new Error(
      'The private file link is invalid. Nothing was sent; refresh and retry.',
    );
  }
  return url.href;
}

export function vendorActionInput(value: unknown) {
  const form = new FormData();
  form.set('input', JSON.stringify(value));
  return form;
}

function failureText(result: Extract<ServerActionResult, { ok: false }>) {
  return `${result.message}${result.referenceId ? ` Reference: ${result.referenceId}` : ''}`;
}

export function VendorFilePicker({
  label,
  prepareUpload,
  request = fetch,
  onChange,
}: {
  label: string;
  prepareUpload: PrepareUpload;
  request?: typeof fetch;
  onChange: (path: string | null) => void;
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
    setMessage('Uploading privately.');
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const file = selected.file;
      const contentType = vendorFileContentTypeSchema.safeParse(file.type);
      if (!contentType.success || file.size < 1 || file.size > MAX_FILE_BYTES) {
        throw new Error('Choose a non-empty PDF, JPG or PNG up to 5 MB.');
      }
      const prepared = await prepareUpload(
        vendorActionInput({
          contentType: contentType.data,
          sizeBytes: file.size,
        }),
      );
      if (!prepared.ok) throw new Error(failureText(prepared));
      const target = uploadResult.safeParse(prepared.data);
      if (!target.success) {
        throw new Error('The upload could not be prepared. Retry.');
      }
      if (current.current !== controller || controller.signal.aborted) return;
      const stored = await request(
        vendorStorageUrl(target.data.signedUrl, target.data.path),
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
        throw new Error('The file could not be uploaded. Retry.');
      }
      if (current.current !== controller) return;
      onChange(target.data.path);
      setMessage('Uploaded privately. Save below to attach it.');
    } catch (error) {
      if (current.current !== controller) return;
      setFiles([
        {
          ...selected,
          error: controller.signal.aborted
            ? 'The upload timed out. Retry.'
            : error instanceof Error
              ? error.message
              : 'The upload failed. Retry.',
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
            setMessage('File removed.');
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

export function VendorFileLink({
  path,
  label,
  fileLink,
}: {
  path: string;
  label: string;
  fileLink: FileLink;
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
      const result = await fileLink(vendorActionInput({ path }));
      if (!result.ok) throw new Error(failureText(result));
      const data = linkResult.parse(result.data);
      setLink({
        url: vendorStorageUrl(data.signedUrl),
        expiresIn: data.expiresIn,
      });
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Could not open this file. Retry.',
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
