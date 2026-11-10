// Validate a bounded resident CSV without writing member records.
import { parseCsvRecords } from '../csv/parse';

export const MAX_RESIDENT_CSV_BYTES = 512 * 1024;
export const MAX_RESIDENT_CSV_ROWS = 1000;

export type ResidentImportRow = {
  rowNumber: number;
  email: string;
  unitId: string;
  relationship: 'owner' | 'tenant' | 'family';
  isPrimary: boolean;
  isApprover: boolean;
};

export type ResidentImportIssue = {
  rowNumber: number;
  field: string;
  message: string;
};

export type ResidentImportPreview = {
  rows: ResidentImportRow[];
  issues: ResidentImportIssue[];
};

type ImportUnit = {
  id: string;
  number: string;
  block_id: string | null;
};

type ImportBlock = { id: string; name: string };

function isRelationship(
  value: string,
): value is ResidentImportRow['relationship'] {
  return value === 'owner' || value === 'tenant' || value === 'family';
}

function parseBoolean(
  value: string,
  field: string,
  rowNumber: number,
  issues: ResidentImportIssue[],
  defaultValue = false,
): boolean {
  if (!value) return defaultValue;
  if (value.toLowerCase() === 'true' || value.toLowerCase() === 'yes') {
    return true;
  }
  if (value.toLowerCase() === 'false' || value.toLowerCase() === 'no') {
    return false;
  }
  issues.push({
    rowNumber,
    field,
    message: 'Use yes or no for this field.',
  });
  return false;
}

export function parseResidentsCsv(
  csv: string,
  units: readonly ImportUnit[],
  blocks: readonly ImportBlock[],
  existingEmails: readonly string[],
): ResidentImportPreview {
  if (new TextEncoder().encode(csv).byteLength > MAX_RESIDENT_CSV_BYTES) {
    return {
      rows: [],
      issues: [
        {
          rowNumber: 1,
          field: 'file',
          message: 'CSV files must be 512 KB or smaller.',
        },
      ],
    };
  }
  let records: string[][];
  try {
    records = parseCsvRecords(csv);
  } catch (error) {
    return {
      rows: [],
      issues: [
        {
          rowNumber: 1,
          field: 'file',
          message:
            error instanceof Error ? error.message : 'CSV format is invalid.',
        },
      ],
    };
  }
  if (records.length < 2) {
    return {
      rows: [],
      issues: [
        {
          rowNumber: 1,
          field: 'file',
          message: 'Add a header and at least one resident row.',
        },
      ],
    };
  }
  if (records.length - 1 > MAX_RESIDENT_CSV_ROWS) {
    return {
      rows: [],
      issues: [
        {
          rowNumber: 1,
          field: 'file',
          message: `Import no more than ${MAX_RESIDENT_CSV_ROWS} resident rows at a time.`,
        },
      ],
    };
  }
  const headers =
    records[0]?.map((header) => header.trim().toLowerCase()) ?? [];
  if (headers[0]?.startsWith('\uFEFF')) headers[0] = headers[0].slice(1);
  const requiredHeaders = [
    'block',
    'unit',
    'email',
    'relationship',
    'primary',
    'approver',
  ];
  if (
    headers.length !== requiredHeaders.length ||
    requiredHeaders.some((header) => !headers.includes(header)) ||
    new Set(headers).size !== headers.length
  ) {
    return {
      rows: [],
      issues: [
        {
          rowNumber: 1,
          field: 'header',
          message:
            'Use the template columns: block, unit, email, relationship, primary, approver.',
        },
      ],
    };
  }

  const columns = new Map(headers.map((header, index) => [header, index]));
  const blocksByName = new Map(blocks.map((block) => [block.name, block]));
  const existing = new Set(existingEmails.map((email) => email.toLowerCase()));
  const seenEmails = new Set<string>();
  const rows: ResidentImportRow[] = [];
  const issues: ResidentImportIssue[] = [];

  for (const [index, values] of records.slice(1).entries()) {
    const rowNumber = index + 2;
    if (values.length !== headers.length) {
      issues.push({
        rowNumber,
        field: 'row',
        message: 'This row has a different number of columns than the header.',
      });
    }
    const cell = (name: string) =>
      values[columns.get(name) ?? -1]?.trim() ?? '';
    const blockName = cell('block');
    const unitNumber = cell('unit');
    const email = cell('email').toLowerCase();
    const relationship = cell('relationship').toLowerCase();
    const isPrimary = parseBoolean(
      cell('primary'),
      'primary',
      rowNumber,
      issues,
    );
    const isApprover = parseBoolean(
      cell('approver'),
      'approver',
      rowNumber,
      issues,
      relationship === 'owner' || relationship === 'tenant',
    );

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      issues.push({
        rowNumber,
        field: 'email',
        message: 'Enter a valid email address.',
      });
    } else if (existing.has(email) || seenEmails.has(email)) {
      issues.push({
        rowNumber,
        field: 'email',
        message: 'This email is already a member, invitation, or import row.',
      });
    }
    if (!isRelationship(relationship)) {
      issues.push({
        rowNumber,
        field: 'relationship',
        message: 'Choose owner, tenant, or family.',
      });
    }
    if (isPrimary && relationship === 'family') {
      issues.push({
        rowNumber,
        field: 'primary',
        message: 'A family member cannot be the primary resident.',
      });
    }
    const block = blockName ? blocksByName.get(blockName) : undefined;
    const candidates = units.filter(
      (unit) =>
        unit.number === unitNumber &&
        (blockName ? unit.block_id === block?.id : unit.block_id === null),
    );
    if (!unitNumber || candidates.length !== 1) {
      issues.push({
        rowNumber,
        field: 'unit',
        message:
          blockName && !block
            ? 'Block must match an active block in this society.'
            : 'Unit must match exactly one active unit.',
      });
    }

    if (issues.some((issue) => issue.rowNumber === rowNumber)) continue;
    if (!isRelationship(relationship)) continue;
    const unit = candidates[0];
    if (!unit) continue;
    rows.push({
      rowNumber,
      email,
      unitId: unit.id,
      relationship,
      isPrimary,
      isApprover,
    });
    seenEmails.add(email);
  }
  return { rows, issues };
}
