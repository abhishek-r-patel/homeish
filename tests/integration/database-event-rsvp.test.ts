// Verify RSVP rules: occupants, audience, versions, limits, deadlines, parallel capacity and reads.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  callEvent,
  cancelEvent,
  createEvent,
  createEventFixture,
  createPublishedEvent,
  databaseTimestamp,
  expectCode,
  expectDomainError,
  moveEventTimes,
  passEventDeadline,
  records,
  requestId,
  rsvpRow,
  setRsvp,
  setRsvpAs,
  updateEvent,
  type EventActor,
  type EventFixture,
} from './support/event-fixtures';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('event RSVP database contracts', () => {
  let database: TestDatabase;
  let fixture: EventFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createEventFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  function memberGet(actor: EventActor, eventId: string) {
    return callEvent(fixture, actor, 'event_member_get', [
      fixture.societyId,
      eventId,
    ]);
  }

  async function goingHeadcount(eventId: string): Promise<number> {
    const result = await database.asSuperuser((client) =>
      client.query<{ total: string | null }>(
        `select sum(headcount)::text as total from public.event_rsvps
         where society_id=$1 and event_id=$2 and status='going'`,
        [fixture.societyId, eventId],
      ),
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  it('lets any active occupant set and change the unit RSVP with optimistic versions', async () => {
    const published = await createPublishedEvent(fixture);
    const first = await setRsvp(
      fixture,
      'owner',
      published.eventId,
      fixture.units.a101.id,
      'going',
      2,
      null,
    );
    expect(first).toMatchObject({
      rsvpId: expect.any(String),
      status: 'going',
      headcount: 2,
      version: 1,
      chargedPaise: 0,
    });
    await expectCode(
      setRsvp(
        fixture,
        'tenant',
        published.eventId,
        fixture.units.a101.id,
        'going',
        3,
        null,
      ),
      '40001',
    );
    await expectCode(
      setRsvp(
        fixture,
        'tenant',
        published.eventId,
        fixture.units.a101.id,
        'going',
        3,
        5,
      ),
      '40001',
    );
    const changed = await setRsvp(
      fixture,
      'tenant',
      published.eventId,
      fixture.units.a101.id,
      'going',
      3,
      1,
    );
    expect(changed).toMatchObject({
      rsvpId: first.rsvpId,
      headcount: 3,
      version: 2,
    });
    const same = await setRsvp(
      fixture,
      'family',
      published.eventId,
      fixture.units.a101.id,
      'going',
      3,
      2,
    );
    expect(same).toMatchObject({ rsvpId: first.rsvpId, version: 2 });
    const withdrawn = await setRsvp(
      fixture,
      'family',
      published.eventId,
      fixture.units.a101.id,
      'not_going',
      0,
      2,
    );
    expect(withdrawn).toMatchObject({
      status: 'not_going',
      headcount: 0,
      version: 3,
    });
    const row = await rsvpRow(
      fixture,
      published.eventId,
      fixture.units.a101.id,
    );
    expect(row).toMatchObject({
      status: 'not_going',
      headcount: 0,
      version: 3,
    });
  });

  it('refuses non-occupants, former occupants and non-resident roles', async () => {
    const published = await createPublishedEvent(fixture);
    await expectDomainError(
      setRsvp(
        fixture,
        'owner2',
        published.eventId,
        fixture.units.a101.id,
        'going',
        1,
        null,
      ),
      'event_not_in_audience',
    );
    await expectCode(
      setRsvp(
        fixture,
        'formerOwner',
        published.eventId,
        fixture.units.a101.id,
        'going',
        1,
        null,
      ),
      'P0002',
    );
    for (const actor of [
      'admin',
      'committee',
      'guard',
      'outsider',
    ] as EventActor[]) {
      await expectCode(
        setRsvp(
          fixture,
          actor,
          published.eventId,
          fixture.units.a101.id,
          'going',
          1,
          null,
        ),
        '42501',
      );
    }
    expect(
      await rsvpRow(fixture, published.eventId, fixture.units.a101.id),
    ).toBeUndefined();
  });

  it('validates status and headcount shape and the per-unit limit', async () => {
    const published = await createPublishedEvent(fixture, { maxPerUnit: 3 });
    const attempt = (status: string, headcount: number) =>
      callEvent(fixture, 'owner2', 'event_rsvp_set', [
        fixture.societyId,
        published.eventId,
        fixture.units.a201.id,
        status,
        headcount,
        null,
        requestId('rsvp'),
      ]);
    await expectCode(attempt('maybe', 1), '22023');
    await expectCode(attempt('going', 0), '22023');
    await expectCode(attempt('going', 101), '22023');
    await expectCode(attempt('not_going', 2), '22023');
    await expectDomainError(attempt('going', 4), 'event_headcount_limit');
    expect(await attempt('going', 3)).toMatchObject({ headcount: 3 });
  });

  it('enforces capacity, including the remaining spots after other units', async () => {
    const published = await createPublishedEvent(fixture, { capacity: 5 });
    await setRsvp(
      fixture,
      'owner',
      published.eventId,
      fixture.units.a101.id,
      'going',
      3,
      null,
    );
    await expectDomainError(
      setRsvp(
        fixture,
        'owner2',
        published.eventId,
        fixture.units.a201.id,
        'going',
        3,
        null,
      ),
      'event_full',
    );
    expect(
      await rsvpRow(fixture, published.eventId, fixture.units.a201.id),
    ).toBeUndefined();
    const fits = await setRsvp(
      fixture,
      'owner2',
      published.eventId,
      fixture.units.a201.id,
      'going',
      2,
      null,
    );
    expect(await memberGet('owner2', published.eventId)).toMatchObject({
      spotsLeft: 0,
      goingHeadcount: 5,
    });
    // Lowering one's own headcount and declining always fit.
    await setRsvp(
      fixture,
      'owner2',
      published.eventId,
      fixture.units.a201.id,
      'going',
      1,
      fits.version as number,
    );
    expect(await goingHeadcount(published.eventId)).toBe(4);
  });

  it('never overbooks under 10 parallel RSVPs', async () => {
    const published = await createPublishedEvent(fixture, { capacity: 7 });
    const results = await Promise.allSettled(
      fixture.bulk.map((resident) =>
        setRsvpAs(
          fixture,
          resident.userId,
          published.eventId,
          resident.unitId,
          'going',
          1,
          null,
        ),
      ),
    );
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(7);
    expect(rejected).toHaveLength(3);
    for (const failure of rejected) {
      const error = failure.reason as { code?: string; message?: string };
      expect(error.code).toBe('P0001');
      expect(error.message).toContain('event_full');
    }
    expect(await goingHeadcount(published.eventId)).toBe(7);

    const pairs = await createPublishedEvent(fixture, { capacity: 9 });
    const pairResults = await Promise.allSettled(
      fixture.bulk.map((resident) =>
        setRsvpAs(
          fixture,
          resident.userId,
          pairs.eventId,
          resident.unitId,
          'going',
          2,
          null,
        ),
      ),
    );
    expect(
      pairResults.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(4);
    expect(await goingHeadcount(pairs.eventId)).toBe(8);
  });

  it('closes RSVPs after the deadline, at the start, for drafts and for cancelled events', async () => {
    const withDeadline = await createPublishedEvent(fixture, {
      rsvpDeadline: await databaseTimestamp(fixture, "+ interval '5 days'"),
    });
    const going = await setRsvp(
      fixture,
      'owner',
      withDeadline.eventId,
      fixture.units.a101.id,
      'going',
      1,
      null,
    );
    await passEventDeadline(fixture, withDeadline.eventId);
    await expectDomainError(
      setRsvp(
        fixture,
        'owner',
        withDeadline.eventId,
        fixture.units.a101.id,
        'not_going',
        0,
        going.version as number,
      ),
      'event_rsvp_closed',
    );
    await expectDomainError(
      setRsvp(
        fixture,
        'owner2',
        withDeadline.eventId,
        fixture.units.a201.id,
        'going',
        1,
        null,
      ),
      'event_rsvp_closed',
    );
    expect(await memberGet('owner', withDeadline.eventId)).toMatchObject({
      event: { rsvpOpen: false },
    });

    const started = await createPublishedEvent(fixture);
    await moveEventTimes(fixture, started.eventId, -10, 120);
    await expectDomainError(
      setRsvp(
        fixture,
        'owner',
        started.eventId,
        fixture.units.a101.id,
        'going',
        1,
        null,
      ),
      'event_rsvp_closed',
    );

    const draft = await createEvent(fixture);
    await expectCode(
      setRsvp(
        fixture,
        'owner',
        draft.eventId,
        fixture.units.a101.id,
        'going',
        1,
        null,
      ),
      'P0002',
    );

    const cancelled = await createPublishedEvent(fixture);
    await cancelEvent(fixture, cancelled.eventId);
    await expectDomainError(
      setRsvp(
        fixture,
        'owner',
        cancelled.eventId,
        fixture.units.a101.id,
        'going',
        1,
        null,
      ),
      'event_rsvp_closed',
    );
  });

  it('limits RSVPs to audience blocks and withdraws RSVPs of units dropped by a narrowed audience', async () => {
    const blockA = await createPublishedEvent(fixture, {
      audience: { scope: 'blocks', blockIds: [fixture.blocks.A] },
    });
    await expectDomainError(
      setRsvp(
        fixture,
        'multi',
        blockA.eventId,
        fixture.units.b101.id,
        'going',
        1,
        null,
      ),
      'event_not_in_audience',
    );
    await expectCode(
      setRsvp(
        fixture,
        'owner3',
        blockA.eventId,
        fixture.units.b101.id,
        'going',
        1,
        null,
      ),
      'P0002',
    );
    expect(
      await setRsvp(
        fixture,
        'multi',
        blockA.eventId,
        fixture.units.a201.id,
        'going',
        1,
        null,
      ),
    ).toMatchObject({ status: 'going' });

    const everyone = await createPublishedEvent(fixture);
    await setRsvp(
      fixture,
      'multi',
      everyone.eventId,
      fixture.units.b101.id,
      'going',
      2,
      null,
    );
    const aGoing = await setRsvp(
      fixture,
      'owner',
      everyone.eventId,
      fixture.units.a101.id,
      'going',
      1,
      null,
    );
    await setRsvp(
      fixture,
      'multi',
      everyone.eventId,
      fixture.units.a201.id,
      'not_going',
      0,
      null,
    );
    const listBefore = await callEvent(fixture, 'multi', 'event_member_list', [
      fixture.societyId,
      'upcoming',
    ]);
    expect(
      records(listBefore.items).find((item) => item.id === everyone.eventId)
        ?.myRsvps,
    ).toEqual([
      {
        unitId: fixture.units.a201.id,
        label: 'A-201',
        status: 'not_going',
        headcount: 0,
      },
      {
        unitId: fixture.units.b101.id,
        label: 'B-101',
        status: 'going',
        headcount: 2,
      },
    ]);
    const narrowed = await updateEvent(fixture, everyone.eventId, {
      audience: { scope: 'blocks', blockIds: [fixture.blocks.A] },
    });
    expect(narrowed).toMatchObject({ withdrawnUnits: 1, refundedUnits: 0 });
    expect(
      await rsvpRow(fixture, everyone.eventId, fixture.units.b101.id),
    ).toMatchObject({ status: 'not_going', headcount: 0, version: 2 });
    expect(
      await rsvpRow(fixture, everyone.eventId, fixture.units.a101.id),
    ).toMatchObject({ status: 'going', headcount: 1, version: aGoing.version });
    await expectCode(
      setRsvp(
        fixture,
        'owner3',
        everyone.eventId,
        fixture.units.b101.id,
        'going',
        1,
        null,
      ),
      'P0002',
    );
    await expectCode(memberGet('owner3', everyone.eventId), 'P0002');
    const ownerList = await callEvent(fixture, 'owner3', 'event_member_list', [
      fixture.societyId,
      'upcoming',
    ]);
    expect(records(ownerList.items).map((item) => item.id)).not.toContain(
      everyone.eventId,
    );
    await expectDomainError(
      setRsvp(
        fixture,
        'multi',
        everyone.eventId,
        fixture.units.b101.id,
        'going',
        1,
        null,
      ),
      'event_not_in_audience',
    );
    const multiView = await memberGet('multi', everyone.eventId);
    expect(records(multiView.myUnits).map((unit) => unit.unitId)).toEqual([
      fixture.units.a201.id,
    ]);
    const again = await updateEvent(fixture, everyone.eventId, {
      title: 'Synthetic re-saved event',
    });
    expect(again).toMatchObject({ withdrawnUnits: 0, refundedUnits: 0 });
    expect(
      await rsvpRow(fixture, everyone.eventId, fixture.units.b101.id),
    ).toMatchObject({ status: 'not_going', version: 2 });
  });

  it('shows residents their own units only, with spots left and RSVP state', async () => {
    const published = await createPublishedEvent(fixture, {
      capacity: 20,
      maxPerUnit: 4,
    });
    const multiRsvp = await setRsvp(
      fixture,
      'multi',
      published.eventId,
      fixture.units.b101.id,
      'going',
      3,
      null,
    );
    await setRsvp(
      fixture,
      'owner',
      published.eventId,
      fixture.units.a101.id,
      'going',
      2,
      null,
    );
    const view = await memberGet('multi', published.eventId);
    expect(view).toMatchObject({
      spotsLeft: 15,
      goingHeadcount: 5,
      billingEnabled: true,
      event: {
        id: published.eventId,
        status: 'published',
        capacity: 20,
        maxPerUnit: 4,
        rsvpOpen: true,
        past: false,
      },
    });
    const myUnits = records(view.myUnits);
    expect(myUnits.map((unit) => unit.unitId)).toEqual([
      fixture.units.a201.id,
      fixture.units.b101.id,
    ]);
    expect(myUnits[0]).toMatchObject({
      label: 'A-201',
      rsvp: null,
      canRsvp: true,
    });
    expect(myUnits[1]).toMatchObject({
      label: 'B-101',
      canRsvp: true,
      rsvp: {
        rsvpId: multiRsvp.rsvpId,
        status: 'going',
        headcount: 3,
        version: 1,
        netChargePaise: 0,
      },
    });
    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain(fixture.units.a101.id);
    expect(serialised).not.toContain(fixture.names.owner);
    expect(serialised).not.toContain('@example.test');

    const list = await callEvent(fixture, 'multi', 'event_member_list', [
      fixture.societyId,
      'upcoming',
    ]);
    const item = records(list.items).find(
      (entry) => entry.id === published.eventId,
    );
    expect(item).toMatchObject({
      status: 'published',
      past: false,
    });
    const listForOwner = await callEvent(
      fixture,
      'owner',
      'event_member_list',
      [fixture.societyId, null],
    );
    expect(
      records(listForOwner.items).find(
        (entry) => entry.id === published.eventId,
      ),
    ).toMatchObject({
      myRsvps: [
        {
          unitId: fixture.units.a101.id,
          label: 'A-101',
          status: 'going',
          headcount: 2,
        },
      ],
    });
    expect(JSON.stringify(listForOwner)).not.toContain('@example.test');
  });

  it('gives managers totals and the RSVP table ordered by unit label', async () => {
    const published = await createPublishedEvent(fixture, { capacity: 30 });
    await setRsvp(
      fixture,
      'owner3',
      published.eventId,
      fixture.units.b101.id,
      'going',
      2,
      null,
    );
    await setRsvp(
      fixture,
      'tenant',
      published.eventId,
      fixture.units.a101.id,
      'going',
      4,
      null,
    );
    await setRsvp(
      fixture,
      'owner2',
      published.eventId,
      fixture.units.a201.id,
      'not_going',
      0,
      null,
    );
    const detail = await callEvent(fixture, 'committee', 'event_admin_get', [
      fixture.societyId,
      published.eventId,
    ]);
    expect(detail.totals).toEqual({
      goingUnits: 2,
      goingHeadcount: 6,
      notGoingUnits: 1,
      audienceUnits: 3 + fixture.bulk.length,
      collectedPaise: 0,
    });
    const rsvps = records(detail.rsvps);
    expect(rsvps.map((rsvp) => rsvp.unitLabel)).toEqual([
      'A-101',
      'A-201',
      'B-101',
    ]);
    expect(rsvps[0]).toMatchObject({
      unitId: fixture.units.a101.id,
      status: 'going',
      headcount: 4,
      respondedByName: fixture.names.tenant,
      netChargePaise: 0,
    });
    expect(JSON.stringify(detail)).not.toContain('@example.test');
    expect(detail.event).toMatchObject({
      id: published.eventId,
      status: 'published',
      capacity: 30,
      audience: { scope: 'all' },
      past: false,
    });

    const list = await callEvent(fixture, 'admin', 'event_admin_list', [
      fixture.societyId,
      'upcoming',
      100,
      0,
    ]);
    expect(
      records(list.items).find((item) => item.id === published.eventId),
    ).toMatchObject({ goingUnits: 2, goingHeadcount: 6, capacity: 30 });
  });

  it('times out instead of waiting forever on a locked event', async () => {
    const published = await createPublishedEvent(fixture);
    await database.asSuperuser(async (holder) => {
      await holder.query('begin');
      try {
        await holder.query(
          'select 1 from public.events where society_id=$1 and id=$2 for update',
          [fixture.societyId, published.eventId],
        );
        const error = await dbError(
          setRsvp(
            fixture,
            'owner',
            published.eventId,
            fixture.units.a101.id,
            'going',
            1,
            null,
          ),
        );
        expect(error.code).toBe('55P03');
      } finally {
        await holder.query('rollback');
      }
    });
  }, 20_000);
});
