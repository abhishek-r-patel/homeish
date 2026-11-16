// Show the guard's patrol round, checkpoint scanning, incident reporting and shift handover notes.
import {
  PATROL_PAGE_METADATA,
  PatrolGuardPage,
} from '@/components/patrol/server-pages';
export const metadata = PATROL_PAGE_METADATA;
export default function Page() {
  return <PatrolGuardPage />;
}
