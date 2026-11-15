// Guard-only vehicle lookup with no resident or contact details.
import { GuardVehicleLookup } from '@/components/directory/guard-vehicle-lookup';
import { ErrorPanel } from '@/components/ui/feedback';
import { assertDirectoryLookupAccess } from '@/core/directory/operations';
import { AppError } from '@/core/errors';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';

export const metadata = {
  title: 'Vehicle lookup | Homeish',
  robots: { index: false, follow: false },
};

export default async function GuardDirectoryPage() {
  try {
    await assertDirectoryLookupAccess();
  } catch (error) {
    if (error instanceof AppError && error.code === 'MODULE_DISABLED') {
      return <ModuleDisabledPage moduleKey="directory" returnHref="/guard" />;
    }
    if (error instanceof AppError && error.code === 'FORBIDDEN') {
      return (
        <ErrorPanel
          message="Sign in with an authorized guard account for this society."
          title="Vehicle lookup is restricted"
        />
      );
    }
    throw error;
  }
  return <GuardVehicleLookup />;
}
