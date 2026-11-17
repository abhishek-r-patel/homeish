// Accessible forms and confirmations for Core Platform structure.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import {
  confirmUnitsImportAction,
  createBlockAction,
  createUnitAction,
  previewUnitsImportAction,
  setBlockActiveAction,
  setUnitActiveAction,
  updateBlockAction,
  updateUnitAction,
} from '@/app/(admin)/structure/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import type { getStructure } from '@/core/structure/operations';
import type {
  UnitImportIssue,
  UnitImportPreview,
} from '@/core/structure/units-csv';
import { MAX_UNIT_CSV_BYTES } from '@/core/structure/units-csv-constants';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';
import { formatLocalizedNumber } from '@/core/i18n/format';

type Structure = Awaited<ReturnType<typeof getStructure>>;
type Block = Structure['blocks'][number];
type Unit = Structure['units'][number];

function ActionMessage({
  state,
}: {
  state: ServerActionResult<unknown> | null;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  if (!state) return null;
  return (
    <Banner tone={state.ok ? 'success' : 'danger'}>
      <p>{state.message ? translateFeedback(state.message) : null}</p>
      {!state.ok && state.referenceId ? (
        <p className="mt-space-2 text-caption">
          {t('Reference ID')}: <code>{state.referenceId}</code>
        </p>
      ) : null}
      {!state.ok && state.fieldErrors ? (
        <ul className="mt-space-2 list-inside list-disc text-caption">
          {Object.entries(state.fieldErrors).map(([field, message]) => (
            <li key={field}>{translateFeedback(message)}</li>
          ))}
        </ul>
      ) : null}
    </Banner>
  );
}

export function CreateBlockForm() {
  const { translate: t } = useUiTranslator();
  const router = useRouter();
  const [state, setState] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createBlockAction(formData);
      setState(result);
      if (result.ok) {
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form
      className="grid gap-space-3 medium:grid-cols-[minmax(0,1fr)_auto] medium:items-end"
      onSubmit={submit}
    >
      <TextInput
        id="block-name"
        label={t('Block name')}
        maxLength={60}
        minLength={1}
        name="name"
        required
      />
      <Button disabled={pending} loading={pending} type="submit">
        {t('Add Block')}
      </Button>
      <div className="medium:col-span-2">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function CreateUnitForm({ blocks }: { blocks: readonly Block[] }) {
  const { translate: t } = useUiTranslator();
  const router = useRouter();
  const [state, setState] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createUnitAction(formData);
      setState(result);
      if (result.ok) {
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form
      className="grid gap-space-3 medium:grid-cols-2 expanded:grid-cols-3"
      onSubmit={submit}
    >
      <label className="grid gap-space-1 text-body-strong" htmlFor="unit-block">
        {t('Block')}
        <select
          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
          id="unit-block"
          name="blockId"
        >
          <option value="">{t('No block')}</option>
          {blocks
            .filter(({ active }) => active)
            .map((block) => (
              <option key={block.id} value={block.id}>
                {block.name}
              </option>
            ))}
        </select>
      </label>
      <TextInput
        id="unit-number"
        label={t('Unit number')}
        maxLength={20}
        minLength={1}
        name="number"
        required
      />
      <TextInput
        id="unit-floor"
        label={t('Floor')}
        name="floor"
        type="number"
      />
      <TextInput
        id="unit-type"
        label={t('Unit type')}
        maxLength={30}
        name="unitType"
      />
      <TextInput
        id="unit-area"
        label={t('Area (sq ft)')}
        min="0.01"
        name="areaSqft"
        step="0.01"
        type="number"
      />
      <div className="flex items-end">
        <Button disabled={pending} loading={pending} type="submit">
          {t('Add Unit')}
        </Button>
      </div>
      <div className="medium:col-span-2 expanded:col-span-3">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function BlockEditForm({ block }: { block: Block }) {
  const { translate: t } = useUiTranslator();
  const router = useRouter();
  const [state, setState] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateBlockAction(formData);
      setState(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <form className="grid gap-space-2" onSubmit={submit}>
      <input name="blockId" type="hidden" value={block.id} />
      <TextInput
        defaultValue={block.name}
        id={`block-name-${block.id}`}
        label={t('Block name')}
        maxLength={60}
        minLength={1}
        name="name"
        required
      />
      <ActionMessage state={state} />
      <Button disabled={pending} loading={pending} type="submit">
        {t('Save Block')}
      </Button>
    </form>
  );
}

function UnitEditForm({
  unit,
  blocks,
}: {
  unit: Unit;
  blocks: readonly Block[];
}) {
  const { translate: t } = useUiTranslator();
  const router = useRouter();
  const [state, setState] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateUnitAction(formData);
      setState(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <form
      className="grid gap-space-3 rounded-md border border-rule p-space-3 medium:grid-cols-2 expanded:grid-cols-3"
      onSubmit={submit}
    >
      <input name="unitId" type="hidden" value={unit.id} />
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor={`unit-block-${unit.id}`}
      >
        {t('Block')}
        <select
          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue={unit.block_id ?? ''}
          id={`unit-block-${unit.id}`}
          name="blockId"
        >
          <option value="">{t('No block')}</option>
          {blocks.map((block) => (
            <option key={block.id} value={block.id}>
              {block.name}
              {block.active ? '' : t(' (Inactive)')}
            </option>
          ))}
        </select>
      </label>
      <TextInput
        defaultValue={unit.number}
        id={`unit-number-${unit.id}`}
        label={t('Unit number')}
        maxLength={20}
        minLength={1}
        name="number"
        required
      />
      <TextInput
        defaultValue={unit.floor?.toString() ?? ''}
        id={`unit-floor-${unit.id}`}
        label={t('Floor')}
        name="floor"
        type="number"
      />
      <TextInput
        defaultValue={unit.unit_type ?? ''}
        id={`unit-type-${unit.id}`}
        label={t('Unit type')}
        maxLength={30}
        name="unitType"
      />
      <TextInput
        defaultValue={unit.area_sqft?.toString() ?? ''}
        id={`unit-area-${unit.id}`}
        label={t('Area (sq ft)')}
        min="0.01"
        name="areaSqft"
        step="0.01"
        type="number"
      />
      <div className="flex items-end">
        <Button disabled={pending} loading={pending} type="submit">
          {t('Save Unit')}
        </Button>
      </div>
      <div className="medium:col-span-2 expanded:col-span-3">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadIssues(issues: readonly UnitImportIssue[]) {
  const content = [
    ['row', 'field', 'message'].map(csvCell).join(','),
    ...issues.map(({ rowNumber, field, message }) =>
      [String(rowNumber), field, message].map(csvCell).join(','),
    ),
  ].join('\r\n');
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'unit-import-errors.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function UnitImportControl() {
  const { translate: t, translateFeedback } = useUiTranslator();
  const router = useRouter();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<UnitImportPreview | null>(null);
  const [state, setState] = useState<ServerActionResult | null>(null);
  const [previewPending, startPreview] = useTransition();
  const [confirmPending, startConfirm] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function selectFile(file: File | undefined) {
    setCsv('');
    setFileName('');
    setPreview(null);
    setState(null);
    if (!file) return;
    if (file.size > MAX_UNIT_CSV_BYTES) {
      setState({
        ok: false,
        code: 'VALIDATION_FAILED',
        message: 'CSV files must be 512 KB or smaller.',
        fieldErrors: { file: 'Choose a smaller CSV file.' },
      });
      return;
    }
    try {
      const content = await file.text();
      setCsv(content);
      setFileName(file.name);
    } catch {
      setState({
        ok: false,
        code: 'INTEGRATION_FAILED',
        message: 'The CSV file could not be read. Choose it again.',
      });
    }
  }

  function runPreview() {
    startPreview(async () => {
      const result = await previewUnitsImportAction(csv);
      setState(
        result.ok
          ? { ok: true, ...(result.message ? { message: result.message } : {}) }
          : result,
      );
      setPreview(result.ok ? (result.data ?? null) : null);
    });
  }

  function confirmImport() {
    startConfirm(async () => {
      const result = await confirmUnitsImportAction(csv);
      setState(
        result.ok
          ? { ok: true, ...(result.message ? { message: result.message } : {}) }
          : result,
      );
      if (result.ok && result.data) {
        setConfirmOpen(false);
        router.push(`/admin/jobs/${result.data}`);
      }
    });
  }

  const previewResult = state?.ok ? preview : undefined;
  return (
    <div className="grid gap-space-3">
      <a
        className="w-fit text-body text-brand underline"
        download="homeish-units-template.csv"
        href="/admin/structure/template.csv"
      >
        {t('Download CSV template')}
      </a>
      <label className="grid gap-space-1 text-body-strong" htmlFor="units-csv">
        {t('Units CSV file')}
        <input
          accept=".csv,text/csv"
          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 py-space-2 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
          id="units-csv"
          onChange={(event) => {
            void selectFile(event.currentTarget.files?.[0]);
          }}
          type="file"
        />
      </label>
      {fileName ? (
        <p className="text-caption text-ink-muted">
          {t('Selected: {file}', { file: fileName })}
        </p>
      ) : null}
      <ActionMessage state={state} />
      <div className="flex flex-wrap gap-space-2">
        <Button
          disabled={!csv || previewPending || confirmPending}
          loading={previewPending}
          onClick={runPreview}
          variant="secondary"
        >
          {t('Preview Import')}
        </Button>
        <Button
          disabled={
            !preview ||
            preview.issues.length > 0 ||
            confirmPending ||
            previewPending
          }
          onClick={() => setConfirmOpen(true)}
        >
          {t('Import Units')}
        </Button>
      </div>
      {previewResult ? (
        <section aria-live="polite" className="grid gap-space-2" role="status">
          <h3 className="text-body-strong">
            {t('{rows} rows checked · {issues} issues', {
              rows: previewResult.rows.length,
              issues: previewResult.issues.length,
            })}
          </h3>
          {previewResult.issues.length > 0 ? (
            <>
              <ul className="grid gap-space-1">
                {previewResult.issues.slice(0, 20).map((issue, index) => (
                  <li
                    className="text-caption text-danger"
                    key={`${issue.rowNumber}-${issue.field}-${index}`}
                  >
                    {t('Row {row}, {field}: {message}', {
                      row: issue.rowNumber,
                      field: issue.field,
                      message: translateFeedback(issue.message),
                    })}
                  </li>
                ))}
              </ul>
              {previewResult.issues.length > 20 ? (
                <p className="text-caption text-ink-muted">
                  {t('Showing the first 20 of {count} issues.', {
                    count: previewResult.issues.length,
                  })}
                </p>
              ) : null}
              <Button
                onClick={() => downloadIssues(previewResult.issues)}
                variant="tertiary"
              >
                {t('Download Error Report')}
              </Button>
            </>
          ) : (
            <p className="text-caption text-success">
              {t('Preview is clean. Confirm to import these units.')}
            </p>
          )}
        </section>
      ) : null}
      <ConfirmDialog
        actionLabel={t('Import Units')}
        description={t(
          'Create {count} units from {file}? Existing records are preserved; duplicate units will be reported in the job results.',
          { count: preview?.rows.length ?? 0, file: fileName },
        )}
        id="units-import-confirmation"
        loading={confirmPending}
        onConfirm={confirmImport}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={t('Confirm unit import?')}
      />
      <p className="text-caption text-ink-muted">
        {t(
          'CSV templates and error reports remain in English. Keep the column names unchanged.',
        )}
      </p>
    </div>
  );
}

export function StructureRows({
  blocks,
  units,
}: {
  blocks: readonly Block[];
  units: readonly Unit[];
}) {
  const { locale, translate: t } = useUiTranslator();
  const number = (value: number) =>
    formatLocalizedNumber(value, locale ?? 'en');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ServerActionResult | null>(null);
  const [blockToChange, setBlockToChange] = useState<Block | null>(null);
  const [unitToChange, setUnitToChange] = useState<Unit | null>(null);
  const blockNames = new Map(blocks.map(({ id, name }) => [id, name]));

  function changeBlock() {
    if (!blockToChange) return;
    const formData = new FormData();
    formData.set('blockId', blockToChange.id);
    formData.set('active', String(!blockToChange.active));
    startTransition(async () => {
      const result = await setBlockActiveAction(formData);
      setState(result);
      if (result.ok) {
        setBlockToChange(null);
        router.refresh();
      }
    });
  }

  function changeUnit() {
    if (!unitToChange) return;
    const formData = new FormData();
    formData.set('unitId', unitToChange.id);
    formData.set('active', String(!unitToChange.active));
    startTransition(async () => {
      const result = await setUnitActiveAction(formData);
      setState(result);
      if (result.ok) {
        setUnitToChange(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-space-4">
      <ActionMessage state={state} />
      <div>
        <h3 className="mb-space-2 text-subheading">{t('Blocks')}</h3>
        {blocks.length === 0 ? (
          <EmptyState
            description={t(
              'Add blocks if this society groups homes by building.',
            )}
            title={t('No blocks')}
          />
        ) : (
          <ul className="divide-y divide-rule">
            {blocks.map((block) => (
              <li
                className="flex flex-wrap items-center justify-between gap-space-3 py-space-3"
                key={block.id}
              >
                <span className="text-body-strong">
                  {block.name}{' '}
                  <span className="text-caption text-ink-muted">
                    · {t(block.active ? 'Active' : 'Inactive')}
                  </span>
                </span>
                <Button
                  disabled={pending}
                  onClick={() => setBlockToChange(block)}
                  variant="secondary"
                >
                  {t(block.active ? 'Deactivate' : 'Reactivate')}
                </Button>
                <details className="w-full">
                  <summary className="min-h-10 cursor-pointer text-body text-brand underline">
                    {t('Edit block')}
                  </summary>
                  <div className="mt-space-2 max-w-content-narrow">
                    <BlockEditForm block={block} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-space-2 text-subheading">{t('Units')}</h3>
        {units.length === 0 ? (
          <EmptyState
            description={t('Add units here or import them from a CSV file.')}
            title={t('No units')}
          />
        ) : (
          <ul className="divide-y divide-rule">
            {units.map((unit) => (
              <li
                className="flex flex-wrap items-center justify-between gap-space-3 py-space-3"
                key={unit.id}
              >
                <span className="grid">
                  <span className="text-body-strong">
                    {blockNames.get(unit.block_id ?? '') ?? t('No block')} ·{' '}
                    {unit.number}
                  </span>
                  <span className="text-caption text-ink-muted">
                    {[
                      unit.floor === null
                        ? null
                        : t('Floor {floor}', { floor: number(unit.floor) }),
                      unit.unit_type,
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('No details')}
                    {unit.area_sqft === null
                      ? ''
                      : ` · ${t('{area} sq ft', { area: number(Number(unit.area_sqft)) })}`}
                    {` · ${t(unit.active ? 'Active' : 'Inactive')}`}
                  </span>
                </span>
                <Button
                  disabled={pending}
                  onClick={() => setUnitToChange(unit)}
                  variant="secondary"
                >
                  {t(unit.active ? 'Deactivate' : 'Reactivate')}
                </Button>
                <details className="w-full">
                  <summary className="min-h-10 cursor-pointer text-body text-brand underline">
                    {t('Edit unit')}
                  </summary>
                  <div className="mt-space-2">
                    <UnitEditForm blocks={blocks} unit={unit} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        actionLabel={t(blockToChange?.active ? 'Deactivate' : 'Reactivate')}
        description={t(
          blockToChange?.active
            ? 'The block will stay in the records but will no longer be offered for new units.'
            : 'The block will be available for new units again.',
        )}
        id="block-status-confirmation"
        loading={pending}
        onConfirm={changeBlock}
        onOpenChange={(open) => {
          if (!open) setBlockToChange(null);
        }}
        open={blockToChange !== null}
        title={t('Change block status?')}
        variant={blockToChange?.active ? 'destructive' : 'primary'}
      />
      <ConfirmDialog
        actionLabel={t(unitToChange?.active ? 'Deactivate' : 'Reactivate')}
        description={t(
          unitToChange?.active
            ? 'The unit will stay in the records and cannot be selected for new assignments.'
            : 'The unit will be available for new assignments again.',
        )}
        id="unit-status-confirmation"
        loading={pending}
        onConfirm={changeUnit}
        onOpenChange={(open) => {
          if (!open) setUnitToChange(null);
        }}
        open={unitToChange !== null}
        title={t('Change unit status?')}
        variant={unitToChange?.active ? 'destructive' : 'primary'}
      />
    </div>
  );
}
