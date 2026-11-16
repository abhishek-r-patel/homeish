// Bundle the administrator Community server actions for the screens.
import type { CommunityAdminActions } from '@/components/community/admin';
import {
  archiveCommunityGroupAction,
  moderateCommunityItemAction,
  muteCommunityMemberAction,
  saveCommunityGroupAction,
  unmuteCommunityMemberAction,
} from './server-actions';

export const communityAdminActions: CommunityAdminActions = {
  moderate: moderateCommunityItemAction,
  mute: muteCommunityMemberAction,
  unmute: unmuteCommunityMemberAction,
  saveGroup: saveCommunityGroupAction,
  archiveGroup: archiveCommunityGroupAction,
};
