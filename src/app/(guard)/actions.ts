// Identify a guard for shared gate accounts without exposing PINs.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { identifyGuard } from '@/core/guards/operations';

export async function identifyGuardAction(input: {
  guardId: string;
  pin?: string;
}) {
  return runServerAction('guards.identify', async () => {
    const result = await identifyGuard(input);
    revalidatePath('/guard');
    return `Handled by ${result.name}.`;
  });
}
