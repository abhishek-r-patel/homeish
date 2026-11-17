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
import { useDocumentPresentation } from './presentation';

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
  const { t } = useDocumentPresentation();
  const id = useId();
  const [audience, setAudience] = useState(folder?.audience ?? 'all_residents');
  return (
    <ModuleActionForm
      action={action}
      submitLabel={
        folder ? t('Save {name}', { name: folder.name }) : t('Add folder')
      }
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
        label={t('Folder name')}
        required
        maxLength={80}
        defaultValue={folder?.name ?? ''}
      />
      <SelectInput
        id={`${id}-audience`}
        name="audience"
        label={t('Who can view')}
        options={folderAudienceOptions.map((option) => ({
          ...option,
          label: t(option.label),
        }))}
        value={audience}
        onChange={(event) =>
          setAudience(documentFolderAudienceSchema.parse(event.target.value))
        }
        helpText={t(DOCUMENT_FOLDER_AUDIENCE_HELP[audience])}
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
  const { t } = useDocumentPresentation();
  const archived = folder.archived_at !== null;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t(archived ? 'Restore {name}' : 'Archive {name}', {
        name: folder.name,
      })}
      confirmMessage={
        archived
          ? undefined
          : t(
              'Archive {name}? Residents will no longer see it or its documents. Nothing is deleted.',
              { name: folder.name },
            )
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
  const { t } = useDocumentPresentation();
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
      submitLabel={t('Publish document')}
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
        label={t('Publish to')}
        value={target}
        onChange={(event) =>
          setTarget(event.target.value === 'unit' ? 'unit' : 'folder')
        }
        options={[
          { value: 'folder', label: t('A society folder') },
          { value: 'unit', label: t('A specific unit') },
        ]}
      />
      {target === 'folder' ? (
        <SelectInput
          id={`${id}-folder`}
          name="folderId"
          label={t('Folder')}
          required
          defaultValue={folderId ?? ''}
          placeholder={t('Choose a folder')}
          options={folders.map((folder) => ({
            value: folder.id,
            label: `${folder.name} (${t(DOCUMENT_FOLDER_AUDIENCE_LABELS[folder.audience])})`,
          }))}
          helpText={t("The document inherits the folder's audience.")}
        />
      ) : (
        <>
          <SelectInput
            id={`${id}-unit`}
            name="unitId"
            label={t('Unit')}
            required
            defaultValue={unitId ?? ''}
            placeholder={t('Choose a unit')}
            options={workspace.units.map((unit) => ({
              value: unit.id,
              label: documentUnitLabel(unit),
            }))}
          />
          <SelectInput
            id={`${id}-unit-audience`}
            name="unitAudience"
            label={t('Who in the unit can view')}
            defaultValue="all_occupants"
            options={unitAudienceOptions.map((option) => ({
              ...option,
              label: t(option.label),
            }))}
          />
        </>
      )}
      <TextInput
        id={`${id}-title`}
        name="title"
        label={t('Title')}
        required
        maxLength={120}
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label={t('Description (optional)')}
        maxLength={500}
      />
      <DocumentFilePicker
        label={t('Document file')}
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
  const { t } = useDocumentPresentation();
  const id = useId();
  const [file, setFile] = useState<UploadedDocumentFile | null>(null);
  return (
    <ModuleActionForm
      action={actions.addVersion}
      submitLabel={t('Publish new version')}
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
        label={t('New version file')}
        prepareUpload={actions.prepareUpload}
        request={request}
        onChange={setFile}
      />
      <TextAreaInput
        id={`${id}-note`}
        name="note"
        label={t('What changed (optional)')}
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
  const { t } = useDocumentPresentation();
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Save details')}
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
        label={t('Title')}
        required
        maxLength={120}
        defaultValue={document.title}
      />
      <TextAreaInput
        id={`${id}-description`}
        name="description"
        label={t('Description (optional)')}
        maxLength={500}
        defaultValue={document.description ?? ''}
      />
      {document.unit_id ? (
        <SelectInput
          id={`${id}-unit-audience`}
          name="unitAudience"
          label={t('Who in the unit can view')}
          defaultValue={document.unit_audience ?? 'all_occupants'}
          options={unitAudienceOptions.map((option) => ({
            ...option,
            label: t(option.label),
          }))}
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
  const { t } = useDocumentPresentation();
  const archived = document.archived_at !== null;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t(archived ? 'Restore document' : 'Archive document')}
      confirmMessage={
        archived
          ? undefined
          : t(
              'Archive this document? Residents will no longer see it. Nothing is deleted.',
            )
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
  const { t } = useDocumentPresentation();
  const archived = version.archived_at !== null;
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t(
        archived ? 'Restore version {number}' : 'Archive version {number}',
        { number: version.version_number },
      )}
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
