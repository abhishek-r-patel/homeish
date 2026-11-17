// Present society folders, unit documents, tenancy NOCs and admin history in one document workspace.
'use client';
import { ModuleDisabledPage } from '@/core/modules/module-disabled-page';
import {
  DOCUMENT_FOLDER_AUDIENCE_HELP,
  DOCUMENT_FOLDER_AUDIENCE_LABELS,
  DOCUMENT_UNIT_AUDIENCE_LABELS,
  documentFileKind,
  documentUnitLabel,
  formatDocumentFileSize,
} from '@/core/document/presentation';
import type {
  DocumentDetail,
  DocumentItem,
  DocumentList,
  DocumentWorkspace,
} from '@/core/document/validation';
import { TenancyDocumentLink } from '@/components/tenancy/documents';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { SelectInput } from '@/components/ui/select-input';
import {
  Banner,
  EmptyState,
  ErrorPanel,
  Skeleton,
} from '@/components/ui/feedback';
import {
  DocumentArchiveForm,
  DocumentDetailsForm,
  DocumentFolderArchiveForm,
  DocumentFolderForm,
  DocumentPublishForm,
  DocumentVersionArchiveForm,
  DocumentVersionForm,
} from './admin';
import {
  DEFAULT_DOCUMENT_ACTIONS,
  DocumentDownloadButton,
  type DocumentActions,
} from './files';
import { useDocumentPresentation } from './presentation';

export type DocumentMode = 'resident' | 'management';
export type DocumentRouteStateKind =
  'loading' | 'disabled' | 'denied' | 'not_found' | 'error';
export type DocumentSelection = {
  folder?: string;
  unit?: string;
  document?: string;
  archived: boolean;
  offset: number;
};

export const DOCUMENT_PAGE_SIZE = 25;
const linkClass =
  'inline-flex min-h-12 items-center text-brand underline focus-visible:outline-2 focus-visible:outline-focus';

export function documentHref(
  baseHref: string,
  selection: Partial<DocumentSelection>,
): string {
  const params = new URLSearchParams();
  if (selection.folder) params.set('folder', selection.folder);
  if (selection.unit) params.set('unit', selection.unit);
  if (selection.document) params.set('document', selection.document);
  if (selection.archived) params.set('archived', '1');
  if (selection.offset) params.set('offset', String(selection.offset));
  const query = params.toString();
  return query ? `${baseHref}?${query}` : baseHref;
}

export function DocumentRouteState({
  kind,
  returnHref = '/',
  retryHref,
  referenceId,
  message,
}: {
  kind: DocumentRouteStateKind;
  returnHref?: string;
  retryHref?: string;
  referenceId?: string;
  message?: string;
}) {
  const { t, translateFeedback } = useDocumentPresentation();
  if (kind === 'disabled') {
    return (
      <ModuleDisabledPage
        embedded
        moduleKey="document"
        returnHref={returnHref}
      />
    );
  }
  const copy = {
    loading: { title: 'Loading documents', message: 'Loading folders.' },
    denied: {
      title: 'Document access is restricted',
      message:
        'You do not have access to this view. Return to your workspace or ask an administrator to review your access.',
    },
    not_found: {
      title: 'Document unavailable',
      message:
        'This folder, unit or document is unavailable or you no longer have permission to view it.',
    },
    error: {
      title: 'Could not load documents',
      message: 'Nothing was changed. Retry to load the current documents.',
    },
  }[kind];
  return (
    <section className="grid min-w-0 gap-space-4">
      <h1 className="text-title font-semibold">{t('Documents')}</h1>
      {kind === 'loading' ? (
        <Skeleton label={t(copy.title)} rows={5} />
      ) : (
        <ErrorPanel
          title={t(copy.title)}
          message={message ? translateFeedback(message) : t(copy.message)}
          referenceId={referenceId}
          action={
            <div className="flex flex-wrap gap-space-3">
              {retryHref ? (
                <a href={retryHref} className={linkClass}>
                  {t('Retry')}
                </a>
              ) : null}
              <a href={returnHref} className={linkClass}>
                {t('Back to workspace')}
              </a>
            </div>
          }
        />
      )}
    </section>
  );
}

function DocumentMeta({ document }: { document: DocumentItem }) {
  const { t, date } = useDocumentPresentation();
  const current = document.current_version;
  return (
    <p className="text-caption text-ink-muted">
      {current
        ? t('{kind} · {size} · Version {number} · Updated {date}', {
            kind: t(documentFileKind(current.content_type)),
            size: formatDocumentFileSize(current.size_bytes),
            number: current.version_number,
            date: date(current.created_at),
          })
        : t('No active file')}
      {document.unit_audience
        ? ` · ${t(DOCUMENT_UNIT_AUDIENCE_LABELS[document.unit_audience])}`
        : ''}
      {document.archived_at ? t(' · Archived') : ''}
    </p>
  );
}

function DocumentRow({
  document,
  mode,
  baseHref,
  selection,
  actions,
}: {
  document: DocumentItem;
  mode: DocumentMode;
  baseHref: string;
  selection: DocumentSelection;
  actions: DocumentActions;
}) {
  const { t } = useDocumentPresentation();
  return (
    <li className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4">
      <h3 className="text-body-strong break-words">{document.title}</h3>
      {document.description ? (
        <p className="text-body break-words">{document.description}</p>
      ) : null}
      <DocumentMeta document={document} />
      <div className="flex flex-wrap items-start gap-space-3">
        {document.current_version ? (
          <DocumentDownloadButton
            versionId={document.current_version.id}
            label={document.title}
            download={actions.download}
          />
        ) : null}
        {mode === 'management' ? (
          <a
            href={documentHref(baseHref, {
              ...selection,
              document: document.id,
            })}
            className={linkClass}
          >
            {t('Versions and details: {title}', { title: document.title })}
          </a>
        ) : null}
      </div>
    </li>
  );
}

function DocumentDetailPanel({
  detail,
  workspace,
  baseHref,
  selection,
  actions,
  request,
}: {
  detail: DocumentDetail;
  workspace: DocumentWorkspace;
  baseHref: string;
  selection: DocumentSelection;
  actions: DocumentActions;
  request?: typeof fetch;
}) {
  const { t, date } = useDocumentPresentation();
  const { document, versions } = detail;
  const canEdit = workspace.can_manage && workspace.writable;
  const activeVersions = versions.filter((version) => !version.archived_at);
  return (
    <Card
      title={t('Version history: {title}', { title: document.title })}
      description={t(
        'Every version is kept. Residents see only the latest active version.',
      )}
    >
      <div className="grid gap-space-4">
        <ol className="grid gap-space-3">
          {versions.map((version) => (
            <li
              key={version.id}
              className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-4"
            >
              <p className="text-body-strong">
                {t('Version {number}', { number: version.version_number })}
                {version.id === document.current_version?.id
                  ? t(' (current)')
                  : ''}
                {version.archived_at ? t(' (archived)') : ''}
              </p>
              <p className="text-caption text-ink-muted break-words">
                {version.file_name} ·{' '}
                {t(documentFileKind(version.content_type))} ·{' '}
                {formatDocumentFileSize(version.size_bytes)} ·{' '}
                {t('Uploaded {date}', { date: date(version.created_at) })}
              </p>
              {version.note ? (
                <p className="text-body break-words">{version.note}</p>
              ) : null}
              <div className="flex flex-wrap items-start gap-space-3">
                <DocumentDownloadButton
                  versionId={version.id}
                  label={t('version {number}', {
                    number: version.version_number,
                  })}
                  download={actions.download}
                />
                {canEdit &&
                (version.archived_at || activeVersions.length > 1) ? (
                  <DocumentVersionArchiveForm
                    document={document}
                    version={version}
                    action={actions.setVersionArchived}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        {canEdit ? (
          <>
            <h3 className="text-subheading">{t('Publish a new version')}</h3>
            <DocumentVersionForm
              document={document}
              actions={actions}
              request={request}
            />
            <h3 className="text-subheading">{t('Edit details')}</h3>
            <DocumentDetailsForm document={document} action={actions.update} />
            <DocumentArchiveForm
              document={document}
              action={actions.setArchived}
            />
          </>
        ) : null}
        <a
          href={documentHref(baseHref, { ...selection, document: undefined })}
          className={linkClass}
        >
          {t('Close version history')}
        </a>
      </div>
    </Card>
  );
}

export function DocumentWorkspaceView({
  workspace,
  list,
  detail,
  selection,
  mode,
  baseHref,
  actions = DEFAULT_DOCUMENT_ACTIONS,
  request,
}: {
  workspace: DocumentWorkspace;
  list: DocumentList | null;
  detail: DocumentDetail | null;
  selection: DocumentSelection;
  mode: DocumentMode;
  baseHref: string;
  actions?: DocumentActions;
  request?: typeof fetch;
}) {
  const { t, date } = useDocumentPresentation();
  const management = mode === 'management';
  const canEdit = management && workspace.can_manage && workspace.writable;
  const folders = management
    ? workspace.folders
    : workspace.folders.filter((folder) => !folder.archived_at);
  const nextOffset = selection.offset + DOCUMENT_PAGE_SIZE;
  const previousOffset = Math.max(0, selection.offset - DOCUMENT_PAGE_SIZE);
  return (
    <section className="grid min-w-0 gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Documents')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            management
              ? 'Society folders and unit documents. Every download is recorded.'
              : 'Society documents and documents issued to your unit. Links are private and expire after five minutes.',
          )}
        </p>
      </header>
      {management && !workspace.can_manage ? (
        <Banner title={t('Read-only view')}>
          {t(
            'Committee members can view every document. Only administrators can publish, edit or archive.',
          )}
        </Banner>
      ) : null}
      {management && workspace.can_manage && !workspace.writable ? (
        <Banner title={t('Changes are paused')} tone="warning">
          {t('This society is read-only. Documents can still be viewed.')}
        </Banner>
      ) : null}
      <div className="grid min-w-0 gap-space-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <nav
          aria-label={t('Document folders')}
          className="grid content-start gap-space-4"
        >
          <div className="grid gap-space-2">
            <h2 className="text-subheading">{t('Society folders')}</h2>
            {folders.length === 0 ? (
              <p className="text-body text-ink-muted">
                {t('No folders to show.')}
              </p>
            ) : (
              <ul className="grid gap-space-1">
                {folders.map((folder) => (
                  <li key={folder.id}>
                    <a
                      href={documentHref(baseHref, { folder: folder.id })}
                      aria-current={
                        selection.folder === folder.id ? 'page' : undefined
                      }
                      className={`${linkClass} break-words`}
                    >
                      {folder.name} ({folder.document_count})
                      {folder.archived_at ? t(' · archived') : ''}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-space-2">
            <h2 className="text-subheading">
              {t(management ? 'Unit documents' : 'My unit')}
            </h2>
            {workspace.units.length === 0 ? (
              <p className="text-body text-ink-muted">
                {t(
                  management
                    ? 'No active units.'
                    : 'You are not linked to a unit.',
                )}
              </p>
            ) : workspace.units.length <= 12 ? (
              <ul className="grid gap-space-1">
                {workspace.units.map((unit) => (
                  <li key={unit.id}>
                    <a
                      href={documentHref(baseHref, { unit: unit.id })}
                      aria-current={
                        selection.unit === unit.id ? 'page' : undefined
                      }
                      className={linkClass}
                    >
                      {documentUnitLabel(unit)}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <form method="get" action={baseHref} className="grid gap-space-2">
                <SelectInput
                  id="document-unit-picker"
                  name="unit"
                  label={t('Unit')}
                  defaultValue={selection.unit ?? ''}
                  placeholder={t('Choose a unit')}
                  options={workspace.units.map((unit) => ({
                    value: unit.id,
                    label: documentUnitLabel(unit),
                  }))}
                />
                <Button type="submit" variant="secondary">
                  {t('Show unit documents')}
                </Button>
              </form>
            )}
          </div>
        </nav>
        <div className="grid min-w-0 content-start gap-space-5">
          {detail ? (
            <DocumentDetailPanel
              detail={detail}
              workspace={workspace}
              baseHref={baseHref}
              selection={selection}
              actions={actions}
              request={request}
            />
          ) : null}
          {list ? (
            <section
              aria-labelledby="document-list-title"
              className="grid gap-space-3"
            >
              <h2 id="document-list-title" className="text-heading break-words">
                {list.folder
                  ? list.folder.name
                  : list.unit
                    ? t('Unit {unit}', { unit: documentUnitLabel(list.unit) })
                    : t('Documents')}
              </h2>
              {list.folder ? (
                <p className="text-caption text-ink-muted">
                  {t(DOCUMENT_FOLDER_AUDIENCE_LABELS[list.folder.audience])}:{' '}
                  {t(DOCUMENT_FOLDER_AUDIENCE_HELP[list.folder.audience])}
                </p>
              ) : null}
              {management ? (
                <a
                  href={documentHref(baseHref, {
                    folder: selection.folder,
                    unit: selection.unit,
                    archived: !selection.archived,
                  })}
                  className={linkClass}
                >
                  {t(
                    selection.archived
                      ? 'Hide archived documents'
                      : 'Show archived documents',
                  )}
                </a>
              ) : null}
              {list.items.length === 0 ? (
                <EmptyState
                  title={t('No documents yet')}
                  description={t(
                    canEdit
                      ? 'Publish a document below to share it with this audience.'
                      : 'Documents shared here will appear in this list.',
                  )}
                />
              ) : (
                <ul className="grid gap-space-3">
                  {list.items.map((document) => (
                    <DocumentRow
                      key={document.id}
                      document={document}
                      mode={mode}
                      baseHref={baseHref}
                      selection={selection}
                      actions={actions}
                    />
                  ))}
                </ul>
              )}
              {list.total > DOCUMENT_PAGE_SIZE ? (
                <nav
                  aria-label={t('Document pages')}
                  className="flex flex-wrap gap-space-4"
                >
                  {selection.offset > 0 ? (
                    <a
                      href={documentHref(baseHref, {
                        ...selection,
                        document: undefined,
                        offset: previousOffset,
                      })}
                      className={linkClass}
                    >
                      {t('Previous page')}
                    </a>
                  ) : null}
                  {nextOffset < list.total ? (
                    <a
                      href={documentHref(baseHref, {
                        ...selection,
                        document: undefined,
                        offset: nextOffset,
                      })}
                      className={linkClass}
                    >
                      {t('Next page')}
                    </a>
                  ) : null}
                </nav>
              ) : null}
              {list.unit && list.tenancy_nocs.length > 0 ? (
                <section
                  aria-labelledby="document-noc-title"
                  className="grid gap-space-3"
                >
                  <h3 id="document-noc-title" className="text-subheading">
                    {t('Move-out NOCs')}
                  </h3>
                  <p className="text-caption text-ink-muted">
                    {t('Issued through Move-in / Move-out. Read-only here.')}
                  </p>
                  <ul className="grid gap-space-3">
                    {list.tenancy_nocs.map((noc) => (
                      <li
                        key={noc.id}
                        className="grid gap-space-2 rounded-md border border-rule p-space-4"
                      >
                        <p className="text-caption text-ink-muted">
                          {t('Issued {date}', { date: date(noc.created_at) })} ·{' '}
                          {formatDocumentFileSize(noc.size_bytes)}
                        </p>
                        <TenancyDocumentLink
                          path={noc.path}
                          label={t('move-out NOC of {date}', {
                            date: date(noc.created_at),
                          })}
                          request={request}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </section>
          ) : (
            <EmptyState
              title={t('Choose a folder or unit')}
              description={t(
                'Pick a society folder or a unit to see its documents.',
              )}
            />
          )}
          {canEdit ? (
            <Card
              title={t('Publish a document')}
              description={t(
                'Residents in the audience are notified when you publish.',
              )}
            >
              <DocumentPublishForm
                key={`${selection.folder ?? ''}${selection.unit ?? ''}`}
                workspace={workspace}
                folderId={selection.folder ?? null}
                unitId={selection.unit ?? null}
                actions={actions}
                request={request}
              />
            </Card>
          ) : null}
          {canEdit ? (
            <Card
              title={t('Manage folders')}
              description={t(
                "Folders are archived, never deleted. Documents follow their folder's audience.",
              )}
            >
              <div className="grid gap-space-5">
                <DocumentFolderForm folder={null} action={actions.saveFolder} />
                {workspace.folders.map((folder) => (
                  <section
                    key={`${folder.id}-${folder.version}`}
                    aria-label={t('Folder {name}', { name: folder.name })}
                    className="grid gap-space-3 rounded-md border border-rule p-space-4"
                  >
                    <h3 className="text-body-strong break-words">
                      {folder.name}
                      {folder.archived_at ? t(' (archived)') : ''}
                    </h3>
                    {folder.archived_at ? null : (
                      <DocumentFolderForm
                        folder={folder}
                        action={actions.saveFolder}
                      />
                    )}
                    <DocumentFolderArchiveForm
                      folder={folder}
                      action={actions.setFolderArchived}
                    />
                  </section>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
      <p className="text-caption text-ink-muted">
        {t(
          'NOCs and other generated documents remain in English. Document titles and content are shown as uploaded.',
        )}
      </p>
    </section>
  );
}
