// Accessible forms for gate settings and the guard roster.
'use client';

import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import {
  addGuardAction,
  setGuardPinAction,
  updateGateSettingsAction,
  updateGuardAction,
} from '@/app/(admin)/guards/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import type { GuardRosterItem } from '@/core/guards/operations';
import { Banner } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';

type Props = {
  canManage: boolean;
  gateLoginMode: 'individual' | 'shared';
  guardIdentification: 'pick_name' | 'pin';
  guards: readonly GuardRosterItem[];
  memberships: readonly { id: string; label: string }[];
};

function ActionMessage({
  state,
}: {
  state: ServerActionResult<unknown> | null;
}) {
  if (!state) return null;
  return (
    <Banner tone={state.ok ? 'success' : 'danger'}>
      <p>{state.message}</p>
      {!state.ok && state.referenceId ? (
        <p className="mt-space-2 text-caption">
          Reference ID: <code>{state.referenceId}</code>
        </p>
      ) : null}
      {!state.ok && state.fieldErrors ? (
        <ul className="mt-space-2 list-inside list-disc text-caption">
          {Object.entries(state.fieldErrors).map(([field, message]) => (
            <li key={field}>{`${field}: ${message}`}</li>
          ))}
        </ul>
      ) : null}
    </Banner>
  );
}

function useAction<
  T extends (formData: FormData) => Promise<ServerActionResult<unknown>>,
>(action: T) {
  const [state, setState] = useState<ServerActionResult<unknown> | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => setState(await action(formData)));
  }
  return { pending, state, submit };
}

function GateSettings({
  mode,
  identification,
  canManage,
}: {
  mode: Props['gateLoginMode'];
  identification: Props['guardIdentification'];
  canManage: boolean;
}) {
  const { pending, state, submit } = useAction(updateGateSettingsAction);
  return (
    <section className="grid gap-space-3 rounded-lg border border-rule bg-surface p-space-4">
      <h2 className="text-title font-semibold">Gate sign-in</h2>
      <ActionMessage state={state} />
      <form className="grid gap-space-3" onSubmit={submit}>
        <label className="grid gap-space-1 text-body-strong">
          Gate account mode
          <select
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body"
            defaultValue={mode}
            disabled={!canManage || mode === 'individual' || pending}
            name="gateLoginMode"
          >
            <option value="individual">Each guard has an account</option>
            <option value="shared">Guards share a gate account</option>
          </select>
        </label>
        <label className="grid gap-space-1 text-body-strong">
          Identify the guard by
          <select
            className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body"
            defaultValue={identification}
            disabled={!canManage || pending}
            name="guardIdentification"
          >
            <option value="pick_name">Picking a name</option>
            <option value="pin">Personal PIN</option>
          </select>
        </label>
        {mode === 'individual' ? (
          <input
            name="guardIdentification"
            type="hidden"
            value={identification}
          />
        ) : null}
        {canManage ? (
          <Button disabled={pending} type="submit">
            Save gate settings
          </Button>
        ) : null}
      </form>
    </section>
  );
}

function AddGuard({
  mode,
  memberships,
  canManage,
}: {
  mode: Props['gateLoginMode'];
  memberships: Props['memberships'];
  canManage: boolean;
}) {
  const { pending, state, submit } = useAction(addGuardAction);
  if (!canManage) return null;
  return (
    <section className="grid gap-space-3 rounded-lg border border-rule bg-surface p-space-4">
      <h2 className="text-title font-semibold">Add a guard</h2>
      <ActionMessage state={state} />
      <form className="grid gap-space-3" onSubmit={submit}>
        <TextInput
          autoComplete="off"
          id="new-guard-name"
          label="Guard name"
          name="name"
          required
        />
        {mode === 'individual' ? (
          <label className="grid gap-space-1 text-body-strong">
            Guard account
            <select
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body"
              name="membershipId"
              required
            >
              <option value="">Choose an active guard account</option>
              {memberships.map((membership) => (
                <option key={membership.id} value={membership.id}>
                  {membership.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button disabled={pending} type="submit">
          Add guard
        </Button>
      </form>
    </section>
  );
}

function GuardRow({
  guard,
  canManage,
  mode,
  identification,
}: {
  guard: GuardRosterItem;
  canManage: boolean;
  mode: Props['gateLoginMode'];
  identification: Props['guardIdentification'];
}) {
  const [state, setState] = useState<ServerActionResult<unknown> | null>(null);
  const [pinState, setPinState] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [pinPending, startPinTransition] = useTransition();

  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => setState(await updateGuardAction(formData)));
  }

  function setPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startPinTransition(async () => {
      const result = await setGuardPinAction(formData);
      setPinState(result);
      if (result.ok) form.reset();
    });
  }

  return (
    <li className="grid gap-space-3 rounded-lg border border-rule bg-surface p-space-4">
      <ActionMessage state={state} />
      <form className="grid gap-space-3" onSubmit={update}>
        <input name="guardId" type="hidden" value={guard.id} />
        <TextInput
          defaultValue={guard.name}
          id={`guard-name-${guard.id}`}
          label="Guard name"
          name="name"
          readOnly={!canManage}
          required
        />
        <label className="flex min-h-12 items-center gap-space-2 text-body">
          <input
            defaultChecked={guard.active}
            disabled={!canManage || pending}
            name="active"
            type="checkbox"
          />
          Active
        </label>
        {canManage ? (
          <Button disabled={pending} type="submit" variant="secondary">
            Save guard
          </Button>
        ) : null}
      </form>
      {canManage && mode === 'shared' && identification === 'pin' ? (
        <form
          className="grid gap-space-2 border-t border-rule pt-space-3"
          onSubmit={setPin}
        >
          <input name="guardId" type="hidden" value={guard.id} />
          <ActionMessage state={pinState} />
          <TextInput
            autoComplete="new-password"
            id={`guard-pin-${guard.id}`}
            inputMode="numeric"
            label="Set or reset PIN (4–6 digits)"
            maxLength={6}
            name="pin"
            pattern="[0-9]{4,6}"
            required
            type="password"
          />
          <Button disabled={pinPending} type="submit" variant="secondary">
            Save PIN
          </Button>
        </form>
      ) : null}
    </li>
  );
}

export function GuardSettingsControls(props: Props) {
  return (
    <div className="grid gap-space-5">
      <GateSettings
        canManage={props.canManage}
        identification={props.guardIdentification}
        mode={props.gateLoginMode}
      />
      <AddGuard
        canManage={props.canManage}
        memberships={props.memberships}
        mode={props.gateLoginMode}
      />
      <section className="grid gap-space-3" aria-labelledby="roster-heading">
        <h2 id="roster-heading" className="text-title font-semibold">
          Guard roster
        </h2>
        {props.guards.length > 0 ? (
          <ul className="grid gap-space-3">
            {props.guards.map((guard) => (
              <GuardRow
                canManage={props.canManage}
                guard={guard}
                identification={props.guardIdentification}
                key={guard.id}
                mode={props.gateLoginMode}
              />
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            No guards have been added to this society.
          </p>
        )}
      </section>
    </div>
  );
}
