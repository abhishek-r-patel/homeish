// Run a command with one named environment profile (.env.<profile>.local) loaded first.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const [profile, ...command] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!profile || !/^[a-z0-9-]+$/.test(profile) || command.length === 0) {
  fail(
    'Usage: node scripts/with-env.mjs <profile> <command...>\n' +
      'The profile name uses lowercase letters, digits and hyphens, e.g. testdb.',
  );
}

// Live holds real society data: it is only a source for host secrets, never run locally (AD-14).
if (profile === 'live') {
  fail(
    'The live profile cannot be used from a laptop. Live runs only from CI and the production host (AD-14).',
  );
}

const profileFile = `.env.${profile}.local`;
if (!existsSync(profileFile)) {
  fail(
    `${profileFile} was not found. Copy .env.example to ${profileFile} and fill it in.`,
  );
}

const profileValues = parseEnv(readFileSync(profileFile, 'utf8'));
const expectedNames = Object.keys(
  parseEnv(readFileSync('.env.example', 'utf8')),
);
// A complete profile prevents Next.js silently filling gaps from .env.local.
const missingNames = expectedNames.filter((name) => !(name in profileValues));
if (missingNames.length > 0) {
  fail(`${profileFile} is missing: ${missingNames.join(', ')}`);
}

function quote(argument) {
  return /[\s"]/.test(argument)
    ? `"${argument.replaceAll('"', '\\"')}"`
    : argument;
}

console.log(`Using environment profile: ${profileFile}`);
const child = spawn(command.map(quote).join(' '), {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ...profileValues },
});
child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 1));
});
