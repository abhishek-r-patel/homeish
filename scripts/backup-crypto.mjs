// Encrypt database archives and authenticate them before publishing restored plaintext.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  appendFile,
  link,
  mkdtemp,
  open,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('HOMEISH-DB-V1\n', 'ascii');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + IV_LENGTH;

export function readBackupKey(environment = process.env) {
  const value = environment.BACKUP_ENCRYPTION_KEY?.trim() ?? '';
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY must contain 64 hexadecimal characters.',
    );
  }
  return Buffer.from(value, 'hex');
}

function requireKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error('The backup encryption key must contain 32 bytes.');
  }
}

export async function encryptDatabaseDump({ filePath, outputPath, key }) {
  requireKey(key);
  const source = await stat(filePath);
  if (!source.isFile() || source.size === 0) {
    throw new Error('Database dump is missing or empty.');
  }
  const iv = randomBytes(IV_LENGTH);
  const header = Buffer.concat([MAGIC, iv]);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(header);
  await writeFile(outputPath, header, { flag: 'wx', mode: 0o600 });
  try {
    await pipeline(
      createReadStream(filePath),
      cipher,
      createWriteStream(outputPath, { flags: 'a', mode: 0o600 }),
    );
    await appendFile(outputPath, cipher.getAuthTag());
  } catch (error) {
    await rm(outputPath, { force: true });
    throw new Error('Could not encrypt the database dump.', { cause: error });
  }
}

export async function decryptDatabaseDump({ filePath, outputPath, key }) {
  requireKey(key);
  const input = await open(filePath, 'r');
  try {
    const source = await input.stat();
    if (!source.isFile() || source.size <= HEADER_LENGTH + TAG_LENGTH) {
      throw new Error('The encrypted database backup is empty or truncated.');
    }
    const header = Buffer.alloc(HEADER_LENGTH);
    const tag = Buffer.alloc(TAG_LENGTH);
    const headerRead = await input.read(header, 0, header.length, 0);
    const tagRead = await input.read(
      tag,
      0,
      tag.length,
      source.size - TAG_LENGTH,
    );
    if (
      headerRead.bytesRead !== header.length ||
      tagRead.bytesRead !== tag.length ||
      !header.subarray(0, MAGIC.length).equals(MAGIC)
    ) {
      throw new Error('The database backup format is not supported.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      header.subarray(MAGIC.length),
    );
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    const directory = await mkdtemp(
      join(dirname(resolve(outputPath)), '.homeish-restore-'),
    );
    const temporaryPath = join(directory, 'verified.dump');
    try {
      await pipeline(
        input.createReadStream({
          start: HEADER_LENGTH,
          end: source.size - TAG_LENGTH - 1,
          autoClose: false,
        }),
        decipher,
        createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 }),
      );
      // Publish only authenticated plaintext, without overwriting an existing file.
      await link(temporaryPath, outputPath);
    } catch (error) {
      throw new Error(
        'Could not decrypt the backup. Check the recovery key, archive integrity, and unused output path.',
        { cause: error },
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  } finally {
    await input.close();
  }
}
