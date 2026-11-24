// Render the shared P56 four-step, atomic CSV import flow.
'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import {
  previewBulkImportAction,
  saveBulkImportAction,
} from '@/app/bulk-import-actions';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useUiTranslator } from '@/components/ui/language';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  BULK_IMPORT_TEMPLATES,
  MAX_BULK_IMPORT_BYTES,
  type BulkImportKind,
  type BulkImportPreview,
} from '@/core/csv/bulk-import-shared';

const LABELS: Readonly<Record<BulkImportKind, string>> = {
  units: 'Units',
  residents: 'Residents',
  opening_dues: 'Opening dues',
  vehicles: 'Vehicles',
  staff: 'Staff',
  assets: 'Assets',
};

export function BulkImportControl({
  previewAction = previewBulkImportAction,
  saveAction = saveBulkImportAction,
  kind,
  societyId,
  auditHref = '/admin/jobs',
}: {
  previewAction?: (
    input: unknown,
  ) => Promise<ServerActionResult<BulkImportPreview>>;
  saveAction?: (input: unknown) => Promise<ServerActionResult<string>>;
  kind: BulkImportKind;
  societyId?: string;
  auditHref?: string;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const router = useRouter();
  const inputId = useId();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<BulkImportPreview | null>(null);
  const [result, setResult] = useState<ServerActionResult | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewPending, startPreview] = useTransition();
  const [savePending, startSave] = useTransition();

  async function selectFile(file: File | undefined) {
    setCsv('');
    setFileName('');
    setPreview(null);
    setResult(null);
    setRunId(null);
    if (!file) return;
    if (file.size > MAX_BULK_IMPORT_BYTES) {
      setResult({
        ok: false,
        code: 'VALIDATION_FAILED',
        message: 'CSV files must be 512 KB or smaller.',
      });
      return;
    }
    try {
      setCsv(await file.text());
      setFileName(file.name);
    } catch {
      setResult({
        ok: false,
        code: 'INTEGRATION_FAILED',
        message: 'The CSV file could not be read. Choose it again.',
      });
    }
  }

  function checkRows() {
    startPreview(async () => {
      const next = await previewAction({
        kind,
        csv,
        ...(societyId ? { societyId } : {}),
      });
      setResult(
        next.ok
          ? { ok: true, ...(next.message ? { message: next.message } : {}) }
          : next,
      );
      setPreview(next.ok ? (next.data ?? null) : null);
    });
  }

  function saveRows() {
    startSave(async () => {
      const next = await saveAction({
        kind,
        csv,
        ...(societyId ? { societyId } : {}),
      });
      setResult(
        next.ok
          ? { ok: true, ...(next.message ? { message: next.message } : {}) }
          : next,
      );
      if (next.ok && next.data) {
        setRunId(next.data);
        setConfirmOpen(false);
        router.refresh();
      }
    });
  }

  const issueCount = preview?.issues.length ?? 0;
  const rowCount = preview?.rows.length ?? 0;
  const templateUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(
    BULK_IMPORT_TEMPLATES[kind],
  )}`;
  const resultHref = runId
    ? auditHref.endsWith('=')
      ? `${auditHref}${runId}`
      : `${auditHref}/${runId}`
    : auditHref;

  return (
    <div className="grid min-w-0 gap-space-4">
      <ol className="grid grid-cols-2 gap-space-2 medium:grid-cols-4">
        {['Download template', 'Upload CSV', 'Check rows', 'Save all'].map(
          (step, index) => (
            <li
              className="min-w-0 break-words rounded-md border border-rule bg-surface-sunken p-space-3 text-caption"
              key={step}
            >
              <span className="font-semibold text-brand">
                {index + 1}. {t(step)}
              </span>
            </li>
          ),
        )}
      </ol>
      <a
        className="w-fit text-body text-brand underline"
        download={`homeish-${kind}-template.csv`}
        href={templateUrl}
      >
        {t('Download CSV template')}
      </a>
      <label className="grid gap-space-1 text-body-strong" htmlFor={inputId}>
        {t('{list} CSV file', { list: t(LABELS[kind]) })}
        <input
          accept=".csv,text/csv"
          className="min-h-12 w-full min-w-0 max-w-full rounded-md border border-rule-strong bg-surface px-space-3 py-space-2 text-body text-ink"
          id={inputId}
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
      {result?.message ? (
        <p
          aria-live="polite"
          className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
          role="status"
        >
          {translateFeedback(result.message)}
          {!result.ok && result.fieldErrors
            ? ` ${Object.values(result.fieldErrors).map(translateFeedback).join(' ')}`
            : ''}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-space-2">
        <Button
          disabled={!csv || previewPending || savePending}
          loading={previewPending}
          onClick={checkRows}
          variant="secondary"
        >
          {t('Check rows')}
        </Button>
        <Button
          disabled={!preview || issueCount > 0 || !rowCount || savePending}
          onClick={() => setConfirmOpen(true)}
        >
          {t('Save all')}
        </Button>
      </div>
      {preview ? (
        <section aria-live="polite" className="grid gap-space-2" role="status">
          <h3 className="text-body-strong">
            {t('{rows} rows checked · {issues} issues', {
              rows: rowCount,
              issues: issueCount,
            })}
          </h3>
          {issueCount ? (
            <ul className="grid gap-space-1">
              {preview.issues.slice(0, 30).map((issue, index) => (
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
          ) : (
            <p className="text-caption text-success">
              {t(
                'All rows are valid. Nothing is saved until you choose Save all.',
              )}
            </p>
          )}
        </section>
      ) : null}
      {runId ? (
        <p className="text-body text-success">
          {t('{count} rows were saved together.', { count: rowCount })}{' '}
          <a className="font-semibold underline" href={resultHref}>
            {t('View import result')}
          </a>
        </p>
      ) : null}
      <ConfirmDialog
        actionLabel={t('Save all rows')}
        description={t(
          'Save all {count} checked rows together? One invalid row or database conflict cancels the whole import.',
          { count: rowCount },
        )}
        id={`${inputId}-confirm`}
        loading={savePending}
        onConfirm={saveRows}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={t('Confirm CSV import')}
        variant="primary"
      />
      <p className="text-caption text-ink-muted">
        {t('CSV templates and error messages remain in English.')}
      </p>
    </div>
  );
}
