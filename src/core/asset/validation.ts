// Validate Asset Register settings, form input and the database read models.
import { z } from 'zod';

export const DEFAULT_ASSET_SETTINGS = {} as const;

export const assetSettingsSchema = z.object({}).strict();

export const ASSET_STATUSES = ['active', 'under_repair', 'retired'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export const ASSET_AMOUNT_MAX_PAISE = 999_999_999_999_999;
/** Warranties ending within this many days are flagged on the register. */
export const ASSET_WARRANTY_SOON_DAYS = 30;

const dateOnly = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });
const version = z.number().int().min(1).max(2_147_483_647);
const paise = z.number().int().min(0).max(ASSET_AMOUNT_MAX_PAISE);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use up to ${max} characters.`)
    .nullable()
    .transform((value) => (value ? value : null));
const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `Use up to ${max} characters.`);
const optionalDate = z
  .string()
  .nullable()
  .transform((value) => (value ? value : null))
  .pipe(dateOnly.nullable());

export const assetCategoryInputSchema = z
  .object({
    categoryId: z.uuid().nullable(),
    name: requiredText(60, 'Enter a category name, for example Lifts.'),
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid().nullable(),
  })
  .strict()
  .refine(
    (input) => (input.categoryId === null) === (input.expectedVersion === null),
    {
      path: ['expectedVersion'],
      message: 'Refresh the category before saving.',
    },
  );

export const assetCategoryActiveInputSchema = z
  .object({
    categoryId: z.uuid(),
    active: z.boolean(),
    expectedVersion: version,
  })
  .strict();

export const assetInputSchema = z
  .object({
    assetId: z.uuid().nullable(),
    categoryId: z.uuid('Choose a category.'),
    name: requiredText(120, 'Enter the asset name, for example Lift A1.'),
    location: requiredText(
      120,
      'Enter where the asset is, for example Tower A lobby.',
    ),
    make: optionalText(80),
    model: optionalText(80),
    serialNumber: optionalText(80),
    purchaseDate: optionalDate,
    purchaseCostPaise: paise.nullable(),
    supplier: optionalText(120),
    warrantyEndDate: optionalDate,
    status: z.enum(ASSET_STATUSES, 'Choose a status.'),
    notes: optionalText(1000),
    amcContractId: z.uuid().nullable(),
    expectedAmcEnabled: z.boolean(),
    expectedVersion: version.nullable(),
    clientRequestId: z.uuid().nullable(),
  })
  .strict()
  .refine(
    (input) => (input.assetId === null) === (input.expectedVersion === null),
    { path: ['expectedVersion'], message: 'Refresh the asset before saving.' },
  )
  .refine(
    (input) =>
      input.purchaseDate === null ||
      input.warrantyEndDate === null ||
      input.warrantyEndDate >= input.purchaseDate,
    {
      path: ['warrantyEndDate'],
      message: 'The warranty must end on or after the purchase date.',
    },
  );

export const assetMaintenanceInputSchema = z
  .object({
    assetId: z.uuid(),
    performedOn: dateOnly.or(z.literal('')).refine((value) => value !== '', {
      message: 'Choose the date the work was done.',
    }),
    description: requiredText(1000, 'Describe the work that was done.'),
    costPaise: paise.nullable(),
    doneBy: requiredText(120, 'Enter who did the work.'),
    clientRequestId: z.uuid().nullable(),
  })
  .strict();

export const assetMaintenanceRemoveInputSchema = z
  .object({ entryId: z.uuid() })
  .strict();

const statusSchema = z.enum(ASSET_STATUSES);
const categoryOption = z
  .object({ id: z.uuid(), name: z.string(), active: z.boolean() })
  .strict();
const contractOption = z
  .object({
    id: z.uuid(),
    asset_label: z.string(),
    vendor_name: z.string(),
    end_date: dateOnly,
  })
  .strict();

export const assetWorkspaceSchema = z
  .object({
    can_manage: z.boolean(),
    amc_enabled: z.boolean(),
    today: dateOnly,
    truncated: z.boolean(),
    categories: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string(),
          active: z.boolean(),
          version,
          asset_count: z.number().int().min(0),
        })
        .strict(),
    ),
    assets: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string(),
          category_id: z.uuid(),
          category_name: z.string(),
          location: z.string(),
          make: z.string().nullable(),
          model: z.string().nullable(),
          serial_number: z.string().nullable(),
          status: statusSchema,
          warranty_end_date: dateOnly.nullable(),
          amc_linked: z.boolean(),
          last_maintenance_on: dateOnly.nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type AssetWorkspace = z.infer<typeof assetWorkspaceSchema>;
export type AssetListItem = AssetWorkspace['assets'][number];

export const assetDetailSchema = z
  .object({
    can_manage: z.boolean(),
    amc_enabled: z.boolean(),
    today: dateOnly,
    asset: z
      .object({
        id: z.uuid(),
        category_id: z.uuid(),
        category_name: z.string(),
        name: z.string(),
        location: z.string(),
        make: z.string().nullable(),
        model: z.string().nullable(),
        serial_number: z.string().nullable(),
        purchase_date: dateOnly.nullable(),
        purchase_cost_paise: paise.nullable(),
        supplier: z.string().nullable(),
        warranty_end_date: dateOnly.nullable(),
        status: statusSchema,
        notes: z.string().nullable(),
        amc_contract_id: z.uuid().nullable(),
        version,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .strict(),
    categories: z.array(categoryOption),
    maintenance: z.array(
      z
        .object({
          id: z.uuid(),
          performed_on: dateOnly,
          description: z.string(),
          cost_paise: paise.nullable(),
          done_by: z.string(),
          created_at: timestamp,
        })
        .strict(),
    ),
    amc_contract: z
      .object({
        id: z.uuid(),
        asset_label: z.string(),
        vendor_name: z.string(),
        start_date: dateOnly,
        end_date: dateOnly,
        renewed: z.boolean(),
      })
      .strict()
      .nullable(),
    amc_visits: z.array(
      z
        .object({
          id: z.uuid(),
          visit_date: dateOnly,
          summary: z.string(),
          technician: z.string(),
        })
        .strict(),
    ),
    amc_contracts: z.array(contractOption),
  })
  .strict();
export type AssetDetail = z.infer<typeof assetDetailSchema>;
export type AssetRecord = AssetDetail['asset'];

export const assetFormOptionsSchema = z
  .object({
    amc_enabled: z.boolean(),
    today: dateOnly,
    categories: z.array(categoryOption),
    amc_contracts: z.array(contractOption),
  })
  .strict();
export type AssetFormOptions = z.infer<typeof assetFormOptionsSchema>;
