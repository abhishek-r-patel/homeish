// Load document screens through authorised operations and map failures to safe route states.
import 'server-only';
import { AppError } from '../../core/errors';
import {
  getDocument,
  getDocumentWorkspace,
  getGovernanceRecord,
  listGovernanceHistory,
  listGovernanceRecords,
  listGovernanceSources,
  listDocuments,
  listPublishedHouseRules,
} from '../../core/document/operations';
import { documentSearchSchema } from '../../core/document/validation';
import {
  DOCUMENT_PAGE_SIZE,
  DocumentRouteState,
  DocumentWorkspaceView,
  documentHref,
  type DocumentMode,
} from './workspace';
import type { GovernanceSelection } from './governance';
import type { DocumentGovernanceSourceKind } from '@/core/document/validation';
import { getOfficialCaseWorkspace } from '@/core/document/official-cases';

export type DocumentPageSearch = Record<string, string | string[] | undefined>;
export const DOCUMENT_PAGE_METADATA = {
  title: 'Documents | Homeish',
  robots: { index: false, follow: false },
};

function pageFailure(error: unknown, retryHref: string) {
  if (!(error instanceof AppError) || error.code === 'INTERNAL_ERROR')
    throw error;
  const kind =
    error.code === 'MODULE_DISABLED'
      ? 'disabled'
      : error.code === 'FORBIDDEN' || error.code === 'UNAUTHENTICATED'
        ? 'denied'
        : error.code === 'NOT_FOUND'
          ? 'not_found'
          : 'error';
  return (
    <DocumentRouteState
      kind={kind}
      returnHref="/"
      retryHref={
        kind === 'error' || kind === 'not_found' ? retryHref : undefined
      }
      message={kind === 'error' ? error.message : undefined}
      referenceId={error.referenceId}
    />
  );
}

export async function DocumentIndexPage({
  mode,
  baseHref,
  searchParams,
}: {
  mode: DocumentMode;
  baseHref: string;
  searchParams: Promise<DocumentPageSearch>;
}) {
  const search = documentSearchSchema.parse(await searchParams);
  const management = mode === 'management';
  const selection = {
    folder: search.folder,
    unit: search.folder ? undefined : search.unit,
    document: management ? search.document : undefined,
    archived: management && search.archived,
    offset: search.offset,
  };
  let props;
  try {
    const workspace = await getDocumentWorkspace();
    if (management && !workspace.is_staff) throw new AppError('FORBIDDEN');
    const target = selection.folder ?? selection.unit;
    const [
      list,
      detail,
      governanceRecords,
      governanceDetail,
      publishedRules,
      officialCases,
    ] = await Promise.all([
      target
        ? listDocuments({
            folderId: selection.folder ?? null,
            unitId: selection.unit ?? null,
            includeArchived: selection.archived,
            limit: DOCUMENT_PAGE_SIZE,
            offset: selection.offset,
          })
        : null,
      selection.document ? getDocument(selection.document) : null,
      management
        ? listGovernanceRecords({
            kind: null,
            includeArchived: search.governanceArchived,
            limit: DOCUMENT_PAGE_SIZE,
            offset: search.governanceOffset,
          })
        : null,
      management && workspace.can_manage && search.governanceRecord
        ? getGovernanceRecord(search.governanceRecord)
        : null,
      !management ? listPublishedHouseRules() : null,
      management && workspace.can_manage ? getOfficialCaseWorkspace() : null,
    ]);
    let governance = null;
    if (management && governanceRecords) {
      const kind = governanceDetail?.kind ?? search.governanceKind;
      const requestedSourceKind: DocumentGovernanceSourceKind =
        kind === 'house_rule'
          ? 'document_version'
          : (governanceDetail?.source.kind ?? search.governanceSourceKind);
      const sourceAvailable =
        (requestedSourceKind !== 'tenancy_noc' ||
          governanceRecords.tenancyEnabled) &&
        (requestedSourceKind !== 'meeting_resolution' ||
          governanceRecords.meetingEnabled);
      const [sources, decisionSources, history] = workspace.can_manage
        ? await Promise.all([
            sourceAvailable
              ? listGovernanceSources({
                  kind,
                  sourceKind: requestedSourceKind,
                  limit: DOCUMENT_PAGE_SIZE,
                  offset: search.governanceSourceOffset,
                })
              : Promise.resolve({ total: 0, items: [] }),
            kind === 'house_rule' && governanceRecords.meetingEnabled
              ? listGovernanceSources({
                  kind,
                  sourceKind: 'meeting_resolution',
                  limit: 100,
                  offset: 0,
                }).then((result) => result.items)
              : Promise.resolve([]),
            governanceDetail
              ? listGovernanceHistory({
                  recordId: governanceDetail.id,
                  limit: 25,
                  offset: 0,
                })
              : Promise.resolve(null),
          ])
        : [{ total: 0, items: [] }, [], null];
      const governanceSelection: GovernanceSelection = {
        kind,
        sourceKind: requestedSourceKind,
        sourceOffset: search.governanceSourceOffset,
        recordId: governanceDetail?.id,
        archived: search.governanceArchived,
        offset: search.governanceOffset,
      };
      governance = {
        records: governanceRecords,
        detail: governanceDetail,
        history,
        sources,
        decisionSources,
        selection: governanceSelection,
        settings: governanceRecords.settings,
        canEditSettings: governanceRecords.canEditSettings,
        tenancyEnabled: governanceRecords.tenancyEnabled,
        meetingEnabled: governanceRecords.meetingEnabled,
      };
    }
    props = {
      workspace,
      list,
      detail,
      governance,
      publishedRules,
      officialCases,
    };
  } catch (error) {
    return pageFailure(error, documentHref(baseHref, {}));
  }
  return (
    <DocumentWorkspaceView
      {...props}
      selection={selection}
      mode={mode}
      baseHref={baseHref}
      governance={props.governance ?? undefined}
      publishedRules={props.publishedRules?.items ?? []}
    />
  );
}
