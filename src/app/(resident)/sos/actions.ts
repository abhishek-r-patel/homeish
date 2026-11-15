// Run emergency SOS mutations through current-role operations and the shared action envelope.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  acknowledgeSos,
  addSosUpdate,
  cancelSos,
  closeSos,
  dismissSosAlert,
  raiseSos,
  saveSosContact,
  saveSosSettings,
  setSosContactArchived,
} from '@/core/sos/operations';

export async function raiseSosAction(form: FormData) {
  return runServerAction<string>('/sos', async (requestId) => ({
    data: await raiseSos(readModuleActionInput(form), requestId),
    message: 'SOS sent. Responders have been alerted.',
  }));
}

export async function cancelSosAction(form: FormData) {
  return runServerAction('/sos', async (requestId) => {
    await cancelSos(readModuleActionInput(form), requestId);
    return 'SOS cancelled as raised by mistake. Responders have been told.';
  });
}

export async function acknowledgeSosAction(form: FormData) {
  return runServerAction('/sos', async (requestId) => {
    await acknowledgeSos(readModuleActionInput(form), requestId);
    return 'SOS acknowledged. The raiser has been told help is coming.';
  });
}

export async function addSosUpdateAction(form: FormData) {
  return runServerAction('/sos', async (requestId) => {
    await addSosUpdate(readModuleActionInput(form), requestId);
    return 'Update posted.';
  });
}

export async function closeSosAction(form: FormData) {
  return runServerAction('/sos', async (requestId) => {
    await closeSos(readModuleActionInput(form), requestId);
    return 'SOS closed.';
  });
}

export async function saveSosSettingsAction(form: FormData) {
  return runServerAction('/admin/sos', async (requestId) => {
    await saveSosSettings(readModuleActionInput(form), requestId);
    return 'SOS recipients saved.';
  });
}

export async function saveSosContactAction(form: FormData) {
  return runServerAction<string>('/admin/sos', async (requestId) => ({
    data: await saveSosContact(readModuleActionInput(form), requestId),
    message: 'Emergency contact saved.',
  }));
}

export async function archiveSosContactAction(form: FormData) {
  return runServerAction('/admin/sos', async (requestId) => {
    await setSosContactArchived(readModuleActionInput(form), requestId);
    return 'Emergency contact updated.';
  });
}

export async function dismissSosAlertAction(form: FormData) {
  return runServerAction('/sos', async (requestId) => {
    await dismissSosAlert(readModuleActionInput(form), requestId);
    return 'Alert dismissed.';
  });
}
