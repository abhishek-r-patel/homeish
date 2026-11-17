// Verify event operations map RPC errors, send RPC arguments by contract, push only after notifying writes,
// and summarise per-flat replies and edit results.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  callModuleRpc: vi.fn(),
  enforceRateLimit: vi.fn(),
  sendPushes: vi.fn(),
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

import { AppError } from '../../src/core/errors';
import {
  cancelEvent,
  createEvent,
  getEventAdminList,
  mapEventError,
  publishEvent,
  setEventRsvp,
  updateEvent,
} from '../../src/core/event/operations';
import {
  eventUpdateMessage,
  memberRsvpStatus,
  memberRsvpSummary,
} from '../../src/core/event/summary';

const id = (number: string) =>
  `f0000000-0000-4000-8000-${number.padStart(12, '0')}`;
const SOCIETY = id('1');
const EVENT = id('2');
const UNIT = id('3');
const REQUEST = id('4');

const rpcFailure = (message: string, details = '', code = 'P0001') =>
  Object.assign(new Error('rpc failed'), {
    cause: { code, message, details },
  });

function context(modules: string[] = ['event', 'billing']) {
  return {
    societyId: SOCIETY,
    userId: id('6'),
    requestId: REQUEST,
    roles: ['admin'],
    enabledModules: new Set(modules),
    db: {},
  };
}

const eventInput = {
  title: 'New Year dinner',
  description: null,
  venue: 'Clubhouse lawn',
  startsAt: '2099-12-20T12:30:00.000Z',
  endsAt: '2099-12-20T16:30:00.000Z',
  rsvpDeadline: null,
  capacity: 120,
  maxPerUnit: 6,
  contributionType: 'per_head',
  contributionPaise: 25_000,
  audience: { scope: 'all' },
};

describe('mapEventError', () => {
  it('turns readiness details into field errors', () => {
    expect(() =>
      mapEventError(
        rpcFailure('event_not_ready', 'venue_missing, time_invalid'),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        fieldErrors: {
          venue_missing: 'Add a venue.',
          time_invalid:
            'Choose a future start time and an end time within 14 days after it.',
        },
      }),
    );
  });

  it.each([
    ['event_invalid_state', 'CONFLICT'],
    ['event_rsvp_closed', 'CONFLICT'],
    ['event_full', 'CONFLICT'],
    ['event_billing_required', 'CONFLICT'],
    ['event_headcount_limit', 'VALIDATION_FAILED'],
    ['event_capacity_below_going', 'VALIDATION_FAILED'],
    ['event_not_in_audience', 'FORBIDDEN'],
  ])('maps %s to %s', (message, code) => {
    expect(() => mapEventError(rpcFailure(message))).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it('maps a lock timeout to a busy conflict and passes unknown errors through', () => {
    expect(() => mapEventError(rpcFailure('', '', '55P03'))).toThrow(
      expect.objectContaining({ code: 'CONFLICT', reason: 'invalid_state' }),
    );
    const unknown = rpcFailure('something_else');
    expect(() => mapEventError(unknown)).toThrow(unknown);
    const appError = new AppError('NOT_FOUND');
    expect(() => mapEventError(appError)).toThrow(appError);
  });
});

describe('event operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildRequestContext.mockResolvedValue(context());
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.sendPushes.mockResolvedValue(undefined);
  });

  it('pushes after publish and cancel with contract argument names', async () => {
    mocks.callModuleRpc.mockResolvedValue({
      eventId: EVENT,
      version: 2,
      notified: 5,
      refundedUnits: 1,
    });
    await publishEvent({ eventId: EVENT, expectedVersion: 1 }, REQUEST);
    await cancelEvent(
      { eventId: EVENT, expectedVersion: 2, reason: ' Rain forecast ' },
      REQUEST,
    );
    expect(mocks.callModuleRpc.mock.calls.map((call) => call[1])).toEqual([
      'event_publish',
      'event_cancel',
    ]);
    expect(mocks.callModuleRpc.mock.calls[1][2]).toEqual({
      p_society_id: SOCIETY,
      p_event_id: EVENT,
      p_expected_version: 2,
      p_reason: 'Rain forecast',
      p_request_id: REQUEST,
    });
    expect(mocks.sendPushes).toHaveBeenCalledTimes(2);
    expect(mocks.sendPushes).toHaveBeenCalledWith(REQUEST);
  });

  it('pushes after an update only when the audience was notified or flats were withdrawn', async () => {
    const input = { eventId: EVENT, expectedVersion: 3, event: eventInput };
    mocks.callModuleRpc.mockResolvedValueOnce({
      eventId: EVENT,
      version: 4,
      notified: false,
      withdrawnUnits: 0,
      refundedUnits: 0,
    });
    await updateEvent(input, REQUEST);
    expect(mocks.sendPushes).not.toHaveBeenCalled();

    mocks.callModuleRpc.mockResolvedValueOnce({
      eventId: EVENT,
      version: 5,
      notified: true,
      withdrawnUnits: 0,
      refundedUnits: 0,
    });
    await updateEvent({ ...input, expectedVersion: 4 }, REQUEST);
    expect(mocks.sendPushes).toHaveBeenCalledTimes(1);
    expect(mocks.callModuleRpc.mock.calls[1][2]).toMatchObject({
      p_event_id: EVENT,
      p_expected_version: 4,
      p_event: eventInput,
    });

    mocks.callModuleRpc.mockResolvedValueOnce({
      eventId: EVENT,
      version: 6,
      notified: false,
      withdrawnUnits: 1,
      refundedUnits: 1,
    });
    await updateEvent({ ...input, expectedVersion: 5 }, REQUEST);
    expect(mocks.sendPushes).toHaveBeenCalledTimes(2);
  });

  it('creates a draft idempotently without pushing', async () => {
    mocks.callModuleRpc.mockResolvedValue({ eventId: EVENT, version: 1 });
    const clientRequestId = id('7');
    await createEvent({ clientRequestId, event: eventInput }, REQUEST);
    expect(mocks.callModuleRpc.mock.calls[0][2]).toEqual({
      p_society_id: SOCIETY,
      p_client_request_id: clientRequestId,
      p_event: eventInput,
      p_request_id: REQUEST,
    });
    expect(mocks.sendPushes).not.toHaveBeenCalled();
  });

  it('sends the RSVP version and does not push', async () => {
    mocks.callModuleRpc.mockResolvedValue({
      rsvpId: id('8'),
      status: 'going',
      headcount: 3,
      version: 2,
      chargedPaise: 75_000,
    });
    await setEventRsvp(
      {
        eventId: EVENT,
        unitId: UNIT,
        status: 'going',
        headcount: 3,
        expectedVersion: 1,
      },
      REQUEST,
    );
    expect(mocks.callModuleRpc.mock.calls[0][1]).toBe('event_rsvp_set');
    expect(mocks.callModuleRpc.mock.calls[0][2]).toEqual({
      p_society_id: SOCIETY,
      p_event_id: EVENT,
      p_unit_id: UNIT,
      p_status: 'going',
      p_headcount: 3,
      p_expected_version: 1,
      p_request_id: REQUEST,
    });
    expect(mocks.sendPushes).not.toHaveBeenCalled();
  });

  it('rejects an invalid RSVP before calling the database', async () => {
    await expect(
      setEventRsvp(
        {
          eventId: EVENT,
          unitId: UNIT,
          status: 'going',
          headcount: 0,
          expectedVersion: null,
        },
        REQUEST,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mocks.callModuleRpc).not.toHaveBeenCalled();
  });

  it('does not push when the RPC fails', async () => {
    mocks.callModuleRpc.mockRejectedValue(rpcFailure('event_billing_required'));
    await expect(
      publishEvent({ eventId: EVENT, expectedVersion: 1 }, REQUEST),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mocks.sendPushes).not.toHaveBeenCalled();
  });

  it('reports whether billing is on with the admin list', async () => {
    mocks.callModuleRpc.mockResolvedValue({ items: [], total: 0 });
    mocks.buildRequestContext.mockResolvedValueOnce(context(['event']));
    await expect(getEventAdminList('bogus')).resolves.toEqual({
      items: [],
      total: 0,
      billingEnabled: false,
    });
    expect(mocks.callModuleRpc.mock.calls[0][2]).toMatchObject({
      p_filter: 'upcoming',
      p_limit: 100,
      p_offset: 0,
    });
  });
});

describe('event summaries', () => {
  const flat = (
    label: string,
    status: 'going' | 'not_going' | null,
    headcount: number | null,
  ) => ({ unitId: id(label.length.toString()), label, status, headcount });

  it('summarises one flat as before and several flats per flat', () => {
    expect(
      memberRsvpSummary({
        status: 'published',
        myRsvps: [flat('A-101', 'going', 1)],
      }),
    ).toBe('Going · 1 person');
    expect(
      memberRsvpSummary({
        status: 'published',
        myRsvps: [flat('A-101', 'going', 2), flat('B-202', null, null)],
      }),
    ).toBe('A-101: Going · 2 people; B-202: No RSVP yet');
    expect(
      memberRsvpSummary({
        status: 'cancelled',
        myRsvps: [flat('A-101', 'going', 2), flat('B-202', null, null)],
      }),
    ).toBe('Cancelled');
  });

  it('shows going if any flat goes and not going only when every flat declined', () => {
    expect(
      memberRsvpStatus([
        flat('A-101', 'not_going', 0),
        flat('B-1', 'going', 1),
      ]),
    ).toBe('going');
    expect(
      memberRsvpStatus([
        flat('A-101', 'not_going', 0),
        flat('B-1', null, null),
      ]),
    ).toBeNull();
    expect(
      memberRsvpStatus([
        flat('A-101', 'not_going', 0),
        flat('B-1', 'not_going', 0),
      ]),
    ).toBe('not_going');
  });

  it('mentions withdrawn and refunded flats after an edit', () => {
    const base = { notified: false, withdrawnUnits: 0, refundedUnits: 0 };
    expect(eventUpdateMessage(base)).toBe('Changes saved.');
    expect(
      eventUpdateMessage({ ...base, withdrawnUnits: 2, refundedUnits: 1 }),
    ).toBe('Changes saved. 2 flats were withdrawn and 1 refunded.');
    expect(
      eventUpdateMessage({ ...base, notified: true, withdrawnUnits: 1 }),
    ).toBe('Changes saved and invited homes notified. 1 flat was withdrawn.');
  });
});
