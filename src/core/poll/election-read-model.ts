// Validate P46 official-election read models returned by caller-session RPCs.
import { z } from 'zod';

const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const date = z.iso.date();
const stage = z.enum([
  'planning',
  'nominations_open',
  'scrutiny',
  'candidates_published',
  'voting',
  'counted',
  'declared',
  'closed',
  'cancelled',
]);
const legalType = z.enum(['apartment_association', 'cooperative']);
const nomination = z.object({
  id: uuid,
  post_id: uuid,
  candidate_user_id: uuid,
  candidate_name: z.string(),
  unit_id: uuid,
  status: z.enum(['pending', 'accepted', 'rejected', 'withdrawn']),
  decision_reason: z.string().nullable(),
  supporters: z.array(
    z.object({
      id: uuid,
      kind: z.enum(['proposer', 'seconder']),
      supporter_user_id: uuid,
      supporter_name: z.string(),
      status: z.enum(['pending', 'confirmed', 'declined']),
    }),
  ),
});

const candidate = z.object({
  nomination_id: uuid,
  candidate_user_id: uuid,
  candidate_name: z.string(),
  status: z.enum(['pending', 'accepted', 'rejected', 'withdrawn']),
  decision_reason: z.string().nullable(),
});

const electionBase = z.object({
  id: uuid,
  title: z.string(),
  society_name: z.string().optional(),
  legal_type: legalType,
  stage,
  source: z.enum(['in_app', 'outside_app']),
  revision: z.number().int().positive(),
  nominations_open_at: timestamp.nullable(),
  nominations_close_at: timestamp.nullable(),
  voting_opens_at: timestamp.nullable(),
  voting_closes_at: timestamp.nullable(),
  declared_at: timestamp.nullable(),
});

export const pollElectionListSchema = z.object({
  can_manage: z.boolean(),
  elections: z.array(electionBase),
});

export const pollElectionDetailSchema = electionBase.extend({
  outside_held_on: date.nullable(),
  closed_at: timestamp.nullable(),
  cancelled_at: timestamp.nullable(),
  cancellation_reason: z.string().nullable(),
  dispute_window_days: z.number().int().min(1).max(30),
  multi_post_win_rule: z.enum(['candidate_choice', 'returning_officer']),
  can_manage: z.boolean(),
  is_officer: z.boolean(),
  actor_id: uuid,
  posts: z.array(
    z.object({
      id: uuid,
      name: z.string(),
      seats: z.number().int().positive(),
      position: z.number().int().positive(),
      balloted: z.boolean(),
      accepted_candidates: z.array(candidate),
    }),
  ),
  activities: z.array(
    z.object({
      id: uuid,
      title: z.string(),
      owner_name: z.string().nullable(),
      planned_on: date.nullable(),
      actual_on: date.nullable(),
      status: z.enum(['to_do', 'done', 'not_needed']),
      note: z.string().nullable(),
    }),
  ),
  links: z.array(
    z.object({
      id: uuid,
      source_type: z.enum(['notice', 'meeting', 'document']),
      source_id: uuid,
      title: z.string().nullable(),
    }),
  ),
  officer: z
    .object({
      id: uuid,
      profile_id: uuid.nullable(),
      name: z.string(),
      outside: z.boolean(),
      accepted: z.boolean(),
      access_ends_at: timestamp.nullable(),
    })
    .nullable(),
  helpers: z.array(z.object({ id: uuid, name: z.string(), role: z.string() })),
  voters: z.array(
    z.object({
      unit_id: uuid,
      unit_label: z.string(),
      membership_id: uuid,
      user_id: uuid,
      voter_name: z.string(),
      source: z.enum(['earliest_owner', 'admin_named']),
      removed: z.boolean(),
      removal_reason: z.string().nullable(),
      revision: z.number().int().positive(),
      owner_options: z.array(
        z.object({ membership_id: uuid, name: z.string() }),
      ),
    }),
  ),
  member_options: z.array(z.object({ user_id: uuid, name: z.string() })),
  source_options: z.object({
    notices: z.array(z.object({ id: uuid, title: z.string() })),
    meetings: z.array(z.object({ id: uuid, title: z.string() })),
    documents: z.array(z.object({ id: uuid, title: z.string() })),
  }),
  expense_options: z.array(z.object({ id: uuid, label: z.string() })),
  my_unit_id: uuid.nullable(),
  my_unit_has_voted: z.boolean(),
  nominations: z.array(nomination),
  results: z.array(
    z.object({
      post_id: uuid,
      post_name: z.string(),
      tallies: z
        .array(
          z.object({
            candidate_user_id: uuid.nullable(),
            candidate_name: z.string(),
            tally: z.number().int().nonnegative(),
          }),
        )
        .nullable(),
      winners: z.array(
        z.object({
          candidate_user_id: uuid.nullable(),
          candidate_name: z.string().nullable(),
          unopposed: z.boolean(),
        }),
      ),
    }),
  ),
  outside_results: z.array(
    z.object({
      id: uuid,
      post_id: uuid,
      winner_name: z.string(),
      votes_count: z.number().int().nonnegative().nullable(),
      document_id: uuid,
    }),
  ),
  participation_count: z.number().int().nonnegative(),
  voter_count: z.number().int().nonnegative(),
  voted_units: z.array(z.object({ unit_id: uuid, unit_label: z.string() })),
  dispute_count: z.number().int().nonnegative(),
  disputes: z.array(
    z.object({
      id: uuid,
      text: z.string(),
      file_path: z.string().nullable(),
      file_url: z.string().nullable().optional(),
      status: z.enum(['open', 'under_review', 'resolved', 'rejected']),
      resolution_note: z.string().nullable(),
      created_at: timestamp,
      raised_by: uuid,
    }),
  ),
  total_cost_paise: z.number().int().nonnegative(),
  expense_links: z.array(
    z.object({
      id: uuid,
      expense_id: uuid,
      description: z.string().nullable(),
      amount_paise: z.number().int().positive(),
      spent_on: date,
    }),
  ),
});

export const pollElectionOfficerAssignmentsSchema = z.array(
  z.object({
    election_id: uuid,
    society_id: uuid,
    title: z.string(),
    stage,
    access_ends_at: timestamp.nullable(),
    requires_confirmation: z.boolean(),
  }),
);

export type PollElectionList = z.infer<typeof pollElectionListSchema>;
export type PollElectionDetail = z.infer<typeof pollElectionDetailSchema>;
