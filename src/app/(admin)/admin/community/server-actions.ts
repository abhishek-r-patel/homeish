// Expose administrator Community moderation, muting and group management.
'use server';
import {
  readModuleActionInput,
  runServerAction,
} from '@/core/actions/server-action';
import {
  archiveCommunityGroup,
  moderateCommunityItem,
  muteCommunityMember,
  saveCommunityGroup,
  unmuteCommunityMember,
} from '@/core/community/operations';
import { formatCommunityDateTime } from '@/core/community/presentation';

const DECISION_MESSAGES: Readonly<Record<string, string>> = {
  approved: 'Approved. Residents can see it now and the author was told.',
  rejected: 'Rejected. The author was told the reason.',
  removed: 'Removed. The author was told the reason.',
  visible: 'Restored. Residents can see it again.',
};

export async function moderateCommunityItemAction(form: FormData) {
  return runServerAction('/admin/community/moderate', async (requestId) => {
    const result = await moderateCommunityItem(
      readModuleActionInput(form),
      requestId,
    );
    return DECISION_MESSAGES[result.status] ?? 'Decision saved.';
  });
}

export async function muteCommunityMemberAction(form: FormData) {
  return runServerAction('/admin/community/mute', async (requestId) => {
    const result = await muteCommunityMember(
      readModuleActionInput(form),
      requestId,
    );
    return result.mutedUntil
      ? `Muted until ${formatCommunityDateTime(result.mutedUntil)} IST. The resident was told.`
      : 'Muted until you lift it. The resident was told.';
  });
}

export async function unmuteCommunityMemberAction(form: FormData) {
  return runServerAction('/admin/community/unmute', async (requestId) => {
    const result = await unmuteCommunityMember(
      readModuleActionInput(form),
      requestId,
    );
    return result.lifted
      ? 'Mute lifted. The resident was told.'
      : 'This resident was not muted.';
  });
}

export async function saveCommunityGroupAction(form: FormData) {
  return runServerAction('/admin/community/groups', async (requestId) => {
    await saveCommunityGroup(readModuleActionInput(form), requestId);
    return 'Group saved.';
  });
}

export async function archiveCommunityGroupAction(form: FormData) {
  return runServerAction(
    '/admin/community/groups/archive',
    async (requestId) => {
      const result = await archiveCommunityGroup(
        readModuleActionInput(form),
        requestId,
      );
      return result.status === 'archived'
        ? 'Group archived. Residents no longer see it.'
        : 'Group is active again.';
    },
  );
}
