// Validate the six P56 CSV lists into server-safe, all-or-nothing import rows.
import { z } from 'zod';
import { parseResidentsCsv } from '../members/residents-csv';
import { parseUnitsCsv } from '../structure/units-csv';
import { parseCsvRecords } from './parse';
import {
  MAX_BULK_IMPORT_BYTES,
  MAX_BULK_IMPORT_ROWS,
  type BulkImportContext,
  type BulkImportIssue,
  type BulkImportKind,
  type BulkImportPreview,
  type BulkImportRow,
} from './bulk-import-shared';

export {
  BULK_IMPORT_KINDS,
  BULK_IMPORT_TEMPLATES,
  MAX_BULK_IMPORT_BYTES,
  MAX_BULK_IMPORT_ROWS,
  type BulkImportContext,
  type BulkImportIssue,
  type BulkImportKind,
  type BulkImportPreview,
  type BulkImportRow,
} from './bulk-import-shared';

function fileIssue(message: string): BulkImportPreview {
  return { rows: [], issues: [{ rowNumber: 1, field: 'file', message }] };
}

function readRows(
  csv: string,
  requiredHeaders: readonly string[],
):
  | { records: Array<Record<string, string>>; issues: BulkImportIssue[] }
  | BulkImportPreview {
  if (new TextEncoder().encode(csv).byteLength > MAX_BULK_IMPORT_BYTES) {
    return fileIssue('CSV files must be 512 KB or smaller.');
  }
  let parsed: string[][];
  try {
    parsed = parseCsvRecords(csv);
  } catch (error) {
    return fileIssue(
      error instanceof Error ? error.message : 'CSV format is invalid.',
    );
  }
  if (parsed.length < 2) {
    return fileIssue('Add a header and at least one data row.');
  }
  if (parsed.length - 1 > MAX_BULK_IMPORT_ROWS) {
    return fileIssue(
      `Import no more than ${MAX_BULK_IMPORT_ROWS} rows at a time.`,
    );
  }
  const headers = parsed[0]?.map((header) => header.trim().toLowerCase()) ?? [];
  if (headers[0]?.startsWith('\uFEFF')) headers[0] = headers[0].slice(1);
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
          message: `Use the template columns: ${requiredHeaders.join(', ')}.`,
        },
      ],
    };
  }
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const records = parsed.slice(1).map((values, index) => {
    const record: Record<string, string> = {};
    for (const header of headers) {
      record[header] = values[indexes.get(header) ?? -1]?.trim() ?? '';
    }
    if (values.length !== headers.length) {
      record.__row_error__ = 'This row has a different number of columns.';
    }
    record.__row_number__ = String(index + 2);
    return record;
  });
  return { records, issues: [] };
}

function isUnit(
  unit: BulkImportContext['units'][number],
  blocks: BulkImportContext['blocks'],
  blockName: string,
  number: string,
) {
  const block = blockName
    ? blocks.find((item) => item.name === blockName)
    : undefined;
  return unit.number === number && unit.block_id === (block?.id ?? null);
}

function parseBoolean(value: string): boolean | null {
  if (['yes', 'true'].includes(value.toLowerCase())) return true;
  if (['no', 'false'].includes(value.toLowerCase())) return false;
  if (!value) return false;
  return null;
}

function rupeesToPaise(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const amount = Math.round(Number(value) * 100);
  return amount > 0 && Number.isSafeInteger(amount) ? amount : null;
}

function addIssue(
  issues: BulkImportIssue[],
  rowNumber: number,
  field: string,
  message: string,
) {
  issues.push({ rowNumber, field, message });
}

function parseOpeningDues(
  csv: string,
  context: BulkImportContext,
): BulkImportPreview {
  const result = readRows(csv, [
    'block',
    'unit',
    'as_on',
    'due_date',
    'amount',
  ]);
  if ('rows' in result) return result;
  const rows: BulkImportRow[] = [];
  const issues = [...result.issues];
  const seenUnits = new Set<string>();
  for (const record of result.records) {
    const rowNumber = Number(record.__row_number__);
    if (record.__row_error__) {
      addIssue(issues, rowNumber, 'row', record.__row_error__);
      continue;
    }
    const unit = context.units.find((item) =>
      isUnit(item, context.blocks, record.block ?? '', record.unit ?? ''),
    );
    const amountPaise = rupeesToPaise(record.amount ?? '');
    if (!unit) addIssue(issues, rowNumber, 'unit', 'Choose an active unit.');
    if (!z.iso.date().safeParse(record.as_on).success) {
      addIssue(issues, rowNumber, 'as_on', 'Use a valid YYYY-MM-DD date.');
    }
    if (!z.iso.date().safeParse(record.due_date).success) {
      addIssue(issues, rowNumber, 'due_date', 'Use a valid YYYY-MM-DD date.');
    }
    if (
      z.iso.date().safeParse(record.as_on).success &&
      z.iso.date().safeParse(record.due_date).success &&
      record.due_date! < record.as_on!
    ) {
      addIssue(
        issues,
        rowNumber,
        'due_date',
        'The due date cannot be before the opening date.',
      );
    }
    if (amountPaise === null) {
      addIssue(
        issues,
        rowNumber,
        'amount',
        'Enter a positive amount with at most two decimal places.',
      );
    }
    if (unit && seenUnits.has(unit.id)) {
      addIssue(
        issues,
        rowNumber,
        'unit',
        'Import opening dues for each unit only once.',
      );
    }
    if (issues.some((issue) => issue.rowNumber === rowNumber) || !unit)
      continue;
    rows.push({
      rowNumber,
      unitId: unit.id,
      asOn: record.as_on!,
      dueDate: record.due_date!,
      amountPaise: amountPaise!,
    });
    seenUnits.add(unit.id);
  }
  return { rows, issues };
}

function parseVehicles(
  csv: string,
  context: BulkImportContext,
): BulkImportPreview {
  const result = readRows(csv, [
    'block',
    'unit',
    'email',
    'vehicle_type',
    'registration_number',
    'tag_number',
  ]);
  if ('rows' in result) return result;
  const rows: BulkImportRow[] = [];
  const issues = [...result.issues];
  const registrations = new Set(context.existingVehicleRegistrations);
  for (const record of result.records) {
    const rowNumber = Number(record.__row_number__);
    if (record.__row_error__) {
      addIssue(issues, rowNumber, 'row', record.__row_error__);
      continue;
    }
    const unit = context.units.find((item) =>
      isUnit(item, context.blocks, record.block ?? '', record.unit ?? ''),
    );
    const resident = context.residents.find(
      (item) =>
        item.unit_id === unit?.id &&
        item.email.toLowerCase() === record.email?.toLowerCase(),
    );
    const registration = (record.registration_number ?? '')
      .replace(/[\s-]/g, '')
      .toUpperCase();
    if (!unit) addIssue(issues, rowNumber, 'unit', 'Choose an active unit.');
    if (!resident) {
      addIssue(
        issues,
        rowNumber,
        'email',
        'Choose an active resident linked to this unit.',
      );
    }
    if (!['car', 'two_wheeler', 'other'].includes(record.vehicle_type ?? '')) {
      addIssue(
        issues,
        rowNumber,
        'vehicle_type',
        'Choose car, two_wheeler, or other.',
      );
    }
    if (!/^[A-Z0-9]{4,16}$/.test(registration)) {
      addIssue(
        issues,
        rowNumber,
        'registration_number',
        'Enter 4–16 letters and digits.',
      );
    } else if (registrations.has(registration)) {
      addIssue(
        issues,
        rowNumber,
        'registration_number',
        'This registration appears more than once in the file.',
      );
    }
    if ((record.tag_number?.length ?? 0) > 40) {
      addIssue(
        issues,
        rowNumber,
        'tag_number',
        'Use no more than 40 characters.',
      );
    }
    if (
      issues.some((issue) => issue.rowNumber === rowNumber) ||
      !unit ||
      !resident
    ) {
      continue;
    }
    registrations.add(registration);
    rows.push({
      rowNumber,
      unitId: unit.id,
      membershipId: resident.membership_id,
      vehicleType: record.vehicle_type!,
      registrationNumber: registration,
      tagNumber: record.tag_number || null,
    });
  }
  return { rows, issues };
}

function parseStaff(
  csv: string,
  context: BulkImportContext,
): BulkImportPreview {
  const result = readRows(csv, [
    'staff_type',
    'block',
    'unit',
    'full_name',
    'phone',
    'job_role',
    'police_verified',
    'id_type',
    'id_last_four',
  ]);
  if ('rows' in result) return result;
  const rows: BulkImportRow[] = [];
  const issues = [...result.issues];
  const phones = new Set(context.existingDomesticStaffPhones);
  for (const record of result.records) {
    const rowNumber = Number(record.__row_number__);
    if (record.__row_error__) {
      addIssue(issues, rowNumber, 'row', record.__row_error__);
      continue;
    }
    const domestic = record.staff_type === 'domestic';
    const unit = domestic
      ? context.units.find((item) =>
          isUnit(item, context.blocks, record.block ?? '', record.unit ?? ''),
        )
      : undefined;
    const policeVerified = parseBoolean(record.police_verified ?? '');
    if (!['domestic', 'society'].includes(record.staff_type ?? '')) {
      addIssue(issues, rowNumber, 'staff_type', 'Choose domestic or society.');
    }
    if (domestic && !unit) {
      addIssue(issues, rowNumber, 'unit', 'Choose an active unit.');
    }
    if (!record.full_name || record.full_name.length > 120) {
      addIssue(
        issues,
        rowNumber,
        'full_name',
        'Enter a name up to 120 characters.',
      );
    }
    if (!/^\+?[0-9]{10,15}$/.test(record.phone ?? '')) {
      addIssue(issues, rowNumber, 'phone', 'Enter a valid phone number.');
    } else if (domestic && phones.has(record.phone!)) {
      addIssue(
        issues,
        rowNumber,
        'phone',
        'This domestic staff phone is already in use.',
      );
    }
    if (!record.job_role || record.job_role.length > 80) {
      addIssue(
        issues,
        rowNumber,
        'job_role',
        'Enter a role up to 80 characters.',
      );
    }
    if (policeVerified === null) {
      addIssue(issues, rowNumber, 'police_verified', 'Use yes or no.');
    }
    const idType = record.id_type || null;
    const idLastFour = record.id_last_four || null;
    if (
      (idType === null) !== (idLastFour === null) ||
      (idType !== null &&
        !['aadhaar', 'pan', 'voter_id', 'passport', 'other'].includes(
          idType,
        )) ||
      (idLastFour !== null && !/^[A-Za-z0-9]{4}$/.test(idLastFour))
    ) {
      addIssue(
        issues,
        rowNumber,
        'id_last_four',
        'Enter a supported ID type and four characters together.',
      );
    }
    if (issues.some((issue) => issue.rowNumber === rowNumber)) continue;
    rows.push({
      rowNumber,
      staffType: record.staff_type!,
      unitId: unit?.id ?? null,
      fullName: record.full_name!,
      phone: record.phone!,
      jobRole: record.job_role!,
      policeVerified: policeVerified!,
      idType,
      idLastFour,
    });
    if (domestic) phones.add(record.phone!);
  }
  return { rows, issues };
}

function parseAssets(
  csv: string,
  context: BulkImportContext,
): BulkImportPreview {
  const result = readRows(csv, [
    'category',
    'name',
    'location',
    'make',
    'model',
    'serial_number',
    'purchase_date',
    'purchase_cost',
    'supplier',
    'warranty_end_date',
    'status',
    'notes',
  ]);
  if ('rows' in result) return result;
  const rows: BulkImportRow[] = [];
  const issues = [...result.issues];
  for (const record of result.records) {
    const rowNumber = Number(record.__row_number__);
    if (record.__row_error__) {
      addIssue(issues, rowNumber, 'row', record.__row_error__);
      continue;
    }
    const category = context.assetCategories.find(
      (item) => item.name === record.category,
    );
    const cost = record.purchase_cost
      ? rupeesToPaise(record.purchase_cost)
      : null;
    if (!category) {
      addIssue(issues, rowNumber, 'category', 'Choose an active category.');
    }
    if (!record.name || record.name.length > 120) {
      addIssue(issues, rowNumber, 'name', 'Enter a name up to 120 characters.');
    }
    if (!record.location || record.location.length > 120) {
      addIssue(
        issues,
        rowNumber,
        'location',
        'Enter a location up to 120 characters.',
      );
    }
    for (const field of ['purchase_date', 'warranty_end_date'] as const) {
      if (record[field] && !z.iso.date().safeParse(record[field]).success) {
        addIssue(issues, rowNumber, field, 'Use a valid YYYY-MM-DD date.');
      }
    }
    if (record.purchase_cost && cost === null) {
      addIssue(
        issues,
        rowNumber,
        'purchase_cost',
        'Enter a positive amount with at most two decimal places.',
      );
    }
    if (
      record.purchase_date &&
      record.warranty_end_date &&
      record.warranty_end_date < record.purchase_date
    ) {
      addIssue(
        issues,
        rowNumber,
        'warranty_end_date',
        'The warranty cannot end before purchase.',
      );
    }
    if (!['active', 'under_repair', 'retired'].includes(record.status ?? '')) {
      addIssue(
        issues,
        rowNumber,
        'status',
        'Choose active, under_repair, or retired.',
      );
    }
    if ((record.notes?.length ?? 0) > 1000) {
      addIssue(
        issues,
        rowNumber,
        'notes',
        'Use no more than 1,000 characters.',
      );
    }
    if (issues.some((issue) => issue.rowNumber === rowNumber) || !category) {
      continue;
    }
    rows.push({
      rowNumber,
      categoryId: category.id,
      name: record.name!,
      location: record.location!,
      make: record.make || null,
      model: record.model || null,
      serialNumber: record.serial_number || null,
      purchaseDate: record.purchase_date || null,
      purchaseCostPaise: cost,
      supplier: record.supplier || null,
      warrantyEndDate: record.warranty_end_date || null,
      status: record.status!,
      notes: record.notes || null,
    });
  }
  return { rows, issues };
}

export function parseBulkImport(
  kind: BulkImportKind,
  csv: string,
  context: BulkImportContext,
): BulkImportPreview {
  if (kind === 'units') {
    const preview = parseUnitsCsv(
      csv,
      context.blocks,
      context.units.map(({ block_id, number }) => ({ block_id, number })),
    );
    return {
      rows: preview.rows.map((row) => ({ ...row })),
      issues: preview.issues,
    };
  }
  if (kind === 'residents') {
    const preview = parseResidentsCsv(
      csv,
      context.units,
      context.blocks,
      context.existingResidentEmails,
    );
    return {
      rows: preview.rows.map((row) => ({ ...row })),
      issues: preview.issues,
    };
  }
  if (kind === 'opening_dues') return parseOpeningDues(csv, context);
  if (kind === 'vehicles') return parseVehicles(csv, context);
  if (kind === 'staff') return parseStaff(csv, context);
  return parseAssets(csv, context);
}
