// Show the committee action-plan workspace to the admin and committee.
import {
  ActionPlansPage,
  TOOLKIT_PAGE_ROBOTS,
} from '@/components/toolkit/server-pages';
export const metadata = {
  title: 'Action plans | Homeish',
  robots: TOOLKIT_PAGE_ROBOTS,
};
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ActionPlansPage searchParams={searchParams} />;
}
