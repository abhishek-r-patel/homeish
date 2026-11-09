// Native modal dialog with focus management and responsive bottom-sheet styling.
'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode, RefObject } from 'react';
import { Button } from './button';
import { TextAreaInput } from './specialized-inputs';

type DialogProps = {
  children: ReactNode;
  className?: string;
  closeDisabled?: boolean;
  description?: ReactNode;
  id: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export function Dialog({
  children,
  className = '',
  closeDisabled = false,
  description,
  id,
  initialFocusRef,
  onOpenChange,
  open,
  title,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      initialFocusRef?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [initialFocusRef, open]);

  return (
    <dialog
      aria-describedby={description ? `${id}-description` : undefined}
      aria-labelledby={`${id}-title`}
      aria-modal="true"
      className={`fixed inset-x-0 bottom-0 m-0 max-h-overlay-max w-full max-w-none overflow-y-auto rounded-t-lg rounded-b-none border border-rule bg-surface p-space-5 text-ink shadow-overlay backdrop:bg-ink/50 medium:inset-x-auto medium:bottom-auto medium:left-1/2 medium:top-1/2 medium:max-w-content-narrow medium:-translate-x-1/2 medium:-translate-y-1/2 medium:rounded-lg ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) {
          onOpenChange(false);
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) {
          onOpenChange(false);
        }
      }}
      ref={dialogRef}
    >
      <div className="mx-auto mb-space-4 h-1 w-12 rounded-full bg-rule-strong medium:hidden" />
      <header className="mb-space-4 flex items-start justify-between gap-space-3">
        <h2 className="text-heading font-semibold" id={`${id}-title`}>
          {title}
        </h2>
        <Button
          aria-label="Close dialog"
          disabled={closeDisabled}
          iconOnly
          leadingIcon={
            <svg fill="none" viewBox="0 0 24 24">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          }
          onClick={() => onOpenChange(false)}
          variant="tertiary"
        />
      </header>
      {description ? (
        <div
          className="mb-space-4 text-body text-ink-muted"
          id={`${id}-description`}
        >
          {description}
        </div>
      ) : null}
      {children}
    </dialog>
  );
}

export type ConfirmDialogProps = {
  actionLabel: string;
  description: ReactNode;
  error?: string;
  id: string;
  loading?: boolean;
  onConfirm: (reason: string | null) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  requiresReason?: boolean;
  title: string;
  variant?: 'primary' | 'destructive';
};

type ConfirmDialogFormProps = {
  actionLabel: string;
  cancelRef: RefObject<HTMLButtonElement | null>;
  error?: string;
  id: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
  requiresReason: boolean;
  variant: 'primary' | 'destructive';
};

function ConfirmDialogForm({
  actionLabel,
  cancelRef,
  error,
  id,
  loading,
  onCancel,
  onConfirm,
  requiresReason,
  variant,
}: ConfirmDialogFormProps) {
  const [reason, setReason] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || (requiresReason && !reason.trim())) {
      return;
    }
    onConfirm(requiresReason ? reason.trim() : null);
  }

  return (
    <form className="grid gap-space-4" onSubmit={submit}>
      {requiresReason ? (
        <TextAreaInput
          id={`${id}-reason`}
          label="Reason"
          maxLength={500}
          onChange={(event) => setReason(event.currentTarget.value)}
          required
          value={reason}
        />
      ) : null}
      {error ? (
        <p className="text-body text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-space-2 medium:flex-row medium:justify-end">
        <Button
          disabled={loading}
          buttonRef={cancelRef}
          onClick={onCancel}
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          disabled={requiresReason && !reason.trim()}
          loading={loading}
          type="submit"
          variant={variant}
        >
          {actionLabel}
        </Button>
      </div>
    </form>
  );
}

export function ConfirmDialog({
  actionLabel,
  description,
  error,
  id,
  loading = false,
  onConfirm,
  onOpenChange,
  open,
  requiresReason = false,
  title,
  variant = 'destructive',
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  function close() {
    if (loading) {
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog
      closeDisabled={loading}
      description={description}
      id={id}
      initialFocusRef={cancelRef}
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}
      open={open}
      title={title}
    >
      {open ? (
        <ConfirmDialogForm
          actionLabel={actionLabel}
          cancelRef={cancelRef}
          error={error}
          id={id}
          loading={loading}
          onCancel={close}
          onConfirm={onConfirm}
          requiresReason={requiresReason}
          variant={variant}
        />
      ) : null}
    </Dialog>
  );
}
