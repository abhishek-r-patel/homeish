// Show the member contact log to admins and committee members.
import { ContactLogPage } from '@/components/communication/server-pages';
import { TOOLKIT_PAGE_ROBOTS } from '@/components/toolkit/server-pages';
export const metadata = {
  title: 'Contact log | Homeish',
  robots: TOOLKIT_PAGE_ROBOTS,
};
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ContactLogPage searchParams={searchParams} />;
}
