// Resolve explicit public hosts without treating a hostname as authorization.
import type { parseRoutingEnvironment } from './env-schema';
import {
  findReservedSociety,
  reservedSocieties,
  type ReservedSociety,
} from './societies';

export type RoutingConfiguration = ReturnType<typeof parseRoutingEnvironment>;
export type SiteSurface = 'website' | 'demo' | 'beta' | 'society';

export function parseRequestHost(host: string | null) {
  const match = host?.match(
    /^([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[::1\])(?::([0-9]{1,5}))?$/i,
  );
  if (!match || (match[2] && (+match[2] < 1 || +match[2] > 65535))) {
    return null;
  }
  return { hostname: match[1].toLowerCase(), port: match[2] };
}

// Societies live only on the shared deployment; beta never serves society hosts.
export function resolveSociety(
  host: string | null,
  configuration: RoutingConfiguration,
  societies: readonly ReservedSociety[] = reservedSocieties,
): ReservedSociety | null {
  const parsed = parseRequestHost(host);
  if (!parsed || configuration.APP_DEPLOYMENT === 'beta') return null;
  const { hostname, port } = parsed;
  let suffix: string | null = null;
  if (configuration.allowLocalHosts && hostname.endsWith('.localhost')) {
    suffix = '.localhost';
  } else if (!port || port === '443') {
    suffix = `.${configuration.APP_BASE_DOMAIN}`;
  }
  if (!suffix || !hostname.endsWith(suffix)) return null;
  const slug = hostname.slice(0, -suffix.length);
  return slug.includes('.') ? null : findReservedSociety(slug, societies);
}

// Disabled hosts serve only the placeholder; active hosts serve the app but never the developer console.
export function societyServesPath(society: ReservedSociety, pathname: string) {
  if (society.status !== 'active') return pathname === '/';
  return pathname !== '/developer' && !pathname.startsWith('/developer/');
}

export function resolveSiteSurface(
  host: string | null,
  configuration: RoutingConfiguration,
  societies: readonly ReservedSociety[] = reservedSocieties,
): SiteSurface | null {
  const parsed = parseRequestHost(host);
  if (!parsed) return null;
  if (resolveSociety(host, configuration, societies)) return 'society';
  const { hostname, port } = parsed;
  const isBeta = configuration.APP_DEPLOYMENT === 'beta';
  const base = configuration.APP_BASE_DOMAIN;

  if (configuration.allowLocalHosts) {
    if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
      return isBeta ? 'beta' : 'website';
    }
    if (hostname === 'demo.localhost') return isBeta ? null : 'demo';
    if (hostname === 'beta.localhost') return isBeta ? 'beta' : null;
  }

  if (port && port !== '443') return null;
  if (hostname === base) return isBeta ? null : 'website';
  if (hostname === `demo.${base}`) return isBeta ? null : 'demo';
  if (hostname === `beta.${base}`) return isBeta ? 'beta' : null;

  if (
    hostname === configuration.VERCEL_URL ||
    hostname === configuration.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return isBeta ? 'beta' : 'website';
  }
  return null;
}

export function siteOrigin(
  surface: Exclude<SiteSurface, 'society'>,
  host: string,
  configuration: RoutingConfiguration,
): string {
  const parsed = parseRequestHost(host);
  const isLocal =
    configuration.allowLocalHosts &&
    parsed &&
    (['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
      parsed.hostname.endsWith('.localhost'));
  const prefix = surface === 'website' ? '' : `${surface}.`;
  if (isLocal) {
    return `http://${prefix}localhost${parsed.port ? `:${parsed.port}` : ''}`;
  }
  return `https://${prefix}${configuration.APP_BASE_DOMAIN}`;
}
