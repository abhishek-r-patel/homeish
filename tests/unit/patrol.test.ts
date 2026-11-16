// Verify patrol code normalisation, schedule validation and round, missed-checkpoint derivation.
import { describe, expect, it } from 'vitest';
import {
  computePatrolRounds,
  currentPatrolRounds,
  missedPatrolCheckpoints,
  nextPatrolRounds,
  zonedTimeToUtc,
  type PatrolRoundSchedule,
} from '../../src/core/patrol/rounds';
import {
  normalizePatrolCode,
  patrolQrPayload,
  patrolScanInputSchema,
  patrolScheduleInputSchema,
} from '../../src/core/patrol/validation';

const GATE = '00000000-0000-4000-8000-000000000001';
const TERRACE = '00000000-0000-4000-8000-000000000002';
const SCHEDULE = '00000000-0000-4000-8000-000000000010';
const TZ = 'Asia/Kolkata';

function night(
  overrides: Partial<PatrolRoundSchedule> = {},
): PatrolRoundSchedule {
  return {
    id: SCHEDULE,
    name: 'Night shift',
    shift_start: '22:00',
    shift_end: '06:00',
    interval_minutes: 120,
    grace_minutes: 15,
    active: true,
    effective_from: '2026-11-01T00:00:00Z',
    checkpoints: [
      { checkpoint_id: GATE, included_at: '2026-11-01T00:00:00Z' },
      { checkpoint_id: TERRACE, included_at: '2026-11-01T00:00:00Z' },
    ],
    ...overrides,
  };
}

let scanCount = 0;
function scan(checkpoint: string, at: string) {
  scanCount += 1;
  return {
    id: `00000000-0000-4000-8000-${String(scanCount).padStart(12, '0')}`,
    checkpoint_id: checkpoint,
    scanned_at: at,
  };
}

function rounds(input: {
  schedule?: PatrolRoundSchedule;
  scans?: ReturnType<typeof scan>[];
  active?: string[];
  now: string;
  from: string;
  until: string;
}) {
  return computePatrolRounds({
    timeZone: TZ,
    schedules: [input.schedule ?? night()],
    scans: input.scans ?? [],
    activeCheckpointIds: new Set(input.active ?? [GATE, TERRACE]),
    now: new Date(input.now),
    from: new Date(input.from),
    until: new Date(input.until),
  });
}

describe('patrol codes', () => {
  it('accepts typed codes with spaces, hyphens or lowercase and the QR payload', () => {
    expect(normalizePatrolCode('k7m 2qx')).toBe('K7M2QX');
    expect(normalizePatrolCode('K7M-2QX')).toBe('K7M2QX');
    expect(normalizePatrolCode(patrolQrPayload('K7M2QX'))).toBe('K7M2QX');
    expect(patrolQrPayload('K7M2QX')).toBe('homeish-patrol:K7M2QX');
  });

  it('rejects ambiguous characters, wrong lengths and other QR payloads', () => {
    expect(normalizePatrolCode('K7M2Q0')).toBeNull();
    expect(normalizePatrolCode('K7M2QI')).toBeNull();
    expect(normalizePatrolCode('K7M2Q')).toBeNull();
    expect(normalizePatrolCode('https://example.com/K7M2QX')).toBeNull();
    expect(
      patrolScanInputSchema.safeParse({
        code: 'OOOOOO',
        method: 'typed',
        clientRequestId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
});

describe('patrol schedule input', () => {
  const base = {
    scheduleId: null,
    name: 'Night shift',
    shiftStart: '22:00',
    shiftEnd: '06:00',
    intervalMinutes: 120,
    graceMinutes: 15,
    checkpointIds: [GATE],
    expectedVersion: null,
    clientRequestId: crypto.randomUUID(),
  };

  it('accepts a shift that crosses midnight', () => {
    expect(patrolScheduleInputSchema.safeParse(base).success).toBe(true);
  });

  it.each([
    ['equal start and end', { shiftEnd: '22:00' }],
    ['an interval longer than the shift', { shiftEnd: '23:00' }],
    [
      'grace longer than the interval',
      { intervalMinutes: 30, graceMinutes: 45 },
    ],
    ['an interval under 15 minutes', { intervalMinutes: 10, graceMinutes: 0 }],
    ['duplicate checkpoints', { checkpointIds: [GATE, GATE] }],
    ['no checkpoints', { checkpointIds: [] }],
  ])('rejects %s', (_label, change) => {
    expect(
      patrolScheduleInputSchema.safeParse({ ...base, ...change }).success,
    ).toBe(false);
  });
});

describe('patrol rounds', () => {
  it('converts local wall-clock times to UTC across midnight', () => {
    const day = { year: 2026, month: 11, day: 16 };
    expect(zonedTimeToUtc(day, 22 * 60, TZ).toISOString()).toBe(
      '2026-11-16T16:30:00.000Z',
    );
    expect(zonedTimeToUtc(day, 30 * 60, TZ).toISOString()).toBe(
      '2026-11-17T00:30:00.000Z',
    );
  });

  it('builds windows across midnight and marks done, missed, open and upcoming', () => {
    const result = rounds({
      // 23:50 local on 16 Nov: the 22:00 round is still open and the 00:00 round has not started.
      now: '2026-11-16T18:20:00Z',
      from: '2026-11-16T12:00:00Z',
      until: '2026-11-17T01:00:00Z',
      scans: [scan(GATE, '2026-11-16T16:45:00Z')],
    });
    expect(result.map((round) => round.start.toISOString())).toEqual([
      '2026-11-16T16:30:00.000Z',
      '2026-11-16T18:30:00.000Z',
      '2026-11-16T20:30:00.000Z',
      '2026-11-16T22:30:00.000Z',
    ]);
    expect(result[0]!.deadline.toISOString()).toBe('2026-11-16T18:45:00.000Z');
    expect(result[0]!.checkpoints.map((item) => item.status)).toEqual([
      'done',
      'open',
    ]);
    expect(result[1]!.checkpoints.map((item) => item.status)).toEqual([
      'upcoming',
      'upcoming',
    ]);
    expect(
      currentPatrolRounds(result, new Date('2026-11-16T18:20:00Z')),
    ).toHaveLength(1);
    expect(
      nextPatrolRounds(
        result,
        new Date('2026-11-16T18:20:00Z'),
      )[0]!.start.toISOString(),
    ).toBe('2026-11-16T18:30:00.000Z');
  });

  it('counts a scan inside the grace period and flags unscanned checkpoints after it', () => {
    const result = rounds({
      now: '2026-11-16T19:00:00Z',
      from: '2026-11-16T12:00:00Z',
      until: '2026-11-16T19:00:00Z',
      scans: [scan(GATE, '2026-11-16T18:40:00Z')],
    });
    const first = result[0]!;
    expect(first.checkpoints[0]).toMatchObject({ status: 'done' });
    expect(first.checkpoints[1]).toMatchObject({ status: 'missed' });
    const missed = missedPatrolCheckpoints(result);
    expect(missed).toEqual([
      expect.objectContaining({
        checkpointId: TERRACE,
        windowStart: new Date('2026-11-16T16:30:00Z'),
      }),
    ]);
  });

  it('never lets one scan in an overlapping grace period cover two rounds', () => {
    const lateGrace = scan(GATE, '2026-11-16T18:40:00Z');
    const result = rounds({
      schedule: night({
        checkpoints: [
          { checkpoint_id: GATE, included_at: '2026-11-01T00:00:00Z' },
        ],
      }),
      now: '2026-11-16T21:00:00Z',
      from: '2026-11-16T12:00:00Z',
      until: '2026-11-16T21:00:00Z',
      scans: [lateGrace],
    });
    expect(result[0]!.checkpoints[0]).toMatchObject({
      status: 'done',
      scanId: lateGrace.id,
    });
    expect(result[1]!.checkpoints[0]!.status).toBe('missed');
  });

  it('treats duplicate scans in the same round as harmless', () => {
    const first = scan(GATE, '2026-11-16T16:35:00Z');
    const result = rounds({
      schedule: night({
        checkpoints: [
          { checkpoint_id: GATE, included_at: '2026-11-01T00:00:00Z' },
        ],
      }),
      now: '2026-11-16T19:00:00Z',
      from: '2026-11-16T12:00:00Z',
      until: '2026-11-16T19:00:00Z',
      scans: [first, scan(GATE, '2026-11-16T16:36:00Z')],
    });
    expect(result[0]!.checkpoints[0]).toMatchObject({
      status: 'done',
      scanId: first.id,
    });
    expect(missedPatrolCheckpoints(result)).toEqual([]);
  });

  it('skips rounds before the schedule took effect and checkpoints added later', () => {
    const result = rounds({
      schedule: night({
        effective_from: '2026-11-16T18:00:00Z',
        checkpoints: [
          { checkpoint_id: GATE, included_at: '2026-11-01T00:00:00Z' },
          { checkpoint_id: TERRACE, included_at: '2026-11-16T19:00:00Z' },
        ],
      }),
      now: '2026-11-17T01:00:00Z',
      from: '2026-11-16T12:00:00Z',
      until: '2026-11-17T01:00:00Z',
    });
    expect(result[0]!.start.toISOString()).toBe('2026-11-16T18:30:00.000Z');
    expect(result[0]!.checkpoints.map((item) => item.checkpointId)).toEqual([
      GATE,
    ]);
    expect(result[1]!.checkpoints.map((item) => item.checkpointId)).toEqual([
      GATE,
      TERRACE,
    ]);
  });

  it('ignores inactive schedules and inactive checkpoints', () => {
    const window = {
      now: '2026-11-17T01:00:00Z',
      from: '2026-11-16T12:00:00Z',
      until: '2026-11-17T01:00:00Z',
    };
    expect(rounds({ ...window, schedule: night({ active: false }) })).toEqual(
      [],
    );
    const result = rounds({ ...window, active: [GATE] });
    expect(
      result.every((round) =>
        round.checkpoints.every((item) => item.checkpointId === GATE),
      ),
    ).toBe(true);
  });
});
