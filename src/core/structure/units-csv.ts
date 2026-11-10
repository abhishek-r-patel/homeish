// Validate a bounded unit CSV without writing any records.
import { z } from 'zod';
import { AppError, ValidationError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import { parseCsvRecords } from '../csv/parse';
import { MAX_UNIT_CSV_BYTES, MAX_UNIT_CSV_ROWS } from './units-csv-constants';

export { MAX_UNIT_CSV_BYTES, MAX_UNIT_CSV_ROWS } from './units-csv-constants';

export type UnitImportRow = {
  rowNumber: number;
  blockName: string | null;
  number: string;
  floor: number | null;
  unitType: string | null;
  areaSqft: number | null;
};

export type UnitImportIssue = {
  rowNumber: number;
  field: string;
  message: string;
};

export type UnitImportPreview = {
  rows: UnitImportRow[];
  issues: UnitImportIssue[];
};

type ActiveBlock = { id: string; name: string };
type ExistingUnit = { block_id: string | null; number: string };

function rowKey(blockId: string | null, number: string) {
  return `${blockId ?? ''}\u0000${number}`;
}

export function parseUnitsCsv(
  csv: string,
  activeBlocks: readonly ActiveBlock[],
  existingUnits: readonly ExistingUnit[],
): UnitImportPreview {
  const issues: UnitImportIssue[] = [];
  if (new TextEncoder().encode(csv).byteLength > MAX_UNIT_CSV_BYTES) {
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
          message: 'Add a header and at least one unit row.',
        },
      ],
    };
  }
  if (records.length - 1 > MAX_UNIT_CSV_ROWS) {
    return {
      rows: [],
      issues: [
        {
          rowNumber: 1,
          field: 'file',
          message: `Import no more than ${MAX_UNIT_CSV_ROWS} unit rows at a time.`,
        },
      ],
    };
  }

  const headers =
    records[0]?.map((header) => header.trim().toLowerCase()) ?? [];
  if (headers[0]?.startsWith('\uFEFF')) {
    headers[0] = headers[0].slice(1);
  }
  const requiredHeaders = [
    'block',
    'number',
    'floor',
    'unit_type',
    'area_sqft',
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
            'Use the template columns: block, number, floor, unit_type, area_sqft.',
        },
      ],
    };
  }

  const column = new Map(headers.map((header, index) => [header, index]));
  const blocksByName = new Map(
    activeBlocks.map((block) => [block.name, block]),
  );
  const seen = new Set(
    existingUnits.map(({ block_id, number }) => rowKey(block_id, number)),
  );
  const parsedRows: UnitImportRow[] = [];

  for (const [index, values] of records.slice(1).entries()) {
    const rowNumber = index + 2;
    if (values.length !== headers.length) {
      issues.push({
        rowNumber,
        field: 'row',
        message: 'This row has a different number of columns than the header.',
      });
    }
    const cell = (name: string) => values[column.get(name) ?? -1]?.trim() ?? '';
    const blockName = cell('block') || null;
    const number = cell('number');
    let blockId: string | null = null;
    if (blockName) {
      const block = blocksByName.get(blockName);
      if (!block) {
        issues.push({
          rowNumber,
          field: 'block',
          message: 'Block must match an active block in this society.',
        });
      } else {
        blockId = block.id;
      }
    }
    if (number.length < 1 || number.length > 20) {
      issues.push({
        rowNumber,
        field: 'number',
        message: 'Unit number must be 1–20 characters.',
      });
    } else {
      const key = rowKey(blockId, number);
      if (seen.has(key) && (!blockName || blockId !== null)) {
        issues.push({
          rowNumber,
          field: 'number',
          message: 'Unit number already exists in this block.',
        });
      }
      seen.add(key);
    }

    const floorText = cell('floor');
    const floor =
      floorText === ''
        ? null
        : /^-?\d+$/.test(floorText)
          ? Number(floorText)
          : Number.NaN;
    if (floor !== null && !Number.isSafeInteger(floor)) {
      issues.push({
        rowNumber,
        field: 'floor',
        message: 'Floor must be a whole number.',
      });
    }

    const unitType = cell('unit_type') || null;
    if (unitType && unitType.length > 30) {
      issues.push({
        rowNumber,
        field: 'unit_type',
        message: 'Unit type must be 30 characters or fewer.',
      });
    }

    const areaText = cell('area_sqft');
    const areaSqft =
      areaText === ''
        ? null
        : /^\d+(?:\.\d{1,2})?$/.test(areaText)
          ? Number(areaText)
          : Number.NaN;
    if (
      areaSqft !== null &&
      (!Number.isFinite(areaSqft) || areaSqft <= 0 || areaSqft > 999999.99)
    ) {
      issues.push({
        rowNumber,
        field: 'area_sqft',
        message: 'Area must be a positive number with up to 2 decimals.',
      });
    }

    parsedRows.push({
      rowNumber,
      blockName,
      number,
      floor: Number.isNaN(floor) ? null : floor,
      unitType,
      areaSqft: Number.isNaN(areaSqft) ? null : areaSqft,
    });
  }
  return { rows: parsedRows, issues };
}

async function getUnitImportContext(write = false) {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'structure:manage',
    write,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const [blocksResult, unitsResult] = await Promise.all([
    context.db
      .from('blocks')
      .select('id, name')
      .eq('society_id', context.societyId)
      .eq('active', true),
    context.db
      .from('units')
      .select('block_id, number')
      .eq('society_id', context.societyId),
  ]);
  if (blocksResult.error) {
    throw new Error('Could not load active blocks for import.', {
      cause: blocksResult.error,
    });
  }
  if (unitsResult.error) {
    throw new Error('Could not load existing units for import.', {
      cause: unitsResult.error,
    });
  }
  return {
    context,
    societyId: context.societyId,
    activeBlocks: blocksResult.data,
    existingUnits: unitsResult.data,
  };
}

export async function previewUnitsImport(csv: string) {
  const { activeBlocks, existingUnits } = await getUnitImportContext();
  return parseUnitsCsv(csv, activeBlocks, existingUnits);
}

export async function confirmUnitsImport(csv: string, requestId: string) {
  const { context, societyId, activeBlocks, existingUnits } =
    await getUnitImportContext(true);
  const preview = parseUnitsCsv(csv, activeBlocks, existingUnits);
  if (preview.issues.length > 0) {
    throw new ValidationError({
      csv: 'Fix every row error before confirming the import.',
    });
  }
  const rows = preview.rows.map((row) => ({
    rowNumber: row.rowNumber,
    blockName: row.blockName,
    number: row.number,
    floor: row.floor,
    unitType: row.unitType,
    areaSqft: row.areaSqft,
  }));
  const { data: jobId, error } = await context.db.rpc(
    'create_units_import_job',
    {
      p_society_id: societyId,
      p_rows: rows,
      p_request_id: requestId,
    },
  );
  if (error?.code === '22023') {
    throw new ValidationError({ csv: 'The import must contain 1–1000 rows.' });
  }
  if (error)
    throw new Error('Could not create the units import job.', { cause: error });
  if (!z.uuid().safeParse(jobId).success) {
    throw new Error('The units import job did not return an identifier.');
  }
  return jobId;
}
