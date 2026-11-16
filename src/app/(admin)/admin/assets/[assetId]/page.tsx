// Show one asset with its maintenance history.
import {
  ASSET_PAGE_METADATA,
  AssetPage,
} from '@/components/asset/server-pages';
export const metadata = ASSET_PAGE_METADATA;
export default function Page(props: { params: Promise<{ assetId: string }> }) {
  return <AssetPage {...props} />;
}
