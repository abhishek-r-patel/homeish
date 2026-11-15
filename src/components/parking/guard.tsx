// Let guards see active visitor passes, look up a slot holder and report wrong parking.
'use client';
import { useId, useState, type FormEvent } from 'react';
import {
  PARKING_PASS_STATE_LABELS,
  PARKING_SLOT_TYPE_LABELS,
  formatParkingWindow,
  parkingPassState,
} from '@/core/parking/presentation';
import type { ParkingGuardBoard } from '@/core/parking/validation';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Card } from '@/components/ui/data-display';
import { TextInput } from '@/components/ui/text-input';
import {
  PARKING_ACTIONS,
  ParkingReportForm,
  type ParkingActions,
} from './shared';

export function ParkingGuardView({
  board,
  baseHref,
  actions = PARKING_ACTIONS,
  fileRequest,
  onSearch,
  now: fixedNow,
}: {
  board: ParkingGuardBoard;
  baseHref: string;
  actions?: ParkingActions;
  fileRequest?: typeof fetch;
  onSearch?: (query: string) => void;
  now?: number;
}) {
  const id = useId();
  const [query, setQuery] = useState(board.query ?? '');
  const [now] = useState(() => fixedNow ?? Date.now());

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!onSearch) return;
    event.preventDefault();
    onSearch(query.trim());
  }

  return (
    <section className="grid min-w-0 gap-space-5">
      <h1 className="text-title font-semibold">Parking</h1>

      <Card
        title="Find a slot holder"
        description="Search by slot label or vehicle number."
      >
        <form
          action={baseHref}
          method="get"
          role="search"
          className="grid gap-space-3 medium:grid-cols-[1fr_auto] medium:items-end"
          onSubmit={submit}
        >
          <TextInput
            id={`${id}-query`}
            name="q"
            label="Slot or vehicle number"
            maxLength={40}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <Button type="submit" size="guard">
            Search
          </Button>
        </form>
        {board.query ? (
          board.matches.length === 0 ? (
            <p role="status" className="mt-space-3 text-body text-ink-muted">
              No slot or vehicle matches “{board.query}”.
            </p>
          ) : (
            <ul className="mt-space-3 grid gap-space-2">
              {board.matches.map((match, index) => (
                <li
                  key={`${match.slot_label ?? 'vehicle'}-${index}`}
                  className="rounded-md border border-rule p-space-3"
                >
                  <p className="text-body-strong">
                    {match.unit_number
                      ? `Unit ${match.unit_number}`
                      : 'Free slot'}
                    {match.slot_label ? ` · Slot ${match.slot_label}` : ''}
                    {match.slot_type
                      ? ` (${PARKING_SLOT_TYPE_LABELS[match.slot_type]})`
                      : ''}
                  </p>
                  {match.vehicle_numbers.length > 0 ? (
                    <p className="text-caption text-ink-muted">
                      Vehicles: {match.vehicle_numbers.join(', ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Card>

      <Card
        title="Visitor passes"
        description="Current passes and those starting in the next 12 hours."
      >
        {!board.visitor_enabled ? (
          <Banner tone="neutral" title="Visitor passes are not available">
            The Visitors module is turned off for this society.
          </Banner>
        ) : board.passes.length === 0 ? (
          <p className="text-body text-ink-muted">
            No visitor passes right now.
          </p>
        ) : (
          <ul className="grid gap-space-2">
            {board.passes.map((pass) => (
              <li
                key={pass.id}
                className="grid gap-space-1 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  Slot {pass.slot_label} · {pass.visitor_name}
                  {pass.vehicle_number ? ` · ${pass.vehicle_number}` : ''}
                </p>
                <p className="text-caption text-ink-muted">
                  For unit {pass.unit_number} ·{' '}
                  {PARKING_PASS_STATE_LABELS[parkingPassState(pass, now)]} ·{' '}
                  {formatParkingWindow(pass.starts_at, pass.ends_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Report wrong parking"
        description="The unit that holds the slot or owns the vehicle, and the administrators, are told."
      >
        <ParkingReportForm
          slots={board.slots}
          action={actions.createReport}
          request={fileRequest}
        />
      </Card>
    </section>
  );
}
