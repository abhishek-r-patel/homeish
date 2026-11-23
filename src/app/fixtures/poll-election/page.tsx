// Exercise P46 official-election forms without database writes.
'use client';
import type { ZodType } from 'zod';
import { Banner } from '@/components/ui/feedback';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import {
  PollElectionEditorForm,
  PollOfficialVotingForm,
} from '@/components/poll/election-admin-forms';
import {
  PollElectionBallotForm,
  PollElectionNominationForm,
} from '@/components/poll/election-resident';
import {
  pollElectionBallotInputSchema,
  pollElectionNominationInputSchema,
  pollElectionSaveInputSchema,
  pollOfficialVotingInputSchema,
} from '@/core/poll/election-inputs';
import type { PollElectionDetail } from '@/core/poll/election-read-model';

const id = '00000000-0000-4000-8000-000000000301';
const candidate = '00000000-0000-4000-8000-000000000302';
const unit = '00000000-0000-4000-8000-000000000303';
const election: PollElectionDetail = {
  id,
  society_name: 'Synthetic Society',
  title: 'Synthetic committee election',
  legal_type: 'cooperative',
  stage: 'voting',
  source: 'in_app',
  revision: 5,
  nominations_open_at: '2026-11-01T00:00:00.000Z',
  nominations_close_at: '2026-11-10T00:00:00.000Z',
  voting_opens_at: '2026-11-11T00:00:00.000Z',
  voting_closes_at: '2026-12-11T00:00:00.000Z',
  outside_held_on: null,
  declared_at: null,
  closed_at: null,
  cancelled_at: null,
  cancellation_reason: null,
  dispute_window_days: 5,
  multi_post_win_rule: 'candidate_choice',
  can_manage: true,
  is_officer: false,
  actor_id: candidate,
  posts: [
    {
      id,
      name: 'Treasurer',
      seats: 1,
      position: 1,
      balloted: true,
      accepted_candidates: [
        {
          nomination_id: id,
          candidate_user_id: candidate,
          candidate_name: 'Synthetic Candidate',
          status: 'accepted',
          decision_reason: null,
        },
      ],
    },
  ],
  activities: [],
  links: [],
  officer: null,
  helpers: [],
  voters: [],
  member_options: [],
  source_options: { notices: [], meetings: [], documents: [] },
  expense_options: [],
  my_unit_id: unit,
  my_unit_has_voted: false,
  nominations: [],
  results: [],
  outside_results: [],
  participation_count: 0,
  voter_count: 1,
  voted_units: [],
  dispute_count: 0,
  disputes: [],
  total_cost_paise: 0,
  expense_links: [],
};

function input(form: FormData): unknown {
  const value = form.get('input');
  return typeof value === 'string' ? JSON.parse(value) : null;
}

function accept(schema: ZodType, message: string): ModuleFormAction {
  return async (form) => {
    const parsed = schema.safeParse(input(form));
    return parsed.success
      ? { ok: true, message }
      : {
          ok: false,
          code: 'VALIDATION_FAILED' as const,
          message: parsed.error.issues[0]?.message ?? 'Invalid.',
        };
  };
}

export default function PollElectionFixturePage() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
      <Banner title="Synthetic P46 fixture" tone="info">
        Development-only simulated actions. No database writes.
      </Banner>
      <h1 className="text-title font-semibold">Official election controls</h1>
      <section
        aria-label="Official voting setting"
        className="grid gap-space-3"
      >
        <h2 className="text-heading font-semibold">Official voting setting</h2>
        <PollOfficialVotingForm
          settings={{
            official_voting_enabled: true,
            official_legal_type: 'cooperative',
          }}
          action={accept(
            pollOfficialVotingInputSchema,
            'Official voting setting saved.',
          )}
          refresh={false}
        />
      </section>
      <section aria-label="Election editor" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Election editor</h2>
        <PollElectionEditorForm
          action={accept(
            pollElectionSaveInputSchema,
            'Official election saved.',
          )}
          refresh={false}
        />
      </section>
      <section aria-label="Owner nomination" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Owner nomination</h2>
        <PollElectionNominationForm
          election={election}
          action={accept(
            pollElectionNominationInputSchema,
            'Nomination submitted.',
          )}
          refresh={false}
        />
      </section>
      <section aria-label="Secret ballot" className="grid gap-space-3">
        <h2 className="text-heading font-semibold">Secret ballot</h2>
        <PollElectionBallotForm
          election={election}
          action={accept(pollElectionBallotInputSchema, 'Ballot submitted.')}
          refresh={false}
        />
      </section>
    </main>
  );
}
