// End the local developer session and navigate away from protected routes.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { signOutAction, type AuthActionState } from '../../app/(auth)/actions';
import { Banner } from '../ui/feedback';
import { Button } from '../ui/button';

export function DeveloperSignOut() {
  const router = useRouter();
  const [state, setState] = useState<AuthActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  function signOut() {
    setState(null);
    startTransition(async () => {
      const result = await signOutAction();
      setState(result);
      if (result.ok) {
        router.replace('/developer/login');
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-space-3">
      {state && !state.ok ? (
        <Banner tone="danger">
          <p>{state.message}</p>
          {state.referenceId ? (
            <p className="mt-space-2 text-caption">
              Reference ID: <code>{state.referenceId}</code>
            </p>
          ) : null}
        </Banner>
      ) : null}
      <Button disabled={isPending} loading={isPending} onClick={signOut}>
        Sign out
      </Button>
    </div>
  );
}
