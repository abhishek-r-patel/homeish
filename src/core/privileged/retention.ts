// Delete expired private storage files before purging their database records.
import 'server-only';
import { z } from 'zod';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { createRequestId } from '../errors';
import { privilegedClient } from './server-client';

type RetentionBucket =
  'visitor-photos' | 'delivery-photos' | 'request-files' | 'tenancy-files';

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
      file.bucket === 'tenancy-files') &&
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

  const pathsByBucket = new Map<RetentionBucket, Set<string>>();
  for (const { bucket, path } of [...files, ...tenancyFiles]) {
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
}
