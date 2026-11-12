// Verify R2 configuration, database upload, and 30-day backup pruning.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@aws-sdk/client-s3', () => {
  class ListObjectsV2Command {
    constructor(public input: Record<string, unknown>) {}
  }
  class DeleteObjectsCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  class PutObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  }

  return {
    DeleteObjectsCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client: vi.fn(),
  };
});

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  createR2Client,
  pruneExpiredDatabaseBackups,
  uploadDatabaseDump,
} from '../../scripts/backup-r2.mjs';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
  vi.clearAllMocks();
});

describe('R2 database backups', () => {
  it('creates a client using the account endpoint and bucket credentials', () => {
    const environment: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      R2_ACCOUNT_ID: 'a'.repeat(32),
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
    };

    createR2Client(environment);

    expect(S3Client).toHaveBeenCalledWith({
      region: 'auto',
      endpoint: `https://${environment.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: environment.R2_ACCESS_KEY_ID,
        secretAccessKey: environment.R2_SECRET_ACCESS_KEY,
      },
    });
  });

  it('uploads the dump before pruning objects older than 30 days', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'homeish-r2-backup-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'homeish-db-20261110T020000Z.dump');
    await writeFile(filePath, 'database dump');
    const commands: unknown[] = [];
    const client = {
      send: vi.fn(async (command: unknown) => {
        commands.push(command);
        if (command instanceof ListObjectsV2Command) {
          return {
            Contents: [
              {
                Key: 'database/expired.dump',
                LastModified: new Date('2026-10-10T00:00:00.000Z'),
              },
              {
                Key: 'database/recent.dump',
                LastModified: new Date('2026-10-12T00:00:00.000Z'),
              },
            ],
            IsTruncated: false,
          };
        }
        return { Errors: [] };
      }),
    };

    const result = await uploadDatabaseDump({
      client,
      bucket: 'homeish-backups',
      filePath,
      now: new Date('2026-11-10T00:00:00.000Z'),
    });

    expect(commands[0]).toBeInstanceOf(PutObjectCommand);
    expect((commands[0] as PutObjectCommand).input).toMatchObject({
      Bucket: 'homeish-backups',
      Key: 'database/homeish-db-20261110T020000Z.dump',
      ContentLength: Buffer.byteLength('database dump'),
      ContentType: 'application/octet-stream',
    });
    expect(commands[1]).toBeInstanceOf(ListObjectsV2Command);
    expect(commands[2]).toBeInstanceOf(DeleteObjectsCommand);
    expect((commands[2] as DeleteObjectsCommand).input).toMatchObject({
      Bucket: 'homeish-backups',
      Delete: {
        Objects: [{ Key: 'database/expired.dump' }],
        Quiet: true,
      },
    });
    expect(result).toEqual({
      sizeBytes: Buffer.byteLength('database dump'),
      deletedCount: 1,
    });
  });

  it('paginates cleanup and refuses malformed object timestamps', async () => {
    const client = {
      send: vi
        .fn()
        .mockResolvedValueOnce({
          Contents: [
            {
              Key: 'database/expired-one.dump',
              LastModified: new Date('2026-10-01T00:00:00.000Z'),
            },
          ],
          IsTruncated: true,
          NextContinuationToken: 'next-page',
        })
        .mockResolvedValueOnce({ Errors: [] })
        .mockResolvedValueOnce({
          Contents: [
            {
              Key: 'database/expired-two.dump',
              LastModified: new Date('2026-10-02T00:00:00.000Z'),
            },
          ],
          IsTruncated: false,
        })
        .mockResolvedValueOnce({ Errors: [] }),
    };

    await expect(
      pruneExpiredDatabaseBackups({
        client,
        bucket: 'homeish-backups',
        now: new Date('2026-11-10T00:00:00.000Z'),
      }),
    ).resolves.toBe(2);
    expect(client.send).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        input: expect.objectContaining({
          ContinuationToken: 'next-page',
        }),
      }),
    );

    const malformedClient = {
      send: vi.fn().mockResolvedValue({
        Contents: [{ Key: 'database/unknown.dump' }],
        IsTruncated: false,
      }),
    };
    await expect(
      pruneExpiredDatabaseBackups({
        client: malformedClient,
        bucket: 'homeish-backups',
      }),
    ).rejects.toThrow('R2 returned an invalid database backup entry.');
  });
});
