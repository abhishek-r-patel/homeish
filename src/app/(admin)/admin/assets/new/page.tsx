// Let an admin add an asset to the register.
import {
  ASSET_PAGE_METADATA,
  AssetNewPage,
} from '@/components/asset/server-pages';
export const metadata = ASSET_PAGE_METADATA;
export default function Page() {
  return <AssetNewPage />;
}
