// Show the printable A4 sheet of patrol checkpoint QR codes for administrators.
import {
  PATROL_PAGE_METADATA,
  PatrolPrintPage,
} from '@/components/patrol/server-pages';
export const metadata = PATROL_PAGE_METADATA;
export default function Page() {
  return <PatrolPrintPage />;
}
