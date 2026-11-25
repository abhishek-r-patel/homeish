// Create, edit and withdraw developer-authored platform release notes.
'use client';

import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import {
  savePlatformUpdateAction,
  withdrawPlatformUpdateAction,
} from '@/app/developer/actions';
import type { PlatformUpdate } from '@/core/updates/operations';
import type { DeveloperActionResult } from '@/core/developer/console';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { TextInput } from '@/components/ui/text-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';

type SaveAction = (formData: FormData) => Promise<DeveloperActionResult>;

export function DeveloperPlatformUpdates({
  updates,
  saveAction = savePlatformUpdateAction,
  withdrawAction = withdrawPlatformUpdateAction,
}: {
  updates: PlatformUpdate[];
  saveAction?: SaveAction;
  withdrawAction?: SaveAction;
}) {
  const [editing, setEditing] = useState<PlatformUpdate | null>(null);
  const [result, setResult] = useState<DeveloperActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const next = await saveAction(new FormData(event.currentTarget));
      setResult(next);
      if (next.ok) setEditing(null);
    });
  }

  function withdraw(update: PlatformUpdate) {
    const formData = new FormData();
    formData.set('updateId', update.id);
    formData.set('expectedUpdatedAt', update.updatedAt ?? '');
    startTransition(async () => setResult(await withdrawAction(formData)));
  }

  return (
    <div className="grid gap-space-5">
      {result ? (
        <Banner tone={result.ok ? 'success' : 'danger'}>
          {result.message ?? 'The release note could not be saved.'}
        </Banner>
      ) : null}
      <form className="grid gap-space-4" onSubmit={submit}>
        <input name="updateId" type="hidden" value={editing?.id ?? ''} />
        <input
          name="expectedUpdatedAt"
          type="hidden"
          value={editing?.updatedAt ?? ''}
        />
        <TextInput
          defaultValue={editing?.title ?? ''}
          id="platform-update-title"
          key={`title-${editing?.id ?? 'new'}`}
          label="Title"
          maxLength={120}
          name="title"
          required
        />
        <TextAreaInput
          defaultValue={editing?.body ?? ''}
          id="platform-update-body"
          key={`body-${editing?.id ?? 'new'}`}
          label="Release note"
          maxLength={2000}
          name="body"
          required
          rows={6}
        />
        <TextInput
          defaultValue={editing?.href ?? ''}
          id="platform-update-href"
          key={`href-${editing?.id ?? 'new'}`}
          label="Related in-app page (optional)"
          maxLength={500}
          name="href"
          pattern="^/(?!/).+"
        />
        <label className="flex min-h-12 items-center gap-space-3">
          <input
            defaultChecked={editing?.publishedAt !== null}
            name="publish"
            type="checkbox"
            value="true"
          />
          <span>Publish now</span>
        </label>
        <div className="flex flex-wrap gap-space-3">
          <Button disabled={pending} loading={pending} type="submit">
            {editing ? 'Save changes' : 'Save release note'}
          </Button>
          {editing ? (
            <Button
              disabled={pending}
              onClick={() => setEditing(null)}
              type="button"
              variant="secondary"
            >
              Cancel edit
            </Button>
          ) : null}
        </div>
      </form>
      <ul className="grid gap-space-3">
        {updates.map((update) => (
          <li
            className="rounded-md border border-rule bg-dev-bar p-space-4"
            key={update.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-space-3">
              <div>
                <p className="text-body-strong">{update.title}</p>
                <p className="mt-space-1 text-caption text-surface/70">
                  {update.withdrawnAt
                    ? 'Withdrawn'
                    : update.publishedAt
                      ? 'Published'
                      : 'Draft'}
                </p>
              </div>
              <div className="flex flex-wrap gap-space-2">
                <Button
                  onClick={() => setEditing(update)}
                  type="button"
                  variant="secondary"
                >
                  Edit
                </Button>
                {update.publishedAt && !update.withdrawnAt ? (
                  <Button
                    disabled={pending}
                    onClick={() => withdraw(update)}
                    type="button"
                    variant="destructive"
                  >
                    Withdraw
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
