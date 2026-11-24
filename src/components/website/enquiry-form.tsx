// Render the public P57 enquiry form with retained errors and an announced result.
'use client';

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { submitWebsiteEnquiryAction } from '@/app/website-actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';

export function WebsiteEnquiryForm({
  submitAction = submitWebsiteEnquiryAction,
}: {
  submitAction?: (formData: FormData) => Promise<ServerActionResult>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<ServerActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setResult(null);
    startTransition(async () => {
      const next = await submitAction(formData);
      setResult(next);
      if (next.ok) formRef.current?.reset();
    });
  }

  return (
    <form className="grid gap-space-4" onSubmit={submit} ref={formRef}>
      <div className="grid gap-space-4 medium:grid-cols-2">
        <TextInput
          autoComplete="name"
          id="enquiry-full-name"
          label="Your name (required)"
          maxLength={120}
          name="fullName"
          required
        />
        <TextInput
          autoComplete="organization"
          id="enquiry-society"
          label="Society name"
          maxLength={160}
          name="societyName"
        />
        <TextInput
          autoComplete="address-level2"
          id="enquiry-city"
          label="City"
          maxLength={120}
          name="city"
        />
        <TextInput
          id="enquiry-flat-count"
          inputMode="numeric"
          label="Number of flats"
          max={100000}
          min={1}
          name="flatCount"
          type="number"
        />
        <TextInput
          autoComplete="email"
          id="enquiry-email"
          label="Email"
          maxLength={254}
          name="email"
          type="email"
        />
        <TextInput
          autoComplete="tel"
          id="enquiry-phone"
          label="Phone"
          maxLength={16}
          name="phone"
          pattern="^\+?[0-9]{10,15}$"
          type="tel"
        />
      </div>
      <TextAreaInput
        id="enquiry-message"
        label="What would you like to discuss?"
        maxLength={2000}
        name="message"
        rows={5}
      />
      <div
        aria-hidden="true"
        className="absolute left-[-10000px] h-px w-px overflow-hidden"
      >
        <label htmlFor="enquiry-company">Company website</label>
        <input
          autoComplete="off"
          id="enquiry-company"
          name="company"
          tabIndex={-1}
        />
      </div>
      <p className="text-caption text-ink-muted">
        We collect these details only to reply to your enquiry. The Homeish
        developer can view them until they delete the enquiry.{' '}
        <Link className="underline" href="/privacy">
          Read the privacy policy
        </Link>
        .
      </p>
      <Button disabled={pending} loading={pending} type="submit">
        Send enquiry
      </Button>
      {result ? (
        <div
          aria-live="polite"
          className={`rounded-md border p-space-4 text-body ${
            result.ok
              ? 'border-success text-success'
              : 'border-danger text-danger'
          }`}
          role="status"
        >
          <p>{result.message}</p>
          {!result.ok && result.fieldErrors ? (
            <ul className="mt-space-2 list-inside list-disc text-caption">
              {Object.values(result.fieldErrors).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
          {!result.ok && result.retryAfterSeconds ? (
            <p className="mt-space-2 text-caption">
              Retry after {result.retryAfterSeconds} seconds.
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
