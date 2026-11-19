// Show the society reference profile and its advisory setup checklist to the admin and committee.
import {
  SocietyProfilePage,
  TOOLKIT_PAGE_ROBOTS,
} from '@/components/toolkit/server-pages';
export const metadata = {
  title: 'Society profile | Homeish',
  robots: TOOLKIT_PAGE_ROBOTS,
};
export default function Page() {
  return <SocietyProfilePage />;
}
