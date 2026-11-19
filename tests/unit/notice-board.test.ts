// Verify notice and contact log contracts, attachment paths, permissions and notification links.
import { describe, expect, it } from 'vitest';
import { getRoleNavigation } from '../../src/core/modules';
import {
  noticeCreateInputSchema,
  noticeDraftInputSchema,
  noticeFileFolder,
  noticePlanInputSchema,
  noticeUpdateInputSchema,
} from '../../src/core/notices/validation';
import {
  contactLogSaveInputSchema,
  parseDashboardMonth,
} from '../../src/core/communication/validation';
import { notificationPath } from '../../src/core/notifications/links';
import { hasPermission } from '../../src/core/permissions';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const blockId = '5a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const folderId = '6a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const fileId = '7a696d6f-774c-41d1-ae47-6254d4a8f4cf';

describe('notice board', () => {
  it('requires blocks only for a block audience and trims content', () => {
    const base = {
      title: '  Water outage  ',
      body: ' Tanks will be cleaned on Sunday. ',
      audience: 'all',
      clientRequestId: folderId,
    };
    const parsed = noticeCreateInputSchema.parse(base);
    expect(parsed).toMatchObject({
      title: 'Water outage',
      body: 'Tanks will be cleaned on Sunday.',
      blockIds: [],
      pinned: false,
      expiresAt: null,
      attachmentPath: null,
    });
    expect(
      noticeCreateInputSchema.safeParse({ ...base, audience: 'blocks' })
        .success,
    ).toBe(false);
    expect(
      noticeCreateInputSchema.safeParse({
        ...base,
        audience: 'blocks',
        blockIds: [blockId],
      }).success,
    ).toBe(true);
    expect(
      noticeCreateInputSchema.safeParse({ ...base, blockIds: [blockId] })
        .success,
    ).toBe(false);
    expect(
      noticeCreateInputSchema.safeParse({ ...base, title: '   ' }).success,
    ).toBe(false);
    expect(
      noticeCreateInputSchema.safeParse({ ...base, title: 'x'.repeat(121) })
        .success,
    ).toBe(false);
    expect(
      noticeUpdateInputSchema.safeParse({
        ...base,
        clientRequestId: undefined,
        noticeId: folderId,
      }).success,
    ).toBe(false);
  });

  it('accepts notice files only inside the society notice folder', () => {
    const path = `${societyId}/notices/${folderId}/${fileId}.pdf`;
    expect(noticeFileFolder(path, societyId)).toBe(
      `${societyId}/notices/${folderId}`,
    );
    expect(noticeFileFolder(path, blockId)).toBeNull();
    expect(
      noticeFileFolder(
        `${societyId}/notices/${folderId}/${fileId}.gif`,
        societyId,
      ),
    ).toBeNull();
    expect(
      noticeFileFolder(
        `${societyId}/requests/${folderId}/${fileId}.png`,
        societyId,
      ),
    ).toBeNull();
  });

  it('lets managers publish while residents only read and guards see nothing', () => {
    expect(hasPermission(['committee'], 'notice', 'notice:create')).toBe(true);
    expect(hasPermission(['admin'], 'notice', 'notice:archive')).toBe(true);
    expect(hasPermission(['resident'], 'notice', 'notice:list')).toBe(true);
    expect(hasPermission(['resident'], 'notice', 'notice:create')).toBe(false);
    expect(hasPermission(['guard'], 'notice', 'notice:list')).toBe(false);
    expect(
      getRoleNavigation(['committee'], ['notice']).map(({ href }) => href),
    ).toContain('/admin/notices');
    expect(
      getRoleNavigation(['guard'], ['notice']).some(
        ({ moduleKey }) => moduleKey === 'notice',
      ),
    ).toBe(false);
  });

  it('links notice notifications to the notice detail page', () => {
    expect(notificationPath('notice', folderId, () => true)).toBe(
      `/notices/${folderId}`,
    );
  });

  it('needs a retry id for new drafts and a version for edits', () => {
    const base = { title: 'AGM', body: 'Agenda soon.', audience: 'all' };
    expect(noticeDraftInputSchema.safeParse(base).success).toBe(false);
    expect(
      noticeDraftInputSchema.parse({
        ...base,
        clientRequestId: folderId,
        scheduledFor: '2026-12-01',
      }).scheduledFor,
    ).toBe('2026-12-01');
    expect(
      noticeDraftInputSchema.safeParse({ ...base, noticeId: folderId }).success,
    ).toBe(false);
  });

  it('requires a next action when its date is set and blanks empty text', () => {
    expect(
      noticePlanInputSchema.safeParse({
        noticeId: folderId,
        nextActionOn: '2026-12-01',
      }).success,
    ).toBe(false);
    expect(
      noticePlanInputSchema.parse({ noticeId: folderId, preparedBy: '  ' }),
    ).toMatchObject({ preparedBy: null, priority: null });
  });
});

describe('member contact log and communication dashboard', () => {
  const entry = {
    logId: null,
    expectedUpdatedAt: null,
    clientRequestId: folderId,
    contactOn: '2026-11-18',
    unitId: '',
    contactType: 'complaint',
    channel: 'phone',
    direction: 'incoming',
    summary: ' Lift noise at night. ',
    handledBy: blockId,
    followUpOn: '',
    status: 'open',
    serviceRequestId: '',
  };

  it('normalises blank pickers and trims the summary', () => {
    expect(contactLogSaveInputSchema.parse(entry)).toMatchObject({
      unitId: null,
      followUpOn: null,
      serviceRequestId: null,
      summary: 'Lift noise at night.',
    });
  });

  it('needs a follow-up date on or after the contact date for follow-ups', () => {
    expect(
      contactLogSaveInputSchema.safeParse({ ...entry, status: 'follow_up' })
        .success,
    ).toBe(false);
    expect(
      contactLogSaveInputSchema.safeParse({
        ...entry,
        status: 'follow_up',
        followUpOn: '2026-11-17',
      }).success,
    ).toBe(false);
    expect(
      contactLogSaveInputSchema.safeParse({
        ...entry,
        status: 'follow_up',
        followUpOn: '2026-11-18',
      }).success,
    ).toBe(true);
    expect(
      contactLogSaveInputSchema.safeParse({ ...entry, summary: '   ' }).success,
    ).toBe(false);
  });

  it('falls back to the current month for invalid or future months', () => {
    expect(parseDashboardMonth('2026-10', '2026-11')).toBe('2026-10');
    expect(parseDashboardMonth('2026-12', '2026-11')).toBe('2026-11');
    expect(parseDashboardMonth('2026-13', '2026-11')).toBe('2026-11');
    expect(parseDashboardMonth(['2026-10'], '2026-11')).toBe('2026-11');
  });
});
