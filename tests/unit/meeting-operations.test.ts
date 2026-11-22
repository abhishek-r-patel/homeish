// Verify meeting operations map RPC errors, deliver pushes and keep minutes publication independent of the Documents copy.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  callModuleRpc: vi.fn(),
  enforceRateLimit: vi.fn(),
  sendPushes: vi.fn(),
  copyMinutes: vi.fn(),
  createPollDraft: vi.fn(),
  savePollDraft: vi.fn(),
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
vi.mock('../../src/core/document/operations', () => ({
  getDocumentWorkspace: vi.fn(),
}));
vi.mock('../../src/core/poll/operations', () => ({
  createPollDraft: mocks.createPollDraft,
  savePollDraft: mocks.savePollDraft,
}));
vi.mock('../../src/core/meeting/document-copy', () => ({
  copyMinutesToDocuments: mocks.copyMinutes,
  defaultMinutesFolderId: vi.fn(),
  eligibleMinutesFolders: vi.fn(),
}));

import { AppError } from '../../src/core/errors';
import {
  cancelMeeting,
  archiveMeetingAgendaTemplate,
  createMeetingResolutionPoll,
  mapMeetingError,
  publishMeetingMinutes,
  saveMeetingAgendaTemplate,
  saveMeetingAction,
  scheduleMeeting,
} from '../../src/core/meeting/operations';

const id = (number: string) =>
  `e0000000-0000-4000-8000-${number.padStart(12, '0')}`;
const SOCIETY = id('1');
const MEETING = id('2');
const RESOLUTION = id('3');
const REQUEST = id('4');
const POLL = id('5');

const rpcFailure = (message: string, details = '', code = 'P0001') =>
  Object.assign(new Error('rpc failed'), {
    cause: { code, message, details },
  });

function context(modules: string[] = ['meeting', 'poll', 'document']) {
  return {
    societyId: SOCIETY,
    userId: id('6'),
    requestId: REQUEST,
    roles: ['admin'],
    enabledModules: new Set(modules),
    db: {},
  };
}

describe('mapMeetingError', () => {
  it('turns readiness details into field errors', () => {
    expect(() =>
      mapMeetingError(
        rpcFailure('meeting_not_ready', 'agenda_missing, place_missing'),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        fieldErrors: {
          agenda_missing: 'Add at least one agenda item.',
          place_missing: 'Add a venue or an online meeting link.',
        },
      }),
    );
  });

  it.each([
    ['meeting_invalid_state', 'CONFLICT'],
    ['meeting_checkin_closed', 'CONFLICT'],
    ['meeting_checkin_window', 'CONFLICT'],
    ['meeting_poll_unavailable', 'CONFLICT'],
    ['meeting_not_invited', 'FORBIDDEN'],
    ['meeting_owner_ineligible', 'VALIDATION_FAILED'],
  ])('maps %s to %s', (message, code) => {
    expect(() => mapMeetingError(rpcFailure(message))).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it('maps a lock timeout to a busy conflict and passes unknown errors through', () => {
    expect(() => mapMeetingError(rpcFailure('', '', '55P03'))).toThrow(
      expect.objectContaining({ code: 'CONFLICT', reason: 'invalid_state' }),
    );
    const unknown = rpcFailure('something_else');
    expect(() => mapMeetingError(unknown)).toThrow(unknown);
    const appError = new AppError('NOT_FOUND');
    expect(() => mapMeetingError(appError)).toThrow(appError);
  });
});

describe('meeting operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildRequestContext.mockResolvedValue(context());
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.sendPushes.mockResolvedValue(undefined);
  });

  it('delivers pushes after schedule, cancel and action save', async () => {
    mocks.callModuleRpc.mockResolvedValue({ meetingId: MEETING, version: 2 });
    await scheduleMeeting({ meetingId: MEETING, expectedVersion: 1 }, REQUEST);
    await cancelMeeting(
      { meetingId: MEETING, expectedVersion: 2, reason: 'Hall unavailable' },
      REQUEST,
    );
    await saveMeetingAction(
      {
        meetingId: MEETING,
        actionId: null,
        expectedVersion: null,
        action: {
          title: 'Collect quotes',
          ownerMembershipId: id('7'),
          dueOn: '2026-12-01',
          resolutionId: null,
        },
      },
      REQUEST,
    );
    expect(mocks.callModuleRpc.mock.calls.map((call) => call[1])).toEqual([
      'meeting_schedule',
      'meeting_cancel',
      'meeting_action_save',
    ]);
    expect(mocks.sendPushes).toHaveBeenCalledTimes(3);
    expect(mocks.sendPushes).toHaveBeenCalledWith(REQUEST);
  });

  it('does not push when the RPC fails', async () => {
    mocks.callModuleRpc.mockRejectedValue(rpcFailure('meeting_invalid_state'));
    await expect(
      scheduleMeeting({ meetingId: MEETING, expectedVersion: 1 }, REQUEST),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mocks.sendPushes).not.toHaveBeenCalled();
  });

  it('validates and saves agenda templates through admin-only RPCs', async () => {
    mocks.callModuleRpc
      .mockResolvedValueOnce({ templateId: id('8'), version: 1 })
      .mockResolvedValueOnce({
        templateId: id('8'),
        version: 2,
        archived: true,
      });
    await expect(
      saveMeetingAgendaTemplate(
        {
          templateId: null,
          expectedVersion: null,
          clientRequestId: id('9'),
          template: {
            name: 'AGM standard',
            meetingTypes: ['agm', 'committee'],
            items: [
              {
                title: 'Accounts',
                description: null,
                suggestedDurationMinutes: 20,
              },
            ],
          },
        },
        REQUEST,
      ),
    ).resolves.toEqual({ templateId: id('8'), version: 1 });
    await expect(
      archiveMeetingAgendaTemplate(
        { templateId: id('8'), expectedVersion: 1, archived: true },
        REQUEST,
      ),
    ).resolves.toEqual({
      templateId: id('8'),
      version: 2,
      archived: true,
    });
    expect(mocks.callModuleRpc.mock.calls.map((call) => call[1])).toEqual([
      'meeting_agenda_template_save',
      'meeting_agenda_template_archive',
    ]);
  });

  it('returns a failed Documents copy without failing publication', async () => {
    const published = { meetingId: MEETING, version: 3 };
    mocks.callModuleRpc.mockResolvedValue(published);
    mocks.copyMinutes.mockResolvedValue({ copied: false, reason: 'failed' });
    await expect(
      publishMeetingMinutes(
        { meetingId: MEETING, expectedVersion: 2, folderId: null },
        REQUEST,
      ),
    ).resolves.toEqual({
      ...published,
      copy: { copied: false, reason: 'failed' },
    });
    expect(mocks.sendPushes).toHaveBeenCalledTimes(1);
  });

  it('skips the copy when Documents is off and pushes again after a successful copy', async () => {
    mocks.callModuleRpc.mockResolvedValue({ meetingId: MEETING, version: 3 });
    mocks.buildRequestContext.mockResolvedValueOnce(context(['meeting']));
    const off = await publishMeetingMinutes(
      { meetingId: MEETING, expectedVersion: 2, folderId: null },
      REQUEST,
    );
    expect(off.copy).toEqual({ copied: false, reason: 'document_disabled' });
    expect(mocks.copyMinutes).not.toHaveBeenCalled();

    mocks.sendPushes.mockClear();
    mocks.copyMinutes.mockResolvedValue({ copied: true, documentId: id('8') });
    await publishMeetingMinutes(
      { meetingId: MEETING, expectedVersion: 2, folderId: null },
      REQUEST,
    );
    expect(mocks.sendPushes).toHaveBeenCalledTimes(2);
  });

  it('creates a poll draft from the stored resolution and links it', async () => {
    const longTitle = 'R'.repeat(400);
    mocks.callModuleRpc
      .mockResolvedValueOnce({
        resolutions: [
          {
            id: RESOLUTION,
            title: longTitle,
            body: 'Resolved to repaint the gate.',
            version: 4,
            poll: null,
          },
        ],
      })
      .mockResolvedValueOnce({ resolutionId: RESOLUTION, version: 5 });
    mocks.createPollDraft.mockResolvedValue({ voteId: POLL, revision: 1 });
    mocks.savePollDraft.mockResolvedValue({ voteId: POLL, revision: 2 });

    await expect(
      createMeetingResolutionPoll(
        {
          meetingId: MEETING,
          resolutionId: RESOLUTION,
          expectedVersion: 4,
          clientRequestId: id('9'),
        },
        REQUEST,
      ),
    ).resolves.toEqual({
      resolutionId: RESOLUTION,
      version: 5,
      pollVoteId: POLL,
    });
    const draft = mocks.savePollDraft.mock.calls[0][0].draft;
    expect(draft.title.length).toBeLessThan(longTitle.length);
    expect(draft.instructions).toBe('Resolved to repaint the gate.');
    expect(draft.options).toEqual([
      { label: 'For' },
      { label: 'Against' },
      { label: 'Abstain' },
    ]);
    expect(mocks.callModuleRpc.mock.calls[1][1]).toBe(
      'meeting_resolution_poll_link',
    );
    expect(mocks.callModuleRpc.mock.calls[1][2]).toMatchObject({
      p_resolution_id: RESOLUTION,
      p_expected_version: 4,
      p_poll_vote_id: POLL,
    });
  });

  it('refuses a poll draft when the resolution changed or Polls is off', async () => {
    mocks.callModuleRpc.mockResolvedValue({
      resolutions: [
        { id: RESOLUTION, title: 'Gate', body: null, version: 5, poll: null },
      ],
    });
    const input = {
      meetingId: MEETING,
      resolutionId: RESOLUTION,
      expectedVersion: 4,
      clientRequestId: id('9'),
    };
    await expect(
      createMeetingResolutionPoll(input, REQUEST),
    ).rejects.toMatchObject({ code: 'CONFLICT', reason: 'stale_version' });

    mocks.buildRequestContext.mockResolvedValueOnce(context(['meeting']));
    await expect(
      createMeetingResolutionPoll(input, REQUEST),
    ).rejects.toMatchObject({ code: 'CONFLICT', reason: 'invalid_state' });
    expect(mocks.createPollDraft).not.toHaveBeenCalled();
  });
});
