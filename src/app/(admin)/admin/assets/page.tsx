// Show the asset register to the admin and committee.
import {
  ASSET_PAGE_METADATA,
  AssetIndexPage,
} from '@/components/asset/server-pages';
export const metadata = ASSET_PAGE_METADATA;
export default function Page() {
  return <AssetIndexPage />;
}
