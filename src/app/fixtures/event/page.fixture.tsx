// Exercise Events & RSVPs screens with synthetic records and injected actions only.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import {
  EventAdminDetailView,
  EventAdminListView,
  type EventAdminActions,
  type EventAdminWorkspace,
} from '@/components/event/admin';
import { EventEditor } from '@/components/event/editor';
import {
  ResidentEventDetailView,
  ResidentEventListView,
} from '@/components/event/resident';
import { EventRouteState } from '@/components/event/shared';
import { Banner } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';
import type { ServerActionResult } from '@/core/actions/server-action';
import type {
  EventAdminDetail,
  EventBlockOption,
  EventMemberDetail,
  EventMemberList,
  EventStatus,
} from '@/core/event/validation';

const roleSchema = z.enum(['resident', 'admin', 'committee']);
const scenarioSchema = z.enum([
  'list',
  'empty',
  'resident-open',
  'resident-full',
  'resident-closed',
  'resident-cancelled',
  'admin-draft',
  'admin-published',
  'admin-cancelled',
  'admin-editor',
  'admin-new',
  'disabled',
  'denied',
  'error',
]);
type FixtureRole = z.infer<typeof roleSchema>;
type Scenario = z.infer<typeof scenarioSchema>;

const id = (number: string) =>
  `f0000000-0000-4000-8000-${number.padStart(12, '0')}`;
const STARTS = '2099-12-20T12:30:00.000Z';
const ENDS = '2099-12-20T16:30:00.000Z';
const DEADLINE = '2099-12-18T12:30:00.000Z';
const PAST_STARTS = '2026-01-26T03:30:00.000Z';
const PAST_ENDS = '2026-01-26T06:30:00.000Z';
const RESPONDED = '2099-12-01T05:00:00.000Z';
const EVENT = id('1');
const UNIT_A = id('11');
const UNIT_B = id('12');
const UNIT_C = id('13');
const BLOCK_A = id('21');
const BLOCK_B = id('22');

const successAction = async (): Promise<ServerActionResult<unknown>> => ({
  ok: true,
  message: 'Synthetic action complete. Nothing was saved.',
});

const adminActions: EventAdminActions = {
  publish: successAction,
  cancel: successAction,
  deleteDraft: successAction,
};

const blocks: EventBlockOption[] = [
  { blockId: BLOCK_A, name: 'Tower A' },
  { blockId: BLOCK_B, name: 'Tower B' },
];

const memberList: EventMemberList = {
  items: [
    {
      id: EVENT,
      title: 'New Year community dinner',
      status: 'published',
      startsAt: STARTS,
      endsAt: ENDS,
      venue: 'Clubhouse lawn',
      past: false,
      rsvpClosesAt: DEADLINE,
      contributionType: 'per_head',
      contributionPaise: 25_000,
      myRsvp: { unitId: UNIT_A, status: 'going', headcount: 2 },
    },
    {
      id: id('2'),
      title: 'Children’s drawing competition',
      status: 'published',
      startsAt: STARTS,
      endsAt: ENDS,
      venue: null,
      past: false,
      rsvpClosesAt: STARTS,
      contributionType: 'none',
      contributionPaise: 0,
      myRsvp: null,
    },
    {
      id: id('3'),
      title: 'Morning yoga session',
      status: 'cancelled',
      startsAt: STARTS,
      endsAt: ENDS,
      venue: 'Terrace garden',
      past: false,
      rsvpClosesAt: STARTS,
      contributionType: 'per_unit',
      contributionPaise: 10_000,
      myRsvp: { unitId: UNIT_A, status: 'not_going', headcount: 0 },
    },
  ],
};

type MemberScenario = 'open' | 'full' | 'closed' | 'cancelled';

function memberDetail(scenario: MemberScenario): EventMemberDetail {
  const cancelled = scenario === 'cancelled';
  const rsvpOpen = scenario === 'open' || scenario === 'full';
  return {
    event: {
      id: EVENT,
      title: 'New Year community dinner',
      description:
        'Dinner and music for every home. Vegetarian and Jain food available.',
      status: cancelled ? 'cancelled' : 'published',
      venue: 'Clubhouse lawn',
      startsAt: STARTS,
      endsAt: ENDS,
      rsvpDeadline: DEADLINE,
      rsvpClosesAt: scenario === 'closed' ? PAST_STARTS : DEADLINE,
      rsvpOpen,
      capacity: 120,
      maxPerUnit: 6,
      contributionType: 'per_head',
      contributionPaise: 25_000,
      cancellationReason: cancelled
        ? 'Heavy rain is forecast, so the lawn cannot be used.'
        : null,
      past: false,
    },
    spotsLeft: scenario === 'full' ? 0 : 38,
    goingHeadcount: scenario === 'full' ? 120 : 82,
    myUnits: [
      {
        unitId: UNIT_A,
        label: 'A-101',
        rsvp: {
          rsvpId: id('31'),
          status: 'going',
          headcount: 2,
          version: 1,
          netChargePaise: cancelled ? 0 : 50_000,
        },
        canRsvp: true,
      },
      {
        unitId: UNIT_B,
        label: 'B-201',
        rsvp: null,
        canRsvp: false,
      },
    ],
    billingEnabled: true,
  };
}

function adminDetail(status: EventStatus): EventAdminDetail {
  const draft = status === 'draft';
  const cancelled = status === 'cancelled';
  return {
    event: {
      id: EVENT,
      status,
      title: 'New Year community dinner',
      description:
        'Dinner and music for every home. Vegetarian and Jain food available.',
      venue: 'Clubhouse lawn',
      startsAt: STARTS,
      endsAt: ENDS,
      rsvpDeadline: DEADLINE,
      capacity: 120,
      maxPerUnit: 6,
      contributionType: 'per_head',
      contributionPaise: 25_000,
      audience: { scope: 'blocks', blockIds: [BLOCK_A, BLOCK_B] },
      past: false,
      version: 3,
      publishedAt: draft ? null : RESPONDED,
      cancelledAt: cancelled ? RESPONDED : null,
      cancellationReason: cancelled
        ? 'Heavy rain is forecast, so the lawn cannot be used.'
        : null,
    },
    totals: {
      goingUnits: draft ? 0 : 2,
      goingHeadcount: draft ? 0 : 5,
      notGoingUnits: draft ? 0 : 1,
      audienceUnits: draft ? 0 : 40,
      collectedPaise: draft || cancelled ? 0 : 125_000,
    },
    rsvps: draft
      ? []
      : [
          {
            rsvpId: id('31'),
            unitId: UNIT_A,
            unitLabel: 'A-101',
            status: 'going',
            headcount: 2,
            respondedByName: 'Synthetic Resident A',
            respondedAt: RESPONDED,
            netChargePaise: cancelled ? 0 : 50_000,
          },
          {
            rsvpId: id('32'),
            unitId: UNIT_B,
            unitLabel: 'B-201',
            status: 'going',
            headcount: 3,
            respondedByName: 'Synthetic Resident B',
            respondedAt: RESPONDED,
            netChargePaise: cancelled ? 0 : 75_000,
          },
          {
            rsvpId: id('33'),
            unitId: UNIT_C,
            unitLabel: 'B-202',
            status: 'not_going',
            headcount: 0,
            respondedByName: null,
            respondedAt: RESPONDED,
            netChargePaise: 0,
          },
        ],
    billingEnabled: true,
  };
}

const adminList: EventAdminWorkspace = {
  items: [
    {
      id: EVENT,
      title: 'New Year community dinner',
      status: 'published',
      startsAt: STARTS,
      endsAt: ENDS,
      venue: 'Clubhouse lawn',
      past: false,
      goingUnits: 2,
      goingHeadcount: 5,
      capacity: 120,
      contributionType: 'per_head',
      contributionPaise: 25_000,
    },
    {
      id: id('4'),
      title: 'Holi colours in the courtyard',
      status: 'draft',
      startsAt: STARTS,
      endsAt: ENDS,
      venue: null,
      past: false,
      goingUnits: 0,
      goingHeadcount: 0,
      capacity: null,
      contributionType: 'per_unit',
      contributionPaise: 30_000,
    },
    {
      id: id('5'),
      title: 'Republic Day flag hoisting',
      status: 'published',
      startsAt: PAST_STARTS,
      endsAt: PAST_ENDS,
      venue: 'Main gate',
      past: true,
      goingUnits: 31,
      goingHeadcount: 74,
      capacity: null,
      contributionType: 'none',
      contributionPaise: 0,
    },
  ],
  total: 3,
  billingEnabled: false,
};

export default function EventFixturePage() {
  const [role, setRole] = useState<FixtureRole>('resident');
  const [scenario, setScenario] = useState<Scenario>('list');
  const residentOnly = scenario.startsWith('resident-');
  const adminOnly = scenario.startsWith('admin-');
  const routeState =
    (role === 'resident' && adminOnly) || (role !== 'resident' && residentOnly)
      ? 'denied'
      : scenario === 'disabled' || scenario === 'denied' || scenario === 'error'
        ? scenario
        : null;

  const content = (() => {
    if (routeState) {
      return (
        <EventRouteState
          kind={routeState}
          returnHref="/fixtures/event"
          retryHref={routeState === 'error' ? '/fixtures/event' : undefined}
          referenceId={routeState === 'error' ? 'ERR-E1A2B3C4D5' : undefined}
        />
      );
    }
    if (role === 'resident') {
      switch (scenario) {
        case 'empty':
          return (
            <ResidentEventListView
              list={{ items: [] }}
              filter="upcoming"
              basePath="/fixtures/event"
            />
          );
        case 'resident-open':
        case 'resident-full':
        case 'resident-closed':
        case 'resident-cancelled':
          return (
            <ResidentEventDetailView
              key={scenario}
              detail={memberDetail(
                scenario.replace('resident-', '') as MemberScenario,
              )}
              rsvpAction={successAction}
              backHref="/fixtures/event"
            />
          );
        default:
          return (
            <ResidentEventListView
              list={memberList}
              filter="upcoming"
              basePath="/fixtures/event"
            />
          );
      }
    }
    switch (scenario) {
      case 'empty':
        return (
          <EventAdminListView
            workspace={{ items: [], total: 0, billingEnabled: true }}
            filter="upcoming"
            basePath="/fixtures/event"
          />
        );
      case 'admin-draft':
      case 'admin-published':
      case 'admin-cancelled':
        return (
          <EventAdminDetailView
            key={scenario}
            detail={adminDetail(scenario.replace('admin-', '') as EventStatus)}
            blocks={blocks}
            actions={adminActions}
            backHref="/fixtures/event"
          />
        );
      case 'admin-editor':
        return (
          <EventEditor
            detail={adminDetail('published')}
            blocks={blocks}
            billingEnabled
            action={successAction}
          />
        );
      case 'admin-new':
        return (
          <EventEditor
            detail={null}
            blocks={blocks}
            billingEnabled={false}
            action={successAction}
          />
        );
      default:
        return (
          <EventAdminListView
            workspace={adminList}
            filter="upcoming"
            basePath="/fixtures/event"
          />
        );
    }
  })();

  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic Events & RSVPs fixture" tone="info">
          Sample homes, events and RSVPs only. No hosted Auth, database writes,
          bills or notifications.
        </Banner>
        <div className="grid gap-space-4 medium:grid-cols-2">
          <SelectInput
            id="event-fixture-role"
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
            id="event-fixture-scenario"
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
        {content}
      </main>
    </>
  );
}
