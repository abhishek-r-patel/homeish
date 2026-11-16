// Run Home-Services mutations through current-role operations and the shared action envelope.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  archiveHomeServicesProvider,
  reviewHomeServicesSuggestion,
  saveHomeServicesProvider,
  saveHomeServicesRating,
  setHomeServicesCommentVisibility,
  suggestHomeServicesProvider,
} from '@/core/home-services/operations';

function flag(input: unknown, key: 'approve' | 'hidden') {
  return (
    typeof input === 'object' &&
    input !== null &&
    (input as Record<string, unknown>)[key] === true
  );
}

export async function saveHomeServicesProviderAction(form: FormData) {
  return runServerAction<string>('/admin/home-services', async (requestId) => ({
    data: await saveHomeServicesProvider(
      readModuleActionInput(form),
      requestId,
    ),
    message: 'Provider saved.',
  }));
}

export async function suggestHomeServicesProviderAction(form: FormData) {
  return runServerAction<string>('/admin/home-services', async (requestId) => ({
    data: await suggestHomeServicesProvider(
      readModuleActionInput(form),
      requestId,
    ),
    message:
      'Suggestion sent. Residents will see it once an administrator approves it.',
  }));
}

export async function reviewHomeServicesSuggestionAction(form: FormData) {
  return runServerAction('/admin/home-services', async (requestId) => {
    const input = readModuleActionInput(form);
    await reviewHomeServicesSuggestion(input, requestId);
    return flag(input, 'approve')
      ? 'Suggestion approved. Residents can now see this provider.'
      : 'Suggestion not approved. The committee member has been told.';
  });
}

export async function archiveHomeServicesProviderAction(form: FormData) {
  return runServerAction('/admin/home-services', async (requestId) => {
    await archiveHomeServicesProvider(readModuleActionInput(form), requestId);
    return 'Provider archived. Residents no longer see it; its ratings are kept.';
  });
}

export async function saveHomeServicesRatingAction(form: FormData) {
  return runServerAction<string>('/home-services', async (requestId) => ({
    data: await saveHomeServicesRating(readModuleActionInput(form), requestId),
    message: 'Your rating is saved.',
  }));
}

export async function setHomeServicesCommentVisibilityAction(form: FormData) {
  return runServerAction('/admin/home-services', async (requestId) => {
    const input = readModuleActionInput(form);
    await setHomeServicesCommentVisibility(input, requestId);
    return flag(input, 'hidden')
      ? 'Comment hidden. The rating still counts.'
      : 'Comment shown again.';
  });
}
