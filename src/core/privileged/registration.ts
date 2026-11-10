// Resolve a society only from an exact, active join code.
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';

export async function lookupRegistrationSociety(
  joinCode: string,
): Promise<unknown | null> {
  return invokeUntypedRpc<unknown | null>(
    privilegedClient,
    'lookup_registration_society',
    { p_join_code: joinCode },
  );
}

export async function isRegistrationCodeActive(
  joinCode: string,
): Promise<boolean> {
  return (await lookupRegistrationSociety(joinCode)) !== null;
}
