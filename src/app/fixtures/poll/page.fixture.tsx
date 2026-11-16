// Exercise poll screens with synthetic records and injected actions only.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import {
  PollAdminDetailView,
  PollAdminListView,
  NewPollView,
} from '@/components/poll/admin';
import { PollDraftEditor } from '@/components/poll/editor';
import {
  PollRepresentativesView,
  ResidentPollDetailView,
  ResidentPollListView,
} from '@/components/poll/resident';
import { PollRouteState } from '@/components/poll/shared';
import { Banner } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';
import type { ServerActionResult } from '@/core/actions/server-action';
import type {
  PollAdminList,
  PollAdminVote,
  PollExport,
  PollMemberList,
  PollMemberVote,
  PollParticipation,
  PollRepresentatives,
  PollResults,
  PollStatus,
  PollVotingType,
} from '@/core/poll/validation';

const roleSchema = z.enum(['resident', 'admin', 'committee']);
const scenarioSchema = z.enum([
  'list',
  'empty',
  'public-single',
  'public-multiple',
  'private-ballot',
  'public-live',
  'private-turnout',
  'completed-tie',
  'completed-no-winner',
  'admin-readiness',
  'admin-editor',
  'admin-roster',
  'representatives',
  'disabled',
  'denied',
  'error',
]);
type FixtureRole = z.infer<typeof roleSchema>;
type Scenario = z.infer<typeof scenarioSchema>;

const id = (number: string) =>
  `d0000000-0000-4000-8000-${number.padStart(12, '0')}`;
const OPENED = '2026-11-17T04:30:00.000Z';
const DEADLINE = '2099-11-18T18:29:00.000Z';
const COMPLETED = '2026-11-17T18:30:00.000Z';
const UNIT_A = id('1');
const UNIT_B = id('2');
const OPTION_YES = id('10');
const OPTION_NO = id('11');
const OFFICE_PRESIDENT = id('20');
const CANDIDATE_A = id('21');
const CANDIDATE_B = id('22');

const publicOptions = [
  { id: OPTION_YES, label: 'Improve the children’s play area', position: 0 },
  { id: OPTION_NO, label: 'Repair the main water pump', position: 1 },
];
const privateOffices = [
  {
    id: OFFICE_PRESIDENT,
    name: 'Committee chair',
    position: 0,
    candidates: [
      { id: CANDIDATE_A, name: 'Synthetic Candidate A', position: 0 },
      { id: CANDIDATE_B, name: 'Synthetic Candidate B', position: 1 },
    ],
  },
];

function memberVote(
  status: PollStatus,
  votingType: PollVotingType,
  selectionMode: 'single' | 'multiple' = 'single',
): PollMemberVote {
  return {
    vote: {
      id: id('100'),
      title:
        votingType === 'public'
          ? 'Choose a society improvement'
          : 'Committee chair election',
      instructions:
        votingType === 'private'
          ? 'Choose one candidate or None of the above for each office.'
          : 'Choose the option that best serves the society.',
      votingType,
      selectionMode,
      selectionLimit: selectionMode === 'single' ? 1 : null,
      status,
      opensAt: status === 'scheduled' ? '2099-11-18T04:30:00.000Z' : OPENED,
      closesAt: status === 'completed' ? COMPLETED : DEADLINE,
      completedAt: status === 'completed' ? COMPLETED : null,
      cancelledAt: null,
      cancellationReason: null,
      completionMode: status === 'completed' ? 'deadline' : null,
      completionReason: null,
    },
    options:
      status === 'scheduled' || votingType === 'private' ? null : publicOptions,
    offices:
      status === 'scheduled' || votingType === 'public' ? null : privateOffices,
    units: [
      {
        unitId: UNIT_A,
        unitLabel: 'A-101',
        representativeName: 'Synthetic Resident A',
        isRepresentative: true,
        submitted: status === 'completed',
        myOptionIds:
          votingType === 'public' && status !== 'scheduled'
            ? [OPTION_YES]
            : null,
      },
      {
        unitId: UNIT_B,
        unitLabel: 'B-202',
        representativeName: 'Synthetic Resident B',
        isRepresentative: false,
        submitted: true,
        myOptionIds: null,
      },
    ],
  };
}

function result(
  votingType: PollVotingType,
  status: PollStatus,
  outcome: 'tie' | 'winner' | 'no-winner' = 'winner',
): PollResults {
  const completed = status === 'completed';
  return {
    voteId: id('100'),
    votingType,
    status,
    selectionMode: 'single',
    eligible: 12,
    submitted: completed ? 8 : 5,
    options:
      votingType === 'public'
        ? [
            {
              id: OPTION_YES,
              label: 'Improve the children’s play area',
              count: outcome === 'tie' ? 4 : completed ? 6 : 3,
            },
            {
              id: OPTION_NO,
              label: 'Repair the main water pump',
              count: outcome === 'tie' ? 4 : completed ? 2 : 2,
            },
          ]
        : null,
    offices:
      votingType === 'private' && completed
        ? [
            {
              id: OFFICE_PRESIDENT,
              name: 'Committee chair',
              candidates: [
                {
                  id: CANDIDATE_A,
                  name: 'Synthetic Candidate A',
                  count:
                    outcome === 'no-winner' ? 0 : outcome === 'tie' ? 3 : 6,
                },
                {
                  id: CANDIDATE_B,
                  name: 'Synthetic Candidate B',
                  count: outcome === 'tie' ? 3 : 0,
                },
              ],
              notaCount: outcome === 'no-winner' ? 8 : 2,
            },
          ]
        : null,
    responses:
      votingType === 'public' && completed
        ? Array.from({ length: 8 }, (_, index) => ({
            unitLabel: `A-${String(index + 1).padStart(3, '0')}`,
            representativeName: `Synthetic Resident ${index + 1}`,
            optionIds: [
              outcome === 'tie'
                ? index < 4
                  ? OPTION_YES
                  : OPTION_NO
                : index < 6
                  ? OPTION_YES
                  : OPTION_NO,
            ],
          }))
        : null,
  };
}

function adminVote(
  status: PollStatus,
  votingType: PollVotingType = 'public',
  canManage = true,
): PollAdminVote {
  const member = memberVote(status, votingType);
  return {
    canManage,
    vote: {
      ...member.vote,
      revision: 3,
      tenantVotingOverride: null,
      tenantVoting: status === 'draft' ? null : false,
      tenantVotingEffective: false,
      blockIds: [],
      createdAt: OPENED,
      scheduledAt: null,
      activatedAt: status === 'active' ? OPENED : null,
      withdrawnAt: null,
      withdrawalReason: null,
    },
    options: votingType === 'public' ? publicOptions : [],
    offices: votingType === 'private' ? privateOffices : [],
    readiness: {
      ready: status !== 'draft',
      issues: status === 'draft' ? ['electorate_empty'] : [],
    },
    electoratePreview:
      status === 'draft'
        ? {
            eligibleUnits: 0,
            unitsWithoutVoter: [
              { unitId: UNIT_A, unitLabel: 'A-101' },
              { unitId: UNIT_B, unitLabel: 'B-202' },
            ],
          }
        : null,
    turnout: status === 'draft' ? null : { eligible: 12, submitted: 5 },
  };
}

const list: PollMemberList = {
  votes: [
    {
      id: id('100'),
      title: 'Choose a society improvement',
      votingType: 'public',
      status: 'active',
      opensAt: OPENED,
      closesAt: DEADLINE,
      completedAt: null,
      cancelledAt: null,
      units: [
        {
          unitId: UNIT_A,
          unitLabel: 'A-101',
          isRepresentative: true,
          submitted: false,
        },
      ],
    },
    {
      id: id('101'),
      title: 'Committee chair election',
      votingType: 'private',
      status: 'completed',
      opensAt: OPENED,
      closesAt: COMPLETED,
      completedAt: COMPLETED,
      cancelledAt: null,
      units: [
        {
          unitId: UNIT_A,
          unitLabel: 'A-101',
          isRepresentative: true,
          submitted: true,
        },
      ],
    },
    {
      id: id('102'),
      title: 'Scheduled fire-safety poll',
      votingType: 'public',
      status: 'scheduled',
      opensAt: DEADLINE,
      closesAt: '2099-11-20T18:29:00.000Z',
      completedAt: null,
      cancelledAt: null,
      units: [
        {
          unitId: UNIT_A,
          unitLabel: 'A-101',
          isRepresentative: true,
          submitted: false,
        },
      ],
    },
  ],
};

const adminList: PollAdminList = {
  canManage: true,
  votes: [
    {
      id: id('100'),
      title: 'Choose a society improvement',
      votingType: 'public',
      status: 'draft',
      opensAt: null,
      closesAt: DEADLINE,
      completedAt: null,
      cancelledAt: null,
      eligible: null,
      submitted: null,
      updatedAt: OPENED,
    },
  ],
};

const participation: PollParticipation = {
  eligible: 12,
  submitted: 5,
  units: [
    {
      unitId: UNIT_A,
      unitLabel: 'A-101',
      representativeName: 'Synthetic Resident A',
      submitted: true,
    },
    {
      unitId: UNIT_B,
      unitLabel: 'B-202',
      representativeName: 'Synthetic Resident B',
      submitted: false,
    },
  ],
};

const representatives: PollRepresentatives & { canSetRepresentative: boolean } =
  {
    canManageAll: true,
    canSetRepresentative: true,
    units: [
      {
        unitId: UNIT_A,
        unitLabel: 'A-101',
        blockName: 'Tower A',
        version: 2,
        designated: null,
        effective: {
          membershipId: id('30'),
          name: 'Synthetic Resident A',
          relationship: 'owner',
        },
        options: [
          {
            membershipId: id('30'),
            name: 'Synthetic Resident A',
            relationship: 'owner',
            isPrimary: true,
          },
          {
            membershipId: id('31'),
            name: 'Synthetic Tenant B',
            relationship: 'tenant',
            isPrimary: false,
          },
        ],
      },
    ],
  };

const completedPrivateExport: PollExport = {
  societyName: 'Synthetic Society',
  vote: {
    id: id('100'),
    title: 'Committee chair election',
    votingType: 'private',
    selectionMode: 'single',
    selectionLimit: 1,
    opensAt: OPENED,
    closesAt: COMPLETED,
    completedAt: COMPLETED,
    completionMode: 'deadline',
  },
  eligible: 12,
  submitted: 8,
  options: null,
  offices: result('private', 'completed', 'no-winner').offices,
  responses: null,
  roster: [
    { unitLabel: 'A-101', representativeName: 'Synthetic Resident A' },
    { unitLabel: 'B-202', representativeName: 'Synthetic Resident B' },
  ],
};

const successAction = async (): Promise<ServerActionResult<unknown>> => ({
  ok: true,
  message: 'Synthetic action complete. Nothing was saved.',
});
const createAction = async (
  form: FormData,
): Promise<ServerActionResult<unknown>> => {
  const input = form.get('input');
  if (typeof input !== 'string') {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'Invalid fixture input.',
    };
  }
  const parsed = JSON.parse(input) as { votingType?: PollVotingType };
  return {
    ok: true,
    message: 'Synthetic draft created. Nothing was saved.',
    data: { voteId: id('100'), revision: 1, votingType: parsed.votingType },
  };
};

const actions = {
  activate: successAction,
  schedule: successAction,
  withdraw: successAction,
  extendDeadline: successAction,
  completeEarly: successAction,
  cancel: successAction,
  deleteDraft: successAction,
};

export default function PollFixturePage() {
  const [role, setRole] = useState<FixtureRole>('resident');
  const [scenario, setScenario] = useState<Scenario>('list');
  const restrictedForCommittee =
    role === 'committee' &&
    (scenario === 'admin-editor' || scenario === 'representatives');
  const routeState = restrictedForCommittee
    ? 'denied'
    : ['disabled', 'denied', 'error'].includes(scenario)
      ? scenario
      : null;
  const current = (() => {
    switch (scenario) {
      case 'public-single':
      case 'public-live':
        return {
          detail: memberVote('active', 'public'),
          results:
            scenario === 'public-live' ? result('public', 'active') : null,
        };
      case 'public-multiple':
        return {
          detail: memberVote('active', 'public', 'multiple'),
          results: null,
        };
      case 'private-ballot':
        return {
          detail: memberVote('active', 'private'),
          results: result('private', 'active'),
        };
      case 'private-turnout':
        return {
          detail: memberVote('active', 'private'),
          results: result('private', 'active'),
        };
      case 'completed-tie':
        return {
          detail: memberVote('completed', 'public'),
          results: result('public', 'completed', 'tie'),
        };
      case 'completed-no-winner':
        return {
          detail: memberVote('completed', 'private'),
          results: result('private', 'completed', 'no-winner'),
        };
      default:
        return null;
    }
  })();

  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic Polls & Voting fixture" tone="info">
          Sample residents, ballots, results and actions only. No hosted Auth,
          database writes or notifications.
        </Banner>
        <div className="grid gap-space-4 medium:grid-cols-2">
          <SelectInput
            id="poll-fixture-role"
            label="Fixture role"
            value={role}
            options={roleSchema.options.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(event) =>
              setRole(roleSchema.parse(event.currentTarget.value))
            }
          />
          <SelectInput
            id="poll-fixture-scenario"
            label="Fixture screen"
            value={scenario}
            options={scenarioSchema.options.map((value) => ({
              value,
              label: value.replaceAll('-', ' '),
            }))}
            onChange={(event) =>
              setScenario(scenarioSchema.parse(event.currentTarget.value))
            }
          />
        </div>
      </header>
      <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
        {routeState ? (
          <PollRouteState
            kind={routeState as 'disabled' | 'denied' | 'error'}
            returnHref="/fixtures/poll"
            retryHref={routeState === 'error' ? '/fixtures/poll' : undefined}
            referenceId={routeState === 'error' ? 'ERR-F1A2B3C4D5' : undefined}
          />
        ) : role === 'resident' ? (
          scenario === 'empty' ? (
            <ResidentPollListView polls={{ votes: [] }} />
          ) : scenario === 'list' ? (
            <ResidentPollListView polls={list} />
          ) : scenario === 'representatives' ? (
            <PollRepresentativesView
              representatives={representatives}
              action={successAction}
            />
          ) : current ? (
            <ResidentPollDetailView
              detail={current.detail}
              results={current.results}
              now={OPENED}
              publicAction={successAction}
              privateAction={successAction}
            />
          ) : (
            <ResidentPollListView polls={list} />
          )
        ) : scenario === 'admin-editor' ? (
          <PollDraftEditor
            detail={adminVote('draft', 'private')}
            blocks={[
              { id: id('40'), name: 'Tower A' },
              { id: id('41'), name: 'Tower B' },
            ]}
            action={successAction}
          />
        ) : scenario === 'admin-readiness' ? (
          <PollAdminDetailView
            detail={adminVote('draft', 'public', role === 'admin')}
            participation={null}
            results={null}
            actions={actions}
          />
        ) : scenario === 'admin-roster' ? (
          <PollAdminDetailView
            detail={adminVote('active', 'public', role === 'admin')}
            participation={participation}
            results={result('public', 'active')}
            actions={actions}
          />
        ) : scenario === 'representatives' ? (
          <PollRepresentativesView
            representatives={representatives}
            action={successAction}
          />
        ) : (
          <>
            <PollAdminListView
              workspace={{ ...adminList, canManage: role === 'admin' }}
            />
            {role === 'admin' ? <NewPollView action={createAction} /> : null}
          </>
        )}
        {scenario === 'completed-no-winner' && role !== 'resident' ? (
          <section aria-label="Separate private-election voter roster">
            <h2 className="text-subheading">Separate voter roster fixture</h2>
            <ul className="list-disc pl-space-5">
              {completedPrivateExport.roster?.map((voter) => (
                <li key={voter.unitLabel}>
                  {voter.unitLabel} · {voter.representativeName}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}
