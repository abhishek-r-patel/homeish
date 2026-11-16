// Format Asset Register values for screens without touching the database.
import {
  ASSET_WARRANTY_SOON_DAYS,
  type AssetDetail,
  type AssetListItem,
  type AssetStatus,
} from './validation';

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const longDate = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Formats a whole number of paise as Indian rupees, for example ₹25,000. */
export function formatPaise(paise: number): string {
  return rupees.format(paise / 100);
}

/** Converts a rupee amount typed in a form, such as "25,000.50", to paise. */
export function rupeesToPaise(value: string): number | null {
  const cleaned = value.replace(/[₹,\s]/g, '');
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = '0', fraction = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** Shows paise as a plain rupee value for a form field, for example "25000.5". */
export function paiseToRupeesInput(paise: number): string {
  const whole = Math.floor(paise / 100);
  const fraction = paise % 100;
  return fraction === 0
    ? String(whole)
    : `${whole}.${String(fraction).padStart(2, '0')}`;
}

/** Formats a YYYY-MM-DD date as, for example, 5 Mar 2026. */
export function formatAssetDate(value: string): string {
  return longDate.format(new Date(`${value}T00:00:00Z`));
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  active: 'In use',
  under_repair: 'Under repair',
  retired: 'Retired',
};

export type WarrantyState = 'none' | 'expired' | 'ending_soon' | 'active';

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

/** Classifies a warranty against the society's today. */
export function warrantyState(
  warrantyEndDate: string | null,
  today: string,
): WarrantyState {
  if (!warrantyEndDate) return 'none';
  const days = daysBetween(today, warrantyEndDate);
  if (days < 0) return 'expired';
  if (days <= ASSET_WARRANTY_SOON_DAYS) return 'ending_soon';
  return 'active';
}

export function warrantyText(
  warrantyEndDate: string | null,
  today: string,
): string {
  const state = warrantyState(warrantyEndDate, today);
  if (state === 'none' || !warrantyEndDate) return 'No warranty recorded';
  const date = formatAssetDate(warrantyEndDate);
  if (state === 'expired') return `Warranty ended ${date}`;
  if (state === 'ending_soon') return `Warranty ends soon, on ${date}`;
  return `Under warranty until ${date}`;
}

export const WARRANTY_FILTER_LABELS: Record<WarrantyState, string> = {
  active: 'Under warranty',
  ending_soon: 'Warranty ending soon',
  expired: 'Warranty ended',
  none: 'No warranty recorded',
};

export type AssetFilters = {
  search: string;
  categoryId: string;
  status: AssetStatus | '';
  warranty: WarrantyState | '';
};

export const EMPTY_ASSET_FILTERS: AssetFilters = {
  search: '',
  categoryId: '',
  status: '',
  warranty: '',
};

/** Filters the register by text, category, status and warranty state. */
export function filterAssets(
  assets: readonly AssetListItem[],
  filters: AssetFilters,
  today: string,
): AssetListItem[] {
  const terms = filters.search
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return assets.filter((asset) => {
    if (filters.categoryId && asset.category_id !== filters.categoryId) {
      return false;
    }
    if (filters.status && asset.status !== filters.status) return false;
    if (
      filters.warranty &&
      warrantyState(asset.warranty_end_date, today) !== filters.warranty
    ) {
      return false;
    }
    if (terms.length === 0) return true;
    const haystack = [
      asset.name,
      asset.location,
      asset.category_name,
      asset.make,
      asset.model,
      asset.serial_number,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export type AssetHistoryItem =
  | {
      kind: 'maintenance';
      id: string;
      date: string;
      description: string;
      costPaise: number | null;
      doneBy: string;
    }
  | {
      kind: 'amc_visit';
      id: string;
      date: string;
      description: string;
      technician: string;
    };

/** Merges manual maintenance and read-only AMC visits, newest first. */
export function assetHistory(detail: AssetDetail): AssetHistoryItem[] {
  const items: AssetHistoryItem[] = [
    ...detail.maintenance.map((entry) => ({
      kind: 'maintenance' as const,
      id: entry.id,
      date: entry.performed_on,
      description: entry.description,
      costPaise: entry.cost_paise,
      doneBy: entry.done_by,
    })),
    ...detail.amc_visits.map((visit) => ({
      kind: 'amc_visit' as const,
      id: visit.id,
      date: visit.visit_date,
      description: visit.summary,
      technician: visit.technician,
    })),
  ];
  return items.sort((a, b) =>
    a.date === b.date
      ? a.kind.localeCompare(b.kind)
      : b.date.localeCompare(a.date),
  );
}

export function amcContractLabel(contract: {
  asset_label: string;
  vendor_name: string;
  end_date: string;
}): string {
  return `${contract.asset_label} – ${contract.vendor_name} (ends ${formatAssetDate(contract.end_date)})`;
}
