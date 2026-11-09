// Controllable clock for deterministic tests: time only moves when a test moves it.
import type { Clock } from '../../src/lib/clock';

export interface TestClock extends Clock {
  set(instant: Date | string): void;
  advance(milliseconds: number): void;
}

function toValidTime(instant: Date | string): number {
  const time = new Date(instant).getTime();
  if (Number.isNaN(time)) {
    throw new Error('Test clock needs a valid instant.');
  }
  return time;
}

export function createTestClock(start: Date | string): TestClock {
  let currentTime = toValidTime(start);

  return {
    now: () => new Date(currentTime),
    set: (instant) => {
      currentTime = toValidTime(instant);
    },
    advance: (milliseconds) => {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        throw new Error('Test clock can only move forward.');
      }
      currentTime += milliseconds;
    },
  };
}
