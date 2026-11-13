// Read staff data through permission-checked, schema-validated RPCs.
import 'server-only';
import { z } from 'zod';
import { AppError, ConflictError, ValidationError } from '../errors';
import { invokeUntypedRpc } from '../db/untyped-rpc';
import type { RequestContext } from '../tenancy/request-context';
import {
  staffAttendanceListSchema,
  staffGateListSchema,
  staffListSchema,
  staffRegistrationResultSchema,
  staffShiftAttendanceListSchema,
  staffUnitSchema,
} from './validation';

function raiseStaffRpcError(
  label: string,
  error: { code?: string; hint?: string } | null,
): never {
  if (error?.code === '42501') throw new AppError('FORBIDDEN');
  if (error?.code === 'P0002') throw new AppError('NOT_FOUND');
  if (error?.code === '23505') {
    throw new ConflictError('invalid_state', 'The staff record has changed.');
  }
  if (error?.code === '22023' || error?.code === '23514') {
    throw new ValidationError({
      form: 'Check the staff details and try again.',
    });
  }
  throw new Error(label, {
    cause: error ? { code: error.code ?? 'unknown' } : undefined,
  });
}

export async function staffRpc<T>(
  context: RequestContext,
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
  label: string,
): Promise<T> {
  let result: unknown;
  try {
    result = await invokeUntypedRpc<unknown>(context.db, name, args);
  } catch (error) {
    const cause = z
      .object({
        code: z.string().optional(),
        hint: z.string().optional(),
      })
      .safeParse(error instanceof Error ? error.cause : null);
    raiseStaffRpcError(label, cause.success ? cause.data : null);
  }
  return schema.parse(result);
}

export async function readStaff(context: RequestContext, societyId: string) {
  return staffRpc(
    context,
    'staff_list',
    { p_society_id: societyId },
    staffListSchema,
    'Could not load staff.',
  );
}

export async function readStaffUnits(
  context: RequestContext,
  societyId: string,
) {
  return staffRpc(
    context,
    'staff_units_list',
    { p_society_id: societyId },
    z.array(staffUnitSchema),
    'Could not load the staff unit list.',
  );
}

export async function readGateStaff(
  context: RequestContext,
  societyId: string,
  unitId: string,
) {
  return staffRpc(
    context,
    'staff_gate_list',
    { p_society_id: societyId, p_unit_id: unitId },
    staffGateListSchema,
    'Could not load registered staff for the gate.',
  );
}

export async function readStaffAttendance(
  context: RequestContext,
  societyId: string,
  staffId: string,
  month: string,
) {
  return staffRpc(
    context,
    'staff_attendance_list',
    {
      p_society_id: societyId,
      p_staff_id: staffId,
      p_month: month,
    },
    staffAttendanceListSchema,
    'Could not load staff attendance.',
  );
}

export async function readStaffShiftAttendance(
  context: RequestContext,
  societyId: string,
  month: string,
) {
  return staffRpc(
    context,
    'staff_shift_list',
    { p_society_id: societyId, p_month: month },
    staffShiftAttendanceListSchema,
    'Could not load society staff attendance.',
  );
}

export async function registerResidentStaff(
  context: RequestContext,
  args: Record<string, unknown>,
) {
  return staffRpc(
    context,
    'staff_resident_register',
    args,
    staffRegistrationResultSchema,
    'Could not register domestic staff.',
  );
}

export async function readStaffRegistrationSettings(
  context: RequestContext,
  societyId: string,
) {
  const { data, error } = await context.db
    .from('module_configs')
    .select('settings')
    .eq('society_id', societyId)
    .eq('module_key', 'staff')
    .maybeSingle();
  if (error) {
    throw new Error('Could not load staff settings.', { cause: error });
  }
  if (!data) throw new AppError('NOT_FOUND');
  return data.settings;
}

export async function readStaffTimezone(
  context: RequestContext,
  societyId: string,
) {
  const { data, error } = await context.db
    .from('societies')
    .select('timezone')
    .eq('id', societyId)
    .maybeSingle();
  if (error) {
    throw new Error('Could not load the society time zone.', { cause: error });
  }
  if (!data) throw new AppError('NOT_FOUND');
  return data.timezone;
}
