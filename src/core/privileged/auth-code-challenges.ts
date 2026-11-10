// Keep OTP challenge state inside service-role-only database functions.
import type { Database } from '../db/database.types';
import { privilegedClient } from './server-client';

type AttemptResult =
  Database['public']['Functions']['reserve_auth_code_attempt']['Returns'][number];

export type AuthCodeAttemptStatus = 'reserved' | 'locked' | 'invalid';

export interface AuthCodeAttemptReservation {
  status: AuthCodeAttemptStatus;
  challengeId: string | null;
  retryAfterSeconds: number;
}

export async function startAuthCodeChallenge(
  emailKey: string,
): Promise<string> {
  const { data, error } = await privilegedClient.rpc(
    'start_auth_code_challenge',
    { p_email_key: emailKey },
  );
  if (error) {
    throw new Error('Could not start the sign-in code challenge.', {
      cause: error,
    });
  }
  if (typeof data !== 'string') {
    throw new Error('Sign-in code challenge returned no ID.');
  }
  return data;
}

export async function reserveAuthCodeAttempt(
  emailKey: string,
): Promise<AuthCodeAttemptReservation> {
  const { data, error } = await privilegedClient.rpc(
    'reserve_auth_code_attempt',
    { p_email_key: emailKey },
  );
  if (error) {
    throw new Error('Could not check the sign-in code challenge.', {
      cause: error,
    });
  }
  const result: AttemptResult | undefined = data[0];
  if (
    !result ||
    (result.status !== 'reserved' &&
      result.status !== 'locked' &&
      result.status !== 'invalid') ||
    !Number.isInteger(result.retry_after_seconds) ||
    result.retry_after_seconds < 0
  ) {
    throw new Error('Sign-in code challenge returned an invalid result.');
  }
  return {
    status: result.status,
    challengeId: result.challenge_id,
    retryAfterSeconds: result.retry_after_seconds,
  };
}

export async function finishAuthCodeAttempt(
  challengeId: string,
  result: { failed: boolean; succeeded: boolean },
): Promise<boolean> {
  const { data, error } = await privilegedClient.rpc(
    'finish_auth_code_attempt',
    {
      p_challenge_id: challengeId,
      p_failed: result.failed,
      p_succeeded: result.succeeded,
    },
  );
  if (error) {
    throw new Error('Could not finish the sign-in code attempt.', {
      cause: error,
    });
  }
  if (typeof data !== 'boolean') {
    throw new Error('Sign-in code attempt returned no result.');
  }
  return data;
}
