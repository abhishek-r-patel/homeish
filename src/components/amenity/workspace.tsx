// Show local-date availability with anonymous occupied slots and private household bookings.
import { Card } from '@/components/ui/data-display';
import {
  AmenityForm,
  AmenityBookingForm,
  AmenityCancellationForm,
} from './controls';
import { getAmenityWorkspace } from '@/core/amenity/operations';
import { formatBillingTimestamp, formatRupees } from '@/core/billing/format';
export async function AmenityWorkspace({ date }: { date?: string }) {
  const w = await getAmenityWorkspace(date);
  return (
    <section className="grid min-w-0 gap-space-5 [overflow-wrap:anywhere]">
      <h1 className="text-title font-semibold">Amenity booking</h1>
      <p>
        One exclusive reservation per slot. Book at least 24 hours ahead; no
        maximum booking horizon or daily unit limit. All times use {w.timezone}.
      </p>
      <form method="get" className="grid min-w-0 gap-space-2">
        <label htmlFor="amenity-date">Booking date</label>
        <input
          className="min-h-12 w-full min-w-0 rounded-md border border-rule px-space-3"
          id="amenity-date"
          name="date"
          type="date"
          required
          defaultValue={w.date}
        />
        <button
          type="submit"
          className="min-h-12 rounded-md border border-rule"
        >
          Show availability and bookings
        </button>
      </form>
      {w.can_manage ? (
        <Card title="Add amenity">
          <AmenityForm />
        </Card>
      ) : null}
      {!w.billing_enabled ? (
        <p>
          Billing is disabled. Only free slots can be booked; cancellations
          still credit existing paid bookings.
        </p>
      ) : null}
      {w.amenities.map((a) => (
        <Card key={a.id} title={a.name}>
          <div className="grid min-w-0 gap-space-3">
            <p>
              Maximum guests: {a.capacity} · Fee: {formatRupees(a.fee_paise)}
              {!a.active ? ' · Inactive' : ''}
            </p>
            {w.can_manage ? (
              <details>
                <summary className="cursor-pointer">
                  Edit amenity and recurring slots
                </summary>
                <AmenityForm
                  key={a.updated_at}
                  amenity={a}
                  slots={w.slots.filter((s) => s.amenity_id === a.id)}
                />
              </details>
            ) : null}
            {w.occurrences
              .filter((o) => o.amenity_id === a.id)
              .map((o) => (
                <div
                  key={o.slot_id}
                  className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
                >
                  <p>
                    {formatBillingTimestamp(o.starts_at, w.timezone)} to{' '}
                    {formatBillingTimestamp(o.ends_at, w.timezone)}
                  </p>
                  {o.available && w.can_book && w.units.length ? (
                    <AmenityBookingForm
                      key={`${o.slot_id}:${w.date}:${a.updated_at}`}
                      amenity={a}
                      occurrence={o}
                      date={w.date}
                      units={w.units}
                    />
                  ) : (
                    <p>
                      {!w.can_book
                        ? 'Read-only access.'
                        : o.available
                          ? 'Active occupancy is required to book.'
                          : 'Booked or unavailable: check the 24-hour lead and billing status.'}
                    </p>
                  )}
                </div>
              ))}
            {!w.occurrences.some((o) => o.amenity_id === a.id) ? (
              <p>No recurring slots on this date.</p>
            ) : null}
          </div>
        </Card>
      ))}
      <Card title="Bookings for this date">
        {w.bookings.length ? (
          <ul className="grid min-w-0 gap-space-3">
            {w.bookings.map((b) => (
              <li
                key={b.id}
                className="grid min-w-0 gap-space-2 rounded-md border border-rule p-space-3"
              >
                <p className="text-body-strong">
                  {b.amenity_name} · Unit {b.unit_number} · {b.status}
                </p>
                <p>
                  {formatBillingTimestamp(b.starts_at, w.timezone)} to{' '}
                  {formatBillingTimestamp(b.ends_at, w.timezone)} ·{' '}
                  {b.guest_count} guests · Snapshotted fee{' '}
                  {formatRupees(b.fee_paise)}
                </p>
                {b.rules_snapshot ? (
                  <details>
                    <summary>Accepted booking rules</summary>
                    <p className="whitespace-pre-wrap break-words">
                      {b.rules_snapshot}
                    </p>
                  </details>
                ) : null}
                {b.cancel_reason ? <p>{b.cancel_reason}</p> : null}
                {b.can_cancel ? (
                  <AmenityCancellationForm booking={b} admin={w.can_manage} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No accessible bookings on this date. Other units&apos; occupied
            slots remain anonymous.
          </p>
        )}
      </Card>
    </section>
  );
}
