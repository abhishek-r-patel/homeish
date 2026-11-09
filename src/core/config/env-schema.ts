// Shared schemas for public and server-only environment configuration.
import { z } from 'zod';

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const publicSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['local', 'preview', 'staging', 'production']),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
});

const serverSchema = z.object({
  APP_VERSION: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  BREVO_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().min(1).optional(),
  DEVELOPER_ALERT_EMAIL: z.string().email().optional(),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().url(),
  SENTRY_DSN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  CRON_SECRET: z.string().min(1).optional(),
  GUARD_SESSION_SECRET: z.string().min(32),
  RATE_LIMIT_HASH_SALT: z.string().min(32),
});

const publicNames = [
  'NEXT_PUBLIC_APP_ENV',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'NEXT_PUBLIC_SENTRY_DSN',
] as const;

const serverNames = [
  'APP_VERSION',
  'SUPABASE_SERVICE_ROLE_KEY',
  'BREVO_API_KEY',
  'EMAIL_FROM_ADDRESS',
  'EMAIL_FROM_NAME',
  'DEVELOPER_ALERT_EMAIL',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'SENTRY_DSN',
  'CRON_SECRET',
  'GUARD_SESSION_SECRET',
  'RATE_LIMIT_HASH_SALT',
] as const;

function reportInvalidVariables(
  issues: ReadonlyArray<{ path: PropertyKey[] }>,
): never {
  const names = [
    ...new Set(issues.map((issue) => String(issue.path[0]))),
  ].sort();
  throw new Error(`Invalid environment variables: ${names.join(', ')}`);
}

export function parsePublicEnvironment(source: EnvironmentSource) {
  const result = publicSchema.safeParse(
    Object.fromEntries(publicNames.map((name) => [name, source[name]])),
  );

  if (!result.success) {
    reportInvalidVariables(result.error.issues);
  }

  const publicEnvironment = result.data;
  if (
    (publicEnvironment.NEXT_PUBLIC_APP_ENV === 'staging' ||
      publicEnvironment.NEXT_PUBLIC_APP_ENV === 'production') &&
    !publicEnvironment.NEXT_PUBLIC_SENTRY_DSN
  ) {
    throw new Error('Missing environment variables: NEXT_PUBLIC_SENTRY_DSN');
  }

  return publicEnvironment;
}

export function parseServerEnvironment(source: EnvironmentSource) {
  const publicEnvironment = parsePublicEnvironment(source);
  const result = serverSchema.safeParse(
    Object.fromEntries(serverNames.map((name) => [name, source[name]])),
  );

  if (!result.success) {
    reportInvalidVariables(result.error.issues);
  }

  const serverEnvironment = result.data;
  const requiredNames = [
    'APP_VERSION',
    'SUPABASE_SERVICE_ROLE_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_SUBJECT',
    'GUARD_SESSION_SECRET',
    'RATE_LIMIT_HASH_SALT',
  ];

  if (
    publicEnvironment.NEXT_PUBLIC_APP_ENV === 'staging' ||
    publicEnvironment.NEXT_PUBLIC_APP_ENV === 'production'
  ) {
    requiredNames.push(
      'BREVO_API_KEY',
      'EMAIL_FROM_ADDRESS',
      'EMAIL_FROM_NAME',
      'DEVELOPER_ALERT_EMAIL',
      'SENTRY_DSN',
      'CRON_SECRET',
    );
  }

  const missingNames = requiredNames.filter(
    (name) => !serverEnvironment[name as keyof typeof serverEnvironment],
  );

  if (missingNames.length > 0) {
    throw new Error(
      `Missing environment variables: ${missingNames.join(', ')}`,
    );
  }

  return { public: publicEnvironment, server: serverEnvironment };
}
