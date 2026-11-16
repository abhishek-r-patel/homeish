// Show administrator patrol controls or the committee's read-only view.
import {
  PATROL_PAGE_METADATA,
  PatrolAdminPage,
} from '@/components/patrol/server-pages';
export const metadata = PATROL_PAGE_METADATA;
export default function Page() {
  return <PatrolAdminPage />;
}
