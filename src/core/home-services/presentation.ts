// Shared Home-Services labels, rating text and directory filtering for screens and fixtures.
import type {
  HomeServiceType,
  HomeServicesManagedProvider,
  HomeServicesProvider,
} from './validation';

export const HOME_SERVICES_TIME_ZONE = 'Asia/Kolkata';

export const HOME_SERVICE_TYPE_LABELS: Record<HomeServiceType, string> = {
  plumber: 'Plumber',
  electrician: 'Electrician',
  carpenter: 'Carpenter',
  painter: 'Painter',
  pest_control: 'Pest control',
  appliance_repair: 'Appliance repair',
  cleaning: 'Cleaning',
  other: 'Other',
};

export const HOME_SERVICES_STAR_LABELS = {
  1: '1 star, poor',
  2: '2 stars, fair',
  3: '3 stars, good',
  4: '4 stars, very good',
  5: '5 stars, excellent',
} as const;

export function homeServicesStarLabel(stars: number) {
  return (
    HOME_SERVICES_STAR_LABELS[
      stars as keyof typeof HOME_SERVICES_STAR_LABELS
    ] ?? `${stars} stars`
  );
}

export function homeServicesRatingSummary(
  average: number | null,
  count: number,
) {
  if (count === 0 || average === null) return 'No ratings yet';
  const rounded = average.toFixed(1);
  return `${rounded} out of 5 from ${count} rating${count === 1 ? '' : 's'}`;
}

/** Visual stars for an average, rounded to the nearest whole star. */
export function homeServicesStarGlyphs(value: number) {
  const filled = Math.min(5, Math.max(0, Math.round(value)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

export type HomeServicesManagedState =
  'pending' | 'listed' | 'rejected' | 'archived';

export function homeServicesManagedState(
  provider: Pick<HomeServicesManagedProvider, 'status' | 'archived_at'>,
): HomeServicesManagedState {
  if (provider.status === 'pending') return 'pending';
  if (provider.status === 'rejected') return 'rejected';
  return provider.archived_at ? 'archived' : 'listed';
}

function normalise(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('en-IN').trim();
}

/** Filter a directory by service type and a free-text search over name, area and notes. */
export function filterHomeServicesProviders<
  T extends Pick<
    HomeServicesProvider,
    'name' | 'service_type' | 'area' | 'notes'
  >,
>(
  providers: readonly T[],
  serviceType: HomeServiceType | 'all',
  query: string,
) {
  const terms = normalise(query).split(/\s+/).filter(Boolean);
  return providers.filter((provider) => {
    if (serviceType !== 'all' && provider.service_type !== serviceType)
      return false;
    if (terms.length === 0) return true;
    const haystack = normalise(
      [
        provider.name,
        HOME_SERVICE_TYPE_LABELS[provider.service_type],
        provider.area ?? '',
        provider.notes ?? '',
      ].join(' '),
    );
    return terms.every((term) => haystack.includes(term));
  });
}

/** Digits-only tel: link target; keeps a leading plus for international numbers. */
export function homeServicesTelHref(phone: string) {
  const trimmed = phone.trim();
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${trimmed.replace(/\D/g, '')}`;
}

export function formatHomeServicesDate(
  value: string,
  timeZone = HOME_SERVICES_TIME_ZONE,
) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(new Date(value));
}
