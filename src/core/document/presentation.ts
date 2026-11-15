// Present document audiences, units and files in plain language for every document screen.
import type {
  DocumentFolderAudience,
  DocumentUnit,
  DocumentUnitAudience,
} from './validation';

export const DOCUMENT_FOLDER_AUDIENCE_LABELS: Record<
  DocumentFolderAudience,
  string
> = {
  all_residents: 'All residents',
  owners_only: 'Owners only',
  committee_admins: 'Committee and admins',
};

export const DOCUMENT_FOLDER_AUDIENCE_HELP: Record<
  DocumentFolderAudience,
  string
> = {
  all_residents: 'Owners, tenants and family members can view.',
  owners_only: 'Only residents who own a unit can view.',
  committee_admins: 'Only committee members and admins can view.',
};

export const DOCUMENT_UNIT_AUDIENCE_LABELS: Record<
  DocumentUnitAudience,
  string
> = {
  all_occupants: 'Everyone in the unit',
  owners_only: 'Unit owners only',
};

const FILE_KINDS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export function documentFileKind(contentType: string): string {
  return FILE_KINDS[contentType] ?? 'File';
}

export function documentFileExtension(contentType: string): string {
  const extension = EXTENSIONS[contentType];
  if (!extension) throw new Error('Unsupported document file type.');
  return extension;
}

export function documentUploadPath(
  societyId: string,
  contentType: string,
  fileId: string,
): string {
  return `${societyId}/documents/${fileId}.${documentFileExtension(contentType)}`;
}

export function formatDocumentFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function documentUnitLabel(
  unit: Pick<DocumentUnit, 'number' | 'block_name'>,
): string {
  return unit.block_name ? `${unit.block_name} · ${unit.number}` : unit.number;
}

export function formatDocumentDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function documentFileNameFromUpload(name: string): string {
  const cleaned = name.replace(/[\\/]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'document';
  return cleaned.length > 200 ? cleaned.slice(0, 200).trim() : cleaned;
}
