// Load Home-Services screens through authorised operations and map failures to shared route states.
import 'server-only';
import { z } from 'zod';
import { AppError } from '../../core/errors';
import {
  getHomeServicesAdminWorkspace,
  getHomeServicesDirectory,
  getHomeServicesProvider,
} from '../../core/home-services/operations';
import { HomeServicesAdminView } from './admin';
import {
  HomeServicesDirectoryView,
  HomeServicesProviderView,
} from './resident';
import { HomeServicesRouteState } from './shared';

export const HOME_SERVICES_PAGE_METADATA = {
  title: 'Home services | Homeish',
  robots: { index: false, follow: false },
};

function pageFailure(
  error: unknown,
  title: string,
  returnHref: string,
  retryHref: string,
) {
  if (!(error instanceof AppError) || error.code === 'INTERNAL_ERROR')
    throw error;
  const kind =
    error.code === 'MODULE_DISABLED'
      ? 'disabled'
      : error.code === 'FORBIDDEN' || error.code === 'UNAUTHENTICATED'
        ? 'denied'
        : 'error';
  return (
    <HomeServicesRouteState
      kind={kind}
      title={title}
      returnHref={returnHref}
      retryHref={kind === 'error' ? retryHref : undefined}
      message={kind === 'error' ? error.message : undefined}
      referenceId={error.referenceId}
    />
  );
}

export async function HomeServicesDirectoryPage() {
  let directory;
  try {
    directory = await getHomeServicesDirectory();
  } catch (error) {
    return pageFailure(error, 'Home services', '/', '/home-services');
  }
  return <HomeServicesDirectoryView directory={directory} />;
}

export async function HomeServicesProviderPage({
  params,
  admin = false,
}: {
  params: Promise<{ providerId: string }>;
  admin?: boolean;
}) {
  const base = admin ? '/admin/home-services' : '/home-services';
  const { providerId } = await params;
  const parsed = z.uuid().safeParse(providerId);
  let detail;
  try {
    if (!parsed.success) throw new AppError('NOT_FOUND');
    detail = await getHomeServicesProvider(parsed.data);
  } catch (error) {
    return pageFailure(
      error,
      'Home-service provider',
      base,
      parsed.success ? `${base}/${parsed.data}` : base,
    );
  }
  return <HomeServicesProviderView detail={detail} backHref={base} />;
}

export async function HomeServicesAdminPage() {
  let workspace;
  try {
    workspace = await getHomeServicesAdminWorkspace();
  } catch (error) {
    return pageFailure(
      error,
      'Home services',
      '/admin',
      '/admin/home-services',
    );
  }
  return <HomeServicesAdminView workspace={workspace} />;
}
