// Verify resident import preview validation without database writes.
import { describe, expect, it } from 'vitest';
import {
  MAX_RESIDENT_CSV_ROWS,
  parseResidentsCsv,
} from '../../src/core/members/residents-csv';

const blocks = [{ id: 'block-1', name: 'North, East' }];
const units = [
  { id: 'unit-1', number: '101', block_id: 'block-1' },
  { id: 'unit-2', number: '102', block_id: null },
];

describe('parseResidentsCsv', () => {
  it('accepts quoted block names and defaults approver for owner and tenant', () => {
    const result = parseResidentsCsv(
      [
        'block,unit,email,relationship,primary,approver',
        '"North, East",101,owner@example.test,owner,yes,',
        ',102,family@example.test,family,no,',
      ].join('\r\n'),
      units,
      blocks,
      [],
    );

    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        email: 'owner@example.test',
        unitId: 'unit-1',
        relationship: 'owner',
        isPrimary: true,
        isApprover: true,
      },
      {
        rowNumber: 3,
        email: 'family@example.test',
        unitId: 'unit-2',
        relationship: 'family',
        isPrimary: false,
        isApprover: false,
      },
    ]);
  });

  it('reports duplicate emails, invalid relationships and ambiguous units by row', () => {
    const result = parseResidentsCsv(
      [
        'block,unit,email,relationship,primary,approver',
        '"North, East",101,same@example.test,owner,no,yes',
        '"North, East",101,SAME@example.test,family,no,no',
        ',102,other@example.test,unknown,yes,no',
      ].join('\n'),
      units,
      blocks,
      ['existing@example.test'],
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 3,
          field: 'email',
        }),
        expect.objectContaining({
          rowNumber: 4,
          field: 'relationship',
        }),
      ]),
    );
    expect(result.rows).toHaveLength(1);
  });

  it('rejects malformed, oversized and over-row-limit imports', () => {
    expect(
      parseResidentsCsv(
        'block,unit,email,relationship,primary,approver\n"unclosed',
        units,
        blocks,
        [],
      ).issues[0]?.field,
    ).toBe('file');
    const rows = Array.from(
      { length: MAX_RESIDENT_CSV_ROWS + 1 },
      (_, index) => `,102,resident${index}@example.test,tenant,no,yes`,
    );
    expect(
      parseResidentsCsv(
        ['block,unit,email,relationship,primary,approver', ...rows].join('\n'),
        units,
        blocks,
        [],
      ).issues[0]?.message,
    ).toContain(`no more than ${MAX_RESIDENT_CSV_ROWS}`);
    expect(
      parseResidentsCsv('x'.repeat(512 * 1024 + 1), units, blocks, []).issues[0]
        ?.field,
    ).toBe('file');
  });
});
