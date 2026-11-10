// Show the guard's active visitor workflow and short, touch-friendly actions.
import { Card } from '@/components/ui/data-display';
import {
  VisitorActionForm,
  VisitorCodeControl,
} from '@/components/visitor/action-form';
import { VisitorPhotoUpload } from '@/components/visitor/photo-upload';
import { VisitorRealtimeRefresh } from '@/components/visitor/realtime-refresh';
import { requireIdentifiedGuard } from '@/core/guards/operations';
import {
  listVisitorEntries,
  getVisitorSettings,
  getVisitorRealtimeSocietyId,
  getVisitorSocietyTimezone,
  listVisitorUnits,
} from '@/core/visitor/operations';
import {
  checkInPreApprovedVisitorAction,
  checkOutVisitorAction,
  createVisitorEntryAction,
  overrideVisitorAction,
  validateVisitorCodeAction,
} from './actions';

export const metadata = {
  title: 'Visitors at the gate | Homeish',
  robots: { index: false, follow: false },
};

function unitLabel(unit: { block: string | null; number: string }) {
  return unit.block ? `${unit.block} · ${unit.number}` : unit.number;
}

export default async function GuardVisitorsPage() {
  const [guard, units, waiting, inside, today, settings, societyId, timezone] =
    await Promise.all([
      requireIdentifiedGuard(),
      listVisitorUnits(),
      listVisitorEntries('waiting'),
      listVisitorEntries('inside'),
      listVisitorEntries('today'),
      getVisitorSettings(),
      getVisitorRealtimeSocietyId(),
      getVisitorSocietyTimezone(),
    ]);
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
          Gate · Handled by {guard.name}
        </p>
        <h1 className="text-title font-semibold">Visitors</h1>
      </header>
      <VisitorRealtimeRefresh societyId={societyId} />

      <Card
        description="Send a request to the unit's active approvers."
        title="New visitor"
      >
        {units.length === 0 ? (
          <p className="text-body text-ink-muted">
            No active units are available.
          </p>
        ) : (
          <VisitorActionForm
            action={createVisitorEntryAction}
            className="grid gap-space-3"
            requestIdStorageKey={`homeish:visitor-entry:${societyId}`}
          >
            <input name="clientRequestId" type="hidden" value="" />
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="visitor-unit"
            >
              Unit
              <select
                className="min-h-12 rounded-md border border-rule bg-surface px-space-3"
                id="visitor-unit"
                name="unitId"
                required
              >
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unitLabel(unit)}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="visitor-name"
            >
              Visitor name
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="visitor-name"
                maxLength={120}
                name="visitorName"
                required
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="visitor-phone"
            >
              Mobile number (optional)
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="visitor-phone"
                inputMode="tel"
                name="visitorPhone"
                type="tel"
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="visitor-purpose"
            >
              Purpose
              <select
                className="min-h-12 rounded-md border border-rule bg-surface px-space-3"
                id="visitor-purpose"
                name="purpose"
                required
              >
                <option value="guest">Guest</option>
                <option value="cab">Cab</option>
                <option value="service">Service</option>
                <option value="official">Official</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="visitor-people-count"
            >
              Number of people
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                defaultValue={1}
                id="visitor-people-count"
                max={50}
                min={1}
                name="peopleCount"
                type="number"
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="visitor-vehicle"
            >
              Vehicle number (optional)
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="visitor-vehicle"
                maxLength={20}
                name="vehicleNo"
              />
            </label>
            <VisitorPhotoUpload
              required={settings.photo_required}
              unitSelectId="visitor-unit"
            />
            <button
              className="min-h-14 rounded-md bg-brand px-space-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-focus"
              type="submit"
            >
              Notify resident
            </button>
          </VisitorActionForm>
        )}
      </Card>

      <Card
        description="Waiting requests update on refresh."
        title="Waiting for response"
      >
        {waiting.length ? (
          <ul className="grid gap-space-3">
            {waiting.map((entry) => (
              <li
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
                key={entry.id}
              >
                <p className="text-body-strong">{entry.visitor_name}</p>
                <p className="text-caption text-ink-muted">
                  {entry.purpose} · {entry.people_count} people
                  {entry.is_blacklisted ? ' · Blacklist warning' : ''}
                </p>
                {entry.respond_by ? (
                  <p className="text-caption text-ink-muted">
                    Respond by{' '}
                    <time dateTime={entry.respond_by}>
                      {new Date(entry.respond_by).toLocaleTimeString(
                        undefined,
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: timezone,
                        },
                      )}
                    </time>
                  </p>
                ) : null}
                {settings.guard_override_allowed ? (
                  <VisitorActionForm
                    action={overrideVisitorAction}
                    className="grid gap-space-2"
                  >
                    <input name="entryId" type="hidden" value={entry.id} />
                    <label
                      className="grid gap-space-1 text-caption"
                      htmlFor={`override-${entry.id}`}
                    >
                      Allow by guard (reason required)
                      <input
                        className="min-h-11 rounded-md border border-rule px-space-3"
                        id={`override-${entry.id}`}
                        maxLength={500}
                        name="reason"
                        required
                      />
                    </label>
                    <button
                      className="min-h-12 rounded-md border border-rule-strong px-space-3 font-semibold text-ink"
                      type="submit"
                    >
                      Allow by guard
                    </button>
                  </VisitorActionForm>
                ) : (
                  <p className="text-caption text-ink-muted">
                    Guard approval is disabled for this society.
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">No visitors are waiting.</p>
        )}
      </Card>

      <Card description="Check out visitors as they leave." title="Inside now">
        {inside.length ? (
          <ul className="grid gap-space-3">
            {inside.map((entry) => (
              <li
                className="flex flex-wrap items-center justify-between gap-space-3 rounded-md border border-rule p-space-3"
                key={entry.id}
              >
                <div>
                  <p className="text-body-strong">{entry.visitor_name}</p>
                  <p className="text-caption text-ink-muted">
                    {entry.is_overstay
                      ? 'Still inside · Overstay'
                      : 'Still inside'}
                  </p>
                </div>
                <VisitorActionForm action={checkOutVisitorAction}>
                  <input name="entryId" type="hidden" value={entry.id} />
                  <button
                    className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold"
                    type="submit"
                  >
                    Check out
                  </button>
                </VisitorActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">No visitors are inside.</p>
        )}
      </Card>

      <Card description="Entries handled at this gate today." title="Today">
        {today.length ? (
          <ol className="grid gap-space-2">
            {today.map((entry) => (
              <li
                className="rounded-md border border-rule p-space-3"
                key={entry.id}
              >
                <p className="text-body-strong">{entry.visitor_name}</p>
                <p className="text-caption text-ink-muted">
                  {entry.purpose} · {entry.status}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-ink-muted">No visitor entries today.</p>
        )}
      </Card>

      <Card
        description="Enter a 6-digit code from the resident's QR or message."
        title="Validate pre-approved code"
      >
        <VisitorCodeControl
          checkInAction={checkInPreApprovedVisitorAction}
          validateAction={validateVisitorCodeAction}
        />
      </Card>
    </section>
  );
}
