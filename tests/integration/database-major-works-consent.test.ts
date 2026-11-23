// Verify P50.5 owner eligibility, admin overrides, poll application and privacy.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';
import {
  majorWorksConsentViewSchema,
  majorWorksMyConsentsSchema,
} from '../../src/core/major-works/validation';

describe.skipIf(!hasDatabase)('database major works consent', () => {
  it('copies completed public-poll answers without replacing admin records', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of ['admin', 'owner1', 'owner2', 'committee']) {
          const id = await newAuthUser(
            client,
            `works-consent-${role}@example.test`,
          );
          await client.query(
            'insert into public.profiles(id,email,full_name) values($1,$2,$3)',
            [id, `works-consent-${role}@example.test`, `Consent ${role}`],
          );
          users.set(role, id);
        }
        const society = (
          await client.query<{ id: string }>(
            'insert into public.societies(name,created_by) values($1,$2) returning id',
            ['Consent Society', users.get('admin')],
          )
        ).rows[0]!.id;
        const memberships = new Map<string, string>();
        for (const role of ['admin', 'owner1', 'owner2', 'committee']) {
          const membership = (
            await client.query<{ id: string }>(
              `insert into public.memberships(
                 society_id,user_id,roles,status
               ) values($1,$2,$3,'active') returning id`,
              [
                society,
                users.get(role),
                role === 'admin'
                  ? ['admin']
                  : role === 'committee'
                    ? ['committee']
                    : ['resident'],
              ],
            )
          ).rows[0]!.id;
          memberships.set(role, membership);
        }
        await client.query(
          `insert into public.module_configs(
             society_id,module_key,enabled,settings
           ) values
             ($1,'core',true,'{}'),
             ($1,'poll',true,'{}'),
             ($1,'major_works',true,'{"consent_method":"poll"}')`,
          [society],
        );
        const units = await client.query<{ id: string; number: string }>(
          `insert into public.units(society_id,number,created_by)
           values($1,'C-101',$2),($1,'C-102',$2) returning id,number`,
          [society, users.get('admin')],
        );
        for (const [index, role] of ['owner1', 'owner2'].entries()) {
          await client.query(
            `insert into public.unit_occupants(
               society_id,unit_id,membership_id,relationship,is_primary,
               status,created_by
             ) values($1,$2,$3,'owner',true,'active',$4)`,
            [
              society,
              units.rows[index]!.id,
              memberships.get(role),
              users.get('admin'),
            ],
          );
        }
        const proposal = (
          await client.query<{ id: string }>(
            `insert into public.major_works_proposals(
               society_id,developer_name,received_on,client_request_id,created_by
             ) values($1,'Consent Developer','2026-11-01',$2,$3) returning id`,
            [society, crypto.randomUUID(), users.get('admin')],
          )
        ).rows[0]!.id;
        return {
          society,
          users,
          memberships,
          units: units.rows,
          proposal,
        };
      });
      const admin = fixture.users.get('admin')!;
      const committee = fixture.users.get('committee')!;
      const owner1 = fixture.users.get('owner1')!;
      const proposalInitial = await database.asSuperuser((client) =>
        client.query<{ updated_at: string }>(
          `select updated_at::text as updated_at
           from public.major_works_proposals where id=$1`,
          [fixture.proposal],
        ),
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_proposal_stage_set(
               $1,$2,'under_review',null,$3,$4,'consent-review'
             )`,
            [
              fixture.society,
              fixture.proposal,
              proposalInitial.rows[0]!.updated_at,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );
      const before = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_consents_get($1,$2) as data',
            [fixture.society, fixture.proposal],
          ),
      );
      const pending = majorWorksConsentViewSchema.parse(before.rows[0]!.data);
      expect(pending.records).toHaveLength(2);
      const unitOne = pending.records.find(
        (record) => record.unit_number === 'C-101',
      )!;
      const pollCreate = await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_consent_poll_create(
               $1,$2,true,$3,'consent-poll'
             ) as poll_id`,
            [fixture.society, fixture.proposal, crypto.randomUUID()],
          ),
        { commit: true },
      );
      const pollId = pollCreate.rows[0]!.poll_id as string;
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_consent_record(
               $1,$2,$3,'does_not_consent',null,$4,$5,'consent-admin'
             )`,
            [
              fixture.society,
              fixture.proposal,
              unitOne.unit_id,
              unitOne.version,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );

      await database.asSuperuser(async (client) => {
        await client.query(
          "select set_config('poll.lifecycle_write','on',false)",
        );
        const options = await client.query<{ id: string; label: string }>(
          `select id,label from public.poll_options
           where society_id=$1 and vote_id=$2 order by position`,
          [fixture.society, pollId],
        );
        await client.query(
          `update public.poll_votes
           set status='active',tenant_voting=false,
               opens_at=now()-interval '1 day',
               closes_at=now()+interval '1 day',
               activated_at=now()-interval '1 day'
           where society_id=$1 and id=$2`,
          [fixture.society, pollId],
        );
        await client.query('begin');
        for (const [index, unit] of fixture.units.entries()) {
          const role = index === 0 ? 'owner1' : 'owner2';
          const membershipId = fixture.memberships.get(role)!;
          await client.query(
            `insert into public.poll_electorate(
               society_id,vote_id,unit_id,membership_id,user_id,
               representative_name,unit_label
             ) values($1,$2,$3,$4,$5,$6,$7)`,
            [
              fixture.society,
              pollId,
              unit.id,
              membershipId,
              fixture.users.get(role),
              `Synthetic ${role}`,
              unit.number,
            ],
          );
          await client.query(
            `insert into public.poll_participation(
               society_id,vote_id,unit_id
             ) values($1,$2,$3)`,
            [fixture.society, pollId, unit.id],
          );
          await client.query(
            `insert into public.poll_public_responses(
               society_id,vote_id,unit_id,option_id
             ) values($1,$2,$3,$4)`,
            [fixture.society, pollId, unit.id, options.rows[0]!.id],
          );
        }
        await client.query(
          `update public.poll_votes
           set status='completed',
               completed_at=now(),
               completion_mode='early',
               completion_reason='Synthetic close',
               final_eligible_count=2,
               final_submitted_count=2
           where society_id=$1 and id=$2`,
          [fixture.society, pollId],
        );
        await client.query('commit');
      });
      const after = await database.asRole(
        'authenticated',
        { sub: committee },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_consents_get($1,$2) as data',
            [fixture.society, fixture.proposal],
          ),
      );
      const consents = majorWorksConsentViewSchema.parse(after.rows[0]!.data);
      expect(
        consents.records.find((record) => record.unit_number === 'C-101'),
      ).toMatchObject({
        status: 'does_not_consent',
        method: 'admin',
      });
      expect(
        consents.records.find((record) => record.unit_number === 'C-102'),
      ).toMatchObject({
        status: 'consents',
        method: 'poll',
      });
      const mine = await database.asRole(
        'authenticated',
        { sub: owner1 },
        (client) =>
          client.query<{ data: unknown }>(
            'select public.major_works_my_consents_get($1) as data',
            [fixture.society],
          ),
      );
      expect(
        majorWorksMyConsentsSchema.parse(mine.rows[0]!.data).consents,
      ).toEqual([
        {
          proposal_id: fixture.proposal,
          developer_name: 'Consent Developer',
          unit_id: fixture.units[0]!.id,
          unit_number: 'C-101',
          status: 'does_not_consent',
          method: 'admin',
        },
      ]);
      expect(
        await dbError(
          database.asRole('authenticated', { sub: owner1 }, (client) =>
            client.query('select public.major_works_consents_get($1,$2)', [
              fixture.society,
              fixture.proposal,
            ]),
          ),
        ),
      ).toMatchObject({ code: '42501' });
      let proposalVersion = await database.asSuperuser((client) =>
        client.query<{ updated_at: string }>(
          `select updated_at::text as updated_at
           from public.major_works_proposals where id=$1`,
          [fixture.proposal],
        ),
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_proposal_stage_set(
               $1,$2,'shortlisted',null,$3,$4,'consent-shortlist'
             )`,
            [
              fixture.society,
              fixture.proposal,
              proposalVersion.rows[0]!.updated_at,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );
      proposalVersion = await database.asSuperuser((client) =>
        client.query<{ updated_at: string }>(
          `select updated_at::text as updated_at
           from public.major_works_proposals where id=$1`,
          [fixture.proposal],
        ),
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_proposal_stage_set(
               $1,$2,'selected',null,$3,$4,'consent-select'
             )`,
            [
              fixture.society,
              fixture.proposal,
              proposalVersion.rows[0]!.updated_at,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );
      proposalVersion = await database.asSuperuser((client) =>
        client.query<{ updated_at: string }>(
          `select updated_at::text as updated_at
           from public.major_works_proposals where id=$1`,
          [fixture.proposal],
        ),
      );
      await database.asRole(
        'authenticated',
        { sub: admin },
        (client) =>
          client.query(
            `select public.major_works_proposal_archive(
               $1,$2,$3,$4,'consent-archive'
             )`,
            [
              fixture.society,
              fixture.proposal,
              proposalVersion.rows[0]!.updated_at,
              crypto.randomUUID(),
            ],
          ),
        { commit: true },
      );
      const purged = await database.asRole(
        'service_role',
        null,
        (client) =>
          client.query<{ result: { purged: number } }>(
            'select public.major_works_retention_run($1,$2,$3) as result',
            [fixture.society, '2035-01-01', 'consent-retention'],
          ),
        { commit: true },
      );
      expect(purged.rows[0]!.result.purged).toBe(1);
      const retained = await database.asSuperuser((client) =>
        client.query<{
          proposal_count: string;
          consent_count: string;
          poll_count: string;
        }>(
          `select
             (select count(*) from public.major_works_proposals where id=$1)::text as proposal_count,
             (select count(*) from public.major_works_consents where proposal_id=$1)::text as consent_count,
             (select count(*) from public.poll_votes where id=$2)::text as poll_count`,
          [fixture.proposal, pollId],
        ),
      );
      expect(retained.rows[0]).toEqual({
        proposal_count: '1',
        consent_count: '0',
        poll_count: '1',
      });
    } finally {
      await database.drop();
    }
  });
});
