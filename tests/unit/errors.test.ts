// Verify the closed error model, safe envelopes and request ID handling.
import { describe, expect, it } from 'vitest';
import {
  AppError,
  CONFLICT_REASONS,
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  ConflictError,
  ValidationError,
  createRequestId,
  errorHttpStatus,
  failureEnvelope,
  requestIdFromHeaders,
  successEnvelope,
} from '../../src/core/errors';

describe('error codes and statuses', () => {
  it('assigns every documented error code an HTTP status', () => {
    expect(Object.keys(ERROR_HTTP_STATUS).sort()).toEqual(
      [...ERROR_CODES].sort(),
    );
    expect(ERROR_CODES.map(errorHttpStatus)).toHaveLength(ERROR_CODES.length);
  });

  it('keeps conflict reasons to the documented closed list', () => {
    expect(CONFLICT_REASONS).toEqual([
      'already_decided',
      'expired',
      'duplicate_reference',
      'duplicate_charge',
      'stale_version',
      'invalid_state',
      'limit_reached',
      'has_history',
      'not_unpaid',
    ]);
  });
});

describe('application errors', () => {
  it('requires a valid conflict reason and rejects details on unrelated codes', () => {
    expect(() => new AppError('CONFLICT')).toThrow(
      'require a closed-list reason',
    );
    expect(() => new AppError('FORBIDDEN', { reason: 'expired' })).toThrow(
      'Only CONFLICT errors',
    );
    expect(
      () => new AppError('UNAUTHENTICATED', { retryAfterSeconds: 2 }),
    ).toThrow('Only rate-limit errors');
  });

  it('requires a positive integer retry time for rate-limit errors', () => {
    expect(
      () => new AppError('RATE_LIMITED', { retryAfterSeconds: 0 }),
    ).toThrow('positive integer');
    expect(
      new AppError('RATE_LIMITED', { retryAfterSeconds: 30 }).retryAfterSeconds,
    ).toBe(30);
  });

  it('exposes validation fields and conflict reason as typed failures', () => {
    expect(
      new ValidationError({ email: 'Enter a valid email.' }),
    ).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { email: 'Enter a valid email.' },
    });
    expect(new ConflictError('stale_version')).toMatchObject({
      code: 'CONFLICT',
      reason: 'stale_version',
    });
  });
});

describe('response envelopes', () => {
  it('keeps success data and optional metadata in the documented shape', () => {
    expect(successEnvelope({ id: 'one' }, { cursor: 'next' })).toEqual({
      ok: true,
      data: { id: 'one' },
      meta: { cursor: 'next' },
    });
    expect(successEnvelope(null)).toEqual({ ok: true, data: null });
  });

  it('includes only the safe failure fields that are present', () => {
    const error = new ConflictError(
      'duplicate_reference',
      'This payment was already submitted.',
    );
    expect(failureEnvelope(error)).toEqual({
      ok: false,
      error: {
        code: 'CONFLICT',
        message: 'This payment was already submitted.',
        reason: 'duplicate_reference',
      },
    });
    expect(
      failureEnvelope(new ValidationError({ amount: 'Enter an amount.' })).error
        .fieldErrors,
    ).toEqual({ amount: 'Enter an amount.' });
  });
});

describe('request IDs', () => {
  it('preserves a valid UUID and generates one when absent or malformed', () => {
    const valid = '4f05ab7e-17d6-4d74-8a8b-3b37304c83f0';
    expect(createRequestId(valid)).toBe(valid);
    expect(createRequestId(valid.toUpperCase())).toBe(valid);
    expect(createRequestId('invalid')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('reads the correlation header', () => {
    const id = 'a50d3d97-c76c-4ae1-b657-43a51da19f24';
    expect(requestIdFromHeaders(new Headers({ 'x-request-id': id }))).toBe(id);
  });
});
