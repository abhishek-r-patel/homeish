// Delete expired private storage files before purging their database records.
import 'server-only';
import { z } from 'zod';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { createRequestId } from '../errors';
import { privilegedClient } from './server-client';

type RetentionBucket =
  | 'visitor-photos'
  | 'delivery-photos'
  | 'request-files'
  | 'tenancy-files'
  | 'parking-photos'
  | 'patrol-photos'
  | 'metering-photos'
  | 'vendor-files'
  | 'document-files'
  | 'community-photos';

type RetentionFile = {
  bucket: RetentionBucket;
  path: string;
};

function isRetentionFile(value: unknown): value is RetentionFile {
  if (typeof value !== 'object' || value === null) return false;
  const file = value as { bucket?: unknown; path?: unknown };
  return (
    (file.bucket === 'visitor-photos' ||
      file.bucket === 'delivery-photos' ||
      file.bucket === 'request-files' ||
      file.bucket === 'tenancy-files' ||
      file.bucket === 'parking-photos' ||
      file.bucket === 'patrol-photos' ||
      file.bucket === 'metering-photos' ||
      file.bucket === 'vendor-files' ||
      file.bucket === 'document-files' ||
      file.bucket === 'community-photos') &&
    typeof file.path === 'string' &&
    file.path.length > 0
  );
}

export async function runRetentionPrivileged(today: string): Promise<void> {
  const files = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'housekeeping_retention_files_list',
    { p_today: today },
  );
  if (!Array.isArray(files) || !files.every(isRetentionFile)) {
    throw new Error('Retention file list returned an invalid response.');
  }
  const tenancyFiles = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'tenancy_retention_files_list',
    { p_today: today },
  );
  if (
    !Array.isArray(tenancyFiles) ||
    !tenancyFiles.every(
      (file) => isRetentionFile(file) && file.bucket === 'tenancy-files',
    )
  ) {
    throw new Error(
      'Tenancy retention file list returned an invalid response.',
    );
  }
  const parkingFiles = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'parking_retention_files_list',
    { p_today: today },
  );
  if (
    !Array.isArray(parkingFiles) ||
    !parkingFiles.every(
      (file) => isRetentionFile(file) && file.bucket === 'parking-photos',
    )
  ) {
    throw new Error(
      'Parking retention file list returned an invalid response.',
    );
  }
  const documentFiles = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'document_retention_files_list',
    { p_today: today },
  );
  if (
    !Array.isArray(documentFiles) ||
    !documentFiles.every(
      (file) => isRetentionFile(file) && file.bucket === 'document-files',
    )
  ) {
    throw new Error(
      'Document retention file list returned an invalid response.',
    );
  }
  const patrolFiles = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'patrol_retention_files_list',
    { p_today: today },
  );
  if (
    !Array.isArray(patrolFiles) ||
    !patrolFiles.every(
      (file) => isRetentionFile(file) && file.bucket === 'patrol-photos',
    )
  ) {
    throw new Error('Patrol retention file list returned an invalid response.');
  }

  const pathsByBucket = new Map<RetentionBucket, Set<string>>();
  for (const { bucket, path } of [
    ...files,
    ...tenancyFiles,
    ...parkingFiles,
    ...documentFiles,
    ...patrolFiles,
  ]) {
    const paths = pathsByBucket.get(bucket) ?? new Set<string>();
    paths.add(path);
    pathsByBucket.set(bucket, paths);
  }

  for (const [bucket, paths] of pathsByBucket) {
    const filePaths = [...paths];
    for (let offset = 0; offset < filePaths.length; offset += 100) {
      const { error } = await privilegedClient.storage
        .from(bucket)
        .remove(filePaths.slice(offset, offset + 100));
      if (error) {
        throw new Error(`Could not remove expired ${bucket} files.`, {
          cause: error,
        });
      }
    }
  }

  await invokeUntypedRpc<unknown>(
    privilegedClient,
    'housekeeping_retention_run',
    { p_today: today, p_request_trace: createRequestId() },
  );

  const staffResult = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'staff_retention_run',
    { p_today: today, p_request_trace: createRequestId() },
  );
  if (
    typeof staffResult !== 'object' ||
    staffResult === null ||
    !('staffAttendanceDeleted' in staffResult) ||
    typeof staffResult.staffAttendanceDeleted !== 'number' ||
    !Number.isInteger(staffResult.staffAttendanceDeleted) ||
    staffResult.staffAttendanceDeleted < 0
  ) {
    throw new Error('Staff retention returned an invalid response.');
  }

  const directoryResult = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'directory_retention_run',
    { p_today: today, p_request_trace: createRequestId() },
  );
  if (
    typeof directoryResult !== 'object' ||
    directoryResult === null ||
    ![
      'vehicles_deleted',
      'emergency_contacts_deleted',
      'preferences_deleted',
    ].every((key) => {
      const value = Reflect.get(directoryResult, key);
      return typeof value === 'number' && Number.isInteger(value) && value >= 0;
    })
  ) {
    throw new Error('Directory retention returned an invalid response.');
  }
  const tenancyResult = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'tenancy_retention_run',
    { p_today: today, p_request_trace: createRequestId() },
  );
  if (
    !z
      .object({
        documents_deleted: z.number().int().nonnegative(),
        preparations_cleared: z.number().int().nonnegative(),
      })
      .strict()
      .safeParse(tenancyResult).success
  ) {
    throw new Error('Tenancy retention returned an invalid response.');
  }
  const parkingResult = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'parking_retention_run',
    { p_today: today, p_request_trace: createRequestId() },
  );
  if (
    !z
      .object({ photos_deleted: z.number().int().nonnegative() })
      .strict()
      .safeParse(parkingResult).success
  ) {
    throw new Error('Parking retention returned an invalid response.');
  }
  const patrolResult = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'patrol_retention_run',
    { p_today: today, p_request_trace: createRequestId() },
  );
  if (
    !z
      .object({ photos_deleted: z.number().int().nonnegative() })
      .strict()
      .safeParse(patrolResult).success
  ) {
    throw new Error('Patrol retention returned an invalid response.');
  }

  // Attached reading photos stay with their reading; only never-attached uploads are removed.
  const meteringFiles = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'metering_retention_files_list',
    { p_today: today },
  );
  if (
    !Array.isArray(meteringFiles) ||
    !meteringFiles.every(
      (file) => isRetentionFile(file) && file.bucket === 'metering-photos',
    )
  ) {
    throw new Error(
      'Metering retention file list returned an invalid response.',
    );
  }
  const meteringPaths = [
    ...new Set(meteringFiles.map((file: RetentionFile) => file.path)),
  ];
  for (let offset = 0; offset < meteringPaths.length; offset += 100) {
    const { error } = await privilegedClient.storage
      .from('metering-photos')
      .remove(meteringPaths.slice(offset, offset + 100));
    if (error) {
      throw new Error('Could not remove unattached metering-photos files.', {
        cause: error,
      });
    }
  }

  // Attached vendor documents and quote files are kept; only never-attached uploads are removed.
  const vendorFiles = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'vendor_retention_files_list',
    { p_today: today },
  );
  if (
    !Array.isArray(vendorFiles) ||
    !vendorFiles.every(
      (file) => isRetentionFile(file) && file.bucket === 'vendor-files',
    )
  ) {
    throw new Error('Vendor retention file list returned an invalid response.');
  }
  const vendorPaths = [
    ...new Set(vendorFiles.map((file: RetentionFile) => file.path)),
  ];
  for (let offset = 0; offset < vendorPaths.length; offset += 100) {
    const { error } = await privilegedClient.storage
      .from('vendor-files')
      .remove(vendorPaths.slice(offset, offset + 100));
    if (error) {
      throw new Error('Could not remove unattached vendor-files files.', {
        cause: error,
      });
    }
  }

  // Community photos go first so a Storage failure never leaves rows pointing at deleted files.
  const communityFiles = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'community_retention_files_list',
    { p_today: today },
  );
  if (
    !Array.isArray(communityFiles) ||
    !communityFiles.every(
      (file) => isRetentionFile(file) && file.bucket === 'community-photos',
    )
  ) {
    throw new Error(
      'Community retention file list returned an invalid response.',
    );
  }
  const communityPaths = [
    ...new Set(communityFiles.map((file: RetentionFile) => file.path)),
  ];
  for (let offset = 0; offset < communityPaths.length; offset += 100) {
    const { error } = await privilegedClient.storage
      .from('community-photos')
      .remove(communityPaths.slice(offset, offset + 100));
    if (error) {
      throw new Error('Could not remove expired community-photos files.', {
        cause: error,
      });
    }
  }
  const communityResult = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'community_retention_run',
    { p_today: today, p_request_trace: createRequestId() },
  );
  if (
    !z
      .object({
        postsDeleted: z.number().int().nonnegative(),
        listingsDeleted: z.number().int().nonnegative(),
        repliesDeleted: z.number().int().nonnegative(),
      })
      .strict()
      .safeParse(communityResult).success
  ) {
    throw new Error('Community retention returned an invalid response.');
  }

  const communicationResult = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'communication_retention_run',
    { p_today: today, p_request_trace: createRequestId() },
  );
  if (
    !z
      .object({ contactLogsDeleted: z.number().int().nonnegative() })
      .strict()
      .safeParse(communicationResult).success
  ) {
    throw new Error('Communication retention returned an invalid response.');
  }
  const vacancyResult = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'unit_vacancy_retention_run',
    { p_today: today, p_request_trace: createRequestId() },
  );
  if (!z.number().int().nonnegative().safeParse(vacancyResult).success) {
    throw new Error('Vacancy retention returned an invalid response.');
  }
}
