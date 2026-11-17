// Render the read-only resident directory without treating denied access as empty data.
import { ResidentDirectory } from '../../../components/directory/resident-directory';
import { ErrorPanel } from '../../../components/ui/feedback';
import { HouseholdDirectoryControls } from '../../../components/directory/household-controls';
import {
  getDirectoryEmergencyContacts,
  getDirectoryMyHouseholds,
  getDirectoryMyPreferences,
  getDirectoryResidents,
  getDirectoryVehicles,
} from '../../../core/directory/operations';
import { AppError, createRequestId } from '../../../core/errors';
import { ModuleDisabledPage } from '../../../core/modules/module-disabled-page';
import { buildRequestContext } from '../../../core/tenancy/request-context';
import { getRequestLocale } from '../../../core/i18n/request-locale';
import { translateMessage } from '../../../core/i18n/messages';

export const metadata = {
  title: 'Resident directory | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentDirectoryPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  let residents: Awaited<ReturnType<typeof getDirectoryResidents>>;
  let householdControls: {
    contacts: {
      unitId: string;
      page: Awaited<ReturnType<typeof getDirectoryEmergencyContacts>>;
    }[];
    households: Awaited<ReturnType<typeof getDirectoryMyHouseholds>>;
    preferences: Awaited<ReturnType<typeof getDirectoryMyPreferences>>;
    vehicles: Awaited<ReturnType<typeof getDirectoryVehicles>>;
  } | null = null;
  try {
    const context = await buildRequestContext(createRequestId());
    residents = await getDirectoryResidents({ limit: 10, offset: 0 });
    if (
      context.roles.includes('resident') &&
      !context.roles.includes('admin') &&
      !context.roles.includes('committee')
    ) {
      const [preferences, households, vehicles] = await Promise.all([
        getDirectoryMyPreferences(),
        getDirectoryMyHouseholds(),
        getDirectoryVehicles({ limit: 10, offset: 0 }),
      ]);
      const contacts = await Promise.all(
        households.map(async ({ unit_id: unitId }) => ({
          unitId,
          page: await getDirectoryEmergencyContacts(unitId, {
            limit: 10,
            offset: 0,
          }),
        })),
      );
      householdControls = {
        contacts,
        households,
        preferences,
        vehicles,
      };
    }
  } catch (error) {
    if (error instanceof AppError && error.code === 'MODULE_DISABLED') {
      return <ModuleDisabledPage moduleKey="directory" returnHref="/home" />;
    }
    if (error instanceof AppError && error.code === 'FORBIDDEN') {
      return (
        <section className="grid gap-space-5">
          <h1 className="text-title font-semibold">
            {t('Resident directory')}
          </h1>
          <ErrorPanel
            message={t(
              'An active household membership is required to browse the directory. Contact your society administrator if you need help with your access.',
            )}
            title={t('Directory access is not available')}
          />
        </section>
      );
    }
    throw error;
  }
  return (
    <div className="grid gap-space-6">
      <ResidentDirectory
        key={JSON.stringify(residents)}
        residents={residents}
      />
      {householdControls ? (
        <HouseholdDirectoryControls
          key={JSON.stringify(householdControls)}
          {...householdControls}
        />
      ) : null}
    </div>
  );
}
