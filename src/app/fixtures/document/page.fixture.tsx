// Exercise document screens with synthetic folders, versions and injected actions; never call hosted data.
'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { publicEnvironment } from '@/core/config/public-env';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  documentArchiveInputSchema,
  documentCreateInputSchema,
  documentFolderArchiveInputSchema,
  documentFolderInputSchema,
  documentSearchSchema,
  documentUpdateInputSchema,
  documentUploadInputSchema,
  documentVersionArchiveInputSchema,
  documentVersionInputSchema,
  type DocumentFolder,
  type DocumentItem,
  type DocumentList,
  type DocumentVersion,
  type DocumentWorkspace,
} from '@/core/document/validation';
import { documentUploadPath } from '@/core/document/presentation';
import type { DocumentActions } from '@/components/document/files';
import {
  DocumentRouteState,
  DocumentWorkspaceView,
  type DocumentRouteStateKind,
} from '@/components/document/workspace';
import { Banner } from '@/components/ui/feedback';
import { SelectInput } from '@/components/ui/select-input';

const SOCIETY_ID = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const UNIT_ID = 'd0d55fc3-0751-4b79-86c1-5b3e25942392';
const MOVE_ID = 'a0d55fc3-0751-4b79-86c1-5b3e25942392';
const CREATED_AT = '2026-11-15T10:00:00Z';
const STORAGE_BASE = publicEnvironment.NEXT_PUBLIC_SUPABASE_URL.replace(
  /\/$/,
  '',
);
const BASE_HREF = '/fixtures/document';
type View = 'admin' | 'committee' | 'resident';
type State = 'ready' | DocumentRouteStateKind;

function folder(
  id: string,
  name: string,
  audience: DocumentFolder['audience'],
  systemKey: DocumentFolder['system_key'],
  sortOrder: number,
): DocumentFolder {
  return {
    id,
    name,
    audience,
    system_key: systemKey,
    sort_order: sortOrder,
    version: 1,
    archived_at: null,
    updated_at: CREATED_AT,
    document_count: 0,
  };
}

const INITIAL_FOLDERS: DocumentFolder[] = [
  folder(
    '10d55fc3-0751-4b79-86c1-5b3e25942392',
    'Bylaws',
    'all_residents',
    'bylaws',
    10,
  ),
  folder(
    '20d55fc3-0751-4b79-86c1-5b3e25942392',
    'Minutes',
    'all_residents',
    'minutes',
    20,
  ),
  folder(
    '30d55fc3-0751-4b79-86c1-5b3e25942392',
    'Audit reports',
    'owners_only',
    'audit_reports',
    30,
  ),
  folder(
    '40d55fc3-0751-4b79-86c1-5b3e25942392',
    'Circulars',
    'all_residents',
    'circulars',
    40,
  ),
  folder(
    '50d55fc3-0751-4b79-86c1-5b3e25942392',
    'NOCs',
    'committee_admins',
    'nocs',
    50,
  ),
];

function version(
  id: string,
  number: number,
  note: string | null,
): DocumentVersion {
  return {
    id,
    version_number: number,
    file_name: `bylaws-v${number}.pdf`,
    content_type: 'application/pdf',
    size_bytes: 482_000 + number * 1000,
    note,
    archived_at: null,
    created_at: CREATED_AT,
  };
}

const INITIAL_VERSIONS: Record<string, DocumentVersion[]> = {
  'e1d55fc3-0751-4b79-86c1-5b3e25942392': [
    version('f1d55fc3-0751-4b79-86c1-5b3e25942392', 1, null),
    version(
      'f2d55fc3-0751-4b79-86c1-5b3e25942392',
      2,
      'Amended parking clause.',
    ),
  ],
  'e2d55fc3-0751-4b79-86c1-5b3e25942392': [
    version('f3d55fc3-0751-4b79-86c1-5b3e25942392', 1, null),
  ],
};

const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'e1d55fc3-0751-4b79-86c1-5b3e25942392',
    folder_id: INITIAL_FOLDERS[0]!.id,
    unit_id: null,
    unit_audience: null,
    title: 'Society bylaws 2026',
    description: 'Registered bylaws with the 2026 amendments.',
    version: 2,
    archived_at: null,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    unit: null,
    current_version: null,
    version_count: 2,
  },
  {
    id: 'e2d55fc3-0751-4b79-86c1-5b3e25942392',
    folder_id: null,
    unit_id: UNIT_ID,
    unit_audience: 'owners_only',
    title: 'Share certificate',
    description: null,
    version: 1,
    archived_at: null,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    unit: { id: UNIT_ID, number: '402', block_name: 'Tower A' },
    current_version: null,
    version_count: 1,
  },
];

function currentVersion(versions: DocumentVersion[]) {
  return (
    [...versions]
      .filter((item) => !item.archived_at)
      .sort((a, b) => b.version_number - a.version_number)[0] ?? null
  );
}

function input(form: FormData): unknown {
  const raw = form.get('input');
  if (typeof raw !== 'string') throw new Error('Missing fixture input.');
  return JSON.parse(raw);
}

function failure(message: string): ServerActionResult<never> {
  return { ok: false, code: 'VALIDATION_FAILED', message };
}

const requestFiles: typeof fetch = async (resource, options) => {
  const url = new URL(
    resource instanceof Request ? resource.url : String(resource),
    window.location.origin,
  );
  if (url.pathname === '/api/files/url' && typeof options?.body === 'string') {
    const { path } = JSON.parse(options.body) as { path: string };
    return Response.json({
      ok: true,
      data: {
        signedUrl: `${STORAGE_BASE}/storage/v1/object/sign/tenancy-files/${path}?token=fixture`,
        expiresIn: 300,
      },
    });
  }
  return new Response(null, { status: 200 });
};

function DocumentFixture() {
  const search = documentSearchSchema.parse(
    Object.fromEntries(useSearchParams().entries()),
  );
  const [view, setView] = useState<View>('admin');
  const [state, setState] = useState<State>('ready');
  const [folders, setFolders] = useState(INITIAL_FOLDERS);
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [versions, setVersions] = useState(INITIAL_VERSIONS);

  const items = documents.map((document) => ({
    ...document,
    current_version: currentVersion(versions[document.id] ?? []),
    version_count:
      view === 'resident' ? null : (versions[document.id] ?? []).length,
  }));
  const visibleFolders = folders
    .filter(
      (item) => view !== 'resident' || item.audience !== 'committee_admins',
    )
    .map((item) => ({
      ...item,
      document_count: items.filter(
        (document) => document.folder_id === item.id && !document.archived_at,
      ).length,
    }));
  const workspace: DocumentWorkspace = {
    can_manage: view === 'admin',
    is_staff: view !== 'resident',
    writable: true,
    tenancy_enabled: true,
    folders: visibleFolders,
    units: [
      {
        id: UNIT_ID,
        number: '402',
        block_name: 'Tower A',
        relationship: view === 'resident' ? 'owner' : null,
      },
    ],
  };
  const management = view !== 'resident';
  const folderSelected =
    search.folder ?? (search.unit ? undefined : visibleFolders[0]?.id);
  const selection = {
    folder: folderSelected,
    unit: folderSelected ? undefined : search.unit,
    document: management ? search.document : undefined,
    archived: management && search.archived,
    offset: 0,
  };
  const listItems = items.filter(
    (document) =>
      (selection.folder
        ? document.folder_id === selection.folder
        : document.unit_id === selection.unit) &&
      (selection.archived || !document.archived_at),
  );
  const list: DocumentList = {
    folder: visibleFolders.find((item) => item.id === selection.folder) ?? null,
    unit: selection.unit
      ? { id: UNIT_ID, number: '402', block_name: 'Tower A' }
      : null,
    total: listItems.length,
    items: listItems,
    tenancy_nocs: selection.unit
      ? [
          {
            id: 'b1d55fc3-0751-4b79-86c1-5b3e25942392',
            move_id: MOVE_ID,
            path: `${SOCIETY_ID}/moves/${MOVE_ID}/noc/b1d55fc3-0751-4b79-86c1-5b3e25942392.pdf`,
            content_type: 'application/pdf',
            size_bytes: 64_000,
            created_at: CREATED_AT,
          },
        ]
      : [],
  };
  const detailDocument = items.find((item) => item.id === selection.document);
  const detail = detailDocument
    ? {
        document: detailDocument,
        folder:
          visibleFolders.find((item) => item.id === detailDocument.folder_id) ??
          null,
        versions: [...(versions[detailDocument.id] ?? [])].sort(
          (a, b) => b.version_number - a.version_number,
        ),
      }
    : null;

  const actions: DocumentActions = {
    download: async () => ({
      ok: true,
      data: {
        signedUrl: `${STORAGE_BASE}/storage/v1/object/sign/document-files/${SOCIETY_ID}/documents/${crypto.randomUUID()}.pdf?token=fixture`,
        expiresIn: 300,
        fileName: 'fixture.pdf',
      },
    }),
    prepareUpload: async (form) => {
      const parsed = documentUploadInputSchema.safeParse(input(form));
      if (!parsed.success)
        return failure('Choose a PDF, JPG or PNG up to 5 MB.');
      const path = documentUploadPath(
        SOCIETY_ID,
        parsed.data.contentType,
        crypto.randomUUID(),
      );
      return {
        ok: true,
        data: {
          path,
          signedUrl: `${STORAGE_BASE}/storage/v1/object/upload/sign/document-files/${path}?token=fixture`,
        },
      };
    },
    saveFolder: async (form) => {
      const parsed = documentFolderInputSchema.safeParse(input(form));
      if (!parsed.success) return failure('Check the folder details.');
      const value = parsed.data;
      setFolders((current) =>
        value.folderId
          ? current.map((item) =>
              item.id === value.folderId
                ? {
                    ...item,
                    name: value.name,
                    audience: value.audience,
                    version: item.version + 1,
                  }
                : item,
            )
          : [
              ...current,
              {
                ...folder(
                  crypto.randomUUID(),
                  value.name,
                  value.audience,
                  null,
                  1000,
                ),
              },
            ],
      );
      return { ok: true, message: 'Folder saved.' };
    },
    setFolderArchived: async (form) => {
      const parsed = documentFolderArchiveInputSchema.safeParse(input(form));
      if (!parsed.success) return failure('Refresh the folder.');
      setFolders((current) =>
        current.map((item) =>
          item.id === parsed.data.folderId
            ? {
                ...item,
                archived_at: parsed.data.archived
                  ? new Date().toISOString()
                  : null,
                version: item.version + 1,
              }
            : item,
        ),
      );
      return {
        ok: true,
        message: parsed.data.archived ? 'Folder archived.' : 'Folder restored.',
      };
    },
    create: async (form) => {
      const parsed = documentCreateInputSchema.safeParse(input(form));
      if (!parsed.success)
        return failure(parsed.error.issues[0]?.message ?? 'Check the details.');
      const value = parsed.data;
      const id = crypto.randomUUID();
      setVersions((current) => ({
        ...current,
        [id]: [
          {
            ...version(crypto.randomUUID(), 1, null),
            file_name: value.fileName,
          },
        ],
      }));
      setDocuments((current) => [
        {
          id,
          folder_id: value.folderId,
          unit_id: value.unitId,
          unit_audience: value.unitAudience,
          title: value.title,
          description: value.description,
          version: 1,
          archived_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          unit: value.unitId
            ? { id: UNIT_ID, number: '402', block_name: 'Tower A' }
            : null,
          current_version: null,
          version_count: 1,
        },
        ...current,
      ]);
      return { ok: true, message: 'Document published.' };
    },
    addVersion: async (form) => {
      const parsed = documentVersionInputSchema.safeParse(input(form));
      if (!parsed.success) return failure('Upload the new version first.');
      const value = parsed.data;
      setVersions((current) => {
        const existing = current[value.documentId] ?? [];
        return {
          ...current,
          [value.documentId]: [
            ...existing,
            {
              ...version(crypto.randomUUID(), existing.length + 1, value.note),
              file_name: value.fileName,
            },
          ],
        };
      });
      setDocuments((current) =>
        current.map((item) =>
          item.id === value.documentId
            ? { ...item, version: item.version + 1 }
            : item,
        ),
      );
      return { ok: true, message: 'New version published.' };
    },
    update: async (form) => {
      const parsed = documentUpdateInputSchema.safeParse(input(form));
      if (!parsed.success) return failure('Check the details.');
      const value = parsed.data;
      setDocuments((current) =>
        current.map((item) =>
          item.id === value.documentId
            ? {
                ...item,
                title: value.title,
                description: value.description,
                unit_audience: item.unit_id ? value.unitAudience : null,
                version: item.version + 1,
              }
            : item,
        ),
      );
      return { ok: true, message: 'Document details saved.' };
    },
    setArchived: async (form) => {
      const parsed = documentArchiveInputSchema.safeParse(input(form));
      if (!parsed.success) return failure('Refresh the document.');
      setDocuments((current) =>
        current.map((item) =>
          item.id === parsed.data.documentId
            ? {
                ...item,
                archived_at: parsed.data.archived
                  ? new Date().toISOString()
                  : null,
                version: item.version + 1,
              }
            : item,
        ),
      );
      return { ok: true, message: 'Document updated.' };
    },
    setVersionArchived: async (form) => {
      const parsed = documentVersionArchiveInputSchema.safeParse(input(form));
      if (!parsed.success) return failure('Refresh the version.');
      setVersions((current) =>
        Object.fromEntries(
          Object.entries(current).map(([documentId, list]) => [
            documentId,
            list.map((item) =>
              item.id === parsed.data.versionId
                ? {
                    ...item,
                    archived_at: parsed.data.archived
                      ? new Date().toISOString()
                      : null,
                  }
                : item,
            ),
          ]),
        ),
      );
      return { ok: true, message: 'Version updated.' };
    },
  };

  return (
    <main className="mx-auto grid w-full max-w-content gap-space-5 p-space-4">
      <Banner title="Development fixture">
        Synthetic documents only. Actions update this page in memory.
      </Banner>
      <div className="grid gap-space-3 sm:grid-cols-2">
        <SelectInput
          id="document-fixture-view"
          label="Viewer"
          value={view}
          onChange={(event) => setView(event.target.value as View)}
          options={[
            { value: 'admin', label: 'Administrator' },
            { value: 'committee', label: 'Committee (read-only)' },
            { value: 'resident', label: 'Resident owner' },
          ]}
        />
        <SelectInput
          id="document-fixture-state"
          label="Screen state"
          value={state}
          onChange={(event) => setState(event.target.value as State)}
          options={[
            { value: 'ready', label: 'Ready' },
            { value: 'loading', label: 'Loading' },
            { value: 'disabled', label: 'Module disabled' },
            { value: 'denied', label: 'No permission' },
            { value: 'not_found', label: 'Not found' },
            { value: 'error', label: 'Error' },
          ]}
        />
      </div>
      {state === 'ready' ? (
        <DocumentWorkspaceView
          workspace={workspace}
          list={list}
          detail={detail}
          selection={selection}
          mode={management ? 'management' : 'resident'}
          baseHref={BASE_HREF}
          actions={actions}
          request={requestFiles}
        />
      ) : (
        <DocumentRouteState
          kind={state}
          returnHref={BASE_HREF}
          retryHref={state === 'error' ? BASE_HREF : undefined}
          referenceId={state === 'error' ? 'fixture-reference' : undefined}
        />
      )}
    </main>
  );
}

export default function DocumentFixturePage() {
  return (
    <Suspense fallback={<DocumentRouteState kind="loading" />}>
      <DocumentFixture />
    </Suspense>
  );
}
