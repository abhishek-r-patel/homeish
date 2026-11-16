// Verify meeting minutes render to a multi-page PDF and reject text the PDF font cannot draw.
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  meetingMinutesFileName,
  meetingMinutesPdf,
} from '../../src/core/meeting/minutes-pdf';
import type { MeetingAdminDetail } from '../../src/core/meeting/validation';

const id = (number: string) =>
  `e0000000-0000-4000-8000-${number.padStart(12, '0')}`;

function detail(body: string): MeetingAdminDetail {
  return {
    meeting: {
      id: id('1'),
      meetingType: 'agm',
      status: 'held',
      title: 'Annual general meeting 2026',
      description: null,
      startsAt: '2026-11-20T04:00:00.000Z',
      endsAt: '2026-11-20T06:00:00.000Z',
      venue: 'Clubhouse hall',
      onlineUrl: null,
      inviteeScope: 'default',
      noticeRequiredDays: 14,
      noticeGivenDays: 15,
      quorumPercent: 33,
      checkinOpen: false,
      version: 4,
      cancellationReason: null,
    },
    agenda: [{ id: id('21'), title: 'Approve accounts', description: null }],
    invitees: { scope: 'default' },
    invited: [
      { attendeeId: id('11'), label: 'A-101' },
      { attendeeId: id('12'), label: 'A-102' },
    ],
    attendance: [
      {
        attendeeId: id('11'),
        label: 'A-101',
        mode: 'proxy',
        proxyName: 'Synthetic Proxy',
        recordedAt: '2026-11-20T04:05:00.000Z',
        recordedByName: 'Synthetic Admin',
      },
    ],
    quorum: { invited: 2, present: 1, percent: 33, met: true },
    resolutions: [
      {
        id: id('31'),
        agendaItemId: id('21'),
        title: 'Approve the audited accounts',
        body: null,
        outcome: 'passed',
        votesFor: 1,
        votesAgainst: 0,
        votesAbstain: 0,
        version: 1,
        poll: null,
      },
    ],
    minutes: {
      status: 'published',
      body,
      version: 2,
      updatedAt: '2026-11-20T06:00:00.000Z',
      updatedByName: 'Synthetic Secretary',
      publishedAt: '2026-11-20T06:00:00.000Z',
      documentId: null,
    },
    actions: [
      {
        id: id('71'),
        title: 'Share accounts',
        ownerMembershipId: id('41'),
        ownerName: 'Synthetic Treasurer',
        dueOn: '2026-11-30',
        status: 'open',
        note: null,
        resolutionId: null,
        version: 1,
        overdue: false,
      },
    ],
  };
}

describe('meeting minutes PDF', () => {
  it('paginates long minutes into a valid PDF', async () => {
    const body = Array.from(
      { length: 120 },
      (_, index) => `Paragraph ${index + 1}: the committee discussed upkeep.`,
    ).join('\n');
    const bytes = await meetingMinutesPdf(detail(body));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThan(1);
    expect(parsed.getTitle()).toBe('Minutes: Annual general meeting 2026');
  });

  it('rejects characters the standard font cannot display', async () => {
    await expect(
      meetingMinutesPdf(detail('Approved unanimously 🎉')),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { minutes: expect.stringContaining('emoji') },
    });
  });

  it('builds a safe file name from the meeting title', () => {
    expect(meetingMinutesFileName('AGM 2026: Tower A/B!')).toBe(
      'minutes-agm-2026-tower-a-b.pdf',
    );
    expect(meetingMinutesFileName('मीटिंग')).toBe('minutes-meeting.pdf');
  });
});
