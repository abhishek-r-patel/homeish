// Unit tests for environment validation and public/server separation.
import { describe, expect, it } from 'vitest';
import {
  parsePublicEnvironment,
  parseServerEnvironment,
} from '../../src/core/config/env-schema';

const localEnvironment = {
  NEXT_PUBLIC_APP_ENV: 'local',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-placeholder',
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'local-vapid-public-placeholder',
  APP_VERSION: '0.1.0-local',
  SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-placeholder',
  VAPID_PRIVATE_KEY: 'local-vapid-private-placeholder',
  VAPID_SUBJECT: 'mailto:developer@example.test',
  GUARD_SESSION_SECRET: 'replace-with-local-guard-session-secret-32-chars',
  RATE_LIMIT_HASH_SALT: 'replace-with-local-rate-limit-salt-32-characters',
};

describe('environment configuration', () => {
  it('accepts the documented local environment shape', () => {
    expect(
      parseServerEnvironment(localEnvironment).public.NEXT_PUBLIC_APP_ENV,
    ).toBe('local');
  });

  it('reports missing public variables by name without exposing values', () => {
    expect(() => parsePublicEnvironment({})).toThrow('NEXT_PUBLIC_APP_ENV');
    expect(() => parsePublicEnvironment({})).not.toThrow(
      'local-anon-placeholder',
    );
  });

  it('requires production integrations only for staging and production', () => {
    expect(() =>
      parseServerEnvironment({
        ...localEnvironment,
        NEXT_PUBLIC_APP_ENV: 'production',
        NEXT_PUBLIC_SENTRY_DSN: 'https://public@example.test/1',
        SENTRY_DSN: 'https://server@example.test/1',
      }),
    ).toThrow('BREVO_API_KEY');
  });

  it('accepts a deployment-configured positive daily Brevo quota', () => {
    const parsed = parseServerEnvironment({
      ...localEnvironment,
      BREVO_DAILY_EMAIL_QUOTA: '450',
    });
    expect(parsed.server.BREVO_DAILY_EMAIL_QUOTA).toBe(450);
    expect(() =>
      parseServerEnvironment({
        ...localEnvironment,
        BREVO_DAILY_EMAIL_QUOTA: '0',
      }),
    ).toThrow('BREVO_DAILY_EMAIL_QUOTA');
  });
});
