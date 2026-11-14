// Show administrator amenity definitions and committee read-only bookings.
import { AmenityWorkspace } from '@/components/amenity/workspace';
export const metadata = {
  title: 'Amenities | Homeish',
  robots: { index: false, follow: false },
};
export default async function AdminAmenitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  return <AmenityWorkspace date={(await searchParams).date} />;
}
