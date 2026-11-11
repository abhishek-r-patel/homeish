// Verify developer console filter and pagination validation.
import { describe, expect, it, vi } from 'vitest';
import {
  auditFilterSchema,
  errorFilterSchema,
  pageSchema,
} from '../../src/core/developer/console';

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: vi.fn(),
}));
vi.mock('../../src/core/privileged', () => ({
  runUserErasurePrivileged: vi.fn(),
}));

describe('developer console query schemas', () => {
  it('accepts only supported page sizes and defaults to 25', () => {
    expect(pageSchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(pageSchema.parse({ page: '2', pageSize: '50' })).toEqual({
      page: 2,
      pageSize: 50,
    });
    expect(pageSchema.safeParse({ pageSize: '20' }).success).toBe(false);
  });

  it('requires an increasing exclusive date range for error and audit filters', () => {
    const validRange = { from: '2026-11-10', before: '2026-11-12' };
    expect(errorFilterSchema.safeParse(validRange).success).toBe(true);
    expect(auditFilterSchema.safeParse(validRange).success).toBe(true);

    const reversedRange = { from: '2026-11-12', before: '2026-11-10' };
    expect(errorFilterSchema.safeParse(reversedRange).success).toBe(false);
    expect(auditFilterSchema.safeParse(reversedRange).success).toBe(false);
  });
});
