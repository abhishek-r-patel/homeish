// Show the asset register to the admin and committee.
import {
  ASSET_PAGE_METADATA,
  AssetIndexPage,
} from '@/components/asset/server-pages';
import { FeatureTabs } from '@/components/home/feature-tabs';
import { getFeatureTabs } from '@/core/home/feature-tabs';
export const metadata = ASSET_PAGE_METADATA;
export default async function Page() {
  const featureTabs = await getFeatureTabs('upkeep');
  return (
    <div className="grid gap-space-5">
      <FeatureTabs items={featureTabs} />
      <AssetIndexPage />
    </div>
  );
}
