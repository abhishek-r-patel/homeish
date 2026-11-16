// Shared Utility Metering route states, actions, private photo upload, signed photo links and reading form.
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { z } from 'zod';
import { publicEnvironment } from '@/core/config/public-env';
import { MAX_FILE_BYTES } from '@/core/files/constraints';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import {
  METERING_PHOTO_CONTENT_TYPES,
  METERING_REASON_MAX,
  meteringPhotoPathSchema,
  meteringReadingInputSchema,
  normaliseMeterValue,
  type MeteringMeter,
} from '@/core/metering/validation';
import {
  METERING_TYPE_LABELS,
  METERING_UNIT_LABELS,
  formatMeterValue,
  formatMeteringDate,
  meteringConsumption,
} from '@/core/metering/presentation';
import {
  recordMeteringReadingAction,
  reviewMeteringReadingAction,
  runMeteringBillingAction,
  saveMeteringMeterAction,
  setMeteringRateAction,
  submitMeteringReadingAction,
} from '@/app/(resident)/metering/actions';
import { Button } from '@/components/ui/button';
import { ErrorPanel, Skeleton } from '@/components/ui/feedback';
import { FileUpload, type UploadFile } from '@/components/ui/file-upload';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';

export type MeteringActions = {
  saveMeter: ModuleFormAction;
  setRate: ModuleFormAction;
  record: ModuleFormAction;
  submit: ModuleFormAction;
  review: ModuleFormAction;
  runBilling: ModuleFormAction;
};

export const METERING_ACTIONS: MeteringActions = {
  saveMeter: saveMeteringMeterAction,
  setRate: setMeteringRateAction,
  record: recordMeteringReadingAction,
  submit: submitMeteringReadingAction,
  review: reviewMeteringReadingAction,
  runBilling: runMeteringBillingAction,
};

export type MeteringRouteStateKind =
  'loading' | 'error' | 'disabled' | 'denied';

export function MeteringRouteState({
  kind,
  title = 'Meters',
  returnHref = '/',
  retryHref,
  referenceId,
  message,
}: {
  kind: MeteringRouteStateKind;
  title?: string;
  returnHref?: string;
  retryHref?: string;
  referenceId?: string;
  message?: string;
}) {
  if (kind === 'disabled')
    return (
      <ModuleDisabledPage
        embedded
        moduleKey="metering"
        returnHref={returnHref}
      />
    );
  const copy = {
    loading: { title: 'Loading meters', message: 'Loading meters.' },
    denied: {
      title: 'Metering access is restricted',
      message:
        'You do not have access to this view. Return to your workspace or ask an administrator to review your access.',
    },
    error: {
      title: 'Could not load meters',
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
                Back to your workspace
              </a>
            </div>
          }
        />
      )}
    </section>
  );
}

const uploadEnvelope = z.object({
  ok: z.literal(true),
  data: z.object({ path: meteringPhotoPathSchema, signedUrl: z.url() }),
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
    throw new Error('The photo service returned an invalid response. Retry.');
  }
  const failure = failureEnvelope.safeParse(value);
  if (failure.success) {
    throw new Error(
      `${failure.data.error.message}${failure.data.error.referenceId ? ` Reference: ${failure.data.error.referenceId}` : ''}`,
    );
  }
  const success = schema.safeParse(value);
  if (!response.ok || !success.success) {
    throw new Error('The photo request was not completed. Retry.');
  }
  return success.data;
}

function storageUrl(value: string, path: string, upload = false) {
  const url = new URL(value);
  const configured = new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL);
  const expectedPath = `${configured.pathname.replace(/\/$/, '')}/storage/v1/object/${upload ? 'upload/sign' : 'sign'}/metering-photos/${path}`;
  if (
    url.origin !== configured.origin ||
    decodeURIComponent(url.pathname) !== expectedPath
  ) {
    throw new Error('The private photo link is invalid. Refresh and retry.');
  }
  return url.href;
}

/** Upload one meter photo privately; the reading form attaches the returned path when saved. */
function MeteringPhotoField({
  id,
  required,
  request,
  resetKey,
  onChange,
}: {
  id: string;
  required: boolean;
  request: typeof fetch;
  resetKey: number;
  onChange: (path: string | null, uploading: boolean) => void;
}) {
  const currentUpload = useRef<AbortController | null>(null);
  const [files, setFiles] = useState<readonly UploadFile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setFiles([]);
    setMessage(null);
  }
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
    onChange(null, true);
    setMessage('Uploading the photo privately.');
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const file = selected.file;
      if (file.size < 1 || file.size > MAX_FILE_BYTES) {
        throw new Error('Choose a JPG or PNG photo up to 5 MiB.');
      }
      const response = await request('/api/files/upload-url', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': crypto.randomUUID(),
        },
        body: JSON.stringify({
          bucket: 'metering-photos',
          contentType: file.type,
          sizeBytes: file.size,
        }),
        signal: controller.signal,
      });
      const result = await fileResult(response, uploadEnvelope);
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
        throw new Error('The photo could not be uploaded. Retry or remove it.');
      if (currentUpload.current !== controller) return;
      onChange(result.data.path, false);
      setMessage('Photo uploaded privately. Save the reading to attach it.');
    } catch (error) {
      if (currentUpload.current !== controller) return;
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
      onChange(null, false);
    } finally {
      window.clearTimeout(timeout);
      if (currentUpload.current === controller) currentUpload.current = null;
    }
  }

  return (
    <>
      <FileUpload
        id={id}
        label={
          required ? 'Photo of the meter' : 'Photo of the meter (optional)'
        }
        acceptedTypes={METERING_PHOTO_CONTENT_TYPES}
        maxFileBytes={MAX_FILE_BYTES}
        maxFiles={1}
        capturePhoto
        files={files}
        helpText="JPG or PNG up to 5 MiB showing the meter display. Only the reading's unit and the administrators can see it. It is kept with the reading."
        onRetry={(file) => void upload(file)}
        onFilesChange={(next) => {
          if (next.length > 0) void upload(next[0]!);
          else {
            currentUpload.current?.abort();
            currentUpload.current = null;
            setFiles([]);
            onChange(null, false);
            setMessage(
              required
                ? 'Photo removed. Add a photo to send the reading.'
                : 'Photo removed.',
            );
          }
        }}
      />
      {message ? (
        <p role="status" className="text-caption text-ink-muted">
          {message}
        </p>
      ) : null}
    </>
  );
}

export function meteringMeterName(meter: {
  label: string;
  meter_type: MeteringMeter['meter_type'];
  unit_number?: string | null;
}) {
  return `${meter.label} · ${METERING_TYPE_LABELS[meter.meter_type]}${meter.unit_number ? ` · Unit ${meter.unit_number}` : ' · Common area'}`;
}

/**
 * Record (staff) or submit (resident) a reading. Shows the baseline and the usage the value adds,
 * and asks for a reason when the new value is lower than the last approved reading.
 */
export function MeteringReadingForm({
  meters,
  today,
  action,
  mode,
  request = fetch,
  fixedMeterId,
}: {
  meters: readonly MeteringMeter[];
  today: string;
  action: ModuleFormAction;
  mode: 'record' | 'submit';
  request?: typeof fetch;
  fixedMeterId?: string;
}) {
  const id = useId();
  const [meterId, setMeterId] = useState(
    fixedMeterId ??
      meters.find((item) => mode === 'record' || !item.has_pending)?.id ??
      meters[0]?.id ??
      '',
  );
  const [value, setValue] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const meter = meters.find((item) => item.id === meterId) ?? null;
  if (!meter) {
    return (
      <p className="text-body text-ink-muted">No meter is available here.</p>
    );
  }
  const clean = normaliseMeterValue(value);
  const preview =
    clean !== null ? meteringConsumption(meter.base_value, clean) : null;
  const requirePhoto = mode === 'submit';
  const blocked = mode === 'submit' && meter.has_pending;
  const unitLabel = METERING_UNIT_LABELS[meter.meter_type];

  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={
        mode === 'submit' ? 'Send reading for approval' : 'Save reading'
      }
      submitDisabled={
        blocked || uploading || (requirePhoto && photoPath === null)
      }
      onSaved={() => {
        setValue('');
        setPhotoPath(null);
        setUploading(false);
        setResetKey((key) => key + 1);
      }}
      input={(form, clientRequestId) =>
        meteringReadingInputSchema.parse({
          meterId,
          readingValue: String(form.get('readingValue') ?? ''),
          readingDate: String(form.get('readingDate') ?? ''),
          lowerReason: String(form.get('lowerReason') ?? ''),
          photoPath,
          clientRequestId,
        })
      }
    >
      {fixedMeterId ? null : (
        <SelectInput
          id={`${id}-meter`}
          name="meterId"
          label="Meter"
          required
          value={meterId}
          onChange={(event) => setMeterId(event.currentTarget.value)}
          options={meters.map((item) => ({
            value: item.id,
            label: meteringMeterName(item),
          }))}
        />
      )}
      <p className="text-caption text-ink-muted">
        {meter.last_reading_date
          ? `Last approved reading ${formatMeterValue(meter.base_value)} ${unitLabel} on ${formatMeteringDate(meter.last_reading_date)}.`
          : `No reading yet. Starting reading ${formatMeterValue(meter.base_value)} ${unitLabel}.`}
        {meter.has_pending ? ' A reading is waiting for review.' : ''}
      </p>
      {blocked ? (
        <p role="status" className="text-caption">
          Wait for the administrator to review the reading you sent before
          sending another one for this meter.
        </p>
      ) : null}
      <TextInput
        id={`${id}-value`}
        name="readingValue"
        label={`Reading (${unitLabel})`}
        helpText="Up to 3 decimals, as shown on the meter."
        inputMode="decimal"
        autoComplete="off"
        required
        maxLength={20}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
      {preview ? (
        <p role="status" className="text-caption">
          {preview.isReset
            ? 'This is lower than the last reading. Say why below, for example the meter was replaced or rolled over. It counts as 0 usage and becomes the new starting point.'
            : `Usage since the last reading: ${formatMeterValue(preview.consumption)} ${unitLabel}.`}
        </p>
      ) : null}
      <TextInput
        id={`${id}-date`}
        name="readingDate"
        type="date"
        label="Reading date"
        required
        max={today}
        defaultValue={today}
      />
      <TextAreaInput
        id={`${id}-reason`}
        name="lowerReason"
        label={
          preview?.isReset
            ? 'Why is the reading lower?'
            : 'Why is the reading lower? (only if it is)'
        }
        required={preview?.isReset ?? false}
        maxLength={METERING_REASON_MAX}
      />
      <MeteringPhotoField
        id={`${id}-photo`}
        required={requirePhoto}
        request={request}
        resetKey={resetKey}
        onChange={(path, busy) => {
          setPhotoPath(path);
          setUploading(busy);
        }}
      />
    </ModuleActionForm>
  );
}

export function MeteringPhotoLink({
  path,
  request = fetch,
}: {
  path: string;
  request?: typeof fetch;
}) {
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<{ url: string; expiresIn: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!link) return;
    const timer = window.setTimeout(() => setLink(null), link.expiresIn * 1000);
    return () => window.clearTimeout(timer);
  }, [link]);

  async function prepare() {
    setPending(true);
    setError(null);
    setLink(null);
    try {
      const result = await fileResult(
        await request('/api/files/url', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-request-id': crypto.randomUUID(),
          },
          body: JSON.stringify({ bucket: 'metering-photos', path }),
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
        cause instanceof Error
          ? cause.message
          : 'Could not open this photo. Retry.',
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
        {link ? 'Refresh photo link' : 'View meter photo'}
      </Button>
      {link ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          Open photo (private link, up to five minutes)
        </a>
      ) : null}
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
