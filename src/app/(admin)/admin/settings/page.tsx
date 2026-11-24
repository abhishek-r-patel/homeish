// Configure self-registration for the active society.
import Link from 'next/link';
import { Card } from '@/components/ui/data-display';
import { ErrorPanel } from '@/components/ui/feedback';
import { JoinCodeControls } from '@/components/society/join-code-controls';
import { LanguageSettingsControls } from '@/components/society/language-settings-controls';
import { AmenityCalendarSettings } from '@/components/amenity/settings';
import { DataCleanupControls } from '@/components/compliance/data-cleanup';
import { AppError, createRequestId } from '@/core/errors';
import { getAmenityCalendarSettings } from '@/core/amenity/operations';
import {
  getHindiAvailability,
  getJoinCodeSettings,
} from '@/core/society/operations';
import { buildRequestContext } from '@/core/tenancy/request-context';
import { translateMessage } from '@/core/i18n/messages';
import { getDataCleanupRules } from '@/core/compliance/operations';
import { getManagingBodyName } from '@/core/tenancy/workspace-settings';
import { ManagingBodyName } from '@/components/society/managing-body-name';
import { GettingStartedControl } from '@/components/society/getting-started-control';

export const metadata = {
  title: 'Society settings | Homeish',
  robots: { index: false, follow: false },
};

export default async function SocietySettingsPage() {
  const context = await buildRequestContext(createRequestId());
  const canManage = context.roles.includes('admin');
  const canViewLanguage = canManage || context.roles.includes('committee');
  if (!canViewLanguage) throw new AppError('FORBIDDEN');

  const locale =
    context.languagePreference === 'hi' && context.isHindiEnabled ? 'hi' : 'en';
  const t = (source: string) => translateMessage(locale, source);
  const canViewFunds = context.enabledModules.has('expense') && canViewLanguage;
  const [
    registrationSettings,
    languageSettings,
    amenitySettings,
    cleanupRules,
    managingBodyName,
  ] = await Promise.all([
    canManage ? getJoinCodeSettings(context) : Promise.resolve(null),
    context.enabledModules.has('language')
      ? getHindiAvailability(context)
      : Promise.resolve(null),
    context.enabledModules.has('amenity')
      ? getAmenityCalendarSettings()
      : Promise.resolve(null),
    getDataCleanupRules(),
    getManagingBodyName(context),
  ]);
  if (!canManage && !languageSettings && !amenitySettings && !canViewFunds) {
    return (
      <ErrorPanel
        message={t(
          'Ask your platform developer to enable Language Support for this society.',
        )}
        title={t('Language settings are not enabled')}
      />
    );
  }

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">
          {t(
            canManage
              ? 'Society settings'
              : languageSettings
                ? 'Language settings'
                : 'Society settings',
          )}
        </h1>
        <p className="text-body text-ink-muted">
          {t(
            canManage
              ? 'Manage society registration and language availability.'
              : languageSettings
                ? 'View the languages available to members of this society.'
                : 'Review the society settings available to committee members.',
          )}
        </p>
      </header>
      {registrationSettings ? (
        <Card
          description={t(
            'Requests remain pending until an administrator approves them.',
          )}
          title={t('Society join code')}
        >
          <JoinCodeControls initialJoinCode={registrationSettings.joinCode} />
        </Card>
      ) : null}
      <Card
        description={t(
          'This name appears in the place picker and society work headings.',
        )}
        title={t('Managing body')}
      >
        <ManagingBodyName canManage={canManage} name={managingBodyName} />
      </Card>
      {canManage ? (
        <Card
          description={t(
            'Return the setup checklist to the dashboard after hiding it.',
          )}
          title={t('Getting started')}
        >
          <GettingStartedControl />
        </Card>
      ) : null}
      {!languageSettings && canManage ? (
        <Card
          description={t(
            'Ask your platform developer to enable Language Support for this society.',
          )}
          title={t('Language settings are not enabled')}
        >
          <p className="text-body text-ink-muted">
            {t(
              'English is always available. Hindi is optional for this society.',
            )}
          </p>
        </Card>
      ) : null}
      {languageSettings ? (
        <Card
          description={t(
            'English is always available. Hindi is optional for this society.',
          )}
          title={t('Language availability')}
        >
          <div id="language">
            <LanguageSettingsControls
              canManage={languageSettings.canManage}
              initialHindiAvailable={languageSettings.hindiAvailable}
              initialVersion={languageSettings.version}
            />
          </div>
        </Card>
      ) : null}
      {amenitySettings ? (
        <Card
          description={t(
            'Choose what resident identity, if any, appears on the month calendar.',
          )}
          title={t('Amenities')}
        >
          <AmenityCalendarSettings
            identity={amenitySettings.resident_calendar_identity}
            depositPolicy={amenitySettings.deposit_confirmation_policy}
            directoryEnabled={amenitySettings.directory_enabled}
            canManage={amenitySettings.can_manage}
            settingsAccess={amenitySettings.settingsAccess}
          />
        </Card>
      ) : null}
      {canViewFunds ? (
        <Card
          description={t(
            canManage
              ? 'Name society funds and set the Accounts opening allocations.'
              : 'Review society funds and their Accounts opening allocations.',
          )}
          title={t('Society funds')}
        >
          <Link className="text-brand underline" href="/admin/expenses/funds">
            {t('Open fund management')}
          </Link>
        </Card>
      ) : null}
      <Card
        description={t(
          'Keep records permanently by default, or opt in to audited age-based deletion.',
        )}
        title={t('Data cleanup')}
      >
        <DataCleanupControls canManage={canManage} rules={cleanupRules} />
      </Card>
    </section>
  );
}
