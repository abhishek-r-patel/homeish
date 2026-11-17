// Validate Resident Community & Marketplace settings, form input and the database read models.
import { z } from 'zod';

export const DEFAULT_COMMUNITY_SETTINGS = {} as const;

export const communitySettingsSchema = z.object({}).strict();

export const COMMUNITY_POST_BODY_MAX = 4000;
export const COMMUNITY_REPLY_BODY_MAX = 2000;
export const COMMUNITY_GROUP_NAME_MAX = 80;
export const COMMUNITY_GROUP_DESCRIPTION_MAX = 500;
export const COMMUNITY_LISTING_TITLE_MAX = 120;
export const COMMUNITY_LISTING_DESCRIPTION_MAX = 4000;
export const COMMUNITY_PRICE_MAX_PAISE = 1_000_000_000;
export const COMMUNITY_REASON_MAX = 500;
export const COMMUNITY_REPORT_NOTE_MAX = 500;
export const COMMUNITY_MAX_PHOTOS = 3;
export const COMMUNITY_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const COMMUNITY_PHOTO_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
] as const;
export const COMMUNITY_PAGE_SIZE = 20;
export const COMMUNITY_SEARCH_MAX = 100;
export const COMMUNITY_CONTACT_PHONE_PATTERN = /^[0-9+ ]{8,16}$/;

export const COMMUNITY_ITEM_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'hidden',
  'removed',
  'withdrawn',
] as const;
export const COMMUNITY_REPLY_STATUSES = [
  'visible',
  'hidden',
  'removed',
] as const;
export const COMMUNITY_GROUP_STATUSES = ['active', 'archived'] as const;
export const COMMUNITY_LISTING_TYPES = [
  'sale',
  'give_away',
  'wanted',
  'lost',
  'found',
] as const;
export const COMMUNITY_REPORT_REASONS = [
  'spam',
  'offensive',
  'scam',
  'other',
] as const;
export const COMMUNITY_REPORT_STATUSES = [
  'open',
  'dismissed',
  'actioned',
] as const;
export const COMMUNITY_MUTE_DURATIONS = ['7d', '30d', 'until_lifted'] as const;
export const COMMUNITY_TARGET_TYPES = ['post', 'listing', 'reply'] as const;
export const COMMUNITY_REPLY_TARGET_TYPES = ['post', 'listing'] as const;
export const COMMUNITY_MODERATION_ACTIONS = [
  'approve',
  'reject',
  'remove',
  'restore',
] as const;
export const COMMUNITY_ADMIN_QUEUES = [
  'pending',
  'hidden',
  'reported',
  'removed',
] as const;

export const communityItemStatusSchema = z.enum(COMMUNITY_ITEM_STATUSES);
export const communityReplyStatusSchema = z.enum(COMMUNITY_REPLY_STATUSES);
export const communityGroupStatusSchema = z.enum(COMMUNITY_GROUP_STATUSES);
export const communityListingTypeSchema = z.enum(COMMUNITY_LISTING_TYPES);
export const communityReportReasonSchema = z.enum(COMMUNITY_REPORT_REASONS);
export const communityMuteDurationSchema = z.enum(COMMUNITY_MUTE_DURATIONS);
export const communityTargetTypeSchema = z.enum(COMMUNITY_TARGET_TYPES);
export const communityReplyTargetTypeSchema = z.enum(
  COMMUNITY_REPLY_TARGET_TYPES,
);
export const communityModerationActionSchema = z.enum(
  COMMUNITY_MODERATION_ACTIONS,
);
export const communityAdminQueueSchema = z
  .enum(COMMUNITY_ADMIN_QUEUES)
  .catch('pending');
export const communityListingTypeFilterSchema = communityListingTypeSchema
  .nullable()
  .catch(null);

export type CommunityItemStatus = z.infer<typeof communityItemStatusSchema>;
export type CommunityReplyStatus = z.infer<typeof communityReplyStatusSchema>;
export type CommunityGroupStatus = z.infer<typeof communityGroupStatusSchema>;
export type CommunityListingType = z.infer<typeof communityListingTypeSchema>;
export type CommunityReportReason = z.infer<typeof communityReportReasonSchema>;
export type CommunityMuteDuration = z.infer<typeof communityMuteDurationSchema>;
export type CommunityTargetType = z.infer<typeof communityTargetTypeSchema>;
export type CommunityReplyTargetType = z.infer<
  typeof communityReplyTargetTypeSchema
>;
export type CommunityModerationAction = z.infer<
  typeof communityModerationActionSchema
>;
export type CommunityAdminQueue = (typeof COMMUNITY_ADMIN_QUEUES)[number];

const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const version = z.number().int().min(1).max(2_147_483_647);
const count = z.number().int().min(0);
const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));
// Read models tolerate a missing optional key so additive database changes do not break screens.
const maybe = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((value) => value ?? null);

const UUID_TEXT =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const communityPhotoPathSchema = z
  .string()
  .max(300)
  .regex(new RegExp(`^${UUID_TEXT}/${UUID_TEXT}/${UUID_TEXT}\\.(jpg|png)$`));

export const communityPhotoPathsSchema = z
  .array(communityPhotoPathSchema)
  .max(COMMUNITY_MAX_PHOTOS, 'Add up to 3 photos.')
  .refine((paths) => new Set(paths).size === paths.length, {
    message: 'Each photo can be added once.',
  });

export const communityPhotoUploadInputSchema = z
  .object({
    contentType: z.enum(COMMUNITY_PHOTO_CONTENT_TYPES, {
      message: 'Choose a JPG or PNG photo.',
    }),
    sizeBytes: z
      .number()
      .int()
      .min(1)
      .max(COMMUNITY_PHOTO_MAX_BYTES, 'Choose a photo up to 5 MiB.'),
  })
  .strict();

export const communityPhotoUploadResultSchema = z.object({
  path: communityPhotoPathSchema,
  signedUrl: z.url(),
});

export type CommunityPhotoUploadResult = z.infer<
  typeof communityPhotoUploadResultSchema
>;

// Writes

export const communityGroupIdInputSchema = z.object({ groupId: uuid }).strict();

export const communityPostIdInputSchema = z.object({ postId: uuid }).strict();

export const communityListingIdInputSchema = z
  .object({ listingId: uuid })
  .strict();

export const communityReplyIdInputSchema = z.object({ replyId: uuid }).strict();

const postBodySchema = requiredText(
  COMMUNITY_POST_BODY_MAX,
  'Write something to share.',
);

export const communityPostCreateInputSchema = z
  .object({
    clientRequestId: uuid,
    groupId: uuid,
    body: postBodySchema,
    photoPaths: communityPhotoPathsSchema,
  })
  .strict();

export const communityPostUpdateInputSchema = z
  .object({
    postId: uuid,
    expectedVersion: version,
    body: postBodySchema,
    photoPaths: communityPhotoPathsSchema,
  })
  .strict();

export const communityListingInputSchema = z
  .object({
    listingType: communityListingTypeSchema,
    title: requiredText(
      COMMUNITY_LISTING_TITLE_MAX,
      'Give the listing a title.',
    ),
    description: optionalText(COMMUNITY_LISTING_DESCRIPTION_MAX),
    pricePaise: z
      .number()
      .int('Enter the price in rupees and paise.')
      .min(0, 'The price cannot be negative.')
      .max(COMMUNITY_PRICE_MAX_PAISE, 'Keep the price at ₹1,00,00,000 or less.')
      .nullable(),
    contactPhone: z
      .string()
      .trim()
      .nullable()
      .transform((value) => (value ? value : null))
      .refine(
        (value) =>
          value === null || COMMUNITY_CONTACT_PHONE_PATTERN.test(value),
        'Enter 8 to 16 digits; spaces and + are allowed.',
      ),
  })
  .strict()
  .superRefine((listing, context) => {
    if (listing.listingType !== 'sale' && listing.pricePaise !== null) {
      context.addIssue({
        code: 'custom',
        path: ['pricePaise'],
        message: 'Only items for sale can have a price.',
      });
    }
  });

export type CommunityListingInput = z.infer<typeof communityListingInputSchema>;

export const communityListingCreateInputSchema = z
  .object({
    clientRequestId: uuid,
    listing: communityListingInputSchema,
    photoPaths: communityPhotoPathsSchema,
  })
  .strict();

export const communityListingUpdateInputSchema = z
  .object({
    listingId: uuid,
    expectedVersion: version,
    listing: communityListingInputSchema,
    photoPaths: communityPhotoPathsSchema,
  })
  .strict();

export const communityReplyCreateInputSchema = z
  .object({
    clientRequestId: uuid,
    targetType: communityReplyTargetTypeSchema,
    targetId: uuid,
    body: requiredText(COMMUNITY_REPLY_BODY_MAX, 'Write a reply.'),
  })
  .strict();

export const communityReportInputSchema = z
  .object({
    targetType: communityTargetTypeSchema,
    targetId: uuid,
    reason: communityReportReasonSchema,
    note: optionalText(COMMUNITY_REPORT_NOTE_MAX),
  })
  .strict();

export const communityPreferencesInputSchema = z
  .object({ newListingAlerts: z.boolean() })
  .strict();

export const communityGroupSaveInputSchema = z
  .object({
    groupId: uuid.nullable(),
    expectedVersion: version.nullable(),
    name: requiredText(COMMUNITY_GROUP_NAME_MAX, 'Give the group a name.'),
    description: optionalText(COMMUNITY_GROUP_DESCRIPTION_MAX),
  })
  .strict()
  .refine(
    (input) => (input.groupId === null) === (input.expectedVersion === null),
    {
      path: ['expectedVersion'],
      message: 'Refresh the group before saving it.',
    },
  );

export const communityGroupArchiveInputSchema = z
  .object({ groupId: uuid, expectedVersion: version, archived: z.boolean() })
  .strict();

export const communityModerateInputSchema = z
  .object({
    targetType: communityTargetTypeSchema,
    targetId: uuid,
    action: communityModerationActionSchema,
    reason: optionalText(COMMUNITY_REASON_MAX),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      (input.action === 'reject' || input.action === 'remove') &&
      input.reason === null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Give a reason. The author sees it.',
      });
    }
  });

export const communityMuteInputSchema = z
  .object({
    membershipId: uuid,
    duration: communityMuteDurationSchema,
    reason: requiredText(
      COMMUNITY_REASON_MAX,
      'Give a reason. The resident sees it.',
    ),
  })
  .strict();

export const communityUnmuteInputSchema = z
  .object({ membershipId: uuid })
  .strict();

// Write results

export const communityGroupJoinResultSchema = z.object({
  groupId: uuid,
  joined: z.boolean(),
});

export const communityPostCreateResultSchema = z.object({
  postId: uuid,
  status: communityItemStatusSchema,
});

export const communityPostUpdateResultSchema = z.object({
  postId: uuid,
  version,
});

export const communityPostStatusResultSchema = z.object({
  postId: uuid,
  status: communityItemStatusSchema,
});

export const communityListingCreateResultSchema = z.object({
  listingId: uuid,
  status: communityItemStatusSchema,
});

export const communityListingUpdateResultSchema = z.object({
  listingId: uuid,
  version,
});

export const communityListingStatusResultSchema = z
  .object({ listingId: uuid })
  .loose();

export const communityListingRenewResultSchema = z.object({
  listingId: uuid,
  expiresAt: timestamp,
});

export const communityReplyCreateResultSchema = z.object({ replyId: uuid });

export const communityDeletedResultSchema = z.object({
  deleted: z.literal(true),
});

export const communityReportResultSchema = z.object({
  reportId: uuid,
  hidden: z.boolean(),
});

export const communityPreferencesResultSchema = z.object({
  newListingAlerts: z.boolean(),
});

export const communityGroupSaveResultSchema = z.object({
  groupId: uuid,
  version,
});

export const communityGroupArchiveResultSchema = z.object({
  groupId: uuid,
  version,
  status: communityGroupStatusSchema,
});

export const communityModerateResultSchema = z.object({
  targetId: uuid,
  status: z.union([communityItemStatusSchema, communityReplyStatusSchema]),
});

export const communityMuteResultSchema = z.object({
  muteId: uuid,
  mutedUntil: timestamp.nullable(),
});

export const communityUnmuteResultSchema = z.object({ lifted: z.boolean() });

// Read models

const authorFields = {
  authorName: z.string(),
  authorUnitLabel: maybe(z.string()),
};

export const communityMuteSchema = z.object({
  mutedUntil: maybe(timestamp),
  untilLifted: z.boolean().optional(),
  reason: maybe(z.string()),
});

export const communityHomeSchema = z.object({
  groups: z.array(
    z.object({
      id: uuid,
      name: z.string(),
      description: maybe(z.string()),
      memberCount: count,
      joined: z.boolean(),
      latestPostAt: maybe(timestamp),
    }),
  ),
  myMute: communityMuteSchema.nullable(),
  preferences: z.object({ newListingAlerts: z.boolean() }),
});

export const communityPhotoSchema = z.object({
  id: uuid,
  path: communityPhotoPathSchema,
  position: z.number().int().min(1).max(COMMUNITY_MAX_PHOTOS),
});

export const communityReplySchema = z.object({
  id: uuid,
  body: z.string(),
  ...authorFields,
  createdAt: timestamp,
  mine: z.boolean(),
  status: communityReplyStatusSchema,
  reportedByMe: z.boolean().optional().default(false),
});

export const communityGroupFeedSchema = z.object({
  group: z.object({
    id: uuid,
    name: z.string(),
    description: maybe(z.string()),
    memberCount: count.optional(),
  }),
  items: z.array(
    z.object({
      id: uuid,
      body: z.string(),
      ...authorFields,
      createdAt: timestamp,
      photoPaths: z.array(communityPhotoPathSchema).default([]),
      replyCount: count,
      mine: z.boolean(),
      status: communityItemStatusSchema.optional().default('approved'),
    }),
  ),
  total: count,
});

export const communityPostDetailSchema = z.object({
  post: z.object({
    id: uuid,
    groupId: maybe(uuid),
    groupName: maybe(z.string()),
    body: z.string(),
    ...authorFields,
    createdAt: timestamp,
    status: communityItemStatusSchema,
    mine: z.boolean(),
    moderationReason: maybe(z.string()),
    version: maybe(version),
  }),
  photos: z.array(communityPhotoSchema),
  replies: z.array(communityReplySchema),
  canReply: z.boolean(),
  reportedByMe: z.boolean(),
});

export const communityMarketplaceSchema = z.object({
  items: z.array(
    z.object({
      id: uuid,
      listingType: communityListingTypeSchema,
      title: z.string(),
      pricePaise: maybe(z.number().int().min(0)),
      ...authorFields,
      approvedAt: maybe(timestamp),
      expiresAt: maybe(timestamp),
      firstPhotoPath: maybe(communityPhotoPathSchema),
      replyCount: count,
    }),
  ),
  total: count,
});

export const communityListingDetailSchema = z.object({
  listing: z.object({
    id: uuid,
    listingType: communityListingTypeSchema,
    title: z.string(),
    description: maybe(z.string()),
    pricePaise: maybe(z.number().int().min(0)),
    contactPhone: maybe(z.string()),
    ...authorFields,
    createdAt: timestamp,
    approvedAt: maybe(timestamp),
    expiresAt: maybe(timestamp),
    closedAt: maybe(timestamp),
    status: communityItemStatusSchema,
    expired: z.boolean(),
    closed: z.boolean(),
    mine: z.boolean(),
    moderationReason: maybe(z.string()),
    version: maybe(version),
  }),
  photos: z.array(communityPhotoSchema),
  replies: z.array(communityReplySchema),
  canReply: z.boolean(),
  reportedByMe: z.boolean(),
});

export const communityMyItemsSchema = z.object({
  posts: z.array(
    z.object({
      id: uuid,
      body: z.string(),
      groupName: maybe(z.string()),
      status: communityItemStatusSchema,
      createdAt: timestamp,
      moderationReason: maybe(z.string()),
    }),
  ),
  listings: z.array(
    z.object({
      id: uuid,
      title: z.string(),
      listingType: communityListingTypeSchema,
      status: communityItemStatusSchema,
      createdAt: timestamp,
      expiresAt: maybe(timestamp),
      expired: z.boolean(),
      closed: z.boolean(),
      moderationReason: maybe(z.string()),
    }),
  ),
});

export const communityAdminQueueResultSchema = z.object({
  items: z.array(
    z.object({
      targetType: communityTargetTypeSchema,
      targetId: uuid,
      title: maybe(z.string()),
      excerpt: maybe(z.string()),
      ...authorFields,
      authorMembershipId: maybe(uuid),
      status: z.union([communityItemStatusSchema, communityReplyStatusSchema]),
      openReports: count,
      createdAt: timestamp,
    }),
  ),
  total: count,
});

export const communityAdminItemSchema = z.object({
  item: z.object({
    targetType: communityTargetTypeSchema.optional(),
    id: uuid,
    status: z.union([communityItemStatusSchema, communityReplyStatusSchema]),
    body: maybe(z.string()),
    title: maybe(z.string()),
    description: maybe(z.string()),
    listingType: maybe(communityListingTypeSchema),
    pricePaise: maybe(z.number().int().min(0)),
    contactPhone: maybe(z.string()),
    groupName: maybe(z.string()),
    ...authorFields,
    authorMembershipId: maybe(uuid),
    createdAt: timestamp,
    moderationReason: maybe(z.string()),
    expiresAt: maybe(timestamp),
    closedAt: maybe(timestamp),
    photos: z.array(communityPhotoSchema).optional().default([]),
  }),
  reports: z.array(
    z.object({
      reason: communityReportReasonSchema,
      note: maybe(z.string()),
      reporterUnitLabel: maybe(z.string()),
      createdAt: timestamp,
      status: z.enum(COMMUNITY_REPORT_STATUSES),
    }),
  ),
  authorMute: communityMuteSchema
    .extend({ duration: maybe(communityMuteDurationSchema) })
    .nullable(),
});

export const communityAdminGroupsSchema = z.object({
  items: z.array(
    z.object({
      id: uuid,
      name: z.string(),
      description: maybe(z.string()),
      status: communityGroupStatusSchema,
      memberCount: count,
      postCount: count,
      version,
    }),
  ),
});

export const communityAdminMutesSchema = z.object({
  items: z.array(
    z.object({
      membershipId: uuid,
      name: z.string(),
      unitLabel: maybe(z.string()),
      duration: communityMuteDurationSchema,
      mutedUntil: maybe(timestamp),
      reason: z.string(),
      createdAt: timestamp,
    }),
  ),
});

export const communityMemberOptionsSchema = z.object({
  items: z.array(
    z.object({
      membershipId: uuid,
      name: z.string(),
      unitLabel: maybe(z.string()),
    }),
  ),
});

export type CommunityHome = z.infer<typeof communityHomeSchema>;
export type CommunityHomeGroup = CommunityHome['groups'][number];
export type CommunityMute = z.infer<typeof communityMuteSchema>;
export type CommunityPhoto = z.infer<typeof communityPhotoSchema>;
export type CommunityReply = z.infer<typeof communityReplySchema>;
export type CommunityGroupFeed = z.infer<typeof communityGroupFeedSchema>;
export type CommunityFeedItem = CommunityGroupFeed['items'][number];
export type CommunityPostDetail = z.infer<typeof communityPostDetailSchema>;
export type CommunityMarketplace = z.infer<typeof communityMarketplaceSchema>;
export type CommunityMarketplaceItem = CommunityMarketplace['items'][number];
export type CommunityListingDetail = z.infer<
  typeof communityListingDetailSchema
>;
export type CommunityMyItems = z.infer<typeof communityMyItemsSchema>;
export type CommunityAdminQueueResult = z.infer<
  typeof communityAdminQueueResultSchema
>;
export type CommunityAdminQueueItem =
  CommunityAdminQueueResult['items'][number];
export type CommunityAdminItem = z.infer<typeof communityAdminItemSchema>;
export type CommunityAdminGroups = z.infer<typeof communityAdminGroupsSchema>;
export type CommunityAdminGroup = CommunityAdminGroups['items'][number];
export type CommunityAdminMutes = z.infer<typeof communityAdminMutesSchema>;
export type CommunityAdminMute = CommunityAdminMutes['items'][number];
export type CommunityMemberOption = z.infer<
  typeof communityMemberOptionsSchema
>['items'][number];
