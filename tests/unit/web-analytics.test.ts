// Verify the Beta public-route allowlist and analytics URL redaction.
import { describe, expect, it } from 'vitest';
import {
  isPublicAnalyticsPath,
  sanitizeWebAnalyticsEvent,
} from '../../src/core/analytics/web';

describe('Vercel Web Analytics', () => {
  it('allows only the approved public routes', () => {
    expect(isPublicAnalyticsPath('/')).toBe(true);
    expect(isPublicAnalyticsPath('/privacy')).toBe(true);
    expect(isPublicAnalyticsPath('/login')).toBe(false);
    expect(isPublicAnalyticsPath('/admin')).toBe(false);
    expect(isPublicAnalyticsPath('/major-works')).toBe(false);
    expect(isPublicAnalyticsPath('/privacy/details')).toBe(false);
  });

  it('drops authenticated routes and strips query parameters and hashes', () => {
    expect(
      sanitizeWebAnalyticsEvent({
        type: 'pageview' as const,
        url: 'https://beta-homeish.vercel.app/privacy?token=secret#member',
      }),
    ).toEqual({
      type: 'pageview',
      url: 'https://beta-homeish.vercel.app/privacy',
    });
    expect(
      sanitizeWebAnalyticsEvent({
        type: 'pageview' as const,
        url: 'https://beta-homeish.vercel.app/admin/unit?unit=123',
      }),
    ).toBeNull();
    expect(
      sanitizeWebAnalyticsEvent({
        type: 'event' as const,
        url: '/login?next=/admin',
      }),
    ).toBeNull();
    expect(
      sanitizeWebAnalyticsEvent({
        type: 'pageview' as const,
        url: 'not a valid url',
      }),
    ).toBeNull();
  });
});
