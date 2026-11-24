import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: vi.fn(),
}));

import {
  MAX_BULK_IMPORT_ROWS,
  parseBulkImport,
  type BulkImportContext,
} from '../../src/core/csv/bulk-import';

const context: BulkImportContext = {
  blocks: [{ id: '10000000-0000-4000-8000-000000000001', name: 'A' }],
  units: [
    {
      id: '20000000-0000-4000-8000-000000000001',
      block_id: '10000000-0000-4000-8000-000000000001',
      number: '101',
    },
  ],
  residents: [
    {
      membership_id: '30000000-0000-4000-8000-000000000001',
      email: 'resident@example.test',
      unit_id: '20000000-0000-4000-8000-000000000001',
    },
  ],
  assetCategories: [
    { id: '40000000-0000-4000-8000-000000000001', name: 'Lifts' },
  ],
  existingResidentEmails: ['resident@example.test'],
  existingVehicleRegistrations: [],
  existingDomesticStaffPhones: [],
};

describe('P56 bulk CSV validation', () => {
  it('normalizes all six approved lists without writing anything', () => {
    const cases = [
      [
        'units',
        'block,number,floor,unit_type,area_sqft\nA,102,1,flat,900\n',
        'number',
        '102',
      ],
      [
        'residents',
        'block,unit,email,relationship,primary,approver\nA,101,new@example.test,owner,yes,yes\n',
        'email',
        'new@example.test',
      ],
      [
        'opening_dues',
        'block,unit,as_on,due_date,amount\nA,101,2026-11-24,2026-12-10,2500.00\n',
        'amountPaise',
        250000,
      ],
      [
        'vehicles',
        'block,unit,email,vehicle_type,registration_number,tag_number\nA,101,resident@example.test,car,KA 01 AB 1234,A-101-1\n',
        'registrationNumber',
        'KA01AB1234',
      ],
      [
        'staff',
        'staff_type,block,unit,full_name,phone,job_role,police_verified,id_type,id_last_four\n' +
          'domestic,A,101,Sample Helper,+919876543210,Helper,yes,aadhaar,1234\n',
        'unitId',
        context.units[0]!.id,
      ],
      [
        'assets',
        'category,name,location,make,model,serial_number,purchase_date,purchase_cost,supplier,warranty_end_date,status,notes\n' +
          'Lifts,Lift A1,Tower A lobby,Sample,Model 1,SN-1,2026-01-01,250000.00,Supplier,2028-01-01,active,Imported\n',
        'purchaseCostPaise',
        25000000,
      ],
    ] as const;

    for (const [kind, csv, field, value] of cases) {
      const preview = parseBulkImport(kind, csv, context);
      expect(preview.issues).toEqual([]);
      expect(preview.rows).toHaveLength(1);
      expect(preview.rows[0]?.[field]).toBe(value);
    }
  });

  it('names row and column errors and rejects duplicate vehicles', () => {
    const preview = parseBulkImport(
      'vehicles',
      'block,unit,email,vehicle_type,registration_number,tag_number\n' +
        'A,101,resident@example.test,car,KA01AB1234,\n' +
        'A,101,resident@example.test,car,KA01AB1234,\n',
      context,
    );
    expect(preview.rows).toHaveLength(1);
    expect(preview.issues).toContainEqual({
      rowNumber: 3,
      field: 'registration_number',
      message: 'This registration appears more than once in the file.',
    });
  });

  it('refuses imports above the 2,000-row limit before validation', () => {
    const dataRows = Array.from(
      { length: MAX_BULK_IMPORT_ROWS + 1 },
      () => 'society,A,101,Sample Helper,+919876543210,Helper,yes,,',
    ).join('\n');
    const preview = parseBulkImport(
      'staff',
      'staff_type,block,unit,full_name,phone,job_role,police_verified,id_type,id_last_four\n' +
        dataRows,
      context,
    );
    expect(preview.rows).toEqual([]);
    expect(preview.issues[0]?.message).toContain('2000');
  });

  it('rejects opening dues with a due date before the as-on date', () => {
    const preview = parseBulkImport(
      'opening_dues',
      'block,unit,as_on,due_date,amount\nA,101,2026-11-24,2026-11-23,2500\n',
      context,
    );
    expect(preview.rows).toEqual([]);
    expect(preview.issues).toContainEqual(
      expect.objectContaining({
        rowNumber: 2,
        field: 'due_date',
      }),
    );
  });
});
