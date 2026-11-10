// Admin controls for rotating or disabling the society's registration code.
'use client';

import { useState, useTransition } from 'react';
import {
  disableJoinCodeAction,
  rotateJoinCodeAction,
} from '@/app/(admin)/settings/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';

function ActionMessage({
  result,
}: {
  result: ServerActionResult<string> | null;
}) {
  if (!result) return null;
  return (
    <p
      aria-live="polite"
      className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
      role="status"
    >
      {result.message}
    </p>
  );
}

export function JoinCodeControls({
  initialJoinCode,
}: {
  initialJoinCode: string | null;
}) {
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [result, setResult] = useState<ServerActionResult<string> | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<
    'rotate' | 'disable' | null
  >(null);

  function confirm() {
    const action = confirmAction;
    if (!action) return;
    setResult(null);
    startTransition(async () => {
      if (action === 'rotate') {
        const nextResult = await rotateJoinCodeAction();
        setResult(nextResult);
        if (nextResult.ok) setJoinCode(nextResult.data ?? null);
      } else {
        const nextResult = await disableJoinCodeAction();
        setResult(nextResult);
        if (nextResult.ok) setJoinCode(null);
      }
      setConfirmAction(null);
    });
  }

  return (
    <div className="grid gap-space-4">
      <div className="grid gap-space-1">
        <p className="text-caption text-ink-muted">Current society code</p>
        <p className="font-mono text-title font-semibold" aria-live="polite">
          {joinCode ?? 'Disabled'}
        </p>
      </div>
      <p className="text-body text-ink-muted">
        Share this code with residents who need to request access. Rotating it
        immediately invalidates the previous code.
      </p>
      <div className="flex flex-wrap gap-space-3">
        <Button
          disabled={pending}
          onClick={() => setConfirmAction('rotate')}
          type="button"
        >
          {joinCode ? 'Rotate code' : 'Create code'}
        </Button>
        {joinCode ? (
          <Button
            disabled={pending}
            onClick={() => setConfirmAction('disable')}
            type="button"
            variant="secondary"
          >
            Disable code
          </Button>
        ) : null}
      </div>
      <ActionMessage result={result} />
      <ConfirmDialog
        actionLabel={
          confirmAction === 'disable' ? 'Disable code' : 'Rotate code'
        }
        description={
          confirmAction === 'disable'
            ? 'New resident registration requests using this code will stop immediately.'
            : 'The old code will stop working as soon as the new code is created.'
        }
        id="join-code-confirmation"
        loading={pending}
        onConfirm={confirm}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        open={confirmAction !== null}
        title={
          confirmAction === 'disable'
            ? 'Disable registration code?'
            : 'Change registration code?'
        }
        variant="destructive"
      />
    </div>
  );
}
