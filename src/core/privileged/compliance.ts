// Run service-only compliance reminders and opted-in cleanup.
import 'server-only';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { createRequestId } from '../errors';
import { sendNotificationPushesForRequest } from './notification-delivery';
import { privilegedClient } from './server-client';
import { z } from 'zod';

const officialCaseCleanupSchema = z.array(
  z.object({
    case_id: z.uuid(),
    version_ids: z.array(z.uuid()),
    paths: z.array(z.string().min(1).max(500)),
  }),
);

export async function runComplianceRemindersPrivileged(
  societyId: string,
  today: string,
) {
  const requestId = createRequestId();
  const result = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'compliance_reminders_run',
    {
      p_society_id: societyId,
      p_today: today,
      p_request_id: requestId,
    },
  );
  await sendNotificationPushesForRequest(requestId);
  return result;
}

export async function runDataCleanupPrivileged(
  societyId: string,
  today: string,
) {
  const requestId = createRequestId();
  const candidates = officialCaseCleanupSchema.parse(
    await invokeUntypedRpc<unknown>(
      privilegedClient,
      'document_official_case_cleanup_candidates',
      { p_society_id: societyId, p_today: today },
    ),
  );
  const paths = candidates.flatMap((candidate) => candidate.paths);
  for (let start = 0; start < paths.length; start += 100) {
    const { error } = await privilegedClient.storage
      .from('document-files')
      .remove(paths.slice(start, start + 100));
    if (error) {
      throw new Error('Could not remove private case evidence.', {
        cause: error,
      });
    }
  }
  const caseResult =
    candidates.length > 0
      ? await invokeUntypedRpc<unknown>(
          privilegedClient,
          'document_official_case_cleanup_finalize',
          {
            p_society_id: societyId,
            p_case_ids: candidates.map((candidate) => candidate.case_id),
            p_request_id: requestId,
          },
        )
      : { official_cases_deleted: 0, files_deleted: 0 };
  const complianceResult = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'compliance_data_cleanup_run',
    {
      p_society_id: societyId,
      p_today: today,
      p_request_id: createRequestId(),
    },
  );
  return { official_cases: caseResult, compliance: complianceResult };
}

export async function runOfficialCaseRemindersPrivileged(
  societyId: string,
  today: string,
) {
  const requestId = createRequestId();
  const result = await invokeUntypedRpc<unknown>(
    privilegedClient,
    'document_official_case_reminders_run',
    {
      p_society_id: societyId,
      p_today: today,
      p_request_id: requestId,
    },
  );
  await sendNotificationPushesForRequest(requestId);
  return result;
}
