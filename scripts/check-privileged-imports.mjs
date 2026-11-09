// Keep Supabase service-role access inside the privileged core boundary.
import { readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

const sourceRoot = join(process.cwd(), 'src');
const privilegedRoot = join(sourceRoot, 'core', 'privileged');
const allowedConfig = join(sourceRoot, 'core', 'config', 'env-schema.ts');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const clientImport =
  /(?:from\s*|import\s*\()\s*['"][^'"]*(?:core\/privileged\/server-client|privileged\/server-client)['"]/;

function isWithin(directory, path) {
  const rel = relative(directory, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')))
      ? [path]
      : [];
  });
}

const violations = [];
for (const path of sourceFiles(sourceRoot)) {
  if (isWithin(privilegedRoot, path) || path === allowedConfig) {
    continue;
  }
  const source = readFileSync(path, 'utf8');
  if (
    source.includes('SUPABASE_SERVICE_ROLE_KEY') ||
    source.includes('privilegedClient') ||
    clientImport.test(source)
  ) {
    violations.push(relative(process.cwd(), path));
  }
}

if (violations.length > 0) {
  console.error(
    `Service-role access is restricted to src/core/privileged/:\n${violations.join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log('Service-role access stays inside the privileged core boundary.');
}
