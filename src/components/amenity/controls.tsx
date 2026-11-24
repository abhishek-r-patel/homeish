// Render recurring weekday schedules, explicit rules acknowledgements and cancellation controls.
'use client';
import { useId, useState } from 'react';
import { useOptionalLanguage } from '@/components/language-context';
import { TextInput } from '@/components/ui/text-input';
import { Button } from '@/components/ui/button';
import { createComponentTranslator } from '@/core/i18n/catalogs/hi-components';
import {
  formatLocalizedCurrency,
  formatLocalizedNumber,
} from '@/core/i18n/format';
import { formatRupees } from '@/core/billing/format';
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

function useAmenityCopy() {
  const language = useOptionalLanguage();
  const locale = language?.locale ?? 'en';
  return {
    locale,
    t: createComponentTranslator(
      locale,
      language?.translate ?? ((source) => source),
    ),
  };
}

function amenityFee(paise: number, locale: 'en' | 'hi') {
  return locale === 'hi'
    ? formatLocalizedCurrency(paise, locale)
    : formatRupees(paise);
}

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
  const { locale, t } = useAmenityCopy();
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
      submitLabel={t(amenity ? 'Save amenity' : 'Add amenity')}
      input={(data) => ({
        amenityId: amenity?.id ?? null,
        expectedUpdatedAt: amenity?.updated_at ?? null,
        name: data.get('name'),
        capacity: Number(data.get('capacity')),
        feeRupees: data.get('feeRupees'),
        depositRupees: data.get('depositRupees') || '0',
        depositRequired: data.get('depositRequired') === 'on',
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
        label={t('Amenity name')}
        name="name"
        required
        maxLength={120}
        defaultValue={amenity?.name ?? ''}
      />
      <TextInput
        id={`${prefix}-capacity`}
        label={t('Maximum guests per booking')}
        name="capacity"
        type="number"
        min={1}
        max={10000}
        required
        defaultValue={amenity?.capacity ?? 1}
      />
      <TextInput
        id={`${prefix}-fee`}
        label={t('Fee per booking in rupees (0 for free)')}
        name="feeRupees"
        required
        inputMode="decimal"
        defaultValue={rupeesFromPaise(amenity?.fee_paise ?? 0)}
      />
      <TextInput
        id={`${prefix}-deposit`}
        label={t('Refundable deposit in rupees (0 to turn off)')}
        name="depositRupees"
        inputMode="decimal"
        defaultValue={rupeesFromPaise(amenity?.deposit_paise ?? 0)}
      />
      <label className="flex min-h-12 items-center gap-space-2">
        <input
          defaultChecked={
            amenity?.deposit_required_before_confirmation ?? false
          }
          name="depositRequired"
          type="checkbox"
        />
        {t('Require the full deposit before confirmation')}
      </label>
      <div className="grid min-w-0 gap-space-2">
        <label htmlFor={`${prefix}-rules`}>{t('Amenity rules')}</label>
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
        {t('Active amenity')}
      </label>
      <h3 className="text-body-strong">{t('Recurring weekday slots')}</h3>
      {rows.map((r, i) => (
        <fieldset
          key={r.key}
          className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
        >
          <legend>
            {t('Slot {number}', {
              number: formatLocalizedNumber(i + 1, locale),
            })}
          </legend>
          <label
            htmlFor={`${prefix}-day-${r.key}`}
            className="grid min-w-0 gap-space-1"
          >
            {t('Weekday')}
            <select
              id={`${prefix}-day-${r.key}`}
              name={`day-${r.key}`}
              className={control}
              defaultValue={r.weekday}
            >
              {weekdays.map((day, n) => (
                <option key={day} value={n}>
                  {t(day)}
                </option>
              ))}
            </select>
          </label>
          <TextInput
            id={`${prefix}-start-${r.key}`}
            label={t('Slot start (society local time)')}
            name={`start-${r.key}`}
            type="time"
            required
            defaultValue={r.start}
          />
          <TextInput
            id={`${prefix}-end-${r.key}`}
            label={t('Slot end (society local time)')}
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
              {t('Remove slot {number}', {
                number: formatLocalizedNumber(i + 1, locale),
              })}
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
        {t('Add recurring slot')}
      </Button>
      <p className="text-caption text-ink-muted">
        {t(
          'Bookings are exclusive. Slots cannot overlap on the same weekday. Schedule edits never change existing booking times, fees or rules.',
        )}
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
  const { locale, t } = useAmenityCopy();
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Confirm exclusive booking')}
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
        {t('Occupied unit')}
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
        label={t('Guest count')}
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
            <input type="checkbox" name="rulesAccepted" required />
            {t('I acknowledge the current amenity rules')}
          </label>
        </>
      ) : null}
      <p className="text-caption text-ink-muted">
        {t(
          'Usage fee: {fee}. Deposit: {deposit}. A required deposit keeps the slot reserved until the administrator records the full amount; usage fees are charged only on confirmation.',
          {
            fee: amenityFee(amenity.fee_paise, locale),
            deposit: amenityFee(amenity.deposit_paise ?? 0, locale),
          },
        )}
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
  const { t } = useAmenityCopy();
  return (
    <ModuleActionForm
      action={action}
      submitLabel={t('Cancel booking')}
      confirmMessage={t(
        'Cancel this booking and credit any fee to the unit ledger?',
      )}
      input={(data) => ({
        bookingId: booking.id,
        reason: admin ? data.get('reason') : null,
      })}
    >
      {admin ? (
        <TextInput
          id={id}
          label={t('Administrator cancellation reason')}
          name="reason"
          required
          maxLength={500}
        />
      ) : null}
    </ModuleActionForm>
  );
}
