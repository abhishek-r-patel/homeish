// Load the P53 contact log and communication dashboard screens and map failures to safe route states.
import 'server-only';
import { saveContactLogAction } from '@/app/(admin)/admin/contact-log/actions';
import {
  currentIndiaDate,
  currentIndiaMonth,
  getCommunicationDashboard,
  getContactLogs,
} from '@/core/communication/operations';
import {
  CONTACT_LOG_HREF,
  COMMUNICATION_HREF,
  parseContactLogFilter,
} from '@/core/communication/validation';
import { toolkitPageFailure } from '@/components/toolkit/server-pages';
import { ContactLogScreen } from './contact-log';
import { CommunicationDashboardScreen } from './dashboard';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function ContactLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filter = parseContactLogFilter((await searchParams).status);
  let view;
  try {
    view = await getContactLogs(filter);
  } catch (error) {
    return toolkitPageFailure(error, 'Contact log', CONTACT_LOG_HREF);
  }
  return (
    <ContactLogScreen
      view={view}
      filter={filter}
      today={currentIndiaDate()}
      actions={{ saveLog: saveContactLogAction }}
    />
  );
}

export async function CommunicationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const month = (await searchParams).month;
  let dashboard;
  try {
    dashboard = await getCommunicationDashboard(month);
  } catch (error) {
    return toolkitPageFailure(error, 'Communication', COMMUNICATION_HREF);
  }
  return (
    <CommunicationDashboardScreen
      dashboard={dashboard}
      currentMonth={currentIndiaMonth()}
    />
  );
}
