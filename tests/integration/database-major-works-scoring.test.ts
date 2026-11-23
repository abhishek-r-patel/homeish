// Verify P50.2 quote caps, private scores, averages and chosen-quote history.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';
import { majorWorksScoringSchema } from '../../src/core/major-works/validation';

describe.skipIf(!hasDatabase)('database major works scoring', () => {
  it('returns own scores while open and only aggregates after close', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of ['admin', 'committee', 'resident']) {
          const id = await newAuthUser(
            client,
            `works-score-${role}@example.test`,
          );
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `works-score-${role}@example.test`, `Score ${role}`],
          );
          users.set(role, id);
        }
        const society = (
          await client.query<{ id: string }>(
            'insert into public.societies(name,created_by) values($1,$2) returning id',
            ['Scoring Society', users.get('admin')],
          )
        ).rows[0]!.id;
        for (const role of ['admin', 'committee', 'resident']) {
          await client.query(
            `insert into public.memberships(society_id,user_id,roles,status)
             values($1,$2,$3,'active')`,
            [society, users.get(role), [role]],
          );
        }
        await client.query(
          `insert into public.module_configs(
             society_id,module_key,enabled,settings
           ) values
             ($1,'core',true,'{}'),
             ($1,'major_works',true,'{"consent_method":"poll"}')`,
          [society],
        );
        const project = (
          await client.query<{ id: string; updated_at: string }>(
            `insert into public.major_works_projects(
               society_id,title,location,category,priority,estimate_paise,
               progress_percent,client_request_id,created_by
             ) values($1,'Scored repair','Block A','painting','medium',500000,0,$2,$3)
             returning id,updated_at::text as updated_at`,
            [society, crypto.randomUUID(), users.get('admin')],
          )
        ).rows[0]!;
        return { society, users, project };
      });
      const admin = fixture.users.get('admin')!;
      const committee = fixture.users.get('committee')!;
      const resident = fixture.users.get('resident')!;
      const quoteIds: string[] = [];
      for (const [vendor, amount] of [
        ['Alpha Repairs', 100_000],
        ['Beta Repairs', 120_000],
        ['Gamma Repairs', 130_000],
      ] as const) {
        const quote = await database.asRole(
          'authenticated',
          { sub: admin },
          (client) =>
            client.query<{ id: string }>(
              `select public.major_works_quote_add(
                 $1,$2,null,$3,$4,'Same scope',null,true,$5,'score-quote'
               ) as id`,
              [
                fixture.society,
                fixture.project.id,
                vendor,
                amount,
                crypto.randomUUID(),
              ],
            ),
          { commit: true },
        );
        quoteIds.push(quote.rows[0]!.id);
      }
      expect(
        await dbError(
          database.asRole('authenticated', { sub: admin }, (client) =>
            client.query(
              `select public.major_works_quote_add(
                 $1,$2,null,'Delta Repairs',140000,'Same scope',null,true,$3,'score-quote-four'
               )`,
              [fixture.society, fixture.project.id, crypto.randomUUID()],
            ),
          ),
        ),
      ).toMatchObject({ code: '23514' });
      const criteriaRequest = crypto.randomUUID();
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_criteria_set(
               $1,$2,$3::jsonb,$4,'score-criteria'
             )`,
            [
              fixture.society,
              fixture.project.id,
              JSON.stringify([
                { name: 'Price', weight: 60 },
                { name: 'Quality', weight: 40 },
              ]),
              criteriaRequest,
            ],
          ),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_criteria_set(
               $1,$2,$3::jsonb,$4,'score-criteria-retry'
             )`,
            [
              fixture.society,
              fixture.project.id,
              JSON.stringify([
                { name: 'Price', weight: 60 },
                { name: 'Quality', weight: 40 },
              ]),
              criteriaRequest,
            ],
          ),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_scoring_transition(
               $1,$2,'open',null,$3,'score-open'
             )`,
            [fixture.society, fixture.project.id, fixture.project.updated_at],
          ),
        { commit: true },
      );
      const open = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_scoring_get($1,$2) as data',
            [fixture.society, fixture.project.id],
          ),
      );
      const scoringOpen = majorWorksScoringSchema.parse(open.rows[0]!.data);
      expect(scoringOpen.scoring_state).toBe('open');
      expect(scoringOpen.my_scores).toEqual([]);
      const criteriaIds = scoringOpen.criteria.map((criterion) => criterion.id);
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            'select public.major_works_scores_save($1,$2,$3::jsonb,$4)',
            [
              fixture.society,
              fixture.project.id,
              JSON.stringify([
                {
                  quote_id: quoteIds[0],
                  criterion_id: criteriaIds[0],
                  score: 10,
                },
                {
                  quote_id: quoteIds[0],
                  criterion_id: criteriaIds[1],
                  score: 8,
                },
              ]),
              'score-admin',
            ],
          ),
        { commit: true },
      );
      await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query(
            'select public.major_works_scores_save($1,$2,$3::jsonb,$4)',
            [
              fixture.society,
              fixture.project.id,
              JSON.stringify([
                {
                  quote_id: quoteIds[0],
                  criterion_id: criteriaIds[0],
                  score: 8,
                },
                {
                  quote_id: quoteIds[0],
                  criterion_id: criteriaIds[1],
                  score: 6,
                },
              ]),
              'score-committee',
            ],
          ),
        { commit: true },
      );
      const own = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_scoring_get($1,$2) as data',
            [fixture.society, fixture.project.id],
          ),
      );
      expect(
        majorWorksScoringSchema.parse(own.rows[0]!.data).my_scores,
      ).toHaveLength(2);
      expect(
        await dbError(
          database.asRole('authenticated', { sub: resident }, (client) =>
            client.query('select public.major_works_scoring_get($1,$2)', [
              fixture.society,
              fixture.project.id,
            ]),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      const currentProject = await database.asSuperuser((client) =>
        client.query<{ updated_at: string }>(
          `select updated_at::text as updated_at
           from public.major_works_projects where id=$1`,
          [fixture.project.id],
        ),
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_scoring_transition(
               $1,$2,'close',null,$3,'score-close'
             )`,
            [
              fixture.society,
              fixture.project.id,
              currentProject.rows[0]!.updated_at,
            ],
          ),
        { commit: true },
      );
      const closed = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_scoring_get($1,$2) as data',
            [fixture.society, fixture.project.id],
          ),
      );
      const scoringClosed = majorWorksScoringSchema.parse(closed.rows[0]!.data);
      expect(scoringClosed.scoring_state).toBe('closed');
      expect(scoringClosed.my_scores).toEqual([]);
      expect(scoringClosed.quotes[0]).toMatchObject({
        id: quoteIds[0],
        weighted_average: 8.2,
        scorer_count: 2,
      });
    } finally {
      await database.drop();
    }
  });
});
