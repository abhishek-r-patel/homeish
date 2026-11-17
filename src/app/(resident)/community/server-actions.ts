// Expose resident Community & Marketplace writes and private photo upload links.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  changeCommunityListing,
  createCommunityListing,
  createCommunityPost,
  createCommunityReply,
  deleteCommunityReply,
  prepareCommunityPhotoUpload,
  renewCommunityListing,
  reportCommunityItem,
  setCommunityGroupMembership,
  setCommunityPreferences,
  updateCommunityListing,
  updateCommunityPost,
  withdrawCommunityPost,
} from '@/core/community/operations';
import { formatCommunityDateTime } from '@/core/community/presentation';

export async function prepareCommunityPhotoUploadAction(form: FormData) {
  return runServerAction('/community/photos', async (requestId) => ({
    data: await prepareCommunityPhotoUpload(
      readModuleActionInput(form),
      requestId,
    ),
  }));
}

export async function joinCommunityGroupAction(form: FormData) {
  return runServerAction('/community/groups/join', async (requestId) => {
    await setCommunityGroupMembership(
      readModuleActionInput(form),
      true,
      requestId,
    );
    return 'You joined the group.';
  });
}

export async function leaveCommunityGroupAction(form: FormData) {
  return runServerAction('/community/groups/leave', async (requestId) => {
    await setCommunityGroupMembership(
      readModuleActionInput(form),
      false,
      requestId,
    );
    return 'You left the group.';
  });
}

export async function setCommunityPreferencesAction(form: FormData) {
  return runServerAction('/community/preferences', async (requestId) => {
    const result = await setCommunityPreferences(
      readModuleActionInput(form),
      requestId,
    );
    return result.newListingAlerts
      ? 'New listing alerts are on.'
      : 'New listing alerts are off.';
  });
}

export async function createCommunityPostAction(form: FormData) {
  return runServerAction('/community/posts', async (requestId) => ({
    message:
      'Post sent. An administrator will check it before the group sees it.',
    data: await createCommunityPost(readModuleActionInput(form), requestId),
  }));
}

export async function updateCommunityPostAction(form: FormData) {
  return runServerAction('/community/posts/update', async (requestId) => {
    await updateCommunityPost(readModuleActionInput(form), requestId);
    return 'Changes saved. The post is still waiting for review.';
  });
}

export async function withdrawCommunityPostAction(form: FormData) {
  return runServerAction('/community/posts/withdraw', async (requestId) => {
    await withdrawCommunityPost(readModuleActionInput(form), requestId);
    return 'Your post was deleted.';
  });
}

export async function createCommunityListingAction(form: FormData) {
  return runServerAction('/community/listings', async (requestId) => ({
    message:
      'Listing sent. An administrator will check it before neighbours see it.',
    data: await createCommunityListing(readModuleActionInput(form), requestId),
  }));
}

export async function updateCommunityListingAction(form: FormData) {
  return runServerAction('/community/listings/update', async (requestId) => {
    await updateCommunityListing(readModuleActionInput(form), requestId);
    return 'Changes saved. The listing is still waiting for review.';
  });
}

export async function withdrawCommunityListingAction(form: FormData) {
  return runServerAction('/community/listings/withdraw', async (requestId) => {
    await changeCommunityListing(
      readModuleActionInput(form),
      'withdraw',
      requestId,
    );
    return 'Your listing was deleted.';
  });
}

export async function closeCommunityListingAction(form: FormData) {
  return runServerAction('/community/listings/close', async (requestId) => {
    await changeCommunityListing(
      readModuleActionInput(form),
      'close',
      requestId,
    );
    return 'Listing closed. It no longer appears in the marketplace.';
  });
}

export async function renewCommunityListingAction(form: FormData) {
  return runServerAction('/community/listings/renew', async (requestId) => {
    const result = await renewCommunityListing(
      readModuleActionInput(form),
      requestId,
    );
    return `Listing renewed until ${formatCommunityDateTime(result.expiresAt)} IST.`;
  });
}

export async function createCommunityReplyAction(form: FormData) {
  return runServerAction('/community/replies', async (requestId) => {
    await createCommunityReply(readModuleActionInput(form), requestId);
    return 'Reply sent.';
  });
}

export async function deleteCommunityReplyAction(form: FormData) {
  return runServerAction('/community/replies/delete', async (requestId) => {
    await deleteCommunityReply(readModuleActionInput(form), requestId);
    return 'Your reply was deleted.';
  });
}

export async function reportCommunityItemAction(form: FormData) {
  return runServerAction('/community/reports', async (requestId) => {
    const result = await reportCommunityItem(
      readModuleActionInput(form),
      requestId,
    );
    return result.hidden
      ? 'Report sent. It is now hidden until an administrator checks it.'
      : 'Report sent. An administrator will check it.';
  });
}
