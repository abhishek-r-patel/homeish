// Derive patrol round windows and missed checkpoints from schedules and scans.
import { clockMinutes, shiftLengthMinutes } from './validation';

const MINUTE = 60_000;
const DAY = 1440 * MINUTE;

export type PatrolRoundStatus = 'done' | 'missed' | 'open' | 'upcoming';

export interface PatrolRoundSchedule {
  id: string;
  name: string;
  shift_start: string;
  shift_end: string;
  interval_minutes: number;
  grace_minutes: number;
  active: boolean;
  effective_from: string;
  checkpoints: ReadonlyArray<{ checkpoint_id: string; included_at: string }>;
}

export interface PatrolRoundScan {
  id: string;
  checkpoint_id: string;
  scanned_at: string;
}

export interface PatrolRoundCheckpoint {
  checkpointId: string;
  status: PatrolRoundStatus;
  scanId: string | null;
  scannedAt: string | null;
}

export interface PatrolRound {
  scheduleId: string;
  scheduleName: string;
  start: Date;
  end: Date;
  deadline: Date;
  checkpoints: PatrolRoundCheckpoint[];
}

export interface PatrolMissedCheckpoint {
  scheduleId: string;
  scheduleName: string;
  checkpointId: string;
  windowStart: Date;
  deadline: Date;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour') % 24,
    minute: value('minute'),
    second: value('second'),
  };
}

function offsetMs(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant of a local wall-clock time; minutes may exceed one day. */
export function zonedTimeToUtc(
  localDay: { year: number; month: number; day: number },
  minutes: number,
  timeZone: string,
) {
  const guess = Date.UTC(
    localDay.year,
    localDay.month - 1,
    localDay.day,
    0,
    minutes,
  );
  let result = guess - offsetMs(new Date(guess), timeZone);
  const corrected = guess - offsetMs(new Date(result), timeZone);
  if (corrected !== result) result = corrected;
  return new Date(result);
}

function localDay(date: Date, timeZone: string) {
  const { year, month, day } = zonedParts(date, timeZone);
  return { year, month, day };
}

function addDays(
  day: { year: number; month: number; day: number },
  days: number,
) {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function scheduleWindows(
  schedule: PatrolRoundSchedule,
  timeZone: string,
  from: Date,
  until: Date,
) {
  const windows: Array<{ start: Date; end: Date; deadline: Date }> = [];
  const effectiveFrom = new Date(schedule.effective_from).getTime();
  const startMinutes = clockMinutes(schedule.shift_start);
  const shiftMinutes = shiftLengthMinutes(
    schedule.shift_start,
    schedule.shift_end,
  );
  const firstDay = addDays(localDay(from, timeZone), -2);
  const lastDay = localDay(until, timeZone);
  for (
    let day = firstDay;
    Date.UTC(day.year, day.month - 1, day.day) <=
    Date.UTC(lastDay.year, lastDay.month - 1, lastDay.day);
    day = addDays(day, 1)
  ) {
    const shiftStart = zonedTimeToUtc(day, startMinutes, timeZone).getTime();
    const shiftEnd = zonedTimeToUtc(
      day,
      startMinutes + shiftMinutes,
      timeZone,
    ).getTime();
    for (
      let start = shiftStart;
      start < shiftEnd;
      start += schedule.interval_minutes * MINUTE
    ) {
      const end = Math.min(
        start + schedule.interval_minutes * MINUTE,
        shiftEnd,
      );
      const deadline = end + schedule.grace_minutes * MINUTE;
      if (start < effectiveFrom) continue;
      // Earlier windows are kept so scan matching stays stable; the caller trims them.
      if (deadline <= from.getTime() - DAY || start > until.getTime()) continue;
      windows.push({
        start: new Date(start),
        end: new Date(end),
        deadline: new Date(deadline),
      });
    }
  }
  return windows.sort(
    (left, right) => left.start.getTime() - right.start.getTime(),
  );
}

/**
 * Builds round windows whose deadline is after `from` and whose start is no later than `until`.
 * Each window needs one scan per included checkpoint between its start and its deadline. Scans
 * are matched greedily in window order, so one late scan never covers two rounds.
 */
export function computePatrolRounds(input: {
  timeZone: string;
  schedules: ReadonlyArray<PatrolRoundSchedule>;
  scans: ReadonlyArray<PatrolRoundScan>;
  activeCheckpointIds: ReadonlySet<string>;
  now: Date;
  from: Date;
  until: Date;
}): PatrolRound[] {
  const scansByCheckpoint = new Map<string, PatrolRoundScan[]>();
  for (const scan of input.scans) {
    const list = scansByCheckpoint.get(scan.checkpoint_id) ?? [];
    list.push(scan);
    scansByCheckpoint.set(scan.checkpoint_id, list);
  }
  for (const list of scansByCheckpoint.values()) {
    list.sort(
      (left, right) =>
        new Date(left.scanned_at).getTime() -
        new Date(right.scanned_at).getTime(),
    );
  }

  const now = input.now.getTime();
  const rounds: PatrolRound[] = [];
  for (const schedule of input.schedules) {
    if (!schedule.active) continue;
    const links = schedule.checkpoints.filter((link) =>
      input.activeCheckpointIds.has(link.checkpoint_id),
    );
    if (links.length === 0) continue;
    const windows = scheduleWindows(
      schedule,
      input.timeZone,
      input.from,
      input.until,
    );
    const consumed = new Set<string>();
    for (const window of windows) {
      const start = window.start.getTime();
      const deadline = window.deadline.getTime();
      const checkpoints: PatrolRoundCheckpoint[] = [];
      for (const link of links) {
        if (new Date(link.included_at).getTime() > start) continue;
        const scan = (scansByCheckpoint.get(link.checkpoint_id) ?? []).find(
          (candidate) => {
            if (consumed.has(candidate.id)) return false;
            const time = new Date(candidate.scanned_at).getTime();
            return time >= start && time < deadline;
          },
        );
        if (scan) consumed.add(scan.id);
        checkpoints.push({
          checkpointId: link.checkpoint_id,
          status: scan
            ? 'done'
            : now >= deadline
              ? 'missed'
              : now >= start
                ? 'open'
                : 'upcoming',
          scanId: scan?.id ?? null,
          scannedAt: scan?.scanned_at ?? null,
        });
      }
      if (checkpoints.length === 0 || deadline <= input.from.getTime())
        continue;
      rounds.push({
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        ...window,
        checkpoints,
      });
    }
  }
  return rounds.sort(
    (left, right) => left.start.getTime() - right.start.getTime(),
  );
}

/** Missed checkpoints, newest deadline first. */
export function missedPatrolCheckpoints(rounds: ReadonlyArray<PatrolRound>) {
  const missed: PatrolMissedCheckpoint[] = [];
  for (const round of rounds) {
    for (const checkpoint of round.checkpoints) {
      if (checkpoint.status !== 'missed') continue;
      missed.push({
        scheduleId: round.scheduleId,
        scheduleName: round.scheduleName,
        checkpointId: checkpoint.checkpointId,
        windowStart: round.start,
        deadline: round.deadline,
      });
    }
  }
  return missed.sort(
    (left, right) => right.deadline.getTime() - left.deadline.getTime(),
  );
}

/** Rounds that can still be completed now (started and before their deadline). */
export function currentPatrolRounds(
  rounds: ReadonlyArray<PatrolRound>,
  now: Date,
) {
  const time = now.getTime();
  return rounds.filter(
    (round) => round.start.getTime() <= time && time < round.deadline.getTime(),
  );
}

/** The next round to start for each active schedule. */
export function nextPatrolRounds(
  rounds: ReadonlyArray<PatrolRound>,
  now: Date,
) {
  const seen = new Set<string>();
  const next: PatrolRound[] = [];
  for (const round of rounds) {
    if (round.start.getTime() <= now.getTime() || seen.has(round.scheduleId))
      continue;
    seen.add(round.scheduleId);
    next.push(round);
  }
  return next;
}
