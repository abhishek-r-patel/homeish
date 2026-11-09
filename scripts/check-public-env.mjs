// Reject secret-like environment names exposed through the public prefix.
import { readFile } from 'node:fs/promises';

const example = await readFile('.env.example', 'utf8');
const secretLikeName =
  /^NEXT_PUBLIC_.*(?:SECRET|PRIVATE|SERVICE_ROLE|API_KEY|AUTH_TOKEN|DB_URL|HASH_SALT)/i;
const invalidNames = example
  .split(/\r?\n/)
  .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
  .filter((name) => name && secretLikeName.test(name));

if (invalidNames.length > 0) {
  console.error(
    `Secret-like public environment names found: ${invalidNames.join(', ')}`,
  );
  process.exitCode = 1;
} else {
  console.log('No secret-like public environment names found.');
}
