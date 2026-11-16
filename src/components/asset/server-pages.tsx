// Load Asset Register screens through authorised operations and map failures to safe route states.
import 'server-only';
import { AppError } from '../../core/errors';
import {
  getAssetDetail,
  getAssetFormOptions,
  getAssetWorkspace,
} from '../../core/asset/operations';
import { AssetFormView } from './asset-form';
import { AssetCategoriesView } from './categories';
import { AssetDetailView } from './detail';
import { ASSET_BASE_HREF, AssetRouteState } from './shared';
import { AssetWorkspaceView } from './workspace';

export const ASSET_PAGE_METADATA = {
  title: 'Asset Register | Homeish',
  robots: { index: false, follow: false },
};

function pageFailure(error: unknown, retryHref: string, returnHref: string) {
  if (!(error instanceof AppError) || error.code === 'INTERNAL_ERROR')
    throw error;
  const kind =
    error.code === 'MODULE_DISABLED'
      ? 'disabled'
      : error.code === 'FORBIDDEN' || error.code === 'UNAUTHENTICATED'
        ? 'denied'
        : error.code === 'NOT_FOUND'
          ? 'not_found'
          : 'error';
  return (
    <AssetRouteState
      kind={kind}
      returnHref={kind === 'not_found' ? ASSET_BASE_HREF : returnHref}
      retryHref={kind === 'error' ? retryHref : undefined}
      message={kind === 'error' ? error.message : undefined}
      referenceId={error.referenceId}
    />
  );
}

function isBadId(error: unknown) {
  return error instanceof AppError && error.code === 'VALIDATION_FAILED';
}

export async function AssetIndexPage() {
  let workspace;
  try {
    workspace = await getAssetWorkspace();
  } catch (error) {
    return pageFailure(error, ASSET_BASE_HREF, '/');
  }
  return <AssetWorkspaceView workspace={workspace} />;
}

export async function AssetCategoriesPage() {
  let workspace;
  try {
    workspace = await getAssetWorkspace();
  } catch (error) {
    return pageFailure(error, `${ASSET_BASE_HREF}/categories`, ASSET_BASE_HREF);
  }
  return <AssetCategoriesView workspace={workspace} />;
}

export async function AssetNewPage() {
  let options;
  try {
    options = await getAssetFormOptions();
  } catch (error) {
    return pageFailure(error, `${ASSET_BASE_HREF}/new`, ASSET_BASE_HREF);
  }
  return <AssetFormView asset={null} options={options} />;
}

export async function AssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  let detail;
  try {
    detail = await getAssetDetail(assetId);
  } catch (error) {
    if (isBadId(error)) {
      return <AssetRouteState kind="not_found" returnHref={ASSET_BASE_HREF} />;
    }
    return pageFailure(error, `${ASSET_BASE_HREF}/${assetId}`, '/');
  }
  return <AssetDetailView detail={detail} />;
}

export async function AssetEditPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  let detail;
  try {
    detail = await getAssetDetail(assetId);
    if (!detail.can_manage) throw new AppError('FORBIDDEN');
  } catch (error) {
    if (isBadId(error)) {
      return <AssetRouteState kind="not_found" returnHref={ASSET_BASE_HREF} />;
    }
    return pageFailure(
      error,
      `${ASSET_BASE_HREF}/${assetId}/edit`,
      `${ASSET_BASE_HREF}/${assetId}`,
    );
  }
  return (
    <AssetFormView
      asset={detail.asset}
      options={{
        amc_enabled: detail.amc_enabled,
        today: detail.today,
        categories: detail.categories,
        amc_contracts: detail.amc_contracts,
      }}
    />
  );
}
