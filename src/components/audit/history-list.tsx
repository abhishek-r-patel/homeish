// Render redacted society history and confirm the reversible settings subset.
'use client';

import { useState, useTransition } from 'react';
import type { AuditHistoryRow } from '@/core/audit/history';
import type { ServerActionResult } from '@/core/actions/server-action';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Banner } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';

type UndoAction = (formData: FormData) => Promise<ServerActionResult<unknown>>;

function detail(value: unknown) {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value, null, 2);
}

export function AuditHistoryList({
  rows,
  undoAction,
}: {
  rows: AuditHistoryRow[];
  undoAction: UndoAction;
}) {
  const { translate: t } = useUiTranslator();
  const [selected, setSelected] = useState<AuditHistoryRow | null>(null);
  const [result, setResult] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function undo() {
    if (!selected) return;
    const formData = new FormData();
    formData.set('auditId', selected.id);
    startTransition(async () => {
      const next = await undoAction(formData);
      setResult(next);
      if (next.ok) setSelected(null);
    });
  }

  return (
    <div className="grid gap-space-4">
      {result ? (
        <Banner tone={result.ok ? 'success' : 'danger'}>
          {result.message ?? t('The change could not be undone.')}
        </Banner>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-body text-ink-muted">
          {t('No changes match these filters.')}
        </p>
      ) : (
        <ol className="grid gap-space-3">
          {rows.map((row) => (
            <li
              className="grid gap-space-3 rounded-md border border-rule bg-surface p-space-4"
              key={row.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-space-3">
                <div className="grid gap-space-1">
                  <p className="text-body-strong">{row.action}</p>
                  <p className="text-caption text-ink-muted">
                    {row.category} · {row.actorName}
                    {row.actorRole ? ` (${row.actorRole})` : ''} ·{' '}
                    {new Date(row.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Kolkata',
                    })}
                  </p>
                </div>
                {row.canUndo ? (
                  <Button
                    onClick={() => setSelected(row)}
                    type="button"
                    variant="secondary"
                  >
                    {t('Undo')}
                  </Button>
                ) : row.undoReason ? (
                  <p className="max-w-xs text-caption text-ink-muted">
                    {t(row.undoReason)}
                  </p>
                ) : null}
              </div>
              {detail(row.before) || detail(row.after) ? (
                <details>
                  <summary className="min-h-12 cursor-pointer content-center font-semibold">
                    {t('View changed values')}
                  </summary>
                  <div className="mt-space-3 grid gap-space-3 medium:grid-cols-2">
                    <div>
                      <p className="text-caption font-semibold text-ink-muted">
                        {t('Before')}
                      </p>
                      <pre className="mt-space-2 overflow-x-auto text-caption">
                        {detail(row.before) ?? t('Not recorded')}
                      </pre>
                    </div>
                    <div>
                      <p className="text-caption font-semibold text-ink-muted">
                        {t('After')}
                      </p>
                      <pre className="mt-space-2 overflow-x-auto text-caption">
                        {detail(row.after) ?? t('Not recorded')}
                      </pre>
                    </div>
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <ConfirmDialog
        actionLabel={t('Undo change')}
        description={
          selected
            ? `Undo ${selected.action}? The previous setting value will be restored.`
            : t('Choose a change to undo.')
        }
        id="audit-setting-undo"
        loading={pending}
        title={t('Undo this setting change?')}
        onConfirm={undo}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        open={selected !== null}
      />
    </div>
  );
}
