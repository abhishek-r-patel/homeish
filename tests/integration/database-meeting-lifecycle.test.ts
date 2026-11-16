// Verify meeting create/update/schedule/cancel/delete/held rules, invitees, notice, notifications and roles.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  auditActionsFor,
  callMeeting,
  createMeeting,
  createMeetingFixture,
  createScheduledMeeting,
  databaseTimestamp,
  errorFor,
  expectCode,
  expectDomainError,
  meetingInput,
  meetingVersion,
  moveMeetingTimes,
  notificationsFor,
  records,
  requestId,
  setModule,
  type MeetingActor,
  type MeetingFixture,
} from './support/meeting-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('meeting lifecycle database contracts', () => {
  let database: TestDatabase;
  let fixture: MeetingFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createMeetingFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  async function invitedUnits(meetingId: string): Promise<string[]> {
    const result = await database.asSuperuser((client) =>
      client.query<{ unit_id: string }>(
        `select unit_id from public.meeting_invited_units
         where society_id=$1 and meeting_id=$2 order by unit_id`,
        [fixture.societyId, meetingId],
      ),
    );
    return result.rows.map((row) => row.unit_id);
  }

  async function invitedMembers(meetingId: string): Promise<string[]> {
    const result = await database.asSuperuser((client) =>
      client.query<{ membership_id: string }>(
        `select membership_id from public.meeting_invited_members
         where society_id=$1 and meeting_id=$2 order by membership_id`,
        [fixture.societyId, meetingId],
      ),
    );
    return result.rows.map((row) => row.membership_id);
  }

  function sorted(values: string[]): string[] {
    return [...values].sort();
  }

  function users(...actors: MeetingActor[]): string[] {
    return sorted(actors.map((actor) => fixture.actors[actor]));
  }

  const unitOccupantRecipients: MeetingActor[] = [
    'owner',
    'tenant',
    'family',
    'owner2',
    'owner3',
  ];

  it('creates drafts idempotently, rejects unknown keys and long titles, and audits the write', async () => {
    const clientRequestId = crypto.randomUUID();
    const input = await meetingInput(fixture);
    const request = requestId('create');
    const first = await callMeeting(fixture, 'admin', 'meeting_create', [
      fixture.societyId,
      clientRequestId,
      input,
      request,
    ]);
    expect(first).toMatchObject({ version: 1 });
    expect(typeof first.meetingId).toBe('string');
    const again = await callMeeting(fixture, 'admin', 'meeting_create', [
      fixture.societyId,
      clientRequestId,
      input,
      requestId('create'),
    ]);
    expect(again.meetingId).toBe(first.meetingId);
    const count = await database.asSuperuser((client) =>
      client.query<{ count: number }>(
        `select count(*)::int as count from public.meetings
         where society_id=$1 and client_request_id=$2`,
        [fixture.societyId, clientRequestId],
      ),
    );
    expect(count.rows[0]?.count).toBe(1);
    expect(await auditActionsFor(fixture, request)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^meeting\./)]),
    );

    await expectCode(
      callMeeting(fixture, 'admin', 'meeting_create', [
        fixture.societyId,
        crypto.randomUUID(),
        { ...input, unexpected: true },
        requestId('create'),
      ]),
      '22023',
    );
    await expectCode(
      callMeeting(fixture, 'admin', 'meeting_create', [
        fixture.societyId,
        crypto.randomUUID(),
        { ...input, title: 'x'.repeat(151) },
        requestId('create'),
      ]),
      '22023',
    );
    await expectCode(
      callMeeting(fixture, 'admin', 'meeting_create', [
        fixture.societyId,
        crypto.randomUUID(),
        { ...input, meetingType: 'townhall' },
        requestId('create'),
      ]),
      '22023',
    );
  });

  it('refuses to schedule an incomplete draft and lists every readiness key', async () => {
    const draft = await createMeeting(fixture, {
      startsAt: await databaseTimestamp(fixture, "- interval '1 day'"),
      endsAt: await databaseTimestamp(fixture, "- interval '23 hours'"),
      venue: null,
      onlineUrl: null,
      agenda: [],
      invitees: { scope: 'custom', unitIds: [] },
    });
    const error = await errorFor(
      callMeeting(fixture, 'admin', 'meeting_schedule', [
        fixture.societyId,
        draft.meetingId,
        draft.version,
        requestId('schedule'),
      ]),
    );
    expect(error.code).toBe('P0001');
    expect(error.message).toContain('meeting_not_ready');
    const keys = (error.detail ?? '').split(',').map((key) => key.trim());
    expect(keys).toEqual(
      expect.arrayContaining([
        'time_invalid',
        'place_missing',
        'agenda_missing',
        'invitees_empty',
      ]),
    );
    expect(keys).not.toContain('title_missing');
    expect(await meetingVersion(fixture, draft.meetingId)).toBe(draft.version);
  });

  it('reports title_missing for an untitled draft', async () => {
    const draft = await createMeeting(fixture, { title: '' });
    const error = await errorFor(
      callMeeting(fixture, 'admin', 'meeting_schedule', [
        fixture.societyId,
        draft.meetingId,
        draft.version,
        requestId('schedule'),
      ]),
    );
    expect(error.code).toBe('P0001');
    expect(error.message).toContain('meeting_not_ready');
    expect((error.detail ?? '').split(',').map((key) => key.trim())).toEqual([
      'title_missing',
    ]);
  });

  it('schedules a default AGM: invites every active unit, snapshots notice and quorum, notifies occupants', async () => {
    const request = requestId('schedule');
    const scheduled = await createScheduledMeeting(fixture, {}, request);
    expect(scheduled.schedule).toMatchObject({
      meetingId: scheduled.meetingId,
      notice: { requiredDays: 14, short: false },
    });
    const notice = scheduled.schedule.notice as { givenDays: number };
    expect(notice.givenDays).toBeGreaterThanOrEqual(19);
    expect(notice.givenDays).toBeLessThanOrEqual(20);
    expect(await invitedUnits(scheduled.meetingId)).toEqual(
      sorted([
        fixture.units.a101.id,
        fixture.units.a201.id,
        fixture.units.b101.id,
      ]),
    );
    const labels = await database.asSuperuser((client) =>
      client.query<{ unit_label: string }>(
        `select unit_label from public.meeting_invited_units
         where society_id=$1 and meeting_id=$2 order by unit_label`,
        [fixture.societyId, scheduled.meetingId],
      ),
    );
    expect(labels.rows.map((row) => row.unit_label)).toEqual([
      'A-101',
      'A-201',
      'B-101',
    ]);
    const meeting = await database.asSuperuser((client) =>
      client.query<{
        status: string;
        quorum_percent: number;
        notice_required_days: number;
        notice_given_days: number;
        scheduled_at: string | null;
      }>(
        `select status,quorum_percent,notice_required_days,notice_given_days,scheduled_at
         from public.meetings where society_id=$1 and id=$2`,
        [fixture.societyId, scheduled.meetingId],
      ),
    );
    expect(meeting.rows[0]).toMatchObject({
      status: 'scheduled',
      quorum_percent: 33,
      notice_required_days: 14,
      notice_given_days: notice.givenDays,
    });
    expect(meeting.rows[0]?.scheduled_at).not.toBeNull();

    const notifications = await notificationsFor(fixture, request);
    expect(sorted(notifications.map((row) => row.user_id))).toEqual(
      users(...unitOccupantRecipients),
    );
    for (const row of notifications) {
      expect(row.entity_type).toBe('meeting');
      expect(row.entity_id).toBe(scheduled.meetingId);
    }
    expect(await auditActionsFor(fixture, request)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^meeting\./)]),
    );

    const admin = await callMeeting(fixture, 'admin', 'meeting_admin_get', [
      fixture.societyId,
      scheduled.meetingId,
    ]);
    expect(admin.quorum).toEqual({
      invited: 3,
      present: 0,
      percent: 33,
      met: false,
    });
    expect(
      records(admin.invited)
        .map((row) => row.label)
        .sort(),
    ).toEqual(['A-101', 'A-201', 'B-101']);
  });

  it('warns about short notice for an SGM without blocking it', async () => {
    const startsAt = await databaseTimestamp(fixture, "+ interval '2 days'");
    const scheduled = await createScheduledMeeting(fixture, {
      meetingType: 'sgm',
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
    });
    expect(scheduled.schedule.notice).toMatchObject({
      requiredDays: 7,
      short: true,
    });
    const given = (scheduled.schedule.notice as { givenDays: number })
      .givenDays;
    expect(given).toBeGreaterThanOrEqual(1);
    expect(given).toBeLessThanOrEqual(2);
  });

  it('schedules a committee meeting for active committee members only and notifies them as management', async () => {
    const request = requestId('schedule');
    const startsAt = await databaseTimestamp(fixture, "+ interval '1 day'");
    const scheduled = await createScheduledMeeting(
      fixture,
      {
        meetingType: 'committee',
        title: 'Synthetic committee meeting',
        startsAt,
        endsAt: new Date(
          new Date(startsAt).getTime() + 3_600_000,
        ).toISOString(),
        venue: null,
        onlineUrl: 'https://meet.example.test/committee',
      },
      request,
    );
    expect(scheduled.schedule.notice).toMatchObject({
      requiredDays: 3,
      short: true,
    });
    expect(await invitedMembers(scheduled.meetingId)).toEqual(
      sorted([fixture.memberships.committee, fixture.memberships.committee2]),
    );
    expect(await invitedUnits(scheduled.meetingId)).toEqual([]);
    const notifications = await notificationsFor(fixture, request);
    expect(sorted(notifications.map((row) => row.user_id))).toEqual(
      users('committee', 'committee2'),
    );
    expect(new Set(notifications.map((row) => row.entity_type))).toEqual(
      new Set(['meeting_admin']),
    );
    const quorum = (
      await callMeeting(fixture, 'admin', 'meeting_admin_get', [
        fixture.societyId,
        scheduled.meetingId,
      ])
    ).quorum;
    expect(quorum).toEqual({ invited: 2, present: 0, percent: 50, met: false });
    await expectCode(
      callMeeting(fixture, 'owner', 'meeting_member_get', [
        fixture.societyId,
        scheduled.meetingId,
      ]),
      'P0002',
    );
  });

  it('offers active units with block and floor plus active committee members as invitee options', async () => {
    const options = await callMeeting(
      fixture,
      'admin',
      'meeting_invitee_options',
      [fixture.societyId],
    );
    const units = records(options.units);
    expect(units.map((unit) => unit.unitId).sort()).toEqual(
      sorted([
        fixture.units.a101.id,
        fixture.units.a201.id,
        fixture.units.b101.id,
      ]),
    );
    expect(
      units.find((unit) => unit.unitId === fixture.units.a201.id),
    ).toMatchObject({
      label: 'A-201',
      blockId: fixture.blocks.A,
      blockName: 'A',
      floor: 2,
    });
    expect(
      records(options.members)
        .map((member) => member.membershipId)
        .sort(),
    ).toEqual(
      sorted([fixture.memberships.committee, fixture.memberships.committee2]),
    );
    await expectCode(
      callMeeting(fixture, 'committee', 'meeting_invitee_options', [
        fixture.societyId,
      ]),
      '42501',
    );
  });

  it('materialises a custom floor/block selection and re-materialises it on edit while scheduled', async () => {
    // Floor 1 across blocks: A-101 and B-101.
    const scheduled = await createScheduledMeeting(fixture, {
      invitees: {
        scope: 'custom',
        unitIds: [fixture.units.a101.id, fixture.units.b101.id],
      },
    });
    expect(await invitedUnits(scheduled.meetingId)).toEqual(
      sorted([fixture.units.a101.id, fixture.units.b101.id]),
    );
    const admin = await callMeeting(fixture, 'admin', 'meeting_admin_get', [
      fixture.societyId,
      scheduled.meetingId,
    ]);
    expect(admin.invitees).toMatchObject({ scope: 'custom' });
    expect(
      [...((admin.invitees as { unitIds: string[] }).unitIds ?? [])].sort(),
    ).toEqual(sorted([fixture.units.a101.id, fixture.units.b101.id]));
    await expectCode(
      callMeeting(fixture, 'owner2', 'meeting_member_get', [
        fixture.societyId,
        scheduled.meetingId,
      ]),
      'P0002',
    );

    // Block A only: A-101 and A-201.
    const request = requestId('update');
    const updated = await callMeeting(fixture, 'admin', 'meeting_update', [
      fixture.societyId,
      scheduled.meetingId,
      scheduled.version,
      await meetingInput(fixture, {
        startsAt: (
          await database.asSuperuser((client) =>
            client.query<{ starts_at: Date }>(
              'select starts_at from public.meetings where id=$1',
              [scheduled.meetingId],
            ),
          )
        ).rows[0]!.starts_at.toISOString(),
        invitees: {
          scope: 'custom',
          unitIds: [fixture.units.a101.id, fixture.units.a201.id],
        },
      }),
      request,
    ]);
    expect(updated.version).toBe(scheduled.version + 1);
    expect(updated.rescheduled).toBe(false);
    expect(await invitedUnits(scheduled.meetingId)).toEqual(
      sorted([fixture.units.a101.id, fixture.units.a201.id]),
    );
    const member = await callMeeting(fixture, 'owner2', 'meeting_member_get', [
      fixture.societyId,
      scheduled.meetingId,
    ]);
    expect(records(member.myUnits).map((unit) => unit.unitId)).toEqual([
      fixture.units.a201.id,
    ]);
  });

  it('audits attendance dropped when an invitee edit removes a unit', async () => {
    const scheduled = await createScheduledMeeting(fixture, {
      invitees: {
        scope: 'custom',
        unitIds: [fixture.units.a101.id, fixture.units.b101.id],
      },
    });
    await moveMeetingTimes(fixture, scheduled.meetingId, 30);
    await callMeeting(fixture, 'admin', 'meeting_attendance_set', [
      fixture.societyId,
      scheduled.meetingId,
      fixture.units.b101.id,
      'proxy',
      'Synthetic proxy',
      requestId('attendance'),
    ]);
    const current = await database.asSuperuser((client) =>
      client.query<{ starts_at: Date; ends_at: Date; version: number }>(
        'select starts_at,ends_at,version from public.meetings where id=$1',
        [scheduled.meetingId],
      ),
    );
    const request = requestId('update');
    await callMeeting(fixture, 'admin', 'meeting_update', [
      fixture.societyId,
      scheduled.meetingId,
      current.rows[0]!.version,
      await meetingInput(fixture, {
        startsAt: current.rows[0]!.starts_at.toISOString(),
        endsAt: current.rows[0]!.ends_at.toISOString(),
        invitees: { scope: 'custom', unitIds: [fixture.units.a101.id] },
      }),
      request,
    ]);
    const audit = await database.asSuperuser((client) =>
      client.query<{ action: string; after: Record<string, unknown> }>(
        `select action,"after" from public.audit_logs
         where request_id=$1 and action='meeting.attendance.remove'`,
        [request],
      ),
    );
    expect(audit.rows).toEqual([
      {
        action: 'meeting.attendance.remove',
        after: expect.objectContaining({
          attendeeId: fixture.units.b101.id,
          mode: 'proxy',
          proxyName: 'Synthetic proxy',
        }),
      },
    ]);
    const remaining = await database.asSuperuser((client) =>
      client.query(
        'select 1 from public.meeting_attendance where meeting_id=$1',
        [scheduled.meetingId],
      ),
    );
    expect(remaining.rowCount).toBe(0);
  });

  it('rejects custom units from another society', async () => {
    const error = await errorFor(
      callMeeting(fixture, 'admin', 'meeting_create', [
        fixture.societyId,
        crypto.randomUUID(),
        await meetingInput(fixture, {
          invitees: { scope: 'custom', unitIds: [fixture.foreignUnitId] },
        }),
        requestId('create'),
      ]),
    );
    expect(['22023', 'P0001', 'P0002']).toContain(error.code);
  });

  it('reschedules: refreshes the notice snapshot and notifies invitees only when time or place changes', async () => {
    const scheduled = await createScheduledMeeting(fixture);
    const original = await database.asSuperuser((client) =>
      client.query<{ starts_at: Date; ends_at: Date }>(
        'select starts_at,ends_at from public.meetings where id=$1',
        [scheduled.meetingId],
      ),
    );
    const same = {
      startsAt: original.rows[0]!.starts_at.toISOString(),
      endsAt: original.rows[0]!.ends_at.toISOString(),
    };
    const quiet = requestId('update');
    const descriptionOnly = await callMeeting(
      fixture,
      'admin',
      'meeting_update',
      [
        fixture.societyId,
        scheduled.meetingId,
        scheduled.version,
        await meetingInput(fixture, { ...same, description: 'Updated notes' }),
        quiet,
      ],
    );
    expect(descriptionOnly).toMatchObject({ rescheduled: false });
    expect(await notificationsFor(fixture, quiet)).toEqual([]);

    await expectCode(
      callMeeting(fixture, 'admin', 'meeting_update', [
        fixture.societyId,
        scheduled.meetingId,
        scheduled.version,
        await meetingInput(fixture, same),
        requestId('update'),
      ]),
      '40001',
    );

    const loud = requestId('update');
    const startsAt = await databaseTimestamp(fixture, "+ interval '30 days'");
    const moved = await callMeeting(fixture, 'admin', 'meeting_update', [
      fixture.societyId,
      scheduled.meetingId,
      descriptionOnly.version,
      await meetingInput(fixture, {
        startsAt,
        endsAt: new Date(
          new Date(startsAt).getTime() + 3_600_000,
        ).toISOString(),
        description: 'Updated notes',
      }),
      loud,
    ]);
    expect(moved).toMatchObject({
      rescheduled: true,
      notice: { requiredDays: 14, short: false },
    });
    const given = (moved.notice as { givenDays: number }).givenDays;
    expect(given).toBeGreaterThanOrEqual(29);
    expect(given).toBeLessThanOrEqual(30);
    const row = await database.asSuperuser((client) =>
      client.query<{
        rescheduled_at: string | null;
        notice_given_days: number;
      }>(
        'select rescheduled_at,notice_given_days from public.meetings where id=$1',
        [scheduled.meetingId],
      ),
    );
    expect(row.rows[0]?.rescheduled_at).not.toBeNull();
    expect(row.rows[0]?.notice_given_days).toBe(given);
    expect(
      sorted((await notificationsFor(fixture, loud)).map((n) => n.user_id)),
    ).toEqual(users(...unitOccupantRecipients));

    const venueRequest = requestId('update');
    const venueMoved = await callMeeting(fixture, 'admin', 'meeting_update', [
      fixture.societyId,
      scheduled.meetingId,
      moved.version,
      await meetingInput(fixture, {
        startsAt,
        endsAt: new Date(
          new Date(startsAt).getTime() + 3_600_000,
        ).toISOString(),
        description: 'Updated notes',
        venue: 'Terrace hall',
      }),
      venueRequest,
    ]);
    expect(venueMoved.rescheduled).toBe(true);
    expect((await notificationsFor(fixture, venueRequest)).length).toBe(
      unitOccupantRecipients.length,
    );

    const typeChange = await errorFor(
      callMeeting(fixture, 'admin', 'meeting_update', [
        fixture.societyId,
        scheduled.meetingId,
        venueMoved.version,
        await meetingInput(fixture, {
          meetingType: 'sgm',
          startsAt,
          endsAt: new Date(
            new Date(startsAt).getTime() + 3_600_000,
          ).toISOString(),
          description: 'Updated notes',
          venue: 'Terrace hall',
        }),
        requestId('update'),
      ]),
    );
    expect(['P0001', '22023']).toContain(typeChange.code);
  });

  it('cancels only scheduled meetings with a reason, notifies invitees and freezes the meeting', async () => {
    const draft = await createMeeting(fixture);
    await expectDomainError(
      callMeeting(fixture, 'admin', 'meeting_cancel', [
        fixture.societyId,
        draft.meetingId,
        draft.version,
        'Not needed',
        requestId('cancel'),
      ]),
      'meeting_invalid_state',
    );
    const scheduled = await createScheduledMeeting(fixture);
    await expectCode(
      callMeeting(fixture, 'admin', 'meeting_cancel', [
        fixture.societyId,
        scheduled.meetingId,
        scheduled.version,
        '  ',
        requestId('cancel'),
      ]),
      '22023',
    );
    const request = requestId('cancel');
    const cancelled = await callMeeting(fixture, 'admin', 'meeting_cancel', [
      fixture.societyId,
      scheduled.meetingId,
      scheduled.version,
      'Venue unavailable',
      request,
    ]);
    expect(cancelled).toMatchObject({ meetingId: scheduled.meetingId });
    expect(
      sorted((await notificationsFor(fixture, request)).map((n) => n.user_id)),
    ).toEqual(users(...unitOccupantRecipients));
    const member = await callMeeting(fixture, 'tenant', 'meeting_member_get', [
      fixture.societyId,
      scheduled.meetingId,
    ]);
    expect(member.meeting).toMatchObject({
      status: 'cancelled',
      cancellationReason: 'Venue unavailable',
    });
    const version = await meetingVersion(fixture, scheduled.meetingId);
    await expectDomainError(
      callMeeting(fixture, 'admin', 'meeting_update', [
        fixture.societyId,
        scheduled.meetingId,
        version,
        await meetingInput(fixture),
        requestId('update'),
      ]),
      'meeting_invalid_state',
    );
    await expectDomainError(
      callMeeting(fixture, 'admin', 'meeting_mark_held', [
        fixture.societyId,
        scheduled.meetingId,
        version,
        requestId('held'),
      ]),
      'meeting_invalid_state',
    );
  });

  it('deletes drafts only and hides them afterwards', async () => {
    const draft = await createMeeting(fixture);
    await expectCode(
      callMeeting(fixture, 'admin', 'meeting_draft_delete', [
        fixture.societyId,
        draft.meetingId,
        draft.version + 5,
        requestId('delete'),
      ]),
      '40001',
    );
    expect(
      await callMeeting(fixture, 'admin', 'meeting_draft_delete', [
        fixture.societyId,
        draft.meetingId,
        draft.version,
        requestId('delete'),
      ]),
    ).toEqual({ deleted: true });
    await expectCode(
      callMeeting(fixture, 'admin', 'meeting_admin_get', [
        fixture.societyId,
        draft.meetingId,
      ]),
      'P0002',
    );
    const scheduled = await createScheduledMeeting(fixture);
    await expectDomainError(
      callMeeting(fixture, 'admin', 'meeting_draft_delete', [
        fixture.societyId,
        scheduled.meetingId,
        scheduled.version,
        requestId('delete'),
      ]),
      'meeting_invalid_state',
    );

    // A draft never gets action items through the RPCs; a stray row blocks deletion instead of vanishing.
    const withAction = await createMeeting(fixture);
    const actionId = await database.asSuperuser(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `insert into public.meeting_action_items(
           society_id,meeting_id,title,owner_membership_id,owner_name,due_on,created_by,updated_by)
         values ($1,$2,'Stray action',$3,'Synthetic meeting owner',current_date+7,$4,$4)
         returning id`,
        [
          fixture.societyId,
          withAction.meetingId,
          fixture.memberships.owner,
          fixture.actors.admin,
        ],
      );
      return inserted.rows[0]!.id;
    });
    await expectDomainError(
      callMeeting(fixture, 'admin', 'meeting_draft_delete', [
        fixture.societyId,
        withAction.meetingId,
        withAction.version,
        requestId('delete'),
      ]),
      'meeting_invalid_state',
    );
    const kept = await database.asSuperuser((client) =>
      client.query('select 1 from public.meeting_action_items where id=$1', [
        actionId,
      ]),
    );
    expect(kept.rowCount).toBe(1);
  });

  it('marks a meeting held only after it starts, then freezes invitees and edits', async () => {
    const scheduled = await createScheduledMeeting(fixture);
    await expectDomainError(
      callMeeting(fixture, 'admin', 'meeting_mark_held', [
        fixture.societyId,
        scheduled.meetingId,
        scheduled.version,
        requestId('held'),
      ]),
      'meeting_invalid_state',
    );
    await moveMeetingTimes(fixture, scheduled.meetingId, -5);
    const held = await callMeeting(fixture, 'admin', 'meeting_mark_held', [
      fixture.societyId,
      scheduled.meetingId,
      scheduled.version,
      requestId('held'),
    ]);
    expect(held.meetingId).toBe(scheduled.meetingId);
    const row = await database.asSuperuser((client) =>
      client.query<{
        status: string;
        held_at: string | null;
        checkin_open: boolean;
      }>(
        'select status,held_at,checkin_open from public.meetings where id=$1',
        [scheduled.meetingId],
      ),
    );
    expect(row.rows[0]).toMatchObject({ status: 'held', checkin_open: false });
    expect(row.rows[0]?.held_at).not.toBeNull();
    await expectDomainError(
      callMeeting(fixture, 'admin', 'meeting_update', [
        fixture.societyId,
        scheduled.meetingId,
        held.version,
        await meetingInput(fixture, {
          invitees: { scope: 'custom', unitIds: [fixture.units.a101.id] },
        }),
        requestId('update'),
      ]),
      'meeting_invalid_state',
    );
    expect((await invitedUnits(scheduled.meetingId)).length).toBe(3);
    await expectDomainError(
      callMeeting(fixture, 'admin', 'meeting_cancel', [
        fixture.societyId,
        scheduled.meetingId,
        held.version,
        'Too late',
        requestId('cancel'),
      ]),
      'meeting_invalid_state',
    );
  });

  it('lists meetings for management and invited residents only', async () => {
    const draft = await createMeeting(fixture, { title: 'Hidden draft' });
    const scheduled = await createScheduledMeeting(fixture, {
      title: 'Visible AGM',
    });
    const list = await callMeeting(fixture, 'committee', 'meeting_admin_list', [
      fixture.societyId,
      null,
      100,
      0,
    ]);
    const items = records(list.items);
    expect(items.map((item) => item.id)).toEqual(
      expect.arrayContaining([draft.meetingId, scheduled.meetingId]),
    );
    expect(items.find((item) => item.id === scheduled.meetingId)).toMatchObject(
      {
        status: 'scheduled',
        invitedCount: 3,
        presentCount: 0,
        quorumPercent: 33,
        quorumMet: false,
        minutesStatus: 'none',
      },
    );
    const startsDescending = items.map((item) =>
      new Date(String(item.startsAt)).getTime(),
    );
    expect(startsDescending).toEqual(
      [...startsDescending].sort((left, right) => right - left),
    );
    const drafts = records(
      (
        await callMeeting(fixture, 'admin', 'meeting_admin_list', [
          fixture.societyId,
          'draft',
          100,
          0,
        ])
      ).items,
    );
    expect(drafts.every((item) => item.status === 'draft')).toBe(true);
    await expectCode(
      callMeeting(fixture, 'admin', 'meeting_admin_list', [
        fixture.societyId,
        null,
        0,
        0,
      ]),
      '22023',
    );

    const resident = await callMeeting(
      fixture,
      'family',
      'meeting_member_list',
      [fixture.societyId],
    );
    const ids = records(resident.meetings).map((meeting) => meeting.id);
    expect(ids).toContain(scheduled.meetingId);
    expect(ids).not.toContain(draft.meetingId);
    await expectCode(
      callMeeting(fixture, 'owner', 'meeting_member_get', [
        fixture.societyId,
        draft.meetingId,
      ]),
      'P0002',
    );
    const committeeMeetings = records(
      (
        await callMeeting(fixture, 'admin', 'meeting_admin_list', [
          fixture.societyId,
          null,
          100,
          0,
        ])
      ).items,
    ).filter((item) => item.meetingType === 'committee');
    for (const meeting of committeeMeetings) {
      expect(ids).not.toContain(meeting.id);
    }
    const resident2 = await callMeeting(
      fixture,
      'resident',
      'meeting_member_list',
      [fixture.societyId],
    );
    expect(records(resident2.meetings)).toEqual([]);
  });

  it('enforces the role matrix for guards, supervisors, outsiders, residents and committee', async () => {
    const scheduled = await createScheduledMeeting(fixture);
    const input = await meetingInput(fixture);
    for (const actor of ['guard', 'hkSupervisor', 'outsider'] as const) {
      await expectCode(
        callMeeting(fixture, actor, 'meeting_admin_list', [
          fixture.societyId,
          null,
          10,
          0,
        ]),
        '42501',
      );
      await expectCode(
        callMeeting(fixture, actor, 'meeting_member_list', [fixture.societyId]),
        '42501',
      );
      await expectCode(
        callMeeting(fixture, actor, 'meeting_member_get', [
          fixture.societyId,
          scheduled.meetingId,
        ]),
        '42501',
      );
      await expectCode(
        callMeeting(fixture, actor, 'meeting_create', [
          fixture.societyId,
          crypto.randomUUID(),
          input,
          requestId('create'),
        ]),
        '42501',
      );
      await expectCode(
        callMeeting(fixture, actor, 'meeting_settings_get', [
          fixture.societyId,
        ]),
        '42501',
      );
    }
    for (const actor of ['owner', 'resident'] as const) {
      await expectCode(
        callMeeting(fixture, actor, 'meeting_admin_list', [
          fixture.societyId,
          null,
          10,
          0,
        ]),
        '42501',
      );
      await expectCode(
        callMeeting(fixture, actor, 'meeting_admin_get', [
          fixture.societyId,
          scheduled.meetingId,
        ]),
        '42501',
      );
      await expectCode(
        callMeeting(fixture, actor, 'meeting_create', [
          fixture.societyId,
          crypto.randomUUID(),
          input,
          requestId('create'),
        ]),
        '42501',
      );
    }
    const committeeView = await callMeeting(
      fixture,
      'committee',
      'meeting_admin_get',
      [fixture.societyId, scheduled.meetingId],
    );
    expect(committeeView.meeting).toMatchObject({ id: scheduled.meetingId });
    await callMeeting(fixture, 'committee', 'meeting_settings_get', [
      fixture.societyId,
    ]);
    await expectCode(
      callMeeting(fixture, 'committee', 'meeting_create', [
        fixture.societyId,
        crypto.randomUUID(),
        input,
        requestId('create'),
      ]),
      '42501',
    );
    await expectCode(
      callMeeting(fixture, 'committee', 'meeting_cancel', [
        fixture.societyId,
        scheduled.meetingId,
        scheduled.version,
        'Committee cannot cancel',
        requestId('cancel'),
      ]),
      '42501',
    );
    await expectCode(
      callMeeting(fixture, 'committee', 'meeting_settings_update', [
        fixture.societyId,
        { notice_days_agm: 10 },
        requestId('settings'),
      ]),
      '42501',
    );
    await expectCode(
      callMeeting(fixture, 'foreignAdmin', 'meeting_admin_get', [
        fixture.foreignSocietyId,
        scheduled.meetingId,
      ]),
      'P0002',
    );
    await expectCode(
      callMeeting(fixture, 'foreignAdmin', 'meeting_admin_get', [
        fixture.societyId,
        scheduled.meetingId,
      ]),
      '42501',
    );
  });

  it('validates settings, returns defaults and snapshots the quorum percentage at scheduling', async () => {
    const defaults = await callMeeting(
      fixture,
      'admin',
      'meeting_settings_get',
      [fixture.societyId],
    );
    expect(Object.keys(defaults).length).toBeGreaterThan(0);
    await expectCode(
      callMeeting(fixture, 'admin', 'meeting_settings_update', [
        fixture.societyId,
        { notice_days_agm: 91 },
        requestId('settings'),
      ]),
      '22023',
    );
    await expectCode(
      callMeeting(fixture, 'admin', 'meeting_settings_update', [
        fixture.societyId,
        { unknown_key: 1 },
        requestId('settings'),
      ]),
      '22023',
    );
    await callMeeting(fixture, 'admin', 'meeting_settings_update', [
      fixture.societyId,
      { quorum_percent_units: 60, notice_days_agm: 25 },
      requestId('settings'),
    ]);
    try {
      const scheduled = await createScheduledMeeting(fixture);
      expect(scheduled.schedule.notice).toMatchObject({
        requiredDays: 25,
        short: true,
      });
      await callMeeting(fixture, 'admin', 'meeting_settings_update', [
        fixture.societyId,
        { quorum_percent_units: 10 },
        requestId('settings'),
      ]);
      const view = await callMeeting(fixture, 'admin', 'meeting_admin_get', [
        fixture.societyId,
        scheduled.meetingId,
      ]);
      expect((view.quorum as { percent: number }).percent).toBe(60);
    } finally {
      await callMeeting(fixture, 'admin', 'meeting_settings_update', [
        fixture.societyId,
        { quorum_percent_units: 33, notice_days_agm: 14 },
        requestId('settings'),
      ]);
    }
  });

  it('refuses every read and write while the module is disabled', async () => {
    const scheduled = await createScheduledMeeting(fixture);
    await setModule(fixture, 'meeting', false);
    try {
      await expectCode(
        callMeeting(fixture, 'admin', 'meeting_admin_list', [
          fixture.societyId,
          null,
          10,
          0,
        ]),
        '42501',
      );
      await expectCode(
        callMeeting(fixture, 'owner', 'meeting_member_get', [
          fixture.societyId,
          scheduled.meetingId,
        ]),
        '42501',
      );
      await expectCode(
        callMeeting(fixture, 'admin', 'meeting_cancel', [
          fixture.societyId,
          scheduled.meetingId,
          scheduled.version,
          'Disabled',
          requestId('cancel'),
        ]),
        '42501',
      );
    } finally {
      await setModule(fixture, 'meeting', true);
    }
  });
});
