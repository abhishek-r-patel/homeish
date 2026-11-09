// Show a safe fallback and request a server-side reference ID for client errors.
'use client';

import { useEffect, useRef, useState } from 'react';
import { createRequestId } from '@/core/errors';

function getReferenceId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('data' in value)) {
    return null;
  }
  const data = value.data;
  if (typeof data !== 'object' || data === null || !('referenceId' in data)) {
    return null;
  }
  const referenceId = data.referenceId;
  return typeof referenceId === 'string' &&
    /^ERR-[A-F0-9]{10}$/.test(referenceId)
    ? referenceId
    : null;
}

export default function AppErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const reportedError = useRef<Error | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);

  useEffect(() => {
    if (reportedError.current === error) {
      return;
    }
    reportedError.current = error;
    setReferenceId(null);

    async function reportError() {
      try {
        const response = await fetch('/api/client-errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-request-id': createRequestId(),
          },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            route: window.location.pathname,
            device: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
            },
          }),
          cache: 'no-store',
        });
        if (!response.ok) {
          console.error('Homeish client error report failed.', {
            status: response.status,
          });
          return;
        }
        setReferenceId(getReferenceId(await response.json()));
      } catch {
        console.error('Homeish client error report failed.');
      }
    }

    void reportError();
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-content-narrow flex-col items-start justify-center gap-space-4 px-space-4 text-ink">
      <h1 className="text-title font-semibold">Something went wrong</h1>
      <p className="text-ink-muted">
        We could not complete that request. Please try again.
      </p>
      {referenceId && (
        <p role="status" className="text-body">
          Reference ID: <code>{referenceId}</code>
        </p>
      )}
      <button
        className="min-h-12 rounded-md bg-brand px-space-4 text-white"
        onClick={() => retry()}
        type="button"
      >
        Try again
      </button>
    </main>
  );
}
