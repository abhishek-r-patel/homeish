// Verify P55 page/action search stays within role and enabled-module boundaries.
import { describe, expect, it } from 'vitest';
import { searchWorkspaceCatalogue } from '../../src/core/home/search-catalogue';

describe('workspace search catalogue', () => {
  it('returns permitted resident pages and actions only', () => {
    const result = searchWorkspaceCatalogue(
      ['resident'],
      ['billing', 'service_request', 'visitor'],
      'bill',
    );
    expect(result.pages.map(({ href }) => href)).toEqual(['/bills']);
    expect(result.actions.map(({ key }) => key)).toEqual(['billing.view']);
  });

  it('never exposes disabled-module actions or admin actions to residents', () => {
    const result = searchWorkspaceCatalogue(
      ['resident'],
      ['service_request'],
      'request',
    );
    expect(result.pages.map(({ href }) => href)).toEqual(['/requests']);
    expect(result.actions.map(({ key }) => key)).toEqual(['request.create']);
    expect(result.pages.some(({ href }) => href.startsWith('/admin'))).toBe(
      false,
    );
  });

  it('uses the active work role catalogue for management search', () => {
    const result = searchWorkspaceCatalogue(
      ['committee'],
      ['billing', 'notice', 'service_request'],
      'notice',
    );
    expect(result.pages.map(({ href }) => href)).toEqual(['/admin/notices']);
    expect(result.actions.map(({ key }) => key)).toEqual(['notice.create']);
  });
});
