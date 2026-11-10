// Tenant-scoped job history for the society administrator.
import { z } from 'zod';
import { AppError, createRequestId } from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';

async function getJobsContext() {
  const context = await buildRequestContext(createRequestId());
  authorizeRequest(context, {
    moduleKey: 'core',
    permission: 'jobs:read',
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

export async function listSocietyJobs(page: number, pageSize: number) {
  const { context, societyId } = await getJobsContext();
  const start = (page - 1) * pageSize;
  const { data, error, count } = await context.db
    .from('jobs')
    .select('id, type, status, progress, summary, created_at, finished_at', {
      count: 'exact',
    })
    .eq('society_id', societyId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, start + pageSize - 1);
  if (error) throw new Error('Could not load society jobs.', { cause: error });
  return { rows: data ?? [], total: count ?? 0 };
}

export async function getSocietyJob(jobId: string) {
  const parsedId = z.uuid().safeParse(jobId);
  if (!parsedId.success) throw new AppError('NOT_FOUND');
  const { context, societyId } = await getJobsContext();
  const { data, error } = await context.db
    .from('jobs')
    .select('*')
    .eq('id', parsedId.data)
    .eq('society_id', societyId)
    .maybeSingle();
  if (error) throw new Error('Could not load job details.', { cause: error });
  if (!data) throw new AppError('NOT_FOUND');
  return data;
}
