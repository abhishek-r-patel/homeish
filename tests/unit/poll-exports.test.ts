// Verify poll form limits and privacy-safe, spreadsheet-safe completed exports.
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { pollExportCsv, pollExportPdf } from '../../src/core/poll/exports';
import {
  pollDraftInputSchema,
  type PollExport,
} from '../../src/core/poll/validation';

const draft = {
  title: '',
  instructions: null,
  opensAt: null,
  closesAt: null,
  selectionMode: 'single' as const,
  selectionLimit: 1,
  tenantVotingOverride: null,
  blockIds: [],
  options: [],
  offices: [],
};

const exportBase: PollExport = {
  societyName: 'Synthetic Society',
  vote: {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Synthetic election',
    votingType: 'private',
    selectionMode: 'single',
    selectionLimit: 1,
    opensAt: '2026-11-17T04:30:00.000Z',
    closesAt: '2026-11-18T18:29:00.000Z',
    completedAt: '2026-11-18T18:29:00.000Z',
    completionMode: 'deadline',
  },
  eligible: 2,
  submitted: 2,
  options: null,
  offices: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Chair',
      candidates: [
        {
          id: '00000000-0000-4000-8000-000000000003',
          name: 'Synthetic Candidate',
          count: 1,
        },
      ],
      notaCount: 1,
    },
  ],
  responses: null,
  roster: [
    { unitLabel: 'A-101', representativeName: 'Synthetic Resident A' },
    { unitLabel: 'B-202', representativeName: 'Synthetic Resident B' },
  ],
};

describe('poll draft and export contracts', () => {
  it('accepts single-select limit one and uncapped multiple-select drafts only', () => {
    expect(pollDraftInputSchema.safeParse(draft).success).toBe(true);
    expect(
      pollDraftInputSchema.safeParse({
        ...draft,
        selectionMode: 'multiple',
        selectionLimit: null,
      }).success,
    ).toBe(true);
    expect(
      pollDraftInputSchema.safeParse({
        ...draft,
        selectionMode: 'multiple',
        selectionLimit: 1,
      }).success,
    ).toBe(false);
  });

  it('keeps the private election roster separate from every choice total', () => {
    const csv = pollExportCsv(exportBase);
    const resultsStart = csv.indexOf('Election results');
    const rosterStart = csv.indexOf('Separate submitted-voter roster');
    const rosterEntry = csv.indexOf('A-101');

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('\r\n');
    expect(resultsStart).toBeGreaterThan(-1);
    expect(rosterStart).toBeGreaterThan(resultsStart);
    expect(rosterEntry).toBeGreaterThan(rosterStart);
    expect(csv.slice(0, rosterStart)).not.toContain('A-101');
    expect(csv).not.toContain('@');
  });

  it('creates a multipage private PDF with a separate roster page', async () => {
    const pdf = await pollExportPdf(exportBase);
    const document = await PDFDocument.load(pdf);

    expect(document.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(document.getPage(0)?.getSize().width).toBeCloseTo(595.28, 1);
    expect(document.getPage(0)?.getSize().height).toBeCloseTo(841.89, 1);
  });

  it('neutralizes spreadsheet formulas from public poll labels and responses', () => {
    const csv = pollExportCsv({
      ...exportBase,
      vote: {
        ...exportBase.vote,
        title: '=2+2',
        votingType: 'public',
      },
      options: [
        {
          id: '00000000-0000-4000-8000-000000000004',
          label: '+SUM(A1:A2)',
          count: 1,
        },
      ],
      offices: null,
      responses: [
        {
          unitLabel: 'A-101',
          representativeName: '@Synthetic Resident',
          optionIds: ['00000000-0000-4000-8000-000000000004'],
        },
      ],
      roster: null,
    });

    expect(csv).toContain("'=2+2");
    expect(csv).toContain("'+SUM(A1:A2)");
    expect(csv).toContain("'@Synthetic Resident");
  });
});
