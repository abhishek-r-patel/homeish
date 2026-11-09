// Thin host-aware entry route for the website and environment entry screens.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { serverEnvironment } from '@/core/config/server-env';
import { resolveSiteSurface, siteOrigin } from '@/core/config/host-routing';
import { EnvironmentPage } from '@/core/website/environment-page';
import { MarketingPage } from '@/core/website/marketing-page';

async function requestSite() {
  const host = (await headers()).get('host');
  const configuration = serverEnvironment.routing;
  const surface = resolveSiteSurface(host, configuration);
  if (!surface || !host) notFound();
  return { surface, host, configuration };
}

export async function generateMetadata(): Promise<Metadata> {
  const { surface, host, configuration } = await requestSite();
  return {
    title:
      surface === 'website'
        ? 'Dwello | Society life, thoughtfully organised'
        : `Dwello | ${surface}`,
    description:
      'A clearer everyday for your society. Explore Dwello’s planned visitor, delivery, maintenance and service-request tools.',
    robots:
      surface === 'website'
        ? { index: true, follow: true }
        : { index: false, follow: false },
    alternates: { canonical: siteOrigin(surface, host, configuration) },
  };
}

export default async function HomePage() {
  const { surface, host, configuration } = await requestSite();
  const websiteOrigin = siteOrigin('website', host, configuration);
  return surface === 'website' ? (
    <MarketingPage
      demoOrigin={siteOrigin('demo', host, configuration)}
      websiteOrigin={websiteOrigin}
    />
  ) : (
    <EnvironmentPage surface={surface} websiteOrigin={websiteOrigin} />
  );
}
