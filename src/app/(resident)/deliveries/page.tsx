// Show unit delivery preferences, expected deliveries, pending decisions and history.
import { Card } from '@/components/ui/data-display';
import { DeliveryActionForm } from '@/components/delivery/action-form';
import { DeliveryRealtimeRefresh } from '@/components/delivery/realtime-refresh';
import {
  getDeliveryPreference,
  getDeliveryRealtimeSocietyId,
  getDeliverySettings,
  getDeliverySocietyTimezone,
  listDeliveryEntries,
  listDeliveryPreAnnouncements,
  listDeliveryUnits,
  requireDeliveryResident,
} from '@/core/delivery/operations';
import {
  cancelDeliveryPreAnnouncementAction,
  collectDeliveryAction,
  preAnnounceDeliveryAction,
  respondToDeliveryAction,
  setDeliveryPreferenceAction,
} from './actions';

export const metadata = {
  title: 'Deliveries | Homeish',
  robots: { index: false, follow: false },
};

function unitLabel(unit: { block: string | null; number: string }) {
  return unit.block ? `${unit.block} · ${unit.number}` : unit.number;
}

function dateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

export default async function ResidentDeliveriesPage() {
  await requireDeliveryResident();
  const [units, entries, settings, societyId, timezone] = await Promise.all([
    listDeliveryUnits('own'),
    listDeliveryEntries('all'),
    getDeliverySettings(),
    getDeliveryRealtimeSocietyId(),
    getDeliverySocietyTimezone(),
  ]);
  const preferences = await Promise.all(
    units.map(async (unit) => ({
      unit,
      preference: await getDeliveryPreference(unit.id),
    })),
  );
  const expected = units.length
    ? await listDeliveryPreAnnouncements(units.map((unit) => unit.id))
    : [];
  const announceRequestId = crypto.randomUUID();
  const unitLabels = new Map(units.map((unit) => [unit.id, unitLabel(unit)]));
  const approverUnitIds = new Set(
    units.filter((unit) => unit.canManagePreference).map((unit) => unit.id),
  );
  const waiting = entries.filter(
    (entry) => entry.status === 'pending_response',
  );
  const responseOptions = [
    { decision: 'allowed', label: 'Send inside' },
    ...(settings.leave_at_gate_enabled
      ? [{ decision: 'left_at_gate', label: 'Leave at gate' }]
      : []),
    { decision: 'denied', label: 'Deny / return' },
  ] as const;

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Deliveries</h1>
        <p className="text-body text-ink-muted">
          Respond to deliveries at the gate and track parcels left for
          collection.
        </p>
      </header>
      <DeliveryRealtimeRefresh societyId={societyId} />

      <Card
        description="Only active unit approvers can change that unit's standing rule."
        title="Delivery preferences"
      >
        {preferences.length ? (
          <ul className="grid gap-space-3">
            {preferences.map(({ unit, preference }) => (
              <li
                className="rounded-md border border-rule p-space-3"
                key={unit.id}
              >
                <h2 className="mb-space-2 text-body-strong">
                  {unitLabel(unit)}
                </h2>
                {unit.canManagePreference ? (
                  <DeliveryActionForm
                    action={setDeliveryPreferenceAction}
                    className="grid gap-space-3"
                  >
                    <input name="unitId" type="hidden" value={unit.id} />
                    <label
                      className="grid gap-space-1 text-body-strong"
                      htmlFor={`delivery-rule-${unit.id}`}
                    >
                      When a delivery arrives
                      <select
                        className="min-h-12 rounded-md border border-rule bg-surface px-space-3"
                        defaultValue={
                          preference.rule === 'always_leave_at_gate' &&
                          !settings.leave_at_gate_enabled
                            ? 'ask'
                            : preference.rule
                        }
                        id={`delivery-rule-${unit.id}`}
                        name="rule"
                      >
                        <option value="ask">Ask me (default)</option>
                        <option value="always_allow">
                          Always allow inside
                        </option>
                        {settings.leave_at_gate_enabled ? (
                          <option value="always_leave_at_gate">
                            Always leave at the gate
                          </option>
                        ) : null}
                      </select>
                    </label>
                    <button
                      className="min-h-12 w-fit rounded-md bg-brand px-space-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-focus"
                      type="submit"
                    >
                      Save preference
                    </button>
                  </DeliveryActionForm>
                ) : (
                  <p className="text-caption text-ink-muted">
                    Current rule: {preference.rule}. Ask a unit approver to
                    change it.
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            Your account has no active unit occupancy.
          </p>
        )}
      </Card>

      <Card
        description="Tell the gate about a delivery you expect. Guards see it until the window ends."
        title="Expected deliveries"
      >
        {units.length ? (
          <DeliveryActionForm
            action={preAnnounceDeliveryAction}
            className="grid gap-space-3"
          >
            <input
              name="clientRequestId"
              type="hidden"
              value={announceRequestId}
            />
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="announce-unit"
            >
              Unit
              <select
                className="min-h-12 rounded-md border border-rule bg-surface px-space-3"
                id="announce-unit"
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
              htmlFor="announce-platform"
            >
              Platform or sender
              <input
                autoComplete="off"
                className="min-h-12 rounded-md border border-rule bg-surface px-space-3"
                id="announce-platform"
                maxLength={60}
                name="platform"
                placeholder="For example, Amazon"
                required
              />
            </label>
            <div className="grid gap-space-3 sm:grid-cols-2">
              <label
                className="grid min-w-0 gap-space-1 text-body-strong"
                htmlFor="announce-from"
              >
                Expected from
                <input
                  className="min-h-12 min-w-0 rounded-md border border-rule bg-surface px-space-3"
                  id="announce-from"
                  name="expectedFrom"
                  required
                  type="datetime-local"
                />
              </label>
              <label
                className="grid min-w-0 gap-space-1 text-body-strong"
                htmlFor="announce-to"
              >
                Expected until
                <input
                  aria-describedby="announce-window-help"
                  className="min-h-12 min-w-0 rounded-md border border-rule bg-surface px-space-3"
                  id="announce-to"
                  name="expectedTo"
                  required
                  type="datetime-local"
                />
              </label>
            </div>
            <p
              className="text-caption text-ink-muted"
              id="announce-window-help"
            >
              Society time ({timezone}). The window can be up to 24 hours.
            </p>
            <button
              className="min-h-12 w-fit rounded-md bg-brand px-space-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-focus"
              type="submit"
            >
              Tell the gate
            </button>
          </DeliveryActionForm>
        ) : (
          <p className="text-body text-ink-muted">
            Your account has no active unit occupancy.
          </p>
        )}
        {expected.length ? (
          <ul className="mt-space-4 grid gap-space-3">
            {expected.map((announcement) => (
              <li
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
                key={announcement.id}
              >
                <div>
                  <p className="text-body-strong">{announcement.platform}</p>
                  <p className="text-caption text-ink-muted">
                    {unitLabels.get(announcement.unit_id) ?? 'Your unit'} ·{' '}
                    {dateTime(announcement.expected_from, timezone)} to{' '}
                    {dateTime(announcement.expected_to, timezone)}
                  </p>
                </div>
                <DeliveryActionForm
                  action={cancelDeliveryPreAnnouncementAction}
                  className="w-fit"
                >
                  <input
                    name="announcementId"
                    type="hidden"
                    value={announcement.id}
                  />
                  <button
                    aria-label={`Cancel expected ${announcement.platform} delivery`}
                    className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
                    type="submit"
                  >
                    Cancel
                  </button>
                </DeliveryActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-space-4 text-body text-ink-muted">
            No expected deliveries.
          </p>
        )}
      </Card>

      <Card
        description="The first active unit approver to respond closes the request."
        title="Waiting for your response"
      >
        {waiting.length ? (
          <ul className="grid gap-space-3">
            {waiting.map((entry) => (
              <li
                className="grid gap-space-3 rounded-md border border-rule p-space-4"
                key={entry.id}
              >
                <div>
                  <h2 className="text-body-strong">{entry.company}</h2>
                  <p className="text-caption text-ink-muted">
                    {unitLabels.get(entry.unit_id) ?? 'Your unit'} ·{' '}
                    {entry.delivery_type}
                    {entry.delivery_person ? ` · ${entry.delivery_person}` : ''}
                  </p>
                  {entry.respond_by ? (
                    <p className="text-caption text-ink-muted">
                      Respond by {dateTime(entry.respond_by, timezone)}
                    </p>
                  ) : null}
                </div>
                {approverUnitIds.has(entry.unit_id) ? (
                  <div className="flex flex-wrap gap-space-2">
                    {responseOptions.map(({ decision, label }) => (
                      <DeliveryActionForm
                        action={respondToDeliveryAction}
                        className="inline"
                        key={decision}
                      >
                        <input name="entryId" type="hidden" value={entry.id} />
                        <input name="decision" type="hidden" value={decision} />
                        <button
                          className={`min-h-12 rounded-md px-space-4 font-semibold focus-visible:outline-2 focus-visible:outline-focus ${decision === 'allowed' ? 'bg-brand text-white' : 'border border-rule-strong text-ink'}`}
                          type="submit"
                        >
                          {label}
                        </button>
                      </DeliveryActionForm>
                    ))}
                  </div>
                ) : (
                  <p className="text-caption text-ink-muted">
                    A unit approver can respond to this delivery.
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            No deliveries are waiting for a response.
          </p>
        )}
      </Card>

      <Card title="Delivery history">
        {entries.length ? (
          <ol className="grid gap-space-3">
            {entries.map((entry) => (
              <li
                className="grid gap-space-2 rounded-md border border-rule p-space-3"
                key={entry.id}
              >
                <div>
                  <p className="text-body-strong">{entry.company}</p>
                  <p className="text-caption text-ink-muted">
                    {unitLabels.get(entry.unit_id) ?? 'Your unit'} ·{' '}
                    {entry.delivery_type} · {entry.status.replaceAll('_', ' ')}
                  </p>
                  <time
                    className="text-caption text-ink-muted"
                    dateTime={entry.created_at}
                  >
                    {dateTime(entry.created_at, timezone)}
                  </time>
                </div>
                {entry.status === 'left_at_gate' ? (
                  <DeliveryActionForm
                    action={collectDeliveryAction}
                    className="w-fit"
                  >
                    <input name="entryId" type="hidden" value={entry.id} />
                    <button
                      className="min-h-12 rounded-md border border-rule-strong px-space-4 font-semibold focus-visible:outline-2 focus-visible:outline-focus"
                      type="submit"
                    >
                      Mark collected
                    </button>
                  </DeliveryActionForm>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-ink-muted">No delivery history yet.</p>
        )}
      </Card>
    </section>
  );
}
