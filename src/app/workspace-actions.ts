// Expose authenticated P55 workspace search, pins and Getting started mutations.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import {
  searchWorkspace,
  setGettingStartedDismissed,
} from '@/core/home/workspace-discovery';
import {
  resetQuickActionPins,
  saveQuickActionPins,
} from '@/core/home/workspace-operations';

export async function searchWorkspaceAction(input: unknown) {
  return runServerAction('workspace.search', async () => ({
    data: await searchWorkspace(input),
  }));
}

export async function saveQuickActionPinsAction(input: unknown) {
  return runServerAction('workspace.quickActions.pin', async () => {
    await saveQuickActionPins(input);
    revalidatePath('/admin');
    revalidatePath('/home');
    revalidatePath('/guard');
    revalidatePath('/housekeeping');
    return 'Dashboard actions saved.';
  });
}

export async function resetQuickActionPinsAction() {
  return runServerAction('workspace.quickActions.reset', async () => {
    await resetQuickActionPins();
    revalidatePath('/admin');
    revalidatePath('/home');
    revalidatePath('/guard');
    revalidatePath('/housekeeping');
    return 'Dashboard actions reset.';
  });
}

export async function setGettingStartedDismissedAction(dismissed: boolean) {
  return runServerAction('workspace.gettingStarted.dismiss', async () => {
    await setGettingStartedDismissed(dismissed);
    revalidatePath('/admin');
    revalidatePath('/admin/settings');
    return dismissed ? 'Getting started hidden.' : 'Getting started restored.';
  });
}
