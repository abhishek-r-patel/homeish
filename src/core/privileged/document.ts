// Run the narrow, in-app-only document-expiry reminder job with the service identity.
import 'server-only';
import { z } from 'zod';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { createRequestId } from '../errors';
import { privilegedClient } from './server-client';

export async function runDocumentExpiryRemindersPrivileged(
  societyId: string,
): Promise<void> {
  z.number()
    .int()
    .nonnegative()
    .parse(
      await invokeUntypedRpc<unknown>(
        privilegedClient,
        'document_expiry_reminders_run',
        {
          p_society_id: societyId,
          p_request_trace: createRequestId(),
        },
      ),
    );
}
