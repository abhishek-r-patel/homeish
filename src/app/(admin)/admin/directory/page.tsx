// Manage the society directory as an administrator or review it as committee.
import { DirectoryManagementWorkspace } from '@/components/directory/management-workspace';
import { ErrorPanel } from '@/components/ui/feedback';
import { AppError } from '@/core/errors';
import {
  getDirectoryEmergencyContacts,
  getDirectoryManagementAccess,
  getDirectoryResidents,
  getDirectoryVehicles,
} from '@/core/directory/operations';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';

export const metadata = {
  title: 'Resident & vehicle directory | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminDirectoryPage() {
  let workspace: React.ComponentProps<typeof DirectoryManagementWorkspace>;
  try {
    const [directory, residents, vehicles] = await Promise.all([
      getDirectoryManagementAccess(),
      getDirectoryResidents({ limit: 10, offset: 0 }),
      getDirectoryVehicles({ limit: 10, offset: 0 }),
    ]);
    const units = residents.items.flatMap((resident) =>
      resident.unit_id && resident.unit_number
        ? [{ id: resident.unit_id, number: resident.unit_number }]
        : [],
    );
    const firstUnitId = units[0]?.id;
    const contacts = firstUnitId
      ? await getDirectoryEmergencyContacts(firstUnitId, {
          limit: 10,
          offset: 0,
        })
      : { items: [], total: 0, limit: 10, offset: 0 };

    workspace = {
      canManage: directory.canManage,
      contacts,
      residents,
      units,
      vehicles,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === 'MODULE_DISABLED') {
      return <ModuleDisabledPage moduleKey="directory" returnHref="/home" />;
    }
    if (error instanceof AppError && error.code === 'FORBIDDEN') {
      return (
        <ErrorPanel
          message="Sign in with an administrator or committee account for this society."
          title="Directory management is restricted"
        />
      );
    }
    throw error;
  }
  return (
    <DirectoryManagementWorkspace
      key={JSON.stringify(workspace)}
      {...workspace}
    />
  );
}
