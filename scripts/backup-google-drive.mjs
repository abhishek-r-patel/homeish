// Transfer encrypted PostgreSQL dumps through private Google Drive and retain 30 days.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { link, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import {
  decryptDatabaseDump,
  encryptDatabaseDump,
  readBackupKey,
} from './backup-crypto.mjs';

const DRIVE_ORIGIN = 'https://www.googleapis.com';
const FOLDER_MARKER = 'database-folder-v1';
const BACKUP_MARKER = 'database-aes256gcm-v1';
const DUMP_NAME_PATTERN = /^homeish-db-\d{8}T\d{6}Z\.dump$/;
const ARCHIVE_NAME_PATTERN = /^homeish-db-\d{8}T\d{6}Z\.dump\.enc$/;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function requiredEnvironment(name, environment = process.env) {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Missing required backup setting: ${name}.`);
  }
  return value;
}

function requireDriveId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error('Google Drive returned an invalid file or folder ID.');
  }
  return value;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    throw new Error('Google Drive returned an invalid JSON response.', {
      cause: error,
    });
  }
}

async function checkedFetch(fetchImpl, url, options) {
  let response;
  try {
    response = await fetchImpl(url, options);
  } catch (error) {
    throw new Error(
      'Google backup request failed. Check network access and TLS trust.',
      {
        cause: error,
      },
    );
  }
  if (!response.ok) {
    throw new Error(
      `Google backup request failed (HTTP ${response.status}). Check OAuth consent, permissions, quota, and API availability.`,
    );
  }
  return response;
}

export function createDriveClient(
  environment = process.env,
  fetchImpl = fetch,
) {
  const clientId = requiredEnvironment('GOOGLE_DRIVE_CLIENT_ID', environment);
  const clientSecret = requiredEnvironment(
    'GOOGLE_DRIVE_CLIENT_SECRET',
    environment,
  );
  const refreshToken = requiredEnvironment(
    'GOOGLE_DRIVE_REFRESH_TOKEN',
    environment,
  );
  let accessToken;
  let expiresAt = 0;

  return {
    async request(path, { timeoutMs = 60_000, ...options } = {}) {
      const url = new URL(path, DRIVE_ORIGIN);
      if (
        url.origin !== DRIVE_ORIGIN ||
        url.username ||
        url.password ||
        (!url.pathname.startsWith('/drive/v3/') &&
          url.pathname !== '/upload/drive/v3/files')
      ) {
        throw new Error(
          'Refusing to send Google credentials to an unexpected endpoint.',
        );
      }
      if (!accessToken || expiresAt <= Date.now() + 60_000) {
        const response = await checkedFetch(
          fetchImpl,
          'https://oauth2.googleapis.com/token',
          {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.timeout(60_000),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: refreshToken,
              grant_type: 'refresh_token',
            }),
          },
        );
        const token = await readJson(response);
        if (
          typeof token?.access_token !== 'string' ||
          !token.access_token ||
          !Number.isFinite(token.expires_in) ||
          token.expires_in <= 0
        ) {
          throw new Error('Google returned an invalid OAuth token response.');
        }
        accessToken = token.access_token;
        expiresAt = Date.now() + token.expires_in * 1000;
      }
      return checkedFetch(fetchImpl, url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
      });
    },
  };
}

export async function verifyBackupFolder({ client, folderId }) {
  requireDriveId(folderId);
  const query = new URLSearchParams({
    fields:
      'id,mimeType,trashed,shared,ownedByMe,capabilities(canAddChildren),appProperties',
  });
  const folder = await readJson(
    await client.request(`/drive/v3/files/${folderId}?${query}`),
  );
  if (
    folder?.id !== folderId ||
    folder.mimeType !== 'application/vnd.google-apps.folder' ||
    folder.trashed !== false ||
    folder.shared !== false ||
    folder.ownedByMe !== true ||
    folder.capabilities?.canAddChildren !== true ||
    folder.appProperties?.homeishBackup !== FOLDER_MARKER
  ) {
    throw new Error(
      'The backup folder must be private, owned by this account, and created with the approved OAuth app.',
    );
  }
}

export async function pruneExpiredDatabaseBackups({
  client,
  folderId,
  keepFileId,
  now = new Date(),
}) {
  requireDriveId(folderId);
  requireDriveId(keepFileId);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error('The backup retention clock is invalid.');
  }
  const expiredIds = new Set();
  const cursors = new Set();
  let pageToken;
  do {
    const query = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false and appProperties has { key='homeishBackup' and value='${BACKUP_MARKER}' }`,
      fields:
        'nextPageToken,incompleteSearch,files(id,name,mimeType,createdTime,parents,appProperties)',
      spaces: 'drive',
      pageSize: '1000',
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await readJson(
      await client.request(`/drive/v3/files?${query}`),
    );
    if (!Array.isArray(page?.files) || page.incompleteSearch === true) {
      throw new Error(
        'Google Drive returned an incomplete or invalid backup listing.',
      );
    }
    for (const file of page.files) {
      requireDriveId(file?.id);
      if (typeof file.name !== 'string' || !Array.isArray(file.parents)) {
        throw new Error('Google Drive returned an invalid backup entry.');
      }
      if (
        !file.parents.includes(folderId) ||
        file.appProperties?.homeishBackup !== BACKUP_MARKER ||
        file.mimeType !== 'application/octet-stream' ||
        !ARCHIVE_NAME_PATTERN.test(file.name)
      ) {
        continue;
      }
      const createdAt = Date.parse(file.createdTime);
      if (!Number.isFinite(createdAt)) {
        throw new Error('Google Drive returned an invalid backup timestamp.');
      }
      if (createdAt < now.getTime() - RETENTION_MS && file.id !== keepFileId) {
        expiredIds.add(file.id);
      }
    }
    pageToken = page.nextPageToken;
    if (
      pageToken !== undefined &&
      (typeof pageToken !== 'string' || !pageToken || cursors.has(pageToken))
    ) {
      throw new Error(
        'Google Drive returned an invalid backup pagination cursor.',
      );
    }
    if (pageToken) cursors.add(pageToken);
  } while (pageToken);

  for (const id of expiredIds) {
    await client.request(`/drive/v3/files/${id}`, { method: 'DELETE' });
  }
  return expiredIds.size;
}

async function fileMd5(filePath) {
  // Drive's MD5 is a transport checksum; AES-GCM authenticates backup contents.
  const hash = createHash('md5');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

export async function downloadDatabaseDump({
  client,
  folderId,
  archiveName,
  outputPath,
}) {
  if (!ARCHIVE_NAME_PATTERN.test(archiveName)) {
    throw new Error(
      'Database archive filename does not match the backup format.',
    );
  }
  await verifyBackupFolder({ client, folderId });
  const query = new URLSearchParams({
    q: `'${folderId}' in parents and name = '${archiveName}' and trashed = false and appProperties has { key='homeishBackup' and value='${BACKUP_MARKER}' }`,
    fields:
      'nextPageToken,incompleteSearch,files(id,name,mimeType,size,md5Checksum,parents,appProperties,trashed,shared,ownedByMe)',
    spaces: 'drive',
    pageSize: '2',
  });
  const listing = await readJson(
    await client.request(`/drive/v3/files?${query}`),
  );
  if (
    !Array.isArray(listing?.files) ||
    listing.files.length !== 1 ||
    listing.incompleteSearch === true ||
    listing.nextPageToken !== undefined
  ) {
    throw new Error(
      'Expected exactly one complete, app-marked backup matching the archive name.',
    );
  }
  const stored = listing.files[0];
  const fileId = requireDriveId(stored?.id);
  const size = Number(stored?.size);
  if (
    stored.name !== archiveName ||
    stored.mimeType !== 'application/octet-stream' ||
    typeof stored.size !== 'string' ||
    !/^[1-9]\d*$/.test(stored.size) ||
    !Number.isSafeInteger(size) ||
    typeof stored.md5Checksum !== 'string' ||
    !/^[a-f0-9]{32}$/i.test(stored.md5Checksum) ||
    !Array.isArray(stored.parents) ||
    !stored.parents.includes(folderId) ||
    stored.appProperties?.homeishBackup !== BACKUP_MARKER ||
    stored.trashed !== false ||
    stored.shared !== false ||
    stored.ownedByMe !== true
  ) {
    throw new Error('Google Drive returned invalid or unsafe backup metadata.');
  }
  const directory = await mkdtemp(
    join(dirname(resolve(outputPath)), '.homeish-download-'),
  );
  const temporaryPath = join(directory, archiveName);
  try {
    const response = await client.request(
      `/drive/v3/files/${fileId}?alt=media`,
      { timeoutMs: 30 * 60_000 },
    );
    if (!response.body) {
      throw new Error('Google Drive returned an empty backup download.');
    }
    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 }),
    );
    const downloaded = await stat(temporaryPath);
    if (
      downloaded.size !== size ||
      (await fileMd5(temporaryPath)) !== stored.md5Checksum.toLowerCase()
    ) {
      throw new Error(
        'The downloaded backup size or checksum does not match Drive.',
      );
    }
    await link(temporaryPath, outputPath);
    return { fileId, encryptedSizeBytes: downloaded.size };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function uploadDatabaseDump({
  client,
  folderId,
  filePath,
  key,
  pruneExpired = true,
  now = new Date(),
}) {
  const fileName = basename(filePath);
  if (!DUMP_NAME_PATTERN.test(fileName)) {
    throw new Error('Database dump filename does not match the backup format.');
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error('The backup retention clock is invalid.');
  }
  const source = await stat(filePath);
  if (!source.isFile() || source.size === 0) {
    throw new Error('Database dump is missing or empty.');
  }
  await verifyBackupFolder({ client, folderId });
  const directory = await mkdtemp(join(tmpdir(), 'homeish-drive-backup-'));
  const archiveName = `${fileName}.enc`;
  const encryptedPath = join(directory, archiveName);
  try {
    await encryptDatabaseDump({ filePath, outputPath: encryptedPath, key });
    const archive = await stat(encryptedPath);
    const md5 = await fileMd5(encryptedPath);
    const session = await client.request(
      '/upload/drive/v3/files?uploadType=resumable&fields=id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'application/octet-stream',
          'X-Upload-Content-Length': String(archive.size),
        },
        body: JSON.stringify({
          name: archiveName,
          mimeType: 'application/octet-stream',
          parents: [folderId],
          appProperties: { homeishBackup: BACKUP_MARKER },
        }),
      },
    );
    const location = session.headers.get('Location');
    let sessionUrl;
    try {
      sessionUrl = new URL(location);
    } catch (error) {
      throw new Error('Google Drive did not return a valid upload session.', {
        cause: error,
      });
    }
    if (
      sessionUrl.origin !== DRIVE_ORIGIN ||
      sessionUrl.pathname !== '/upload/drive/v3/files' ||
      !sessionUrl.searchParams.get('upload_id')
    ) {
      throw new Error(
        'Google Drive returned an unexpected upload session endpoint.',
      );
    }
    const body = createReadStream(encryptedPath);
    let uploaded;
    try {
      uploaded = await readJson(
        await client.request(sessionUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(archive.size),
          },
          body,
          duplex: 'half',
          timeoutMs: 30 * 60_000,
        }),
      );
    } finally {
      body.destroy();
    }
    const fileId = requireDriveId(uploaded?.id);
    const query = new URLSearchParams({
      fields: 'id,name,size,md5Checksum,parents,appProperties,trashed,shared',
    });
    const stored = await readJson(
      await client.request(`/drive/v3/files/${fileId}?${query}`),
    );
    if (
      stored?.id !== fileId ||
      stored.name !== archiveName ||
      stored.size !== String(archive.size) ||
      stored.md5Checksum !== md5 ||
      !Array.isArray(stored.parents) ||
      !stored.parents.includes(folderId) ||
      stored.appProperties?.homeishBackup !== BACKUP_MARKER ||
      stored.trashed !== false ||
      stored.shared !== false
    ) {
      throw new Error(
        'Google Drive backup verification failed; existing backups were not pruned.',
      );
    }
    const deletedCount = pruneExpired
      ? await pruneExpiredDatabaseBackups({
          client,
          folderId,
          keepFileId: fileId,
          now,
        })
      : 0;
    return {
      fileId,
      sizeBytes: source.size,
      encryptedSizeBytes: archive.size,
      deletedCount,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main(args) {
  if (args.length === 3 && args[0] === 'download-database') {
    const result = await downloadDatabaseDump({
      client: createDriveClient(),
      folderId: requiredEnvironment('GOOGLE_DRIVE_FOLDER_ID'),
      archiveName: args[1],
      outputPath: args[2],
    });
    console.info(
      `Verified encrypted database download ${args[1]} (${result.encryptedSizeBytes} bytes).`,
    );
    return;
  }
  if (args.length === 3 && args[0] === 'decrypt-database') {
    const key = readBackupKey();
    await decryptDatabaseDump({ filePath: args[1], outputPath: args[2], key });
    console.info(
      'Authenticated and decrypted the database backup. Verify it with PostgreSQL 17 before restoring.',
    );
    return;
  }
  if (
    (args.length !== 1 || args[0] !== 'check') &&
    (args.length !== 2 || args[0] !== 'upload-database') &&
    !(
      args.length === 3 &&
      args[0] === 'upload-database' &&
      args[2] === '--skip-prune'
    )
  ) {
    throw new Error(
      'Usage: node scripts/backup-google-drive.mjs check | upload-database <dump-file> [--skip-prune] | download-database <archive-name> <new-output-file> | decrypt-database <archive> <new-output-file>',
    );
  }
  const key = readBackupKey();
  const client = createDriveClient();
  const folderId = requiredEnvironment('GOOGLE_DRIVE_FOLDER_ID');
  if (args[0] === 'check') {
    await verifyBackupFolder({ client, folderId });
    console.info(
      'Google Drive OAuth and private backup folder access verified.',
    );
    return;
  }
  const result = await uploadDatabaseDump({
    client,
    folderId,
    filePath: args[1],
    key,
    pruneExpired: args[2] !== '--skip-prune',
  });
  const retention =
    args[2] === '--skip-prune'
      ? 'retention pruning skipped'
      : `permanently removed ${result.deletedCount} expired backup(s)`;
  console.info(
    `Verified encrypted database backup ${result.fileId} (${result.encryptedSizeBytes} bytes); ${retention}.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Google Drive backup failed.',
    );
    process.exitCode = 1;
  });
}
