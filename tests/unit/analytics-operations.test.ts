// Verify analytics settings conflicts are explained and exports are recorded before the dashboard is read.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildRequestContext: vi.fn(),
  invokeUntypedRpc: vi.fn(),
  enforceRateLimit: vi.fn(),
  authorizeRequest: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));
vi.mock('../../src/core/db/untyped-rpc', () => ({
  invokeUntypedRpc: mocks.invokeUntypedRpc,
}));
vi.mock('../../src/core/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock('../../src/core/permissions/authorize', () => ({
  authorizeRequest: mocks.authorizeRequest,
}));

import { AppError } from '../../src/core/errors';
import {
  ANALYTICS_SETTINGS_CONFLICT_MESSAGE,
  getAnalyticsExport,
  updateAnalyticsSettings,
} from '../../src/core/analytics/operations';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const requestId = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';

function rpcError(code: string) {
  return new Error('rpc failed', { cause: { code } });
}

const dashboard = {
  today: '2026-11-16',
  timezone: 'Asia/Kolkata',
  months: 3,
  moneyRange: 'fy',
  from: '2026-09-01',
  fyFrom: '2026-04-01',
  generatedAt: '2026-11-16T09:30:00+05:30',
  metrics: [],
};

describe('analytics operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({
        data: { name: 'Synthetic Society' },
        error: null,
      }),
    };
    mocks.buildRequestContext.mockResolvedValue({
      societyId,
      userId: requestId,
      requestId,
      roles: ['admin'],
      logger: { warn: vi.fn() },
      db: { from: () => query },
    });
    mocks.enforceRateLimit.mockResolvedValue(undefined);
  });

  it('explains a stale settings save', async () => {
    mocks.invokeUntypedRpc.mockRejectedValue(rpcError('40001'));
    await expect(
      updateAnalyticsSettings(
        { metrics: ['visitor.trend'], expectedVersion: 1 },
        requestId,
      ),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      reason: 'stale_version',
      message: ANALYTICS_SETTINGS_CONFLICT_MESSAGE,
    });
  });

  it('maps rejected metric keys to a field message and refusals to forbidden', async () => {
    mocks.invokeUntypedRpc.mockRejectedValueOnce(rpcError('22023'));
    await expect(
      updateAnalyticsSettings({ metrics: [], expectedVersion: 0 }, requestId),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { metrics: 'Choose metrics from the list and try again.' },
    });
    mocks.invokeUntypedRpc.mockRejectedValueOnce(rpcError('42501'));
    await expect(
      updateAnalyticsSettings({ metrics: [], expectedVersion: 0 }, requestId),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('records the export before reading the dashboard', async () => {
    mocks.invokeUntypedRpc.mockImplementation(async (_db, name: string) =>
      name === 'analytics_export_record' ? null : dashboard,
    );
    const result = await getAnalyticsExport(
      { format: 'csv', months: 3, money: 'fy' },
      requestId,
    );
    expect(mocks.authorizeRequest).toHaveBeenCalledWith(expect.anything(), {
      moduleKey: 'core',
      permission: 'analytics:export',
      write: false,
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      'exportsUserHourly',
      requestId,
      requestId,
    );
    expect(mocks.invokeUntypedRpc.mock.calls.map((call) => call[1])).toEqual([
      'analytics_export_record',
      'analytics_dashboard',
    ]);
    expect(mocks.invokeUntypedRpc.mock.calls[0]?.[2]).toEqual({
      p_society_id: societyId,
      p_format: 'csv',
      p_months: 3,
      p_money_range: 'fy',
      p_request_id: requestId,
    });
    expect(result).toMatchObject({
      format: 'csv',
      societyName: 'Synthetic Society',
      dashboard: { months: 3, moneyRange: 'fy', metrics: [] },
    });
  });

  it('does not record an export when the query is invalid', async () => {
    await expect(
      getAnalyticsExport({ format: 'xlsx', months: 3, money: 'fy' }, requestId),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mocks.invokeUntypedRpc).not.toHaveBeenCalled();
  });
});
