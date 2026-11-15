// Return only verified vehicle type and unit for a guard's plate lookup.
'use client';

import { useState, useTransition } from 'react';
import { lookupDirectoryVehicleAction } from '../../app/directory/actions';
import type { ServerActionResult } from '../../core/actions/server-action';
import type { DirectoryGuardVehicle } from '../../core/directory/validation';
import { Button } from '../ui/button';
import { Card } from '../ui/data-display';
import { ErrorPanel } from '../ui/feedback';
import { TextInput } from '../ui/text-input';

export function GuardVehicleLookup({
  action = lookupDirectoryVehicleAction,
}: {
  action?: typeof lookupDirectoryVehicleAction;
}) {
  const [result, setResult] = useState<ServerActionResult<
    DirectoryGuardVehicle[]
  > | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Vehicle lookup</h1>
        <p className="text-body text-ink-muted">
          Search a registration number to confirm its registered vehicle type
          and unit. Only verified active vehicles are shown.
        </p>
      </header>
      <Card title="Find a registered vehicle">
        <form
          className="grid gap-space-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (pending) return;
            const formData = new FormData(event.currentTarget);
            setResult(null);
            startTransition(async () => {
              setResult(await action(formData));
            });
          }}
        >
          <TextInput
            disabled={pending}
            onChange={() => setResult(null)}
            autoComplete="off"
            autoCapitalize="characters"
            id="vehicle-registration-lookup"
            label="Vehicle registration number"
            maxLength={32}
            name="registrationNumber"
            placeholder="For example, MH 01 AB 1234"
            required
          />
          <Button disabled={pending} loading={pending} type="submit">
            Look up vehicle
          </Button>
        </form>
        {result && !result.ok ? (
          <ErrorPanel
            message={result.message}
            referenceId={result.referenceId}
            title="Vehicle lookup failed"
          />
        ) : null}
        {result?.ok && !result.data ? (
          <ErrorPanel
            message="The vehicle lookup returned an invalid response."
            title="Vehicle lookup failed"
          />
        ) : null}
        {result?.ok && result.data?.length ? (
          <ul className="grid gap-space-3" role="status">
            {result.data.map((vehicle, index) => (
              <li
                className="rounded-md border border-success bg-success-tint p-space-4"
                key={`${vehicle.unit_number}-${vehicle.vehicle_type}-${index}`}
              >
                <p className="text-body-strong">Verified vehicle found</p>
                <p className="text-caption">
                  {vehicle.vehicle_type} · Unit {vehicle.unit_number}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        {result?.ok && result.data?.length === 0 ? (
          <p
            aria-live="polite"
            className="text-body text-ink-muted"
            role="status"
          >
            No verified active vehicle matched that registration.
          </p>
        ) : null}
      </Card>
    </section>
  );
}
