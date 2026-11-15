// Verify resident-directory access states and rendering of permission-filtered data.
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/core/errors';

const mocks = vi.hoisted(() => ({ buildRequestContext: vi.fn() }));
vi.mock('../../src/core/directory/operations', () => ({
  getDirectoryResidents: vi.fn(),
}));
vi.mock('../../src/app/directory/actions', () => ({
  getDirectoryResidentsPageAction: vi.fn(),
}));
vi.mock('../../src/core/tenancy/request-context', () => ({
  buildRequestContext: mocks.buildRequestContext,
}));

import ResidentDirectoryPage from '../../src/app/(resident)/directory/page';
import { getDirectoryResidents } from '../../src/core/directory/operations';

describe('resident directory page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.buildRequestContext.mockResolvedValue({ roles: [] });
  });

  it('renders only the returned contact details with permitted phone links', async () => {
    vi.mocked(getDirectoryResidents).mockResolvedValue({
      items: [
        {
          membership_id: 'a0d55fc3-0751-4b79-86c1-5b3e25942392',
          unit_id: null,
          full_name: 'Resident Alpha',
          unit_number: null,
          phone: null,
        },
        {
          membership_id: 'b0d55fc3-0751-4b79-86c1-5b3e25942392',
          unit_id: 'b0d55fc3-0751-4b79-86c1-5b3e25942393',
          full_name: 'Resident Bravo',
          unit_number: 'B-204',
          phone: '+12025550123',
        },
      ],
      total: 2,
      limit: 10,
      offset: 0,
    });

    const markup = renderToStaticMarkup(await ResidentDirectoryPage());

    expect(getDirectoryResidents).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
    });
    expect(markup).toContain('Resident Alpha');
    expect(markup).toContain('B-204');
    expect(markup).toContain('Not shared');
    expect(markup).toContain('href="tel:+12025550123"');
    expect(markup.match(/href="tel:/g)).toHaveLength(1);
    expect(markup).toContain('Search by name or unit');
  });

  it('distinguishes an empty directory from a failed read', async () => {
    vi.mocked(getDirectoryResidents).mockResolvedValue({
      items: [],
      total: 0,
      limit: 10,
      offset: 0,
    });

    const markup = renderToStaticMarkup(await ResidentDirectoryPage());

    expect(markup).toContain('No residents to show');
    expect(markup).toContain('Search by name or unit');
  });

  it('shows the standard module-disabled page for a disabled directory', async () => {
    vi.mocked(getDirectoryResidents).mockRejectedValue(
      new AppError('MODULE_DISABLED'),
    );

    const markup = renderToStaticMarkup(await ResidentDirectoryPage());

    expect(markup).toContain('is not available');
    expect(markup).toContain('Existing information has not been removed.');
    expect(markup).not.toContain('No residents to show');
  });

  it('shows denied household access explicitly rather than an empty list', async () => {
    vi.mocked(getDirectoryResidents).mockRejectedValue(
      new AppError('FORBIDDEN'),
    );

    const markup = renderToStaticMarkup(await ResidentDirectoryPage());

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Directory access is not available');
    expect(markup).not.toContain('No residents to show');
  });

  it('propagates unexpected failures to the reporting and retry boundary', async () => {
    const failure = new Error('The directory read failed.');
    vi.mocked(getDirectoryResidents).mockRejectedValue(failure);

    await expect(ResidentDirectoryPage()).rejects.toBe(failure);
  });
});
