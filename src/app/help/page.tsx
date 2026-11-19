// In-app help for every signed-in society role: articles and getting-started paths for enabled modules.
import { HelpBrowser } from '@/components/help/help-browser';
import { LanguageProvider } from '@/components/language-provider';
import { ErrorPanel } from '@/components/ui/feedback';
import { AppError, createRequestId } from '@/core/errors';
import { buildHelpView } from '@/core/help/filter';
import { translateMessage } from '@/core/i18n/messages';
import {
  buildRequestContext,
  type RequestContext,
} from '@/core/tenancy/request-context';

export const metadata = {
  title: 'Help | Homeish',
  robots: { index: false, follow: false },
};

export default async function HelpPage() {
  let context: RequestContext;
  try {
    context = await buildRequestContext(createRequestId());
  } catch (error) {
    if (
      error instanceof AppError &&
      ['UNAUTHENTICATED', 'SESSION_EXPIRED'].includes(error.code)
    ) {
      return (
        <ErrorPanel
          message="Sign in to read help for your society."
          title="Help unavailable"
        />
      );
    }
    throw error;
  }
  const view = buildHelpView({
    roles: context.roles,
    enabledModules: context.enabledModules,
    languagePreference: context.languagePreference,
    isHindiEnabled: context.isHindiEnabled,
  });
  const t = (source: string) => translateMessage(view.locale, source);

  return (
    <LanguageProvider
      hindiEnabled={context.isHindiEnabled}
      initialLocale={view.locale}
      mode="account"
    >
      <main className="mx-auto grid min-h-dvh max-w-content-default min-w-0 content-start gap-space-5 px-space-4 py-space-6 [overflow-wrap:anywhere]">
        <h1 className="text-title font-semibold">{t('Help')}</h1>
        <p>
          {t(
            'Short answers for the screens your society uses. Open a link to go straight to the screen.',
          )}
        </p>
        <HelpBrowser view={view} />
      </main>
    </LanguageProvider>
  );
}
