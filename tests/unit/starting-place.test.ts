import { describe, expect, it } from 'vitest';
import { resolveStartingPlace } from '../../src/core/tenancy/starting-place';

describe('workspace starting place', () => {
  it('opens work first for a first-time work member', () => {
    expect(resolveStartingPlace(['resident', 'admin'], 'last_used', null)).toBe(
      '/admin',
    );
  });

  it('reuses a valid place from the current device', () => {
    expect(
      resolveStartingPlace(['resident', 'committee'], 'last_used', '/home'),
    ).toBe('/home');
  });

  it('uses a saved fixed place only when the active society permits it', () => {
    expect(resolveStartingPlace(['resident'], 'work', '/admin')).toBe('/home');
    expect(resolveStartingPlace(['guard'], 'gate', null)).toBe('/guard');
  });
});
