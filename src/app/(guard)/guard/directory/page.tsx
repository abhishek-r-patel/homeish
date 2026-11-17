// Guard-only vehicle lookup with no resident or contact details.
import { GuardVehicleLookup } from '@/components/directory/guard-vehicle-lookup';
import { ErrorPanel } from '@/components/ui/feedback';
import { assertDirectoryLookupAccess } from '@/core/directory/operations';
import { AppError } from '@/core/errors';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';

export const metadata = {
  title: 'Vehicle lookup | Homeish',
  robots: { index: false, follow: false },
};

export default async function GuardDirectoryPage() {
  const locale = await getRequestLocale();
  const t = (source: string) => translateMessage(locale, source);
  try {
    await assertDirectoryLookupAccess();
  } catch (error) {
    if (error instanceof AppError && error.code === 'MODULE_DISABLED') {
      return <ModuleDisabledPage moduleKey="directory" returnHref="/guard" />;
    }
    if (error instanceof AppError && error.code === 'FORBIDDEN') {
      return (
        <ErrorPanel
          message={t(
            'Sign in with an authorized guard account for this society.',
          )}
          title={t('Vehicle lookup is restricted')}
        />
      );
    }
    throw error;
  }
  return <GuardVehicleLookup />;
}
