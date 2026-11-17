// Verify event create/update/publish/cancel/delete, readiness, visibility, notifications and reminders.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  auditActionsFor,
  callEvent,
  callEventService,
  cancelEvent,
  createEvent,
  createEventFixture,
  createPublishedEvent,
  databaseTimestamp,
  eventInput,
  expectCode,
  expectDomainError,
  moveEventTimes,
  notifiedUsers,
  records,
  requestId,
  setModule,
  setRsvp,
  societyTomorrowNoon,
  sortedIds,
  updateEvent as updateStoredEvent,
  type EventActor,
  type EventFixture,
  type EventInput,
} from './support/event-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('event lifecycle database contracts', () => {
  let database: TestDatabase;
  let fixture: EventFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createEventFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  function users(...actors: EventActor[]): string[] {
    return sortedIds(actors.map((actor) => fixture.actors[actor]));
  }

  function allAudienceUsers(): string[] {
    return sortedIds([
      ...users('owner', 'tenant', 'family', 'owner2', 'multi', 'owner3'),
      ...fixture.bulk.map((resident) => resident.userId),
    ]);
  }

  function uniqueUsers(rows: { user_id: string }[]): string[] {
    return sortedIds([...new Set(rows.map((row) => row.user_id))]);
  }

  function adminList(filter: string | null, limit = 100, offset = 0) {
    return callEvent(fixture, 'admin', 'event_admin_list', [
      fixture.societyId,
      filter,
      limit,
      offset,
    ]);
  }

  function adminGet(eventId: string, actor: EventActor = 'admin') {
    return callEvent(fixture, actor, 'event_admin_get', [
      fixture.societyId,
      eventId,
    ]);
  }

  function memberGet(actor: EventActor, eventId: string) {
    return callEvent(fixture, actor, 'event_member_get', [
      fixture.societyId,
      eventId,
    ]);
  }

  async function memberListIds(actor: EventActor, filter = 'upcoming') {
    const list = await callEvent(fixture, actor, 'event_member_list', [
      fixture.societyId,
      filter,
    ]);
    return records(list.items).map((item) => item.id as string);
  }

  function updateEvent(
    eventId: string,
    overrides: Partial<EventInput>,
    request = requestId('update'),
    actor: EventActor = 'admin',
  ) {
    return updateStoredEvent(fixture, eventId, overrides, request, actor);
  }

  it('creates incomplete drafts idempotently and audits the write', async () => {
    const clientRequestId = crypto.randomUUID();
    const request = requestId('create');
    const input = await eventInput(fixture, {
      venue: null,
      description: null,
    });
    const first = await callEvent(fixture, 'admin', 'event_create', [
      fixture.societyId,
      clientRequestId,
      input,
      request,
    ]);
    expect(first).toEqual({ eventId: expect.any(String), version: 1 });
    const again = await callEvent(fixture, 'admin', 'event_create', [
      fixture.societyId,
      clientRequestId,
      input,
      requestId('create'),
    ]);
    expect(again.eventId).toBe(first.eventId);
    const stored = await database.asSuperuser((client) =>
      client.query<{ status: string; venue: string | null; count: string }>(
        `select status,venue,count(*) over ()::text as count from public.events
         where society_id=$1 and created_by=$2 and client_request_id=$3`,
        [fixture.societyId, fixture.actors.admin, clientRequestId],
      ),
    );
    expect(stored.rows).toEqual([{ status: 'draft', venue: null, count: '1' }]);
    const actions = await auditActionsFor(fixture, request);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((action) => action.startsWith('event.'))).toBe(true);
  });

  it('refuses unknown keys and bad lengths with 22023', async () => {
    const input = await eventInput(fixture);
    await expectCode(
      callEvent(fixture, 'admin', 'event_create', [
        fixture.societyId,
        crypto.randomUUID(),
        { ...input, surprise: true },
        requestId('create'),
      ]),
      '22023',
    );
    await expectCode(
      callEvent(fixture, 'admin', 'event_create', [
        fixture.societyId,
        crypto.randomUUID(),
        { ...input, title: 'x'.repeat(151) },
        requestId('create'),
      ]),
      '22023',
    );
    await expectCode(
      callEvent(fixture, 'admin', 'event_create', [
        fixture.societyId,
        crypto.randomUUID(),
        input,
        '',
      ]),
      '22023',
    );
  });

  it('lets committee manage events and refuses guards, supervisors, residents and outsiders', async () => {
    const created = await createEvent(fixture, {}, 'committee');
    const published = await callEvent(fixture, 'committee', 'event_publish', [
      fixture.societyId,
      created.eventId,
      created.version,
      requestId('publish'),
    ]);
    expect(published.eventId).toBe(created.eventId);
    const updated = await updateEvent(
      created.eventId,
      { title: 'Synthetic committee event' },
      requestId('update'),
      'committee',
    );
    expect(updated.eventId).toBe(created.eventId);
    expect((await adminGet(created.eventId, 'committee')).event).toMatchObject({
      title: 'Synthetic committee event',
    });
    const cancelled = await cancelEvent(
      fixture,
      created.eventId,
      'Synthetic committee cancel',
      requestId('cancel'),
      'committee',
    );
    expect(cancelled).toMatchObject({ eventId: created.eventId });

    const input = await eventInput(fixture);
    for (const actor of [
      'guard',
      'hkSupervisor',
      'owner',
      'outsider',
    ] as EventActor[]) {
      await expectCode(
        callEvent(fixture, actor, 'event_create', [
          fixture.societyId,
          crypto.randomUUID(),
          input,
          requestId('create'),
        ]),
        '42501',
      );
      await expectCode(
        callEvent(fixture, actor, 'event_admin_list', [
          fixture.societyId,
          'all',
          10,
          0,
        ]),
        '42501',
      );
      await expectCode(
        callEvent(fixture, actor, 'event_block_options', [fixture.societyId]),
        '42501',
      );
    }
    for (const actor of [
      'guard',
      'hkSupervisor',
      'admin',
      'outsider',
    ] as EventActor[]) {
      await expectCode(
        callEvent(fixture, actor, 'event_member_list', [
          fixture.societyId,
          'upcoming',
        ]),
        '42501',
      );
    }
  });

  it('reports every failed readiness key on publish', async () => {
    const past = await databaseTimestamp(fixture, "- interval '1 day'");
    const created = await createEvent(fixture, {
      venue: null,
      startsAt: past,
      rsvpDeadline: await databaseTimestamp(fixture, "- interval '2 days'"),
      audience: { scope: 'blocks', blockIds: [fixture.blocks.D] },
    });
    const failure = await expectDomainError(
      callEvent(fixture, 'admin', 'event_publish', [
        fixture.societyId,
        created.eventId,
        created.version,
        requestId('publish'),
      ]),
      'event_not_ready',
    );
    const keys = (failure.detail ?? '').split(',').map((key) => key.trim());
    expect(keys).toEqual(
      expect.arrayContaining([
        'venue_missing',
        'time_invalid',
        'deadline_invalid',
        'audience_empty',
      ]),
    );
    expect(keys).not.toContain('title_missing');
  });

  it('publishes to the chosen blocks, notifies their active occupants and bumps the version', async () => {
    const created = await createEvent(fixture, {
      audience: { scope: 'blocks', blockIds: [fixture.blocks.A] },
    });
    await expectCode(
      callEvent(fixture, 'admin', 'event_publish', [
        fixture.societyId,
        created.eventId,
        created.version + 5,
        requestId('publish'),
      ]),
      '40001',
    );
    const request = requestId('publish');
    const published = await callEvent(fixture, 'admin', 'event_publish', [
      fixture.societyId,
      created.eventId,
      created.version,
      request,
    ]);
    expect(published).toMatchObject({
      eventId: created.eventId,
      version: created.version + 1,
    });
    const rows = await notifiedUsers(fixture, request);
    expect(uniqueUsers(rows)).toEqual(
      users('owner', 'tenant', 'family', 'owner2', 'multi'),
    );
    expect(published.notified).toBe(uniqueUsers(rows).length);
    expect(
      rows.every(
        (row) =>
          row.entity_type === 'event' && row.entity_id === created.eventId,
      ),
    ).toBe(true);
    expect(
      (await auditActionsFor(fixture, request)).some((action) =>
        action.startsWith('event.'),
      ),
    ).toBe(true);
    await expectDomainError(
      callEvent(fixture, 'admin', 'event_publish', [
        fixture.societyId,
        created.eventId,
        published.version,
        requestId('publish'),
      ]),
      'event_invalid_state',
    );
  });

  it('publishes a whole-society event to every active occupant of every active unit only', async () => {
    const request = requestId('publish');
    await createPublishedEvent(fixture, {}, request);
    expect(uniqueUsers(await notifiedUsers(fixture, request))).toEqual(
      allAudienceUsers(),
    );
  });

  it('edits published events, notifying only on material changes and locking contribution', async () => {
    const published = await createPublishedEvent(fixture, {
      audience: { scope: 'blocks', blockIds: [fixture.blocks.B] },
      capacity: 10,
    });
    const quiet = await updateEvent(published.eventId, {
      audience: { scope: 'blocks', blockIds: [fixture.blocks.B] },
      title: 'Synthetic renamed event',
      capacity: 10,
    });
    expect(quiet).toMatchObject({
      eventId: published.eventId,
      version: published.version + 1,
      notified: false,
    });
    const request = requestId('update');
    const loud = await updateEvent(
      published.eventId,
      {
        audience: { scope: 'blocks', blockIds: [fixture.blocks.B] },
        venue: 'Synthetic terrace',
        capacity: 10,
      },
      request,
    );
    expect(loud.notified).toBe(true);
    expect(uniqueUsers(await notifiedUsers(fixture, request))).toEqual(
      users('owner3', 'multi'),
    );
    await expectCode(
      callEvent(fixture, 'admin', 'event_update', [
        fixture.societyId,
        published.eventId,
        published.version,
        await eventInput(fixture),
        requestId('update'),
      ]),
      '40001',
    );
    await expectDomainError(
      updateEvent(published.eventId, {
        audience: { scope: 'blocks', blockIds: [fixture.blocks.B] },
        contributionType: 'per_unit',
        contributionPaise: 50_000,
      }),
      'event_invalid_state',
    );
    await expectDomainError(
      updateEvent(published.eventId, {
        audience: { scope: 'blocks', blockIds: [fixture.blocks.B] },
        venue: null,
      }),
      'event_not_ready',
    );
    await setRsvp(
      fixture,
      'owner3',
      published.eventId,
      fixture.units.b101.id,
      'going',
      4,
      null,
    );
    await expectDomainError(
      updateEvent(published.eventId, {
        audience: { scope: 'blocks', blockIds: [fixture.blocks.B] },
        capacity: 3,
      }),
      'event_capacity_below_going',
    );
    const atGoing = await updateEvent(published.eventId, {
      audience: { scope: 'blocks', blockIds: [fixture.blocks.B] },
      capacity: 4,
    });
    expect(atGoing.eventId).toBe(published.eventId);
  });

  it('lets drafts change contribution and be deleted, but not published events', async () => {
    const draft = await createEvent(fixture);
    const updated = await updateEvent(draft.eventId, {
      contributionType: 'per_head',
      contributionPaise: 25_000,
    });
    expect(updated.version).toBe(draft.version + 1);
    await expectCode(
      callEvent(fixture, 'admin', 'event_draft_delete', [
        fixture.societyId,
        draft.eventId,
        draft.version,
        requestId('delete'),
      ]),
      '40001',
    );
    await expectDomainError(
      cancelEvent(fixture, draft.eventId),
      'event_invalid_state',
    );
    const deleted = await callEvent(fixture, 'admin', 'event_draft_delete', [
      fixture.societyId,
      draft.eventId,
      updated.version,
      requestId('delete'),
    ]);
    expect(deleted).toEqual({ deleted: true });
    await expectCode(adminGet(draft.eventId), 'P0002');

    const published = await createPublishedEvent(fixture);
    await expectDomainError(
      callEvent(fixture, 'admin', 'event_draft_delete', [
        fixture.societyId,
        published.eventId,
        published.version,
        requestId('delete'),
      ]),
      'event_invalid_state',
    );
  });

  it('cancels published events with a reason, notifying the audience but not withdrawn flats', async () => {
    const published = await createPublishedEvent(fixture);
    await setRsvp(
      fixture,
      'owner3',
      published.eventId,
      fixture.units.b101.id,
      'going',
      1,
      null,
    );
    await updateEvent(published.eventId, {
      audience: { scope: 'blocks', blockIds: [fixture.blocks.A] },
    });
    await expectCode(cancelEvent(fixture, published.eventId, ''), '22023');
    await expectCode(
      cancelEvent(fixture, published.eventId, 'x'.repeat(501)),
      '22023',
    );
    const request = requestId('cancel');
    const cancelled = await cancelEvent(
      fixture,
      published.eventId,
      'Synthetic rain forecast',
      request,
    );
    expect(cancelled).toMatchObject({
      eventId: published.eventId,
      refundedUnits: 0,
    });
    expect(uniqueUsers(await notifiedUsers(fixture, request))).toEqual(
      users('owner', 'tenant', 'family', 'owner2', 'multi'),
    );
    await expectDomainError(
      cancelEvent(fixture, published.eventId),
      'event_invalid_state',
    );
    await expectDomainError(
      updateEvent(published.eventId, {}),
      'event_invalid_state',
    );
    expect(await memberGet('owner', published.eventId)).toMatchObject({
      event: {
        status: 'cancelled',
        cancellationReason: 'Synthetic rain forecast',
      },
    });
  });

  it('refuses edits and cancellation once a published event has ended', async () => {
    const published = await createPublishedEvent(fixture);
    await moveEventTimes(fixture, published.eventId, -300, 60);
    await expectDomainError(
      updateEvent(published.eventId, {}),
      'event_invalid_state',
    );
    await expectDomainError(
      cancelEvent(fixture, published.eventId),
      'event_invalid_state',
    );
    const detail = await adminGet(published.eventId);
    expect(detail.event).toMatchObject({ past: true, status: 'published' });
  });

  it('shows residents only published or cancelled events of their audience units', async () => {
    const draft = await createEvent(fixture);
    const blockA = await createPublishedEvent(fixture, {
      audience: { scope: 'blocks', blockIds: [fixture.blocks.A] },
    });
    const everyone = await createPublishedEvent(fixture);

    await expectCode(memberGet('owner', draft.eventId), 'P0002');
    await expectCode(memberGet('owner3', blockA.eventId), 'P0002');
    await expectCode(memberGet('dormant', everyone.eventId), 'P0002');
    await expectCode(memberGet('unhoused', everyone.eventId), 'P0002');
    await expectCode(memberGet('formerOwner', everyone.eventId), 'P0002');
    expect((await memberGet('tenant', blockA.eventId)).event).toMatchObject({
      id: blockA.eventId,
    });

    const ownerIds = await memberListIds('owner');
    expect(ownerIds).toEqual(
      expect.arrayContaining([blockA.eventId, everyone.eventId]),
    );
    expect(ownerIds).not.toContain(draft.eventId);
    const owner3Ids = await memberListIds('owner3');
    expect(owner3Ids).toContain(everyone.eventId);
    expect(owner3Ids).not.toContain(blockA.eventId);
    expect(await memberListIds('dormant')).toEqual([]);

    await expectCode(
      callEvent(fixture, 'outsider', 'event_member_get', [
        fixture.societyId,
        everyone.eventId,
      ]),
      '42501',
    );
    await expectCode(
      callEvent(fixture, 'foreignAdmin', 'event_admin_get', [
        fixture.foreignSocietyId,
        everyone.eventId,
      ]),
      'P0002',
    );
  });

  it('lists events for managers by filter with totals and validates paging', async () => {
    const draft = await createEvent(fixture, { title: 'Synthetic list draft' });
    const soon = await createPublishedEvent(fixture, {
      startsAt: await databaseTimestamp(fixture, "+ interval '2 days'"),
    });
    const ended = await createPublishedEvent(fixture);
    await moveEventTimes(fixture, ended.eventId, -600, 60);
    const cancelled = await createPublishedEvent(fixture);
    await cancelEvent(fixture, cancelled.eventId);

    const ids = async (filter: string | null) =>
      records((await adminList(filter)).items).map((item) => item.id as string);
    const upcoming = await adminList(null);
    const upcomingItems = records(upcoming.items);
    const upcomingIds = upcomingItems.map((item) => item.id as string);
    expect(upcomingIds).toEqual(
      expect.arrayContaining([draft.eventId, soon.eventId]),
    );
    expect(upcomingIds).not.toContain(ended.eventId);
    expect(upcomingIds).not.toContain(cancelled.eventId);
    const starts = upcomingItems.map((item) =>
      Date.parse(item.startsAt as string),
    );
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(upcoming.total).toBeGreaterThanOrEqual(upcomingItems.length);
    expect(
      upcomingItems.find((item) => item.id === soon.eventId),
    ).toMatchObject({
      status: 'published',
      past: false,
      goingUnits: 0,
      goingHeadcount: 0,
      contributionType: 'none',
      contributionPaise: 0,
    });

    const past = await ids('past');
    expect(past).toContain(ended.eventId);
    expect(past).not.toContain(soon.eventId);
    const drafts = await ids('drafts');
    expect(drafts).toContain(draft.eventId);
    expect(drafts).not.toContain(soon.eventId);
    const cancelledIds = await ids('cancelled');
    expect(cancelledIds).toEqual(expect.arrayContaining([cancelled.eventId]));
    expect(cancelledIds).not.toContain(soon.eventId);
    const all = await adminList('all');
    expect(records(all.items).map((item) => item.id)).toEqual(
      expect.arrayContaining([
        draft.eventId,
        soon.eventId,
        ended.eventId,
        cancelled.eventId,
      ]),
    );
    const firstPage = await adminList('all', 1, 0);
    expect(records(firstPage.items)).toHaveLength(1);
    expect(firstPage.total).toBe(all.total);

    await expectCode(adminList('all', 0), '22023');
    await expectCode(adminList('all', 101), '22023');
    await expectCode(adminList('nonsense'), '22023');
  });

  it('offers only active blocks as audience options', async () => {
    const options = await callEvent(
      fixture,
      'committee',
      'event_block_options',
      [fixture.societyId],
    );
    const blocks = records(options.blocks);
    expect(sortedIds(blocks.map((block) => block.blockId as string))).toEqual(
      sortedIds([fixture.blocks.A, fixture.blocks.B, fixture.blocks.C]),
    );
    expect(blocks.find((block) => block.blockId === fixture.blocks.A)).toEqual({
      blockId: fixture.blocks.A,
      name: 'A',
    });
  });

  it('reminds going units of tomorrow\u2019s events exactly once, never withdrawn flats', async () => {
    const startsAt = await societyTomorrowNoon(fixture);
    const tomorrow = await createPublishedEvent(fixture, { startsAt });
    const later = await createPublishedEvent(fixture);
    const cancelledTomorrow = await createPublishedEvent(fixture, { startsAt });
    await setRsvp(
      fixture,
      'owner',
      tomorrow.eventId,
      fixture.units.a101.id,
      'going',
      2,
      null,
    );
    await setRsvp(
      fixture,
      'owner2',
      tomorrow.eventId,
      fixture.units.a201.id,
      'not_going',
      0,
      null,
    );
    await setRsvp(
      fixture,
      'owner',
      later.eventId,
      fixture.units.a101.id,
      'going',
      1,
      null,
    );
    await setRsvp(
      fixture,
      'owner3',
      cancelledTomorrow.eventId,
      fixture.units.b101.id,
      'going',
      1,
      null,
    );
    await cancelEvent(fixture, cancelledTomorrow.eventId);
    await setRsvp(
      fixture,
      'owner3',
      tomorrow.eventId,
      fixture.units.b101.id,
      'going',
      1,
      null,
    );
    await updateEvent(tomorrow.eventId, {
      audience: { scope: 'blocks', blockIds: [fixture.blocks.A] },
    });

    await expectCode(
      callEvent(fixture, 'admin', 'event_reminders_run', [
        fixture.societyId,
        requestId('reminders'),
      ]),
      '42501',
    );

    const request = requestId('reminders');
    const first = await callEventService(fixture, 'event_reminders_run', [
      fixture.societyId,
      request,
    ]);
    expect(first).toEqual({ events: 1, notified: 3 });
    const rows = await notifiedUsers(fixture, request);
    expect(uniqueUsers(rows)).toEqual(users('owner', 'tenant', 'family'));
    expect(rows.every((row) => row.entity_id === tomorrow.eventId)).toBe(true);
    const sent = await database.asSuperuser((client) =>
      client.query<{ id: string; reminder_sent_at: Date | null }>(
        'select id,reminder_sent_at from public.events where society_id=$1 and id = any($2::uuid[])',
        [fixture.societyId, [tomorrow.eventId, later.eventId]],
      ),
    );
    expect(
      sent.rows.find((row) => row.id === tomorrow.eventId)?.reminder_sent_at,
    ).not.toBeNull();
    expect(
      sent.rows.find((row) => row.id === later.eventId)?.reminder_sent_at,
    ).toBeNull();

    const second = await callEventService(fixture, 'event_reminders_run', [
      fixture.societyId,
      requestId('reminders'),
    ]);
    expect(second).toEqual({ events: 0, notified: 0 });
  });

  it('refuses every RPC and does no reminder work while the module is disabled', async () => {
    const published = await createPublishedEvent(fixture, {
      startsAt: await societyTomorrowNoon(fixture),
    });
    await setRsvp(
      fixture,
      'owner2',
      published.eventId,
      fixture.units.a201.id,
      'going',
      1,
      null,
    );
    await setModule(fixture, 'event', false);
    try {
      await expectCode(
        callEvent(fixture, 'admin', 'event_create', [
          fixture.societyId,
          crypto.randomUUID(),
          await eventInput(fixture),
          requestId('create'),
        ]),
        '42501',
      );
      await expectCode(adminList('all'), '42501');
      await expectCode(adminGet(published.eventId), '42501');
      await expectCode(
        callEvent(fixture, 'admin', 'event_block_options', [fixture.societyId]),
        '42501',
      );
      await expectCode(memberGet('owner2', published.eventId), '42501');
      await expectCode(
        callEvent(fixture, 'owner2', 'event_member_list', [
          fixture.societyId,
          'upcoming',
        ]),
        '42501',
      );
      await expectCode(
        setRsvp(
          fixture,
          'owner',
          published.eventId,
          fixture.units.a101.id,
          'going',
          1,
          null,
        ),
        '42501',
      );
      await expectCode(cancelEvent(fixture, published.eventId), '42501');
      expect(
        await callEventService(fixture, 'event_reminders_run', [
          fixture.societyId,
          requestId('reminders'),
        ]),
      ).toEqual({ events: 0, notified: 0 });
    } finally {
      await setModule(fixture, 'event', true);
    }
    const sent = await database.asSuperuser((client) =>
      client.query<{ reminder_sent_at: Date | null }>(
        'select reminder_sent_at from public.events where society_id=$1 and id=$2',
        [fixture.societyId, published.eventId],
      ),
    );
    expect(sent.rows[0]?.reminder_sent_at).toBeNull();
  });
});
