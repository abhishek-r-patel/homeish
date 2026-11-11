// Verify retention removes private files before asking the database to purge rows.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invokeUntypedRpc: vi.fn(),
  from: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/db/untyped-rpc', () => ({
  invokeUntypedRpc: mocks.invokeUntypedRpc,
}));
vi.mock('../../src/core/privileged/server-client', () => ({
  privilegedClient: {
    storage: { from: mocks.from },
  },
}));

import { runRetentionPrivileged } from '../../src/core/privileged/retention';

describe('retention privileged task', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ remove: mocks.remove });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.invokeUntypedRpc
      .mockResolvedValueOnce([
        { bucket: 'visitor-photos', path: 'society/old.jpg' },
        { bucket: 'visitor-photos', path: 'society/old.jpg' },
        { bucket: 'request-files', path: 'society/request/old.jpg' },
      ])
      .mockResolvedValueOnce({});
  });

  it('deduplicates and removes listed files before the database purge', async () => {
    await expect(runRetentionPrivileged('2026-11-10')).resolves.toBeUndefined();

    expect(mocks.from).toHaveBeenNthCalledWith(1, 'visitor-photos');
    expect(mocks.remove).toHaveBeenNthCalledWith(1, ['society/old.jpg']);
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'request-files');
    expect(mocks.remove).toHaveBeenNthCalledWith(2, [
      'society/request/old.jpg',
    ]);
    expect(mocks.invokeUntypedRpc.mock.calls.map((call) => call[1])).toEqual([
      'housekeeping_retention_files_list',
      'housekeeping_retention_run',
    ]);
  });

  it('does not purge rows when storage deletion fails', async () => {
    mocks.remove.mockResolvedValueOnce({
      error: new Error('storage unavailable'),
    });

    await expect(runRetentionPrivileged('2026-11-10')).rejects.toThrow(
      'Could not remove expired visitor-photos files.',
    );
    expect(mocks.invokeUntypedRpc).toHaveBeenCalledOnce();
  });

  it('rejects unexpected file-list results', async () => {
    mocks.invokeUntypedRpc.mockReset();
    mocks.invokeUntypedRpc.mockResolvedValueOnce([
      { bucket: 'unexpected-bucket', path: 'unsafe/path' },
    ]);

    await expect(runRetentionPrivileged('2026-11-10')).rejects.toThrow(
      'Retention file list returned an invalid response.',
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
