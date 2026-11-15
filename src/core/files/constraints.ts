// Share upload limits without importing server-side file authorisation into forms.
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const FILE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;
