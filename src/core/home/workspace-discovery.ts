// Load role-filtered P55 workspace search, setup progress and society calendar data.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId, ValidationError } from '../errors';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import type { RoleNavigationItem } from '../modules';
import { buildRequestContext } from '../tenancy/request-context';
import { searchWorkspaceCatalogue } from './search-catalogue';

const searchInputSchema = z.string().trim().min(2).max(60);
const recordSchema = z.object({
  kind: z.enum(['person', 'flat', 'vehicle']),
  record_id: z.uuid(),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  href: z.string().startsWith('/'),
});
const calendarRowSchema = z.object({
  source: z.enum(['meeting', 'event', 'amenity', 'bill']),
  item_id: z.uuid(),
  title: z.string().min(1),
  occurs_at: z.iso.datetime({ offset: true }),
  href: z.string().startsWith('/'),
});
const setupStepSchema = z.object({
  key: z.string(),
  module_key: z.string(),
  title: z.string(),
  href: z.string().startsWith('/'),
  complete: z.boolean(),
});
const gettingStartedSchema = z.object({
  dismissed: z.boolean(),
  residents_joined_percent: z.number().int().min(1).max(100),
  total_units: z.number().int().nonnegative(),
  joined_units: z.number().int().nonnegative(),
  steps: z.array(setupStepSchema),
});

type PageResult = Pick<
  RoleNavigationItem,
  'href' | 'label' | 'moduleKey' | 'topic'
> & {
  kind: 'page';
};

export async function searchWorkspace(input: unknown) {
  const query = parseModuleInput(searchInputSchema, input);
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const catalogue = searchWorkspaceCatalogue(
    context.roles,
    [...context.enabledModules],
    query,
  );
  const pages: PageResult[] = catalogue.pages;
  const actions = catalogue.actions;
  const canSearchRecords =
    context.roles.includes('admin') ||
    context.roles.includes('committee') ||
    context.roles.includes('guard');
  const records = canSearchRecords
    ? await callModuleRpc(
        context,
        'workspace_search_records',
        { p_society_id: context.societyId, p_query: query },
        z.array(recordSchema).max(20),
        'Workspace search could not be loaded.',
      )
    : [];
  return { query, pages, actions, records };
}

export async function getWorkspaceCalendar(input: unknown) {
  const parsed = parseModuleInput(
    z
      .object({
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
      .strict()
      .refine(({ from, to }) => to > from, {
        path: ['to'],
        message: 'Choose an end date after the start date.',
      }),
    input,
  );
  if (parsed.to.getTime() - parsed.from.getTime() > 62 * 24 * 60 * 60 * 1000) {
    throw new ValidationError({ range: 'Choose a range of 62 days or less.' });
  }
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return callModuleRpc(
    context,
    'workspace_calendar_get',
    {
      p_society_id: context.societyId,
      p_from: parsed.from.toISOString(),
      p_to: parsed.to.toISOString(),
    },
    z.array(calendarRowSchema),
    'The society calendar could not be loaded.',
  );
}

export async function getGettingStarted() {
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId || !context.roles.includes('admin')) {
    throw new AppError('FORBIDDEN');
  }
  const result = await callModuleRpc(
    context,
    'society_getting_started_get',
    { p_society_id: context.societyId },
    gettingStartedSchema,
    'Getting started could not be loaded.',
  );
  return {
    ...result,
    steps: result.steps.filter(
      (step) =>
        step.module_key === 'core' ||
        context.enabledModules.has(step.module_key as never),
    ),
  };
}

export async function setGettingStartedDismissed(dismissed: boolean) {
  const context = await buildRequestContext(createRequestId());
  if (!context.societyId || !context.roles.includes('admin')) {
    throw new AppError('FORBIDDEN');
  }
  return callModuleRpc(
    context,
    'society_getting_started_dismiss',
    { p_society_id: context.societyId, p_dismissed: dismissed },
    z.null(),
    'The Getting started card could not be changed.',
  );
}

export type WorkspaceSearchResult = Awaited<ReturnType<typeof searchWorkspace>>;
export type CalendarItem = z.infer<typeof calendarRowSchema>;
export type GettingStarted = Awaited<ReturnType<typeof getGettingStarted>>;
