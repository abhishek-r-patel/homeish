// Client-side file selection, constraint feedback and per-file upload states.
'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Button } from './button';

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

function ImagePreview({ file }: { file: File }) {
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
      aria-label={`Photo preview for ${file.name}`}
      className="flex size-12 items-center justify-center rounded-sm bg-surface-sunken text-caption text-ink-muted"
      role="img"
    >
      Photo
    </span>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const acceptedTypeList = acceptedTypes.join(', ');
  const acceptedTypeLabel = acceptedTypes
    .map((type) => fileTypeLabels[type] ?? type)
    .join(', ');
  const maximumSizeLabel = formatFileSize(maxFileBytes);

  function addFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    const errors: string[] = [];
    const accepted: UploadFile[] = [];
    const availableSlots = Math.max(0, maxFiles - files.length);
    for (const [index, file] of Array.from(fileList).entries()) {
      if (!acceptedTypes.includes(file.type)) {
        errors.push(
          `${file.name}: Choose a file in one of these formats: ${acceptedTypeLabel}.`,
        );
      } else if (file.size > maxFileBytes) {
        errors.push(
          `${file.name}: Files must be ${maximumSizeLabel} or smaller.`,
        );
      } else if (accepted.length >= availableSlots) {
        errors.push(`You can add up to ${maxFiles} files.`);
      } else {
        accepted.push({
          file,
          id: `${Date.now()}-${index}-${file.lastModified}-${file.size}`,
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
    <section aria-labelledby={`${id}-label`} className="grid gap-space-3">
      <h2 className="text-body-strong" id={`${id}-label`}>
        {label}
      </h2>
      <p className="text-caption text-ink-muted">
        {helpText ??
          `JPG, PNG or PDF · Up to ${maximumSizeLabel} each · ${maxFiles} files maximum`}
      </p>
      <div
        className="grid justify-items-center gap-space-3 rounded-md border-2 border-dashed border-rule-strong p-space-5 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <p className="text-body text-ink-muted">
          Drop files here or choose files from your device.
        </p>
        <div className="flex flex-wrap justify-center gap-space-2">
          {capturePhoto ? (
            <Button
              className="medium:hidden"
              onClick={() => cameraInputRef.current?.click()}
              variant="secondary"
            >
              Take Photo
            </Button>
          ) : null}
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="secondary"
          >
            Choose File
          </Button>
        </div>
      </div>
      <input
        accept={acceptedTypeList}
        aria-label={label}
        className="sr-only"
        id={id}
        multiple={maxFiles > 1}
        onChange={handleInputChange}
        ref={fileInputRef}
        type="file"
      />
      {capturePhoto ? (
        <input
          accept="image/*"
          aria-label="Take a photo"
          capture="environment"
          className="sr-only"
          multiple={false}
          onChange={handleInputChange}
          ref={cameraInputRef}
          tabIndex={-1}
          type="file"
        />
      ) : null}
      {validationErrors.length > 0 ? (
        <ul className="grid gap-space-1 text-caption text-danger" role="alert">
          {validationErrors.map((message, index) => (
            <li key={`${index}-${message}`}>{message}</li>
          ))}
        </ul>
      ) : null}
      {files.length > 0 ? (
        <ul aria-label="Selected files" className="grid gap-space-2">
          {files.map((upload) => (
            <li
              className="flex min-w-0 items-center gap-space-3 rounded-md border border-rule bg-surface p-space-3"
              key={upload.id}
            >
              {upload.file.type.startsWith('image/') ? (
                <ImagePreview file={upload.file} />
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
                  {formatFileSize(upload.file.size)}
                </span>
                {upload.progress !== undefined ? (
                  <progress
                    aria-label={`Upload progress for ${upload.file.name}`}
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
                  aria-label={`Retry ${upload.file.name}`}
                  onClick={() => onRetry(upload)}
                  variant="secondary"
                >
                  Retry
                </Button>
              ) : null}
              <Button
                aria-label={`Remove ${upload.file.name}`}
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
