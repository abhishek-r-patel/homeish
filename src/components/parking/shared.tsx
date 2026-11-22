// Shared Parking route states, private photo upload and signed photo links.
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { z } from 'zod';
import { useUiTranslator } from '@/components/ui/language';
import { publicEnvironment } from '@/core/config/public-env';
import { MAX_FILE_BYTES } from '@/core/files/constraints';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import {
  PARKING_PHOTO_CONTENT_TYPES,
  parkingPhotoPathSchema,
  parkingReportInputSchema,
  type ParkingSlotType,
} from '@/core/parking/validation';
import { PARKING_SLOT_TYPE_LABELS } from '@/core/parking/presentation';
import {
  allocateParkingSlotAction,
  archiveParkingSlotAction,
  cancelParkingPassAction,
  cancelParkingRequestAction,
  createParkingPassAction,
  createParkingReportAction,
  createParkingRequestAction,
  endParkingAllocationAction,
  resolveParkingReportAction,
  saveParkingSettingsAction,
  saveParkingSlotAction,
  setParkingConditionAction,
  setParkingVehicleLinkAction,
} from '@/app/(resident)/parking/actions';
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
import { createComponentTranslator } from '@/core/i18n/catalogs/hi-components';
import {
  formatLocalizedDateTime,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import { PARKING_TIME_ZONE } from '@/core/parking/presentation';

export function useParkingCopy() {
  const {
    locale: activeLocale,
    translate,
    translateFeedback,
  } = useUiTranslator();
  const locale = activeLocale ?? 'en';
  return {
    locale,
    t: createComponentTranslator(locale, translate),
    translateFeedback,
  };
}

export function parkingDisplayTime(value: string, locale: 'en' | 'hi') {
  return formatLocalizedDateTime(new Date(value), locale, {
    timeZone: PARKING_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export type ParkingActions = {
  saveSettings: ModuleFormAction;
  saveSlot: ModuleFormAction;
  archiveSlot: ModuleFormAction;
  setCondition: ModuleFormAction;
  allocate: ModuleFormAction;
  endAllocation: ModuleFormAction;
  resolveReport: ModuleFormAction;
  createRequest: ModuleFormAction;
  cancelRequest: ModuleFormAction;
  setVehicleLink: ModuleFormAction;
  createPass: ModuleFormAction;
  cancelPass: ModuleFormAction;
  createReport: ModuleFormAction;
};

export const PARKING_ACTIONS: ParkingActions = {
  saveSettings: saveParkingSettingsAction,
  saveSlot: saveParkingSlotAction,
  archiveSlot: archiveParkingSlotAction,
  setCondition: setParkingConditionAction,
  allocate: allocateParkingSlotAction,
  endAllocation: endParkingAllocationAction,
  resolveReport: resolveParkingReportAction,
  createRequest: createParkingRequestAction,
  cancelRequest: cancelParkingRequestAction,
  setVehicleLink: setParkingVehicleLinkAction,
  createPass: createParkingPassAction,
  cancelPass: cancelParkingPassAction,
  createReport: createParkingReportAction,
};

export type ParkingRouteStateKind = 'loading' | 'error' | 'disabled' | 'denied';

export function ParkingRouteState({
  kind,
  title = 'Parking',
  returnHref = '/',
  retryHref,
  referenceId,
  message,
}: {
  kind: ParkingRouteStateKind;
  title?: string;
  returnHref?: string;
  retryHref?: string;
  referenceId?: string;
  message?: string;
}) {
  const { t, translateFeedback } = useParkingCopy();
  if (kind === 'disabled')
    return (
      <ModuleDisabledPage
        embedded
        moduleKey="parking"
        returnHref={returnHref}
      />
    );
  const copy = {
    loading: { title: 'Loading parking', message: 'Loading parking.' },
    denied: {
      title: 'Parking access is restricted',
      message:
        'You do not have access to this view. Return to your workspace or ask an administrator to review your access.',
    },
    error: {
      title: 'Could not load parking',
      message: 'Nothing has changed. Retry in a moment.',
    },
  }[kind];
  return (
    <section className="grid min-w-0 gap-space-4">
      <h1 className="text-title font-semibold">{t(title)}</h1>
      {kind === 'loading' ? (
        <Skeleton label={t(copy.title)} rows={5} />
      ) : (
        <ErrorPanel
          title={t(copy.title)}
          message={translateFeedback(message ?? copy.message)}
          referenceId={referenceId}
          action={
            <div className="flex flex-wrap gap-space-3">
              {retryHref ? (
                <a
                  href={retryHref}
                  className="inline-flex min-h-12 items-center text-brand underline"
                >
                  {t('Retry')}
                </a>
              ) : null}
              <a
                href={returnHref}
                className="inline-flex min-h-12 items-center text-brand underline"
              >
                {t('Back to your workspace')}
              </a>
            </div>
          }
        />
      )}
    </section>
  );
}

/** Keep a small one-button action, such as cancel or end, consistent everywhere. */
export function ParkingQuickAction({
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

const uploadEnvelope = z.object({
  ok: z.literal(true),
  data: z.object({ path: parkingPhotoPathSchema, signedUrl: z.url() }),
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
  const expectedPath = `${configured.pathname.replace(/\/$/, '')}/storage/v1/object/${upload ? 'upload/sign' : 'sign'}/parking-photos/${path}`;
  if (
    url.origin !== configured.origin ||
    decodeURIComponent(url.pathname) !== expectedPath
  ) {
    throw new Error('The private photo link is invalid. Refresh and retry.');
  }
  return url.href;
}

export function ParkingReportForm({
  slots,
  action,
  request = fetch,
  retentionDays,
}: {
  slots: readonly { id: string; label: string; slot_type: ParkingSlotType }[];
  action: ModuleFormAction;
  request?: typeof fetch;
  retentionDays?: number;
}) {
  const { locale, t, translateFeedback } = useParkingCopy();
  const id = useId();
  const currentUpload = useRef<AbortController | null>(null);
  const [files, setFiles] = useState<readonly UploadFile[]>([]);
  const [path, setPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
          bucket: 'parking-photos',
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
      setPath(result.data.path);
      setMessage('Photo uploaded privately. Send the report to attach it.');
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
    } finally {
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
      idempotent
      submitLabel={t('Send report')}
      submitDisabled={uploading}
      onSaved={() => {
        setFiles([]);
        setPath(null);
        setMessage(null);
      }}
      input={(form, clientRequestId) =>
        parkingReportInputSchema.parse({
          slotId: String(form.get('slotId') ?? '') || null,
          vehicleNumber: String(form.get('vehicleNumber') ?? ''),
          note: String(form.get('note') ?? ''),
          photoPath: path,
          clientRequestId,
        })
      }
    >
      <SelectInput
        id={`${id}-slot`}
        name="slotId"
        label={t('Slot')}
        defaultValue=""
        options={[
          {
            value: '',
            label: t('No slot, I will enter the vehicle number'),
          },
          ...slots.map((slot) => ({
            value: slot.id,
            label: `${slot.label} (${t(PARKING_SLOT_TYPE_LABELS[slot.slot_type])})`,
          })),
        ]}
      />
      <TextInput
        id={`${id}-vehicle`}
        name="vehicleNumber"
        label={t('Vehicle number')}
        helpText={t(
          'Choose a slot, enter the vehicle number, or both. For example MH01AB1234.',
        )}
        autoComplete="off"
        maxLength={40}
      />
      <TextAreaInput
        id={`${id}-note`}
        name="note"
        label={t('What is wrong? (optional)')}
        maxLength={500}
      />
      <FileUpload
        id={`${id}-photo`}
        label={t('Photo (optional)')}
        acceptedTypes={PARKING_PHOTO_CONTENT_TYPES}
        maxFileBytes={MAX_FILE_BYTES}
        maxFiles={1}
        capturePhoto
        files={files.map((file) =>
          file.error ? { ...file, error: translateFeedback(file.error) } : file,
        )}
        helpText={t(
          'JPG or PNG up to 5 MiB. Only the unit, administrators and you can see it, and it is deleted after {days}.',
          {
            days: retentionDays
              ? t('{count} days', {
                  count: formatLocalizedNumber(retentionDays, locale),
                })
              : t('a few days'),
          },
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
            setMessage('Photo removed. The report will be sent without it.');
          }
        }}
      />
      <input
        type="hidden"
        name="uploadPending"
        value={uploading ? 'true' : 'false'}
      />
      {message ? (
        <p role="status" className="text-caption text-ink-muted">
          {translateFeedback(message)}
        </p>
      ) : null}
    </ModuleActionForm>
  );
}

export function ParkingPhotoLink({
  path,
  request = fetch,
}: {
  path: string;
  request?: typeof fetch;
}) {
  const { t, translateFeedback } = useParkingCopy();
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
          body: JSON.stringify({ bucket: 'parking-photos', path }),
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
        {link ? t('Refresh photo link') : t('View photo')}
      </Button>
      {link ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {t('Open photo (private link, up to five minutes)')}
        </a>
      ) : null}
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {translateFeedback(error)}
        </p>
      ) : null}
    </div>
  );
}
