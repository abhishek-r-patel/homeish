// Verify meeting attendance marks, the self check-in window and rules, concurrency and quorum.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  auditActionsFor,
  callMeeting,
  createMeetingFixture,
  createScheduledMeeting,
  databaseTimestamp,
  errorFor,
  expectCode,
  expectDomainError,
  moveMeetingTimes,
  records,
  requestId,
  updateMeetingSettings,
  type MeetingActor,
  type MeetingFixture,
} from './support/meeting-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('meeting attendance database contracts', () => {
  let database: TestDatabase;
  let fixture: MeetingFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createMeetingFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  function setAttendance(
    meetingId: string,
    attendeeId: string,
    mode: string,
    proxyName: string | null = null,
    actor: MeetingActor = 'admin',
  ) {
    return callMeeting(fixture, actor, 'meeting_attendance_set', [
      fixture.societyId,
      meetingId,
      attendeeId,
      mode,
      proxyName,
      requestId('attendance'),
    ]);
  }

  function removeAttendance(meetingId: string, attendeeId: string) {
    return callMeeting(fixture, 'admin', 'meeting_attendance_remove', [
      fixture.societyId,
      meetingId,
      attendeeId,
      requestId('attendance'),
    ]);
  }

  function setCheckin(meetingId: string, open: boolean) {
    return callMeeting(fixture, 'admin', 'meeting_checkin_set', [
      fixture.societyId,
      meetingId,
      open,
      requestId('checkin'),
    ]);
  }

  function selfCheckin(actor: MeetingActor, meetingId: string, unitId: string) {
    return callMeeting(fixture, actor, 'meeting_self_checkin', [
      fixture.societyId,
      meetingId,
      unitId,
      requestId('self'),
    ]);
  }

  async function attendanceRows(meetingId: string) {
    const result = await database.asSuperuser((client) =>
      client.query<{
        unit_id: string | null;
        membership_id: string | null;
        mode: string;
        proxy_name: string | null;
      }>(
        `select unit_id,membership_id,mode,proxy_name from public.meeting_attendance
         where society_id=$1 and meeting_id=$2`,
        [fixture.societyId, meetingId],
      ),
    );
    return result.rows;
  }

  async function adminView(meetingId: string) {
    return callMeeting(fixture, 'admin', 'meeting_admin_get', [
      fixture.societyId,
      meetingId,
    ]);
  }

  async function startingSoon(
    overrides: Parameters<typeof createScheduledMeeting>[1] = {},
  ) {
    const scheduled = await createScheduledMeeting(fixture, overrides);
    await moveMeetingTimes(fixture, scheduled.meetingId, 30);
    return scheduled;
  }

  it('lets the admin mark, change and remove attendance only inside the attendance window', async () => {
    const scheduled = await createScheduledMeeting(fixture);
    await expectDomainError(
      setAttendance(scheduled.meetingId, fixture.units.a101.id, 'in_person'),
      'meeting_invalid_state',
    );
    await moveMeetingTimes(fixture, scheduled.meetingId, 30);

    const request = requestId('attendance');
    const marked = await callMeeting(
      fixture,
      'admin',
      'meeting_attendance_set',
      [
        fixture.societyId,
        scheduled.meetingId,
        fixture.units.a101.id,
        'in_person',
        null,
        request,
      ],
    );
    expect(marked).toEqual({
      meetingId: scheduled.meetingId,
      attendeeId: fixture.units.a101.id,
      mode: 'in_person',
    });
    expect(await auditActionsFor(fixture, request)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^meeting\./)]),
    );
    await setAttendance(scheduled.meetingId, fixture.units.a101.id, 'online');
    await expectCode(
      setAttendance(scheduled.meetingId, fixture.units.a201.id, 'proxy', null),
      '22023',
    );
    await expectCode(
      setAttendance(scheduled.meetingId, fixture.units.a201.id, 'proxy', '   '),
      '22023',
    );
    await expectCode(
      setAttendance(
        scheduled.meetingId,
        fixture.units.a201.id,
        'proxy',
        'x'.repeat(121),
      ),
      '22023',
    );
    await expectCode(
      setAttendance(scheduled.meetingId, fixture.units.a201.id, 'self'),
      '22023',
    );
    await expectCode(
      setAttendance(scheduled.meetingId, fixture.units.a201.id, 'remote'),
      '22023',
    );
    await setAttendance(
      scheduled.meetingId,
      fixture.units.a201.id,
      'proxy',
      'Synthetic proxy holder',
    );
    await expectDomainError(
      setAttendance(scheduled.meetingId, fixture.inactiveUnitId, 'in_person'),
      'meeting_not_invited',
    );
    await expectCode(
      setAttendance(
        scheduled.meetingId,
        fixture.units.b101.id,
        'in_person',
        null,
        'committee',
      ),
      '42501',
    );

    const rows = await attendanceRows(scheduled.meetingId);
    expect(rows).toHaveLength(2);
    expect(
      rows.find((row) => row.unit_id === fixture.units.a101.id),
    ).toMatchObject({
      mode: 'online',
      proxy_name: null,
    });
    const view = await adminView(scheduled.meetingId);
    expect(
      records(view.attendance).find(
        (row) => row.attendeeId === fixture.units.a201.id,
      ),
    ).toMatchObject({
      label: 'A-201',
      mode: 'proxy',
      proxyName: 'Synthetic proxy holder',
    });

    expect(
      await removeAttendance(scheduled.meetingId, fixture.units.a201.id),
    ).toEqual({
      removed: true,
    });
    expect(
      await removeAttendance(scheduled.meetingId, fixture.units.a201.id),
    ).toEqual({
      removed: false,
    });
    expect(await attendanceRows(scheduled.meetingId)).toHaveLength(1);
  });

  it('opens check-in only from an hour before the start until the end, and closes any time', async () => {
    const scheduled = await createScheduledMeeting(fixture);
    await expectDomainError(
      setCheckin(scheduled.meetingId, true),
      'meeting_checkin_window',
    );
    expect(await setCheckin(scheduled.meetingId, false)).toEqual({
      meetingId: scheduled.meetingId,
      checkinOpen: false,
    });
    await moveMeetingTimes(fixture, scheduled.meetingId, 30);
    expect(await setCheckin(scheduled.meetingId, true)).toEqual({
      meetingId: scheduled.meetingId,
      checkinOpen: true,
    });
    expect(await setCheckin(scheduled.meetingId, true)).toMatchObject({
      checkinOpen: true,
    });
    await expectCode(
      callMeeting(fixture, 'committee', 'meeting_checkin_set', [
        fixture.societyId,
        scheduled.meetingId,
        false,
        requestId('checkin'),
      ]),
      '42501',
    );
    expect(await setCheckin(scheduled.meetingId, false)).toMatchObject({
      checkinOpen: false,
    });
    await moveMeetingTimes(fixture, scheduled.meetingId, -180, 60);
    await expectDomainError(
      setCheckin(scheduled.meetingId, true),
      'meeting_checkin_window',
    );

    const startsAt = await databaseTimestamp(fixture, "+ interval '1 day'");
    const committee = await createScheduledMeeting(fixture, {
      meetingType: 'committee',
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
    });
    await moveMeetingTimes(fixture, committee.meetingId, 30);
    const refused = await errorFor(setCheckin(committee.meetingId, true));
    expect(['P0001', '22023']).toContain(refused.code);
  });

  it('lets only owner or tenant occupants of invited units self check in while open', async () => {
    const scheduled = await startingSoon({
      invitees: {
        scope: 'custom',
        unitIds: [fixture.units.a101.id, fixture.units.a201.id],
      },
    });
    await expectDomainError(
      selfCheckin('owner', scheduled.meetingId, fixture.units.a101.id),
      'meeting_checkin_closed',
    );
    await setCheckin(scheduled.meetingId, true);

    await expectDomainError(
      selfCheckin('family', scheduled.meetingId, fixture.units.a101.id),
      'meeting_not_invited',
    );
    await expectDomainError(
      selfCheckin('owner2', scheduled.meetingId, fixture.units.a101.id),
      'meeting_not_invited',
    );
    // Callers who cannot see the meeting learn nothing about it, not even that it exists.
    await expectCode(
      selfCheckin('formerOwner', scheduled.meetingId, fixture.units.a101.id),
      'P0002',
    );
    await expectCode(
      selfCheckin('owner3', scheduled.meetingId, fixture.units.b101.id),
      'P0002',
    );
    await expectCode(
      selfCheckin('owner3', crypto.randomUUID(), fixture.units.b101.id),
      'P0002',
    );
    await expectCode(
      selfCheckin('guard', scheduled.meetingId, fixture.units.a101.id),
      '42501',
    );

    const first = await selfCheckin(
      'owner',
      scheduled.meetingId,
      fixture.units.a101.id,
    );
    expect(first).toEqual({
      meetingId: scheduled.meetingId,
      unitId: fixture.units.a101.id,
      present: true,
      alreadyPresent: false,
    });
    const second = await selfCheckin(
      'tenant',
      scheduled.meetingId,
      fixture.units.a101.id,
    );
    expect(second).toMatchObject({ present: true, alreadyPresent: true });
    const view = await adminView(scheduled.meetingId);
    expect(
      records(view.attendance).find(
        (row) => row.attendeeId === fixture.units.a101.id,
      ),
    ).toMatchObject({ mode: 'self', recordedByName: fixture.names.owner });

    await setAttendance(
      scheduled.meetingId,
      fixture.units.a201.id,
      'in_person',
    );
    expect(
      await selfCheckin('owner2', scheduled.meetingId, fixture.units.a201.id),
    ).toMatchObject({ present: true, alreadyPresent: true });
    const rows = await attendanceRows(scheduled.meetingId);
    expect(
      rows.find((row) => row.unit_id === fixture.units.a201.id)?.mode,
    ).toBe('in_person');

    const member = await callMeeting(fixture, 'tenant', 'meeting_member_get', [
      fixture.societyId,
      scheduled.meetingId,
    ]);
    expect(member.meeting).toMatchObject({ checkinOpen: true });
    expect(records(member.myUnits)).toEqual([
      expect.objectContaining({
        unitId: fixture.units.a101.id,
        label: 'A-101',
        present: true,
        mode: 'self',
      }),
    ]);
    const familyView = await callMeeting(
      fixture,
      'family',
      'meeting_member_get',
      [fixture.societyId, scheduled.meetingId],
    );
    expect(records(familyView.myUnits)[0]).toMatchObject({ canCheckIn: false });

    expect(
      await removeAttendance(scheduled.meetingId, fixture.units.a101.id),
    ).toEqual({
      removed: true,
    });
    await setCheckin(scheduled.meetingId, false);
    await expectDomainError(
      selfCheckin('owner', scheduled.meetingId, fixture.units.a101.id),
      'meeting_checkin_closed',
    );
  });

  it('creates exactly one attendance row under parallel self check-ins and admin marks', async () => {
    const scheduled = await startingSoon();
    await setCheckin(scheduled.meetingId, true);
    const results = await Promise.all([
      selfCheckin('owner', scheduled.meetingId, fixture.units.a101.id),
      selfCheckin('tenant', scheduled.meetingId, fixture.units.a101.id),
      selfCheckin('owner', scheduled.meetingId, fixture.units.a101.id),
      selfCheckin('tenant', scheduled.meetingId, fixture.units.a101.id),
    ]);
    expect(
      results.filter((result) => result.alreadyPresent === false),
    ).toHaveLength(1);
    const settled = await Promise.allSettled([
      selfCheckin('owner2', scheduled.meetingId, fixture.units.a201.id),
      setAttendance(scheduled.meetingId, fixture.units.a201.id, 'in_person'),
      selfCheckin('owner2', scheduled.meetingId, fixture.units.a201.id),
    ]);
    expect(settled.every((result) => result.status === 'fulfilled')).toBe(true);
    const rows = await attendanceRows(scheduled.meetingId);
    expect(
      rows.filter((row) => row.unit_id === fixture.units.a101.id),
    ).toHaveLength(1);
    expect(
      rows.filter((row) => row.unit_id === fixture.units.a201.id),
    ).toHaveLength(1);
  });

  it('closes check-in when the meeting is held and keeps admin corrections open until minutes publish', async () => {
    const scheduled = await startingSoon();
    await setCheckin(scheduled.meetingId, true);
    await moveMeetingTimes(fixture, scheduled.meetingId, -5);
    await callMeeting(fixture, 'admin', 'meeting_mark_held', [
      fixture.societyId,
      scheduled.meetingId,
      scheduled.version,
      requestId('held'),
    ]);
    const view = await adminView(scheduled.meetingId);
    expect(view.meeting).toMatchObject({ status: 'held', checkinOpen: false });
    await expectDomainError(
      selfCheckin('owner', scheduled.meetingId, fixture.units.a101.id),
      'meeting_checkin_closed',
    );
    const reopen = await errorFor(setCheckin(scheduled.meetingId, true));
    expect(reopen.code).toBe('P0001');

    await setAttendance(scheduled.meetingId, fixture.units.b101.id, 'online');
    await callMeeting(fixture, 'admin', 'meeting_minutes_save', [
      fixture.societyId,
      scheduled.meetingId,
      null,
      'Synthetic minutes body.',
      requestId('minutes'),
    ]);
    const minutes = (await adminView(scheduled.meetingId)).minutes as {
      version: number;
    };
    await callMeeting(fixture, 'admin', 'meeting_minutes_publish', [
      fixture.societyId,
      scheduled.meetingId,
      minutes.version,
      requestId('publish'),
    ]);
    await expectDomainError(
      setAttendance(scheduled.meetingId, fixture.units.a101.id, 'in_person'),
      'meeting_invalid_state',
    );
    await expectDomainError(
      removeAttendance(scheduled.meetingId, fixture.units.b101.id),
      'meeting_invalid_state',
    );
  });

  it('computes unit quorum from invited units using the snapshot percentage', async () => {
    const atDefault = await startingSoon();
    await setAttendance(
      atDefault.meetingId,
      fixture.units.a101.id,
      'in_person',
    );
    // 1 of 3 at 33%: 100 >= 99.
    expect((await adminView(atDefault.meetingId)).quorum).toEqual({
      invited: 3,
      present: 1,
      percent: 33,
      met: true,
    });

    await updateMeetingSettings(fixture, { quorum_percent_units: 50 });
    try {
      const scheduled = await startingSoon();
      await setAttendance(
        scheduled.meetingId,
        fixture.units.a101.id,
        'in_person',
      );
      expect((await adminView(scheduled.meetingId)).quorum).toEqual({
        invited: 3,
        present: 1,
        percent: 50,
        met: false,
      });
      await setAttendance(
        scheduled.meetingId,
        fixture.units.b101.id,
        'proxy',
        'Synthetic proxy',
      );
      const quorum = { invited: 3, present: 2, percent: 50, met: true };
      expect((await adminView(scheduled.meetingId)).quorum).toEqual(quorum);
      const member = await callMeeting(fixture, 'owner', 'meeting_member_get', [
        fixture.societyId,
        scheduled.meetingId,
      ]);
      expect(member.quorum).toEqual(quorum);
      const list = records(
        (
          await callMeeting(fixture, 'admin', 'meeting_admin_list', [
            fixture.societyId,
            'scheduled',
            100,
            0,
          ])
        ).items,
      );
      expect(
        list.find((item) => item.id === scheduled.meetingId),
      ).toMatchObject({
        invitedCount: 3,
        presentCount: 2,
        quorumPercent: 50,
        quorumMet: true,
      });
    } finally {
      await updateMeetingSettings(fixture, { quorum_percent_units: 33 });
    }
  });

  it('computes committee quorum from invited members and refuses non-invited members', async () => {
    const startsAt = await databaseTimestamp(fixture, "+ interval '1 day'");
    const scheduled = await createScheduledMeeting(fixture, {
      meetingType: 'committee',
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
    });
    await moveMeetingTimes(fixture, scheduled.meetingId, 30);
    expect(
      await setAttendance(
        scheduled.meetingId,
        fixture.memberships.committee,
        'online',
      ),
    ).toMatchObject({
      attendeeId: fixture.memberships.committee,
      mode: 'online',
    });
    await expectDomainError(
      setAttendance(
        scheduled.meetingId,
        fixture.memberships.owner,
        'in_person',
      ),
      'meeting_not_invited',
    );
    await expectDomainError(
      setAttendance(scheduled.meetingId, fixture.units.a101.id, 'in_person'),
      'meeting_not_invited',
    );
    const view = await adminView(scheduled.meetingId);
    // 1 of 2 at 50%: 100 >= 100.
    expect(view.quorum).toEqual({
      invited: 2,
      present: 1,
      percent: 50,
      met: true,
    });
    expect(records(view.attendance)[0]).toMatchObject({
      attendeeId: fixture.memberships.committee,
      label: fixture.names.committee,
      mode: 'online',
    });
    const rows = await attendanceRows(scheduled.meetingId);
    expect(rows).toEqual([
      expect.objectContaining({
        unit_id: null,
        membership_id: fixture.memberships.committee,
      }),
    ]);
  });
});
