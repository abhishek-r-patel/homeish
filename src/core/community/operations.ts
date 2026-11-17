// Authorize Community & Marketplace operations, call their RPC contracts and deliver follow-up pushes.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import {
  AppError,
  ConflictError,
  createRequestId,
  ValidationError,
} from '../errors';
import { authorizeRequest } from '../permissions/authorize';
import { sendNotificationPushesForRequest } from '../privileged/notification-delivery';
import { enforceRateLimit } from '../rate-limit';
import { buildRequestContext } from '../tenancy/request-context';
import { issueCommunityPhotoUpload, signCommunityPhotos } from './photos';
import {
  COMMUNITY_PAGE_SIZE,
  COMMUNITY_SEARCH_MAX,
  communityAdminGroupsSchema,
  communityAdminItemSchema,
  communityAdminMutesSchema,
  communityAdminQueueResultSchema,
  communityAdminQueueSchema,
  communityDeletedResultSchema,
  communityGroupArchiveInputSchema,
  communityGroupArchiveResultSchema,
  communityGroupFeedSchema,
  communityGroupIdInputSchema,
  communityGroupJoinResultSchema,
  communityGroupSaveInputSchema,
  communityGroupSaveResultSchema,
  communityHomeSchema,
  communityListingCreateInputSchema,
  communityListingCreateResultSchema,
  communityListingDetailSchema,
  communityListingIdInputSchema,
  communityListingRenewResultSchema,
  communityListingStatusResultSchema,
  communityListingTypeFilterSchema,
  communityListingUpdateInputSchema,
  communityListingUpdateResultSchema,
  communityMarketplaceSchema,
  communityMemberOptionsSchema,
  communityModerateInputSchema,
  communityModerateResultSchema,
  communityMuteInputSchema,
  communityMuteResultSchema,
  communityMyItemsSchema,
  communityPostCreateInputSchema,
  communityPostCreateResultSchema,
  communityPostDetailSchema,
  communityPostIdInputSchema,
  communityPostStatusResultSchema,
  communityPostUpdateInputSchema,
  communityPostUpdateResultSchema,
  communityPreferencesInputSchema,
  communityPreferencesResultSchema,
  communityReplyCreateInputSchema,
  communityReplyCreateResultSchema,
  communityReplyIdInputSchema,
  communityReportInputSchema,
  communityReportResultSchema,
  communitySettingsInputSchema,
  communitySettingsResultSchema,
  communityTargetTypeSchema,
  communityUnmuteInputSchema,
  communityUnmuteResultSchema,
  type CommunityAdminQueue,
  type CommunityListingType,
} from './validation';

type CommunityPermission = 'community:participate' | 'community:moderate';

type Context = Awaited<ReturnType<typeof buildRequestContext>>;

async function getContext(
  permission: CommunityPermission,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'community', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  if (write) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      context.userId,
      context.requestId,
    );
  }
  return { context, societyId: context.societyId };
}

function rpcError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== 'object' || current === null) return null;
    const record = current as {
      cause?: unknown;
      code?: unknown;
      message?: unknown;
      details?: unknown;
    };
    if (typeof record.code === 'string') {
      return {
        code: record.code,
        message: typeof record.message === 'string' ? record.message : '',
        details: typeof record.details === 'string' ? record.details : '',
      };
    }
    current = record.cause;
  }
  return null;
}

export function mapCommunityError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const info = rpcError(error);
  if (info?.code === '55P03') {
    throw new ConflictError(
      'invalid_state',
      'This item is busy. Wait a moment, then try again.',
    );
  }
  if (info?.code !== 'P0001') throw error;

  switch (info.message) {
    case 'community_invalid_state':
      throw new ConflictError(
        'invalid_state',
        'This item has changed and cannot be updated that way now. Refresh and retry.',
      );
    case 'community_muted':
      throw new AppError('FORBIDDEN', {
        message: `An administrator has paused your posting in Community${
          info.details ? ` (${info.details.replace(/\.$/, '')})` : ''
        }. You can still read posts and listings.`,
      });
    case 'community_not_member':
      throw new AppError('FORBIDDEN', {
        message: 'Join this group to read and post in it.',
      });
    case 'community_already_reported':
      throw new ConflictError(
        'invalid_state',
        'You or someone from your flat has already reported this.',
      );
    case 'community_own_item':
      throw new ValidationError(
        { form: 'You cannot report something you posted.' },
        'You cannot report something you posted.',
      );
    case 'community_photo_invalid':
      throw new ValidationError(
        {
          photoPaths:
            'A photo could not be attached. Remove it, upload it again and retry.',
        },
        'Check the photos and retry.',
      );
    case 'community_group_archived':
      throw new ConflictError(
        'invalid_state',
        'This group has been archived. Nothing new can be added to it.',
      );
    default:
      throw error;
  }
}

async function callCommunityRpc<T>(
  context: Context,
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
  failureMessage: string,
): Promise<T> {
  try {
    return await callModuleRpc(context, name, args, schema, failureMessage);
  } catch (error) {
    return mapCommunityError(error);
  }
}

async function pushFor(context: Context) {
  await sendNotificationPushesForRequest(context.requestId);
}

function pageOffset(page: number) {
  return (Math.max(1, Math.floor(page)) - 1) * COMMUNITY_PAGE_SIZE;
}

// Resident reads

export async function getCommunityHome() {
  const { context, societyId } = await getContext('community:participate');
  return callCommunityRpc(
    context,
    'community_home',
    { p_society_id: societyId },
    communityHomeSchema,
    'Could not load Community. Refresh and retry.',
  );
}

// Non-members see the group card with a join button instead of a refusal.
export async function getCommunityGroupPage(groupId: unknown, page = 1) {
  const { context, societyId } = await getContext('community:participate');
  const values = parseModuleInput(communityGroupIdInputSchema, { groupId });
  const home = await callCommunityRpc(
    context,
    'community_home',
    { p_society_id: societyId },
    communityHomeSchema,
    'Could not load this group. Refresh and retry.',
  );
  const group = home.groups.find((item) => item.id === values.groupId);
  if (!group) throw new AppError('NOT_FOUND');
  if (!group.joined) {
    return { group, myMute: home.myMute, feed: null, photoUrls: {} };
  }
  const feed = await callCommunityRpc(
    context,
    'community_group_feed',
    {
      p_society_id: societyId,
      p_group_id: values.groupId,
      p_limit: COMMUNITY_PAGE_SIZE,
      p_offset: pageOffset(page),
    },
    communityGroupFeedSchema,
    'Could not load this group. Refresh and retry.',
  );
  const photoUrls = await signCommunityPhotos(
    context,
    societyId,
    feed.items.flatMap((item) => item.photoPaths),
    { verify: false },
  );
  return { group, myMute: home.myMute, feed, photoUrls };
}

export async function getCommunityPost(postId: unknown) {
  const { context, societyId } = await getContext('community:participate');
  const values = parseModuleInput(communityPostIdInputSchema, { postId });
  const detail = await callCommunityRpc(
    context,
    'community_post_get',
    { p_society_id: societyId, p_post_id: values.postId },
    communityPostDetailSchema,
    'Could not load this post. Refresh and retry.',
  );
  const photoUrls = await signCommunityPhotos(
    context,
    societyId,
    detail.photos.map((photo) => photo.path),
    { verify: true },
  );
  return { detail, photoUrls };
}

export async function getCommunityMarketplace(filter: {
  type: CommunityListingType | null;
  search: string | null;
  page: number;
}) {
  const { context, societyId } = await getContext('community:participate');
  const search = filter.search?.trim().slice(0, COMMUNITY_SEARCH_MAX) || null;
  const marketplace = await callCommunityRpc(
    context,
    'community_marketplace',
    {
      p_society_id: societyId,
      p_type: communityListingTypeFilterSchema.parse(filter.type),
      p_search: search,
      p_limit: COMMUNITY_PAGE_SIZE,
      p_offset: pageOffset(filter.page),
    },
    communityMarketplaceSchema,
    'Could not load the marketplace. Refresh and retry.',
  );
  const photoUrls = await signCommunityPhotos(
    context,
    societyId,
    marketplace.items.flatMap((item) =>
      item.firstPhotoPath ? [item.firstPhotoPath] : [],
    ),
    { verify: false },
  );
  return { marketplace, photoUrls };
}

export async function getCommunityListing(listingId: unknown) {
  const { context, societyId } = await getContext('community:participate');
  const values = parseModuleInput(communityListingIdInputSchema, {
    listingId,
  });
  const detail = await callCommunityRpc(
    context,
    'community_listing_get',
    { p_society_id: societyId, p_listing_id: values.listingId },
    communityListingDetailSchema,
    'Could not load this listing. Refresh and retry.',
  );
  const photoUrls = await signCommunityPhotos(
    context,
    societyId,
    detail.photos.map((photo) => photo.path),
    { verify: true },
  );
  return { detail, photoUrls };
}

export async function getCommunityMyItems() {
  const { context, societyId } = await getContext('community:participate');
  return callCommunityRpc(
    context,
    'community_my_items',
    { p_society_id: societyId },
    communityMyItemsSchema,
    'Could not load your posts and listings. Refresh and retry.',
  );
}

// Resident writes

export async function prepareCommunityPhotoUpload(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  await enforceRateLimit(
    'fileUploadUserHourly',
    context.userId,
    context.requestId,
  );
  try {
    return await issueCommunityPhotoUpload(context, societyId, input);
  } catch (error) {
    return mapCommunityError(error);
  }
}

export async function setCommunityGroupMembership(
  input: unknown,
  join: boolean,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityGroupIdInputSchema, input);
  return callCommunityRpc(
    context,
    join ? 'community_group_join' : 'community_group_leave',
    {
      p_society_id: societyId,
      p_group_id: values.groupId,
      p_request_id: context.requestId,
    },
    communityGroupJoinResultSchema,
    join
      ? 'You were not added to the group. Refresh and retry.'
      : 'You did not leave the group. Refresh and retry.',
  );
}

export async function createCommunityPost(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityPostCreateInputSchema, input);
  const result = await callCommunityRpc(
    context,
    'community_post_create',
    {
      p_society_id: societyId,
      p_group_id: values.groupId,
      p_client_request_id: values.clientRequestId,
      p_body: values.body,
      p_photo_paths: values.photoPaths,
      p_request_id: context.requestId,
    },
    communityPostCreateResultSchema,
    'Your post was not sent. Check it and retry.',
  );
  await pushFor(context);
  return result;
}

export async function updateCommunityPost(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityPostUpdateInputSchema, input);
  return callCommunityRpc(
    context,
    'community_post_update',
    {
      p_society_id: societyId,
      p_post_id: values.postId,
      p_expected_version: values.expectedVersion,
      p_body: values.body,
      p_photo_paths: values.photoPaths,
      p_request_id: context.requestId,
    },
    communityPostUpdateResultSchema,
    'Your changes were not saved. Check them and retry.',
  );
}

export async function withdrawCommunityPost(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityPostIdInputSchema, input);
  return callCommunityRpc(
    context,
    'community_post_withdraw',
    {
      p_society_id: societyId,
      p_post_id: values.postId,
      p_request_id: context.requestId,
    },
    communityPostStatusResultSchema,
    'Your post was not deleted. Refresh and retry.',
  );
}

export async function createCommunityListing(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityListingCreateInputSchema, input);
  const result = await callCommunityRpc(
    context,
    'community_listing_create',
    {
      p_society_id: societyId,
      p_client_request_id: values.clientRequestId,
      p_listing: values.listing,
      p_photo_paths: values.photoPaths,
      p_request_id: context.requestId,
    },
    communityListingCreateResultSchema,
    'Your listing was not sent. Check it and retry.',
  );
  await pushFor(context);
  return result;
}

export async function updateCommunityListing(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityListingUpdateInputSchema, input);
  return callCommunityRpc(
    context,
    'community_listing_update',
    {
      p_society_id: societyId,
      p_listing_id: values.listingId,
      p_expected_version: values.expectedVersion,
      p_listing: values.listing,
      p_photo_paths: values.photoPaths,
      p_request_id: context.requestId,
    },
    communityListingUpdateResultSchema,
    'Your changes were not saved. Check them and retry.',
  );
}

const LISTING_ACTIONS = {
  withdraw: {
    rpc: 'community_listing_withdraw',
    failure: 'Your listing was not deleted. Refresh and retry.',
  },
  close: {
    rpc: 'community_listing_close',
    failure: 'Your listing was not closed. Refresh and retry.',
  },
} as const;

export async function changeCommunityListing(
  input: unknown,
  action: keyof typeof LISTING_ACTIONS,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityListingIdInputSchema, input);
  return callCommunityRpc(
    context,
    LISTING_ACTIONS[action].rpc,
    {
      p_society_id: societyId,
      p_listing_id: values.listingId,
      p_request_id: context.requestId,
    },
    communityListingStatusResultSchema,
    LISTING_ACTIONS[action].failure,
  );
}

export async function renewCommunityListing(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityListingIdInputSchema, input);
  return callCommunityRpc(
    context,
    'community_listing_renew',
    {
      p_society_id: societyId,
      p_listing_id: values.listingId,
      p_request_id: context.requestId,
    },
    communityListingRenewResultSchema,
    'Your listing was not renewed. Refresh and retry.',
  );
}

export async function createCommunityReply(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityReplyCreateInputSchema, input);
  const result = await callCommunityRpc(
    context,
    'community_reply_create',
    {
      p_society_id: societyId,
      p_target_type: values.targetType,
      p_target_id: values.targetId,
      p_client_request_id: values.clientRequestId,
      p_body: values.body,
      p_request_id: context.requestId,
    },
    communityReplyCreateResultSchema,
    'Your reply was not sent. Check it and retry.',
  );
  await pushFor(context);
  return result;
}

export async function deleteCommunityReply(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityReplyIdInputSchema, input);
  return callCommunityRpc(
    context,
    'community_reply_delete',
    {
      p_society_id: societyId,
      p_reply_id: values.replyId,
      p_request_id: context.requestId,
    },
    communityDeletedResultSchema,
    'Your reply was not deleted. Refresh and retry.',
  );
}

export async function reportCommunityItem(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityReportInputSchema, input);
  const result = await callCommunityRpc(
    context,
    'community_report',
    {
      p_society_id: societyId,
      p_target_type: values.targetType,
      p_target_id: values.targetId,
      p_reason: values.reason,
      p_note: values.note,
      p_request_id: context.requestId,
    },
    communityReportResultSchema,
    'Your report was not sent. Refresh and retry.',
  );
  if (result.hidden) await pushFor(context);
  return result;
}

export async function setCommunityPreferences(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'community:participate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityPreferencesInputSchema, input);
  return callCommunityRpc(
    context,
    'community_preferences_set',
    {
      p_society_id: societyId,
      p_new_listing_alerts: values.newListingAlerts,
      p_request_id: context.requestId,
    },
    communityPreferencesResultSchema,
    'Your alert setting was not saved. Refresh and retry.',
  );
}

// Administrator reads

export async function getCommunityAdminQueue(queue: unknown, page = 1) {
  const { context, societyId } = await getContext('community:moderate');
  const value: CommunityAdminQueue = communityAdminQueueSchema.parse(queue);
  return callCommunityRpc(
    context,
    'community_admin_queue',
    {
      p_society_id: societyId,
      p_queue: value,
      p_limit: COMMUNITY_PAGE_SIZE,
      p_offset: pageOffset(page),
    },
    communityAdminQueueResultSchema,
    'Could not load the review queue. Refresh and retry.',
  );
}

export async function getCommunityAdminItem(
  targetType: unknown,
  targetId: unknown,
) {
  const { context, societyId } = await getContext('community:moderate');
  const type = communityTargetTypeSchema.safeParse(targetType);
  const id = z.uuid().safeParse(targetId);
  if (!type.success || !id.success) throw new AppError('NOT_FOUND');
  const detail = await callCommunityRpc(
    context,
    'community_admin_item_get',
    {
      p_society_id: societyId,
      p_target_type: type.data,
      p_target_id: id.data,
    },
    communityAdminItemSchema,
    'Could not load this item. Refresh and retry.',
  );
  const photoUrls = await signCommunityPhotos(
    context,
    societyId,
    detail.item.photos.map((photo) => photo.path),
    { verify: true },
  );
  return { detail, photoUrls, targetType: type.data };
}

export async function getCommunityAdminGroups() {
  const { context, societyId } = await getContext('community:moderate');
  return callCommunityRpc(
    context,
    'community_admin_groups',
    { p_society_id: societyId },
    communityAdminGroupsSchema,
    'Could not load groups. Refresh and retry.',
  );
}

export async function getCommunityAdminMutes(search: string | null) {
  const { context, societyId } = await getContext('community:moderate');
  const term = search?.trim().slice(0, COMMUNITY_SEARCH_MAX) || null;
  const [mutes, members, settings] = await Promise.all([
    callCommunityRpc(
      context,
      'community_admin_mutes',
      { p_society_id: societyId },
      communityAdminMutesSchema,
      'Could not load muted residents. Refresh and retry.',
    ),
    term
      ? callCommunityRpc(
          context,
          'community_member_options',
          { p_society_id: societyId, p_search: term, p_limit: 20 },
          communityMemberOptionsSchema,
          'Could not search residents. Refresh and retry.',
        )
      : Promise.resolve(null),
    callCommunityRpc(
      context,
      'community_settings_get',
      { p_society_id: societyId },
      communitySettingsResultSchema,
      'Could not load the muted-resident settings. Refresh and retry.',
    ),
  ]);
  return { mutes, members: members?.items ?? null, search: term, settings };
}

// Administrator writes

export async function updateCommunitySettings(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'community:moderate',
    true,
    requestId,
  );
  const values = parseModuleInput(communitySettingsInputSchema, input);
  return callCommunityRpc(
    context,
    'community_settings_update',
    {
      p_society_id: societyId,
      p_settings: values.settings,
      p_expected_updated_at: values.expectedUpdatedAt,
      p_request_id: context.requestId,
    },
    communitySettingsResultSchema,
    'The settings were not saved. Refresh and retry.',
  );
}
export async function saveCommunityGroup(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'community:moderate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityGroupSaveInputSchema, input);
  return callCommunityRpc(
    context,
    'community_group_save',
    {
      p_society_id: societyId,
      p_group_id: values.groupId,
      p_expected_version: values.expectedVersion,
      p_name: values.name,
      p_description: values.description,
      p_request_id: context.requestId,
    },
    communityGroupSaveResultSchema,
    'The group was not saved. Check the name and retry.',
  );
}

export async function archiveCommunityGroup(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'community:moderate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityGroupArchiveInputSchema, input);
  return callCommunityRpc(
    context,
    'community_group_archive',
    {
      p_society_id: societyId,
      p_group_id: values.groupId,
      p_expected_version: values.expectedVersion,
      p_archived: values.archived,
      p_request_id: context.requestId,
    },
    communityGroupArchiveResultSchema,
    'The group was not updated. Refresh and retry.',
  );
}

export async function moderateCommunityItem(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'community:moderate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityModerateInputSchema, input);
  const result = await callCommunityRpc(
    context,
    'community_moderate',
    {
      p_society_id: societyId,
      p_target_type: values.targetType,
      p_target_id: values.targetId,
      p_action: values.action,
      p_reason: values.reason,
      p_request_id: context.requestId,
    },
    communityModerateResultSchema,
    'The decision was not saved. Refresh and retry.',
  );
  await pushFor(context);
  return result;
}

export async function muteCommunityMember(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'community:moderate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityMuteInputSchema, input);
  const result = await callCommunityRpc(
    context,
    'community_mute',
    {
      p_society_id: societyId,
      p_membership_id: values.membershipId,
      p_duration: values.duration,
      p_reason: values.reason,
      p_request_id: context.requestId,
    },
    communityMuteResultSchema,
    'The resident was not muted. Refresh and retry.',
  );
  await pushFor(context);
  return result;
}

export async function unmuteCommunityMember(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'community:moderate',
    true,
    requestId,
  );
  const values = parseModuleInput(communityUnmuteInputSchema, input);
  const result = await callCommunityRpc(
    context,
    'community_unmute',
    {
      p_society_id: societyId,
      p_membership_id: values.membershipId,
      p_request_id: context.requestId,
    },
    communityUnmuteResultSchema,
    'The mute was not lifted. Refresh and retry.',
  );
  if (result.lifted) await pushFor(context);
  return result;
}
