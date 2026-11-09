// Verify permission maps union roles and the authorization pipeline fails closed.
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { authorizeRequest } from '../../src/core/permissions/authorize';
import { hasPermission } from '../../src/core/permissions';
import type { RequestContext as Context } from '../../src/core/tenancy/request-context';
import type { Database } from '../../src/core/db/database.types';

function requestContext(
  overrides: Partial<Omit<Context, 'db' | 'logger'>> = {},
): Context {
  return {
    requestId: '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
    userId: 'cddc7f54-a5cd-4bd0-9cc1-8c11a9157d95',
    db: createClient<Database>('http://localhost:54321', 'test-anon-key'),
    memberships: [],
    societyId: 'ce62701d-1618-46ed-9435-e53557a65bf4',
    societyStatus: 'active',
    roles: ['resident'],
    enabledModules: new Set(['core', 'visitor']),
    isDeveloper: false,
    mfaVerified: false,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
}

describe('permission maps', () => {
  it('unions permissions across all active roles', () => {
    expect(hasPermission(['resident', 'committee'], 'core', 'audit:read')).toBe(
      true,
    );
    expect(hasPermission(['resident'], 'core', 'audit:read')).toBe(false);
  });

  it('denies permissions missing from a module map', () => {
    expect(hasPermission(['admin'], 'visitor', 'visitor:manage')).toBe(false);
    expect(
      hasPermission(['admin'], 'visitor', 'visitor:manage', {
        visitor: { 'visitor:manage': ['guard'] },
      }),
    ).toBe(false);
  });
});

describe('authorization pipeline', () => {
  it('allows active society reads and checks module then role permission', () => {
    expect(() =>
      authorizeRequest(requestContext({ roles: ['committee'] }), {
        moduleKey: 'core',
        permission: 'audit:read',
      }),
    ).not.toThrow();

    expect(() =>
      authorizeRequest(requestContext(), {
        moduleKey: 'visitor',
        permission: 'visitor:approve',
      }),
    ).toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('blocks archived societies and writes to suspended societies', () => {
    expect(() =>
      authorizeRequest(requestContext({ societyStatus: 'archived' }), {
        moduleKey: 'core',
      }),
    ).toThrowError(expect.objectContaining({ code: 'SOCIETY_ARCHIVED' }));
    expect(() =>
      authorizeRequest(requestContext({ societyStatus: 'suspended' }), {
        moduleKey: 'core',
        write: true,
      }),
    ).toThrowError(expect.objectContaining({ code: 'SOCIETY_SUSPENDED' }));
    expect(() =>
      authorizeRequest(requestContext({ societyStatus: 'suspended' }), {
        moduleKey: 'core',
      }),
    ).not.toThrow();
  });

  it('denies disabled modules and requires developer identity plus recent MFA', () => {
    expect(() =>
      authorizeRequest(requestContext(), { moduleKey: 'billing' }),
    ).toThrowError(expect.objectContaining({ code: 'MODULE_DISABLED' }));
    expect(() =>
      authorizeRequest(requestContext(), {
        developer: true,
        requireRecentMfa: true,
      }),
    ).toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(() =>
      authorizeRequest(requestContext({ isDeveloper: true }), {
        developer: true,
        requireRecentMfa: true,
      }),
    ).toThrowError(expect.objectContaining({ code: 'MFA_REQUIRED' }));
    expect(() =>
      authorizeRequest(
        requestContext({ isDeveloper: true, mfaVerified: true }),
        { developer: true, requireRecentMfa: true },
      ),
    ).not.toThrow();
  });

  it('requires an active society for tenant operations', () => {
    expect(() =>
      authorizeRequest(
        requestContext({ societyId: null, societyStatus: null }),
        { moduleKey: 'core' },
      ),
    ).toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});
