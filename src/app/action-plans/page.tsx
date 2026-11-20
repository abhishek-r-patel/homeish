// "My tasks": read-only committee action-plan tasks for their owner; managers continue to the full workspace.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LanguageProvider } from '@/components/language-provider';
import { MyTasksView } from '@/components/toolkit/action-plans';
import {
  ACTION_PLANS_HREF,
  TOOLKIT_PAGE_ROBOTS,
  toolkitPageFailure,
} from '@/components/toolkit/server-pages';
import { AppError, createRequestId } from '@/core/errors';
import { translateMessage } from '@/core/i18n/messages';
import {
  buildRequestContext,
  type RequestContext,
} from '@/core/tenancy/request-context';
import { getActionPlans } from '@/core/toolkit/operations';

export const metadata = {
  title: 'My tasks | Homeish',
  robots: TOOLKIT_PAGE_ROBOTS,
};

export default async function MyActionPlanTasksPage() {
  let context: RequestContext;
  try {
    context = await buildRequestContext(createRequestId());
  } catch (error) {
    if (
      error instanceof AppError &&
      ['UNAUTHENTICATED', 'SESSION_EXPIRED'].includes(error.code)
    ) {
      redirect('/login');
    }
    throw error;
  }
  if (context.roles.includes('admin') || context.roles.includes('committee')) {
    redirect(ACTION_PLANS_HREF);
  }
  const t = (source: string) =>
    translateMessage(context.languagePreference, source);
  let view: Awaited<ReturnType<typeof getActionPlans>> | undefined;
  let failure;
  try {
    view = await getActionPlans();
  } catch (error) {
    failure = toolkitPageFailure(error, 'My tasks', '/action-plans');
  }
  const content = view ? <MyTasksView view={view} /> : failure;
  return (
    <LanguageProvider
      hindiEnabled={context.isHindiEnabled}
      initialLocale={context.languagePreference}
      mode="account"
    >
      <main className="mx-auto grid min-h-dvh max-w-content-default min-w-0 content-start gap-space-5 px-space-4 py-space-6 [overflow-wrap:anywhere]">
        <Link href="/" className="text-brand underline">
          {t('Back to home')}
        </Link>
        {content}
      </main>
    </LanguageProvider>
  );
}
