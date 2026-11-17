// Let guards see active visitor passes, look up a slot holder and report wrong parking.
'use client';
import { useId, useState, type FormEvent } from 'react';
import {
  PARKING_PASS_STATE_LABELS,
  PARKING_SLOT_TYPE_LABELS,
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
  parkingDisplayTime,
  useParkingCopy,
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
  const { locale, t } = useParkingCopy();
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
      <h1 className="text-title font-semibold">{t('Parking')}</h1>

      <Card
        title={t('Find a slot holder')}
        description={t('Search by slot label or vehicle number.')}
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
            label={t('Slot or vehicle number')}
            maxLength={40}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <Button type="submit" size="guard">
            {t('Search')}
          </Button>
        </form>
        {board.query ? (
          board.matches.length === 0 ? (
            <p role="status" className="mt-space-3 text-body text-ink-muted">
              {t('No slot or vehicle matches “{query}”.', {
                query: board.query,
              })}
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
                      ? t('Unit {unit}', { unit: match.unit_number })
                      : t('Free slot')}
                    {match.slot_label
                      ? ` · ${t('Slot {label}', { label: match.slot_label })}`
                      : ''}
                    {match.slot_type
                      ? ` (${t(PARKING_SLOT_TYPE_LABELS[match.slot_type])})`
                      : ''}
                  </p>
                  {match.vehicle_numbers.length > 0 ? (
                    <p className="text-caption text-ink-muted">
                      {t('Vehicles:')} {match.vehicle_numbers.join(', ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Card>

      <Card
        title={t('Visitor passes')}
        description={t(
          'Current passes and those starting in the next 12 hours.',
        )}
      >
        {!board.visitor_enabled ? (
          <Banner tone="neutral" title={t('Visitor passes are not available')}>
            {t('The Visitors module is turned off for this society.')}
          </Banner>
        ) : board.passes.length === 0 ? (
          <p className="text-body text-ink-muted">
            {t('No visitor passes right now.')}
          </p>
        ) : (
          <ul className="grid gap-space-2">
            {board.passes.map((pass) => (
              <li
                key={pass.id}
                className="grid gap-space-1 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {t('Slot {label} · {name}', {
                    label: pass.slot_label,
                    name: pass.visitor_name,
                  })}
                  {pass.vehicle_number ? ` · ${pass.vehicle_number}` : ''}
                </p>
                <p className="text-caption text-ink-muted">
                  {t('For unit {unit}', { unit: pass.unit_number })} ·{' '}
                  {t(PARKING_PASS_STATE_LABELS[parkingPassState(pass, now)])} ·{' '}
                  {parkingDisplayTime(pass.starts_at, locale)} –{' '}
                  {parkingDisplayTime(pass.ends_at, locale)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={t('Report wrong parking')}
        description={t(
          'The unit that holds the slot or owns the vehicle, and the administrators, are told.',
        )}
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
