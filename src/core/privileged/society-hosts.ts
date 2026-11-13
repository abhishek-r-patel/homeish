// Match an active society host's slug to its society record (server-only, before sign-in).
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';

export type SocietyHostRecord = { id: string; name: string; status: string };

export async function lookupSocietyHost(
  slug: string,
): Promise<SocietyHostRecord | null> {
  const rows = await invokeUntypedRpc<SocietyHostRecord[] | null>(
    privilegedClient,
    'society_host_lookup',
    { p_slug: slug },
  );
  return rows?.[0] ?? null;
}
