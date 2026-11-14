// Authorize AMC management, verify private attachments and preserve renewal history.
import 'server-only';
import { z } from 'zod';
import { AppError, createRequestId } from '../errors';
import { callModuleRpc, parseModuleInput } from '../db/validated-rpc';
import { FILE_CONTENT_TYPES, verifyFileAttachment } from '../files/attachments';
import { authorizeRequest } from '../permissions/authorize';
import {
  buildRequestContext,
  type RequestContext,
} from '../tenancy/request-context';
import { toCsv } from '../csv/serialize';
import {
  amcContractInputSchema,
  amcVisitInputSchema,
  amcWorkspaceSchema,
  amcRequestLinkSchema,
  type AmcContract,
  type AmcVisit,
} from './validation';

async function amcContext(write = false, requestId = createRequestId()) {
  const context = await buildRequestContext(requestId);
  authorizeRequest(context, {
    moduleKey: 'amc',
    permission: write ? 'amc:manage' : 'amc:list',
    write,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  return { context, societyId: context.societyId };
}
async function attachment(
  context: RequestContext,
  societyId: string,
  path: string | null,
) {
  if (path)
    await verifyFileAttachment(context, {
      bucket: 'amc-files',
      contentTypes: FILE_CONTENT_TYPES,
      societyId,
      path,
      ownerPath: path.split('/').slice(0, -1).join('/'),
    });
}
async function sign(context: RequestContext, path: string | null) {
  if (!path) return null;
  const { data, error } = await context.db.storage
    .from('amc-files')
    .createSignedUrl(path, 300);
  if (error || !data)
    throw new Error('Could not open the private AMC attachment.', {
      cause: error,
    });
  return data.signedUrl;
}
export async function getAmcWorkspace() {
  const { context, societyId } = await amcContext();
  const workspace = await callModuleRpc(
    context,
    'amc_workspace',
    { p_society_id: societyId },
    amcWorkspaceSchema,
    'Could not load AMC contracts.',
  );
  const [contracts, visits] = await Promise.all([
    Promise.all(
      workspace.contracts.map(async (row) => ({
        ...row,
        documentUrl: await sign(context, row.document_path),
      })),
    ),
    Promise.all(
      workspace.visits.map(async (row) => ({
        ...row,
        documentUrl: await sign(context, row.document_path),
      })),
    ),
  ]);
  return { ...workspace, contracts, visits };
}
export async function saveAmcContract(input: unknown, requestId: string) {
  const { context, societyId } = await amcContext(true, requestId);
  const v = parseModuleInput(amcContractInputSchema, input);
  await attachment(context, societyId, v.documentPath);
  return callModuleRpc(
    context,
    'amc_contract_save',
    {
      p_society_id: societyId,
      p_contract_id: v.contractId,
      p_asset_label: v.assetLabel,
      p_vendor_name: v.vendorName,
      p_vendor_contact: v.vendorContact,
      p_start_date: v.startDate,
      p_end_date: v.endDate,
      p_cost_paise: v.costRupees,
      p_payment_terms: v.paymentTerms,
      p_visit_frequency: v.visitFrequency,
      p_document_path: v.documentPath,
      p_predecessor_id: v.predecessorId,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the contract details and renewal history.',
  );
}
export async function saveAmcVisit(input: unknown, requestId: string) {
  const { context, societyId } = await amcContext(true, requestId);
  const v = parseModuleInput(amcVisitInputSchema, input);
  await attachment(context, societyId, v.documentPath);
  return callModuleRpc(
    context,
    'amc_visit_save',
    {
      p_society_id: societyId,
      p_contract_id: v.contractId,
      p_visit_id: v.visitId,
      p_visit_date: v.visitDate,
      p_summary: v.summary,
      p_technician: v.technician,
      p_document_path: v.documentPath,
      p_expected_updated_at: v.expectedUpdatedAt,
      p_client_request_id: v.clientRequestId,
      p_request_trace: requestId,
    },
    z.uuid(),
    'Check the service visit details. Future visit dates are not allowed.',
  );
}
export async function linkRequestToAmc(input: unknown, requestId: string) {
  const { context, societyId } = await amcContext(true, requestId);
  authorizeRequest(context, {
    moduleKey: 'service_request',
    permission: 'request:assign',
    write: true,
  });
  const v = parseModuleInput(amcRequestLinkSchema, input);
  await callModuleRpc(
    context,
    'amc_request_link',
    {
      p_society_id: societyId,
      p_request_id: v.requestId,
      p_contract_id: v.contractId,
      p_request_trace: requestId,
    },
    z.null(),
    'Could not update the AMC request link.',
  );
}
export async function getRequestAmcLink(
  context: RequestContext,
  societyId: string,
  requestId: string,
) {
  if (!context.enabledModules.has('amc'))
    return {
      assetLabel: null,
      contracts: [] as AmcContract[],
      contractId: null,
    };
  const assetLabel = await callModuleRpc(
    context,
    'amc_request_label',
    { p_society_id: societyId, p_request_id: requestId },
    z.string().nullable(),
    'Could not load the AMC asset label.',
  );
  const workspace = context.roles.includes('admin')
    ? await callModuleRpc(
        context,
        'amc_workspace',
        { p_society_id: societyId },
        amcWorkspaceSchema,
        'Could not load AMC link choices.',
      )
    : null;
  return {
    assetLabel,
    contracts: workspace?.contracts ?? [],
    contractId:
      workspace?.links.find((link) => link.request_id === requestId)
        ?.contract_id ?? null,
  };
}
export function filterAmcContracts<T extends AmcContract>(
  contracts: T[],
  filters: { status?: string; vendor?: string; asset?: string },
) {
  return contracts.filter(
    (row) =>
      (!filters.status || filters.status === row.status) &&
      row.vendor_name
        .toLowerCase()
        .includes((filters.vendor ?? '').toLowerCase()) &&
      row.asset_label
        .toLowerCase()
        .includes((filters.asset ?? '').toLowerCase()),
  );
}
export function amcCsv(
  contracts: AmcContract[],
  visits: AmcVisit[],
  type: 'contracts' | 'visits',
) {
  return type === 'contracts'
    ? toCsv(
        [
          'Asset',
          'Vendor',
          'Contact',
          'Start',
          'End',
          'Cost (paise)',
          'Payment terms',
          'Visit frequency',
          'Status',
          'Previous contract',
        ],
        contracts.map((r) => [
          r.asset_label,
          r.vendor_name,
          r.vendor_contact,
          r.start_date,
          r.end_date,
          r.cost_paise,
          r.payment_terms,
          r.visit_frequency,
          r.status,
          r.predecessor_id,
        ]),
      )
    : toCsv(
        ['Contract', 'Visit date', 'Summary', 'Technician'],
        visits
          .filter((v) => contracts.some((c) => c.id === v.contract_id))
          .map((v) => [v.contract_id, v.visit_date, v.summary, v.technician]),
      );
}
