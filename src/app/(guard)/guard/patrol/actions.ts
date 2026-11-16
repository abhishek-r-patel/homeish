// Run guard patrol mutations through current-role operations and the shared action envelope.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  acknowledgePatrolHandover,
  createPatrolHandover,
  createPatrolIncident,
  recordPatrolScan,
} from '@/core/patrol/operations';
import type { PatrolScanResult } from '@/core/patrol/validation';

export async function recordPatrolScanAction(form: FormData) {
  return runServerAction<PatrolScanResult>(
    '/guard/patrol',
    async (requestId) => {
      const scan = await recordPatrolScan(
        readModuleActionInput(form),
        requestId,
      );
      return { data: scan, message: `${scan.checkpoint_name} recorded.` };
    },
  );
}

export async function createPatrolIncidentAction(form: FormData) {
  return runServerAction<string>('/guard/patrol', async (requestId) => ({
    data: await createPatrolIncident(readModuleActionInput(form), requestId),
    message: 'Incident reported. Administrators can now see it.',
  }));
}

export async function createPatrolHandoverAction(form: FormData) {
  return runServerAction<string>('/guard/patrol', async (requestId) => ({
    data: await createPatrolHandover(readModuleActionInput(form), requestId),
    message: 'Handover note saved for the next guard.',
  }));
}

export async function acknowledgePatrolHandoverAction(form: FormData) {
  return runServerAction('/guard/patrol', async (requestId) => {
    await acknowledgePatrolHandover(readModuleActionInput(form), requestId);
    return 'Handover note acknowledged.';
  });
}
