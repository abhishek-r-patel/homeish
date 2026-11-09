// Reserved society addresses. Activation happens later via the create-society script.
export type SocietyStatus = 'disabled';

export type ReservedSociety = {
  slug: string;
  name: string;
  status: SocietyStatus;
};

export const reservedSocieties: readonly ReservedSociety[] = [
  { slug: 'maplewood', name: 'Maplewood', status: 'disabled' },
];

export function findReservedSociety(slug: string) {
  return reservedSocieties.find((society) => society.slug === slug) ?? null;
}
