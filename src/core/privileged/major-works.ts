// Run P50.1b structural-audit reminders and their notification delivery.
import 'server-only';
import { z } from 'zod';
import { createRequestId } from '../errors';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';
import { sendNotificationPushesForRequest } from './notification-delivery';

export async function runMajorWorksAuditRemindersPrivileged(
  societyId: string,
): Promise<void> {
  const requestId = createRequestId();
  z.object({ notified: z.number().int().nonnegative() }).parse(
    await invokeUntypedRpc<unknown>(
      privilegedClient,
      'major_works_audit_reminders_run',
      { p_society_id: societyId, p_request_id: requestId },
    ),
  );
  await sendNotificationPushesForRequest(requestId);
}

const retentionFilesSchema = z.array(
  z.object({ path: z.string().min(1), proposal_id: z.uuid() }).strict(),
);

export async function runMajorWorksRetentionPrivileged(
  societyId: string,
  periodKey: string,
): Promise<void> {
  const today = periodKey;
  const files = retentionFilesSchema.parse(
    await invokeUntypedRpc<unknown>(
      privilegedClient,
      'major_works_retention_files',
      { p_society_id: societyId, p_today: today },
    ),
  );
  const paths = [...new Set(files.map((file) => file.path))];
  if (paths.length) {
    const { error } = await privilegedClient.storage
      .from('major-works-files')
      .remove(paths);
    if (error) {
      throw new Error('Could not remove archived major-works files.', {
        cause: error,
      });
    }
  }
  z.object({ purged: z.number().int().nonnegative() })
    .strict()
    .parse(
      await invokeUntypedRpc<unknown>(
        privilegedClient,
        'major_works_retention_run',
        {
          p_society_id: societyId,
          p_today: today,
          p_request_id: createRequestId(),
        },
      ),
    );
}
