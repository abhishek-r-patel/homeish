// Reconcile due polls and purge expired voter records through service-role RPCs.
import 'server-only';
import { z } from 'zod';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';

const reconcileResultSchema = z
  .object({
    opened: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    notified: z.number().int().nonnegative(),
  })
  .strict();

export async function runPollReconcilePrivileged(
  societyId: string,
): Promise<void> {
  const result = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'poll_reconcile_due',
    { p_society_id: societyId },
  );
  reconcileResultSchema.parse(result);
  const electionResult = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'poll_election_reconcile_due',
    { p_society_id: societyId },
  );
  z.number().int().nonnegative().parse(electionResult);
}

export async function runPollRetentionPrivileged(): Promise<void> {
  const result = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'poll_retention_run',
    {},
  );
  z.object({ purgedVotes: z.number().int().nonnegative() })
    .strict()
    .parse(result);
}
