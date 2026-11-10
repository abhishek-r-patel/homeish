// Check sign-in eligibility without exposing membership details.
import { privilegedClient } from './server-client';

export async function hasSignInAccess(email: string): Promise<boolean> {
  const { data, error } = await privilegedClient.rpc('has_signin_access', {
    p_email: email.trim(),
  });
  if (error) {
    throw new Error('Sign-in access check is unavailable.', { cause: error });
  }
  if (typeof data !== 'boolean') {
    throw new Error('Sign-in access check returned no result.');
  }
  return data;
}

export async function ensureAuthUserForSignIn(email: string): Promise<void> {
  const { error } = await privilegedClient.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    email_confirm: false,
  });
  if (error && error.code !== 'email_exists') {
    throw new Error('Could not provision the invited sign-in account.', {
      cause: error,
    });
  }
}
