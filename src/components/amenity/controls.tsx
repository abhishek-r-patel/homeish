// Render recurring weekday schedules, explicit rules acknowledgements and cancellation controls.
'use client';
import { useId, useState } from 'react';
import { TextInput } from '@/components/ui/text-input';
import { Button } from '@/components/ui/button';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import {
  saveAmenityAction,
  bookAmenityAction,
  cancelAmenityAction,
} from '@/app/(resident)/amenities/actions';
import { rupeesFromPaise } from '@/core/billing/validation';
import type {
  Amenity,
  AmenitySlot,
  AmenityOccurrence,
  AmenityBooking,
} from '@/core/amenity/validation';
const control =
  'min-h-12 w-full min-w-0 rounded-md border border-rule px-space-3';
const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export function AmenityForm({
  amenity,
  slots = [],
  action = saveAmenityAction,
}: {
  amenity?: Amenity;
  slots?: AmenitySlot[];
  action?: ModuleFormAction;
}) {
  const prefix = useId();
  const [rows, setRows] = useState(() =>
    slots.length
      ? slots.map((s, i) => ({
          key: i,
          weekday: s.weekday,
          start: s.start,
          end: s.end,
        }))
      : [{ key: 0, weekday: 1, start: '09:00', end: '10:00' }],
  );
  const [next, setNext] = useState(rows.length);
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={amenity ? 'Save amenity' : 'Add amenity'}
      input={(data) => ({
        amenityId: amenity?.id ?? null,
        expectedUpdatedAt: amenity?.updated_at ?? null,
        name: data.get('name'),
        capacity: Number(data.get('capacity')),
        feeRupees: data.get('feeRupees'),
        rules: data.get('rules'),
        active: data.get('active') === 'on',
        slots: rows.map((r) => ({
          weekday: Number(data.get(`day-${r.key}`)),
          start: data.get(`start-${r.key}`),
          end: data.get(`end-${r.key}`),
        })),
      })}
    >
      <TextInput
        id={`${prefix}-name`}
        label="Amenity name"
        name="name"
        required
        maxLength={120}
        defaultValue={amenity?.name ?? ''}
      />
      <TextInput
        id={`${prefix}-capacity`}
        label="Maximum guests per booking"
        name="capacity"
        type="number"
        min={1}
        max={10000}
        required
        defaultValue={amenity?.capacity ?? 1}
      />
      <TextInput
        id={`${prefix}-fee`}
        label="Fee per booking in rupees (0 for free)"
        name="feeRupees"
        required
        inputMode="decimal"
        defaultValue={rupeesFromPaise(amenity?.fee_paise ?? 0)}
      />
      <div className="grid min-w-0 gap-space-2">
        <label htmlFor={`${prefix}-rules`}>Amenity rules</label>
        <textarea
          id={`${prefix}-rules`}
          name="rules"
          maxLength={5000}
          className={`${control} min-h-24`}
          defaultValue={amenity?.rules ?? ''}
        />
      </div>
      <label className="flex min-h-12 items-center gap-space-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked={amenity?.active ?? true}
        />
        Active amenity
      </label>
      <h3 className="text-body-strong">Recurring weekday slots</h3>
      {rows.map((r, i) => (
        <fieldset
          key={r.key}
          className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
        >
          <legend>Slot {i + 1}</legend>
          <label
            htmlFor={`${prefix}-day-${r.key}`}
            className="grid min-w-0 gap-space-1"
          >
            Weekday
            <select
              id={`${prefix}-day-${r.key}`}
              name={`day-${r.key}`}
              className={control}
              defaultValue={r.weekday}
            >
              {weekdays.map((day, n) => (
                <option key={day} value={n}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <TextInput
            id={`${prefix}-start-${r.key}`}
            label="Slot start (society local time)"
            name={`start-${r.key}`}
            type="time"
            required
            defaultValue={r.start}
          />
          <TextInput
            id={`${prefix}-end-${r.key}`}
            label="Slot end (society local time)"
            name={`end-${r.key}`}
            type="time"
            required
            defaultValue={r.end}
          />
          {rows.length > 1 ? (
            <Button
              type="button"
              onClick={() => setRows(rows.filter((row) => row.key !== r.key))}
            >
              Remove slot {i + 1}
            </Button>
          ) : null}
        </fieldset>
      ))}
      <Button
        type="button"
        disabled={rows.length >= 100}
        onClick={() => {
          setRows([
            ...rows,
            { key: next, weekday: 1, start: '09:00', end: '10:00' },
          ]);
          setNext(next + 1);
        }}
      >
        Add recurring slot
      </Button>
      <p className="text-caption text-ink-muted">
        Bookings are exclusive. Slots cannot overlap on the same weekday.
        Schedule edits never change existing booking times, fees or rules.
      </p>
    </ModuleActionForm>
  );
}
export function AmenityBookingForm({
  amenity,
  occurrence,
  date,
  units,
  action = bookAmenityAction,
}: {
  amenity: Amenity;
  occurrence: AmenityOccurrence;
  date: string;
  units: { id: string; number: string }[];
  action?: ModuleFormAction;
}) {
  const prefix = useId();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel="Confirm exclusive booking"
      input={(data) => ({
        amenityId: amenity.id,
        slotId: occurrence.slot_id,
        date,
        unitId: data.get('unitId'),
        guestCount: Number(data.get('guestCount')),
        rulesAccepted: data.get('rulesAccepted') === 'on',
        expectedUpdatedAt: amenity.updated_at,
      })}
    >
      <label htmlFor={`${prefix}-unit`} className="grid min-w-0 gap-space-1">
        Occupied unit
        <select
          id={`${prefix}-unit`}
          name="unitId"
          className={control}
          required
        >
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.number}
            </option>
          ))}
        </select>
      </label>
      <TextInput
        id={`${prefix}-guests`}
        label="Guest count"
        name="guestCount"
        type="number"
        min={1}
        max={amenity.capacity}
        required
        defaultValue={1}
      />
      {amenity.rules ? (
        <>
          <p className="whitespace-pre-wrap break-words text-body">
            {amenity.rules}
          </p>
          <label className="flex min-h-12 items-center gap-space-2">
            <input type="checkbox" name="rulesAccepted" required />I acknowledge
            the current amenity rules
          </label>
        </>
      ) : null}
      <p className="text-caption text-ink-muted">
        Fee: Rs. {rupeesFromPaise(amenity.fee_paise)}. Confirmed immediately;
        any fee is charged to your unit ledger. Cancel before the slot starts
        for a full ledger credit.
      </p>
    </ModuleActionForm>
  );
}
export function AmenityCancellationForm({
  booking,
  admin,
  action = cancelAmenityAction,
}: {
  booking: AmenityBooking;
  admin: boolean;
  action?: ModuleFormAction;
}) {
  const id = useId();
  return (
    <ModuleActionForm
      action={action}
      submitLabel="Cancel booking"
      confirmMessage="Cancel this booking and credit any fee to the unit ledger?"
      input={(data) => ({
        bookingId: booking.id,
        reason: admin ? data.get('reason') : null,
      })}
    >
      {admin ? (
        <TextInput
          id={id}
          label="Administrator cancellation reason"
          name="reason"
          required
          maxLength={500}
        />
      ) : null}
    </ModuleActionForm>
  );
}
