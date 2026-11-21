// Validate the P43.5 meeting and committee summary read model (client-safe).
import { z } from 'zod';

const isoDate = z.iso.date();
const count = z.number().int().nonnegative();

export const meetingGovernanceSummarySchema = z.object({
  today: isoDate,
  from: isoDate,
  to: isoDate,
  meetings: z.object({ scheduled: count, held: count, cancelled: count }),
  quorum: z.object({ with_rule: count, met: count }),
  average_attendance_percent: z.number().min(0).max(100).nullable(),
  resolutions: z.object({
    passed: count,
    failed: count,
    deferred: count,
    pending: count,
  }),
  actions: z.object({ open: count, overdue: count, done: count }),
  minutes_unpublished: count,
  owners: z
    .array(
      z.object({
        owner_name: z.string().min(1),
        open: count,
        overdue: count,
        next_due_on: isoDate,
      }),
    )
    .max(500),
});

export type MeetingGovernanceSummary = z.infer<
  typeof meetingGovernanceSummarySchema
>;
