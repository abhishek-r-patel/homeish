// Exercise Meetings & AGM screens with synthetic records and injected actions only.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import {
  MeetingAdminDetailView,
  MeetingAdminListView,
  MeetingSettingsView,
  type MeetingAdminActions,
  type MeetingAdminDetailModel,
} from '@/components/meeting/admin';
import { MeetingEditor } from '@/components/meeting/editor';
import {
  MyMeetingActionsView,
  ResidentMeetingDetailView,
  ResidentMeetingListView,
} from '@/components/meeting/resident';
import { MeetingRouteState } from '@/components/meeting/shared';
import { Banner } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  DEFAULT_MEETING_SETTINGS,
  type MeetingAdminList,
  type MeetingInviteeOptions,
  type MeetingMemberDetail,
  type MeetingMemberList,
  type MeetingMyAction,
  type MeetingStatus,
} from '@/core/meeting/validation';

const roleSchema = z.enum(['resident', 'admin', 'committee']);
const scenarioSchema = z.enum([
  'list',
  'empty',
  'resident-check-in',
  'resident-held',
  'resident-actions',
  'admin-editor',
  'admin-scheduled',
  'admin-held',
  'admin-published',
  'settings',
  'disabled',
  'denied',
  'error',
]);
type FixtureRole = z.infer<typeof roleSchema>;
type Scenario = z.infer<typeof scenarioSchema>;

const id = (number: string) =>
  `e0000000-0000-4000-8000-${number.padStart(12, '0')}`;
const NOW = '2026-11-20T04:30:00.000Z';
const STARTS = '2026-11-20T04:00:00.000Z';
const ENDS = '2026-11-20T06:00:00.000Z';
const FUTURE_STARTS = '2099-11-25T12:30:00.000Z';
const FUTURE_ENDS = '2099-11-25T14:30:00.000Z';
const MEETING = id('1');
const UNIT_A = id('11');
const UNIT_B = id('12');
const UNIT_C = id('13');
const UNIT_D = id('14');
const AGENDA_1 = id('21');
const AGENDA_2 = id('22');
const RESOLUTION_1 = id('31');
const RESOLUTION_2 = id('32');
const OWNER = id('41');
const POLL = id('51');
const FOLDER = id('61');

const settings = { ...DEFAULT_MEETING_SETTINGS };

const successAction = async (): Promise<ServerActionResult<unknown>> => ({
  ok: true,
  message: 'Synthetic action complete. Nothing was saved.',
});
const ownerSearchAction = async (): Promise<ServerActionResult<unknown>> => ({
  ok: true,
  message: '1 person found. Choose an owner below.',
  data: [
    {
      membershipId: OWNER,
      name: 'Synthetic Treasurer',
      roleLabel: 'Committee',
    },
  ],
});

const adminActions: MeetingAdminActions = {
  schedule: successAction,
  cancel: successAction,
  deleteDraft: successAction,
  markHeld: successAction,
  setCheckin: successAction,
  setAttendance: successAction,
  removeAttendance: successAction,
  saveResolution: successAction,
  deleteResolution: successAction,
  setOutcome: successAction,
  linkPoll: successAction,
  createPoll: successAction,
  saveMinutes: successAction,
  publishMinutes: successAction,
  retryCopy: successAction,
  saveAction: successAction,
  setActionStatus: successAction,
  searchOwners: ownerSearchAction,
};

const agenda = [
  {
    id: AGENDA_1,
    title: 'Approve last year’s accounts',
    description: 'Audited statement shared with the notice.',
  },
  { id: AGENDA_2, title: 'Repaint the main gate', description: null },
];

const invited = [
  { attendeeId: UNIT_A, label: 'A-101' },
  { attendeeId: UNIT_B, label: 'A-102' },
  { attendeeId: UNIT_C, label: 'B-201' },
  { attendeeId: UNIT_D, label: 'B-202' },
];

const myActions: MeetingMyAction[] = [
  {
    id: id('71'),
    meetingId: MEETING,
    meetingTitle: 'Annual general meeting 2026',
    title: 'Collect three painting quotes',
    dueOn: '2026-11-18',
    status: 'open',
    overdue: true,
    version: 1,
  },
  {
    id: id('72'),
    meetingId: MEETING,
    meetingTitle: 'Annual general meeting 2026',
    title: 'Share audited accounts',
    dueOn: '2026-11-30',
    status: 'done',
    overdue: false,
    version: 2,
  },
];

const memberList: MeetingMemberList = {
  meetings: [
    {
      id: id('2'),
      meetingType: 'sgm',
      title: 'Special meeting on parking rules',
      status: 'scheduled',
      startsAt: FUTURE_STARTS,
      endsAt: FUTURE_ENDS,
      venue: 'Clubhouse hall',
      onlineUrl: null,
      minutesPublished: false,
    },
    {
      id: MEETING,
      meetingType: 'agm',
      title: 'Annual general meeting 2026',
      status: 'held',
      startsAt: STARTS,
      endsAt: ENDS,
      venue: 'Clubhouse hall',
      onlineUrl: 'https://meet.example.test/agm',
      minutesPublished: true,
    },
  ],
  actions: myActions,
};

function memberDetail(status: 'scheduled' | 'held'): MeetingMemberDetail {
  return {
    meeting: {
      id: MEETING,
      meetingType: 'agm',
      title: 'Annual general meeting 2026',
      description: 'Yearly meeting of all homes in the society.',
      status,
      startsAt: STARTS,
      endsAt: ENDS,
      venue: 'Clubhouse hall',
      onlineUrl: 'https://meet.example.test/agm',
      checkinOpen: status === 'scheduled',
      cancellationReason: null,
    },
    agenda,
    myUnits: [
      {
        unitId: UNIT_A,
        label: 'A-101',
        present: status === 'held',
        mode: status === 'held' ? 'self' : null,
        canCheckIn: true,
      },
    ],
    quorum: {
      invited: 4,
      present: status === 'held' ? 3 : 1,
      percent: 33,
      met: status === 'held',
    },
    resolutions:
      status === 'held'
        ? [
            {
              id: RESOLUTION_1,
              title: 'Approve the audited accounts',
              outcome: 'passed',
              votesFor: 3,
              votesAgainst: 0,
              votesAbstain: 0,
              poll: null,
            },
            {
              id: RESOLUTION_2,
              title: 'Repaint the main gate',
              outcome: 'deferred',
              votesFor: null,
              votesAgainst: null,
              votesAbstain: null,
              poll: { id: POLL, title: 'Main gate colour', status: 'active' },
            },
          ]
        : [],
    minutes:
      status === 'held'
        ? {
            body: 'The meeting opened at 10:00 IST. The accounts were approved.',
            publishedAt: ENDS,
          }
        : null,
  };
}

function adminDetail(
  status: MeetingStatus,
  role: FixtureRole,
  minutes: 'none' | 'draft' | 'published' = 'none',
): MeetingAdminDetailModel {
  const held = status === 'held';
  const attendance = held
    ? [
        {
          attendeeId: UNIT_A,
          label: 'A-101',
          mode: 'self' as const,
          proxyName: null,
          recordedAt: STARTS,
          recordedByName: 'Synthetic Resident A',
        },
        {
          attendeeId: UNIT_B,
          label: 'A-102',
          mode: 'in_person' as const,
          proxyName: null,
          recordedAt: STARTS,
          recordedByName: 'Synthetic Admin',
        },
        {
          attendeeId: UNIT_C,
          label: 'B-201',
          mode: 'proxy' as const,
          proxyName: 'Synthetic Proxy',
          recordedAt: STARTS,
          recordedByName: 'Synthetic Admin',
        },
      ]
    : status === 'scheduled'
      ? [
          {
            attendeeId: UNIT_A,
            label: 'A-101',
            mode: 'self' as const,
            proxyName: null,
            recordedAt: STARTS,
            recordedByName: 'Synthetic Resident A',
          },
        ]
      : [];
  return {
    meeting: {
      id: MEETING,
      meetingType: 'agm',
      status,
      title: 'Annual general meeting 2026',
      description: 'Yearly meeting of all homes in the society.',
      startsAt: status === 'draft' ? '2026-11-23T04:30:00.000Z' : STARTS,
      endsAt: status === 'draft' ? '2026-11-23T06:30:00.000Z' : ENDS,
      venue: 'Clubhouse hall',
      onlineUrl: 'https://meet.example.test/agm',
      inviteeScope: 'default',
      noticeRequiredDays: status === 'draft' ? null : 14,
      noticeGivenDays: status === 'draft' ? null : 5,
      quorumPercent: status === 'draft' ? null : 33,
      checkinOpen: status === 'scheduled',
      version: 3,
      cancellationReason: null,
    },
    agenda,
    invitees: { scope: 'default' },
    invited: status === 'draft' ? [] : invited,
    attendance,
    quorum: {
      invited: status === 'draft' ? 0 : 4,
      present: attendance.length,
      percent: status === 'draft' ? null : 33,
      met: attendance.length * 100 >= 33 * 4,
    },
    resolutions: held
      ? [
          {
            id: RESOLUTION_1,
            agendaItemId: AGENDA_1,
            title: 'Approve the audited accounts',
            body: 'Resolved that the audited accounts be approved.',
            outcome: 'passed',
            votesFor: 3,
            votesAgainst: 0,
            votesAbstain: 0,
            version: 2,
            poll: null,
          },
          {
            id: RESOLUTION_2,
            agendaItemId: AGENDA_2,
            title: 'Repaint the main gate',
            body: null,
            outcome: 'pending',
            votesFor: null,
            votesAgainst: null,
            votesAbstain: null,
            version: 1,
            poll: { id: POLL, title: 'Main gate colour', status: 'active' },
          },
        ]
      : [],
    minutes:
      minutes === 'none'
        ? null
        : {
            status: minutes,
            body: 'The meeting opened at 10:00 IST. The accounts were approved.',
            version: 2,
            updatedAt: ENDS,
            updatedByName: 'Synthetic Secretary',
            publishedAt: minutes === 'published' ? ENDS : null,
            documentId: null,
          },
    actions: held
      ? [
          {
            id: id('71'),
            title: 'Collect three painting quotes',
            ownerMembershipId: OWNER,
            ownerName: 'Synthetic Treasurer',
            dueOn: '2026-11-18',
            status: 'open',
            note: null,
            resolutionId: RESOLUTION_2,
            version: 1,
            overdue: true,
          },
        ]
      : [],
    settings,
    canManage: role === 'admin',
    canWriteMinutes: true,
    pollEnabled: true,
    documentEnabled: true,
  };
}

const adminList: MeetingAdminList = {
  items: [
    {
      id: id('2'),
      meetingType: 'sgm',
      title: 'Special meeting on parking rules',
      status: 'scheduled',
      startsAt: FUTURE_STARTS,
      endsAt: FUTURE_ENDS,
      invitedCount: 120,
      presentCount: 0,
      quorumPercent: 33,
      quorumMet: false,
      minutesStatus: 'none',
    },
    {
      id: MEETING,
      meetingType: 'agm',
      title: 'Annual general meeting 2026',
      status: 'held',
      startsAt: STARTS,
      endsAt: ENDS,
      invitedCount: 4,
      presentCount: 3,
      quorumPercent: 33,
      quorumMet: true,
      minutesStatus: 'published',
    },
  ],
  total: 2,
};

const inviteeOptions: MeetingInviteeOptions = {
  units: [
    {
      unitId: UNIT_A,
      label: 'A-101',
      blockId: id('81'),
      blockName: 'Tower A',
      floor: 1,
    },
    {
      unitId: UNIT_B,
      label: 'A-102',
      blockId: id('81'),
      blockName: 'Tower A',
      floor: 1,
    },
    {
      unitId: UNIT_C,
      label: 'B-201',
      blockId: id('82'),
      blockName: 'Tower B',
      floor: 2,
    },
    {
      unitId: UNIT_D,
      label: 'B-202',
      blockId: id('82'),
      blockName: 'Tower B',
      floor: 2,
    },
  ],
  members: [{ membershipId: OWNER, name: 'Synthetic Treasurer' }],
};

const folders = {
  folders: [{ id: FOLDER, name: 'Meeting minutes' }],
  defaultFolderId: FOLDER,
};

export default function MeetingFixturePage() {
  const [role, setRole] = useState<FixtureRole>('resident');
  const [scenario, setScenario] = useState<Scenario>('list');
  const residentOnly = scenario.startsWith('resident-');
  const adminOnly = scenario.startsWith('admin-') || scenario === 'settings';
  const routeState =
    (role === 'committee' && scenario === 'admin-editor') ||
    (role === 'resident' && adminOnly) ||
    (role !== 'resident' && residentOnly)
      ? 'denied'
      : scenario === 'disabled' || scenario === 'denied' || scenario === 'error'
        ? scenario
        : null;

  const content = (() => {
    if (routeState) {
      return (
        <MeetingRouteState
          kind={routeState}
          returnHref="/fixtures/meeting"
          retryHref={routeState === 'error' ? '/fixtures/meeting' : undefined}
          referenceId={routeState === 'error' ? 'ERR-M1A2B3C4D5' : undefined}
        />
      );
    }
    if (role === 'resident') {
      switch (scenario) {
        case 'empty':
          return (
            <ResidentMeetingListView
              workspace={{ meetings: [], actions: [] }}
              now={NOW}
              statusAction={successAction}
            />
          );
        case 'resident-check-in':
          return (
            <ResidentMeetingDetailView
              detail={memberDetail('scheduled')}
              checkInAction={successAction}
            />
          );
        case 'resident-held':
          return (
            <ResidentMeetingDetailView
              detail={memberDetail('held')}
              checkInAction={successAction}
            />
          );
        case 'resident-actions':
          return (
            <MyMeetingActionsView
              actions={myActions}
              statusAction={successAction}
              meetingHrefBase="/meetings"
              backHref="/fixtures/meeting"
            />
          );
        default:
          return (
            <ResidentMeetingListView
              workspace={memberList}
              now={NOW}
              statusAction={successAction}
            />
          );
      }
    }
    switch (scenario) {
      case 'empty':
        return (
          <MeetingAdminListView
            workspace={{ items: [], total: 0, canManage: role === 'admin' }}
            status={null}
          />
        );
      case 'admin-editor':
        return (
          <MeetingEditor
            detail={adminDetail('draft', role)}
            options={inviteeOptions}
            settings={settings}
            action={successAction}
            now={NOW}
          />
        );
      case 'admin-scheduled':
        return (
          <MeetingAdminDetailView
            detail={adminDetail('scheduled', role)}
            actions={adminActions}
            folders={folders}
          />
        );
      case 'admin-held':
        return (
          <MeetingAdminDetailView
            detail={adminDetail('held', role, 'draft')}
            actions={adminActions}
            folders={folders}
          />
        );
      case 'admin-published':
        return (
          <MeetingAdminDetailView
            detail={adminDetail('held', role, 'published')}
            actions={adminActions}
            folders={folders}
          />
        );
      case 'settings':
        return (
          <MeetingSettingsView
            settings={settings}
            canManage={role === 'admin'}
            action={role === 'admin' ? successAction : null}
          />
        );
      default:
        return (
          <MeetingAdminListView
            workspace={{ ...adminList, canManage: role === 'admin' }}
            status={null}
          />
        );
    }
  })();

  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic Meetings & AGM fixture" tone="info">
          Sample homes, meetings, minutes and actions only. No hosted Auth,
          database writes or notifications.
        </Banner>
        <div className="grid gap-space-4 medium:grid-cols-2">
          <SelectInput
            id="meeting-fixture-role"
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
            id="meeting-fixture-scenario"
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
