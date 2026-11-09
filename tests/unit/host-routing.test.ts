// Host allow-list, environment isolation and safe cross-host links.
import { describe, expect, it } from 'vitest';
import { parseRoutingEnvironment } from '../../src/core/config/env-schema';
import {
  resolveSiteSurface,
  siteOrigin,
} from '../../src/core/config/host-routing';

const shared = parseRoutingEnvironment({ VERCEL: '1' });
const beta = parseRoutingEnvironment({ VERCEL: '1', APP_DEPLOYMENT: 'beta' });

describe('host routing', () => {
  it.each([
    ['dwello.vercel.app', 'website'],
    ['demo.dwello.vercel.app', 'demo'],
    ['DWELLO.VERCEL.APP:443', 'website'],
  ])('routes shared host %s to %s', (host, surface) => {
    expect(resolveSiteSurface(host, shared)).toBe(surface);
    expect(resolveSiteSurface(host, beta)).toBeNull();
  });

  it('only serves beta on the beta project', () => {
    expect(resolveSiteSurface('beta.dwello.vercel.app', beta)).toBe('beta');
    expect(resolveSiteSurface('beta.dwello.vercel.app', shared)).toBeNull();
  });

  it.each([
    null,
    '',
    'unknown.dwello.vercel.app',
    'maplewood.dwello.vercel.app',
    'demo.dwello.vercel.app.attacker.test',
    'attacker.test',
    'https://dwello.vercel.app',
    'dwello.vercel.app,attacker.test',
    'dwello.vercel.app@attacker.test',
    'dwello.vercel.app/path',
    'dwello.vercel.app:0',
    'dwello.vercel.app:65536',
    'dwello.vercel.app:3000',
    'localhost:3000',
    'demo.localhost:3000',
  ])('rejects unknown or malformed host %s on Vercel', (host) => {
    expect(resolveSiteSurface(host, shared)).toBeNull();
    expect(resolveSiteSurface(host, beta)).toBeNull();
  });

  it('accepts only explicitly supplied deployment aliases', () => {
    const configuration = parseRoutingEnvironment({
      VERCEL: '1',
      APP_DEPLOYMENT: 'beta',
      VERCEL_URL: 'beta-dwello-abc-team.vercel.app',
      VERCEL_PROJECT_PRODUCTION_URL: 'beta-dwello.vercel.app',
    });
    expect(resolveSiteSurface(configuration.VERCEL_URL!, configuration)).toBe(
      'beta',
    );
    expect(resolveSiteSurface('beta-dwello.vercel.app', configuration)).toBe(
      'beta',
    );
    expect(resolveSiteSurface('other.vercel.app', configuration)).toBeNull();
    expect(
      resolveSiteSurface('demo.dwello.vercel.app', configuration),
    ).toBeNull();
  });

  it('supports local hosts without enabling beta on the shared app', () => {
    const local = parseRoutingEnvironment({});
    expect(resolveSiteSurface('127.0.0.1:3000', local)).toBe('website');
    expect(resolveSiteSurface('[::1]:3000', local)).toBe('website');
    expect(resolveSiteSurface('demo.localhost:3000', local)).toBe('demo');
    expect(resolveSiteSurface('maplewood.localhost:3000', local)).toBeNull();
    expect(resolveSiteSurface('beta.localhost:3000', local)).toBeNull();
    expect(resolveSiteSurface('unknown.localhost:3000', local)).toBeNull();
    const localBeta = parseRoutingEnvironment({ APP_DEPLOYMENT: 'beta' });
    expect(resolveSiteSurface('localhost:3000', localBeta)).toBe('beta');
    expect(resolveSiteSurface('beta.localhost:3000', localBeta)).toBe('beta');
    expect(resolveSiteSurface('demo.localhost:3000', localBeta)).toBeNull();
  });

  it('builds canonical public links and preserves local ports', () => {
    expect(siteOrigin('demo', 'dwello-abc-team.vercel.app', shared)).toBe(
      'https://demo.dwello.vercel.app',
    );
    expect(siteOrigin('website', 'maplewood.dwello.vercel.app', shared)).toBe(
      'https://dwello.vercel.app',
    );
    expect(
      siteOrigin('demo', '127.0.0.1:3000', parseRoutingEnvironment({})),
    ).toBe('http://demo.localhost:3000');
  });

  it('validates deployment configuration without exposing values', () => {
    expect(() => parseRoutingEnvironment({ APP_DEPLOYMENT: 'wrong' })).toThrow(
      'APP_DEPLOYMENT',
    );
    expect(() =>
      parseRoutingEnvironment({ APP_BASE_DOMAIN: 'https://bad.test' }),
    ).toThrow('APP_BASE_DOMAIN');
  });
});
