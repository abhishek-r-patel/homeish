// Load the current user's safe session summary and switch active societies.
import 'server-only';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { AppError, createRequestId, ValidationError } from '../errors';
import { ACTIVE_SOCIETY_COOKIE } from '../db/server-client';
import {
  isModuleKey,
  isSocietyRole,
  type ModuleKey,
  type SocietyRole,
} from '../permissions';
import { buildRequestContext, type SocietyStatus } from './request-context';

const switchSocietySchema = z.object({ societyId: z.string().uuid() }).strict();

export interface SessionSociety {
  id: string;
  name: string;
  status: SocietyStatus;
  membershipStatus: 'active' | 'pending_approval';
  roles: readonly SocietyRole[];
}

export interface SessionSnapshot {
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  societies: readonly SessionSociety[];
  activeSocietyId: string | null;
  roles: readonly SocietyRole[];
  enabledModules: readonly ModuleKey[];
  isDeveloperAccount: boolean;
  mfaVerified: boolean;
}

function assertSocietyStatus(value: string): SocietyStatus {
  if (
    value !== 'trial' &&
    value !== 'active' &&
    value !== 'suspended' &&
    value !== 'archived'
  ) {
    throw new Error('A membership has an unsupported society status.');
  }
  return value;
}

function parseMembershipRoles(roles: readonly string[]): SocietyRole[] {
  if (!roles.every(isSocietyRole)) {
    throw new Error('A membership contains an unsupported role.');
  }
  return [...new Set(roles)];
}

export async function getSession(
  requestId = createRequestId(),
): Promise<SessionSnapshot> {
  const context = await buildRequestContext(requestId);
  const [profileResult, membershipResult] = await Promise.all([
    context.db
      .from('profiles')
      .select('email, full_name, status')
      .eq('id', context.userId)
      .maybeSingle(),
    context.db.rpc('session_memberships'),
  ]);
  if (profileResult.error) {
    throw new Error('Could not load the current user profile.', {
      cause: profileResult.error,
    });
  }
  if (membershipResult.error) {
    throw new Error("Could not load the current user's society list.", {
      cause: membershipResult.error,
    });
  }
  if (!profileResult.data || profileResult.data.status !== 'active') {
    throw new AppError('UNAUTHENTICATED');
  }

  const societies: SessionSociety[] = membershipResult.data.map((row) => {
    if (
      row.membership_status !== 'active' &&
      row.membership_status !== 'pending_approval'
    ) {
      throw new Error('A membership has an unsupported status.');
    }
    return {
      id: row.society_id,
      name: row.society_name,
      status: assertSocietyStatus(row.society_status),
      membershipStatus: row.membership_status,
      roles: parseMembershipRoles(row.roles),
    };
  });
  const enabledModules = [...context.enabledModules];
  if (!enabledModules.every(isModuleKey)) {
    throw new Error('The active society contains an unsupported module.');
  }

  return {
    user: {
      id: context.userId,
      email: profileResult.data.email,
      fullName: profileResult.data.full_name,
    },
    societies,
    activeSocietyId: context.societyId,
    roles: context.roles,
    enabledModules,
    isDeveloperAccount: context.isDeveloperAccount,
    mfaVerified: context.mfaVerified,
  };
}

export async function switchSociety(input: unknown): Promise<void> {
  const parsed = switchSocietySchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError({ societyId: 'Choose a valid society.' });
  }
  const context = await buildRequestContext(createRequestId());
  if (
    !context.memberships.some(
      (membership) => membership.societyId === parsed.data.societyId,
    )
  ) {
    throw new AppError('FORBIDDEN');
  }

  (await cookies()).set(ACTIVE_SOCIETY_COOKIE, parsed.data.societyId, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NEXT_PUBLIC_APP_ENV !== 'local',
  });
}
