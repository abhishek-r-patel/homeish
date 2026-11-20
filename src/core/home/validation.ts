// Validate the household-only resident-home snapshot returned by the database.
import { z } from 'zod';

const activityFields = {
  id: z.uuid(),
  title: z.string().min(1),
  unit_number: z.string().nullable(),
  occurred_at: z.iso.datetime({ offset: true }),
};

const homeActivitySchema = z.discriminatedUnion('module', [
  z.object({
    ...activityFields,
    module: z.literal('visitor'),
    due_date: z.null(),
    status: z.enum([
      'pending',
      'approved',
      'denied',
      'expired',
      'checked_in',
      'checked_out',
    ]),
  }),
  z.object({
    ...activityFields,
    module: z.literal('delivery'),
    due_date: z.null(),
    status: z.enum([
      'pending_response',
      'no_response',
      'allowed',
      'left_at_gate',
      'denied',
      'collected',
      'closed',
    ]),
  }),
  z.object({
    ...activityFields,
    module: z.literal('billing'),
    due_date: z.iso.date(),
    status: z.enum(['due', 'partially_paid', 'paid', 'waived', 'cancelled']),
  }),
  z.object({
    ...activityFields,
    module: z.literal('service_request'),
    due_date: z.null(),
    status: z.enum([
      'open',
      'assigned',
      'in_progress',
      'resolved',
      'closed',
      'rejected',
      'reopened',
    ]),
  }),
]);

export const residentHomeSnapshotSchema = z.object({
  resident_name: z.string().min(1),
  timezone: z.string().min(1),
  unit_label: z.string().min(1),
  units: z.array(z.object({ id: z.uuid(), number: z.string() })),
  pending_visitors: z.number().int().nonnegative(),
  pending_deliveries: z.number().int().nonnegative(),
  server_now: z.iso.datetime({ offset: true }),
  next_response_at: z.iso.datetime({ offset: true }).nullable(),
  activity: z.array(homeActivitySchema).max(5),
});

export type ResidentHomeSnapshot = z.infer<typeof residentHomeSnapshotSchema>;
export type ResidentHomeActivity = ResidentHomeSnapshot['activity'][number];
