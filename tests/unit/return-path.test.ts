// Verify auth return destinations stay within supported Homeish routes.
import { describe, expect, it } from 'vitest';
import { safeReturnPath } from '../../src/core/auth/return-path';

describe('safeReturnPath', () => {
  it.each([
    ['/session', '/session'],
    ['/resident/visitors', '/resident/visitors'],
    ['/guard', '/guard'],
    ['/admin/societies', '/admin/societies'],
    ['/housekeeping', '/housekeeping'],
    ['/amenities?date=2099-01-05', '/amenities'],
    ['/developer/errors?reference=123#top', '/developer/errors'],
  ])('allows local application path %s', (candidate, expected) => {
    expect(safeReturnPath(candidate)).toBe(expected);
  });

  it.each([
    'https://attacker.test',
    '//attacker.test',
    '/\\attacker.test',
    '/login',
    '/session-evil',
    '/amenities-evil',
    'session',
    null,
    7,
  ])('rejects unsupported return destination %s', (candidate) => {
    expect(safeReturnPath(candidate)).toBeNull();
  });
});
