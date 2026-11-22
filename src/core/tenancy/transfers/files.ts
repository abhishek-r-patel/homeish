// Authorise P51 uploads and store prepared certificate bytes for attestation.
import 'server-only';
import { z } from 'zod';
import { callModuleRpc, parseModuleInput } from '../../db/validated-rpc';
import { AppError, ConflictError } from '../../errors';
import type { FileContentType } from '../../files/attachments';
import { authorizeRequest } from '../../permissions/authorize';
import type { RequestContext } from '../request-context';
import { tenancyCertificatePdf } from './documents';
import {
  certificatePathSchema,
  clearanceHandoverDetailSchema,
  clearanceUploadPathSchema,
  clearanceUploadInputSchema,
  certificatesPageSchema,
  type CertificatePreparation,
  type ClearanceHandoverDetail,
} from './validation';

export async function prepareClearanceFileUpload(
  context: RequestContext,
  input: {
    handoverId: string;
    coveredTransferPartyId: string | null;
    coveredMembershipId: string | null;
    contentType: FileContentType;
    sizeBytes: number;
  },
) {
  authorizeRequest(context, {
    moduleKey: 'tenancy',
    permission: 'tenancy:manage',
    write: true,
  });
  if (!context.societyId) throw new AppError('FORBIDDEN');
  const values = clearanceUploadInputSchema.parse(input);
  return callModuleRpc(
    context,
    'tenancy_clearance_file_upload_path',
    {
      p_society_id: context.societyId,
      p_handover_id: values.handoverId,
      p_covered_party_id: values.coveredTransferPartyId,
      p_covered_membership_id: values.coveredMembershipId,
      p_content_type: values.contentType,
      p_size_bytes: values.sizeBytes,
    },
    clearanceUploadPathSchema,
    'The handover agreement upload is unavailable. Refresh the draft and use a PDF, JPG or PNG up to 5 MiB.',
  );
}

async function authoriseClearanceFile(context: RequestContext, path: string) {
  const [societyId, , handoverId] = path.split('/');
  if (!societyId || !handoverId || societyId !== context.societyId) {
    throw new AppError('FORBIDDEN');
  }
  const detail = await callModuleRpc(
    context,
    'tenancy_clearance_handover_get',
    { p_society_id: societyId, p_handover_id: handoverId },
    clearanceHandoverDetailSchema,
    'Could not verify access to this handover agreement.',
  );
  if (!detail.files.some((file) => file.path === path)) {
    throw new AppError('NOT_FOUND');
  }
}

async function authoriseCertificateFile(context: RequestContext, path: string) {
  if (!context.societyId || path.split('/')[0] !== context.societyId) {
    throw new AppError('FORBIDDEN');
  }
  let offset = 0;
  for (;;) {
    const page = await callModuleRpc(
      context,
      'tenancy_certificates_page',
      { p_society_id: context.societyId, p_limit: 100, p_offset: offset },
      certificatesPageSchema,
      'Could not verify access to this certificate.',
    );
    if (page.items.some((certificate) => certificate.path === path)) return;
    offset += page.items.length;
    if (page.items.length === 0 || offset >= page.total) break;
  }
  throw new AppError('NOT_FOUND');
}

export async function authoriseTransferDocumentView(
  context: RequestContext,
  inputPath: string,
) {
  authorizeRequest(context, {
    moduleKey: 'tenancy',
    permission: 'tenancy:list',
  });
  const path = parseModuleInput(
    z.union([clearanceUploadPathSchema, certificatePathSchema]),
    inputPath,
  );
  if (path.split('/')[1] === 'tenancy-clearance') {
    await authoriseClearanceFile(context, path);
  } else {
    await authoriseCertificateFile(context, path);
  }
}

export async function storePreparedTenancyCertificate(
  context: RequestContext,
  preparation: Extract<CertificatePreparation, { status: 'prepared' }>,
  handover: ClearanceHandoverDetail | null,
  responsibleName: string | null,
  approvingAdminName: string | null,
) {
  const bytes = await tenancyCertificatePdf(
    preparation,
    handover,
    responsibleName,
    approvingAdminName,
  );
  const bucket = context.db.storage.from('tenancy-files');
  const { error } = await bucket.upload(preparation.path, bytes, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (!error) return bytes;
  if (
    !z
      .object({ statusCode: z.union([z.literal('409'), z.literal(409)]) })
      .safeParse(error).success
  ) {
    throw new Error(
      'Could not store the prepared certificate PDF. Retry the issue operation.',
      { cause: error },
    );
  }
  const { data, error: downloadError } = await bucket.download(
    preparation.path,
  );
  if (downloadError || !data) {
    throw new Error(
      'Could not verify the stored certificate from a prior attempt.',
      {
        cause: downloadError,
      },
    );
  }
  if (!Buffer.from(await data.arrayBuffer()).equals(bytes)) {
    throw new ConflictError(
      'invalid_state',
      'The stored certificate does not match this issue attempt. Wait ten minutes, refresh and prepare a new certificate.',
    );
  }
  return bytes;
}
