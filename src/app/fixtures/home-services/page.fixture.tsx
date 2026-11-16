// Exercise Home-Services screens with synthetic providers and injected actions; never call hosted Auth or data.
'use client';
import { useState } from 'react';
import { z } from 'zod';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  homeServicesArchiveInputSchema,
  homeServicesCommentVisibilityInputSchema,
  homeServicesProviderInputSchema,
  homeServicesRatingInputSchema,
  homeServicesReviewInputSchema,
  homeServicesSuggestionInputSchema,
  type HomeServicesAdminWorkspace,
  type HomeServicesDirectory,
  type HomeServicesManagedProvider,
  type HomeServicesProviderDetail,
} from '@/core/home-services/validation';
import { HomeServicesAdminView } from '@/components/home-services/admin';
import {
  HomeServicesDirectoryView,
  HomeServicesProviderView,
} from '@/components/home-services/resident';
import {
  HomeServicesRouteState,
  type HomeServicesActions,
  type HomeServicesRouteStateKind,
} from '@/components/home-services/shared';
import { Banner } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';

const PLUMBER = 'a0e55fc3-0751-4b79-86c1-5b3e25942392';
const ELECTRICIAN = 'a1e55fc3-0751-4b79-86c1-5b3e25942392';
const PEST = 'a2e55fc3-0751-4b79-86c1-5b3e25942392';
const PENDING = 'a3e55fc3-0751-4b79-86c1-5b3e25942392';
const REJECTED = 'a4e55fc3-0751-4b79-86c1-5b3e25942392';
const ARCHIVED = 'a5e55fc3-0751-4b79-86c1-5b3e25942392';
const RATING_MINE = 'b0e55fc3-0751-4b79-86c1-5b3e25942392';
const RATING_OTHER = 'b1e55fc3-0751-4b79-86c1-5b3e25942392';
const RATING_HIDDEN = 'b2e55fc3-0751-4b79-86c1-5b3e25942392';
const CREATED = '2026-10-01T05:30:00Z';
const UPDATED = '2026-11-10T08:15:00Z';

const roleSchema = z.enum(['resident', 'admin', 'committee']);
type FixtureRole = z.infer<typeof roleSchema>;
const ROUTE_STATES = [
  'loading',
  'error',
  'disabled',
  'denied',
] as const satisfies readonly HomeServicesRouteStateKind[];
const scenarioSchema = z.enum(['ready', 'empty', 'detail', ...ROUTE_STATES]);
type Scenario = z.infer<typeof scenarioSchema>;

const MANAGED: HomeServicesManagedProvider[] = [
  {
    id: PENDING,
    name: 'Synthetic Sparks Electricals',
    service_type: 'electrician',
    phone: '+91 98111 22233',
    area: 'Tower B',
    notes: 'Suggested after fixing the lobby lights quickly.',
    average_stars: null,
    rating_count: 0,
    my_stars: null,
    status: 'pending',
    origin: 'suggestion',
    suggested_by_name: 'Synthetic Committee Member',
    review_reason: null,
    reviewed_at: null,
    archived_at: null,
    created_at: UPDATED,
    version: 1,
  },
  {
    id: PLUMBER,
    name: 'Synthetic Quick Plumbing',
    service_type: 'plumber',
    phone: '98765 43210',
    area: 'Sector 5 and nearby societies',
    notes: 'Available 8 am to 8 pm. Call before visiting.',
    average_stars: 4.3,
    rating_count: 3,
    my_stars: 4,
    status: 'approved',
    origin: 'admin',
    suggested_by_name: null,
    review_reason: null,
    reviewed_at: null,
    archived_at: null,
    created_at: CREATED,
    version: 2,
  },
  {
    id: ELECTRICIAN,
    name: 'Synthetic Bright Wiring',
    service_type: 'electrician',
    phone: '+91 99000 11122',
    area: null,
    notes: null,
    average_stars: null,
    rating_count: 0,
    my_stars: null,
    status: 'approved',
    origin: 'admin',
    suggested_by_name: null,
    review_reason: null,
    reviewed_at: null,
    archived_at: null,
    created_at: CREATED,
    version: 1,
  },
  {
    id: PEST,
    name: 'Synthetic Pest Shield',
    service_type: 'pest_control',
    phone: '022-555-0101',
    area: 'Whole city',
    notes: 'Quarterly contracts available.',
    average_stars: 2,
    rating_count: 1,
    my_stars: null,
    status: 'approved',
    origin: 'suggestion',
    suggested_by_name: 'Synthetic Committee Member',
    review_reason: null,
    reviewed_at: CREATED,
    archived_at: null,
    created_at: CREATED,
    version: 2,
  },
  {
    id: REJECTED,
    name: 'Synthetic Fast Fix Carpentry',
    service_type: 'carpenter',
    phone: '98200 00000',
    area: null,
    notes: null,
    average_stars: null,
    rating_count: 0,
    my_stars: null,
    status: 'rejected',
    origin: 'suggestion',
    suggested_by_name: 'Synthetic Committee Member',
    review_reason: 'Several residents reported missed appointments.',
    reviewed_at: UPDATED,
    archived_at: null,
    created_at: CREATED,
    version: 2,
  },
  {
    id: ARCHIVED,
    name: 'Synthetic Old Town Painters',
    service_type: 'painter',
    phone: '98300 00000',
    area: null,
    notes: null,
    average_stars: 3,
    rating_count: 2,
    my_stars: null,
    status: 'approved',
    origin: 'admin',
    suggested_by_name: null,
    review_reason: null,
    reviewed_at: null,
    archived_at: UPDATED,
    created_at: CREATED,
    version: 3,
  },
];

function directory(scenario: Scenario): HomeServicesDirectory {
  return {
    can_rate: true,
    truncated: false,
    providers:
      scenario === 'empty'
        ? []
        : MANAGED.filter(
            (item) => item.status === 'approved' && !item.archived_at,
          ).map((item) => ({
            id: item.id,
            name: item.name,
            service_type: item.service_type,
            phone: item.phone,
            area: item.area,
            notes: item.notes,
            average_stars: item.average_stars,
            rating_count: item.rating_count,
            my_stars: item.my_stars,
          })),
  };
}

function detail(role: FixtureRole): HomeServicesProviderDetail {
  const staff = role !== 'resident';
  const provider = directory('ready').providers.find(
    (item) => item.id === PLUMBER,
  )!;
  return {
    provider,
    is_listed: true,
    can_rate: role === 'resident',
    can_moderate: role === 'admin',
    my_rating:
      role === 'resident'
        ? {
            id: RATING_MINE,
            stars: 4,
            comment: 'Fixed the kitchen tap in one visit.',
            comment_hidden: false,
            updated_at: UPDATED,
          }
        : null,
    comments: [
      {
        id: RATING_MINE,
        stars: 4,
        comment: 'Fixed the kitchen tap in one visit.',
        comment_hidden: false,
        rater_name: staff ? 'Synthetic Resident A' : null,
        is_mine: role === 'resident',
        updated_at: UPDATED,
      },
      {
        id: RATING_OTHER,
        stars: 5,
        comment: 'Polite and on time. Fair price.',
        comment_hidden: false,
        rater_name: staff ? 'Synthetic Resident B' : null,
        is_mine: false,
        updated_at: CREATED,
      },
      ...(staff
        ? [
            {
              id: RATING_HIDDEN,
              stars: 4,
              comment:
                role === 'admin'
                  ? 'Synthetic comment hidden by an administrator.'
                  : null,
              comment_hidden: true,
              rater_name: staff ? 'Synthetic Resident C' : null,
              is_mine: false,
              updated_at: CREATED,
            },
          ]
        : []),
    ],
  };
}

function adminWorkspace(
  scenario: Scenario,
  role: FixtureRole,
): HomeServicesAdminWorkspace {
  const empty = scenario === 'empty';
  return {
    can_manage: role === 'admin',
    can_suggest: role === 'committee',
    truncated: false,
    providers: empty ? [] : MANAGED,
    comments: empty
      ? []
      : detail(role).comments.map((comment) => ({
          id: comment.id,
          provider_id: PLUMBER,
          provider_name: 'Synthetic Quick Plumbing',
          stars: comment.stars,
          comment: comment.comment,
          comment_hidden: comment.comment_hidden,
          rater_name: comment.rater_name,
          updated_at: comment.updated_at,
        })),
  };
}

function stub(
  schema: z.ZodType,
  message: string,
): (data: FormData) => Promise<ServerActionResult<unknown>> {
  return async (data) => {
    const raw = data.get('input');
    const parsed = schema.safeParse(
      typeof raw === 'string' ? JSON.parse(raw) : null,
    );
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0]?.message ?? 'Check the form.',
      };
    return { ok: true, message: `${message} (synthetic, nothing saved)` };
  };
}

const ACTIONS: HomeServicesActions = {
  saveProvider: stub(homeServicesProviderInputSchema, 'Provider saved.'),
  suggestProvider: stub(homeServicesSuggestionInputSchema, 'Suggestion sent.'),
  reviewSuggestion: stub(homeServicesReviewInputSchema, 'Suggestion reviewed.'),
  archiveProvider: stub(homeServicesArchiveInputSchema, 'Provider archived.'),
  saveRating: stub(homeServicesRatingInputSchema, 'Your rating is saved.'),
  setCommentVisibility: stub(
    homeServicesCommentVisibilityInputSchema,
    'Comment visibility changed.',
  ),
};

export default function HomeServicesFixturePage() {
  const [role, setRole] = useState<FixtureRole>('resident');
  const [scenario, setScenario] = useState<Scenario>('ready');
  const routeState = ROUTE_STATES.find((state) => state === scenario);

  return (
    <>
      <header className="mx-auto grid w-full max-w-content-default gap-space-4 px-space-4 pt-space-5">
        <Banner title="Synthetic home-services fixture" tone="info">
          Development-only providers, ratings and comments with injected
          actions. No hosted Auth, database writes or notifications.
        </Banner>
        <div className="grid gap-space-4 medium:grid-cols-2">
          <SelectInput
            id="fixture-role"
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
            id="fixture-scenario"
            label="Fixture scenario"
            value={scenario}
            options={scenarioSchema.options.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(event) =>
              setScenario(scenarioSchema.parse(event.currentTarget.value))
            }
          />
        </div>
      </header>
      <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
        {routeState ? (
          <HomeServicesRouteState
            kind={routeState}
            returnHref="/fixtures/home-services"
            retryHref={
              routeState === 'error' ? '/fixtures/home-services' : undefined
            }
            referenceId={routeState === 'error' ? 'ERR-F1A2B3C4D5' : undefined}
          />
        ) : scenario === 'detail' ? (
          <HomeServicesProviderView
            key={role}
            detail={detail(role)}
            actions={ACTIONS}
            backHref="/fixtures/home-services"
          />
        ) : role === 'resident' ? (
          <HomeServicesDirectoryView directory={directory(scenario)} />
        ) : (
          <HomeServicesAdminView
            workspace={adminWorkspace(scenario, role)}
            actions={ACTIONS}
          />
        )}
      </main>
    </>
  );
}
