// Provide narrow service-role operations for idempotent scheduled jobs.
import { invokeUntypedRpc } from '../db/untyped-rpc';
import { privilegedClient } from './server-client';

export async function listDailyJobSocieties(): Promise<{ id: string }[]> {
  return invokeUntypedRpc<{ id: string }[]>(
    privilegedClient,
    'daily_job_societies',
    {},
  );
}

export async function claimDailyJobRun(
  societyId: string,
  jobName: string,
  periodKey: string,
): Promise<boolean> {
  const { data, error } = await privilegedClient
    .from('job_run_keys')
    .upsert(
      {
        society_id: societyId,
        job_name: jobName,
        period_key: periodKey,
      },
      {
        onConflict: 'society_id,job_name,period_key',
        ignoreDuplicates: true,
      },
    )
    .select('society_id')
    .maybeSingle();
  if (error) {
    throw new Error('Could not claim a daily job run.', { cause: error });
  }
  return data !== null;
}

export async function completeDailyJobRun(
  societyId: string,
  jobName: string,
  periodKey: string,
): Promise<void> {
  const { data, error } = await privilegedClient
    .from('job_run_keys')
    .update({ completed_at: new Date().toISOString() })
    .eq('society_id', societyId)
    .eq('job_name', jobName)
    .eq('period_key', periodKey)
    .is('completed_at', null)
    .select('society_id')
    .maybeSingle();
  if (error || !data) {
    throw new Error('Could not mark a daily job run complete.', {
      cause: error,
    });
  }
}
