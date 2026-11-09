// Unit tests for the system clock and the controllable test clock.
import { describe, expect, it } from 'vitest';
import { systemClock } from '../../src/lib/clock';
import { createTestClock } from '../fixtures/test-clock';

describe('systemClock', () => {
  it('returns the current time', () => {
    const before = Date.now();
    const now = systemClock.now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('createTestClock', () => {
  it('stays at the start time until moved', () => {
    const clock = createTestClock('2026-11-09T00:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-11-09T00:00:00.000Z');
  });

  it('advances forward and crosses day boundaries', () => {
    const clock = createTestClock('2026-11-09T23:59:59.000Z');
    clock.advance(1000);
    expect(clock.now().toISOString()).toBe('2026-11-10T00:00:00.000Z');
  });

  it('can be set to any instant', () => {
    const clock = createTestClock('2026-11-09T00:00:00.000Z');
    clock.set('2027-01-01T05:30:00.000Z');
    expect(clock.now().toISOString()).toBe('2027-01-01T05:30:00.000Z');
  });

  it('returns a copy so callers cannot change its time', () => {
    const clock = createTestClock('2026-11-09T00:00:00.000Z');
    clock.now().setUTCFullYear(2000);
    expect(clock.now().toISOString()).toBe('2026-11-09T00:00:00.000Z');
  });

  it('rejects invalid instants and backward or non-finite moves', () => {
    expect(() => createTestClock('not a date')).toThrow();
    const clock = createTestClock('2026-11-09T00:00:00.000Z');
    expect(() => clock.set('not a date')).toThrow();
    expect(() => clock.advance(-1)).toThrow();
    expect(() => clock.advance(Number.NaN)).toThrow();
  });
});
