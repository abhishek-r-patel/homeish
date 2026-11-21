// Preview and confirm resident imports with per-row validation feedback.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  confirmResidentsImportAction,
  previewResidentsImportAction,
} from '@/app/(admin)/admin/members/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  MAX_RESIDENT_CSV_BYTES,
  type ResidentImportPreview,
} from '@/core/members/residents-csv';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useUiTranslator } from '@/components/ui/language';

export function ResidentsImportControl() {
  const { translate: t, translateFeedback } = useUiTranslator();
  const router = useRouter();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ResidentImportPreview | null>(null);
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
    if (file.size > MAX_RESIDENT_CSV_BYTES) {
      setState({
        ok: false,
        code: 'VALIDATION_FAILED',
        message: 'CSV files must be 512 KB or smaller.',
        fieldErrors: { file: 'Choose a smaller CSV file.' },
      });
      return;
    }
    try {
      setCsv(await file.text());
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
      const result = await previewResidentsImportAction(csv);
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
      const result = await confirmResidentsImportAction(csv);
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

  return (
    <div className="grid gap-space-3">
      <a
        className="w-fit text-body text-brand underline"
        download="homeish-residents-template.csv"
        href="/admin/members/template.csv"
      >
        {t('Download CSV template')}
      </a>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor="residents-csv"
      >
        {t('Resident CSV file')}
        <input
          accept=".csv,text/csv"
          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 py-space-2 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
          id="residents-csv"
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
      {state ? (
        <p
          aria-live="polite"
          className={`text-caption ${state.ok ? 'text-success' : 'text-danger'}`}
          role="status"
        >
          {state.message ? translateFeedback(state.message) : null}
          {!state.ok && state.fieldErrors
            ? ` ${Object.values(state.fieldErrors).map(translateFeedback).join(' ')}`
            : ''}
        </p>
      ) : null}
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
          {t('Import Residents')}
        </Button>
      </div>
      {preview ? (
        <section aria-live="polite" className="grid gap-space-2" role="status">
          <h3 className="text-body-strong">
            {t('{rows} rows checked · {issues} issues', {
              rows: preview.rows.length,
              issues: preview.issues.length,
            })}
          </h3>
          {preview.issues.length ? (
            <ul className="grid gap-space-1">
              {preview.issues.slice(0, 20).map((issue, index) => (
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
              {t('All rows are valid. Preview made no database changes.')}
            </p>
          )}
        </section>
      ) : null}
      <ConfirmDialog
        actionLabel={t('Create resident invitations')}
        description={t(
          'Create {count} resident invitations and review the import job?',
          { count: preview?.rows.length ?? 0 },
        )}
        id="confirm-resident-import"
        loading={confirmPending}
        onConfirm={confirmImport}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={t('Confirm resident import')}
        variant="primary"
      />
      <p className="text-caption text-ink-muted">
        {t(
          'CSV templates and error reports remain in English. Keep the column names unchanged.',
        )}
      </p>
    </div>
  );
}
