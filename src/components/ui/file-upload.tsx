// Client-side file selection, constraint feedback and per-file upload states.
'use client';

import Image from 'next/image';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import type { MessageValues } from '../../core/i18n/messages';
import { Button } from './button';
import { useUiTranslator } from './language';

export type UploadFile = {
  error?: string;
  file: File;
  id: string;
  progress?: number;
};

type FileUploadProps = {
  acceptedTypes?: readonly string[];
  capturePhoto?: boolean;
  files: readonly UploadFile[];
  helpText?: string;
  id: string;
  label: string;
  maxFileBytes?: number;
  maxFiles?: number;
  onFilesChange: (files: readonly UploadFile[]) => void;
  onRetry?: (file: UploadFile) => void;
};

const defaultAcceptedTypes = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;
const defaultMaximumSize = 5 * 1024 * 1024;
const fileTypeLabels: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

function ImagePreview({
  file,
  translate,
}: {
  file: File;
  translate: (source: string, values?: MessageValues) => string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const frame = window.requestAnimationFrame(() => setPreviewUrl(url));
    return () => {
      window.cancelAnimationFrame(frame);
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return previewUrl ? (
    <Image
      alt={file.name}
      className="size-12 rounded-sm object-cover"
      height={48}
      src={previewUrl}
      unoptimized
      width={48}
    />
  ) : (
    <span
      aria-label={translate('Photo preview for {name}', { name: file.name })}
      className="flex size-12 items-center justify-center rounded-sm bg-surface-sunken text-caption text-ink-muted"
      role="img"
    >
      {translate('Photo')}
    </span>
  );
}

function formatFileSize(
  bytes: number,
  translate: (source: string, values?: MessageValues) => string,
) {
  if (bytes < 1024) {
    return translate('{size} bytes', { size: bytes });
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

function subscribeToHydration() {
  return () => {};
}

export function FileUpload({
  acceptedTypes = defaultAcceptedTypes,
  capturePhoto = false,
  files,
  helpText,
  id,
  label,
  maxFileBytes = defaultMaximumSize,
  maxFiles = 3,
  onFilesChange,
  onRetry,
}: FileUploadProps) {
  const { translate } = useUiTranslator();
  const fileIdPrefix = useId();
  const nextFileId = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [validationErrors, setValidationErrors] = useState<
    { source: string; values: MessageValues }[]
  >([]);
  const acceptedTypeList = acceptedTypes.join(', ');
  const acceptedTypeLabel = acceptedTypes
    .map((type) => fileTypeLabels[type] ?? type)
    .join(', ');
  const acceptedTypeSummary = acceptedTypeLabel.replace(
    /, ([^,]+)$/,
    (match, lastType: string) => translate(' or {type}', { type: lastType }),
  );
  const maximumSizeLabel = formatFileSize(maxFileBytes, translate);

  function addFiles(fileList: FileList | null) {
    if (!fileList || !isHydrated) {
      return;
    }

    const errors: { source: string; values: MessageValues }[] = [];
    const accepted: UploadFile[] = [];
    const availableSlots = Math.max(0, maxFiles - files.length);
    for (const file of Array.from(fileList)) {
      if (!acceptedTypes.includes(file.type)) {
        errors.push({
          source: '{name}: Choose a file in one of these formats: {types}.',
          values: {
            name: file.name,
            types: acceptedTypeLabel,
          },
        });
      } else if (file.size > maxFileBytes) {
        errors.push({
          source: '{name}: Files must be {maxSize} or smaller.',
          values: {
            name: file.name,
          },
        });
      } else if (accepted.length >= availableSlots) {
        errors.push({
          source: 'You can add up to {count} files.',
          values: {
            count: maxFiles,
          },
        });
      } else {
        accepted.push({
          file,
          id: `${fileIdPrefix}-${nextFileId.current++}`,
        });
      }
    }

    setValidationErrors(errors);
    if (accepted.length > 0) {
      onFilesChange([...files, ...accepted]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(event.currentTarget.files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  return (
    <section
      aria-busy={!isHydrated}
      aria-labelledby={`${id}-label`}
      className="grid gap-space-3"
    >
      <h2 className="text-body-strong" id={`${id}-label`}>
        {label}
      </h2>
      <p className="text-caption text-ink-muted">
        {helpText ??
          translate('{types} · Up to {maxSize} each · {count} files maximum', {
            types: acceptedTypeSummary,
            maxSize: maximumSizeLabel,
            count: maxFiles,
          })}
      </p>
      <div
        className="grid justify-items-center gap-space-3 rounded-md border-2 border-dashed border-rule-strong p-space-5 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <p className="text-body text-ink-muted">
          {translate('Drop files here or choose files from your device.')}
        </p>
        <div className="flex flex-wrap justify-center gap-space-2">
          {capturePhoto ? (
            <Button
              className="medium:hidden"
              disabled={!isHydrated}
              onClick={() => cameraInputRef.current?.click()}
              variant="secondary"
            >
              {translate('Take Photo')}
            </Button>
          ) : null}
          <Button
            disabled={!isHydrated}
            onClick={() => fileInputRef.current?.click()}
            variant="secondary"
          >
            {translate('Choose File')}
          </Button>
        </div>
      </div>
      <input
        accept={acceptedTypeList}
        aria-label={label}
        className="sr-only"
        disabled={!isHydrated}
        id={id}
        multiple={maxFiles > 1}
        onChange={handleInputChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
      {capturePhoto ? (
        <input
          accept="image/*"
          aria-label={translate('Take a photo')}
          capture="environment"
          className="sr-only"
          disabled={!isHydrated}
          multiple={false}
          onChange={handleInputChange}
          ref={cameraInputRef}
          tabIndex={-1}
          type="file"
        />
      ) : null}
      {validationErrors.length > 0 ? (
        <ul className="grid gap-space-1 text-caption text-danger" role="alert">
          {validationErrors.map(({ source, values }, index) => (
            <li key={`${index}-${source}`}>
              {translate(source, { ...values, maxSize: maximumSizeLabel })}
            </li>
          ))}
        </ul>
      ) : null}
      {files.length > 0 ? (
        <ul
          aria-label={translate('Selected files')}
          className="grid gap-space-2"
        >
          {files.map((upload) => (
            <li
              className="flex min-w-0 items-center gap-space-3 rounded-md border border-rule bg-surface p-space-3"
              key={upload.id}
            >
              {upload.file.type.startsWith('image/') ? (
                <ImagePreview file={upload.file} translate={translate} />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-12 items-center justify-center rounded-sm bg-surface-sunken text-caption text-ink-muted"
                >
                  PDF
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block break-words text-body-strong">
                  {upload.file.name}
                </span>
                <span className="block text-caption text-ink-muted">
                  {formatFileSize(upload.file.size, translate)}
                </span>
                {upload.progress !== undefined ? (
                  <progress
                    aria-label={translate('Upload progress for {name}', {
                      name: upload.file.name,
                    })}
                    className="mt-space-1 w-full accent-brand"
                    max={100}
                    value={upload.progress}
                  />
                ) : null}
                {upload.error ? (
                  <span className="block text-caption text-danger" role="alert">
                    {upload.error}
                  </span>
                ) : null}
              </span>
              {upload.error && onRetry ? (
                <Button
                  aria-label={translate('Retry {name}', {
                    name: upload.file.name,
                  })}
                  onClick={() => onRetry(upload)}
                  variant="secondary"
                >
                  {translate('Retry')}
                </Button>
              ) : null}
              <Button
                aria-label={translate('Remove {name}', {
                  name: upload.file.name,
                })}
                iconOnly
                leadingIcon={<span aria-hidden="true">×</span>}
                onClick={() =>
                  onFilesChange(files.filter((file) => file.id !== upload.id))
                }
                variant="tertiary"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
