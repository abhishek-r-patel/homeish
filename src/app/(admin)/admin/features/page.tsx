// Show every Homeish module and let admins request only switched-off features.
import { FeatureList } from '@/components/home/feature-list';
import { getFeatureList } from '@/core/home/feature-requests';

export const metadata = {
  title: 'Features | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminFeaturesPage() {
  return <FeatureList data={await getFeatureList()} />;
}
