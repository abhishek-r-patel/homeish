// Verify request context uses verified identity and current membership state.
import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/core/db/database.types';

vi.mock('../../src/core/db/server-client', () => ({
  createUserSupabaseClient: vi.fn(),
}));

import { createUserSupabaseClient } from '../../src/core/db/server-client';
import { buildRequestContext } from '../../src/core/tenancy/request-context';

const userId = 'cddc7f54-a5cd-4bd0-9cc1-8c11a9157d95';
const activeSocietyId = 'ce62701d-1618-46ed-9435-e53557a65bf4';
const otherSocietyId = '31f809c1-614d-4c87-86d4-e50c2410d2d7';

function createTestClient({
  enabledModules = ['visitor'],
  hindiAvailable = false,
  languagePreference = 'en',
}: {
  enabledModules?: string[];
  hindiAvailable?: boolean;
  languagePreference?: string;
} = {}) {
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );
    if (url.pathname.endsWith('/memberships')) {
      return Response.json([
        { society_id: activeSocietyId, roles: ['admin', 'resident'] },
        { society_id: otherSocietyId, roles: ['guard'] },
      ]);
    }
    if (url.pathname.endsWith('/profiles')) {
      return Response.json({
        status: 'active',
        language_preference: languagePreference,
      });
    }
    if (url.pathname.endsWith('/rpc/session_developer_access')) {
      return Response.json([
        { is_developer_account: false, mfa_verified: false },
      ]);
    }
    if (url.pathname.endsWith('/societies')) {
      return Response.json({
        status: 'active',
        hindi_available: hindiAvailable,
      });
    }
    if (url.pathname.endsWith('/module_configs')) {
      return Response.json(
        enabledModules.map((module_key) => ({ module_key })),
      );
    }
    return new Response('Unexpected test request.', { status: 500 });
  };
  const client = createClient<Database>(
    'http://127.0.0.1:54321',
    'test-anon-key',
    { global: { fetch: fetcher } },
  );
  vi.spyOn(client.auth, 'getUser').mockResolvedValue({
    data: {
      user: {
        id: userId,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-01-01T00:00:00Z',
      },
    },
    error: null,
  });
  return client;
}

describe('buildRequestContext', () => {
  beforeEach(() => {
    vi.mocked(createUserSupabaseClient).mockReset();
  });

  it('uses the cookie only when it matches an active membership', async () => {
    const client = createTestClient();
    vi.mocked(createUserSupabaseClient).mockResolvedValue({
      client,
      activeSocietyId,
    });

    const context = await buildRequestContext(
      '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
    );

    expect(context).toMatchObject({
      userId,
      societyId: activeSocietyId,
      societyStatus: 'active',
      languagePreference: 'en',
      isHindiEnabled: false,
      roles: ['admin', 'resident'],
      isDeveloper: false,
      isDeveloperAccount: false,
      mfaVerified: false,
    });
    expect(context.enabledModules.has('core')).toBe(true);
    expect(context.enabledModules.has('visitor')).toBe(true);
    expect(context.enabledModules.has('billing')).toBe(false);
    expect(context.memberships).toHaveLength(2);
  });

  it('enables Hindi only when the society allows it and Language Support is enabled', async () => {
    const client = createTestClient({
      enabledModules: ['language'],
      hindiAvailable: true,
      languagePreference: 'hi',
    });
    vi.mocked(createUserSupabaseClient).mockResolvedValue({
      client,
      activeSocietyId,
    });

    const context = await buildRequestContext(
      '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
    );

    expect(context).toMatchObject({
      languagePreference: 'hi',
      isHindiEnabled: true,
    });
  });

  it('keeps Hindi disabled when either availability gate is off', async () => {
    for (const options of [
      { enabledModules: ['visitor'], hindiAvailable: true },
      { enabledModules: ['language'], hindiAvailable: false },
    ]) {
      const client = createTestClient({
        ...options,
        languagePreference: 'hi',
      });
      vi.mocked(createUserSupabaseClient).mockResolvedValue({
        client,
        activeSocietyId,
      });

      const context = await buildRequestContext(
        '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
      );

      expect(context.languagePreference).toBe('hi');
      expect(context.isHindiEnabled).toBe(false);
    }
  });

  it('does not select a society when a hint matches no membership', async () => {
    const client = createTestClient();
    vi.mocked(createUserSupabaseClient).mockResolvedValue({
      client,
      activeSocietyId: '00000000-0000-0000-0000-000000000001',
    });

    const context = await buildRequestContext(
      '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0',
    );

    expect(context.societyId).toBeNull();
    expect(context.societyStatus).toBeNull();
    expect(context.roles).toEqual([]);
    expect([...context.enabledModules]).toEqual(['core']);
  });

  it('rejects a request without a verified user session', async () => {
    const client = createTestClient();
    vi.spyOn(client.auth, 'getUser').mockRestore();
    vi.mocked(createUserSupabaseClient).mockResolvedValue({
      client,
      activeSocietyId: null,
    });

    await expect(
      buildRequestContext('4f05ab7e-17d6-4d74-8a8b-3b37304c83f0'),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects a session for a disabled profile', async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      if (url.pathname.endsWith('/profiles')) {
        return Response.json({ status: 'disabled' });
      }
      return Response.json([]);
    };
    const disabledClient = createClient<Database>(
      'http://127.0.0.1:54321',
      'test-anon-key',
      { global: { fetch: fetcher } },
    );
    vi.spyOn(disabledClient.auth, 'getUser').mockResolvedValue({
      data: {
        user: {
          id: userId,
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2026-01-01T00:00:00Z',
        },
      },
      error: null,
    });
    vi.mocked(createUserSupabaseClient).mockResolvedValue({
      client: disabledClient,
      activeSocietyId,
    });

    await expect(
      buildRequestContext('4f05ab7e-17d6-4d74-8a8b-3b37304c83f0'),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
