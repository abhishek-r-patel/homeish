// Verify the required purpose header exists on every authored source file.
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const sourceExtensions = new Set(['.ts', '.tsx', '.css']);
const missingHeaders = [];

async function inspectDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      await inspectDirectory(path);
      continue;
    }

    if (!sourceExtensions.has(extname(entry.name))) {
      continue;
    }

    const [firstLine] = (await readFile(path, 'utf8')).split(/\r?\n/, 1);
    if (!/^\s*(\/\/|\/\*)/.test(firstLine)) {
      missingHeaders.push(path);
    }
  }
}

await inspectDirectory('src');

if (missingHeaders.length > 0) {
  console.error(
    `Missing source purpose headers:\n${missingHeaders.join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log('Source purpose headers are present.');
}
