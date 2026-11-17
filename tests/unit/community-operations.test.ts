// Verify Community operations map RPC errors, send contract argument names and push only after notifying writes.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  callModuleRpc: vi.fn(),
  enforceRateLimit: vi.fn(),
  sendPushes: vi.fn(),
  signCommunityPhotos: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));
vi.mock('../../src/core/db/validated-rpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/core/db/validated-rpc')>()),
  callModuleRpc: mocks.callModuleRpc,
}));
vi.mock('../../src/core/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock('../../src/core/permissions/authorize', () => ({
  authorizeRequest: vi.fn(),
}));
vi.mock('../../src/core/privileged/notification-delivery', () => ({
  sendNotificationPushesForRequest: mocks.sendPushes,
}));
vi.mock('../../src/core/community/photos', () => ({
  issueCommunityPhotoUpload: vi.fn(),
  signCommunityPhotos: mocks.signCommunityPhotos,
}));

import { AppError } from '../../src/core/errors';
import {
  createCommunityListing,
  getCommunityAdminItem,
  getCommunityGroupPage,
  mapCommunityError,
  moderateCommunityItem,
  reportCommunityItem,
  unmuteCommunityMember,
} from '../../src/core/community/operations';

const id = (number: string) =>
  `f0000000-0000-4000-8000-${number.padStart(12, '0')}`;
const SOCIETY = id('1');
const REQUEST = id('2');
const GROUP = id('3');
const TARGET = id('4');
const MEMBER = id('5');

const rpcFailure = (message: string, details = '', code = 'P0001') =>
  Object.assign(new Error('rpc failed'), {
    cause: { code, message, details },
  });

const home = (joined: boolean) => ({
  groups: [
    {
      id: GROUP,
      name: 'Gardening club',
      description: null,
      memberCount: 4,
      joined,
      latestPostAt: null,
    },
  ],
  myMute: null,
  preferences: { newListingAlerts: true },
});

describe('mapCommunityError', () => {
  it.each([
    ['community_invalid_state', 'CONFLICT'],
    ['community_group_archived', 'CONFLICT'],
    ['community_already_reported', 'CONFLICT'],
    ['community_not_member', 'FORBIDDEN'],
    ['community_own_item', 'VALIDATION_FAILED'],
  ])('maps %s to %s', (message, code) => {
    expect(() => mapCommunityError(rpcFailure(message))).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it('shows the mute end from the error detail and flags bad photos on the field', () => {
    expect(() =>
      mapCommunityError(rpcFailure('community_muted', 'Until 8 Jan 2100.')),
    ).toThrow(
      expect.objectContaining({
        code: 'FORBIDDEN',
        message: expect.stringContaining('(Until 8 Jan 2100)'),
      }),
    );
    expect(() =>
      mapCommunityError(rpcFailure('community_photo_invalid')),
    ).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        fieldErrors: expect.objectContaining({
          photoPaths: expect.any(String),
        }),
      }),
    );
  });

  it('maps a lock timeout to a busy conflict and passes unknown errors through', () => {
    expect(() => mapCommunityError(rpcFailure('', '', '55P03'))).toThrow(
      expect.objectContaining({ code: 'CONFLICT', reason: 'invalid_state' }),
    );
    const unknown = rpcFailure('something_else');
    expect(() => mapCommunityError(unknown)).toThrow(unknown);
    const appError = new AppError('NOT_FOUND');
    expect(() => mapCommunityError(appError)).toThrow(appError);
  });
});

describe('community operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callModuleRpc.mockReset();
    mocks.buildRequestContext.mockResolvedValue({
      societyId: SOCIETY,
      userId: id('6'),
      requestId: REQUEST,
      roles: ['resident'],
      enabledModules: new Set(['community']),
      db: {},
    });
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.sendPushes.mockResolvedValue(undefined);
    mocks.signCommunityPhotos.mockResolvedValue({});
  });

  it('creates a listing with contract arguments and pushes the review alert', async () => {
    mocks.callModuleRpc.mockResolvedValue({
      listingId: TARGET,
      status: 'pending',
    });
    const listing = {
      listingType: 'sale',
      title: 'Study table',
      description: null,
      pricePaise: 250_000,
      contactPhone: null,
    };
    await createCommunityListing(
      { clientRequestId: id('7'), listing, photoPaths: [] },
      REQUEST,
    );
    expect(mocks.callModuleRpc.mock.calls[0][1]).toBe(
      'community_listing_create',
    );
    expect(mocks.callModuleRpc.mock.calls[0][2]).toEqual({
      p_society_id: SOCIETY,
      p_client_request_id: id('7'),
      p_listing: listing,
      p_photo_paths: [],
      p_request_id: REQUEST,
    });
    expect(mocks.sendPushes).toHaveBeenCalledWith(REQUEST);
  });

  it('pushes after a report only when it hid the item', async () => {
    const input = {
      targetType: 'post',
      targetId: TARGET,
      reason: 'spam',
      note: null,
    };
    mocks.callModuleRpc.mockResolvedValueOnce({
      reportId: id('8'),
      hidden: false,
    });
    await reportCommunityItem(input, REQUEST);
    expect(mocks.sendPushes).not.toHaveBeenCalled();
    expect(mocks.callModuleRpc.mock.calls[0][2]).toEqual({
      p_society_id: SOCIETY,
      p_target_type: 'post',
      p_target_id: TARGET,
      p_reason: 'spam',
      p_note: null,
      p_request_id: REQUEST,
    });

    mocks.callModuleRpc.mockResolvedValueOnce({
      reportId: id('9'),
      hidden: true,
    });
    await reportCommunityItem(input, REQUEST);
    expect(mocks.sendPushes).toHaveBeenCalledTimes(1);
  });

  it('pushes after lifting a mute only when one was lifted', async () => {
    mocks.callModuleRpc.mockResolvedValueOnce({ lifted: false });
    await unmuteCommunityMember({ membershipId: MEMBER }, REQUEST);
    expect(mocks.sendPushes).not.toHaveBeenCalled();
    expect(mocks.callModuleRpc.mock.calls[0]).toEqual(
      expect.arrayContaining([
        'community_unmute',
        {
          p_society_id: SOCIETY,
          p_membership_id: MEMBER,
          p_request_id: REQUEST,
        },
      ]),
    );
    mocks.callModuleRpc.mockResolvedValueOnce({ lifted: true });
    await unmuteCommunityMember({ membershipId: MEMBER }, REQUEST);
    expect(mocks.sendPushes).toHaveBeenCalledTimes(1);
  });

  it('requires a reason to remove and does not push on failure', async () => {
    await expect(
      moderateCommunityItem(
        { targetType: 'post', targetId: TARGET, action: 'remove', reason: '' },
        REQUEST,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mocks.callModuleRpc).not.toHaveBeenCalled();

    mocks.callModuleRpc.mockRejectedValue(
      rpcFailure('community_invalid_state'),
    );
    await expect(
      moderateCommunityItem(
        {
          targetType: 'post',
          targetId: TARGET,
          action: 'restore',
          reason: null,
        },
        REQUEST,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mocks.sendPushes).not.toHaveBeenCalled();
  });

  it('shows a join view to non-members without reading the feed', async () => {
    mocks.callModuleRpc.mockResolvedValueOnce(home(false));
    await expect(getCommunityGroupPage(GROUP)).resolves.toMatchObject({
      group: { id: GROUP, joined: false },
      feed: null,
    });
    expect(mocks.callModuleRpc).toHaveBeenCalledTimes(1);

    mocks.callModuleRpc
      .mockResolvedValueOnce(home(true))
      .mockResolvedValueOnce({
        group: { id: GROUP, name: 'Gardening club', description: null },
        items: [],
        total: 0,
      });
    await getCommunityGroupPage(GROUP, 3);
    expect(mocks.callModuleRpc.mock.calls[2][1]).toBe('community_group_feed');
    expect(mocks.callModuleRpc.mock.calls[2][2]).toEqual({
      p_society_id: SOCIETY,
      p_group_id: GROUP,
      p_limit: 20,
      p_offset: 40,
    });
  });

  it('treats a missing group or a malformed admin route as not found', async () => {
    mocks.callModuleRpc.mockResolvedValueOnce({ ...home(true), groups: [] });
    await expect(getCommunityGroupPage(GROUP)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(getCommunityAdminItem('event', TARGET)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(getCommunityAdminItem('post', 'nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(mocks.callModuleRpc).toHaveBeenCalledTimes(1);
  });
});
