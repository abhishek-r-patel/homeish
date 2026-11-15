// Attest approved immutable NOC bytes and send scheduled in-app tenancy reminders.
import 'server-only';
import { z } from 'zod';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { AppError, ConflictError, createRequestId } from '../errors';
import { tenancyNocPathSchema } from '../tenancy/moves/validation';
import { privilegedClient } from './server-client';

export async function attestTenancyNocPrivileged(input: {
  societyId: string;
  moveId: string;
  issuerId: string;
  path: string;
  expectedVersion: number;
  expectedBytes: Uint8Array;
  requestId: string;
}): Promise<void> {
  if (
    !tenancyNocPathSchema.safeParse(input.path).success ||
    !input.path.startsWith(
      `${input.societyId.toLowerCase()}/moves/${input.moveId.toLowerCase()}/noc/`,
    )
  ) {
    throw new AppError('FORBIDDEN');
  }
  const { data, error } = await privilegedClient.storage
    .from('tenancy-files')
    .download(input.path);
  if (error || !data) {
    throw new Error('Could not verify the stored NOC PDF. Retry issuance.', {
      cause: error,
    });
  }
  if (!Buffer.from(await data.arrayBuffer()).equals(input.expectedBytes)) {
    throw new ConflictError(
      'invalid_state',
      'The stored NOC does not match the approved PDF. Wait ten minutes, refresh and prepare a new NOC.',
    );
  }
  z.null().parse(
    await invokeUntypedRpc<unknown>(privilegedClient, 'tenancy_noc_attest', {
      p_society_id: input.societyId,
      p_move_id: input.moveId,
      p_issuer_id: input.issuerId,
      p_path: input.path,
      p_expected_version: input.expectedVersion,
      p_request_id: input.requestId,
    }),
  );
}

export async function runTenancyRemindersPrivileged(
  societyId: string,
): Promise<void> {
  z.number()
    .int()
    .nonnegative()
    .parse(
      await invokeUntypedRpc<unknown>(
        privilegedClient,
        'tenancy_reminders_run',
        {
          p_society_id: societyId,
          p_request_trace: createRequestId(),
        },
      ),
    );
}
