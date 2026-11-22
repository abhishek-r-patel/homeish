// Show resident amenity availability and bookings for actively occupied units.
import { AmenityWorkspace } from '@/components/amenity/workspace';
export const metadata = {
  title: 'Amenities | Homeish',
  robots: { index: false, follow: false },
};
export default async function AmenitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string }>;
}) {
  const query = await searchParams;
  return <AmenityWorkspace date={query.date} month={query.month} />;
}
