// Verify P46 official-election access, owner electors and secret-ballot lifecycle.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPollFixture, type PollFixture } from './support/poll-fixtures';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('poll official election contracts', () => {
  let database: TestDatabase;
  let fixture: PollFixture;

  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await createPollFixture(database);
  });

  afterAll(async () => {
    await database?.drop();
  });

  const trace = () => crypto.randomUUID();

  it('keeps owner voters, nominations and secret ballots authoritative', async () => {
    await database.asRole(
      'authenticated',
      { sub: fixture.actors.admin },
      (client) =>
        client.query(
          'select public.poll_official_voting_set($1,true,$2,$3,$4,$5)',
          [
            fixture.societyId,
            'cooperative',
            'Our registered rules allow online voting for committee elections and I am authorised to switch this on.',
            crypto.randomUUID(),
            trace(),
          ],
        ),
      { commit: true },
    );
    const election = await database.asRole(
      'authenticated',
      { sub: fixture.actors.admin },
      async (client) =>
        (
          await client.query<{ id: string }>(
            `select public.poll_election_save(
               $1,null,'Synthetic committee election',
               now() - interval '1 hour',now() + interval '1 hour',
               now() - interval '30 minutes',now() + interval '2 hours',
               $2::jsonb,null,$3,$4
             ) as id`,
            [
              fixture.societyId,
              JSON.stringify([{ name: 'Treasurer', seats: 1 }]),
              crypto.randomUUID(),
              trace(),
            ],
          )
        ).rows[0]!.id,
      { commit: true },
    );
    const outside = await database.asSuperuser(async (client) => {
      const id = await newAuthUser(client, 'p46-outside-officer@example.test');
      await client.query(
        'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
        [id, 'p46-outside-officer@example.test', 'Synthetic outside officer'],
      );
      return id;
    });
    const outsideElection = await database.asRole(
      'authenticated',
      { sub: fixture.actors.admin },
      async (client) =>
        (
          await client.query<{ id: string }>(
            `select public.poll_election_save(
               $1,null,'Outside officer election',
               now() - interval '1 hour',now() + interval '1 day',
               now() - interval '30 minutes',now() + interval '2 days',
               $2::jsonb,null,$3,$4
             ) as id`,
            [
              fixture.societyId,
              JSON.stringify([{ name: 'Secretary', seats: 1 }]),
              crypto.randomUUID(),
              trace(),
            ],
          )
        ).rows[0]!.id,
      { commit: true },
    );
    await database.asRole(
      'authenticated',
      { sub: fixture.actors.admin },
      (client) =>
        client.query(
          'select public.poll_election_officer_assign($1,$2,null,$3,$4,$5)',
          [
            fixture.societyId,
            outsideElection,
            'p46-outside-officer@example.test',
            crypto.randomUUID(),
            trace(),
          ],
        ),
      { commit: true },
    );
    const signInAllowed = await database.asRole(
      'service_role',
      null,
      async (client) =>
        (
          await client.query<{ allowed: boolean }>(
            'select public.has_signin_access($1) as allowed',
            ['p46-outside-officer@example.test'],
          )
        ).rows[0]!.allowed,
    );
    expect(signInAllowed).toBe(true);
    await database.asRole(
      'authenticated',
      {
        sub: outside,
        email: 'p46-outside-officer@example.test',
      },
      (client) =>
        client.query(
          'select public.poll_election_officer_confirm($1,$2,$3,$4)',
          [
            fixture.societyId,
            outsideElection,
            'I am not a candidate and have no conflict of interest',
            trace(),
          ],
        ),
      { commit: true },
    );
    const officerAssignments = await database.asRole(
      'authenticated',
      { sub: outside, email: 'p46-outside-officer@example.test' },
      async (client) =>
        (
          await client.query<{ assignments: unknown }>(
            'select public.poll_election_officer_assignments() as assignments',
          )
        ).rows[0]!.assignments,
    );
    expect(officerAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ election_id: outsideElection }),
      ]),
    );
    const voterCount = await database.asRole(
      'authenticated',
      { sub: fixture.actors.admin },
      async (client) =>
        (
          await client.query<{ count: number }>(
            'select public.poll_election_voters_init($1,$2,$3) as count',
            [fixture.societyId, election, trace()],
          )
        ).rows[0]!.count,
      { commit: true },
    );
    expect(voterCount).toBe(2);
    const voters = await database.asSuperuser((client) =>
      client.query<{ user_id: string; unit_id: string }>(
        `select user_id,unit_id from public.poll_election_voters
         where society_id=$1 and election_id=$2 order by unit_label`,
        [fixture.societyId, election],
      ),
    );
    expect(voters.rows.map((row) => row.user_id)).toEqual([
      fixture.actors.backup,
      fixture.actors.owner2,
    ]);
    expect(
      await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.actors.family },
          (client) =>
            client.query(
              'select public.poll_election_nomination_submit($1,$2,$3,$4,$5)',
              [
                fixture.societyId,
                election,
                [crypto.randomUUID()],
                crypto.randomUUID(),
                trace(),
              ],
            ),
        ),
      ),
    ).toMatchObject({ code: '23514' });

    await database.asRole(
      'authenticated',
      { sub: fixture.actors.admin },
      (client) =>
        client.query('select public.poll_election_stage_advance($1,$2,1,$3)', [
          fixture.societyId,
          election,
          trace(),
        ]),
      { commit: true },
    );
    expect(
      await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.actors.admin },
          (client) =>
            client.query(
              'select public.poll_official_voting_set($1,false,null,null,$2,$3)',
              [fixture.societyId, crypto.randomUUID(), trace()],
            ),
        ),
      ),
    ).toMatchObject({ code: '23514' });
    const officer = await database.asRole(
      'authenticated',
      { sub: fixture.actors.admin },
      async (client) =>
        (
          await client.query<{ id: string }>(
            'select public.poll_election_officer_assign($1,$2,$3,null,$4,$5) as id',
            [
              fixture.societyId,
              election,
              fixture.actors.committee,
              crypto.randomUUID(),
              trace(),
            ],
          )
        ).rows[0]!.id,
      { commit: true },
    );
    expect(officer).toBeTruthy();
    await database.asRole(
      'authenticated',
      { sub: fixture.actors.committee },
      (client) =>
        client.query(
          'select public.poll_election_officer_confirm($1,$2,$3,$4)',
          [
            fixture.societyId,
            election,
            'I am not a candidate and have no conflict of interest',
            trace(),
          ],
        ),
      { commit: true },
    );
    const post = await database.asSuperuser((client) =>
      client.query<{ id: string }>(
        'select id from public.poll_election_posts where election_id=$1',
        [election],
      ),
    );
    for (const actor of ['primary', 'owner2'] as const) {
      await database.asRole(
        'authenticated',
        { sub: fixture.actors[actor] },
        (client) =>
          client.query(
            'select public.poll_election_nomination_submit($1,$2,$3,$4,$5)',
            [
              fixture.societyId,
              election,
              [post.rows[0]!.id],
              crypto.randomUUID(),
              trace(),
            ],
          ),
        { commit: true },
      );
    }
    expect(
      await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.actors.committee },
          (client) =>
            client.query(
              'select public.poll_election_nomination_submit($1,$2,$3,$4,$5)',
              [
                fixture.societyId,
                election,
                [post.rows[0]!.id],
                crypto.randomUUID(),
                trace(),
              ],
            ),
        ),
      ),
    ).toMatchObject({ code: '42501' });
    await database.asRole(
      'authenticated',
      { sub: fixture.actors.committee },
      (client) =>
        client.query('select public.poll_election_stage_advance($1,$2,2,$3)', [
          fixture.societyId,
          election,
          trace(),
        ]),
      { commit: true },
    );
    const nominations = await database.asSuperuser((client) =>
      client.query<{ id: string }>(
        'select id from public.poll_election_nominations where election_id=$1',
        [election],
      ),
    );
    for (const nomination of nominations.rows) {
      await database.asRole(
        'authenticated',
        { sub: fixture.actors.committee },
        (client) =>
          client.query(
            'select public.poll_election_nomination_decide($1,$2,true,null,$3)',
            [fixture.societyId, nomination.id, trace()],
          ),
        { commit: true },
      );
    }
    await database.asRole(
      'authenticated',
      { sub: fixture.actors.committee },
      (client) =>
        client.query('select public.poll_election_stage_advance($1,$2,3,$3)', [
          fixture.societyId,
          election,
          trace(),
        ]),
      { commit: true },
    );
    await database.asRole(
      'authenticated',
      { sub: fixture.actors.committee },
      (client) =>
        client.query('select public.poll_election_stage_advance($1,$2,4,$3)', [
          fixture.societyId,
          election,
          trace(),
        ]),
      { commit: true },
    );
    for (const voter of voters.rows) {
      if (voter.user_id === fixture.actors.backup) {
        expect(
          await dbError(
            database.asRole('authenticated', { sub: voter.user_id }, (client) =>
              client.query(
                'select public.poll_election_ballot_submit($1,$2,$3,$4::jsonb)',
                [
                  fixture.societyId,
                  election,
                  voter.unit_id,
                  JSON.stringify([
                    {
                      postId: post.rows[0]!.id,
                      candidateId: fixture.actors.primary,
                    },
                    {
                      postId: post.rows[0]!.id,
                      candidateId: fixture.actors.primary,
                    },
                  ]),
                ],
              ),
            ),
          ),
        ).toMatchObject({ code: '22023' });
      }
      await database.asRole(
        'authenticated',
        { sub: voter.user_id },
        (client) =>
          client.query(
            'select public.poll_election_ballot_submit($1,$2,$3,$4::jsonb)',
            [
              fixture.societyId,
              election,
              voter.unit_id,
              JSON.stringify([
                {
                  postId: post.rows[0]!.id,
                  candidateId:
                    voter.user_id === fixture.actors.owner2
                      ? fixture.actors.owner2
                      : fixture.actors.primary,
                },
              ]),
            ],
          ),
        { commit: true },
      );
    }
    const tallyStorage = await database.asSuperuser((client) =>
      client.query<{ row_count: number; total: number }>(
        `select count(*)::integer as row_count, coalesce(sum(tally),0)::integer as total
         from public.poll_election_tallies where election_id=$1`,
        [election],
      ),
    );
    expect(tallyStorage.rows[0]).toMatchObject({ row_count: 3, total: 2 });
    const residentView = await database.asRole(
      'authenticated',
      { sub: fixture.actors.primary },
      async (client) =>
        (
          await client.query<{ election: Record<string, unknown> }>(
            'select public.poll_election_get($1,$2) as election',
            [fixture.societyId, election],
          )
        ).rows[0]!.election,
    );
    expect(residentView).toMatchObject({
      participation_count: 0,
      total_cost_paise: 0,
      voters: [],
      voted_units: [],
      source_options: {
        notices: [],
        meetings: [],
        documents: [],
      },
    });
    const forbiddenChoiceTable = await database.asSuperuser((client) =>
      client.query<{ count: number }>(
        `select count(*)::integer as count from pg_tables
         where schemaname='public' and tablename ilike '%election_ballot%'`,
      ),
    );
    expect(forbiddenChoiceTable.rows[0]!.count).toBe(0);
    await database.asSuperuser((client) =>
      client.query(
        "update public.poll_elections set voting_closes_at=now()-interval '1 minute' where id=$1",
        [election],
      ),
    );
    await database.asRole(
      'authenticated',
      { sub: fixture.actors.committee },
      (client) =>
        client.query('select public.poll_election_count($1,$2,$3)', [
          fixture.societyId,
          election,
          trace(),
        ]),
      { commit: true },
    );
    await database.asRole(
      'authenticated',
      { sub: fixture.actors.committee },
      (client) =>
        client.query(
          'select public.poll_election_tie_resolve($1,$2,$3,$4,$5,$6,$7)',
          [
            fixture.societyId,
            election,
            post.rows[0]!.id,
            fixture.actors.primary,
            'Drawing lots',
            'Synthetic tie resolved by recorded lots',
            trace(),
          ],
        ),
      { commit: true },
    );
    expect(
      await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.actors.committee },
          (client) =>
            client.query(
              'select public.poll_election_tie_resolve($1,$2,$3,$4,$5,$6,$7)',
              [
                fixture.societyId,
                election,
                post.rows[0]!.id,
                fixture.actors.owner2,
                'Drawing lots',
                'More winners than seats',
                trace(),
              ],
            ),
        ),
      ),
    ).toMatchObject({ code: '23505' });
    expect(
      await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.actors.primary },
          (client) =>
            client.query(
              'select public.poll_election_post_choose($1,$2,$3,$4,$5)',
              [
                fixture.societyId,
                election,
                fixture.actors.primary,
                post.rows[0]!.id,
                trace(),
              ],
            ),
        ),
      ),
    ).toMatchObject({ code: '22023' });
    const declared = await database.asRole(
      'authenticated',
      { sub: fixture.actors.committee },
      async (client) =>
        (
          await client.query<{ result: Record<string, unknown> }>(
            'select public.poll_election_declare($1,$2,$3) as result',
            [fixture.societyId, election, trace()],
          )
        ).rows[0]!.result,
      { commit: true },
    );
    expect(declared).toMatchObject({ stage: 'declared', winnerCount: 1 });
    expect(
      await dbError(
        database.asRole(
          'authenticated',
          { sub: fixture.actors.family },
          (client) =>
            client.query(
              'select public.poll_election_dispute_update($1,$2,$3,$4,$5)',
              [
                fixture.societyId,
                crypto.randomUUID(),
                'resolved',
                'No',
                trace(),
              ],
            ),
        ),
      ),
    ).toMatchObject({ code: 'P0002' });
  });
});
