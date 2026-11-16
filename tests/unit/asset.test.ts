// Verify asset warranty states, money parsing, register filters, history merging and input rules.
import { describe, expect, it } from 'vitest';
import {
  EMPTY_ASSET_FILTERS,
  assetHistory,
  filterAssets,
  paiseToRupeesInput,
  rupeesToPaise,
  warrantyState,
} from '../../src/core/asset/presentation';
import {
  assetInputSchema,
  assetMaintenanceInputSchema,
  type AssetDetail,
  type AssetListItem,
} from '../../src/core/asset/validation';

const TODAY = '2026-11-16';
const CATEGORY = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const OTHER = 'a1d55fc3-0751-4b79-86c1-5b3e25942392';

const item = (overrides: Partial<AssetListItem>): AssetListItem => ({
  id: crypto.randomUUID(),
  name: 'Lift A1',
  category_id: CATEGORY,
  category_name: 'Lifts',
  location: 'Tower A lobby',
  make: 'Otis',
  model: null,
  serial_number: 'OT-1',
  status: 'active',
  warranty_end_date: null,
  amc_linked: false,
  last_maintenance_on: null,
  ...overrides,
});

describe('asset warranty state', () => {
  it('classifies none, expired, ending soon at the 30-day edge and active', () => {
    expect(warrantyState(null, TODAY)).toBe('none');
    expect(warrantyState('2026-11-15', TODAY)).toBe('expired');
    expect(warrantyState(TODAY, TODAY)).toBe('ending_soon');
    expect(warrantyState('2026-12-16', TODAY)).toBe('ending_soon');
    expect(warrantyState('2026-12-17', TODAY)).toBe('active');
  });
});

describe('asset money parsing', () => {
  it('converts rupees to paise and back, rejecting malformed amounts', () => {
    expect(rupeesToPaise('₹1,85,000.5')).toBe(18_500_050);
    expect(rupeesToPaise('0')).toBe(0);
    expect(rupeesToPaise('12.345')).toBeNull();
    expect(rupeesToPaise('-5')).toBeNull();
    expect(paiseToRupeesInput(18_500_050)).toBe('185000.50');
    expect(paiseToRupeesInput(2_500_000)).toBe('25000');
  });
});

describe('asset register filters', () => {
  const lift = item({ name: 'Lift A1', warranty_end_date: '2026-12-01' });
  const pump = item({
    name: 'Borewell pump',
    category_id: OTHER,
    category_name: 'Pumps',
    location: 'Basement',
    make: null,
    serial_number: null,
    status: 'under_repair',
    warranty_end_date: '2025-01-01',
  });
  const assets = [lift, pump];

  it('matches every search word across name, location, category and serial', () => {
    const search = (text: string) =>
      filterAssets(assets, { ...EMPTY_ASSET_FILTERS, search: text }, TODAY);
    expect(search('tower lift')).toEqual([lift]);
    expect(search('OT-1')).toEqual([lift]);
    expect(search('pumps basement')).toEqual([pump]);
    expect(search('lift basement')).toEqual([]);
    expect(search('   ')).toEqual(assets);
  });

  it('combines category, status and warranty filters', () => {
    expect(
      filterAssets(
        assets,
        { ...EMPTY_ASSET_FILTERS, categoryId: OTHER, status: 'under_repair' },
        TODAY,
      ),
    ).toEqual([pump]);
    expect(
      filterAssets(
        assets,
        { ...EMPTY_ASSET_FILTERS, warranty: 'ending_soon' },
        TODAY,
      ),
    ).toEqual([lift]);
    expect(
      filterAssets(
        assets,
        { ...EMPTY_ASSET_FILTERS, status: 'retired' },
        TODAY,
      ),
    ).toEqual([]);
  });
});

describe('asset history', () => {
  it('merges manual entries and AMC visits newest first', () => {
    const history = assetHistory({
      maintenance: [
        {
          id: 'm1',
          performed_on: '2026-03-01',
          description: 'Oiled',
          cost_paise: null,
          done_by: 'Ravi',
          created_at: '2026-03-01T00:00:00.000Z',
        },
      ],
      amc_visits: [
        {
          id: 'v1',
          visit_date: '2026-06-01',
          summary: 'Service',
          technician: 'S',
        },
        {
          id: 'v0',
          visit_date: '2025-06-01',
          summary: 'Service',
          technician: 'S',
        },
      ],
    } as unknown as AssetDetail);
    expect(history.map((entry) => entry.id)).toEqual(['v1', 'm1', 'v0']);
  });
});

describe('asset input rules', () => {
  const base = {
    assetId: null,
    categoryId: CATEGORY,
    name: ' Lift A1 ',
    location: 'Tower A',
    make: '',
    model: null,
    serialNumber: '',
    purchaseDate: '',
    purchaseCostPaise: null,
    supplier: '',
    warrantyEndDate: '',
    status: 'active',
    notes: '',
    amcContractId: null,
    expectedAmcEnabled: true,
    expectedVersion: null,
    clientRequestId: null,
  };

  it('trims text and turns blank optional fields into null', () => {
    const parsed = assetInputSchema.parse(base);
    expect(parsed.name).toBe('Lift A1');
    expect(parsed.make).toBeNull();
    expect(parsed.purchaseDate).toBeNull();
    expect(parsed.warrantyEndDate).toBeNull();
  });

  it('rejects a warranty ending before purchase and a version without an id', () => {
    expect(
      assetInputSchema.safeParse({
        ...base,
        purchaseDate: '2026-01-02',
        warrantyEndDate: '2026-01-01',
      }).success,
    ).toBe(false);
    expect(
      assetInputSchema.safeParse({ ...base, expectedVersion: 1 }).success,
    ).toBe(false);
  });

  it('requires a maintenance date, description and who did it', () => {
    const entry = {
      assetId: CATEGORY,
      performedOn: '2026-11-01',
      description: 'Oiled rails',
      costPaise: null,
      doneBy: 'Ravi',
      clientRequestId: null,
    };
    expect(assetMaintenanceInputSchema.safeParse(entry).success).toBe(true);
    for (const patch of [
      { performedOn: '' },
      { description: ' ' },
      { doneBy: '' },
    ]) {
      expect(
        assetMaintenanceInputSchema.safeParse({ ...entry, ...patch }).success,
      ).toBe(false);
    }
  });
});
