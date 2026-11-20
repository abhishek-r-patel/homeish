// Show the capability adoption tracker to the admin and committee.
import {
  AdoptionPage,
  TOOLKIT_PAGE_ROBOTS,
} from '@/components/toolkit/server-pages';
export const metadata = {
  title: 'Adoption tracker | Homeish',
  robots: TOOLKIT_PAGE_ROBOTS,
};
export default function Page() {
  return <AdoptionPage />;
}
