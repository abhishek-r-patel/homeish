// Preview and confirm resident imports with per-row validation feedback.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  confirmResidentsImportAction,
  previewResidentsImportAction,
} from '@/app/(admin)/members/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  MAX_RESIDENT_CSV_BYTES,
  type ResidentImportPreview,
} from '@/core/members/residents-csv';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';

export function ResidentsImportControl() {
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
        Download CSV template
      </a>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor="residents-csv"
      >
        Resident CSV file
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
        <p className="text-caption text-ink-muted">Selected: {fileName}</p>
      ) : null}
      {state ? (
        <p
          aria-live="polite"
          className={`text-caption ${state.ok ? 'text-success' : 'text-danger'}`}
          role="status"
        >
          {state.message}
          {!state.ok && state.fieldErrors
            ? ` ${Object.values(state.fieldErrors).join(' ')}`
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
          Preview Import
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
          Import Residents
        </Button>
      </div>
      {preview ? (
        <section aria-live="polite" className="grid gap-space-2" role="status">
          <h3 className="text-body-strong">
            {preview.rows.length} rows checked · {preview.issues.length} issue
            {preview.issues.length === 1 ? '' : 's'}
          </h3>
          {preview.issues.length ? (
            <ul className="grid gap-space-1">
              {preview.issues.slice(0, 20).map((issue, index) => (
                <li
                  className="text-caption text-danger"
                  key={`${issue.rowNumber}-${issue.field}-${index}`}
                >
                  Row {issue.rowNumber}, {issue.field}: {issue.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-caption text-success">
              All rows are valid. Preview made no database changes.
            </p>
          )}
        </section>
      ) : null}
      <ConfirmDialog
        actionLabel="Create resident invitations"
        description={`Create ${preview?.rows.length ?? 0} resident invitations and review the import job?`}
        id="confirm-resident-import"
        loading={confirmPending}
        onConfirm={confirmImport}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="Confirm resident import"
        variant="primary"
      />
    </div>
  );
}
