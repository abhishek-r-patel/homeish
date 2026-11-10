// Show the society visitor log, blacklist and module settings.
import { Card } from '@/components/ui/data-display';
import { VisitorActionForm } from '@/components/visitor/action-form';
import { VisitorRealtimeRefresh } from '@/components/visitor/realtime-refresh';
import {
  getVisitorAdminAccess,
  getVisitorRealtimeSocietyId,
  getVisitorSocietyTimezone,
  getVisitorSettings,
  listVisitorBlacklist,
  listVisitorEntries,
} from '@/core/visitor/operations';
import {
  addVisitorBlacklistAction,
  removeVisitorBlacklistAction,
  updateVisitorSettingsAction,
} from './actions';

export const metadata = {
  title: 'Visitor management | Homeish',
  robots: { index: false, follow: false },
};

function dateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

export default async function AdminVisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const access = await getVisitorAdminAccess();
  const [{ q, status }, entries, blacklist, settings, societyId, timezone] =
    await Promise.all([
      searchParams,
      listVisitorEntries('all'),
      listVisitorBlacklist(),
      getVisitorSettings(),
      getVisitorRealtimeSocietyId(),
      getVisitorSocietyTimezone(),
    ]);
  const query = q?.trim().toLocaleLowerCase() ?? '';
  const visibleEntries = entries.filter((entry) => {
    const matchesStatus =
      !status || status === 'all' || entry.status === status;
    const matchesQuery =
      !query ||
      entry.visitor_name.toLocaleLowerCase().includes(query) ||
      entry.purpose.toLocaleLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Visitor management</h1>
        <p className="text-body text-ink-muted">
          Review visitor activity, configure gate rules and manage the
          blacklist.
        </p>
      </header>
      <VisitorRealtimeRefresh societyId={societyId} />

      <Card title="Visitor log">
        <form className="mb-space-4 flex flex-wrap gap-space-2" method="get">
          <label
            className="grid gap-space-1 text-caption"
            htmlFor="visitor-search"
          >
            Search name or purpose
            <input
              className="min-h-11 rounded-md border border-rule px-space-3"
              defaultValue={q ?? ''}
              id="visitor-search"
              name="q"
            />
          </label>
          <label
            className="grid gap-space-1 text-caption"
            htmlFor="visitor-status"
          >
            Status
            <select
              className="min-h-11 rounded-md border border-rule bg-surface px-space-3"
              defaultValue={status ?? 'all'}
              id="visitor-status"
              name="status"
            >
              <option value="all">All</option>
              <option value="pending">Waiting</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
              <option value="checked_in">Inside</option>
              <option value="checked_out">Checked out</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <button
            className="min-h-11 self-end rounded-md bg-brand px-space-4 font-semibold text-white"
            type="submit"
          >
            Filter
          </button>
        </form>
        {visibleEntries.length ? (
          <ol className="grid gap-space-3">
            {visibleEntries.map((entry) => (
              <li
                className="grid gap-space-1 rounded-md border border-rule p-space-3"
                key={entry.id}
              >
                <p className="text-body-strong">
                  {entry.visitor_name}
                  {entry.is_overstay ? (
                    <span className="ml-space-2 text-danger">Overstay</span>
                  ) : null}
                </p>
                <p className="text-caption text-ink-muted">
                  {entry.purpose} · {entry.people_count} people · {entry.status}
                </p>
                <time
                  className="text-caption text-ink-muted"
                  dateTime={entry.created_at}
                >
                  {dateTime(entry.created_at, timezone)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-ink-muted">
            No visitors match these filters.
          </p>
        )}
      </Card>

      <Card title="Visitor blacklist">
        {access.canManage ? (
          <VisitorActionForm
            action={addVisitorBlacklistAction}
            className="mb-space-4 grid gap-space-3 rounded-md border border-rule p-space-3"
          >
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="blacklist-phone"
            >
              Phone number
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="blacklist-phone"
                inputMode="tel"
                name="phone"
                required
                type="tel"
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="blacklist-name"
            >
              Name (optional)
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="blacklist-name"
                maxLength={120}
                name="name"
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="blacklist-reason"
            >
              Reason (optional)
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                id="blacklist-reason"
                maxLength={500}
                name="reason"
              />
            </label>
            <button
              className="min-h-12 w-fit rounded-md bg-brand px-space-4 font-semibold text-white"
              type="submit"
            >
              Add number
            </button>
          </VisitorActionForm>
        ) : null}
        {blacklist.length ? (
          <ul className="grid gap-space-2">
            {blacklist.map((item) => (
              <li
                className="flex flex-wrap items-center justify-between gap-space-3 rounded-md border border-rule p-space-3"
                key={item.id}
              >
                <div>
                  <p className="text-body-strong">{item.name || item.phone}</p>
                  {item.name ? (
                    <p className="text-caption text-ink-muted">{item.phone}</p>
                  ) : null}
                  {item.reason ? (
                    <p className="text-caption text-ink-muted">{item.reason}</p>
                  ) : null}
                </div>
                {item.active && access.canManage ? (
                  <VisitorActionForm action={removeVisitorBlacklistAction}>
                    <input name="blacklistId" type="hidden" value={item.id} />
                    <button
                      className="min-h-11 rounded-md border border-rule-strong px-space-3 font-semibold"
                      type="submit"
                    >
                      Remove
                    </button>
                  </VisitorActionForm>
                ) : (
                  <span className="text-caption text-ink-muted">Inactive</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">The blacklist is empty.</p>
        )}
      </Card>

      {access.canManage ? (
        <Card title="Visitor settings">
          <VisitorActionForm
            action={updateVisitorSettingsAction}
            className="grid gap-space-3"
          >
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="approval-timeout"
            >
              Resident response timeout (minutes)
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                defaultValue={settings.approval_timeout_minutes}
                id="approval-timeout"
                max={30}
                min={1}
                name="approvalTimeoutMinutes"
                required
                type="number"
              />
            </label>
            <label
              className="grid gap-space-1 text-body-strong"
              htmlFor="overstay-hours"
            >
              Overstay threshold (hours)
              <input
                className="min-h-12 rounded-md border border-rule px-space-3"
                defaultValue={settings.overstay_hours}
                id="overstay-hours"
                max={72}
                min={1}
                name="overstayHours"
                required
                type="number"
              />
            </label>
            {[
              ['photoRequired', 'Require a visitor photo'],
              ['phoneRequired', 'Require a visitor phone number'],
              ['guardOverrideAllowed', 'Allow guard approval overrides'],
            ].map(([name, label]) => {
              const value =
                name === 'photoRequired'
                  ? settings.photo_required
                  : name === 'phoneRequired'
                    ? settings.phone_required
                    : settings.guard_override_allowed;
              return (
                <label
                  className="flex min-h-11 items-center gap-space-2"
                  key={name}
                >
                  <input defaultChecked={value} name={name} type="checkbox" />
                  {label}
                </label>
              );
            })}
            <button
              className="min-h-12 w-fit rounded-md bg-brand px-space-4 font-semibold text-white"
              type="submit"
            >
              Save settings
            </button>
          </VisitorActionForm>
        </Card>
      ) : null}
    </section>
  );
}
