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
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { FeatureTabs } from '@/components/home/feature-tabs';
import { getFeatureTabs } from '@/core/home/feature-tabs';

export const metadata = {
  title: 'Resident & vehicle directory | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminDirectoryPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
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
          message={t(
            'Sign in with an administrator or committee account for this society.',
          )}
          title={t('Directory management is restricted')}
        />
      );
    }
    throw error;
  }
  const featureTabs = await getFeatureTabs('people');
  return (
    <div className="grid gap-space-5">
      <FeatureTabs items={featureTabs} />
      <DirectoryManagementWorkspace
        key={JSON.stringify(workspace)}
        {...workspace}
      />
    </div>
  );
}
