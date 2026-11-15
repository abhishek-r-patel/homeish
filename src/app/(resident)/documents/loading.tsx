// Keep resident document navigation responsive without showing placeholder files.
import { DocumentRouteState } from '@/components/document/workspace';
export default function Loading() {
  return <DocumentRouteState kind="loading" />;
}
