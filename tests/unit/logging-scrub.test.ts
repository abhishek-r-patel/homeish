// Verify sensitive values are removed from structured logs and free text.
import { describe, expect, it } from 'vitest';
import { scrubLogData, scrubLogText } from '../../src/core/logging';

describe('scrubLogData', () => {
  it('redacts sensitive fields and nested request bodies', () => {
    expect(
      scrubLogData({
        authorization: 'demo',
        otp: '194208',
        phone: '+919876543210',
        upiId: 'resident@upi',
        requestBody: { note: 'Do not log this' },
        safe: { route: '/api/health', count: 2 },
      }),
    ).toEqual({
      authorization: '[REDACTED]',
      otp: '[REDACTED]',
      phone: '[REDACTED]',
      upiId: '[REDACTED]',
      requestBody: '[REDACTED]',
      safe: { route: '/api/health', count: 2 },
    });
  });

  it('scrubs messages, stack traces and contact data in free text', () => {
    const result = scrubLogData(
      new Error(
        'OTP: 194208 for resident@example.test at +919876543210; UPI resident@upi',
      ),
    );
    expect(result).toMatchObject({
      name: 'Error',
      message: 'OTP: [REDACTED] for [REDACTED] at [REDACTED]; UPI [REDACTED]',
    });
    expect(JSON.stringify(result)).not.toContain('194208');
    expect(JSON.stringify(result)).not.toContain('resident@example.test');
    expect(JSON.stringify(result)).not.toContain('9876543210');
  });

  it('handles cycles, excessive nesting and non-finite numbers', () => {
    const circular: { child?: unknown } = {};
    circular.child = circular;
    expect(scrubLogData(circular)).toEqual({ child: '[CIRCULAR]' });
    expect(scrubLogData(Number.POSITIVE_INFINITY)).toBe('Infinity');
    let deeplyNested: unknown = true;
    for (let depth = 0; depth < 10; depth += 1) {
      deeplyNested = { child: deeplyNested };
    }
    expect(JSON.stringify(scrubLogData(deeplyNested))).toContain('[TRUNCATED]');
  });
});

describe('scrubLogText', () => {
  it('removes bearer tokens and secret assignments', () => {
    expect(
      scrubLogText('Authorization: demo password=demo token=demo-value'),
    ).toBe('Authorization: [REDACTED] password=[REDACTED] token=[REDACTED]');
    expect(scrubLogText('Bearer demo-value')).toBe('Bearer [REDACTED]');
  });
});
