// Validate staff profiles, permissions settings and attendance payloads.
import { z } from 'zod';

export const DEFAULT_STAFF_SETTINGS = {
  resident_approval_required: true,
} as const;

export const staffSettingsSchema = z
  .object({
    resident_approval_required: z.boolean().optional(),
  })
  .strict();

export const staffProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{10,15}$/),
    photoPath: z.string().trim().min(1).max(500).nullable(),
    idType: z
      .enum(['aadhaar', 'pan', 'voter_id', 'passport', 'other'])
      .nullable(),
    idLastFour: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{4}$/)
      .nullable(),
    jobRole: z.string().trim().min(1).max(80),
    policeVerified: z.boolean(),
  })
  .strict()
  .refine(
    ({ idType, idLastFour }) => (idType === null) === (idLastFour === null),
    {
      message: 'Enter both the ID type and its last four characters.',
      path: ['idLastFour'],
    },
  );

export const residentStaffRegistrationSchema = staffProfileSchema
  .extend({
    unitId: z.uuid(),
    requestId: z.uuid(),
  })
  .strict();

export const staffEmploymentTypeSchema = z.enum([
  'permanent',
  'contract',
  'daily_wage',
  'part_time',
]);
export const staffWeeklyOffSchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);
export const staffEmploymentStatusSchema = z.enum([
  'active',
  'on_notice',
  'left',
]);

export const staffAdminSaveSchema = staffProfileSchema
  .extend({
    staffId: z.uuid().nullable(),
    staffType: z.enum(['domestic', 'society']),
    status: z.enum(['active', 'blocked']),
    unitIds: z.array(z.uuid()).max(250),
    department: z.string().trim().min(1).max(80).nullable().default(null),
    designation: z.string().trim().min(1).max(80).nullable().default(null),
    employmentType: staffEmploymentTypeSchema.nullable().default(null),
    joiningDate: z.iso.date().nullable().default(null),
    weeklyOff: staffWeeklyOffSchema.nullable().default(null),
    employmentStatus: staffEmploymentStatusSchema.default('active'),
    exitDate: z.iso.date().nullable().default(null),
  })
  .strict()
  .refine(
    ({ staffType, unitIds }) =>
      staffType === 'domestic' || unitIds.length === 0,
    {
      message: 'Society staff are not linked to residential units.',
      path: ['unitIds'],
    },
  )
  .refine(
    (value) =>
      value.staffType === 'society' ||
      (value.department === null &&
        value.designation === null &&
        value.employmentType === null &&
        value.joiningDate === null &&
        value.weeklyOff === null &&
        value.employmentStatus === 'active' &&
        value.exitDate === null),
    {
      message: 'Employment details apply to society staff only.',
      path: ['employmentStatus'],
    },
  )
  .refine(
    ({ employmentStatus, exitDate }) =>
      (employmentStatus === 'left') === (exitDate !== null),
    {
      message: 'Enter an exit date only when the staff member has left.',
      path: ['exitDate'],
    },
  )
  .refine(
    ({ joiningDate, exitDate }) =>
      joiningDate === null || exitDate === null || exitDate >= joiningDate,
    {
      message: 'The exit date cannot be before the joining date.',
      path: ['exitDate'],
    },
  );

export const staffNoteCategorySchema = z.enum([
  'training_needed',
  'warning',
  'appraisal',
  'appreciation',
  'other',
]);

export const staffNoteSaveSchema = z
  .object({
    noteId: z.uuid().nullable(),
    staffId: z.uuid(),
    noteDate: z.iso.date(),
    category: staffNoteCategorySchema,
    rating: z.number().int().min(1).max(5).nullable(),
    note: z.string().trim().min(1).max(2000),
    action: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .transform((value) => value || null),
    followUpDate: z.iso.date().nullable(),
    status: z.enum(['open', 'closed']),
    expectedUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict()
  .refine(
    ({ noteId, expectedUpdatedAt }) =>
      noteId === null || expectedUpdatedAt !== null,
    { message: 'Reload the note and try again.', path: ['form'] },
  );

export const staffNoteDeleteSchema = z.object({ noteId: z.uuid() }).strict();

export const staffNoteItemSchema = z
  .object({
    id: z.uuid(),
    staff_id: z.uuid(),
    note_date: z.iso.date(),
    category: staffNoteCategorySchema,
    rating: z.number().int().min(1).max(5).nullable(),
    note: z.string(),
    action: z.string().nullable(),
    follow_up_date: z.iso.date().nullable(),
    status: z.enum(['open', 'closed']),
    recorded_by: z.string(),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    can_edit: z.boolean(),
  })
  .strict();

export const staffNoteListSchema = z.array(staffNoteItemSchema);

export const staffReviewSchema = z
  .object({
    linkId: z.uuid(),
    decision: z.enum(['active', 'rejected']),
  })
  .strict();

export const staffDayBlockSchema = z
  .object({ staffId: z.uuid(), unitId: z.uuid() })
  .strict();

export const staffShiftSchema = z
  .object({
    staffId: z.uuid(),
    attendanceDate: z.iso.date(),
    status: z.enum(['present', 'absent', 'leave']),
  })
  .strict();

export const staffCheckInSchema = z
  .object({
    unitId: z.uuid(),
    staffCode: z.string().regex(/^[A-Fa-f0-9]{10}$/),
  })
  .strict();

export const staffCheckOutSchema = z
  .object({ attendanceId: z.uuid() })
  .strict();

export const staffMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/)
  .transform((value) => value);

export const staffUnitLinkSchema = z
  .object({
    id: z.uuid(),
    unit_id: z.uuid(),
    status: z.enum(['pending', 'active', 'rejected', 'inactive']),
    blocked_today: z.boolean(),
    unit_label: z.string(),
  })
  .strict();

export const staffUnitSchema = z
  .object({ id: z.uuid(), label: z.string() })
  .strict();

export const staffSchema = z
  .object({
    id: z.uuid(),
    staff_code: z.string().regex(/^[A-F0-9]{10}$/),
    staff_type: z.enum(['domestic', 'society']),
    full_name: z.string(),
    phone: z.string(),
    photo_path: z.string().nullable(),
    id_type: z
      .enum(['aadhaar', 'pan', 'voter_id', 'passport', 'other'])
      .nullable(),
    id_last_four: z.string().nullable(),
    job_role: z.string(),
    police_verified: z.boolean(),
    status: z.enum(['active', 'blocked']),
    created_by: z.uuid(),
    department: z.string().nullable(),
    designation: z.string().nullable(),
    employment_type: staffEmploymentTypeSchema.nullable(),
    joining_date: z.iso.date().nullable(),
    weekly_off: staffWeeklyOffSchema.nullable(),
    employment_status: staffEmploymentStatusSchema,
    exit_date: z.iso.date().nullable(),
    unit_links: z.array(staffUnitLinkSchema),
  })
  .strict();

export const staffListSchema = z.array(staffSchema);

export const staffGateItemSchema = z
  .object({
    id: z.uuid(),
    staff_code: z.string().regex(/^[A-F0-9]{10}$/),
    full_name: z.string(),
    photo_path: z.string().nullable(),
    job_role: z.string(),
    status: z.enum(['active', 'blocked']),
    open_attendance_id: z.uuid().nullable(),
    blocked_today: z.boolean(),
    inside: z.boolean(),
  })
  .strict();

export const staffGateListSchema = z.array(staffGateItemSchema);

export const staffAttendanceSchema = z
  .object({
    id: z.uuid(),
    unit_id: z.uuid(),
    unit_label: z.string(),
    checked_in_at: z.iso.datetime(),
    checked_out_at: z.iso.datetime().nullable(),
    check_in_guard: z.string(),
    check_out_guard: z.string().nullable(),
  })
  .strict();

export const staffAttendanceListSchema = z.array(staffAttendanceSchema);

export const staffShiftAttendanceListSchema = z.array(
  z
    .object({
      staff_id: z.uuid(),
      staff_name: z.string(),
      attendance_date: z.iso.date(),
      status: z.enum(['present', 'absent', 'leave']),
    })
    .strict(),
);

export const staffRegistrationResultSchema = z
  .object({
    staff_id: z.uuid(),
    link_id: z.uuid(),
    status: z.enum(['pending', 'active']),
  })
  .strict();

export type Staff = z.infer<typeof staffSchema>;
export type StaffGateItem = z.infer<typeof staffGateItemSchema>;
export type StaffAttendance = z.infer<typeof staffAttendanceListSchema>[number];
export type StaffUnit = z.infer<typeof staffUnitSchema>;
export type StaffNote = z.infer<typeof staffNoteItemSchema>;
export type StaffShiftAttendance = z.infer<
  typeof staffShiftAttendanceListSchema
>[number];
