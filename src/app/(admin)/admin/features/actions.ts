// Submit P55 module requests from the admin-only feature list.
'use server';

import { revalidatePath } from 'next/cache';
import { runServerAction } from '@/core/actions/server-action';
import { createFeatureRequest } from '@/core/home/feature-requests';

export async function createFeatureRequestAction(formData: FormData) {
  return runServerAction('workspace.featureRequest.create', async () => {
    await createFeatureRequest({
      moduleKey: formData.get('moduleKey'),
      note: formData.get('note'),
    });
    revalidatePath('/admin/features');
    revalidatePath('/developer');
    return 'Feature request sent.';
  });
}
