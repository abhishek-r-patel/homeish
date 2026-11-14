// Exercise amenity definition, snapshot booking and full-credit cancellation without database writes.
'use client';
import { useState } from 'react';
import {
  AmenityForm,
  AmenityBookingForm,
  AmenityCancellationForm,
} from '@/components/amenity/controls';
import { Banner } from '@/components/ui/feedback';
import type { ModuleFormAction } from '@/components/ui/module-action-form';
import {
  amenityInputSchema,
  amenityBookingInputSchema,
  amenityCancelInputSchema,
  type Amenity,
  type AmenityBooking,
  type AmenitySlot,
} from '@/core/amenity/validation';
import { rupeesFromPaise } from '@/core/billing/validation';
const id = '9a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const slotId = '7a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const unitId = '6a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const date = '2099-01-05';
function input(data: FormData): unknown {
  const raw = data.get('input');
  if (typeof raw !== 'string')
    throw new Error('Missing amenity fixture input.');
  return JSON.parse(raw);
}
export default function AmenityFixturePage() {
  const [amenity, setAmenity] = useState<Amenity | null>(null);
  const [booking, setBooking] = useState<AmenityBooking | null>(null);
  const [ledger, setLedger] = useState<number[]>([]);
  const [slots, setSlots] = useState<AmenitySlot[]>([]);
  const save: ModuleFormAction = async (data) => {
    const parsed = amenityInputSchema.safeParse(input(data));
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0].message,
      };
    const v = parsed.data;
    setAmenity({
      id,
      name: v.name,
      capacity: v.capacity,
      fee_paise: v.feeRupees,
      rules: v.rules,
      active: v.active,
      updated_at: new Date().toISOString(),
    });
    setSlots(
      v.slots.map((s, i) => ({
        id: i === 0 ? slotId : crypto.randomUUID(),
        amenity_id: id,
        ...s,
      })),
    );
    return { ok: true, message: 'Amenity and recurring slots saved.' };
  };
  const book: ModuleFormAction = async (data) => {
    const parsed = amenityBookingInputSchema.safeParse(input(data));
    if (!parsed.success)
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: parsed.error.issues[0].message,
      };
    if (!amenity) throw new Error('Define an amenity first.');
    if (booking?.status === 'confirmed')
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: 'This exclusive slot is already booked.',
      };
    const v = parsed.data;
    if (v.guestCount > amenity.capacity || (amenity.rules && !v.rulesAccepted))
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: 'Check guests and accept the rules.',
      };
    setBooking({
      id: crypto.randomUUID(),
      amenity_id: id,
      amenity_name: amenity.name,
      unit_number: 'A-101',
      starts_at: `${date}T${slots[0]!.start}:00Z`,
      ends_at: `${date}T${slots[0]!.end}:00Z`,
      guest_count: v.guestCount,
      fee_paise: amenity.fee_paise,
      rules_snapshot: amenity.rules,
      status: 'confirmed',
      cancel_reason: null,
      can_cancel: true,
    });
    if (amenity.fee_paise) setLedger((rows) => [...rows, amenity.fee_paise]);
    return { ok: true, message: 'Booking confirmed.' };
  };
  const cancel: ModuleFormAction = async (data) => {
    const v = amenityCancelInputSchema.parse(input(data));
    if (!booking) throw new Error('Missing booking.');
    if (booking.status !== 'cancelled') {
      if (booking.fee_paise) setLedger((rows) => [...rows, -booking.fee_paise]);
      setBooking({
        ...booking,
        status: 'cancelled',
        cancel_reason: v.reason ?? 'Cancelled by resident',
        can_cancel: false,
      });
    }
    return {
      ok: true,
      message: 'Booking cancelled with a full ledger credit.',
    };
  };
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
      <Banner title="Synthetic amenity fixture" tone="info">
        Development-only simulated actions and ledger. No database writes.
        Reload to reset.
      </Banner>
      <h1 className="text-title font-semibold">Amenity workflows</h1>
      <section
        aria-label="Amenity definition"
        className="grid min-w-0 gap-space-3"
      >
        <h2 className="text-heading font-semibold">Amenity definition</h2>
        <AmenityForm
          key={amenity?.updated_at ?? 'new'}
          amenity={amenity ?? undefined}
          slots={slots}
          action={save}
        />
      </section>
      <p>Ledger entries: {ledger.length}</p>
      <p>
        Ledger balance: Rs.{' '}
        {rupeesFromPaise(ledger.reduce((sum, row) => sum + row, 0))}
      </p>
      {amenity && booking?.status !== 'confirmed' ? (
        <section
          aria-label="Resident booking"
          className="grid min-w-0 gap-space-3"
        >
          <h2 className="text-heading font-semibold">Resident booking</h2>
          <AmenityBookingForm
            key={amenity.updated_at}
            amenity={amenity}
            occurrence={{
              slot_id: slotId,
              amenity_id: id,
              starts_at: `${date}T${slots[0]!.start}:00Z`,
              ends_at: `${date}T${slots[0]!.end}:00Z`,
              available: true,
            }}
            date={date}
            units={[{ id: unitId, number: 'A-101' }]}
            action={book}
          />
        </section>
      ) : null}
      {booking ? (
        <section
          aria-label="Booking snapshot"
          className="grid min-w-0 gap-space-3"
        >
          <h2 className="text-heading font-semibold">Booking snapshot</h2>
          <p>Status: {booking.status}</p>
          <p>Snapshot fee: Rs. {rupeesFromPaise(booking.fee_paise)}</p>
          <p>Accepted rules: {booking.rules_snapshot}</p>
          <p>
            Snapshot time: {booking.starts_at.slice(11, 16)} to{' '}
            {booking.ends_at.slice(11, 16)}
          </p>
          {booking.can_cancel ? (
            <>
              <section aria-label="Resident cancellation">
                <h3 className="text-body-strong">Resident cancellation</h3>
                <AmenityCancellationForm
                  booking={booking}
                  admin={false}
                  action={cancel}
                />
              </section>
              <section aria-label="Administrator cancellation">
                <h3 className="text-body-strong">Administrator cancellation</h3>
                <AmenityCancellationForm
                  booking={booking}
                  admin
                  action={cancel}
                />
              </section>
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
