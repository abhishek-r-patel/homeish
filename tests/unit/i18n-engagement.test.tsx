// Verify translated engagement screens keep resident content, permissions and English output intact.
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock(
  '@/components/ui/language',
  () => import('../../src/components/ui/language'),
);
vi.mock('@/core/i18n/format', () => import('../../src/core/i18n/format'));
vi.mock('@/core/i18n/messages', () => import('../../src/core/i18n/messages'));
vi.mock('@/core/errors', () => import('../../src/core/errors'));
vi.mock(
  '@/components/ui/data-display',
  () => import('../../src/components/ui/data-display'),
);
vi.mock(
  '@/components/ui/feedback',
  () => import('../../src/components/ui/feedback'),
);
vi.mock(
  '@/components/ui/choice-controls',
  () => import('../../src/components/ui/choice-controls'),
);
vi.mock(
  '@/components/ui/module-action-form',
  () => import('../../src/components/ui/module-action-form'),
);
vi.mock(
  '@/components/ui/text-input',
  () => import('../../src/components/ui/text-input'),
);
vi.mock(
  '@/components/ui/select-input',
  () => import('../../src/components/ui/select-input'),
);
vi.mock('@/core/modules/module-disabled-page', () => ({
  ModuleDisabledPage: () => <div>Disabled module boundary</div>,
}));
vi.mock('@/core/event/pricing', () => import('../../src/core/event/pricing'));
vi.mock('@/core/event/summary', () => import('../../src/core/event/summary'));
vi.mock(
  '@/core/event/validation',
  () => import('../../src/core/event/validation'),
);
vi.mock(
  '@/core/poll/validation',
  () => import('../../src/core/poll/validation'),
);
vi.mock('@/core/poll/results', () => import('../../src/core/poll/results'));
vi.mock('@/core/meeting/quorum', () => import('../../src/core/meeting/quorum'));
vi.mock(
  '@/core/community/presentation',
  () => import('../../src/core/community/presentation'),
);
vi.mock('@/lib/money', () => import('../../src/lib/money'));
vi.mock(
  '@/components/ui/button',
  () => import('../../src/components/ui/button'),
);
vi.mock(
  '@/components/ui/file-upload',
  () => import('../../src/components/ui/file-upload'),
);
vi.mock(
  '@/components/ui/specialized-inputs',
  () => import('../../src/components/ui/specialized-inputs'),
);
vi.mock('@/core/config/public-env', () => ({ publicEnvironment: vi.fn() }));
vi.mock(
  '@/core/files/constraints',
  () => import('../../src/core/files/constraints'),
);
vi.mock(
  '@/core/patrol/validation',
  () => import('../../src/core/patrol/validation'),
);
vi.mock(
  '@/core/patrol/presentation',
  () => import('../../src/core/patrol/presentation'),
);
vi.mock(
  '@/core/home-services/validation',
  () => import('../../src/core/home-services/validation'),
);
vi.mock(
  '@/core/home-services/presentation',
  () => import('../../src/core/home-services/presentation'),
);
vi.mock('@/app/(guard)/guard/patrol/actions', () => ({
  acknowledgePatrolHandoverAction: vi.fn(),
  createPatrolHandoverAction: vi.fn(),
  createPatrolIncidentAction: vi.fn(),
  recordPatrolScanAction: vi.fn(),
}));
vi.mock('@/app/(admin)/admin/patrol/actions', () => ({
  addPatrolIncidentNoteAction: vi.fn(),
  closePatrolIncidentAction: vi.fn(),
  savePatrolCheckpointAction: vi.fn(),
  savePatrolScheduleAction: vi.fn(),
  savePatrolSettingsAction: vi.fn(),
  setPatrolCheckpointActiveAction: vi.fn(),
  setPatrolScheduleActiveAction: vi.fn(),
}));
vi.mock('@/app/(resident)/home-services/actions', () => ({
  archiveHomeServicesProviderAction: vi.fn(),
  reviewHomeServicesSuggestionAction: vi.fn(),
  saveHomeServicesProviderAction: vi.fn(),
  saveHomeServicesRatingAction: vi.fn(),
  setHomeServicesCommentVisibilityAction: vi.fn(),
  suggestHomeServicesProviderAction: vi.fn(),
}));

import {
  LanguageContext,
  type LanguageContextValue,
} from '../../src/components/language-context';
import { ResidentEventListView } from '../../src/components/event/resident';
import {
  describeContribution,
  formatEventMoney,
} from '../../src/components/event/shared';
import { PollRepresentativesView } from '../../src/components/poll/resident';
import {
  NoticeWarning,
  QuorumIndicator,
} from '../../src/components/meeting/shared';
import {
  authorLine,
  formatCommunityPrice,
  muteEndsText,
  CommunityPageHeader,
  CommunityPager,
} from '../../src/components/community/shared';
import { PatrolPrintSheetView } from '../../src/components/patrol/print-sheet';
import { HomeServicesDirectoryView } from '../../src/components/home-services/resident';
import type { EventMemberList } from '../../src/core/event/validation';
import { eventRsvpInputSchema } from '../../src/core/event/validation';
import { homeServicesRatingInputSchema } from '../../src/core/home-services/validation';
import { patrolScheduleInputSchema } from '../../src/core/patrol/validation';
import {
  translateFeedbackMessage,
  translateMessage,
} from '../../src/core/i18n/messages';

const hindi: LanguageContextValue = {
  locale: 'hi',
  hindiAvailable: true,
  pending: false,
  changeLocale: async () => ({ status: 'saved' }),
  translate: (source, values) => translateMessage('hi', source, values),
};
const id = 'f0000000-0000-4000-8000-000000000001';
const list: EventMemberList = {
  items: [
    {
      id,
      title: 'Going · Free · Synthetic Dinner',
      venue: 'Clubhouse lawn',
      status: 'published',
      past: false,
      startsAt: '2099-12-20T12:30:00.000Z',
      endsAt: '2099-12-20T16:30:00.000Z',
      rsvpClosesAt: '2099-12-19T12:30:00.000Z',
      contributionType: 'per_unit',
      contributionPaise: 12_500_000,
      myRsvps: [
        { unitId: id, label: 'A-101', status: 'going', headcount: 2 },
        {
          unitId: 'f0000000-0000-4000-8000-000000000002',
          label: 'B-202',
          status: null,
          headcount: null,
        },
      ],
    },
  ],
};

function render(element: ReactNode, language?: LanguageContextValue) {
  return renderToStaticMarkup(
    language ? (
      <LanguageContext.Provider value={language}>
        {element}
      </LanguageContext.Provider>
    ) : (
      element
    ),
  );
}

describe('engagement interface language', () => {
  it('renders Hindi event summaries with India-time, INR and untouched written content', () => {
    const markup = render(
      <ResidentEventListView list={list} filter="upcoming" />,
      hindi,
    );
    expect(markup).toContain('कार्यक्रम');
    expect(markup).toContain('Going · Free · Synthetic Dinner');
    expect(markup).toContain('Clubhouse lawn');
    expect(markup).toContain('A-101');
    expect(markup).toContain('2 लोग');
    expect(markup).toContain('₹1,25,000.00');
    expect(markup).toMatch(/दिस/);
    expect(markup).toMatch(/6:00/);
    expect(markup).not.toMatch(/[०-९]/);
    expect(markup).not.toContain('2 people');
  });

  it('preserves the default English screen and formatter exports', () => {
    const markup = render(
      <ResidentEventListView list={list} filter="upcoming" />,
    );
    expect(markup).toContain('Events');
    expect(markup).toContain('Going · 2 people');
    expect(markup).toContain('₹125000.00 per flat');
    expect(formatEventMoney(125_000)).toBe('₹1250.00');
    expect(formatEventMoney(125_000, 'en')).toBe('₹1250.00');
    expect(describeContribution('per_head', 25_000)).toBe('₹250.00 per person');
    expect(formatCommunityPrice(12_500_000)).toBe('₹1,25,000');
    expect(formatCommunityPrice(12_500_000, 'en')).toBe('₹1,25,000');
  });

  it('translates family representatives without treating their names as keys', () => {
    const representatives = {
      canManageAll: false,
      canSetRepresentative: true,
      units: [
        {
          unitId: id,
          unitLabel: 'A-101',
          blockName: 'Synthetic Tower',
          version: 1,
          designated: null,
          effective: {
            membershipId: id,
            name: 'Owner',
            relationship: 'family' as const,
          },
          options: [
            {
              membershipId: id,
              name: 'Owner',
              relationship: 'family' as const,
              isPrimary: false,
            },
          ],
        },
      ],
    };
    const screen = (
      <PollRepresentativesView
        representatives={representatives}
        action={async () => ({ ok: true })}
      />
    );
    const translated = render(screen, hindi);
    expect(translated).toContain('Owner (परिवार के सदस्य)');
    expect(translated).toContain('फ़्लैट');
    expect(render(screen)).toContain('Owner (family)');
  });

  it('translates meeting notices and quorum while preserving their warning-only rule', () => {
    const markup = render(
      <>
        <NoticeWarning requiredDays={14} givenDays={1} />
        <QuorumIndicator
          invited={1000}
          present={330}
          percent={33}
          meetingType="agm"
        />
      </>,
      hindi,
    );
    expect(markup).toContain('1 दिन');
    expect(markup).toContain('14 दिन');
    expect(markup).toContain('1,000');
    expect(markup).toContain('330');
    expect(markup).toContain('33%');
    expect(markup).toContain('बैठक को नहीं रोकता');
  });

  it('localizes community author/mute context and money, not the resident name', () => {
    const markup = render(
      <>
        <CommunityPageHeader title="Free · Synthetic group" />
        <CommunityPager
          page={2}
          total={20000}
          pageSize={10}
          href={(page) => `/community?page=${page}`}
        />
      </>,
      hindi,
    );
    expect(markup).toContain('Free · Synthetic group');
    expect(markup).toContain('2,000');
    expect(markup).not.toContain('Page 2 of');
    expect(authorLine('Free', 'A-101', 'hi')).toBe('Free · फ़्लैट A-101');
    expect(formatCommunityPrice(0, 'hi')).toBe(translateMessage('hi', 'Free'));
    expect(formatCommunityPrice(12_500_000, 'hi')).toBe('₹1,25,000.00');
    expect(
      muteEndsText(
        { untilLifted: true, mutedUntil: null, reason: 'Synthetic reason' },
        'hi',
      ),
    ).toBe('प्रशासक के रोक हटाने तक');
  });

  it('translates provider labels and ratings without changing names, areas or phone links', () => {
    const markup = render(
      <HomeServicesDirectoryView
        directory={{
          can_rate: true,
          truncated: false,
          providers: [
            {
              id,
              name: 'Plumber · Synthetic Repairs',
              service_type: 'plumber',
              phone: '+12025550123',
              area: 'Synthetic Tower',
              notes: null,
              average_stars: 4.5,
              rating_count: 1000,
              my_stars: 4,
            },
          ],
        }}
      />,
      hindi,
    );
    expect(markup).toContain('Plumber · Synthetic Repairs');
    expect(markup).toContain('Synthetic Tower');
    expect(markup).toContain('प्लंबर');
    expect(markup).toContain('1,000');
    expect(markup).toContain('4.5');
    expect(markup).toContain('href="tel:+12025550123"');
    expect(markup).not.toContain('4 stars, very good');
  });

  it('translates patrol print controls but keeps the actual sheet explicitly English', () => {
    const markup = render(
      <PatrolPrintSheetView
        sheet={{
          society_name: 'Synthetic Society',
          checkpoints: [
            {
              id,
              code: 'K7M2QX',
              name: 'Free · Main gate',
              location_note: 'Synthetic gate location',
            },
          ],
        }}
        qrCodes={new Map()}
      />,
      hindi,
    );
    expect(markup).toContain('गश्त की QR शीट');
    expect(markup).toContain('शीट अंग्रेज़ी में है');
    expect(markup).toMatch(/id="patrol-print-sheet"[^>]*lang="en"/);
    expect(markup).toContain('Synthetic Society · guard patrol checkpoints');
    expect(markup).toContain('Free · Main gate');
    expect(markup).toContain('K7M 2QX');
    expect(markup).toContain('Synthetic gate location');
  });

  it('translates real domain validation feedback without changing its input contracts', () => {
    const cases = [
      eventRsvpInputSchema.safeParse({
        eventId: id,
        unitId: id,
        expectedVersion: null,
        status: 'going',
        headcount: 0,
      }),
      homeServicesRatingInputSchema.safeParse({
        providerId: id,
        stars: 0,
        comment: null,
      }),
      patrolScheduleInputSchema.safeParse({
        scheduleId: null,
        expectedVersion: null,
        clientRequestId: id,
        name: 'Synthetic night shift',
        shiftStart: '22:00',
        shiftEnd: '06:00',
        intervalMinutes: 60,
        graceMinutes: 10,
        checkpointIds: [],
      }),
    ];
    for (const result of cases) {
      expect(result.success).toBe(false);
      const source = result.error!.issues[0]!.message;
      expect(translateFeedbackMessage('hi', source)).toMatch(/[\u0900-\u097f]/);
      expect(translateFeedbackMessage('en', source)).toBe(source);
    }
    expect(() =>
      translateMessage('hi', 'Uncatalogued engagement feedback'),
    ).toThrow('Missing Hindi translation');
  });
});
