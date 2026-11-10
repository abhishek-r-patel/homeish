// Editable account profile fields, including the saved font preference.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { updateProfileAction } from '@/app/profile/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import type { getProfile } from '@/core/members/operations';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';

type Profile = Awaited<ReturnType<typeof getProfile>>;

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [result, setResult] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const nextResult = await updateProfileAction(formData);
      setResult(nextResult);
      if (nextResult.ok) router.refresh();
    });
  }

  return (
    <form className="grid gap-space-4" onSubmit={submit}>
      <TextInput
        id="profile-email"
        label="Email address"
        readOnly
        value={profile.email}
      />
      <TextInput
        autoComplete="name"
        defaultValue={profile.full_name}
        id="profile-name"
        label="Full name"
        maxLength={120}
        name="fullName"
        required
      />
      <TextInput
        autoComplete="tel"
        defaultValue={profile.phone ?? ''}
        id="profile-phone"
        label="Phone number"
        maxLength={16}
        name="phone"
        type="tel"
      />
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor="font-preference"
      >
        Font preference
        <select
          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue={profile.font_preference}
          id="font-preference"
          name="fontPreference"
        >
          <option value="manrope_sora">Homeish typography</option>
          <option value="device_default">Use device default</option>
        </select>
      </label>
      <Button disabled={pending} loading={pending} type="submit">
        Save profile
      </Button>
      {result ? (
        <p
          aria-live="polite"
          className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
          role="status"
        >
          {result.message}
          {!result.ok && result.fieldErrors
            ? ` ${Object.values(result.fieldErrors).join(' ')}`
            : ''}
        </p>
      ) : null}
    </form>
  );
}
