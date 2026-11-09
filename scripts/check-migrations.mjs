// Verify every migration file follows the naming rule so ordering and ownership stay clear.
import { existsSync, readdirSync } from 'node:fs';
import { isValidMigrationFileName, NAMING_HELP } from './migration-rules.mjs';

const directory = 'supabase/migrations';
const entries = existsSync(directory) ? readdirSync(directory) : [];
const invalid = entries.filter(
  (name) => name !== '.gitkeep' && !isValidMigrationFileName(name),
);

if (invalid.length > 0) {
  console.error(
    `Badly named files in ${directory}:\n${invalid.join('\n')}\n` +
      `Expected YYYYMMDDHHMMSS_<module>_<short_description>.sql. ${NAMING_HELP}`,
  );
  process.exitCode = 1;
} else {
  console.log('Migration file names follow the naming rule.');
}
