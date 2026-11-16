// Shared Guard Patrol route states, actions, private incident photo upload and signed photo links.
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { z } from 'zod';
import { publicEnvironment } from '@/core/config/public-env';
import { ValidationError } from '@/core/errors';
import { MAX_FILE_BYTES } from '@/core/files/constraints';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import {
  PATROL_CATEGORY_LABELS,
  PATROL_SEVERITY_LABELS,
} from '@/core/patrol/presentation';
import {
  PATROL_INCIDENT_CATEGORIES,
  PATROL_MAX_PHOTOS,
  PATROL_PHOTO_CONTENT_TYPES,
  PATROL_SEVERITIES,
  patrolIncidentInputSchema,
  patrolPhotoPathSchema,
  type PatrolSeverity,
} from '@/core/patrol/validation';
import {
  acknowledgePatrolHandoverAction,
  createPatrolHandoverAction,
  createPatrolIncidentAction,
  recordPatrolScanAction,
} from '@/app/(guard)/guard/patrol/actions';
import {
  addPatrolIncidentNoteAction,
  closePatrolIncidentAction,
  savePatrolCheckpointAction,
  savePatrolScheduleAction,
  savePatrolSettingsAction,
  setPatrolCheckpointActiveAction,
  setPatrolScheduleActiveAction,
} from '@/app/(admin)/admin/patrol/actions';
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

export type PatrolActions = {
  saveSettings: ModuleFormAction;
  saveCheckpoint: ModuleFormAction;
  setCheckpointActive: ModuleFormAction;
  saveSchedule: ModuleFormAction;
  setScheduleActive: ModuleFormAction;
  addIncidentNote: ModuleFormAction;
  closeIncident: ModuleFormAction;
  scan: ModuleFormAction;
  createIncident: ModuleFormAction;
  createHandover: ModuleFormAction;
  acknowledgeHandover: ModuleFormAction;
};

export const PATROL_ACTIONS: PatrolActions = {
  saveSettings: savePatrolSettingsAction,
  saveCheckpoint: savePatrolCheckpointAction,
  setCheckpointActive: setPatrolCheckpointActiveAction,
  saveSchedule: savePatrolScheduleAction,
  setScheduleActive: setPatrolScheduleActiveAction,
  addIncidentNote: addPatrolIncidentNoteAction,
  closeIncident: closePatrolIncidentAction,
  scan: recordPatrolScanAction,
  createIncident: createPatrolIncidentAction,
  createHandover: createPatrolHandoverAction,
  acknowledgeHandover: acknowledgePatrolHandoverAction,
};

export type PatrolRouteStateKind = 'loading' | 'error' | 'disabled' | 'denied';

export function PatrolRouteState({
  kind,
  title = 'Patrol',
  returnHref = '/',
  retryHref,
  referenceId,
  message,
}: {
  kind: PatrolRouteStateKind;
  title?: string;
  returnHref?: string;
  retryHref?: string;
  referenceId?: string;
  message?: string;
}) {
  if (kind === 'disabled')
    return (
      <ModuleDisabledPage embedded moduleKey="patrol" returnHref={returnHref} />
    );
  const copy = {
    loading: { title: 'Loading patrol', message: 'Loading patrol.' },
    denied: {
      title: 'Patrol access is restricted',
      message:
        'You do not have access to this view. Return to your workspace or ask an administrator to review your access.',
    },
    error: {
      title: 'Could not load patrol',
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

/** A one-button action such as activate, deactivate or acknowledge. */
export function PatrolQuickAction({
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

const SEVERITY_CLASSES: Record<PatrolSeverity, string> = {
  low: 'bg-neutral-tint text-neutral',
  medium: 'bg-info-tint text-info',
  high: 'bg-warning-tint text-warning',
  critical: 'bg-danger-tint text-danger',
};

export function PatrolSeverityChip({ severity }: { severity: PatrolSeverity }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-sm px-space-2 text-micro ${SEVERITY_CLASSES[severity]}`}
    >
      {PATROL_SEVERITY_LABELS[severity]} severity
    </span>
  );
}

const uploadEnvelope = z.object({
  ok: z.literal(true),
  data: z.object({ path: patrolPhotoPathSchema, signedUrl: z.url() }),
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
  const expectedPath = `${configured.pathname.replace(/\/$/, '')}/storage/v1/object/${upload ? 'upload/sign' : 'sign'}/patrol-photos/${path}`;
  if (
    url.origin !== configured.origin ||
    decodeURIComponent(url.pathname) !== expectedPath
  ) {
    throw new Error('The private photo link is invalid. Refresh and retry.');
  }
  return url.href;
}

type PhotoEntry = UploadFile & { path: string | null; uploading: boolean };

export function PatrolIncidentForm({
  action,
  request = fetch,
  retentionDays,
}: {
  action: ModuleFormAction;
  request?: typeof fetch;
  retentionDays?: number;
}) {
  const id = useId();
  const controllers = useRef(new Map<string, AbortController>());
  const [photos, setPhotos] = useState<readonly PhotoEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const active = controllers.current;
    return () => {
      for (const controller of active.values()) controller.abort();
      active.clear();
    };
  }, []);

  function update(fileId: string, change: Partial<PhotoEntry>) {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === fileId ? { ...photo, ...change } : photo,
      ),
    );
  }

  async function upload(selected: UploadFile) {
    controllers.current.get(selected.id)?.abort();
    const controller = new AbortController();
    controllers.current.set(selected.id, controller);
    update(selected.id, { uploading: true, path: null, error: undefined });
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
          bucket: 'patrol-photos',
          contentType: file.type,
          sizeBytes: file.size,
        }),
        signal: controller.signal,
      });
      const result = await fileResult(response, uploadEnvelope);
      if (controllers.current.get(selected.id) !== controller) return;
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
      if (controllers.current.get(selected.id) !== controller) return;
      update(selected.id, { path: result.data.path, uploading: false });
      setMessage('Photo uploaded privately. Send the report to attach it.');
    } catch (error) {
      if (controllers.current.get(selected.id) !== controller) return;
      update(selected.id, {
        uploading: false,
        error: controller.signal.aborted
          ? 'The upload timed out. Retry.'
          : error instanceof Error
            ? error.message
            : 'The upload failed. Retry.',
      });
      setMessage(null);
    } finally {
      window.clearTimeout(timeout);
      if (controllers.current.get(selected.id) === controller) {
        controllers.current.delete(selected.id);
      }
    }
  }

  function changeFiles(next: readonly UploadFile[]) {
    const nextIds = new Set(next.map((file) => file.id));
    for (const photo of photos) {
      if (!nextIds.has(photo.id)) {
        controllers.current.get(photo.id)?.abort();
        controllers.current.delete(photo.id);
      }
    }
    const known = new Map(photos.map((photo) => [photo.id, photo]));
    const added = next.filter((file) => !known.has(file.id));
    setPhotos(
      next.map(
        (file) =>
          known.get(file.id) ?? { ...file, path: null, uploading: true },
      ),
    );
    if (added.length === 0) setMessage('Photo removed.');
    for (const file of added) void upload(file);
  }

  const uploading = photos.some((photo) => photo.uploading);
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel="Report incident"
      submitDisabled={uploading}
      onSaved={() => {
        setPhotos([]);
        setMessage(null);
      }}
      input={(form, clientRequestId) => {
        if (photos.some((photo) => !photo.path)) {
          throw new ValidationError({
            photoPaths: 'Retry or remove the photos that did not upload.',
          });
        }
        return patrolIncidentInputSchema.parse({
          category: form.get('category'),
          severity: form.get('severity'),
          description: String(form.get('description') ?? ''),
          location: String(form.get('location') ?? ''),
          photoPaths: photos.map((photo) => photo.path),
          clientRequestId,
        });
      }}
    >
      <SelectInput
        id={`${id}-category`}
        name="category"
        label="What happened?"
        required
        defaultValue="suspicious_activity"
        options={PATROL_INCIDENT_CATEGORIES.map((value) => ({
          value,
          label: PATROL_CATEGORY_LABELS[value],
        }))}
      />
      <SelectInput
        id={`${id}-severity`}
        name="severity"
        label="Severity"
        required
        defaultValue="medium"
        helpText="High and critical alert the administrators straight away."
        options={PATROL_SEVERITIES.map((value) => ({
          value,
          label: PATROL_SEVERITY_LABELS[value],
        }))}
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label="Description"
        required
        maxLength={1000}
      />
      <TextInput
        id={`${id}-location`}
        name="location"
        label="Location (optional)"
        helpText="For example Tower B lobby or the back gate."
        maxLength={200}
        autoComplete="off"
      />
      <FileUpload
        id={`${id}-photos`}
        label="Photos (optional)"
        acceptedTypes={PATROL_PHOTO_CONTENT_TYPES}
        maxFileBytes={MAX_FILE_BYTES}
        maxFiles={PATROL_MAX_PHOTOS}
        capturePhoto
        files={photos}
        helpText={`Up to ${PATROL_MAX_PHOTOS} JPG or PNG photos, 5 MiB each. Only administrators, the committee and you can see them, and they are deleted after ${retentionDays ? `${retentionDays} days` : 'the society retention period'}.`}
        onRetry={(file) => void upload(file)}
        onFilesChange={changeFiles}
      />
      <input
        type="hidden"
        name="uploadPending"
        value={uploading ? 'true' : 'false'}
      />
      {message ? (
        <p role="status" className="text-caption text-ink-muted">
          {message}
        </p>
      ) : null}
    </ModuleActionForm>
  );
}

export function PatrolPhotoLink({
  path,
  index,
  request = fetch,
}: {
  path: string;
  index: number;
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
          body: JSON.stringify({ bucket: 'patrol-photos', path }),
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
        {link ? `Refresh photo ${index} link` : `View photo ${index}`}
      </Button>
      {link ? (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          Open photo {index} (private link, up to five minutes)
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

export function PatrolPrintButton() {
  return (
    <Button className="print:hidden" onClick={() => window.print()}>
      Print checkpoint sheet
    </Button>
  );
}
