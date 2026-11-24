// Client-safe P56 CSV types, templates and bounds shared with the server parser.
export const MAX_BULK_IMPORT_BYTES = 512 * 1024;
export const MAX_BULK_IMPORT_ROWS = 2000;

export const BULK_IMPORT_KINDS = [
  'units',
  'residents',
  'opening_dues',
  'vehicles',
  'staff',
  'assets',
] as const;
export type BulkImportKind = (typeof BULK_IMPORT_KINDS)[number];

export type BulkImportIssue = {
  rowNumber: number;
  field: string;
  message: string;
};

export type BulkImportRow = Record<string, string | number | boolean | null>;

export type BulkImportPreview = {
  rows: BulkImportRow[];
  issues: BulkImportIssue[];
};

export type BulkImportContext = {
  blocks: readonly { id: string; name: string }[];
  units: readonly { id: string; block_id: string | null; number: string }[];
  residents: readonly {
    membership_id: string;
    email: string;
    unit_id: string;
  }[];
  assetCategories: readonly { id: string; name: string }[];
  existingResidentEmails: readonly string[];
  existingVehicleRegistrations: readonly string[];
  existingDomesticStaffPhones: readonly string[];
};

export const BULK_IMPORT_TEMPLATES: Readonly<Record<BulkImportKind, string>> = {
  units: 'block,number,floor,unit_type,area_sqft\nA,101,1,flat,900\n',
  residents:
    'block,unit,email,relationship,primary,approver\nA,101,resident@example.com,owner,yes,yes\n',
  opening_dues:
    'block,unit,as_on,due_date,amount\nA,101,2026-11-24,2026-12-10,2500.00\n',
  vehicles:
    'block,unit,email,vehicle_type,registration_number,tag_number\nA,101,resident@example.com,car,KA01AB1234,A-101-1\n',
  staff:
    'staff_type,block,unit,full_name,phone,job_role,police_verified,id_type,id_last_four\n' +
    'domestic,A,101,Sample Helper,+919876543210,Helper,yes,,\n',
  assets:
    'category,name,location,make,model,serial_number,purchase_date,purchase_cost,supplier,warranty_end_date,status,notes\n' +
    'Lifts,Lift A1,Tower A lobby,Sample Make,Model 1,SN-001,2026-01-01,250000.00,Sample Supplier,2028-01-01,active,Installed by the society\n',
};
