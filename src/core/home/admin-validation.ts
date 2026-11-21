// Validate the admin home (A-01) snapshot and the admin-only actions feed returned by the database.
import { z } from 'zod';

const count = z.number().int().nonnegative();
const paise = z.string().regex(/^-?\d+$/);
const timestamp = z.iso.datetime({ offset: true });
const unavailable = z.object({ status: z.literal('unavailable') });

// A section is null when hidden (module off or role may not see it), unavailable when it failed to load.
function section<T extends z.ZodRawShape>(shape: T) {
  return z
    .discriminatedUnion('status', [
      z.object({ status: z.literal('ok'), ...shape }),
      unavailable,
    ])
    .nullable();
}

export const adminActivityKinds = [
  'request_opened',
  'request_resolved',
  'notice_published',
  'meeting_scheduled',
  'meeting_held',
  'registration',
] as const;

export const adminHomeSnapshotSchema = z.object({
  timezone: z.string().min(1),
  server_now: timestamp,
  visitors: section({ today: count, inside: count }),
  requests: section({ open: count, overdue: count }),
  billing: section({
    collected_month_paise: paise,
    outstanding_paise: paise,
    overdue_units: count,
    pending_payments: count,
  }),
  amc: section({ urgent: count }),
  stock: section({ low: count, out: count }),
  tenancy: section({ pending: count }),
  registrations: section({ pending: count }),
  meeting: section({
    next: z
      .object({
        id: z.uuid(),
        title: z.string().min(1),
        starts_at: timestamp,
        venue: z.string().nullable(),
      })
      .nullable(),
  }),
  activity: section({
    items: z
      .array(
        z.object({
          id: z.uuid(),
          kind: z.enum(adminActivityKinds),
          title: z.string().nullable(),
          unit_number: z.string().nullable(),
          occurred_at: timestamp,
        }),
      )
      .max(8),
  }),
});

export const adminHomeActionsSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      action: z.string().min(1),
      actor_role: z.enum(['admin', 'committee']),
      created_at: timestamp,
    }),
  )
  .max(10);

export type AdminHomeSnapshot = z.infer<typeof adminHomeSnapshotSchema>;
export type AdminHomeAction = z.infer<typeof adminHomeActionsSchema>[number];
export type AdminActivityItem = NonNullable<
  Extract<AdminHomeSnapshot['activity'], { status: 'ok' }>
>['items'][number];
