// Open a society address without publishing a directory of real societies.
'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';

export function SocietyEntry({ websiteOrigin }: { websiteOrigin: string }) {
  const [error, setError] = useState('');

  function openSociety(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const slug = String(data.get('society') ?? '')
      .trim()
      .toLowerCase();
    if (
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) ||
      ['www', 'demo', 'beta', 'admin', 'api'].includes(slug)
    ) {
      setError('Enter your society’s address name, not a full website URL.');
      return;
    }
    const target = new URL(websiteOrigin);
    target.hostname = `${slug}.${target.hostname}`;
    window.location.assign(target.origin);
  }

  return (
    <form className="mt-space-5" onSubmit={openSociety}>
      <label className="block text-body-strong" htmlFor="society">
        Society address name
      </label>
      <p className="mt-space-2 text-caption text-ink-muted" id="society-help">
        Use the name shared by your society admin. Do not enter a society code.
      </p>
      <div className="mt-space-3 flex flex-wrap gap-space-3">
        <input
          aria-describedby={`society-help${error ? ' society-error' : ''}`}
          aria-invalid={Boolean(error)}
          autoCapitalize="none"
          autoComplete="off"
          className="min-h-12 min-w-0 flex-1 rounded-md border border-rule-strong bg-surface px-space-4 text-body"
          id="society"
          maxLength={63}
          name="society"
          onChange={() => setError('')}
          required
          spellCheck={false}
        />
        <Button type="submit" variant="secondary">
          Open Society
        </Button>
      </div>
      {error && (
        <p className="mt-space-3 text-danger" id="society-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
