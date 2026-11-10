// Verify unit CSV parsing and row-level validation without database writes.
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: vi.fn(),
}));

import {
  MAX_UNIT_CSV_ROWS,
  parseUnitsCsv,
} from '../../src/core/structure/units-csv';

const blocks = [
  { id: '54d0e717-6bcf-47f9-bcb6-26ce66eef2dc', name: 'North, East' },
];

describe('parseUnitsCsv', () => {
  it('supports quoted commas and empty optional values', () => {
    const result = parseUnitsCsv(
      'block,number,floor,unit_type,area_sqft\r\n"North, East",101,,2BHK,850.50\r\n',
      blocks,
      [],
    );

    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        blockName: 'North, East',
        number: '101',
        floor: null,
        unitType: '2BHK',
        areaSqft: 850.5,
      },
    ]);
  });

  it('reports existing and repeated unit numbers with source row numbers', () => {
    const result = parseUnitsCsv(
      [
        'block,number,floor,unit_type,area_sqft',
        '"North, East",101,,,',
        '"North, East",102,,,',
        '"North, East",102,,,',
      ].join('\n'),
      blocks,
      [{ block_id: blocks[0]?.id ?? null, number: '101' }],
    );

    expect(result.issues).toEqual([
      {
        rowNumber: 2,
        field: 'number',
        message: 'Unit number already exists in this block.',
      },
      {
        rowNumber: 4,
        field: 'number',
        message: 'Unit number already exists in this block.',
      },
    ]);
  });

  it('rejects malformed, oversized and over-row-limit imports', () => {
    expect(
      parseUnitsCsv('block,number,"unclosed', blocks, []).issues[0]?.field,
    ).toBe('file');
    const rows = Array.from(
      { length: MAX_UNIT_CSV_ROWS + 1 },
      (_, index) => `,${index + 1},,,`,
    );
    const overLimit = parseUnitsCsv(
      ['block,number,floor,unit_type,area_sqft', ...rows].join('\n'),
      blocks,
      [],
    );
    expect(overLimit.issues[0]?.message).toContain(
      `no more than ${MAX_UNIT_CSV_ROWS}`,
    );
    expect(
      parseUnitsCsv('x'.repeat(512 * 1024 + 1), blocks, []).issues[0]?.field,
    ).toBe('file');
  });
});
