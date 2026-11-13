// Enforce staff permissions, verify private photos and call audited RPCs.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId, ValidationError } from '../errors';
import { MAX_FILE_BYTES, verifyFileAttachment } from '../files/attachments';
import { authorizeRequest } from '../permissions/authorize';
import { buildRequestContext } from '../tenancy/request-context';
import { requireIdentifiedGuard } from '../guards/operations';
import {
  readGateStaff,
  readStaff,
  readStaffAttendance,
  readStaffRegistrationSettings,
  readStaffShiftAttendance,
  readStaffTimezone,
  readStaffUnits,
  staffRpc,
} from './queries';
import {
  DEFAULT_STAFF_SETTINGS,
  residentStaffRegistrationSchema,
  staffAdminSaveSchema,
  staffCheckInSchema,
  staffCheckOutSchema,
  staffDayBlockSchema,
  staffMonthSchema,
  staffRegistrationResultSchema,
  staffReviewSchema,
  staffSettingsSchema,
  staffShiftSchema,
  type StaffAttendance,
  type Staff,
  type StaffGateItem,
} from './validation';

type StaffPermission =
  | 'staff:list'
  | 'staff:manage'
  | 'staff:review'
  | 'staff:settings:manage'
  | 'staff:register'
  | 'staff:attendance'
  | 'staff:day_block'
  | 'staff:gate';

async function getContext(
  permission: StaffPermission,
  write = false,
  requestId = createRequestId(),
) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'staff', permission, write });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new ValidationError(
    Object.fromEntries(
      parsed.error.issues.map((issue) => [
        String(issue.path[0] ?? 'form'),
        issue.message,
      ]),
    ),
  );
}

function staffPhotoOwnerPath(
  path: string,
  societyId: string,
  userId: string,
  requireOwner: boolean,
) {
  const parts = path.split('/');
  if (
    parts.length !== 4 ||
    parts[0] !== societyId ||
    parts[1] !== 'staff' ||
    !z.uuid().safeParse(parts[2]).success ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/i.test(
      parts[3] ?? '',
    ) ||
    (requireOwner && parts[2] !== userId)
  ) {
    throw new ValidationError({ photoPath: 'Upload the staff photo again.' });
  }
  return parts.slice(0, 3).join('/');
}

async function verifyStaffPhoto(
  context: Awaited<ReturnType<typeof buildRequestContext>>,
  societyId: string,
  path: string | null,
  required: boolean,
  requireOwner: boolean,
) {
  if (!path) {
    if (required)
      throw new ValidationError({ photoPath: 'Upload a staff photo.' });
    return;
  }
  const ownerPath = staffPhotoOwnerPath(
    path,
    societyId,
    context.userId,
    requireOwner,
  );
  await verifyFileAttachment(context, {
    bucket: 'staff-photos',
    contentTypes: ['image/jpeg', 'image/png'],
    maxBytes: MAX_FILE_BYTES,
    ownerPath,
    path,
    societyId,
  });
}

async function signStaffPhotos<T extends { photo_path: string | null }>(
  context: Awaited<ReturnType<typeof buildRequestContext>>,
  staff: readonly T[],
) {
  return Promise.all(
    staff.map(async (member) => {
      if (!member.photo_path) return { ...member, photoUrl: null };
      const { data, error } = await context.db.storage
        .from('staff-photos')
        .createSignedUrl(member.photo_path, 300);
      if (error || !data) {
        throw new Error('A staff photo could not be loaded.', { cause: error });
      }
      return { ...member, photoUrl: data.signedUrl };
    }),
  );
}

async function removeStaffPhoto(
  context: Awaited<ReturnType<typeof buildRequestContext>>,
  path: string,
) {
  try {
    const { error } = await context.db.storage
      .from('staff-photos')
      .remove([path]);
    if (error) throw new Error('Staff photo cleanup failed.', { cause: error });
  } catch {
    context.logger.warn('staff.photo_cleanup_failed');
  }
}

export async function getStaffWorkspace() {
  const { context, societyId } = await getContext('staff:list');
  const [staff, units, timezone] = await Promise.all([
    readStaff(context, societyId),
    readStaffUnits(context, societyId),
    readStaffTimezone(context, societyId),
  ]);
  const month = monthInTimezone(timezone);
  const attendanceEntries: Array<[string, StaffAttendance[]]> =
    context.roles.includes('resident')
      ? await Promise.all(
          staff
            .filter(({ staff_type }) => staff_type === 'domestic')
            .map(async ({ id }): Promise<[string, StaffAttendance[]]> => [
              id,
              await readStaffAttendance(context, societyId, id, month),
            ]),
        )
      : [];
  const attendanceByStaffId = Object.fromEntries(attendanceEntries);
  return {
    societyId,
    staff: await signStaffPhotos(context, staff),
    units,
    attendanceByStaffId,
    month,
    timezone,
    canManage: context.roles.includes('admin'),
  };
}

export async function getStaffRegistrationOptions() {
  const { context, societyId } = await getContext('staff:register');
  return { units: await readStaffUnits(context, societyId) };
}

export async function getStaffSettings() {
  const { context, societyId } = await getContext('staff:settings:manage');
  const rawSettings = await readStaffRegistrationSettings(context, societyId);
  const settings = staffSettingsSchema.parse(rawSettings);
  return {
    residentApprovalRequired:
      settings.resident_approval_required ??
      DEFAULT_STAFF_SETTINGS.resident_approval_required,
  };
}

export async function updateStaffSettings(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'staff:settings:manage',
    true,
    requestId,
  );
  const parsed = parseInput(
    z.object({ residentApprovalRequired: z.boolean() }).strict(),
    input,
  );
  await staffRpc(
    context,
    'staff_settings_update',
    {
      p_society_id: societyId,
      p_resident_approval_required: parsed.residentApprovalRequired,
      p_request_id: context.requestId,
    },
    z.unknown(),
    'Could not update staff settings.',
  );
}

export async function registerDomesticStaff(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'staff:register',
    true,
    requestId,
  );
  const parsed = parseInput(residentStaffRegistrationSchema, input);
  await verifyStaffPhoto(context, societyId, parsed.photoPath, true, true);
  const result = await staffRpc(
    context,
    'staff_resident_register',
    {
      p_society_id: societyId,
      p_unit_id: parsed.unitId,
      p_full_name: parsed.fullName,
      p_phone: parsed.phone,
      p_photo_path: parsed.photoPath,
      p_id_type: parsed.idType,
      p_id_last_four: parsed.idLastFour,
      p_job_role: parsed.jobRole,
      p_police_verified: parsed.policeVerified,
      p_request_id: parsed.requestId,
      p_request_trace: context.requestId,
    },
    staffRegistrationResultSchema,
    'Could not register domestic staff.',
  );
  if (parsed.photoPath) {
    const savedStaff = await readStaff(context, societyId);
    if (
      !savedStaff.some(
        ({ id, photo_path }) =>
          id === result.staff_id && photo_path === parsed.photoPath,
      )
    ) {
      await removeStaffPhoto(context, parsed.photoPath);
    }
  }
  return {
    ...result,
    message:
      result.status === 'pending'
        ? 'Staff registration submitted for administrator review.'
        : 'Staff registration saved.',
  };
}

export async function saveStaff(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'staff:manage',
    true,
    requestId,
  );
  const parsed = parseInput(staffAdminSaveSchema, input);
  await verifyStaffPhoto(context, societyId, parsed.photoPath, true, false);
  const previous = parsed.staffId
    ? (await readStaff(context, societyId)).find(
        ({ id }) => id === parsed.staffId,
      )
    : undefined;
  if (parsed.staffId && !previous) throw new AppError('NOT_FOUND');
  const staffId = await staffRpc(
    context,
    'staff_admin_save',
    {
      p_society_id: societyId,
      p_staff_id: parsed.staffId,
      p_staff_type: parsed.staffType,
      p_full_name: parsed.fullName,
      p_phone: parsed.phone,
      p_photo_path: parsed.photoPath,
      p_id_type: parsed.idType,
      p_id_last_four: parsed.idLastFour,
      p_job_role: parsed.jobRole,
      p_police_verified: parsed.policeVerified,
      p_status: parsed.status,
      p_unit_ids: parsed.unitIds,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'Could not save staff details.',
  );
  if (previous?.photo_path && previous.photo_path !== parsed.photoPath) {
    await removeStaffPhoto(context, previous.photo_path);
  }
  return staffId;
}

export async function reviewStaffRegistration(
  input: unknown,
  requestId: string,
) {
  const { context, societyId } = await getContext(
    'staff:review',
    true,
    requestId,
  );
  const parsed = parseInput(staffReviewSchema, input);
  await staffRpc(
    context,
    'staff_review_link',
    {
      p_society_id: societyId,
      p_link_id: parsed.linkId,
      p_decision: parsed.decision,
      p_request_id: context.requestId,
    },
    z.unknown(),
    'Could not review the staff registration.',
  );
}

export async function blockStaffForToday(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'staff:day_block',
    true,
    requestId,
  );
  const parsed = parseInput(staffDayBlockSchema, input);
  return staffRpc(
    context,
    'staff_resident_day_block',
    {
      p_society_id: societyId,
      p_staff_id: parsed.staffId,
      p_unit_id: parsed.unitId,
      p_request_id: context.requestId,
    },
    z.iso.date(),
    'Could not block staff access for today.',
  );
}

export async function getStaffAttendance(staffId: string, month: string) {
  const { context, societyId } = await getContext('staff:attendance');
  const parsedStaffId = parseInput(z.uuid(), staffId);
  const parsedMonth = parseInput(staffMonthSchema, month);
  return readStaffAttendance(context, societyId, parsedStaffId, parsedMonth);
}

export async function getSocietyStaffAttendance(month: string) {
  const { context, societyId } = await getContext('staff:manage');
  const parsedMonth = parseInput(staffMonthSchema, month);
  return readStaffShiftAttendance(context, societyId, parsedMonth);
}

export async function markSocietyStaffShift(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'staff:manage',
    true,
    requestId,
  );
  const parsed = parseInput(staffShiftSchema, input);
  await staffRpc(
    context,
    'staff_shift_mark',
    {
      p_society_id: societyId,
      p_staff_id: parsed.staffId,
      p_attendance_date: parsed.attendanceDate,
      p_status: parsed.status,
      p_request_id: context.requestId,
    },
    z.unknown(),
    'Could not save society staff attendance.',
  );
}

export async function getGateStaffWorkspace(unitId?: string | null) {
  const { context, societyId } = await getContext('staff:gate');
  const guard = await requireIdentifiedGuard();
  const units = await readStaffUnits(context, societyId);
  const requestedUnitId = z.uuid().safeParse(unitId);
  const selectedUnitId =
    requestedUnitId.success &&
    units.some(({ id }) => id === requestedUnitId.data)
      ? requestedUnitId.data
      : (units[0]?.id ?? null);
  const staff = selectedUnitId
    ? await readGateStaff(context, societyId, selectedUnitId)
    : [];
  return {
    guard,
    units,
    staff: await signStaffPhotos(context, staff),
    unitId: selectedUnitId,
  };
}

export async function checkInDomesticStaff(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'staff:gate',
    true,
    requestId,
  );
  const parsed = parseInput(staffCheckInSchema, input);
  const guard = await requireIdentifiedGuard();
  return staffRpc(
    context,
    'staff_check_in',
    {
      p_society_id: societyId,
      p_unit_id: parsed.unitId,
      p_staff_code: parsed.staffCode,
      p_guard_id: guard.id,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'Could not record staff entry.',
  );
}

export async function checkOutDomesticStaff(input: unknown, requestId: string) {
  const { context, societyId } = await getContext(
    'staff:gate',
    true,
    requestId,
  );
  const parsed = parseInput(staffCheckOutSchema, input);
  const guard = await requireIdentifiedGuard();
  await staffRpc(
    context,
    'staff_check_out',
    {
      p_society_id: societyId,
      p_attendance_id: parsed.attendanceId,
      p_guard_id: guard.id,
      p_request_id: context.requestId,
    },
    z.unknown(),
    'Could not record staff exit.',
  );
}

export type StaffWorkspaceMember = Staff & { photoUrl: string | null };
export type GateStaffWorkspaceMember = StaffGateItem & {
  photoUrl: string | null;
};

function monthInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(new Date());
  const year = parts.find(({ type }) => type === 'year')?.value;
  const month = parts.find(({ type }) => type === 'month')?.value;
  if (!year || !month)
    throw new Error('Could not determine the society month.');
  return `${year}-${month}-01`;
}
