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
    vi.resetAllMocks();
    mocks.from.mockReturnValue({ remove: mocks.remove });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.invokeUntypedRpc
      .mockResolvedValueOnce([
        { bucket: 'visitor-photos', path: 'society/old.jpg' },
        { bucket: 'visitor-photos', path: 'society/old.jpg' },
        { bucket: 'request-files', path: 'society/request/old.jpg' },
      ])
      .mockResolvedValueOnce([
        { bucket: 'tenancy-files', path: 'society/moves/old-proof.pdf' },
      ])
      .mockResolvedValueOnce([
        { bucket: 'parking-photos', path: 'society/reports/old.jpg' },
      ])
      .mockResolvedValueOnce([
        { bucket: 'document-files', path: 'society/documents/unattached.pdf' },
      ])
      .mockResolvedValueOnce([
        { bucket: 'patrol-photos', path: 'society/incidents/old.jpg' },
      ])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ staffAttendanceDeleted: 0 })
      .mockResolvedValueOnce({
        vehicles_deleted: 0,
        emergency_contacts_deleted: 0,
        preferences_deleted: 0,
      })
      .mockResolvedValueOnce({ documents_deleted: 1, preparations_cleared: 0 })
      .mockResolvedValueOnce({ photos_deleted: 1 })
      .mockResolvedValueOnce({ photos_deleted: 2 })
      .mockResolvedValueOnce([
        { bucket: 'metering-photos', path: 'society/readings/u/a.jpg' },
        { bucket: 'metering-photos', path: 'society/readings/u/a.jpg' },
      ])
      .mockResolvedValueOnce([
        { bucket: 'vendor-files', path: 'society/vendors/u/a.pdf' },
        { bucket: 'vendor-files', path: 'society/vendors/u/a.pdf' },
      ])
      .mockResolvedValueOnce([
        { bucket: 'community-photos', path: 'society/user/a.jpg' },
        { bucket: 'community-photos', path: 'society/user/a.jpg' },
      ])
      .mockResolvedValueOnce({
        postsDeleted: 1,
        listingsDeleted: 0,
        repliesDeleted: 2,
      });
  });

  it('deduplicates and removes listed files before the database purge', async () => {
    await expect(runRetentionPrivileged('2026-11-10')).resolves.toBeUndefined();

    expect(mocks.from).toHaveBeenNthCalledWith(1, 'visitor-photos');
    expect(mocks.remove).toHaveBeenNthCalledWith(1, ['society/old.jpg']);
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'request-files');
    expect(mocks.remove).toHaveBeenNthCalledWith(2, [
      'society/request/old.jpg',
    ]);
    expect(mocks.from).toHaveBeenNthCalledWith(3, 'tenancy-files');
    expect(mocks.remove).toHaveBeenNthCalledWith(3, [
      'society/moves/old-proof.pdf',
    ]);
    expect(mocks.from).toHaveBeenNthCalledWith(4, 'parking-photos');
    expect(mocks.remove).toHaveBeenNthCalledWith(4, [
      'society/reports/old.jpg',
    ]);
    expect(mocks.from).toHaveBeenNthCalledWith(5, 'document-files');
    expect(mocks.remove).toHaveBeenNthCalledWith(5, [
      'society/documents/unattached.pdf',
    ]);
    expect(mocks.from).toHaveBeenNthCalledWith(6, 'patrol-photos');
    expect(mocks.remove).toHaveBeenNthCalledWith(6, [
      'society/incidents/old.jpg',
    ]);
    expect(mocks.from).toHaveBeenNthCalledWith(7, 'metering-photos');
    expect(mocks.remove).toHaveBeenNthCalledWith(7, [
      'society/readings/u/a.jpg',
    ]);
    expect(mocks.from).toHaveBeenNthCalledWith(8, 'vendor-files');
    expect(mocks.remove).toHaveBeenNthCalledWith(8, [
      'society/vendors/u/a.pdf',
    ]);
    expect(mocks.from).toHaveBeenLastCalledWith('community-photos');
    expect(mocks.remove).toHaveBeenLastCalledWith(['society/user/a.jpg']);
    expect(mocks.invokeUntypedRpc.mock.calls.map((call) => call[1])).toEqual([
      'housekeeping_retention_files_list',
      'tenancy_retention_files_list',
      'parking_retention_files_list',
      'document_retention_files_list',
      'patrol_retention_files_list',
      'housekeeping_retention_run',
      'staff_retention_run',
      'directory_retention_run',
      'tenancy_retention_run',
      'parking_retention_run',
      'patrol_retention_run',
      'metering_retention_files_list',
      'vendor_retention_files_list',
      'community_retention_files_list',
      'community_retention_run',
    ]);
  });

  it('keeps community rows when their photo removal fails', async () => {
    mocks.remove
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('Synthetic Storage failure') });
    await expect(runRetentionPrivileged('2026-11-17')).rejects.toThrow(
      'Could not remove expired community-photos files.',
    );
    expect(mocks.invokeUntypedRpc).not.toHaveBeenCalledWith(
      expect.anything(),
      'community_retention_run',
      expect.anything(),
    );
  });

  it('rejects community file lists that name another bucket', async () => {
    mocks.invokeUntypedRpc.mockReset();
    mocks.invokeUntypedRpc
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ staffAttendanceDeleted: 0 })
      .mockResolvedValueOnce({
        vehicles_deleted: 0,
        emergency_contacts_deleted: 0,
        preferences_deleted: 0,
      })
      .mockResolvedValueOnce({ documents_deleted: 0, preparations_cleared: 0 })
      .mockResolvedValueOnce({ photos_deleted: 0 })
      .mockResolvedValueOnce({ photos_deleted: 0 })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { bucket: 'patrol-photos', path: 'society/incidents/a.jpg' },
      ]);
    await expect(runRetentionPrivileged('2026-11-17')).rejects.toThrow(
      'Community retention file list returned an invalid response.',
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejects vendor file lists that name another bucket', async () => {
    mocks.invokeUntypedRpc.mockReset();
    mocks.invokeUntypedRpc
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ staffAttendanceDeleted: 0 })
      .mockResolvedValueOnce({
        vehicles_deleted: 0,
        emergency_contacts_deleted: 0,
        preferences_deleted: 0,
      })
      .mockResolvedValueOnce({ documents_deleted: 0, preparations_cleared: 0 })
      .mockResolvedValueOnce({ photos_deleted: 0 })
      .mockResolvedValueOnce({ photos_deleted: 0 })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { bucket: 'document-files', path: 'society/documents/a.pdf' },
      ]);
    await expect(runRetentionPrivileged('2026-11-16')).rejects.toThrow(
      'Vendor retention file list returned an invalid response.',
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejects metering file lists that name another bucket', async () => {
    mocks.invokeUntypedRpc.mockReset();
    mocks.invokeUntypedRpc
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ staffAttendanceDeleted: 0 })
      .mockResolvedValueOnce({
        vehicles_deleted: 0,
        emergency_contacts_deleted: 0,
        preferences_deleted: 0,
      })
      .mockResolvedValueOnce({ documents_deleted: 0, preparations_cleared: 0 })
      .mockResolvedValueOnce({ photos_deleted: 0 })
      .mockResolvedValueOnce({ photos_deleted: 0 })
      .mockResolvedValueOnce([
        { bucket: 'parking-photos', path: 'society/reports/a.jpg' },
      ]);
    await expect(runRetentionPrivileged('2026-11-16')).rejects.toThrow(
      'Metering retention file list returned an invalid response.',
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('fails when the staff retention result is malformed', async () => {
    mocks.invokeUntypedRpc.mockReset();
    mocks.invokeUntypedRpc
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ staffAttendanceDeleted: 'unknown' });

    await expect(runRetentionPrivileged('2026-11-10')).rejects.toThrow(
      'Staff retention returned an invalid response.',
    );
  });

  it('fails when directory retention returns malformed purge counts', async () => {
    mocks.invokeUntypedRpc.mockReset();
    mocks.invokeUntypedRpc
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ staffAttendanceDeleted: 0 })
      .mockResolvedValueOnce({
        vehicles_deleted: -1,
        emergency_contacts_deleted: 0,
        preferences_deleted: 0,
      });
    await expect(runRetentionPrivileged('2026-11-15')).rejects.toThrow(
      'Directory retention returned an invalid response.',
    );
  });

  it('does not purge rows when storage deletion fails', async () => {
    mocks.remove.mockResolvedValueOnce({
      error: new Error('storage unavailable'),
    });

    await expect(runRetentionPrivileged('2026-11-10')).rejects.toThrow(
      'Could not remove expired visitor-photos files.',
    );
    expect(mocks.invokeUntypedRpc.mock.calls.map((call) => call[1])).toEqual([
      'housekeeping_retention_files_list',
      'tenancy_retention_files_list',
      'parking_retention_files_list',
      'document_retention_files_list',
      'patrol_retention_files_list',
    ]);
  });

  it('does not mark tenancy documents deleted when their Storage removal fails', async () => {
    mocks.remove
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('Synthetic Storage failure') });
    await expect(runRetentionPrivileged('2026-11-15')).rejects.toThrow(
      'Could not remove expired tenancy-files files.',
    );
    expect(mocks.invokeUntypedRpc.mock.calls.map((call) => call[1])).toEqual([
      'housekeeping_retention_files_list',
      'tenancy_retention_files_list',
      'parking_retention_files_list',
      'document_retention_files_list',
      'patrol_retention_files_list',
    ]);
  });

  it('rejects malformed tenancy purge counts instead of reporting retention success', async () => {
    mocks.invokeUntypedRpc
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ staffAttendanceDeleted: 0 })
      .mockResolvedValueOnce({
        vehicles_deleted: 0,
        emergency_contacts_deleted: 0,
        preferences_deleted: 0,
      })
      .mockResolvedValueOnce({
        documents_deleted: -1,
        preparations_cleared: 0,
      });
    await expect(runRetentionPrivileged('2026-11-15')).rejects.toThrow(
      'Tenancy retention returned an invalid response.',
    );
  });

  it('rejects malformed parking photo purge counts', async () => {
    mocks.invokeUntypedRpc
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ staffAttendanceDeleted: 0 })
      .mockResolvedValueOnce({
        vehicles_deleted: 0,
        emergency_contacts_deleted: 0,
        preferences_deleted: 0,
      })
      .mockResolvedValueOnce({ documents_deleted: 0, preparations_cleared: 0 })
      .mockResolvedValueOnce({ photos_deleted: 'many' });
    await expect(runRetentionPrivileged('2026-11-16')).rejects.toThrow(
      'Parking retention returned an invalid response.',
    );
  });

  it('rejects malformed patrol photo purge counts', async () => {
    mocks.invokeUntypedRpc
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ staffAttendanceDeleted: 0 })
      .mockResolvedValueOnce({
        vehicles_deleted: 0,
        emergency_contacts_deleted: 0,
        preferences_deleted: 0,
      })
      .mockResolvedValueOnce({ documents_deleted: 0, preparations_cleared: 0 })
      .mockResolvedValueOnce({ photos_deleted: 0 })
      .mockResolvedValueOnce({ photos_deleted: -1 });
    await expect(runRetentionPrivileged('2026-11-16')).rejects.toThrow(
      'Patrol retention returned an invalid response.',
    );
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
