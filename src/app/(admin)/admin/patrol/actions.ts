// Run administrator patrol mutations through current-role operations and the shared action envelope.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  addPatrolIncidentNote,
  closePatrolIncident,
  savePatrolCheckpoint,
  savePatrolSchedule,
  savePatrolSettings,
  setPatrolCheckpointActive,
  setPatrolScheduleActive,
} from '@/core/patrol/operations';

export async function savePatrolSettingsAction(form: FormData) {
  return runServerAction('/admin/patrol', async (requestId) => {
    await savePatrolSettings(readModuleActionInput(form), requestId);
    return 'Photo retention saved.';
  });
}

export async function savePatrolCheckpointAction(form: FormData) {
  return runServerAction<string>('/admin/patrol', async (requestId) => ({
    data: await savePatrolCheckpoint(readModuleActionInput(form), requestId),
    message: 'Checkpoint saved.',
  }));
}

export async function setPatrolCheckpointActiveAction(form: FormData) {
  return runServerAction('/admin/patrol', async (requestId) => {
    await setPatrolCheckpointActive(readModuleActionInput(form), requestId);
    return 'Checkpoint updated.';
  });
}

export async function savePatrolScheduleAction(form: FormData) {
  return runServerAction<string>('/admin/patrol', async (requestId) => ({
    data: await savePatrolSchedule(readModuleActionInput(form), requestId),
    message: 'Schedule saved.',
  }));
}

export async function setPatrolScheduleActiveAction(form: FormData) {
  return runServerAction('/admin/patrol', async (requestId) => {
    await setPatrolScheduleActive(readModuleActionInput(form), requestId);
    return 'Schedule updated.';
  });
}

export async function addPatrolIncidentNoteAction(form: FormData) {
  return runServerAction<string>('/admin/patrol', async (requestId) => ({
    data: await addPatrolIncidentNote(readModuleActionInput(form), requestId),
    message: 'Follow-up note added.',
  }));
}

export async function closePatrolIncidentAction(form: FormData) {
  return runServerAction('/admin/patrol', async (requestId) => {
    await closePatrolIncident(readModuleActionInput(form), requestId);
    return 'Incident closed. The reporting guard has been told.';
  });
}
