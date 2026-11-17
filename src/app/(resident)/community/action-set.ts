// Bundle the resident Community server actions for the screens.
import type { CommunityResidentActions } from '@/components/community/resident';
import {
  closeCommunityListingAction,
  createCommunityListingAction,
  createCommunityPostAction,
  createCommunityReplyAction,
  deleteCommunityReplyAction,
  joinCommunityGroupAction,
  leaveCommunityGroupAction,
  prepareCommunityPhotoUploadAction,
  renewCommunityListingAction,
  reportCommunityItemAction,
  setCommunityPreferencesAction,
  updateCommunityListingAction,
  updateCommunityPostAction,
  withdrawCommunityListingAction,
  withdrawCommunityPostAction,
} from './server-actions';

export const communityResidentActions: CommunityResidentActions = {
  prepareUpload: prepareCommunityPhotoUploadAction,
  joinGroup: joinCommunityGroupAction,
  leaveGroup: leaveCommunityGroupAction,
  setPreferences: setCommunityPreferencesAction,
  createPost: createCommunityPostAction,
  updatePost: updateCommunityPostAction,
  withdrawPost: withdrawCommunityPostAction,
  createListing: createCommunityListingAction,
  updateListing: updateCommunityListingAction,
  withdrawListing: withdrawCommunityListingAction,
  closeListing: closeCommunityListingAction,
  renewListing: renewCommunityListingAction,
  createReply: createCommunityReplyAction,
  deleteReply: deleteCommunityReplyAction,
  report: reportCommunityItemAction,
};
