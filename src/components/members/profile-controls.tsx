// Editable account profile fields, including the saved font preference.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import {
  saveDefaultFlatAction,
  saveStartingPlaceAction,
  updateProfileAction,
} from '@/app/profile/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import type { getProfile } from '@/core/members/operations';
import { Card } from '@/components/ui/data-display';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';
import { LanguageSelector } from '@/components/language-selector';
import { useLanguage } from '@/components/language-provider';
import { useUiTranslator } from '@/components/ui/language';

type Profile = Awaited<ReturnType<typeof getProfile>>;

export function ProfileForm({ profile }: { profile: Profile }) {
  const { locale, translate } = useLanguage();
  const { translateFeedback } = useUiTranslator();
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
    <div className="grid gap-space-4" lang={locale}>
      <LanguageSelector />
      <form className="grid gap-space-4" onSubmit={submit}>
        <TextInput
          id="profile-email"
          label={translate('Email address')}
          readOnly
          value={profile.email}
        />
        <TextInput
          autoComplete="name"
          defaultValue={profile.full_name}
          id="profile-name"
          label={translate('Full name')}
          maxLength={120}
          name="fullName"
          required
        />
        <TextInput
          autoComplete="tel"
          defaultValue={profile.phone ?? ''}
          id="profile-phone"
          label={translate('Phone number')}
          maxLength={16}
          name="phone"
          type="tel"
        />
        <label
          className="grid gap-space-1 text-body-strong"
          htmlFor="font-preference"
        >
          {translate('Font preference')}
          <select
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
            defaultValue={profile.font_preference}
            id="font-preference"
            name="fontPreference"
          >
            <option value="manrope_sora">
              {translate('Homeish typography')}
            </option>
            <option value="device_default">
              {translate('Use device default')}
            </option>
          </select>
        </label>
        <Button disabled={pending} loading={pending} type="submit">
          {translate('Save profile')}
        </Button>
        {result?.message ? (
          <p
            aria-live="polite"
            className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
            role="status"
          >
            {translateFeedback(result.message)}
            {!result.ok && result.fieldErrors
              ? ` ${Object.values(result.fieldErrors)
                  .map((message) => translateFeedback(message))
                  .join(' ')}`
              : ''}
          </p>
        ) : null}
      </form>
    </div>
  );
}

export function ProfileContent({ profile }: { profile: Profile }) {
  const { locale, translate } = useLanguage();
  return (
    <main
      className="mx-auto grid min-h-dvh max-w-content-default content-start gap-space-5 px-space-4 py-space-6"
      lang={locale}
    >
      <Link className="text-brand underline-offset-2 hover:underline" href="/">
        {translate('Back to Homeish')}
      </Link>
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">
          {translate('Your Profile')}
        </h1>
        <p className="text-body text-ink-muted">
          {translate(
            'Update your contact details and saved display preferences.',
          )}
        </p>
      </header>
      <Card title={translate('Account details')}>
        <ProfileForm profile={profile} />
      </Card>
      {profile.hasMultiplePlaces ? (
        <Card title={translate('Starting place')}>
          <StartingPlaceForm profile={profile} />
        </Card>
      ) : null}
      {profile.residentFlats.length > 1 ? (
        <Card title={translate('Default flat view')}>
          <FlatPreferenceForm profile={profile} />
        </Card>
      ) : null}
    </main>
  );
}

function FlatPreferenceForm({ profile }: { profile: Profile }) {
  const { translate } = useLanguage();
  const { translateFeedback } = useUiTranslator();
  const router = useRouter();
  const [result, setResult] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const nextResult = await saveDefaultFlatAction(
        new FormData(event.currentTarget),
      );
      setResult(nextResult);
      if (nextResult.ok) router.refresh();
    });
  }

  return (
    <form className="grid gap-space-4" onSubmit={submit}>
      <label className="grid gap-space-1 text-body-strong" htmlFor="flat-scope">
        {translate('Show on resident pages')}
        <select
          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue={
            profile.residentAllFlats
              ? 'all'
              : (profile.residentFlats.find((flat) => flat.selected)?.unit_id ??
                profile.residentFlats[0]?.unit_id ??
                '')
          }
          id="flat-scope"
          name="flatScope"
        >
          {profile.residentFlats.map((flat) => (
            <option key={flat.unit_id} value={flat.unit_id ?? ''}>
              {flat.label}
            </option>
          ))}
          <option value="all">{translate('All my flats together')}</option>
        </select>
      </label>
      <p className="text-caption text-ink-muted">
        {translate(
          'Items from all flats are labelled with their flat. You can switch temporarily from the place picker.',
        )}
      </p>
      <Button disabled={pending} loading={pending} type="submit">
        {translate('Save flat view')}
      </Button>
      {result?.message ? (
        <p
          aria-live="polite"
          className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
          role="status"
        >
          {translateFeedback(result.message)}
        </p>
      ) : null}
    </form>
  );
}

function StartingPlaceForm({ profile }: { profile: Profile }) {
  const { translate } = useLanguage();
  const { translateFeedback } = useUiTranslator();
  const router = useRouter();
  const [result, setResult] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const nextResult = await saveStartingPlaceAction(formData);
      setResult(nextResult);
      if (nextResult.ok) router.refresh();
    });
  }

  return (
    <form className="grid gap-space-4" onSubmit={submit}>
      <label
        className="grid gap-space-1 text-body-strong"
        htmlFor="starting-place"
      >
        {translate('When I sign in, open')}
        <select
          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body text-ink focus-visible:outline-2 focus-visible:outline-focus"
          defaultValue={profile.startingPlace}
          id="starting-place"
          name="startingPlace"
        >
          <option value="last_used">
            {translate('Last place used on this device')}
          </option>
          {profile.placeOptions.map((place) => (
            <option key={place.value} value={place.value}>
              {translate(place.label)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-caption text-ink-muted">
        {translate(
          'This choice is saved to your account. Each device otherwise remembers its last place.',
        )}
      </p>
      <Button disabled={pending} loading={pending} type="submit">
        {translate('Save starting place')}
      </Button>
      {result?.message ? (
        <p
          aria-live="polite"
          className={`text-caption ${result.ok ? 'text-success' : 'text-danger'}`}
          role="status"
        >
          {translateFeedback(result.message)}
        </p>
      ) : null}
    </form>
  );
}
