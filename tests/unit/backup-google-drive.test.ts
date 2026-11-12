// Verify OAuth, encrypted uploads, strict retention boundaries, and recoverable archives.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decryptDatabaseDump,
  encryptDatabaseDump,
  readBackupKey,
} from '../../scripts/backup-crypto.mjs';
import {
  createDriveClient,
  pruneExpiredDatabaseBackups,
  uploadDatabaseDump,
  verifyBackupFolder,
} from '../../scripts/backup-google-drive.mjs';

const KEY = Buffer.from('ab'.repeat(32), 'hex');
const FOLDER_ID = 'folder-1';
const FILE_ID = 'backup-new';
const NAME = 'homeish-db-20261112T020000Z.dump';
const NOW = new Date('2026-11-12T00:00:00.000Z');
const SESSION =
  'https://www.googleapis.com/upload/drive/v3/files?upload_id=session-1';
const ENVIRONMENT: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  GOOGLE_DRIVE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
  GOOGLE_DRIVE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_DRIVE_REFRESH_TOKEN: 'test-refresh-token',
};
const directories: string[] = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'homeish-drive-test-'));
  directories.push(directory);
  return directory;
}

function folder() {
  return {
    id: FOLDER_ID,
    mimeType: 'application/vnd.google-apps.folder',
    trashed: false,
    shared: false,
    ownedByMe: true,
    capabilities: { canAddChildren: true },
    appProperties: { homeishBackup: 'database-folder-v1' },
  };
}

function backup(id: string, createdTime: string) {
  return {
    id,
    name: `${NAME}.enc`,
    createdTime,
    mimeType: 'application/octet-stream',
    parents: [FOLDER_ID],
    appProperties: { homeishBackup: 'database-aes256gcm-v1' },
  };
}

function mockUpload({
  uploadStatus = 200,
  corruptChecksum = false,
  sessionUrl = SESSION,
  storedOverrides = {},
} = {}) {
  let archive = Buffer.alloc(0);
  let archivePath = '';
  const fetchMock = vi.fn<typeof fetch>(async (input, options) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.hostname === 'oauth2.googleapis.com') {
      return Response.json({
        access_token: 'test-access-token',
        expires_in: 3600,
      });
    }
    if (
      options?.method === 'POST' &&
      url.pathname === '/upload/drive/v3/files'
    ) {
      expect(typeof options.body).toBe('string');
      if (typeof options.body !== 'string')
        throw new Error('Missing metadata.');
      expect(JSON.parse(options.body)).toEqual({
        name: `${NAME}.enc`,
        mimeType: 'application/octet-stream',
        parents: [FOLDER_ID],
        appProperties: { homeishBackup: 'database-aes256gcm-v1' },
      });
      return new Response(null, { headers: { Location: sessionUrl } });
    }
    if (options?.method === 'PUT') {
      if (!(options.body instanceof Readable))
        throw new Error('Expected an encrypted file stream.');
      if (!('path' in options.body) || typeof options.body.path !== 'string')
        throw new Error('Expected a temporary encrypted file.');
      archivePath = options.body.path;
      const chunks: Buffer[] = [];
      for await (const chunk of options.body) {
        if (!Buffer.isBuffer(chunk))
          throw new Error('Expected binary backup data.');
        chunks.push(chunk);
      }
      archive = Buffer.concat(chunks);
      expect(options.headers).toMatchObject({
        'Content-Length': String(archive.length),
      });
      return Response.json({ id: FILE_ID }, { status: uploadStatus });
    }
    if (url.pathname === `/drive/v3/files/${FOLDER_ID}`)
      return Response.json(folder());
    if (url.pathname === `/drive/v3/files/${FILE_ID}`) {
      return Response.json({
        ...backup(FILE_ID, NOW.toISOString()),
        size: String(archive.length),
        md5Checksum: corruptChecksum
          ? 'invalid'
          : createHash('md5').update(archive).digest('hex'),
        trashed: false,
        shared: false,
        ...storedOverrides,
      });
    }
    if (url.pathname === '/drive/v3/files') return Response.json({ files: [] });
    throw new Error('Unexpected Google API request.');
  });
  return {
    fetchMock,
    getArchive: () => archive,
    getArchivePath: () => archivePath,
  };
}

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('database backup encryption', () => {
  it('requires a 32-byte hexadecimal recovery key', () => {
    expect(
      readBackupKey({
        ...ENVIRONMENT,
        BACKUP_ENCRYPTION_KEY: KEY.toString('hex'),
      }),
    ).toEqual(KEY);
    for (const value of ['', 'password', 'ab'.repeat(31), 'zz'.repeat(32)]) {
      expect(() =>
        readBackupKey({ ...ENVIRONMENT, BACKUP_ENCRYPTION_KEY: value }),
      ).toThrow('64 hexadecimal characters');
    }
  });

  it('round-trips binary dumps with unique IVs and refuses overwrite', async () => {
    const directory = await temporaryDirectory();
    const filePath = join(directory, NAME);
    const archive = join(directory, `${NAME}.enc`);
    const secondArchive = join(directory, 'second.enc');
    const outputPath = join(directory, 'restored.dump');
    const contents = Buffer.alloc(1024 * 1024, 0x7f);
    await writeFile(filePath, contents);
    await encryptDatabaseDump({ filePath, outputPath: archive, key: KEY });
    await encryptDatabaseDump({
      filePath,
      outputPath: secondArchive,
      key: KEY,
    });
    expect(await readFile(archive)).not.toEqual(await readFile(secondArchive));
    await decryptDatabaseDump({ filePath: archive, outputPath, key: KEY });
    expect(await readFile(outputPath)).toEqual(contents);
    await expect(
      decryptDatabaseDump({ filePath: archive, outputPath, key: KEY }),
    ).rejects.toThrow('unused output path');
    expect(await readFile(outputPath)).toEqual(contents);
    await expect(
      encryptDatabaseDump({ filePath, outputPath: archive, key: KEY }),
    ).rejects.toThrow();
  });

  it.each(['wrong-key', 'tampered-content', 'tampered-header', 'truncated'])(
    'does not publish plaintext for %s',
    async (failure) => {
      const directory = await temporaryDirectory();
      const filePath = join(directory, NAME);
      const archive = join(directory, `${NAME}.enc`);
      const outputPath = join(directory, 'restored.dump');
      await writeFile(filePath, 'private database contents');
      await encryptDatabaseDump({ filePath, outputPath: archive, key: KEY });
      const contents = await readFile(archive);
      if (failure === 'tampered-content') {
        contents[contents.length - 17] ^= 1;
        await writeFile(archive, contents);
      } else if (failure === 'tampered-header') {
        contents[0] ^= 1;
        await writeFile(archive, contents);
      } else if (failure === 'truncated') {
        await writeFile(archive, contents.subarray(0, 10));
      }
      await expect(
        decryptDatabaseDump({
          filePath: archive,
          outputPath,
          key: failure === 'wrong-key' ? Buffer.alloc(32) : KEY,
        }),
      ).rejects.toThrow();
      await expect(access(outputPath)).rejects.toThrow();
      expect(
        (await readdir(directory)).filter((name) =>
          name.startsWith('.homeish-restore-'),
        ),
      ).toEqual([]);
    },
  );
});

describe('Google Drive OAuth and folder access', () => {
  it('refreshes OAuth offline, caches access tokens, and renews them before expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fetchMock = vi.fn<typeof fetch>(async (url, options) => {
      if (String(url).startsWith('https://oauth2.googleapis.com/')) {
        expect(options?.body).toBeInstanceOf(URLSearchParams);
        expect(String(options?.body)).toContain('grant_type=refresh_token');
        return Response.json({
          access_token: 'test-access-token',
          expires_in: 3600,
        });
      }
      expect(options?.headers).toMatchObject({
        Authorization: 'Bearer test-access-token',
      });
      expect(options?.redirect).toBe('error');
      return Response.json(folder());
    });
    const client = createDriveClient(ENVIRONMENT, fetchMock);
    await verifyBackupFolder({ client, folderId: FOLDER_ID });
    await verifyBackupFolder({ client, folderId: FOLDER_ID });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.setSystemTime(new Date(NOW.getTime() + 3600 * 1000));
    await verifyBackupFolder({ client, folderId: FOLDER_ID });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('rejects missing credentials, unexpected hosts, and malformed OAuth replies', async () => {
    expect(() => createDriveClient({ NODE_ENV: 'test' })).toThrow(
      'GOOGLE_DRIVE_CLIENT_ID',
    );
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({}));
    const client = createDriveClient(ENVIRONMENT, fetchMock);
    await expect(
      client.request('https://example.test/drive/v3/files'),
    ).rejects.toThrow('unexpected endpoint');
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(client.request('/drive/v3/files')).rejects.toThrow(
      'invalid OAuth token response',
    );
  });

  it('reports OAuth failures without echoing provider bodies or secrets', async () => {
    const client = createDriveClient(
      ENVIRONMENT,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { error: 'invalid_grant', detail: 'secret-provider-detail' },
            { status: 400 },
          ),
        ),
    );
    await expect(client.request('/drive/v3/files')).rejects.toThrow('HTTP 400');
    await expect(client.request('/drive/v3/files')).rejects.not.toThrow(
      'secret-provider-detail',
    );
  });

  it.each([
    { shared: true },
    { trashed: true },
    { ownedByMe: false },
    { capabilities: { canAddChildren: false } },
    { appProperties: {} },
  ])('refuses unsafe or app-inaccessible folders: %j', async (changes) => {
    const client = {
      request: vi
        .fn()
        .mockResolvedValue(Response.json({ ...folder(), ...changes })),
    };
    await expect(
      verifyBackupFolder({ client, folderId: FOLDER_ID }),
    ).rejects.toThrow('must be private');
  });
});

describe('encrypted Drive database uploads', () => {
  it('uploads ciphertext, verifies remote size/hash, and then lists retention candidates', async () => {
    const directory = await temporaryDirectory();
    const filePath = join(directory, NAME);
    await writeFile(filePath, 'private database contents');
    const { fetchMock, getArchive, getArchivePath } = mockUpload();
    const result = await uploadDatabaseDump({
      client: createDriveClient(ENVIRONMENT, fetchMock),
      folderId: FOLDER_ID,
      filePath,
      key: KEY,
      now: NOW,
    });
    expect(result).toMatchObject({
      fileId: FILE_ID,
      deletedCount: 0,
      sizeBytes: 25,
    });
    expect(
      getArchive().includes(Buffer.from('private database contents')),
    ).toBe(false);
    await expect(access(getArchivePath())).rejects.toThrow();
    const downloaded = join(directory, 'downloaded.enc');
    const restored = join(directory, 'restored.dump');
    await writeFile(downloaded, getArchive());
    await decryptDatabaseDump({
      filePath: downloaded,
      outputPath: restored,
      key: KEY,
    });
    expect(await readFile(restored, 'utf8')).toBe('private database contents');
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.at(-2)).toContain(`/files/${FILE_ID}?`);
    expect(urls.at(-1)).toContain('/drive/v3/files?');
  });

  it.each([
    { uploadStatus: 503 },
    { corruptChecksum: true },
    { sessionUrl: 'https://example.test/upload?upload_id=1' },
    { sessionUrl: '' },
    { storedOverrides: { size: '1' } },
    { storedOverrides: { parents: ['elsewhere'] } },
    { storedOverrides: { shared: true } },
  ])(
    'never prunes after an upload or verification failure: %j',
    async (failure) => {
      const directory = await temporaryDirectory();
      const filePath = join(directory, NAME);
      await writeFile(filePath, 'database dump');
      const { fetchMock } = mockUpload(failure);
      await expect(
        uploadDatabaseDump({
          client: createDriveClient(ENVIRONMENT, fetchMock),
          folderId: FOLDER_ID,
          filePath,
          key: KEY,
          now: NOW,
        }),
      ).rejects.toThrow();
      expect(
        fetchMock.mock.calls.some(
          ([url]) => new URL(String(url)).pathname === '/drive/v3/files',
        ),
      ).toBe(false);
      expect(
        fetchMock.mock.calls.some(
          ([, options]) => options?.method === 'DELETE',
        ),
      ).toBe(false);
    },
  );

  it('refuses empty or misnamed input before contacting Google', async () => {
    const directory = await temporaryDirectory();
    const filePath = join(directory, NAME);
    await writeFile(filePath, '');
    const client = { request: vi.fn() };
    await expect(
      uploadDatabaseDump({ client, folderId: FOLDER_ID, filePath, key: KEY }),
    ).rejects.toThrow('empty');
    await expect(
      uploadDatabaseDump({
        client,
        folderId: FOLDER_ID,
        filePath: join(directory, 'other.dump'),
        key: KEY,
      }),
    ).rejects.toThrow('filename');
    expect(client.request).not.toHaveBeenCalled();
  });
});

describe('30-day Drive retention', () => {
  it('paginates completely before deletion and keeps boundary, newest, and unrelated files', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          files: [
            backup('expired', '2026-10-12T23:59:59.999Z'),
            backup('boundary', '2026-10-13T00:00:00.000Z'),
            backup(FILE_ID, '2026-10-01T00:00:00.000Z'),
            {
              ...backup('unrelated', '2026-10-01T00:00:00.000Z'),
              name: 'other.enc',
            },
            {
              ...backup('other-folder', '2026-10-01T00:00:00.000Z'),
              parents: ['elsewhere'],
            },
            {
              ...backup('unmarked', '2026-10-01T00:00:00.000Z'),
              appProperties: {},
            },
          ],
          nextPageToken: 'page-2',
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ files: [backup('recent', NOW.toISOString())] }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(
      pruneExpiredDatabaseBackups({
        client: { request },
        folderId: FOLDER_ID,
        keepFileId: FILE_ID,
        now: NOW,
      }),
    ).resolves.toBe(1);
    expect(String(request.mock.calls[1][0])).toContain('pageToken=page-2');
    expect(request).toHaveBeenNthCalledWith(3, '/drive/v3/files/expired', {
      method: 'DELETE',
    });
  });

  it.each([
    { files: [backup('bad-date', 'not-a-date')] },
    { files: [], incompleteSearch: true },
    { files: [], nextPageToken: 'repeat' },
    { nextPageToken: 'missing-files' },
  ])(
    'fails closed on malformed or incomplete later pages: %j',
    async (page) => {
      const request = vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            files: [backup('expired', '2026-10-01T00:00:00.000Z')],
            nextPageToken: 'repeat',
          }),
        )
        .mockResolvedValueOnce(Response.json(page));
      await expect(
        pruneExpiredDatabaseBackups({
          client: { request },
          folderId: FOLDER_ID,
          keepFileId: FILE_ID,
          now: NOW,
        }),
      ).rejects.toThrow();
      expect(
        request.mock.calls.some(([, options]) => options?.method === 'DELETE'),
      ).toBe(false);
    },
  );

  it('surfaces deletion failures rather than reporting successful pruning', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ files: [backup('expired', '2026-10-01T00:00:00Z')] }),
      )
      .mockRejectedValueOnce(new Error('Delete failed.'));
    await expect(
      pruneExpiredDatabaseBackups({
        client: { request },
        folderId: FOLDER_ID,
        keepFileId: FILE_ID,
        now: NOW,
      }),
    ).rejects.toThrow('Delete failed.');
  });
});

it('keeps scheduled backups opt-in on main, validates dumps, and cleans plaintext', () => {
  const workflow = readFileSync(
    new URL('../../.github/workflows/offsite-backup.yml', import.meta.url),
    'utf8',
  );
  expect(workflow).toContain(
    "github.ref == 'refs/heads/main' && vars.GOOGLE_DRIVE_BACKUPS_ENABLED == 'true'",
  );
  expect(workflow).toContain('npm run backup:drive:check');
  expect(workflow).toContain('npm run backup:drive:database');
  expect(workflow).toContain('pg_restore --list');
  expect(workflow).toContain('if: always()');
  expect(workflow).toContain('rm -f -- "$DATABASE_DUMP"');
  expect(workflow).not.toContain('R2_');
  expect(workflow).not.toContain('upload-artifact');
});
