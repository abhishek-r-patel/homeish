// Upload up to three private community photos before a post or listing is sent, and show signed photo links.
'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileUpload, type UploadFile } from '@/components/ui/file-upload';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import { publicEnvironment } from '@/core/config/public-env';
import { ValidationError } from '@/core/errors';
import {
  COMMUNITY_MAX_PHOTOS,
  COMMUNITY_PHOTO_CONTENT_TYPES,
  COMMUNITY_PHOTO_MAX_BYTES,
  communityPhotoUploadResultSchema,
} from '@/core/community/validation';

export type CommunityPhotoUrls = Readonly<Record<string, string>>;

type PhotoEntry = UploadFile & { path: string | null; uploading: boolean };

function uploadUrl(value: string, path: string) {
  const url = new URL(value);
  const configured = new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL);
  const expectedPath = `${configured.pathname.replace(/\/$/, '')}/storage/v1/object/upload/sign/community-photos/${path}`;
  if (
    url.origin !== configured.origin ||
    decodeURIComponent(url.pathname) !== expectedPath
  ) {
    throw new Error('The private photo link is invalid. Refresh and retry.');
  }
  return url.href;
}

export function useCommunityPhotos({
  prepareUpload,
  request = fetch,
  initialPaths = [],
}: {
  prepareUpload: ModuleFormAction;
  request?: typeof fetch;
  initialPaths?: readonly string[];
}) {
  const controllers = useRef(new Map<string, AbortController>());
  const [kept, setKept] = useState<readonly string[]>(initialPaths);
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
      if (file.size < 1 || file.size > COMMUNITY_PHOTO_MAX_BYTES) {
        throw new Error('Choose a JPG or PNG photo up to 5 MiB.');
      }
      const form = new FormData();
      form.set(
        'input',
        JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
      );
      const response = await prepareUpload(form);
      if (!response.ok) {
        throw new Error(
          `${response.message}${response.referenceId ? ` Reference: ${response.referenceId}` : ''}`,
        );
      }
      const issued = communityPhotoUploadResultSchema.safeParse(response.data);
      if (!issued.success) {
        throw new Error('The photo request was not completed. Retry.');
      }
      if (controllers.current.get(selected.id) !== controller) return;
      const stored = await request(
        uploadUrl(issued.data.signedUrl, issued.data.path),
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
      if (!stored.ok) {
        throw new Error('The photo could not be uploaded. Retry or remove it.');
      }
      if (controllers.current.get(selected.id) !== controller) return;
      update(selected.id, { path: issued.data.path, uploading: false });
      setMessage('Photo uploaded privately. Send the form to attach it.');
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
    const added = next
      .filter((file) => !known.has(file.id))
      .slice(0, Math.max(0, COMMUNITY_MAX_PHOTOS - kept.length));
    const addedIds = new Set(added.map((file) => file.id));
    setPhotos(
      next
        .filter((file) => known.has(file.id) || addedIds.has(file.id))
        .map(
          (file) =>
            known.get(file.id) ?? { ...file, path: null, uploading: true },
        ),
    );
    if (added.length === 0) setMessage('Photo removed.');
    for (const file of added) void upload(file);
  }

  const uploading = photos.some((photo) => photo.uploading);
  return {
    kept,
    photos,
    message,
    uploading,
    changeFiles,
    retry: (file: UploadFile) => void upload(file),
    removeKept: (path: string) => {
      setKept((current) => current.filter((value) => value !== path));
      setMessage('Photo removed. Save to confirm.');
    },
    // Throws when a chosen photo has not finished uploading, so the form is not sent without it.
    paths: () => {
      if (photos.some((photo) => !photo.path)) {
        throw new ValidationError({
          photoPaths: 'Retry or remove the photos that did not upload.',
        });
      }
      return [
        ...kept,
        ...photos.flatMap((photo) => (photo.path ? [photo.path] : [])),
      ];
    },
    reset: () => {
      setPhotos([]);
      setMessage(null);
    },
  };
}

export type CommunityPhotoState = ReturnType<typeof useCommunityPhotos>;

export function CommunityPhotoField({
  id,
  state,
  photoUrls = {},
}: {
  id: string;
  state: CommunityPhotoState;
  photoUrls?: CommunityPhotoUrls;
}) {
  const room = COMMUNITY_MAX_PHOTOS - state.kept.length;
  return (
    <div className="grid min-w-0 gap-space-3">
      {state.kept.length > 0 ? (
        <ul aria-label="Attached photos" className="grid gap-space-2">
          {state.kept.map((path, index) => (
            <li
              key={path}
              className="flex min-w-0 flex-wrap items-center gap-space-3"
            >
              {photoUrls[path] ? (
                <Image
                  alt={`Attached photo ${index + 1}`}
                  className="size-16 rounded-md border border-rule object-cover"
                  height={64}
                  src={photoUrls[path]}
                  unoptimized
                  width={64}
                />
              ) : (
                <span className="text-body">Photo {index + 1}</span>
              )}
              <Button
                type="button"
                variant="tertiary"
                onClick={() => state.removeKept(path)}
              >
                Remove photo {index + 1}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {room > 0 ? (
        <FileUpload
          id={id}
          label="Photos (optional)"
          acceptedTypes={COMMUNITY_PHOTO_CONTENT_TYPES}
          maxFileBytes={COMMUNITY_PHOTO_MAX_BYTES}
          maxFiles={room}
          files={state.photos}
          helpText={`Up to ${COMMUNITY_MAX_PHOTOS} JPG or PNG photos, 5 MiB each. Only residents who can see this item, and the administrators, can see them.`}
          onRetry={state.retry}
          onFilesChange={state.changeFiles}
        />
      ) : (
        <p className="text-caption text-ink-muted">
          {COMMUNITY_MAX_PHOTOS} photos attached. Remove one to add another.
        </p>
      )}
      <input
        type="hidden"
        name="uploadPending"
        value={state.uploading ? 'true' : 'false'}
      />
      {state.message ? (
        <p role="status" className="text-caption text-ink-muted">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function CommunityPhotoGallery({
  paths,
  photoUrls,
  label,
}: {
  paths: readonly string[];
  photoUrls: CommunityPhotoUrls;
  label: string;
}) {
  if (paths.length === 0) return null;
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-1 gap-space-3 medium:grid-cols-3"
    >
      {paths.map((path, index) => (
        <li key={path} className="min-w-0">
          {photoUrls[path] ? (
            <a
              className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              href={photoUrls[path]}
              rel="noreferrer"
              target="_blank"
            >
              <Image
                alt={`Photo ${index + 1} of ${paths.length} (opens full size)`}
                className="aspect-[4/3] h-auto w-full rounded-md border border-rule object-cover"
                height={480}
                src={photoUrls[path]}
                unoptimized
                width={640}
              />
            </a>
          ) : (
            <p className="rounded-md border border-rule p-space-3 text-caption text-ink-muted">
              Photo {index + 1} is not available right now. Refresh to retry.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function CommunityThumbnail({
  path,
  photoUrls,
}: {
  path: string | null;
  photoUrls: CommunityPhotoUrls;
}) {
  const url = path ? photoUrls[path] : undefined;
  if (!url) return null;
  return (
    <Image
      alt=""
      className="size-16 shrink-0 rounded-md border border-rule object-cover"
      height={64}
      src={url}
      unoptimized
      width={64}
    />
  );
}
