// Exercise Community & Marketplace screens with synthetic records and injected actions only.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import {
  CommunityAdminGroupsView,
  CommunityAdminItemView,
  CommunityAdminMutesView,
  CommunityAdminQueueView,
  type CommunityAdminActions,
} from '@/components/community/admin';
import {
  CommunityGroupView,
  CommunityHomeView,
  CommunityListingView,
  CommunityMarketplaceView,
  CommunityMyItemsView,
  CommunityNewListingView,
  CommunityPostView,
  type CommunityResidentActions,
} from '@/components/community/resident';
import { CommunityRouteState } from '@/components/community/shared';
import { Banner } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';
import type { ServerActionResult } from '@/core/actions/server-action';
import { publicEnvironment } from '@/core/config/public-env';
import type {
  CommunityAdminItem,
  CommunityHome,
  CommunityListingDetail,
  CommunityPostDetail,
} from '@/core/community/validation';

const roleSchema = z.enum(['resident', 'admin', 'guard']);
const scenarioSchema = z.enum([
  'home',
  'home-muted',
  'group',
  'group-join',
  'post',
  'post-pending',
  'marketplace',
  'marketplace-empty',
  'listing-new',
  'listing',
  'listing-pending',
  'listing-expired',
  'listing-muted',
  'mine',
  'admin-queue',
  'admin-queue-empty',
  'admin-item-pending',
  'admin-item-hidden',
  'admin-groups',
  'admin-mutes',
  'disabled',
  'denied',
  'error',
]);
type FixtureRole = z.infer<typeof roleSchema>;
type Scenario = z.infer<typeof scenarioSchema>;

const id = (number: string) =>
  `c0000000-0000-4000-8000-${number.padStart(12, '0')}`;
const SOCIETY = id('900');
const USER = id('901');
const STORAGE_BASE = publicEnvironment.NEXT_PUBLIC_SUPABASE_URL.replace(
  /\/$/,
  '',
);
const NOW = '2099-12-10T05:30:00.000Z';
const EARLIER = '2099-12-09T13:15:00.000Z';
const EXPIRES = '2100-01-08T05:30:00.000Z';
const PAST = '2026-01-01T05:30:00.000Z';
const GROUP = id('1');
const POST = id('11');
const LISTING = id('21');
const MEMBER_A = id('31');
const MEMBER_B = id('32');
const photoPath = (number: string) => `${SOCIETY}/${USER}/${id(number)}.jpg`;
const PHOTO_A = photoPath('41');
const PHOTO_B = photoPath('42');

function svgPhoto(fill: string) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${fill}"/></svg>`,
  )}`;
}
const photoUrls = {
  [PHOTO_A]: svgPhoto('#c7d7cf'),
  [PHOTO_B]: svgPhoto('#e3d3b8'),
};

const successAction = async (): Promise<ServerActionResult<unknown>> => ({
  ok: true,
  message: 'Synthetic action complete. Nothing was saved.',
});

const prepareUpload = async (
  form: FormData,
): Promise<ServerActionResult<unknown>> => {
  const input = z
    .object({ contentType: z.enum(['image/jpeg', 'image/png']) })
    .parse(JSON.parse(z.string().parse(form.get('input'))));
  const path = `${SOCIETY}/${USER}/${crypto.randomUUID()}.${input.contentType === 'image/png' ? 'png' : 'jpg'}`;
  return {
    ok: true,
    data: {
      path,
      signedUrl: `${STORAGE_BASE}/storage/v1/object/upload/sign/community-photos/${path}?token=synthetic`,
    },
  };
};

const requestFiles: typeof fetch = async () =>
  new Response(null, { status: 200 });

const residentActions: CommunityResidentActions = {
  prepareUpload,
  joinGroup: successAction,
  leaveGroup: successAction,
  setPreferences: successAction,
  createPost: successAction,
  updatePost: successAction,
  withdrawPost: successAction,
  createListing: successAction,
  updateListing: successAction,
  withdrawListing: successAction,
  closeListing: successAction,
  renewListing: successAction,
  createReply: successAction,
  deleteReply: successAction,
  report: successAction,
};

const adminActions: CommunityAdminActions = {
  moderate: successAction,
  mute: successAction,
  unmute: successAction,
  saveSettings: successAction,
  saveGroup: successAction,
  archiveGroup: successAction,
};

function home(muted: boolean): CommunityHome {
  return {
    groups: [
      {
        id: GROUP,
        name: 'Gardening club',
        description: 'Seeds, saplings and terrace garden tips.',
        memberCount: 42,
        joined: true,
        latestPostAt: EARLIER,
      },
      {
        id: id('2'),
        name: 'Parents of Tower B',
        description: null,
        memberCount: 1,
        joined: false,
        latestPostAt: null,
      },
    ],
    myMute: muted
      ? {
          mutedUntil: EXPIRES,
          untilLifted: false,
          reason: 'Repeated advertising in groups.',
        }
      : null,
    preferences: { newListingAlerts: true },
  };
}

const replies = [
  {
    id: id('51'),
    body: 'I can lend you a pruning saw this weekend.',
    authorName: 'Synthetic Resident B',
    authorUnitLabel: 'B-201',
    createdAt: NOW,
    mine: false,
    status: 'visible' as const,
    reportedByMe: false,
  },
  {
    id: id('52'),
    body: 'Thanks, that would help a lot.',
    authorName: 'Synthetic Resident A',
    authorUnitLabel: 'A-101',
    createdAt: NOW,
    mine: true,
    status: 'visible' as const,
    reportedByMe: false,
  },
];

function postDetail(pending: boolean): CommunityPostDetail {
  return {
    post: {
      id: POST,
      groupId: GROUP,
      groupName: 'Gardening club',
      body: 'Does anyone have a spare pruning saw? The mango tree near the gate needs trimming before the monsoon.',
      authorName: pending ? 'Synthetic Resident A' : 'Synthetic Resident C',
      authorUnitLabel: pending ? 'A-101' : 'C-303',
      createdAt: EARLIER,
      status: pending ? 'pending' : 'approved',
      mine: pending,
      moderationReason: null,
      version: 1,
    },
    photos: [{ id: id('61'), path: PHOTO_A, position: 1 }],
    replies: pending ? [] : replies,
    canReply: !pending,
    reportedByMe: false,
    myMute: null,
  };
}

type ListingScenario = 'live' | 'pending' | 'expired' | 'muted';

function listingDetail(scenario: ListingScenario): CommunityListingDetail {
  const mine = scenario !== 'live';
  return {
    myMute:
      scenario === 'muted'
        ? {
            mutedUntil: EXPIRES,
            untilLifted: false,
            reason: 'Repeated advertising in groups.',
            canEditPending: false,
            canReport: false,
            canRenew: false,
          }
        : null,
    listing: {
      id: LISTING,
      listingType: 'sale',
      title: 'Study table with chair',
      description:
        'Solid wood, 4 years old, small scratch on the left side. Pick up from Tower A.',
      pricePaise: 250_000,
      contactPhone: scenario === 'live' ? '+91 98765 43210' : null,
      authorName: mine ? 'Synthetic Resident A' : 'Synthetic Resident C',
      authorUnitLabel: mine ? 'A-101' : 'C-303',
      createdAt: EARLIER,
      approvedAt: scenario === 'pending' ? null : EARLIER,
      expiresAt:
        scenario === 'pending'
          ? null
          : scenario === 'expired' || scenario === 'muted'
            ? PAST
            : EXPIRES,
      closedAt: null,
      status: scenario === 'pending' ? 'pending' : 'approved',
      expired: scenario === 'expired' || scenario === 'muted',
      closed: false,
      mine,
      moderationReason: null,
      version: 2,
    },
    photos: [
      { id: id('62'), path: PHOTO_A, position: 1 },
      { id: id('63'), path: PHOTO_B, position: 2 },
    ],
    replies: scenario === 'live' ? replies : [],
    canReply: scenario === 'live',
    reportedByMe: false,
  };
}

function adminItem(hidden: boolean): CommunityAdminItem {
  return {
    item: {
      targetType: hidden ? 'post' : 'listing',
      id: hidden ? POST : LISTING,
      status: hidden ? 'hidden' : 'pending',
      body: hidden ? 'Earn money from home! Message me for details.' : null,
      title: hidden ? null : 'Study table with chair',
      description: hidden
        ? null
        : 'Solid wood, 4 years old. Pick up from Tower A.',
      listingType: hidden ? null : 'sale',
      pricePaise: hidden ? null : 250_000,
      contactPhone: hidden ? null : '+91 98765 43210',
      groupName: hidden ? 'Gardening club' : null,
      authorName: 'Synthetic Resident C',
      authorUnitLabel: 'C-303',
      authorMembershipId: MEMBER_A,
      createdAt: EARLIER,
      moderationReason: null,
      expiresAt: null,
      closedAt: null,
      photos: [{ id: id('64'), path: PHOTO_A, position: 1 }],
    },
    reports: hidden
      ? ['A-101', 'B-201', 'B-202'].map((unit, index) => ({
          reason: index === 2 ? ('scam' as const) : ('spam' as const),
          note: index === 0 ? 'Posted the same message in three groups.' : null,
          reporterUnitLabel: unit,
          createdAt: NOW,
          status: 'open' as const,
        }))
      : [],
    authorMute: null,
  };
}

export default function CommunityFixturePage() {
  const [role, setRole] = useState<FixtureRole>('resident');
  const [scenario, setScenario] = useState<Scenario>('home');
  const adminOnly = scenario.startsWith('admin-');
  const routeState =
    role === 'guard' ||
    (role === 'resident' && adminOnly) ||
    (role === 'admin' &&
      !adminOnly &&
      !['disabled', 'error'].includes(scenario))
      ? 'denied'
      : scenario === 'disabled' || scenario === 'denied' || scenario === 'error'
        ? scenario
        : null;

  const content = (() => {
    if (routeState) {
      return (
        <CommunityRouteState
          kind={routeState}
          returnHref="/fixtures/community"
          retryHref={routeState === 'error' ? '/fixtures/community' : undefined}
          referenceId={routeState === 'error' ? 'ERR-C0A1B2C3D4' : undefined}
        />
      );
    }
    switch (scenario) {
      case 'home-muted':
        return (
          <CommunityHomeView home={home(true)} actions={residentActions} />
        );
      case 'group':
      case 'group-join': {
        const base = home(false);
        const group =
          scenario === 'group'
            ? base.groups[0]!
            : { ...base.groups[1]!, joined: false };
        return (
          <CommunityGroupView
            key={scenario}
            page={{
              group,
              myMute: null,
              photoUrls,
              feed:
                scenario === 'group'
                  ? {
                      group: {
                        id: group.id,
                        name: group.name,
                        description: group.description,
                        memberCount: group.memberCount,
                      },
                      items: [
                        {
                          id: POST,
                          body: postDetail(false).post.body,
                          authorName: 'Synthetic Resident C',
                          authorUnitLabel: 'C-303',
                          createdAt: EARLIER,
                          photoPaths: [PHOTO_A],
                          replyCount: 2,
                          mine: false,
                          status: 'approved',
                        },
                        {
                          id: id('12'),
                          body: 'Free marigold seedlings at A-101 this Sunday.',
                          authorName: 'Synthetic Resident A',
                          authorUnitLabel: 'A-101',
                          createdAt: NOW,
                          photoPaths: [],
                          replyCount: 0,
                          mine: true,
                          status: 'pending',
                        },
                      ],
                      total: 2,
                    }
                  : null,
            }}
            pageNumber={1}
            actions={residentActions}
            request={requestFiles}
          />
        );
      }
      case 'post':
      case 'post-pending':
        return (
          <CommunityPostView
            key={scenario}
            detail={postDetail(scenario === 'post-pending')}
            photoUrls={photoUrls}
            actions={residentActions}
            request={requestFiles}
          />
        );
      case 'marketplace':
      case 'marketplace-empty':
        return (
          <CommunityMarketplaceView
            key={scenario}
            marketplace={
              scenario === 'marketplace-empty'
                ? { items: [], total: 0 }
                : {
                    items: [
                      {
                        id: LISTING,
                        listingType: 'sale',
                        title: 'Study table with chair',
                        pricePaise: 250_000,
                        authorName: 'Synthetic Resident C',
                        authorUnitLabel: 'C-303',
                        approvedAt: EARLIER,
                        expiresAt: EXPIRES,
                        firstPhotoPath: PHOTO_A,
                        replyCount: 2,
                      },
                      {
                        id: id('22'),
                        listingType: 'lost',
                        title: 'Lost: blue school water bottle',
                        pricePaise: null,
                        authorName: 'Synthetic Resident B',
                        authorUnitLabel: 'B-201',
                        approvedAt: NOW,
                        expiresAt: EXPIRES,
                        firstPhotoPath: null,
                        replyCount: 0,
                      },
                    ],
                    total: 2,
                  }
            }
            photoUrls={photoUrls}
            filter={{ type: null, search: null, page: 1 }}
            basePath="/fixtures/community"
          />
        );
      case 'listing-new':
        return (
          <CommunityNewListingView
            actions={residentActions}
            request={requestFiles}
            navigate={false}
          />
        );
      case 'listing':
      case 'listing-pending':
      case 'listing-expired':
      case 'listing-muted':
        return (
          <CommunityListingView
            key={scenario}
            detail={listingDetail(
              scenario === 'listing'
                ? 'live'
                : (scenario.replace('listing-', '') as ListingScenario),
            )}
            photoUrls={photoUrls}
            actions={residentActions}
            request={requestFiles}
          />
        );
      case 'mine':
        return (
          <CommunityMyItemsView
            items={{
              posts: [
                {
                  id: POST,
                  body: 'Free marigold seedlings at A-101 this Sunday.',
                  groupName: 'Gardening club',
                  status: 'pending',
                  createdAt: NOW,
                  moderationReason: null,
                },
              ],
              listings: [
                {
                  id: LISTING,
                  title: 'Study table with chair',
                  listingType: 'sale',
                  status: 'approved',
                  createdAt: EARLIER,
                  expiresAt: EXPIRES,
                  expired: false,
                  closed: false,
                  moderationReason: null,
                },
                {
                  id: id('23'),
                  title: 'Old phone charger',
                  listingType: 'give_away',
                  status: 'rejected',
                  createdAt: EARLIER,
                  expiresAt: null,
                  expired: false,
                  closed: false,
                  moderationReason: 'Please add a photo and a clearer title.',
                },
              ],
            }}
          />
        );
      case 'admin-queue':
      case 'admin-queue-empty':
        return (
          <CommunityAdminQueueView
            key={scenario}
            queue="pending"
            page={1}
            basePath="/fixtures/community"
            result={
              scenario === 'admin-queue-empty'
                ? { items: [], total: 0 }
                : {
                    items: [
                      {
                        targetType: 'listing',
                        targetId: LISTING,
                        title: 'Study table with chair',
                        excerpt: null,
                        authorName: 'Synthetic Resident C',
                        authorUnitLabel: 'C-303',
                        authorMembershipId: MEMBER_A,
                        status: 'pending',
                        openReports: 0,
                        createdAt: EARLIER,
                      },
                      {
                        targetType: 'post',
                        targetId: POST,
                        title: null,
                        excerpt:
                          'Free marigold seedlings at A-101 this Sunday.',
                        authorName: 'Synthetic Resident A',
                        authorUnitLabel: 'A-101',
                        authorMembershipId: MEMBER_B,
                        status: 'pending',
                        openReports: 0,
                        createdAt: NOW,
                      },
                    ],
                    total: 2,
                  }
            }
          />
        );
      case 'admin-item-pending':
      case 'admin-item-hidden':
        return (
          <CommunityAdminItemView
            key={scenario}
            detail={adminItem(scenario === 'admin-item-hidden')}
            photoUrls={photoUrls}
            targetType={scenario === 'admin-item-hidden' ? 'post' : 'listing'}
            actions={adminActions}
          />
        );
      case 'admin-groups':
        return (
          <CommunityAdminGroupsView
            groups={{
              items: [
                {
                  id: GROUP,
                  name: 'Gardening club',
                  description: 'Seeds, saplings and terrace garden tips.',
                  status: 'active',
                  memberCount: 42,
                  postCount: 118,
                  version: 3,
                },
                {
                  id: id('3'),
                  name: 'Diwali planning 2098',
                  description: null,
                  status: 'archived',
                  memberCount: 12,
                  postCount: 30,
                  version: 5,
                },
              ],
            }}
            actions={adminActions}
          />
        );
      case 'admin-mutes':
        return (
          <CommunityAdminMutesView
            mutes={{
              items: [
                {
                  membershipId: MEMBER_A,
                  name: 'Synthetic Resident C',
                  unitLabel: 'C-303',
                  duration: '7d',
                  mutedUntil: EXPIRES,
                  reason: 'Repeated advertising in groups.',
                  createdAt: NOW,
                },
              ],
            }}
            members={[
              {
                membershipId: MEMBER_B,
                name: 'Synthetic Resident B',
                unitLabel: 'B-201',
              },
            ]}
            search="Resident B"
            settings={{
              settings: {
                muted_can_edit_pending: false,
                muted_can_report: false,
                muted_can_renew: true,
              },
              updatedAt: NOW,
            }}
            actions={adminActions}
            basePath="/fixtures/community"
          />
        );
      default:
        return (
          <CommunityHomeView home={home(false)} actions={residentActions} />
        );
    }
  })();

  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic Community & Marketplace fixture" tone="info">
          Sample groups, posts, listings and residents only. No hosted Auth,
          database writes, uploads or notifications.
        </Banner>
        <div className="grid gap-space-4 medium:grid-cols-2">
          <SelectInput
            id="community-fixture-role"
            label="Fixture role"
            value={role}
            options={roleSchema.options.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(event) =>
              setRole(roleSchema.parse(event.currentTarget.value))
            }
          />
          <SelectInput
            id="community-fixture-scenario"
            label="Fixture screen"
            value={scenario}
            options={scenarioSchema.options.map((value) => ({
              value,
              label: value.replaceAll('-', ' '),
            }))}
            onChange={(event) =>
              setScenario(scenarioSchema.parse(event.currentTarget.value))
            }
          />
        </div>
      </header>
      <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
        {content}
      </main>
    </>
  );
}
