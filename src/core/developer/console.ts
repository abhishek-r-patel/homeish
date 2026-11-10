// Developer-only operations for society, module and operations consoles.
import { z } from 'zod';
import { AppError, ValidationError, createRequestId } from '../errors';
import type { Database, Json } from '../db/database.types';
import type { RequestContext } from '../tenancy/request-context';
import { buildRequestContext } from '../tenancy/request-context';
import { MODULE_KEYS, parseModuleSettings } from '../modules';
import type { ModuleKey } from '../modules';
import { isModuleKey } from '../permissions';
import type { DeveloperSocietyStatus } from './status';
import {
  SOCIETY_LOGO_CONTENT_TYPES,
  verifyFileAttachment,
} from '../files/attachments';

export { societyStatusSchema } from './status';
export type { DeveloperSocietyStatus } from './status';
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value));

export const societyInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    address: optionalText(120),
    city: optionalText(120),
    contactEmail: optionalText(254).pipe(z.email().nullable()),
    contactPhone: optionalText(16).pipe(
      z
        .string()
        .regex(/^\+?[0-9]{10,15}$/)
        .nullable(),
    ),
    timezone: z.string().trim().min(1).max(64),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/),
    unitLabel: z
      .string()
      .trim()
      .min(1)
      .max(24)
      .regex(/^[\p{L} ]+$/u),
    plan: optionalText(120),
  })
  .strict();

export type SocietyInput = z.infer<typeof societyInputSchema>;

export const firstAdminSchema = z
  .object({ email: z.email().trim().toLowerCase().max(254) })
  .strict();

const pageSizeSchema = z.preprocess(
  (value) => Number(value),
  z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]),
);
export type DeveloperPageSize = z.output<typeof pageSizeSchema>;

export const pageSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: pageSizeSchema.default(25),
  })
  .strict();

export const errorFilterSchema = pageSchema
  .extend({
    referenceId: z.string().trim().min(4).max(32).optional(),
    societyId: z.uuid().optional(),
    moduleKey: z.enum(MODULE_KEYS).optional(),
    severity: z.enum(['critical', 'error', 'warning', 'info']).optional(),
    status: z.enum(['open', 'resolved', 'ignored']).optional(),
    source: z.enum(['server', 'client', 'job']).optional(),
    userId: z.uuid().optional(),
    from: z.iso.date().optional(),
    before: z.iso.date().optional(),
    text: z.string().trim().min(2).max(60).optional(),
  })
  .strict()
  .refine(({ from, before }) => !from || !before || from < before, {
    path: ['before'],
    message: 'Choose an end date after the start date.',
  });

export const auditFilterSchema = pageSchema
  .extend({
    societyId: z.uuid().optional(),
    actorId: z.uuid().optional(),
    action: z.string().trim().min(2).max(120).optional(),
    entityType: z.string().trim().min(2).max(80).optional(),
    from: z.iso.date().optional(),
    before: z.iso.date().optional(),
  })
  .strict()
  .refine(({ from, before }) => !from || !before || from < before, {
    path: ['before'],
    message: 'Choose an end date after the start date.',
  });

export type ErrorFilters = z.infer<typeof errorFilterSchema>;
export type AuditFilters = z.infer<typeof auditFilterSchema>;

export type DeveloperActionResult =
  | { ok: true; message?: string; societyId?: string }
  | {
      ok: false;
      code: string;
      message: string;
      referenceId?: string;
      fieldErrors?: Readonly<Record<string, string>>;
      retryAfterSeconds?: number;
    };

export async function requireDeveloperContext(
  requestId = createRequestId(),
): Promise<RequestContext> {
  const context = await buildRequestContext(requestId);
  if (!context.isDeveloperAccount) {
    throw new AppError('FORBIDDEN');
  }
  if (!context.mfaVerified) {
    throw new AppError('MFA_REQUIRED');
  }
  return context;
}

function throwDatabaseError(error: { code?: string; message: string }): never {
  if (error.code === '42501') throw new AppError('FORBIDDEN');
  if (error.code === '28000') throw new AppError('SESSION_EXPIRED');
  if (error.code === 'P0002') throw new AppError('NOT_FOUND');
  if (error.code === '23505') {
    throw new AppError('CONFLICT', { reason: 'invalid_state' });
  }
  if (error.code === '22023' || error.code === '23514') {
    throw new ValidationError({ form: 'Check the details and try again.' });
  }
  throw new Error('The developer operation could not be completed.', {
    cause: error,
  });
}

type DeveloperFunction = keyof Database['public']['Functions'];

async function rpc<Name extends DeveloperFunction>(
  context: RequestContext,
  name: Name,
  args: Database['public']['Functions'][Name]['Args'],
): Promise<Database['public']['Functions'][Name]['Returns']> {
  const result = await context.db.rpc(name, args);
  if (result.error) throwDatabaseError(result.error);
  return result.data;
}

export async function createSociety(
  context: RequestContext,
  input: SocietyInput,
): Promise<string> {
  return rpc(context, 'developer_create_society', {
    p_name: input.name,
    p_address: input.address ?? '',
    p_city: input.city ?? '',
    p_contact_email: input.contactEmail ?? '',
    p_contact_phone: input.contactPhone ?? '',
    p_timezone: input.timezone,
    p_currency: input.currency,
    p_unit_label: input.unitLabel,
    p_plan: input.plan ?? '',
    p_request_id: context.requestId,
  });
}

export async function updateSociety(
  context: RequestContext,
  societyId: string,
  input: SocietyInput,
) {
  return rpc(context, 'developer_update_society', {
    p_society_id: societyId,
    p_name: input.name,
    p_address: input.address ?? '',
    p_city: input.city ?? '',
    p_contact_email: input.contactEmail ?? '',
    p_contact_phone: input.contactPhone ?? '',
    p_timezone: input.timezone,
    p_currency: input.currency,
    p_unit_label: input.unitLabel,
    p_plan: input.plan ?? '',
    p_request_id: context.requestId,
  });
}

export async function updateSocietyLogo(
  context: RequestContext,
  societyId: string,
  logoPath: string | null,
) {
  const { data: before, error: lookupError } = await context.db
    .from('societies')
    .select('logo_path')
    .eq('id', societyId)
    .maybeSingle();
  if (lookupError) {
    throw new Error('Could not load the current society logo.', {
      cause: lookupError,
    });
  }
  if (!before) throw new AppError('NOT_FOUND');
  if (before.logo_path === logoPath) return;

  if (logoPath !== null) {
    await verifyFileAttachment(context, {
      bucket: 'society-assets',
      contentTypes: SOCIETY_LOGO_CONTENT_TYPES,
      ownerPath: `${societyId}/logos`,
      path: logoPath,
      societyId,
    });
  }

  type LogoRpcResult = {
    data: unknown;
    error: { code?: string; message: string } | null;
  };
  const logoRpc = context.db.rpc.bind(context.db) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<LogoRpcResult>;
  const result = await logoRpc('developer_update_society_logo', {
    p_society_id: societyId,
    p_logo_path: logoPath,
    p_request_id: context.requestId,
  });
  if (result.error) throwDatabaseError(result.error);

  if (before.logo_path && before.logo_path !== logoPath) {
    const { error } = await context.db.storage
      .from('society-assets')
      .remove([before.logo_path]);
    if (error) {
      context.logger.warn('society.logo.orphan_cleanup_failed', {
        societyId,
      });
    }
  }
}

export async function setSocietyStatus(
  context: RequestContext,
  societyId: string,
  status: DeveloperSocietyStatus,
) {
  return rpc(context, 'developer_set_society_status', {
    p_society_id: societyId,
    p_status: status,
    p_request_id: context.requestId,
  });
}

export async function toggleModule(
  context: RequestContext,
  societyId: string,
  moduleKey: ModuleKey,
  enabled: boolean,
) {
  return rpc(context, 'developer_toggle_module', {
    p_society_id: societyId,
    p_module_key: moduleKey,
    p_enabled: enabled,
    p_request_id: context.requestId,
  });
}

export async function updateModuleSettings(
  context: RequestContext,
  societyId: string,
  moduleKey: ModuleKey,
  settings: unknown,
) {
  const parsed = parseModuleSettings(moduleKey, settings);
  return rpc(context, 'developer_update_module_settings', {
    p_society_id: societyId,
    p_module_key: moduleKey,
    p_settings: toJson(parsed),
    p_request_id: context.requestId,
  });
}

export async function createFirstAdmin(
  context: RequestContext,
  societyId: string,
  email: string,
) {
  return rpc(context, 'developer_create_first_admin', {
    p_society_id: societyId,
    p_email: email,
    p_request_id: context.requestId,
  });
}

export async function setErrorStatus(
  context: RequestContext,
  errorId: string,
  status: 'resolved' | 'ignored',
  note: string | null,
) {
  return rpc(context, 'developer_set_error_status', {
    p_error_id: errorId,
    p_status: status,
    p_note: note ?? '',
    p_request_id: context.requestId,
  });
}

export async function getDeveloperSocieties(
  page = 1,
  pageSize: DeveloperPageSize = 25,
) {
  const context = await requireDeveloperContext();
  const client = context.db;
  const start = (page - 1) * pageSize;
  const { data, error, count } = await client
    .from('societies')
    .select('id, name, city, status, plan, created_at, updated_at', {
      count: 'exact',
    })
    .order('name', { ascending: true })
    .range(start, start + pageSize - 1);
  if (error) throw new Error('Could not load societies.', { cause: error });
  const societies = data ?? [];
  const ids = societies.map(({ id }) => id);
  if (ids.length === 0) {
    return {
      societies: [],
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  }
  const { data: configs, error: configError } = await client
    .from('module_configs')
    .select('society_id, module_key')
    .in('society_id', ids)
    .eq('enabled', true);
  if (configError) {
    throw new Error('Could not load enabled modules.', { cause: configError });
  }
  const enabledCount = new Map<string, number>();
  for (const config of configs ?? []) {
    enabledCount.set(
      config.society_id,
      (enabledCount.get(config.society_id) ?? 0) + 1,
    );
  }
  const recentErrors = await Promise.all(
    ids.map(async (societyId) => {
      const { data: errorRow, error: logError } = await client
        .from('error_logs')
        .select('created_at')
        .eq('society_id', societyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (logError) {
        throw new Error('Could not load the latest society error.', {
          cause: logError,
        });
      }
      return [societyId, errorRow?.created_at ?? null] as const;
    }),
  );
  const lastError = new Map(recentErrors);
  return {
    societies: societies.map((society) => ({
      ...society,
      enabledModuleCount: enabledCount.get(society.id) ?? 0,
      lastErrorAt: lastError.get(society.id) ?? null,
    })),
    page,
    pageSize,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getDeveloperSociety(societyId: string) {
  const context = await requireDeveloperContext();
  const client = context.db;
  const { data, error } = await client
    .from('societies')
    .select(
      'id, name, unit_label, address, city, contact_email, contact_phone, timezone, currency, logo_path, status, plan, gate_login_mode, guard_identification, created_at, created_by, updated_at, updated_by',
    )
    .eq('id', societyId)
    .maybeSingle();
  if (error) throw new Error('Could not load the society.', { cause: error });
  if (!data) throw new AppError('NOT_FOUND');
  return data;
}

export async function getDeveloperModules(societyId: string) {
  const context = await requireDeveloperContext();
  const client = context.db;
  const [modulesResult, configsResult] = await Promise.all([
    client
      .from('modules')
      .select('key, name, is_core, sort_order')
      .order('sort_order', { ascending: true }),
    client
      .from('module_configs')
      .select('module_key, enabled, settings, updated_at, updated_by')
      .eq('society_id', societyId),
  ]);
  if (modulesResult.error) {
    throw new Error('Could not load the module registry.', {
      cause: modulesResult.error,
    });
  }
  if (configsResult.error) {
    throw new Error('Could not load society module settings.', {
      cause: configsResult.error,
    });
  }
  const updatedByIds = [
    ...new Set(
      (configsResult.data ?? [])
        .map(({ updated_by }) => updated_by)
        .filter((userId): userId is string => userId !== null),
    ),
  ];
  const { data: profiles, error: profilesError } =
    updatedByIds.length > 0
      ? await context.db
          .from('profiles')
          .select('id, full_name')
          .in('id', updatedByIds)
      : { data: [], error: null };
  if (profilesError) {
    throw new Error('Could not load the module change history.', {
      cause: profilesError,
    });
  }
  const profileNames = new Map(
    (profiles ?? []).map(({ id, full_name }) => [id, full_name]),
  );
  const configs = new Map(
    (configsResult.data ?? []).map((config) => [config.module_key, config]),
  );
  return (modulesResult.data ?? []).flatMap((module) => {
    if (!isModuleKey(module.key)) return [];
    const moduleKey = module.key;
    const config = configs.get(moduleKey);
    return [
      {
        ...module,
        key: moduleKey,
        enabled: module.is_core || (config?.enabled ?? false),
        settings: parseModuleSettings(moduleKey, config?.settings ?? {}),
        updatedAt: config?.updated_at ?? null,
        updatedBy: config?.updated_by ?? null,
        updatedByName: config?.updated_by
          ? (profileNames.get(config.updated_by) ?? 'Unknown')
          : null,
      },
    ];
  });
}

export async function listDeveloperErrors(filters: ErrorFilters) {
  const context = await requireDeveloperContext();
  const client = context.db;
  if (filters.referenceId) {
    const { data, error } = await client
      .from('error_logs')
      .select('*')
      .eq('reference_id', filters.referenceId)
      .maybeSingle();
    if (error)
      throw new Error('Could not look up the error.', { cause: error });
    return { rows: data ? [data] : [], total: data ? 1 : 0 };
  }

  let query = client
    .from('error_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (filters.societyId) query = query.eq('society_id', filters.societyId);
  if (filters.moduleKey) query = query.eq('module_key', filters.moduleKey);
  if (filters.severity) query = query.eq('severity', filters.severity);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.source) query = query.eq('source', filters.source);
  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.from) query = query.gte('created_at', istMidnight(filters.from));
  if (filters.before) {
    query = query.lt('created_at', istMidnight(filters.before));
  }
  if (filters.text) {
    const literal = filters.text.replace(/[\\%_]/g, '\\$&');
    query = query.ilike('message', `%${literal}%`);
  }
  const start = (filters.page - 1) * filters.pageSize;
  const { data, error, count } = await query.range(
    start,
    start + filters.pageSize - 1,
  );
  if (error) throw new Error('Could not load error logs.', { cause: error });
  return { rows: data ?? [], total: count ?? 0 };
}

function istMidnight(date: string): string {
  return new Date(`${date}T00:00:00+05:30`).toISOString();
}

export async function getDeveloperError(errorId: string) {
  const context = await requireDeveloperContext();
  const { data, error } = await context.db
    .from('error_logs')
    .select('*')
    .eq('id', errorId)
    .maybeSingle();
  if (error)
    throw new Error('Could not load the error details.', { cause: error });
  if (!data) throw new AppError('NOT_FOUND');
  return data;
}

export async function listDeveloperAudit(filters: AuditFilters) {
  const context = await requireDeveloperContext();
  const client = context.db;
  let query = client
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (filters.societyId) query = query.eq('society_id', filters.societyId);
  if (filters.actorId) query = query.eq('actor_id', filters.actorId);
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.entityType) query = query.eq('entity_type', filters.entityType);
  if (filters.from) query = query.gte('created_at', istMidnight(filters.from));
  if (filters.before) {
    query = query.lt('created_at', istMidnight(filters.before));
  }
  const start = (filters.page - 1) * filters.pageSize;
  const { data, error, count } = await query.range(
    start,
    start + filters.pageSize - 1,
  );
  if (error) throw new Error('Could not load audit logs.', { cause: error });
  const rows = data ?? [];
  const societyIds = [
    ...new Set(
      rows
        .map(({ society_id }) => society_id)
        .filter((societyId): societyId is string => societyId !== null),
    ),
  ];
  const actorIds = [
    ...new Set(
      rows
        .map(({ actor_id }) => actor_id)
        .filter((actorId): actorId is string => actorId !== null),
    ),
  ];
  const [societiesResult, profilesResult] = await Promise.all([
    societyIds.length > 0
      ? client.from('societies').select('id, name').in('id', societyIds)
      : Promise.resolve({ data: [], error: null }),
    actorIds.length > 0
      ? client.from('profiles').select('id, full_name').in('id', actorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (societiesResult.error) {
    throw new Error('Could not load audit society names.', {
      cause: societiesResult.error,
    });
  }
  if (profilesResult.error) {
    throw new Error('Could not load audit actor names.', {
      cause: profilesResult.error,
    });
  }
  const societyNames = new Map(
    (societiesResult.data ?? []).map(({ id, name }) => [id, name]),
  );
  const actorNames = new Map(
    (profilesResult.data ?? []).map(({ id, full_name }) => [id, full_name]),
  );
  return {
    rows: rows.map((row) => ({
      ...row,
      societyName: row.society_id
        ? (societyNames.get(row.society_id) ?? 'Unknown')
        : 'Platform',
      actorName: row.actor_id
        ? (actorNames.get(row.actor_id) ?? 'Unknown')
        : 'System',
    })),
    total: count ?? 0,
  };
}

export async function getDeveloperHealthSummary() {
  const context = await requireDeveloperContext();
  return rpc(context, 'developer_health_summary', {});
}

function toJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, toJson(child)]),
    );
  }
  throw new Error('Module settings must be valid JSON.');
}
