// Let admins manage folders, publish documents and maintain archived version history.
'use client';
import { useId, useState } from 'react';
import {
  DOCUMENT_FOLDER_AUDIENCE_HELP,
  DOCUMENT_FOLDER_AUDIENCE_LABELS,
  DOCUMENT_UNIT_AUDIENCE_LABELS,
  documentUnitLabel,
} from '@/core/document/presentation';
import {
  DOCUMENT_FOLDER_AUDIENCES,
  DOCUMENT_UNIT_AUDIENCES,
  documentArchiveInputSchema,
  documentCreateInputSchema,
  documentFolderArchiveInputSchema,
  documentFolderAudienceSchema,
  documentFolderInputSchema,
  documentUnitAudienceSchema,
  documentUpdateInputSchema,
  documentVersionArchiveInputSchema,
  documentVersionInputSchema,
  type DocumentFolder,
  type DocumentItem,
  type DocumentVersion,
  type DocumentWorkspace,
} from '@/core/document/validation';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  DocumentFilePicker,
  type DocumentActions,
  type UploadedDocumentFile,
} from './files';

const folderAudienceOptions = DOCUMENT_FOLDER_AUDIENCES.map((value) => ({
  value,
  label: DOCUMENT_FOLDER_AUDIENCE_LABELS[value],
}));
const unitAudienceOptions = DOCUMENT_UNIT_AUDIENCES.map((value) => ({
  value,
  label: DOCUMENT_UNIT_AUDIENCE_LABELS[value],
}));

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

export function DocumentFolderForm({
  folder,
  action,
}: {
  folder: DocumentFolder | null;
  action: DocumentActions['saveFolder'];
}) {
  const id = useId();
  const [audience, setAudience] = useState(folder?.audience ?? 'all_residents');
  return (
    <ModuleActionForm
      action={action}
      submitLabel={folder ? `Save ${folder.name}` : 'Add folder'}
      input={(form) =>
        documentFolderInputSchema.parse({
          folderId: folder?.id ?? null,
          name: text(form, 'name'),
          audience: documentFolderAudienceSchema.parse(text(form, 'audience')),
          expectedVersion: folder?.version ?? null,
        })
      }
    >
      <TextInput
        id={`${id}-name`}
        name="name"
        label="Folder name"
        required
        maxLength={80}
        defaultValue={folder?.name ?? ''}
      />
      <SelectInput
        id={`${id}-audience`}
        name="audience"
        label="Who can view"
        options={folderAudienceOptions}
        value={audience}
        onChange={(event) =>
          setAudience(documentFolderAudienceSchema.parse(event.target.value))
        }
        helpText={DOCUMENT_FOLDER_AUDIENCE_HELP[audience]}
      />
    </ModuleActionForm>
  );
}

export function DocumentFolderArchiveForm({
  folder,
  action,
}: {
  folder: DocumentFolder;
  action: DocumentActions['setFolderArchived'];
}) {
  const archived = folder.archived_at !== null;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={
        archived ? `Restore ${folder.name}` : `Archive ${folder.name}`
      }
      confirmMessage={
        archived
          ? undefined
          : `Archive ${folder.name}? Residents will no longer see it or its documents. Nothing is deleted.`
      }
      input={() =>
        documentFolderArchiveInputSchema.parse({
          folderId: folder.id,
          archived: !archived,
          expectedVersion: folder.version,
        })
      }
    >
      {null}
    </ModuleActionForm>
  );
}

export function DocumentPublishForm({
  workspace,
  folderId,
  unitId,
  actions,
  request,
}: {
  workspace: DocumentWorkspace;
  folderId: string | null;
  unitId: string | null;
  actions: DocumentActions;
  request?: typeof fetch;
}) {
  const id = useId();
  const folders = workspace.folders.filter((folder) => !folder.archived_at);
  const [target, setTarget] = useState<'folder' | 'unit'>(
    unitId ? 'unit' : 'folder',
  );
  const [file, setFile] = useState<UploadedDocumentFile | null>(null);
  return (
    <ModuleActionForm
      action={actions.create}
      idempotent
      submitLabel="Publish document"
      submitDisabled={!file}
      onSaved={() => setFile(null)}
      input={(form, clientRequestId) => {
        const unit = target === 'unit';
        return documentCreateInputSchema.parse({
          folderId: unit ? null : text(form, 'folderId') || null,
          unitId: unit ? text(form, 'unitId') || null : null,
          unitAudience: unit
            ? documentUnitAudienceSchema.parse(text(form, 'unitAudience'))
            : null,
          title: text(form, 'title'),
          description: text(form, 'description') || null,
          path: file?.path,
          fileName: file?.fileName,
          clientRequestId,
        });
      }}
    >
      <SelectInput
        id={`${id}-target`}
        name="target"
        label="Publish to"
        value={target}
        onChange={(event) =>
          setTarget(event.target.value === 'unit' ? 'unit' : 'folder')
        }
        options={[
          { value: 'folder', label: 'A society folder' },
          { value: 'unit', label: 'A specific unit' },
        ]}
      />
      {target === 'folder' ? (
        <SelectInput
          id={`${id}-folder`}
          name="folderId"
          label="Folder"
          required
          defaultValue={folderId ?? ''}
          placeholder="Choose a folder"
          options={folders.map((folder) => ({
            value: folder.id,
            label: `${folder.name} (${DOCUMENT_FOLDER_AUDIENCE_LABELS[folder.audience]})`,
          }))}
          helpText="The document inherits the folder's audience."
        />
      ) : (
        <>
          <SelectInput
            id={`${id}-unit`}
            name="unitId"
            label="Unit"
            required
            defaultValue={unitId ?? ''}
            placeholder="Choose a unit"
            options={workspace.units.map((unit) => ({
              value: unit.id,
              label: documentUnitLabel(unit),
            }))}
          />
          <SelectInput
            id={`${id}-unit-audience`}
            name="unitAudience"
            label="Who in the unit can view"
            defaultValue="all_occupants"
            options={unitAudienceOptions}
          />
        </>
      )}
      <TextInput
        id={`${id}-title`}
        name="title"
        label="Title"
        required
        maxLength={120}
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label="Description (optional)"
        maxLength={500}
      />
      <DocumentFilePicker
        label="Document file"
        prepareUpload={actions.prepareUpload}
        request={request}
        onChange={setFile}
      />
    </ModuleActionForm>
  );
}

export function DocumentVersionForm({
  document,
  actions,
  request,
}: {
  document: DocumentItem;
  actions: DocumentActions;
  request?: typeof fetch;
}) {
  const id = useId();
  const [file, setFile] = useState<UploadedDocumentFile | null>(null);
  return (
    <ModuleActionForm
      action={actions.addVersion}
      submitLabel="Publish new version"
      submitDisabled={!file}
      onSaved={() => setFile(null)}
      input={(form) =>
        documentVersionInputSchema.parse({
          documentId: document.id,
          path: file?.path,
          fileName: file?.fileName,
          note: text(form, 'note') || null,
          expectedVersion: document.version,
        })
      }
    >
      <DocumentFilePicker
        label="New version file"
        prepareUpload={actions.prepareUpload}
        request={request}
        onChange={setFile}
      />
      <TextAreaInput
        id={`${id}-note`}
        name="note"
        label="What changed (optional)"
        maxLength={500}
      />
    </ModuleActionForm>
  );
}

export function DocumentDetailsForm({
  document,
  action,
}: {
  document: DocumentItem;
  action: DocumentActions['update'];
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel="Save details"
      input={(form) =>
        documentUpdateInputSchema.parse({
          documentId: document.id,
          title: text(form, 'title'),
          description: text(form, 'description') || null,
          unitAudience: document.unit_id
            ? documentUnitAudienceSchema.parse(text(form, 'unitAudience'))
            : null,
          expectedVersion: document.version,
        })
      }
    >
      <TextInput
        id={`${id}-title`}
        name="title"
        label="Title"
        required
        maxLength={120}
        defaultValue={document.title}
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label="Description (optional)"
        maxLength={500}
        defaultValue={document.description ?? ''}
      />
      {document.unit_id ? (
        <SelectInput
          id={`${id}-unit-audience`}
          name="unitAudience"
          label="Who in the unit can view"
          defaultValue={document.unit_audience ?? 'all_occupants'}
          options={unitAudienceOptions}
        />
      ) : null}
    </ModuleActionForm>
  );
}

export function DocumentArchiveForm({
  document,
  action,
}: {
  document: DocumentItem;
  action: DocumentActions['setArchived'];
}) {
  const archived = document.archived_at !== null;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={archived ? 'Restore document' : 'Archive document'}
      confirmMessage={
        archived
          ? undefined
          : 'Archive this document? Residents will no longer see it. Nothing is deleted.'
      }
      input={() =>
        documentArchiveInputSchema.parse({
          documentId: document.id,
          archived: !archived,
          expectedVersion: document.version,
        })
      }
    >
      {null}
    </ModuleActionForm>
  );
}

export function DocumentVersionArchiveForm({
  document,
  version,
  action,
}: {
  document: DocumentItem;
  version: DocumentVersion;
  action: DocumentActions['setVersionArchived'];
}) {
  const archived = version.archived_at !== null;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={
        archived
          ? `Restore version ${version.version_number}`
          : `Archive version ${version.version_number}`
      }
      input={() =>
        documentVersionArchiveInputSchema.parse({
          versionId: version.id,
          archived: !archived,
          expectedVersion: document.version,
        })
      }
    >
      {null}
    </ModuleActionForm>
  );
}
