// Resolve the authenticated user's active society before rendering a session.
import { redirect } from 'next/navigation';
import { AppError, createRequestId } from '@/core/errors';
import { getSession } from '@/core/tenancy/session';
import {
  CurrentSession,
  MembershipStatus,
  SocietyPicker,
} from '@/components/auth/session-flow';

export const metadata = {
  title: 'Your session | Homeish',
  robots: { index: false, follow: false },
};

export default async function SessionPage() {
  let session;
  try {
    session = await getSession(createRequestId());
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === 'UNAUTHENTICATED' || error.code === 'SESSION_EXPIRED')
    ) {
      redirect('/session-expired?returnTo=%2Fsession');
    }
    throw error;
  }

  const activeSocieties = session.societies.filter(
    ({ membershipStatus }) => membershipStatus === 'active',
  );
  const pendingSocieties = session.societies.filter(
    ({ membershipStatus }) => membershipStatus === 'pending_approval',
  );
  if (activeSocieties.length === 0 && session.isDeveloperAccount) {
    redirect(session.mfaVerified ? '/developer' : '/developer/login');
  }
  if (activeSocieties.length === 0) {
    return (
      <MembershipStatus pendingSocieties={pendingSocieties} session={session} />
    );
  }
  if (!session.activeSocietyId) {
    return (
      <SocietyPicker activeSocieties={activeSocieties} session={session} />
    );
  }

  const activeSociety = activeSocieties.find(
    ({ id }) => id === session.activeSocietyId,
  );
  if (!activeSociety) {
    throw new Error('The active society is missing from the session summary.');
  }
  return (
    <CurrentSession
      activeSocieties={activeSocieties}
      activeSociety={activeSociety}
      pendingSocieties={pendingSocieties}
      session={session}
    />
  );
}
