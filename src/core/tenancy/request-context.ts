// Verify the session and rebuild society access from current database state.
import { AppError, createRequestId } from '../errors';
import type { Database } from '../db/database.types';
import { createUserSupabaseClient } from '../db/server-client';
import { scrubLogData, scrubLogText } from '../logging/scrub';
import {
  isModuleKey,
  isSocietyRole,
  type ModuleKey,
  type SocietyRole,
} from '../permissions';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SocietyStatus = 'trial' | 'active' | 'suspended' | 'archived';

export interface ActiveMembership {
  societyId: string;
  roles: readonly SocietyRole[];
}

export interface RequestLogger {
  debug(event: string, data?: unknown): void;
  info(event: string, data?: unknown): void;
  warn(event: string, data?: unknown): void;
  error(event: string, data?: unknown): void;
}

export interface RequestContext {
  requestId: string;
  userId: string;
  db: SupabaseClient<Database>;
  memberships: readonly ActiveMembership[];
  societyId: string | null;
  societyStatus: SocietyStatus | null;
  roles: readonly SocietyRole[];
  enabledModules: ReadonlySet<ModuleKey>;
  isDeveloper: boolean;
  mfaVerified: boolean;
  logger: RequestLogger;
}

function isSocietyStatus(status: string): status is SocietyStatus {
  return ['trial', 'active', 'suspended', 'archived'].includes(status);
}

function parseRoles(roles: readonly string[]): SocietyRole[] {
  if (!roles.every(isSocietyRole)) {
    throw new Error('Membership contains an unsupported role.');
  }
  return [...new Set(roles)];
}

function createRequestLogger(requestId: string): RequestLogger {
  const write = (
    level: 'debug' | 'info' | 'warn' | 'error',
    event: string,
    data?: unknown,
  ) => {
    const safeData = data === undefined ? undefined : scrubLogData(data);
    console[level]('Homeish request event.', {
      requestId,
      event: scrubLogText(event),
      ...(safeData === undefined ? {} : { data: safeData }),
    });
  };
  return {
    debug: (event, data) => write('debug', event, data),
    info: (event, data) => write('info', event, data),
    warn: (event, data) => write('warn', event, data),
    error: (event, data) => write('error', event, data),
  };
}

export async function buildRequestContext(
  requestId: string,
): Promise<RequestContext> {
  const { client, activeSocietyId } = await createUserSupabaseClient();
  const verifiedRequestId = createRequestId(requestId);
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) {
    if (authError.name === 'AuthSessionMissingError') {
      throw new AppError('UNAUTHENTICATED');
    }
    if (authError.status === 401) {
      throw new AppError('SESSION_EXPIRED');
    }
    throw new AppError('INTEGRATION_FAILED');
  }
  if (!authData.user) {
    throw new AppError('UNAUTHENTICATED');
  }

  const { data: membershipRows, error: membershipsError } = await client
    .from('memberships')
    .select('society_id, roles')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');
  if (membershipsError) {
    throw new Error('Could not load the current user memberships.', {
      cause: membershipsError,
    });
  }

  const memberships: ActiveMembership[] = membershipRows.map((membership) => ({
    societyId: membership.society_id,
    roles: parseRoles(membership.roles),
  }));
  const activeMembership =
    memberships.find(({ societyId }) => societyId === activeSocietyId) ??
    (memberships.length === 1 ? memberships[0] : undefined);
  let societyStatus: SocietyStatus | null = null;
  const enabledModules = new Set<ModuleKey>(['core']);

  if (activeMembership) {
    const [societyResult, moduleConfigsResult] = await Promise.all([
      client
        .from('societies')
        .select('status')
        .eq('id', activeMembership.societyId)
        .maybeSingle(),
      client
        .from('module_configs')
        .select('module_key')
        .eq('society_id', activeMembership.societyId)
        .eq('enabled', true),
    ]);
    if (societyResult.error) {
      throw new Error('Could not load the active society state.', {
        cause: societyResult.error,
      });
    }
    if (moduleConfigsResult.error) {
      throw new Error('Could not load enabled society modules.', {
        cause: moduleConfigsResult.error,
      });
    }
    if (societyResult.data) {
      if (!isSocietyStatus(societyResult.data.status)) {
        throw new Error('The active society has an unsupported status.');
      }
      societyStatus = societyResult.data.status;
      for (const { module_key: moduleKey } of moduleConfigsResult.data) {
        if (!isModuleKey(moduleKey)) {
          throw new Error('The active society has an unsupported module.');
        }
        enabledModules.add(moduleKey);
      }
    }
  }

  return {
    requestId: verifiedRequestId,
    userId: authData.user.id,
    db: client,
    memberships,
    societyId: activeMembership?.societyId ?? null,
    societyStatus,
    roles: activeMembership?.roles ?? [],
    enabledModules,
    isDeveloper: false,
    mfaVerified: false,
    logger: createRequestLogger(verifiedRequestId),
  };
}
