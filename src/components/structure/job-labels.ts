// Fixed labels for operational job types; stored identifiers remain unchanged.
export const JOB_TYPE_LABELS: Readonly<Record<string, string>> = {
  bill_generation: 'Bill generation',
  bill_email: 'Bill email',
  csv_import_units: 'Unit CSV import',
  csv_import_residents: 'Resident CSV import',
  export: 'Export',
};
