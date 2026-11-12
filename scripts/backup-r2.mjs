// Upload daily PostgreSQL dumps to a dedicated Cloudflare R2 bucket.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const LIST_PAGE_SIZE = 1000;
const DATABASE_PREFIX = 'database/';
const DUMP_NAME_PATTERN = /^homeish-db-\d{8}T\d{6}Z\.dump$/;

function requiredEnvironment(name, environment = process.env) {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Missing required backup setting: ${name}.`);
  }
  return value;
}

export function createR2Client(environment = process.env) {
  const accountId = requiredEnvironment('R2_ACCOUNT_ID', environment);
  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    throw new Error(
      'R2_ACCOUNT_ID must be a 32-character Cloudflare account ID.',
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnvironment('R2_ACCESS_KEY_ID', environment),
      secretAccessKey: requiredEnvironment('R2_SECRET_ACCESS_KEY', environment),
    },
  });
}

export async function pruneExpiredDatabaseBackups({
  client,
  bucket,
  now = new Date(),
}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('The backup retention clock is invalid.');
  }

  const cutoff = now.getTime() - RETENTION_MS;
  let continuationToken;
  let deletedCount = 0;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: DATABASE_PREFIX,
        MaxKeys: LIST_PAGE_SIZE,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
      }),
    );
    const contents = page.Contents ?? [];
    if (!Array.isArray(contents)) {
      throw new Error('R2 returned an invalid database backup listing.');
    }

    const expired = contents.filter((object) => {
      if (
        typeof object.Key !== 'string' ||
        !(object.LastModified instanceof Date) ||
        Number.isNaN(object.LastModified.getTime())
      ) {
        throw new Error('R2 returned an invalid database backup entry.');
      }
      return object.LastModified.getTime() < cutoff;
    });

    if (expired.length > 0) {
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: expired.map(({ Key }) => ({ Key })),
            Quiet: true,
          },
        }),
      );
      if (result.Errors?.length) {
        throw new Error(
          `R2 could not remove ${result.Errors.length} expired database backup(s).`,
        );
      }
      deletedCount += expired.length;
    }

    if (page.IsTruncated && !page.NextContinuationToken) {
      throw new Error(
        'R2 returned a truncated backup listing without a cursor.',
      );
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return deletedCount;
}

export async function uploadDatabaseDump({
  client,
  bucket,
  filePath,
  now = new Date(),
}) {
  const fileName = basename(filePath);
  if (!DUMP_NAME_PATTERN.test(fileName)) {
    throw new Error('Database dump filename does not match the backup format.');
  }

  const file = await stat(filePath);
  if (!file.isFile() || file.size === 0) {
    throw new Error('Database dump is missing or empty.');
  }

  const body = createReadStream(filePath);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${DATABASE_PREFIX}${fileName}`,
        Body: body,
        ContentLength: file.size,
        ContentType: 'application/octet-stream',
      }),
    );
  } catch (error) {
    body.destroy();
    throw new Error('Could not upload the database dump to R2.', {
      cause: error,
    });
  }

  const deletedCount = await pruneExpiredDatabaseBackups({
    client,
    bucket,
    now,
  });
  return { sizeBytes: file.size, deletedCount };
}

async function main(args) {
  if (args.length !== 2 || args[0] !== 'upload-database') {
    throw new Error(
      'Usage: node scripts/backup-r2.mjs upload-database <dump-file>',
    );
  }

  const bucket = requiredEnvironment('R2_BUCKET_NAME');
  const client = createR2Client();
  const result = await uploadDatabaseDump({
    client,
    bucket,
    filePath: args[1],
  });
  console.info(
    `Uploaded database dump (${result.sizeBytes} bytes); removed ${result.deletedCount} expired backup(s).`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Database backup failed.',
    );
    process.exitCode = 1;
  });
}
