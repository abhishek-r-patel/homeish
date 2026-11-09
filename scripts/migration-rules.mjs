// Shared migration naming rule: YYYYMMDDHHMMSS_<module>_<short_description>.sql (DATABASE 14.1).
export const MODULE_KEYS = [
  'core',
  'visitor',
  'delivery',
  'billing',
  'service_request',
  'staff',
  'housekeeping',
  'amc',
  'notice',
  'amenity',
];

const modulePattern = MODULE_KEYS.join('|');
const labelPattern = new RegExp(`^(${modulePattern})_[a-z0-9]+(_[a-z0-9]+)*$`);
const filePattern = new RegExp(
  `^\\d{14}_(${modulePattern})_[a-z0-9]+(_[a-z0-9]+)*\\.sql$`,
);

export const NAMING_HELP =
  'Migration names are <module>_<short_description> in lowercase snake_case, ' +
  `where <module> is one of: ${MODULE_KEYS.join(', ')}.`;

export function isValidMigrationLabel(label) {
  return labelPattern.test(label);
}

export function isValidMigrationFileName(fileName) {
  return filePattern.test(fileName);
}
