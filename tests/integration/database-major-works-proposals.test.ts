// Verify P50.4 proposal terms, stage history and private admin/committee reads.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';
import { majorWorksProposalsSchema } from '../../src/core/major-works/validation';

describe.skipIf(!hasDatabase)('database major works proposals', () => {
  it('keeps offer terms factual and enforces proposal stage transitions', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of ['admin', 'committee', 'resident']) {
          const id = await newAuthUser(
            client,
            `works-offer-${role}@example.test`,
          );
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `works-offer-${role}@example.test`, `Offer ${role}`],
          );
          users.set(role, id);
        }
        const society = (
          await client.query<{ id: string }>(
            'insert into public.societies(name,created_by) values($1,$2) returning id',
            ['Proposal Society', users.get('admin')],
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
        return { society, users };
      });
      const admin = fixture.users.get('admin')!;
      const committee = fixture.users.get('committee')!;
      const resident = fixture.users.get('resident')!;
      const createRequest = crypto.randomUUID();
      const saved = await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query<{ id: string }>(
            `select public.major_works_proposal_save(
               $1,null,'Synthetic Developer','2026-11-01','2026-12-01',
               1250,5000000,75000000,24,100000000,
               'Developer-stated terms',null,$2,'proposal-create'
             ) as id`,
            [fixture.society, createRequest],
          ),
        { commit: true },
      );
      const proposalId = saved.rows[0]!.id;
      const replay = await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query<{ id: string }>(
            `select public.major_works_proposal_save(
               $1,null,'Synthetic Developer','2026-11-01','2026-12-01',
               1250,5000000,75000000,24,100000000,
               'Developer-stated terms',null,$2,'proposal-create-retry'
             ) as id`,
            [fixture.society, createRequest],
          ),
        { commit: true },
      );
      expect(replay.rows[0]!.id).toBe(proposalId);
      const initial = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_proposals_list($1) as data',
            [fixture.society],
          ),
      );
      const list = majorWorksProposalsSchema.parse(initial.rows[0]!.data);
      expect(list.proposals[0]).toMatchObject({
        id: proposalId,
        developer_name: 'Synthetic Developer',
        stage: 'received',
        extra_area_bp: 1250,
        timeline_months: 24,
      });
      expect(
        await dbError(
          database.asRole('authenticated', { sub: resident }, (client) =>
            client.query('select public.major_works_proposals_list($1)', [
              fixture.society,
            ]),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_proposal_stage_set(
               $1,$2,'under_review',null,$3,$4,'proposal-stage'
             )`,
            [
              fixture.society,
              proposalId,
              list.proposals[0]!.updated_at,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );
      const events = await database.asSuperuser((client) =>
        client.query(
          `select action from public.major_works_proposal_events
           where society_id=$1 and proposal_id=$2 order by created_at`,
          [fixture.society, proposalId],
        ),
      );
      expect(events.rows.map((row) => row.action)).toEqual(['create', 'stage']);
    } finally {
      await database.drop();
    }
  });
});
