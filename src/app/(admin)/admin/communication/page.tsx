// Show the monthly communication dashboard to admins and committee members.
import { CommunicationPage } from '@/components/communication/server-pages';
import { TOOLKIT_PAGE_ROBOTS } from '@/components/toolkit/server-pages';
export const metadata = {
  title: 'Communication | Homeish',
  robots: TOOLKIT_PAGE_ROBOTS,
};
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CommunicationPage searchParams={searchParams} />;
}
