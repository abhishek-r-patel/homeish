// Show the resident's society calendar with own bookings and dues only.
import { SocietyCalendar } from '@/components/home/society-calendar';
import { getWorkspaceCalendar } from '@/core/home/workspace-discovery';

export const metadata = {
  title: 'Calendar | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: requested } = await searchParams;
  const now = new Date();
  const month =
    requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested)
      ? requested
      : now.toISOString().slice(0, 7);
  const [year, monthNumber] = month.split('-').map(Number);
  const items = await getWorkspaceCalendar({
    from: new Date(Date.UTC(year!, monthNumber! - 1, 1)).toISOString(),
    to: new Date(Date.UTC(year!, monthNumber!, 1)).toISOString(),
  });
  return <SocietyCalendar items={items} month={month} />;
}
