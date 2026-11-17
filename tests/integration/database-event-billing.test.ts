// Verify event contributions: ledger debits/credits, headcount changes, refunds, cancellation and billing rules.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  callEvent,
  cancelEvent,
  chargeRows,
  createEvent,
  createEventFixture,
  createPublishedEvent,
  databaseTimestamp,
  eventInput,
  expectCode,
  expectDomainError,
  ledgerRowsForEvent,
  netOf,
  passEventDeadline,
  records,
  requestId,
  setModule,
  setRsvp,
  setRsvpAs,
  unitLedgerNet,
  updateEvent,
  type EventFixture,
} from './support/event-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

const TITLE = 'Synthetic Holi brunch';

describe.skipIf(!hasDatabase)('event contribution database contracts', () => {
  let database: TestDatabase;
  let fixture: EventFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createEventFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  /** Every charge row maps to exactly one ledger entry with the same direction and amount. */
  async function expectChargesMirrorLedger(eventId: string) {
    const charges = await chargeRows(fixture, eventId);
    const ledger = await ledgerRowsForEvent(fixture, eventId);
    expect(ledger).toHaveLength(charges.length);
    expect(new Set(charges.map((charge) => charge.ledger_entry_id)).size).toBe(
      charges.length,
    );
    for (const charge of charges) {
      const entry = ledger.find((row) => row.id === charge.ledger_entry_id);
      expect(entry).toMatchObject({
        kind: 'adjustment',
        direction: charge.direction,
        amount_paise: charge.amount_paise,
      });
    }
    return { charges, ledger };
  }

  it('charges a per-unit contribution once, ignores headcount changes and refunds on withdrawal', async () => {
    const published = await createPublishedEvent(fixture, {
      title: TITLE,
      contributionType: 'per_unit',
      contributionPaise: 50_000,
    });
    const unitId = fixture.units.a101.id;
    const before = await unitLedgerNet(fixture, unitId);
    const going = await setRsvp(
      fixture,
      'owner',
      published.eventId,
      unitId,
      'going',
      3,
      null,
    );
    expect(going.chargedPaise).toBe(50_000);
    const bigger = await setRsvp(
      fixture,
      'tenant',
      published.eventId,
      unitId,
      'going',
      5,
      going.version as number,
    );
    expect(bigger.chargedPaise).toBe(50_000);
    let { charges, ledger } = await expectChargesMirrorLedger(
      published.eventId,
    );
    expect(charges).toEqual([
      expect.objectContaining({
        direction: 'debit',
        amount_paise: 50_000,
        reason: 'rsvp',
      }),
    ]);
    expect(ledger[0]?.reason).toBe(`Event contribution: ${TITLE}`);
    expect(await unitLedgerNet(fixture, unitId)).toBe(before + 50_000);

    const withdrawn = await setRsvp(
      fixture,
      'family',
      published.eventId,
      unitId,
      'not_going',
      0,
      bigger.version as number,
    );
    expect(withdrawn.chargedPaise).toBe(0);
    ({ charges, ledger } = await expectChargesMirrorLedger(published.eventId));
    expect(charges[1]).toMatchObject({
      direction: 'credit',
      amount_paise: 50_000,
      reason: 'withdrawn',
    });
    expect(ledger[1]?.reason).toBe(`Event refund: ${TITLE}`);
    expect(await unitLedgerNet(fixture, unitId)).toBe(before);

    const again = await setRsvp(
      fixture,
      'owner',
      published.eventId,
      unitId,
      'going',
      1,
      withdrawn.version as number,
    );
    expect(again.chargedPaise).toBe(50_000);
    ({ charges } = await expectChargesMirrorLedger(published.eventId));
    expect(netOf(charges)).toBe(50_000);
  });

  it('charges per head and re-charges in full when the headcount changes', async () => {
    const published = await createPublishedEvent(fixture, {
      title: TITLE,
      contributionType: 'per_head',
      contributionPaise: 20_000,
    });
    const unitId = fixture.units.a201.id;
    const before = await unitLedgerNet(fixture, unitId);
    const two = await setRsvp(
      fixture,
      'owner2',
      published.eventId,
      unitId,
      'going',
      2,
      null,
    );
    expect(two.chargedPaise).toBe(40_000);
    const same = await setRsvp(
      fixture,
      'owner2',
      published.eventId,
      unitId,
      'going',
      2,
      two.version as number,
    );
    expect(same).toMatchObject({ chargedPaise: 40_000, version: two.version });
    expect(await chargeRows(fixture, published.eventId)).toHaveLength(1);

    const four = await setRsvp(
      fixture,
      'multi',
      published.eventId,
      unitId,
      'going',
      4,
      two.version as number,
    );
    expect(four.chargedPaise).toBe(80_000);
    const { charges } = await expectChargesMirrorLedger(published.eventId);
    expect(
      charges.map(({ direction, amount_paise, reason }) => ({
        direction,
        amount_paise,
        reason,
      })),
    ).toEqual([
      { direction: 'debit', amount_paise: 40_000, reason: 'rsvp' },
      { direction: 'credit', amount_paise: 40_000, reason: 'headcount_change' },
      { direction: 'debit', amount_paise: 80_000, reason: 'headcount_change' },
    ]);
    expect(await unitLedgerNet(fixture, unitId)).toBe(before + 80_000);

    const withdrawn = await setRsvp(
      fixture,
      'owner2',
      published.eventId,
      unitId,
      'not_going',
      0,
      four.version as number,
    );
    expect(withdrawn.chargedPaise).toBe(0);
    expect(await unitLedgerNet(fixture, unitId)).toBe(before);
    const detail = await callEvent(fixture, 'admin', 'event_admin_get', [
      fixture.societyId,
      published.eventId,
    ]);
    expect(detail.totals).toMatchObject({ collectedPaise: 0 });
  });

  it('reports net charges to managers and residents', async () => {
    const published = await createPublishedEvent(fixture, {
      title: TITLE,
      contributionType: 'per_head',
      contributionPaise: 15_000,
    });
    await setRsvp(
      fixture,
      'owner',
      published.eventId,
      fixture.units.a101.id,
      'going',
      2,
      null,
    );
    await setRsvp(
      fixture,
      'owner3',
      published.eventId,
      fixture.units.b101.id,
      'going',
      1,
      null,
    );
    const detail = await callEvent(fixture, 'committee', 'event_admin_get', [
      fixture.societyId,
      published.eventId,
    ]);
    expect(detail.totals).toMatchObject({
      collectedPaise: 45_000,
      goingHeadcount: 3,
    });
    expect(
      records(detail.rsvps).map((rsvp) => [
        rsvp.unitLabel,
        rsvp.netChargePaise,
      ]),
    ).toEqual([
      ['A-101', 30_000],
      ['B-101', 15_000],
    ]);
    expect(detail.event).toMatchObject({
      contributionType: 'per_head',
      contributionPaise: 15_000,
    });
    const mine = await callEvent(fixture, 'tenant', 'event_member_get', [
      fixture.societyId,
      published.eventId,
    ]);
    expect(records(mine.myUnits)[0]).toMatchObject({
      unitId: fixture.units.a101.id,
      rsvp: { netChargePaise: 30_000 },
    });
    expect(mine.event).toMatchObject({
      contributionType: 'per_head',
      contributionPaise: 15_000,
    });
  });

  it('keeps charges once the deadline passes', async () => {
    const published = await createPublishedEvent(fixture, {
      title: TITLE,
      contributionType: 'per_unit',
      contributionPaise: 30_000,
      rsvpDeadline: await databaseTimestamp(fixture, "+ interval '3 days'"),
    });
    const unitId = fixture.units.b101.id;
    const going = await setRsvp(
      fixture,
      'owner3',
      published.eventId,
      unitId,
      'going',
      1,
      null,
    );
    await passEventDeadline(fixture, published.eventId);
    await expectDomainError(
      setRsvp(
        fixture,
        'owner3',
        published.eventId,
        unitId,
        'not_going',
        0,
        going.version as number,
      ),
      'event_rsvp_closed',
    );
    const { charges } = await expectChargesMirrorLedger(published.eventId);
    expect(netOf(charges)).toBe(30_000);
  });

  it('refunds every outstanding charge when the event is cancelled, even after the deadline', async () => {
    const published = await createPublishedEvent(fixture, {
      title: TITLE,
      contributionType: 'per_head',
      contributionPaise: 10_000,
      rsvpDeadline: await databaseTimestamp(fixture, "+ interval '3 days'"),
    });
    const [first, second, third] = fixture.bulk;
    await setRsvpAs(
      fixture,
      first!.userId,
      published.eventId,
      first!.unitId,
      'going',
      3,
      null,
    );
    await setRsvpAs(
      fixture,
      second!.userId,
      published.eventId,
      second!.unitId,
      'going',
      1,
      null,
    );
    const withdrawn = await setRsvpAs(
      fixture,
      third!.userId,
      published.eventId,
      third!.unitId,
      'going',
      2,
      null,
    );
    await setRsvpAs(
      fixture,
      third!.userId,
      published.eventId,
      third!.unitId,
      'not_going',
      0,
      withdrawn.version as number,
    );
    await passEventDeadline(fixture, published.eventId);
    const cancelled = await cancelEvent(fixture, published.eventId);
    expect(cancelled.refundedUnits).toBe(2);
    const { charges } = await expectChargesMirrorLedger(published.eventId);
    const refunds = charges.filter(
      (charge) => charge.reason === 'event_cancelled',
    );
    expect(
      refunds.map(({ unit_id, direction, amount_paise }) => ({
        unit_id,
        direction,
        amount_paise,
      })),
    ).toEqual(
      expect.arrayContaining([
        { unit_id: first!.unitId, direction: 'credit', amount_paise: 30_000 },
        { unit_id: second!.unitId, direction: 'credit', amount_paise: 10_000 },
      ]),
    );
    expect(refunds).toHaveLength(2);
    for (const resident of [first!, second!, third!]) {
      expect(
        netOf(charges.filter((charge) => charge.unit_id === resident.unitId)),
      ).toBe(0);
      expect(await unitLedgerNet(fixture, resident.unitId)).toBe(0);
    }
    const detail = await callEvent(fixture, 'admin', 'event_admin_get', [
      fixture.societyId,
      published.eventId,
    ]);
    expect(detail.totals).toMatchObject({ collectedPaise: 0 });
  });

  it('withdraws and fully refunds flats dropped from the audience, even after the deadline', async () => {
    const published = await createPublishedEvent(fixture, {
      title: TITLE,
      contributionType: 'per_head',
      contributionPaise: 10_000,
      rsvpDeadline: await databaseTimestamp(fixture, "+ interval '3 days'"),
    });
    const dropped = await setRsvp(
      fixture,
      'owner3',
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
    await passEventDeadline(fixture, published.eventId);
    const request = requestId('narrow');
    const narrowed = await updateEvent(
      fixture,
      published.eventId,
      { audience: { scope: 'blocks', blockIds: [fixture.blocks.A] } },
      request,
    );
    expect(narrowed).toMatchObject({
      notified: false,
      withdrawnUnits: 1,
      refundedUnits: 1,
    });
    const { charges } = await expectChargesMirrorLedger(published.eventId);
    const refunds = charges.filter(
      (charge) => charge.reason === 'audience_removed',
    );
    expect(
      refunds.map(({ unit_id, direction, amount_paise }) => ({
        unit_id,
        direction,
        amount_paise,
      })),
    ).toEqual([
      {
        unit_id: fixture.units.b101.id,
        direction: 'credit',
        amount_paise: 30_000,
      },
    ]);
    expect(
      netOf(
        charges.filter((charge) => charge.unit_id === fixture.units.b101.id),
      ),
    ).toBe(0);
    expect(
      netOf(
        charges.filter((charge) => charge.unit_id === fixture.units.a101.id),
      ),
    ).toBe(20_000);

    const notices = await database.asSuperuser((client) =>
      client.query<{
        user_id: string;
        type: string;
        title: string;
        body: string;
        entity_type: string;
      }>(
        `select user_id,type,title,body,entity_type from public.notifications
         where request_id=$1 order by user_id`,
        [request],
      ),
    );
    expect(notices.rows.map((row) => row.user_id).sort()).toEqual(
      [fixture.actors.owner3, fixture.actors.multi].sort(),
    );
    for (const row of notices.rows) {
      expect(row).toMatchObject({
        type: 'event_updated',
        title: 'Event audience changed',
        body: `${TITLE} is no longer open to your flat. Your reply was withdrawn and your contribution refunded.`,
        entity_type: 'event',
      });
    }
    const audit = await database.asSuperuser((client) =>
      client.query<{ after: Record<string, unknown> }>(
        `select after from public.audit_logs where request_id=$1 and action='event.update'`,
        [request],
      ),
    );
    expect(audit.rows[0]?.after).toMatchObject({
      withdrawnUnits: 1,
      refundedUnits: 1,
    });

    const again = await updateEvent(fixture, published.eventId, {
      title: TITLE,
    });
    expect(again).toMatchObject({ withdrawnUnits: 0, refundedUnits: 0 });
    expect(await chargeRows(fixture, published.eventId)).toHaveLength(
      charges.length,
    );
    expect(dropped.chargedPaise).toBe(30_000);
  });

  it('validates contribution amounts and locks them once published', async () => {
    const attempt = async (
      contributionType: string,
      contributionPaise: number,
    ) =>
      callEvent(fixture, 'admin', 'event_create', [
        fixture.societyId,
        crypto.randomUUID(),
        {
          ...(await eventInput(fixture)),
          contributionType,
          contributionPaise,
        },
        requestId('create'),
      ]);
    await expectCode(attempt('per_unit', 0), '22023');
    await expectCode(attempt('per_head', 10_000_001), '22023');
    await expectCode(attempt('none', 100), '22023');
    await expectCode(attempt('donation', 100), '22023');
    expect(await attempt('per_head', 10_000_000)).toMatchObject({
      eventId: expect.any(String),
    });

    const published = await createPublishedEvent(fixture, {
      contributionType: 'per_unit',
      contributionPaise: 40_000,
    });
    await expectDomainError(
      updateEvent(fixture, published.eventId, { contributionPaise: 45_000 }),
      'event_invalid_state',
    );
    await expectDomainError(
      updateEvent(fixture, published.eventId, {
        contributionType: 'none',
        contributionPaise: 0,
      }),
      'event_invalid_state',
    );
    expect(
      await updateEvent(fixture, published.eventId, {
        title: 'Synthetic retitled',
      }),
    ).toMatchObject({ eventId: published.eventId });
  });

  it('requires billing for contributions but not for free events', async () => {
    const draftWithFee = await createEvent(fixture, {
      contributionType: 'per_unit',
      contributionPaise: 25_000,
    });
    const publishedWithFee = await createPublishedEvent(fixture, {
      contributionType: 'per_unit',
      contributionPaise: 25_000,
    });
    const free = await createPublishedEvent(fixture);
    await setModule(fixture, 'billing', false);
    try {
      await expectDomainError(
        callEvent(fixture, 'admin', 'event_publish', [
          fixture.societyId,
          draftWithFee.eventId,
          draftWithFee.version,
          requestId('publish'),
        ]),
        'event_billing_required',
      );
      await expectDomainError(
        updateEvent(fixture, publishedWithFee.eventId, {
          title: 'Synthetic edited without billing',
        }),
        'event_billing_required',
      );
      await expectDomainError(
        setRsvp(
          fixture,
          'owner',
          publishedWithFee.eventId,
          fixture.units.a101.id,
          'going',
          1,
          null,
        ),
        'event_billing_required',
      );
      expect(await chargeRows(fixture, publishedWithFee.eventId)).toEqual([]);
      const freeGoing = await setRsvp(
        fixture,
        'owner',
        free.eventId,
        fixture.units.a101.id,
        'going',
        2,
        null,
      );
      expect(freeGoing.chargedPaise).toBe(0);
      expect(await chargeRows(fixture, free.eventId)).toEqual([]);
      const freeOnly = await createPublishedEvent(fixture);
      expect(freeOnly.version).toBeGreaterThan(1);
      const detail = await callEvent(fixture, 'admin', 'event_admin_get', [
        fixture.societyId,
        publishedWithFee.eventId,
      ]);
      expect(detail.billingEnabled).toBe(false);
    } finally {
      await setModule(fixture, 'billing', true);
    }
    const nowGoing = await setRsvp(
      fixture,
      'owner',
      publishedWithFee.eventId,
      fixture.units.a101.id,
      'going',
      1,
      null,
    );
    expect(nowGoing.chargedPaise).toBe(25_000);
  });

  it('never writes ledger entries for free events', async () => {
    const published = await createPublishedEvent(fixture);
    const going = await setRsvp(
      fixture,
      'owner3',
      published.eventId,
      fixture.units.b101.id,
      'going',
      4,
      null,
    );
    await setRsvp(
      fixture,
      'owner3',
      published.eventId,
      fixture.units.b101.id,
      'not_going',
      0,
      going.version as number,
    );
    await cancelEvent(fixture, published.eventId);
    expect(await chargeRows(fixture, published.eventId)).toEqual([]);
  });
});
