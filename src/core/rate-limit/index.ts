// Enforce named fixed-window policies without persisting raw identifiers.
import 'server-only';
import { AppError } from '../errors';
import { consumeRateLimitKey } from '../privileged';
import { serverEnvironment } from '../config/server-env';
import { scrubLogText } from '../logging/scrub';

export type RateLimitPolicy = {
  key: string;
  limit: number;
  windowSeconds: number;
  failureMode: 'closed' | 'open';
};

export const RATE_LIMIT_POLICIES = {
  authRequestCodeEmailCooldown: {
    key: 'login:email-purpose:cooldown',
    limit: 1,
    windowSeconds: 30,
    failureMode: 'closed',
  },
  authRequestCodeEmailHourly: {
    key: 'login:email-purpose:hourly',
    limit: 5,
    windowSeconds: 3600,
    failureMode: 'closed',
  },
  authRequestCodeIpHourly: {
    key: 'login:ip:hourly',
    limit: 20,
    windowSeconds: 3600,
    failureMode: 'closed',
  },
  authVerifyCodeEmailHourly: {
    key: 'verify:email:hourly',
    limit: 10,
    windowSeconds: 3600,
    failureMode: 'closed',
  },
  authVerifyCodeIpHourly: {
    key: 'verify:ip:hourly',
    limit: 30,
    windowSeconds: 3600,
    failureMode: 'closed',
  },
  developerAuthFailures: {
    key: 'developer:email-ip:failures',
    limit: 5,
    windowSeconds: 900,
    failureMode: 'closed',
  },
  visitorPreApprovalGuardFailures: {
    key: 'visitor:guard-session:failures',
    limit: 10,
    windowSeconds: 600,
    failureMode: 'closed',
  },
  visitorPreApprovalSocietyFailures: {
    key: 'visitor:society:failures',
    limit: 30,
    windowSeconds: 600,
    failureMode: 'closed',
  },
  registrationLookupIpHourly: {
    key: 'registration:lookup:ip-hourly',
    limit: 10,
    windowSeconds: 3600,
    failureMode: 'closed',
  },
  registrationLookupIpDaily: {
    key: 'registration:lookup:ip-daily',
    limit: 30,
    windowSeconds: 86400,
    failureMode: 'closed',
  },
  registrationSubmitEmailDaily: {
    key: 'registration:submit:email-daily',
    limit: 3,
    windowSeconds: 86400,
    failureMode: 'open',
  },
  billingSubmitUserHourly: {
    key: 'billing:submit:user-hourly',
    limit: 10,
    windowSeconds: 3600,
    failureMode: 'open',
  },
  fileUploadUserHourly: {
    key: 'files:upload:user-hourly',
    limit: 30,
    windowSeconds: 3600,
    failureMode: 'open',
  },
  fileUploadGuardHourly: {
    key: 'files:upload:guard-hourly',
    limit: 120,
    windowSeconds: 3600,
    failureMode: 'open',
  },
  clientErrorsMinute: {
    key: 'client-errors:minute',
    limit: 20,
    windowSeconds: 60,
    failureMode: 'open',
  },
  pushSubscriptionsUserHourly: {
    key: 'push-subscriptions:user-hourly',
    limit: 10,
    windowSeconds: 3600,
    failureMode: 'open',
  },
  exportsUserHourly: {
    key: 'exports:user-hourly',
    limit: 5,
    windowSeconds: 3600,
    failureMode: 'open',
  },
  otherWritesUserMinute: {
    key: 'writes:user-minute',
    limit: 120,
    windowSeconds: 60,
    failureMode: 'open',
  },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

async function hashIdentifier(scope: string, identifier: string) {
  const material = [
    serverEnvironment.server.RATE_LIMIT_HASH_SALT,
    scope,
    identifier,
  ].join('\0');
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(material),
  );
  const hashedIdentifier = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `${scope}:${hashedIdentifier}`;
}

export async function hashRateLimitIdentifier(
  scope: string,
  identifier: string,
): Promise<string> {
  if (
    !scope.trim() ||
    scope.length > 100 ||
    !identifier.trim() ||
    identifier.length > 512
  ) {
    throw new TypeError('Hashed identity must be non-empty and short.');
  }
  return hashIdentifier(scope, identifier);
}

export async function enforceRateLimit(
  policyName: RateLimitPolicyName,
  identifier: string,
  requestId: string,
): Promise<void> {
  const policy = RATE_LIMIT_POLICIES[policyName];
  if (!identifier.trim() || identifier.length > 512) {
    throw new TypeError(
      'Rate-limit identity must be a non-empty short string.',
    );
  }

  let result: Awaited<ReturnType<typeof consumeRateLimitKey>>;
  try {
    const key = await hashIdentifier(policy.key, identifier);
    result = await consumeRateLimitKey(key, policy.limit, policy.windowSeconds);
  } catch {
    console.error('Homeish rate-limit store unavailable.', {
      requestId: scrubLogText(requestId),
      policy: policyName,
      failureMode: policy.failureMode,
    });
    if (policy.failureMode === 'closed') {
      throw new AppError('RATE_LIMITED', {
        retryAfterSeconds: policy.windowSeconds,
      });
    }
    return;
  }

  if (!result.allowed) {
    throw new AppError('RATE_LIMITED', {
      retryAfterSeconds: result.retry_after_seconds,
    });
  }
}
