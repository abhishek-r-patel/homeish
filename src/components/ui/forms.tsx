// Shared form layout and explicit protection for unsaved user input.
'use client';

import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ConfirmDialog } from './dialog';

type FormLayoutProps = {
  children: ReactNode;
  className?: string;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
};

export function FormLayout({
  children,
  className = '',
  onSubmit,
}: FormLayoutProps) {
  return (
    <form
      className={`mx-auto grid w-full max-w-content-narrow gap-space-6 ${className}`}
      onSubmit={onSubmit}
    >
      {children}
    </form>
  );
}

type FormSectionProps = {
  children: ReactNode;
  description?: ReactNode;
  title: string;
};

export function FormSection({
  children,
  description,
  title,
}: FormSectionProps) {
  return (
    <fieldset className="grid gap-space-4 border-0 border-t border-rule px-0 pt-space-6">
      <legend className="text-heading font-semibold">{title}</legend>
      {description ? (
        <p className="-mt-space-3 text-caption text-ink-muted">{description}</p>
      ) : null}
      {children}
    </fieldset>
  );
}

export function UnsavedChangesPrompt({
  id = 'unsaved-changes',
  onCancel,
  onLeave,
  open,
}: {
  id?: string;
  onCancel: () => void;
  onLeave: () => void;
  open: boolean;
}) {
  return (
    <ConfirmDialog
      actionLabel="Leave"
      description="Your changes will be lost."
      id={id}
      onConfirm={onLeave}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
      open={open}
      title="Leave without saving?"
      variant="primary"
    />
  );
}

export function useUnsavedChanges(isDirty: boolean) {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  function requestNavigation(action: () => void) {
    if (isDirty) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }

  function cancelNavigation() {
    setPendingAction(null);
  }

  function confirmNavigation() {
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  }

  return {
    cancelNavigation,
    confirmNavigation,
    isPromptOpen: pendingAction !== null,
    requestNavigation,
  };
}
