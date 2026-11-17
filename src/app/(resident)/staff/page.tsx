// Show resident-linked staff, registration state and gate attendance history.
import { Avatar, Card } from '@/components/ui/data-display';
import {
  DomesticStaffRegistrationForm,
  UnitStaffDayBlockForm,
} from '@/components/staff/resident-controls';
import { getStaffWorkspace } from '@/core/staff/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage, type MessageValues } from '@/core/i18n/messages';
import {
  formatLocalizedDate,
  formatLocalizedDateTime,
} from '@/core/i18n/format';
import type { Locale } from '@/core/i18n/locale';

export const metadata = {
  title: 'Domestic staff | Homeish',
  robots: { index: false, follow: false },
};

function formatTime(value: string, timeZone: string, locale: Locale) {
  return formatLocalizedDateTime(new Date(value), locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  });
}

function attendanceMonth(value: string, locale: Locale) {
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  return formatLocalizedDate(new Date(Date.UTC(year, month - 1, 1)), locale, {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  });
}

export default async function ResidentStaffPage() {
  const locale = await getRequestLocale();
  const t = (source: string, values?: MessageValues) =>
    translateMessage(locale, source, values);
  const workspace = await getStaffWorkspace();
  const visibleStaff = workspace.staff.filter(
    ({ staff_type }) => staff_type === 'domestic',
  );
  const pendingLinks = visibleStaff.flatMap((staff) =>
    staff.unit_links
      .filter(({ status }) => status === 'pending')
      .map((link) => ({ staff, link })),
  );
  const activeLinks = visibleStaff.flatMap((staff) =>
    staff.unit_links
      .filter(({ status }) => status === 'active')
      .map((link) => ({ staff, link })),
  );

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Domestic staff')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Register staff for your unit, review gate attendance and block unit access for today when needed.',
          )}
        </p>
      </header>

      <Card
        description={t(
          'A registration may be routed to an administrator if approval is required or the person matches an existing profile.',
        )}
        title={t('Register staff')}
      >
        {workspace.units.length ? (
          <DomesticStaffRegistrationForm
            societyId={workspace.societyId}
            units={workspace.units}
          />
        ) : (
          <p className="text-body text-ink-muted">
            {t('No active units are available for your account.')}
          </p>
        )}
      </Card>

      <Card title={t('Waiting for administrator review')}>
        {pendingLinks.length ? (
          <ul className="grid gap-space-3">
            {pendingLinks.map(({ staff, link }) => (
              <li
                className="grid gap-space-2 rounded-md border border-rule p-space-4"
                key={link.id}
              >
                <Avatar
                  name={staff.full_name}
                  photoUrl={staff.photoUrl ?? undefined}
                />
                <p className="text-caption text-ink-muted">
                  {staff.job_role} · {link.unit_label}
                </p>
                <p className="text-caption text-warning">
                  {t(
                    'Pending approval. Gate access is not available until approved.',
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No registrations are waiting for review.')}
          </p>
        )}
      </Card>

      <Card title={t('Staff linked to your units')}>
        {activeLinks.length ? (
          <ul className="grid gap-space-3">
            {activeLinks.map(({ staff, link }) => {
              const attendance = workspace.attendanceByStaffId[staff.id] ?? [];
              return (
                <li
                  className="grid gap-space-3 rounded-md border border-rule p-space-4"
                  key={link.id}
                >
                  <Avatar
                    name={staff.full_name}
                    photoUrl={staff.photoUrl ?? undefined}
                  />
                  <p className="text-caption text-ink-muted">
                    {staff.job_role} · {link.unit_label}
                  </p>
                  {staff.status === 'blocked' ? (
                    <p className="text-caption text-danger">
                      {t('This profile is blocked society-wide.')}
                    </p>
                  ) : null}
                  {attendance.length ? (
                    <div className="grid gap-space-1">
                      <h2 className="text-body-strong">
                        {t('Gate attendance · {month}', {
                          month: attendanceMonth(workspace.month, locale),
                        })}
                      </h2>
                      <ul className="grid gap-space-1">
                        {attendance.map((record) => (
                          <li
                            className="text-caption text-ink-muted"
                            key={record.id}
                          >
                            {record.unit_label} ·{' '}
                            {t('Entered {time}', {
                              time: formatTime(
                                record.checked_in_at,
                                workspace.timezone,
                                locale,
                              ),
                            })}
                            {record.checked_out_at
                              ? ` · ${t('Exited {time}', {
                                  time: formatTime(
                                    record.checked_out_at,
                                    workspace.timezone,
                                    locale,
                                  ),
                                })}`
                              : ` · ${t('Currently inside')}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-caption text-ink-muted">
                      {t('No gate attendance is recorded for this month.')}
                    </p>
                  )}
                  {link.blocked_today ? (
                    <p className="text-caption text-danger" role="status">
                      {t(
                        'This staff member is blocked from this unit for today.',
                      )}
                    </p>
                  ) : staff.status === 'active' ? (
                    <UnitStaffDayBlockForm
                      staffId={staff.id}
                      staffName={staff.full_name}
                      unitId={link.unit_id}
                      unitLabel={link.unit_label}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">
            {t('No staff are linked to your units yet.')}
          </p>
        )}
      </Card>
    </section>
  );
}
