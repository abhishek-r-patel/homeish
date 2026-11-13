// Society host addresses. A host opens only after the create-society script and an `active` entry here.
export type SocietyStatus = 'disabled' | 'active';

export type ReservedSociety = {
  slug: string;
  name: string;
  status: SocietyStatus;
};

// `disabled` serves only a "not open yet" placeholder; `active` serves sign-in and the app
// once the database society with the same slug exists (see docs/OPERATIONS.md, society onboarding).
export const reservedSocieties: readonly ReservedSociety[] = [
  { slug: 'maplewood', name: 'Maplewood', status: 'disabled' },
];

export function findReservedSociety(
  slug: string,
  societies: readonly ReservedSociety[] = reservedSocieties,
) {
  return societies.find((society) => society.slug === slug) ?? null;
}
