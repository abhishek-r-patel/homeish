// Load letter sources through existing permission-checked reads and log each unsaved PDF download.
import 'server-only';
import { z } from 'zod';
import { getAmenityWorkspace } from '../amenity/operations';
import { todayInTimeZone } from '../billing/format';
import { getBillingBill, listBillingBills } from '../billing/operations';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { AppError, createRequestId } from '../errors';
import { listSocietyMembers } from '../members/operations';
import { authorizeRequest } from '../permissions/authorize';
import { enforceRateLimit } from '../rate-limit';
import {
  readServiceRequest,
  readServiceRequests,
} from '../service-requests/queries';
import {
  buildRequestContext,
  type RequestContext,
} from '../tenancy/request-context';
import { getVendorWorkOrders } from '../vendor/operations';
import type { LetterSociety, LetterSource } from './content';
import { renderLetterPdf } from './pdf';
import {
  LETTER_SOURCE_TYPES,
  LETTER_TYPES,
  LETTER_TYPE_CONFIG,
  letterDraftSchema,
  letterFileName,
  letterGenerationLogSchema,
  type LetterGenerationLog,
  type LetterSourceType,
  type LetterType,
} from './validation';

const LETTER_ROLES = ['admin', 'committee'] as const;
const RECENT_LOG_LIMIT = 20;
const SERVICE_REQUEST_LIMIT = 50;

export type LetterSourceList = readonly LetterSource[] | null;

export interface LettersWorkspace {
  today: string;
  amenityDate: string;
  society: LetterSociety;
  letterTypes: readonly LetterType[];
  sources: Readonly<Record<LetterSourceType, LetterSourceList>>;
  recentLogs: readonly LetterGenerationLog[];
}

async function lettersContext(write = false, requestId = createRequestId()) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, { moduleKey: 'core', write });
  if (
    !context.societyId ||
    !context.roles.some((role) =>
      (LETTER_ROLES as readonly string[]).includes(role),
    )
  ) {
    throw new AppError('FORBIDDEN');
  }
  if (write) {
    await enforceRateLimit(
      'otherWritesUserMinute',
      context.userId,
      context.requestId,
    );
  }
  return { context, societyId: context.societyId };
}

async function readLetterSociety(
  context: RequestContext,
  societyId: string,
): Promise<LetterSociety> {
  const { data, error } = await context.db
    .from('societies')
    .select('name, address, city, contact_email, contact_phone, timezone')
    .eq('id', societyId)
    .single();
  if (error || !data) {
    throw new Error('Could not load the society letterhead.', {
      cause: error,
    });
  }
  return {
    name: data.name,
    address: data.address,
    city: data.city,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
    timezone: data.timezone,
  };
}

function enabledLetterTypes(context: RequestContext) {
  return LETTER_TYPES.filter((type) =>
    context.enabledModules.has(LETTER_TYPE_CONFIG[type].module),
  );
}

// A source list the viewer cannot read is shown as unavailable rather than failing the page.
async function optionalList(
  load: () => Promise<readonly LetterSource[]>,
): Promise<LetterSourceList> {
  try {
    return await load();
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === 'FORBIDDEN' || error.code === 'MODULE_DISABLED')
    ) {
      return null;
    }
    throw error;
  }
}

type BillRow = Awaited<ReturnType<typeof listBillingBills>>[number];

function billSource(bill: BillRow & { unit_number: string }): LetterSource {
  return {
    type: 'billing_bill',
    id: bill.id,
    unitNumber: bill.unit_number,
    title: bill.title,
    periodStart: bill.period_start,
    dueDate: bill.due_date,
    totalPaise: bill.total_paise,
    paidPaise: bill.paid_paise,
    waivedPaise: bill.waived_paise,
    outstandingPaise: bill.outstanding_paise,
  };
}

function isDuesBill(bill: BillRow): bill is BillRow & { unit_number: string } {
  return (
    bill.status !== 'cancelled' &&
    bill.outstanding_paise > 0 &&
    typeof bill.unit_number === 'string'
  );
}

async function memberSources(): Promise<LetterSource[]> {
  const { members } = await listSocietyMembers();
  const seen = new Set<string>();
  const sources: LetterSource[] = [];
  for (const member of members) {
    if (member.status !== 'active') continue;
    const key = `${member.membership_id}:${member.unit_number ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      type: 'membership',
      id: member.membership_id,
      fullName: member.full_name?.trim() || 'Resident',
      unitNumber: member.unit_number,
    });
  }
  return sources;
}

type ServiceRequestRow = Awaited<
  ReturnType<typeof readServiceRequest>
>['request'];

function serviceRequestSource(request: ServiceRequestRow): LetterSource {
  return {
    type: 'service_request',
    id: request.id,
    unitNumber: request.unit_number,
    categoryName: request.category_name,
    description: request.description,
    createdAt: request.created_at,
    requesterName: request.requester_name,
  };
}

async function amenitySources(date: string): Promise<LetterSource[]> {
  const workspace = await getAmenityWorkspace(date);
  return workspace.bookings
    .filter((booking) => booking.status === 'confirmed')
    .map((booking) => ({
      type: 'amenity_booking' as const,
      id: booking.id,
      date: workspace.date,
      unitNumber: booking.unit_number,
      amenityName: booking.amenity_name,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      guestCount: booking.guest_count,
      feePaise: booking.fee_paise,
      rulesSnapshot: booking.rules_snapshot,
    }));
}

async function workOrderSources(): Promise<LetterSource[]> {
  const { work_orders: orders } = await getVendorWorkOrders();
  return orders
    .filter((order) => order.status !== 'cancelled')
    .map((order) => ({
      type: 'vendor_work_order' as const,
      id: order.id,
      number: order.number,
      vendorName: order.vendor_name,
      requestTitle: order.request_title,
      description: order.description,
      valuePaise: order.value_paise,
      issuedOn: order.issued_on,
      dueOn: order.due_on,
    }));
}

async function readRecentLogs(context: RequestContext, societyId: string) {
  return callModuleRpc(
    context,
    'letter_generation_logs_get',
    { p_society_id: societyId, p_limit: RECENT_LOG_LIMIT },
    z.array(letterGenerationLogSchema),
    'Could not load recent letters.',
  );
}

export async function getLettersWorkspace(
  amenityDate?: string,
): Promise<LettersWorkspace> {
  const { context, societyId } = await lettersContext();
  const society = await readLetterSociety(context, societyId);
  const today = todayInTimeZone(society.timezone);
  const date = z.iso.date().safeParse(amenityDate).success
    ? (amenityDate as string)
    : today;
  const letterTypes = enabledLetterTypes(context);
  const neededSources = new Set(
    letterTypes.flatMap((type) => LETTER_TYPE_CONFIG[type].sourceType ?? []),
  );
  const loaders: Record<
    LetterSourceType,
    () => Promise<readonly LetterSource[]>
  > = {
    billing_bill: async () =>
      (await listBillingBills(1, 100)).filter(isDuesBill).map(billSource),
    membership: memberSources,
    service_request: async () =>
      (
        await readServiceRequests(context, societyId, {
          limit: SERVICE_REQUEST_LIMIT,
        })
      ).map(serviceRequestSource),
    amenity_booking: () => amenitySources(date),
    vendor_work_order: workOrderSources,
  };
  const [recentLogs, ...lists] = await Promise.all([
    readRecentLogs(context, societyId),
    ...LETTER_SOURCE_TYPES.map((type) =>
      neededSources.has(type)
        ? optionalList(loaders[type])
        : Promise.resolve(null),
    ),
  ]);
  return {
    today,
    amenityDate: date,
    society,
    letterTypes,
    sources: Object.fromEntries(
      LETTER_SOURCE_TYPES.map((type, index) => [type, lists[index] ?? null]),
    ) as Record<LetterSourceType, LetterSourceList>,
    recentLogs,
  };
}

async function verifySource(
  context: RequestContext,
  societyId: string,
  sourceType: LetterSourceType,
  sourceId: string,
  sourceDate: string | null,
) {
  let found = false;
  switch (sourceType) {
    case 'billing_bill': {
      const bill = await getBillingBill(sourceId);
      found = bill.status !== 'cancelled' && bill.outstanding_paise > 0;
      break;
    }
    case 'membership': {
      const { members } = await listSocietyMembers();
      found = members.some(
        (member) =>
          member.membership_id === sourceId && member.status === 'active',
      );
      break;
    }
    case 'service_request': {
      const detail = await readServiceRequest(context, societyId, sourceId);
      found = detail.request.id === sourceId;
      break;
    }
    case 'amenity_booking': {
      if (!sourceDate) break;
      const sources = await amenitySources(sourceDate);
      found = sources.some((source) => source.id === sourceId);
      break;
    }
    case 'vendor_work_order': {
      const sources = await workOrderSources();
      found = sources.some((source) => source.id === sourceId);
      break;
    }
  }
  if (!found) throw new AppError('NOT_FOUND');
}

export async function downloadLetter(input: unknown, requestId: string) {
  const { context, societyId } = await lettersContext(true, requestId);
  const draft = parseModuleInput(letterDraftSchema, input);
  const config = LETTER_TYPE_CONFIG[draft.letterType];
  authorizeRequest(context, { moduleKey: config.module, write: true });
  if (config.sourceType && draft.sourceId) {
    await verifySource(
      context,
      societyId,
      config.sourceType,
      draft.sourceId,
      draft.sourceDate,
    );
  }
  const society = await readLetterSociety(context, societyId);
  const body = await renderLetterPdf(draft, society);
  await callModuleRpc(
    context,
    'letter_generation_record',
    {
      p_society_id: societyId,
      p_letter_type: draft.letterType,
      p_source_type: config.sourceType,
      p_source_id: config.sourceType ? draft.sourceId : null,
      p_request_id: context.requestId,
    },
    z.uuid(),
    'Could not record the letter download.',
  );
  return {
    body,
    contentType: 'application/pdf',
    fileName: letterFileName(draft.letterType, draft.letterDate),
  };
}
