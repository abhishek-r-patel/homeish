// Verify representative defaults, tenant eligibility, designation and snapshots.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  callPoll,
  createPollDraft,
  createPollFixture,
  errorFor,
  pollObject,
  publicPollDraft,
  type PollFixture,
} from './support/poll-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

function objectRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected the poll RPC to return a row list.');
  }
  return value.map((row) => pollObject(row));
}

describe.skipIf(!hasDatabase)('poll representative database contracts', () => {
  let database: TestDatabase;
  let fixture: PollFixture;

  beforeEach(async () => {
    database = await createTestDatabase();
    fixture = await createPollFixture(database);
  });

  afterEach(async () => {
    await database?.drop();
  });

  it('uses the active primary owner by default, then the earliest active owner, never family', async () => {
    const initial = pollObject(
      await callPoll(fixture, 'admin', 'poll_representatives_get', [
        fixture.societyId,
      ]),
    );
    const initialUnits = objectRows(initial.units);
    const first = initialUnits.find(
      (unit) => unit.unitId === fixture.units[0]!.id,
    );
    expect(first?.effective).toMatchObject({
      membershipId: fixture.memberships.primary,
      name: 'Synthetic poll primary',
      relationship: 'owner',
    });
    const options = objectRows(first?.options);
    expect(options.map((option) => option.membershipId)).toEqual([
      fixture.memberships.primary,
      fixture.memberships.backup,
      fixture.memberships.tenant,
    ]);
    expect(
      options.some(
        (option) => option.membershipId === fixture.memberships.family,
      ),
    ).toBe(false);

    await database.asSuperuser((client) =>
      client.query(
        `update public.memberships set status='deactivated'
         where society_id=$1 and id=$2`,
        [fixture.societyId, fixture.memberships.primary],
      ),
    );
    try {
      const afterPrimaryLeaves = pollObject(
        await callPoll(fixture, 'admin', 'poll_representatives_get', [
          fixture.societyId,
        ]),
      );
      const next = objectRows(afterPrimaryLeaves.units).find(
        (unit) => unit.unitId === fixture.units[0]!.id,
      );
      expect(next?.effective).toMatchObject({
        membershipId: fixture.memberships.backup,
        name: 'Synthetic poll backup',
        relationship: 'owner',
      });
    } finally {
      await database.asSuperuser((client) =>
        client.query(
          `update public.memberships set status='active'
           where society_id=$1 and id=$2`,
          [fixture.societyId, fixture.memberships.primary],
        ),
      );
    }
  });

  it('limits designation to admins and active owners of that unit and uses optimistic versions', async () => {
    const unitId = fixture.units[0]!.id;
    const designated = pollObject(
      await callPoll(fixture, 'primary', 'poll_representative_set', [
        fixture.societyId,
        unitId,
        fixture.memberships.backup,
        0,
      ]),
    );
    expect(designated).toMatchObject({ unitId, version: 1 });

    const stale = await errorFor(
      callPoll(fixture, 'admin', 'poll_representative_set', [
        fixture.societyId,
        unitId,
        fixture.memberships.primary,
        0,
      ]),
    );
    expect(stale.code).toBe('40001');
    const wrongUnit = await errorFor(
      callPoll(fixture, 'primary', 'poll_representative_set', [
        fixture.societyId,
        fixture.units[1]!.id,
        fixture.memberships.primary,
        0,
      ]),
    );
    expect(wrongUnit.code).toBe('42501');
    const committee = await errorFor(
      callPoll(fixture, 'committee', 'poll_representative_set', [
        fixture.societyId,
        unitId,
        fixture.memberships.primary,
        1,
      ]),
    );
    expect(committee.code).toBe('42501');

    const restored = await callPoll(
      fixture,
      'admin',
      'poll_representative_set',
      [fixture.societyId, unitId, null, 1],
    );
    expect(restored).toMatchObject({ unitId, version: 2 });
    const audit = await database.asSuperuser((client) =>
      client.query<{ action: string; actor_id: string }>(
        `select action,actor_id from public.audit_logs
         where society_id=$1 and actor_id=$2
           and action like 'poll.%representative%'
         order by created_at`,
        [fixture.societyId, fixture.actors.primary],
      ),
    );
    expect(audit.rows.length).toBeGreaterThan(0);
  });

  it('allows tenant designations only into tenant-enabled electorates and does not change frozen snapshots', async () => {
    const initiallyEligible = pollObject(
      await callPoll(fixture, 'admin', 'poll_representatives_get', [
        fixture.societyId,
      ]),
    );
    const initialUnit = objectRows(initiallyEligible.units).find(
      (unit) => unit.unitId === fixture.units[0]!.id,
    );
    expect(initialUnit?.effective).toMatchObject({
      membershipId: fixture.memberships.primary,
      relationship: 'owner',
    });
    expect(
      objectRows(initialUnit?.options).some(
        (option) => option.membershipId === fixture.memberships.tenant,
      ),
    ).toBe(true);

    const versionResult = await database.asSuperuser((client) =>
      client.query<{ version: number }>(
        `select COALESCE((
          select version from public.poll_unit_representatives
          where society_id=$1 and unit_id=$2
        ),0)::integer as version`,
        [fixture.societyId, fixture.units[0]!.id],
      ),
    );
    const version = versionResult.rows[0]?.version;
    if (version === undefined)
      throw new Error('Missing representative version.');
    await callPoll(fixture, 'admin', 'poll_representative_set', [
      fixture.societyId,
      fixture.units[0]!.id,
      fixture.memberships.tenant,
      version,
    ]);
    const tenantDesignatedWhileOff = pollObject(
      await callPoll(fixture, 'admin', 'poll_representatives_get', [
        fixture.societyId,
      ]),
    );
    const tenantDesignatedUnit = objectRows(
      tenantDesignatedWhileOff.units,
    ).find((unit) => unit.unitId === fixture.units[0]!.id);
    expect(tenantDesignatedUnit?.designated).toMatchObject({
      membershipId: fixture.memberships.tenant,
    });
    expect(tenantDesignatedUnit?.effective).toMatchObject({
      membershipId: fixture.memberships.primary,
    });

    const draft = await createPollDraft(
      fixture,
      'public',
      await publicPollDraft(fixture),
    );
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      draft.voteId,
      draft.revision,
    ]);
    const beforeChange = await database.asSuperuser((client) =>
      client.query<{ membership_id: string; representative_name: string }>(
        `select membership_id,representative_name
         from public.poll_electorate
         where society_id=$1 and vote_id=$2 and unit_id=$3`,
        [fixture.societyId, draft.voteId, fixture.units[0]!.id],
      ),
    );
    expect(beforeChange.rows[0]).toEqual({
      membership_id: fixture.memberships.primary,
      representative_name: 'Synthetic poll primary',
    });

    await callPoll(fixture, 'admin', 'poll_settings_update', [
      fixture.societyId,
      { tenant_voting_default: true },
    ]);
    const tenantEligible = pollObject(
      await callPoll(fixture, 'admin', 'poll_representatives_get', [
        fixture.societyId,
      ]),
    );
    const afterSetting = objectRows(tenantEligible.units).find(
      (unit) => unit.unitId === fixture.units[0]!.id,
    );
    expect(
      objectRows(afterSetting?.options).some(
        (option) => option.membershipId === fixture.memberships.tenant,
      ),
    ).toBe(true);
    const currentVersion = version + 1;
    await callPoll(fixture, 'admin', 'poll_representative_set', [
      fixture.societyId,
      fixture.units[0]!.id,
      fixture.memberships.backup,
      currentVersion,
    ]);
    const afterChange = await database.asSuperuser((client) =>
      client.query<{ membership_id: string; representative_name: string }>(
        `select membership_id,representative_name
         from public.poll_electorate
         where society_id=$1 and vote_id=$2 and unit_id=$3`,
        [fixture.societyId, draft.voteId, fixture.units[0]!.id],
      ),
    );
    expect(afterChange.rows).toEqual(beforeChange.rows);
  });
});
