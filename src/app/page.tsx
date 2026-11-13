// Thin host-aware entry route for the website and environment entry screens.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { serverEnvironment } from '@/core/config/server-env';
import {
  resolveSiteSurface,
  resolveSociety,
  siteOrigin,
} from '@/core/config/host-routing';
import { lookupSocietyHost } from '@/core/privileged';
import { EnvironmentPage } from '@/core/website/environment-page';
import { MarketingPage } from '@/core/website/marketing-page';
import { SocietyHomePage } from '@/core/website/society-home-page';
import { SocietyUnavailablePage } from '@/core/website/society-unavailable-page';

async function requestSite() {
  const host = (await headers()).get('host');
  const configuration = serverEnvironment.routing;
  const surface = resolveSiteSurface(host, configuration);
  if (!surface || !host) notFound();
  return {
    surface,
    host,
    configuration,
    society: resolveSociety(host, configuration),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { surface, host, configuration, society } = await requestSite();
  if (surface === 'society') {
    return {
      title: `Homeish | ${society?.name ?? 'Society'}`,
      robots: { index: false, follow: false },
    };
  }
  return {
    title:
      surface === 'website'
        ? 'Homeish | A little more like home'
        : `Homeish | ${surface}`,
    description:
      'A little more like home. Explore Homeish’s planned visitor, delivery, maintenance and service-request tools for your society.',
    robots:
      surface === 'website'
        ? { index: true, follow: true }
        : { index: false, follow: false },
    alternates: { canonical: siteOrigin(surface, host, configuration) },
  };
}

export default async function HomePage() {
  const { surface, host, configuration, society } = await requestSite();
  const websiteOrigin = siteOrigin('website', host, configuration);
  if (surface === 'society') {
    if (!society) notFound();
    // The code entry alone never opens a host: the database society must carry the same slug.
    const record =
      society.status === 'active'
        ? await lookupSocietyHost(society.slug)
        : null;
    if (record) {
      return (
        <SocietyHomePage
          societyName={record.name}
          websiteOrigin={websiteOrigin}
        />
      );
    }
    return (
      <SocietyUnavailablePage society={society} websiteOrigin={websiteOrigin} />
    );
  }
  return surface === 'website' ? (
    <MarketingPage
      demoOrigin={siteOrigin('demo', host, configuration)}
      websiteOrigin={websiteOrigin}
    />
  ) : (
    <EnvironmentPage surface={surface} websiteOrigin={websiteOrigin} />
  );
}
