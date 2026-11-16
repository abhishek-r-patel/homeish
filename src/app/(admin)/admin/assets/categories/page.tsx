// Show asset categories; admins add, rename and deactivate them.
import {
  ASSET_PAGE_METADATA,
  AssetCategoriesPage,
} from '@/components/asset/server-pages';
export const metadata = ASSET_PAGE_METADATA;
export default function Page() {
  return <AssetCategoriesPage />;
}
