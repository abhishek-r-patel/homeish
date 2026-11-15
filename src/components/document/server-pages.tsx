// Load document screens through authorised operations and map failures to safe route states.
import 'server-only';
import { AppError } from '../../core/errors';
import {
  getDocument,
  getDocumentWorkspace,
  listDocuments,
} from '../../core/document/operations';
import { documentSearchSchema } from '../../core/document/validation';
import {
  DOCUMENT_PAGE_SIZE,
  DocumentRouteState,
  DocumentWorkspaceView,
  documentHref,
  type DocumentMode,
} from './workspace';

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
    const [list, detail] = await Promise.all([
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
    ]);
    props = { workspace, list, detail };
  } catch (error) {
    return pageFailure(error, documentHref(baseHref, {}));
  }
  return (
    <DocumentWorkspaceView
      {...props}
      selection={selection}
      mode={mode}
      baseHref={baseHref}
    />
  );
}
