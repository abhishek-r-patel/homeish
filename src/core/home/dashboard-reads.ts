// Load role-safe P54 Coming up and household graph reads.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc } from '../db/validated-rpc';
import { AppError } from '../errors';
import type { RequestContext } from '../tenancy/request-context';
import { readWorkspacePreferences } from './workspace-operations';

const comingUpSchema = z
  .array(
    z.object({
      source: z.enum(['meeting', 'event', 'bill', 'amenity', 'amc', 'poll']),
      item_id: z.uuid(),
      title: z.string().min(1),
      occurs_at: z.iso.datetime({ offset: true }),
      href: z.string().startsWith('/'),
    }),
  )
  .max(5);

const graphRowSchema = z.object({
  month_start: z.iso.date(),
  amount: z.coerce.number().finite().nonnegative(),
  has_data: z.boolean(),
});

export async function getComingUp(context: RequestContext) {
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return callModuleRpc(
    context,
    'workspace_coming_up_get',
    { p_society_id: context.societyId },
    comingUpSchema,
    'Coming up could not be loaded.',
  );
}

export async function getResidentDashboardGraph(context: RequestContext) {
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const preferences = await readWorkspacePreferences(context);
  const read = async (mode: 'water' | 'bills') =>
    callModuleRpc(
      context,
      'resident_dashboard_graph_get',
      { p_society_id: context.societyId!, p_mode: mode },
      z.array(graphRowSchema).length(6),
      'Your dashboard graph could not be loaded.',
    );
  const [water, bills] = await Promise.all([
    context.enabledModules.has('metering')
      ? read('water')
      : Promise.resolve([]),
    context.enabledModules.has('billing') ? read('bills') : Promise.resolve([]),
  ]);
  const waterAvailable = water.some((row) => row.has_data);
  const billsAvailable = bills.some((row) => row.has_data);
  const mode =
    preferences.residentGraphMode === 'water' && waterAvailable
      ? 'water'
      : billsAvailable
        ? 'bills'
        : waterAvailable
          ? 'water'
          : null;
  return {
    mode,
    water: waterAvailable ? water : null,
    bills: billsAvailable ? bills : null,
  };
}

export type ComingUpItem = z.infer<typeof comingUpSchema>[number];
export type ResidentDashboardGraph = Awaited<
  ReturnType<typeof getResidentDashboardGraph>
>;
