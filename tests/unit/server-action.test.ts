// Verify new module forms preserve validated errors, creation data and reference-ID failures.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../src/core/errors';
const mocks = vi.hoisted(() => ({ headers: vi.fn(), log: vi.fn() }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('../../src/core/logging/error-logger', () => ({
  logUnexpectedError: mocks.log,
}));
import {
  readModuleActionInput,
  runServerAction,
} from '../../src/core/actions/server-action';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.headers.mockResolvedValue(
    new Headers({ 'x-request-id': '6a696d6f-774c-41d1-ae47-6254d4a8f4cf' }),
  );
  mocks.log.mockResolvedValue('ERR-123456ABCD');
});

describe('module action boundary', () => {
  it('rejects missing and malformed JSON as a visible validation failure, not a server outage', async () => {
    const data = new FormData();
    expect(() => readModuleActionInput(data)).toThrow(ValidationError);
    data.set('input', '{');
    const result = await runServerAction('/tenancy', async () => {
      readModuleActionInput(data);
    });
    expect(result).toMatchObject({
      ok: false,
      code: 'VALIDATION_FAILED',
      fieldErrors: { form: 'The form details are invalid. Check and retry.' },
    });
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it('leaves decoded input for the operation schema and preserves the exact created-record result', async () => {
    const data = new FormData();
    data.set('input', '{"moveId":"synthetic"}');
    expect(readModuleActionInput(data)).toEqual({ moveId: 'synthetic' });
    await expect(
      runServerAction('/tenancy', async () => ({
        data: 'synthetic-created-id',
        message: 'Move request created.',
      })),
    ).resolves.toEqual({
      ok: true,
      data: 'synthetic-created-id',
      message: 'Move request created.',
    });
  });

  it('logs unexpected failures with request correlation and never exposes their raw details', async () => {
    const error = new Error('Synthetic internal detail');
    const result = await runServerAction('/tenancy', async () => {
      throw error;
    });
    expect(result).toMatchObject({
      ok: false,
      code: 'INTERNAL_ERROR',
      referenceId: 'ERR-123456ABCD',
    });
    expect(JSON.stringify(result)).not.toContain('Synthetic internal detail');
    expect(mocks.log).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        route: '/tenancy',
        requestId: '6a696d6f-774c-41d1-ae47-6254d4a8f4cf',
      }),
    );
  });
});
