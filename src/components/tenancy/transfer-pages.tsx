// Load transfer cases through the module boundary with role-specific privacy projections.
import 'server-only';
import { z } from 'zod';
import { AppError } from '../../core/errors';
import { getTenancyWorkspace } from '../../core/tenancy/moves/operations';
import {
  checkClearanceDues,
  getClearanceAcknowledgement,
  getTransferCase,
  listTransferCases,
  listTenancyCertificates,
} from '../../core/tenancy/transfers/operations';
import { transferStageSchema } from '../../core/tenancy/transfers/validation';
import { TenancyAdminTabs, TransferWorkspaceView } from './transfer-workspace';
import { TenancyRouteState } from './workspace';
import { TransferCaseView } from './transfer-detail';
import { getUnitHandoverWorkspace } from '../../core/structure/handover-operations';

type SearchParams = Record<string, string | string[] | undefined>;

function failure(error: unknown, retryHref: string) {
  if (!(error instanceof AppError)) throw error;
  return (
    <TenancyRouteState
      kind={
        error.code === 'MODULE_DISABLED'
          ? 'disabled'
          : error.code === 'FORBIDDEN' || error.code === 'UNAUTHENTICATED'
            ? 'denied'
            : error.code === 'NOT_FOUND'
              ? 'not_found'
              : 'error'
      }
      message={error.message}
      referenceId={error.referenceId}
      retryHref={retryHref}
      returnHref="/"
    />
  );
}

const searchSchema = z
  .object({
    transferId: z.uuid().optional(),
    stage: transferStageSchema.optional(),
    limit: z.coerce
      .number()
      .pipe(
        z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]),
      )
      .default(25),
    offset: z.coerce.number().int().nonnegative().default(0),
  })
  .strip();

export async function TenancyTransferIndexPage({
  searchParams,
  resident = false,
}: {
  searchParams: Promise<SearchParams>;
  resident?: boolean;
}) {
  let content;
  try {
    const parsed = searchSchema.parse(await searchParams);
    const [access, page, certificates] = await Promise.all([
      getTenancyWorkspace(false),
      listTransferCases({
        stage: parsed.stage ?? null,
        limit: parsed.limit,
        offset: parsed.offset,
      }),
      listTenancyCertificates({ limit: 100, offset: 0 }),
    ]);
    const workspace =
      !resident && access.can_manage && access.can_write
        ? await getTenancyWorkspace(true)
        : access;
    const detail =
      resident && parsed.transferId
        ? await getTransferCase(parsed.transferId)
        : null;
    const dues =
      detail && !resident
        ? await checkClearanceDues({ moveId: null, caseId: detail.case.id })
        : null;
    content = {
      acknowledgement: access.can_manage
        ? await getClearanceAcknowledgement()
        : null,
      certificates: certificates.items,
      detail,
      dues,
      mode: resident
        ? ('own' as const)
        : access.can_manage
          ? ('admin' as const)
          : ('committee' as const),
      page,
      stage: parsed.stage ?? null,
      workspace,
      unitHandovers:
        detail === null
          ? undefined
          : await getUnitHandoverWorkspace(detail.case.unit_id),
    };
  } catch (error) {
    return failure(
      error,
      resident ? '/tenancy' : '/admin/tenancy?tab=transfers',
    );
  }
  return <TransferWorkspaceView {...content} />;
}

export async function TenancyTransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) {
    return (
      <TenancyRouteState
        kind="not_found"
        returnHref="/admin/tenancy?tab=transfers"
      />
    );
  }
  let content: {
    mode: 'committee' | 'admin';
    detail: Awaited<ReturnType<typeof getTransferCase>>;
    dues: Awaited<ReturnType<typeof checkClearanceDues>> | null;
    workspace: Awaited<ReturnType<typeof getTenancyWorkspace>>;
    unitHandovers: Awaited<ReturnType<typeof getUnitHandoverWorkspace>>;
  };
  try {
    const workspace = await getTenancyWorkspace(false);
    if (!workspace.can_manage) {
      const detail = await getTransferCase(id.data);
      content = {
        detail,
        dues: null,
        mode: 'committee',
        workspace,
        unitHandovers: await getUnitHandoverWorkspace(detail.case.unit_id),
      };
    } else {
      const [detail, dues, fullWorkspace] = await Promise.all([
        getTransferCase(id.data),
        checkClearanceDues({ moveId: null, caseId: id.data }),
        getTenancyWorkspace(workspace.can_write),
      ]);
      content = {
        detail,
        dues,
        mode: 'admin',
        workspace: fullWorkspace,
        unitHandovers: await getUnitHandoverWorkspace(detail.case.unit_id),
      };
    }
  } catch (error) {
    return failure(error, `/admin/tenancy/transfers/${id.data}`);
  }
  return (
    <>
      <TenancyAdminTabs selected="transfers" />
      <TransferCaseView
        baseHref="/admin/tenancy?tab=transfers"
        detail={content.detail}
        dues={content.dues}
        mode={content.mode}
        workspace={content.workspace}
        unitHandovers={content.unitHandovers}
      />
    </>
  );
}
