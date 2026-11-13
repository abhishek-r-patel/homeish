// Verify uploaded objects again before an owning operation stores their paths.
import 'server-only';
import { AppError } from '../errors';
import type { RequestContext } from '../tenancy/request-context';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const FILE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;
export type FileContentType = (typeof FILE_CONTENT_TYPES)[number];
export const SOCIETY_LOGO_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
] as const satisfies readonly FileContentType[];

export type StorageBucket =
  | 'visitor-photos'
  | 'delivery-photos'
  | 'request-files'
  | 'payment-proofs'
  | 'society-assets'
  | 'notice-files';

const SOCIETY_LOGO_PATH_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/logos\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/i;
const BILLING_QR_PATH_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/billing-qr\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/;
const BILLING_PAYMENT_PROOF_PATH_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/payments\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/i;

const STORAGE_BUCKETS: readonly StorageBucket[] = [
  'visitor-photos',
  'delivery-photos',
  'request-files',
  'payment-proofs',
  'society-assets',
  'notice-files',
];
const BUCKET_CONTENT_TYPES: Readonly<
  Record<StorageBucket, readonly FileContentType[]>
> = {
  'visitor-photos': ['image/jpeg', 'image/png'],
  'delivery-photos': ['image/jpeg', 'image/png'],
  'request-files': FILE_CONTENT_TYPES,
  'payment-proofs': ['image/jpeg', 'image/png'],
  'society-assets': FILE_CONTENT_TYPES,
  'notice-files': FILE_CONTENT_TYPES,
};

export function isSocietyLogoPath(path: string, societyId: string): boolean {
  const match = SOCIETY_LOGO_PATH_PATTERN.exec(path);
  return match?.[1]?.toLowerCase() === societyId.toLowerCase();
}

export function isBillingQrPath(path: string, societyId: string): boolean {
  const match = BILLING_QR_PATH_PATTERN.exec(path);
  return match?.[1] === societyId;
}

export function isBillingPaymentProofPath(
  path: string,
  societyId: string,
  unitId: string,
): boolean {
  const match = BILLING_PAYMENT_PROOF_PATH_PATTERN.exec(path);
  return (
    match !== null &&
    match[1]?.toLowerCase() === societyId.toLowerCase() &&
    match[2]?.toLowerCase() === unitId.toLowerCase()
  );
}

export async function verifyFileAttachment(
  context: RequestContext,
  input: {
    bucket: StorageBucket;
    contentTypes: readonly FileContentType[];
    maxBytes?: number;
    ownerPath: string;
    path: string;
    societyId: string;
  },
): Promise<{ contentType: FileContentType; sizeBytes: number }> {
  const {
    bucket,
    contentTypes,
    maxBytes = MAX_FILE_BYTES,
    ownerPath,
    path,
    societyId,
  } = input;
  const pathSegments = path.split('/');
  if (
    !STORAGE_BUCKETS.includes(bucket) ||
    !ownerPath.startsWith(`${societyId}/`) ||
    pathSegments.length < 3 ||
    pathSegments.slice(0, -1).join('/') !== ownerPath ||
    pathSegments.some(
      (segment) => !segment || segment === '.' || segment === '..',
    ) ||
    !contentTypes.every((contentType) =>
      BUCKET_CONTENT_TYPES[bucket]?.includes(contentType),
    )
  ) {
    throw new AppError('FORBIDDEN');
  }

  const directory = pathSegments.slice(0, -1).join('/');
  const fileName = pathSegments.at(-1);
  if (!fileName) throw new AppError('FORBIDDEN');
  const { data, error } = await context.db.storage
    .from(bucket)
    .list(directory, { limit: 3, search: fileName });
  if (error) {
    throw new Error('Could not verify the uploaded file.', { cause: error });
  }
  const matches = data.filter((file) => file.name === fileName);
  const metadata = matches[0]?.metadata;
  if (matches.length !== 1 || !metadata || typeof metadata !== 'object') {
    throw new AppError('NOT_FOUND');
  }

  const details = metadata as Record<string, unknown>;
  const sizeBytes = Number(details.size);
  const contentType = details.mimetype;
  const extensionMatchesType =
    (contentType === 'image/jpeg' && path.endsWith('.jpg')) ||
    (contentType === 'image/png' && path.endsWith('.png')) ||
    (contentType === 'application/pdf' && path.endsWith('.pdf'));
  if (
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > maxBytes ||
    typeof contentType !== 'string' ||
    !contentTypes.includes(contentType as FileContentType) ||
    !extensionMatchesType
  ) {
    throw new AppError('VALIDATION_FAILED', {
      fieldErrors: { file: 'The uploaded file type or size is not allowed.' },
    });
  }
  return { contentType: contentType as FileContentType, sizeBytes };
}
