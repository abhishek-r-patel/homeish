// Content Security Policy and static security header rules.
import { describe, expect, it } from 'vitest';
import {
  buildContentSecurityPolicy,
  createNonce,
} from '../../src/core/security/headers';

function directive(policy: string, name: string) {
  return policy
    .split('; ')
    .find((part) => part.startsWith(`${name} `))
    ?.split(' ')
    .slice(1);
}

describe('buildContentSecurityPolicy', () => {
  const production = buildContentSecurityPolicy({
    nonce: 'abc123',
    supabaseUrl: 'https://example.supabase.co/',
    isDevelopment: false,
    isHttps: true,
  });

  it('allows only nonce-bearing scripts in production', () => {
    expect(directive(production, 'script-src')).toEqual([
      "'self'",
      "'nonce-abc123'",
      "'strict-dynamic'",
    ]);
    expect(production).toContain("frame-ancestors 'none'");
    expect(production).toContain("object-src 'none'");
    expect(production).toContain('upgrade-insecure-requests');
  });

  it('allows the Supabase origin for API, realtime and signed images only', () => {
    expect(directive(production, 'connect-src')).toEqual([
      "'self'",
      'https://example.supabase.co',
      'wss://example.supabase.co',
    ]);
    expect(directive(production, 'img-src')).toContain(
      'https://example.supabase.co',
    );
  });

  it('adds development allowances only in development over plain HTTP', () => {
    const development = buildContentSecurityPolicy({
      nonce: 'n',
      supabaseUrl: 'not a url',
      isDevelopment: true,
      isHttps: false,
    });
    expect(directive(development, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(development, 'connect-src')).toEqual(["'self'", 'ws:']);
    expect(development).not.toContain('upgrade-insecure-requests');
  });
});

describe('createNonce', () => {
  it('creates distinct base64 nonces', () => {
    const first = createNonce();
    expect(first).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(first);
  });
});
