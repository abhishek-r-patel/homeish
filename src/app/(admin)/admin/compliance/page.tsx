// Manage or read the factual society compliance register.
import { ComplianceWorkspaceView } from '@/components/compliance/workspace';
import { getComplianceWorkspace } from '@/core/compliance/operations';

export const metadata = {
  title: 'Compliance register | Homeish',
  robots: { index: false, follow: false },
};

export default async function CompliancePage() {
  return <ComplianceWorkspaceView workspace={await getComplianceWorkspace()} />;
}
