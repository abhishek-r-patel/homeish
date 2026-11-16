// Opt-in P22 capacity check: 500 units, 100 concurrent voters and a 20-connection pool.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import {
  callPoll,
  createPollDraft,
  createPollFixture,
  privatePollDraft,
  pollObject,
  publicPollDraft,
  type PollFixture,
} from './support/poll-fixtures';
import {
  createTestDatabase,
  hasDatabase,
  type TestDatabase,
} from './support/database';

const enabled = hasDatabase && process.env.PERF_POLL === '1';
const POOL_SIZE = 20;
const CONCURRENT_VOTERS = 100;
const UNITS = 500;
const RPC_ARGUMENT_TYPES: Record<string, string[]> = {
  poll_ballot_submit: ['uuid', 'uuid', 'uuid', 'jsonb'],
  poll_member_list: ['uuid'],
  poll_member_get: ['uuid', 'uuid'],
  poll_results_get: ['uuid', 'uuid'],
  poll_participation_get: ['uuid', 'uuid'],
};

interface TimedResult<T> {
  value: T;
  elapsedMs: number;
}

function percentile(samples: number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(fraction * sorted.length) - 1);
  return Math.round(sorted[index]! * 10) / 10;
}

async function asAuthenticated<T>(
  pool: Pool,
  userId: string,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ role: 'authenticated', sub: userId }),
    ]);
    await client.query(
      "select set_config('request.jwt.claim.role','authenticated',true)",
    );
    const result = await run(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function rpc(
  pool: Pool,
  userId: string,
  name: string,
  args: unknown[],
): Promise<unknown> {
  const argumentTypes = RPC_ARGUMENT_TYPES[name];
  if (!argumentTypes || argumentTypes.length !== args.length) {
    throw new Error(`Unexpected poll RPC arguments for ${name}.`);
  }
  const parameters = args
    .map((_, index) => `$${index + 1}::${argumentTypes[index]}`)
    .join(',');
  return asAuthenticated(pool, userId, async (client) => {
    const response = await client.query<{ value: unknown }>(
      `select public.${name}(${parameters}) as value`,
      args,
    );
    return response.rows[0]?.value;
  });
}

async function timedRpc(
  pool: Pool,
  userId: string,
  name: string,
  args: unknown[],
): Promise<TimedResult<unknown>> {
  const started = performance.now();
  const value = await rpc(pool, userId, name, args);
  return { value, elapsedMs: performance.now() - started };
}

async function runBatches<T, R>(
  items: T[],
  batchSize: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let offset = 0; offset < items.length; offset += batchSize) {
    const batch = items.slice(offset, offset + batchSize);
    results.push(...(await Promise.all(batch.map(run))));
  }
  return results;
}

function resultRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected the poll RPC to return a row list.');
  }
  return value.map((row) => pollObject(row));
}

describe.skipIf(!enabled)('poll performance target', () => {
  let database: TestDatabase;
  let fixture: PollFixture;
  let pool: Pool;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createPollFixture(database, { unitCount: UNITS });
    const adminUrl = process.env.INTEGRATION_DATABASE_URL;
    if (!adminUrl) {
      throw new Error('The local database harness did not provide its URL.');
    }
    const testDatabaseUrl = new URL(adminUrl);
    testDatabaseUrl.username = 'supabase_admin';
    testDatabaseUrl.password = '';
    testDatabaseUrl.pathname = `/${database.name}`;
    pool = new Pool({
      connectionString: testDatabaseUrl.toString(),
      max: POOL_SIZE,
    });
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await database?.drop();
  });

  it('keeps public and private ballots exact under 100 concurrent voters', async () => {
    expect(fixture.units).toHaveLength(UNITS);
    expect(fixture.loadVoters).toHaveLength(UNITS);

    const publicDraft = await createPollDraft(
      fixture,
      'public',
      await publicPollDraft(fixture, {
        selectionMode: 'single',
        selectionLimit: 1,
      }),
    );
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      publicDraft.voteId,
      publicDraft.revision,
    ]);
    const publicOptionRows = await database.asSuperuser((client) =>
      client.query<{ id: string }>(
        `select id from public.poll_options
           where society_id=$1 and vote_id=$2 order by position`,
        [fixture.societyId, publicDraft.voteId],
      ),
    );
    const publicOptionIds = publicOptionRows.rows.map((row) => row.id);
    expect(publicOptionIds).toHaveLength(2);

    const publicBallots = fixture.units.map((unit, index) => ({
      unitId: unit.id,
      userId: fixture.loadVoters[index]!,
      optionId: publicOptionIds[0]!,
    }));
    const publicAcks = await runBatches(
      publicBallots,
      CONCURRENT_VOTERS,
      (ballot) =>
        timedRpc(pool, ballot.userId, 'poll_ballot_submit', [
          fixture.societyId,
          publicDraft.voteId,
          ballot.unitId,
          { optionIds: [ballot.optionId] },
        ]),
    );
    const publicAckP95 = percentile(
      publicAcks.map((ack) => ack.elapsedMs),
      0.95,
    );
    expect(publicAcks.every((ack) => ack.value !== undefined)).toBe(true);

    const replacements = publicBallots.slice(0, CONCURRENT_VOTERS);
    const replacementAcks = await runBatches(
      replacements,
      CONCURRENT_VOTERS,
      (ballot) =>
        timedRpc(pool, ballot.userId, 'poll_ballot_submit', [
          fixture.societyId,
          publicDraft.voteId,
          ballot.unitId,
          { optionIds: [publicOptionIds[1]] },
        ]),
    );
    const allPublicAckTimes = [
      ...publicAcks.map((ack) => ack.elapsedMs),
      ...replacementAcks.map((ack) => ack.elapsedMs),
    ];
    const fullAckP95 = percentile(allPublicAckTimes, 0.95);
    const publicCounts = await database.asSuperuser((client) =>
      client.query<{ option_id: string; count: number }>(
        `select option_id,count(*)::integer as count
           from public.poll_public_responses
           where society_id=$1 and vote_id=$2
           group by option_id order by option_id`,
        [fixture.societyId, publicDraft.voteId],
      ),
    );
    expect(publicCounts.rows).toHaveLength(2);
    expect(
      publicCounts.rows.find((row) => row.option_id === publicOptionIds[0])
        ?.count,
    ).toBe(UNITS - CONCURRENT_VOTERS);
    expect(
      publicCounts.rows.find((row) => row.option_id === publicOptionIds[1])
        ?.count,
    ).toBe(CONCURRENT_VOTERS);
    const publicParticipation = await database.asSuperuser((client) =>
      client.query<{ count: number }>(
        `select count(*)::integer as count from public.poll_participation
           where society_id=$1 and vote_id=$2`,
        [fixture.societyId, publicDraft.voteId],
      ),
    );
    expect(publicParticipation.rows[0]?.count).toBe(UNITS);

    const readUsers = fixture.loadVoters.slice(0, CONCURRENT_VOTERS);
    const reads = await runBatches(
      readUsers,
      CONCURRENT_VOTERS,
      async (userId) => {
        const [memberList, memberDetail, liveResults] = await Promise.all([
          timedRpc(pool, userId, 'poll_member_list', [fixture.societyId]),
          timedRpc(pool, userId, 'poll_member_get', [
            fixture.societyId,
            publicDraft.voteId,
          ]),
          timedRpc(pool, userId, 'poll_results_get', [
            fixture.societyId,
            publicDraft.voteId,
          ]),
        ]);
        return [memberList, memberDetail, liveResults];
      },
    );
    const readTimes = reads.flatMap((group) =>
      group.map((read) => read.elapsedMs),
    );

    const adminReads = await runBatches(
      Array.from({ length: 20 }, () => fixture.actors.admin),
      20,
      (userId) =>
        timedRpc(pool, userId, 'poll_participation_get', [
          fixture.societyId,
          publicDraft.voteId,
        ]),
    );
    readTimes.push(...adminReads.map((read) => read.elapsedMs));
    expect(percentile(readTimes, 0.95)).toBeLessThan(2_000);
    expect(fullAckP95).toBeLessThan(3_000);
    expect(publicAckP95).toBeLessThan(3_000);

    await callPoll(fixture, 'admin', 'poll_complete_early', [
      fixture.societyId,
      publicDraft.voteId,
      'Load test public poll complete',
    ]);
    const fullResults = pollObject(
      await callPoll(fixture, 'admin', 'poll_results_get', [
        fixture.societyId,
        publicDraft.voteId,
      ]),
    );
    expect(resultRows(fullResults.responses)).toHaveLength(UNITS);

    const privateDraft = await createPollDraft(
      fixture,
      'private',
      await privatePollDraft(fixture),
    );
    await callPoll(fixture, 'admin', 'poll_activate', [
      fixture.societyId,
      privateDraft.voteId,
      privateDraft.revision,
    ]);
    const privateOptions = await database.asSuperuser((client) =>
      client.query<{ office_id: string; candidate_id: string | null }>(
        `select office.id as office_id,candidate.id as candidate_id
           from public.poll_offices office
           left join public.poll_candidates candidate
             on candidate.society_id=office.society_id
            and candidate.vote_id=office.vote_id
            and candidate.office_id=office.id
           where office.society_id=$1 and office.vote_id=$2
           order by office.position,candidate.position`,
        [fixture.societyId, privateDraft.voteId],
      ),
    );
    const officeId = privateOptions.rows[0]?.office_id;
    const candidateId = privateOptions.rows.find(
      (row) => row.candidate_id !== null,
    )?.candidate_id;
    if (!officeId || !candidateId) {
      throw new Error('The private performance ballot was not initialized.');
    }
    const privateBallots = fixture.units.map((unit, index) => ({
      unitId: unit.id,
      userId: fixture.loadVoters[index]!,
      candidateId: index < UNITS - CONCURRENT_VOTERS ? candidateId : null,
    }));
    const privateAcks = await runBatches(
      privateBallots,
      CONCURRENT_VOTERS,
      (ballot) =>
        timedRpc(pool, ballot.userId, 'poll_ballot_submit', [
          fixture.societyId,
          privateDraft.voteId,
          ballot.unitId,
          {
            choices: [{ officeId, candidateId: ballot.candidateId }],
          },
        ]),
    );
    const privateAckP95 = percentile(
      privateAcks.map((ack) => ack.elapsedMs),
      0.95,
    );
    expect(privateAckP95).toBeLessThan(3_000);

    const privateTallies = await database.asSuperuser((client) =>
      client.query<{ candidate_id: string | null; accepted_count: string }>(
        `select candidate_id,accepted_count::text
           from public.poll_private_tallies
           where society_id=$1 and vote_id=$2 and office_id=$3`,
        [fixture.societyId, privateDraft.voteId, officeId],
      ),
    );
    expect(
      privateTallies.rows.find((row) => row.candidate_id === candidateId)
        ?.accepted_count,
    ).toBe(String(UNITS - CONCURRENT_VOTERS));
    expect(
      privateTallies.rows.find((row) => row.candidate_id === null)
        ?.accepted_count,
    ).toBe(String(CONCURRENT_VOTERS));
    const privateParticipation = await database.asSuperuser((client) =>
      client.query<{ count: number }>(
        `select count(*)::integer as count from public.poll_participation
           where society_id=$1 and vote_id=$2`,
        [fixture.societyId, privateDraft.voteId],
      ),
    );
    expect(privateParticipation.rows[0]?.count).toBe(UNITS);

    await callPoll(fixture, 'admin', 'poll_complete_early', [
      fixture.societyId,
      privateDraft.voteId,
      'Load test private election complete',
    ]);
    const privateResults = pollObject(
      await callPoll(fixture, 'committee', 'poll_results_get', [
        fixture.societyId,
        privateDraft.voteId,
      ]),
    );
    const officeResults = resultRows(privateResults.offices);
    expect(officeResults).toHaveLength(1);
    expect(officeResults[0]?.notaCount).toBe(CONCURRENT_VOTERS);
    expect(resultRows(officeResults[0]?.candidates)).toHaveLength(2);

    const detailedReads = await runBatches(
      Array.from({ length: 20 }, () => fixture.actors.admin),
      20,
      (userId) =>
        timedRpc(pool, userId, 'poll_results_get', [
          fixture.societyId,
          publicDraft.voteId,
        ]),
    );
    const detailedReadP95 = percentile(
      detailedReads.map((read) => read.elapsedMs),
      0.95,
    );
    expect(detailedReadP95).toBeLessThan(2_000);

    console.info(
      `Poll local load p95: public/private ballot ${fullAckP95}/${privateAckP95} ms; reads ${percentile(readTimes, 0.95)}/${detailedReadP95} ms`,
    );
  }, 600_000);
});
