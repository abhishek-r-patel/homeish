// Let an admin edit an asset's details.
import {
  ASSET_PAGE_METADATA,
  AssetEditPage,
} from '@/components/asset/server-pages';
export const metadata = ASSET_PAGE_METADATA;
export default function Page(props: { params: Promise<{ assetId: string }> }) {
  return <AssetEditPage {...props} />;
}
