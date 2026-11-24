// Render one read-only P55 society calendar as month grid and phone agenda.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUiTranslator } from '@/components/ui/language';
import type { CalendarItem } from '@/core/home/workspace-discovery';
import {
  formatLocalizedDate,
  formatLocalizedDateTime,
} from '@/core/i18n/format';

const sourceLabels = {
  meeting: 'Meeting',
  event: 'Event',
  amenity: 'Amenity booking',
  bill: 'Bill due',
} as const;

export function SocietyCalendar({
  items,
  month,
}: {
  items: readonly CalendarItem[];
  month: string;
}) {
  const { locale, translate: t } = useUiTranslator();
  const router = useRouter();
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year!, monthNumber! - 1, 1));
  const end = new Date(Date.UTC(year!, monthNumber!, 0));
  const firstWeekday = (start.getUTCDay() + 6) % 7;
  const days = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(Date.UTC(year!, monthNumber! - 1, index - firstWeekday + 1)),
  );
  const byDate = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const date = item.occurs_at.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), item]);
  }
  const changeMonth = (delta: number) => {
    const next = new Date(Date.UTC(year!, monthNumber! - 1 + delta, 1));
    router.push(`?month=${next.toISOString().slice(0, 7)}`);
  };
  const heading = formatLocalizedDate(start, locale ?? 'en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <section className="grid gap-space-5">
      <header className="flex flex-wrap items-center justify-between gap-space-3">
        <div className="grid gap-space-1">
          <p className="text-micro font-semibold uppercase tracking-wide text-brand">
            {t('Society calendar')}
          </p>
          <h1 className="text-title font-semibold">{heading}</h1>
        </div>
        <div className="flex gap-space-2">
          <button
            className="min-h-12 rounded-md border border-rule px-space-4 text-body-strong"
            onClick={() => changeMonth(-1)}
            type="button"
          >
            ← {t('Previous')}
          </button>
          <button
            className="min-h-12 rounded-md border border-rule px-space-4 text-body-strong"
            onClick={() => changeMonth(1)}
            type="button"
          >
            {t('Next')} →
          </button>
        </div>
      </header>
      <div className="hidden overflow-hidden rounded-md border border-rule bg-surface medium:grid">
        <div className="grid grid-cols-7 border-b border-rule">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div
              className="p-space-2 text-center text-caption font-semibold text-ink-muted"
              key={day}
            >
              {t(day)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const iso = day.toISOString().slice(0, 10);
            const inMonth =
              day.getUTCFullYear() === year &&
              day.getUTCMonth() === monthNumber! - 1;
            return (
              <div
                className={`min-h-28 border-b border-r border-rule p-space-2 ${inMonth ? '' : 'bg-surface-sunken text-ink-muted'}`}
                key={iso}
              >
                <p className="text-caption">{day.getUTCDate()}</p>
                <ul className="mt-space-1 grid gap-space-1">
                  {(byDate.get(iso) ?? []).slice(0, 3).map((item) => (
                    <li key={`${item.source}-${item.item_id}`}>
                      <Link
                        className="block truncate rounded-sm bg-brand-tint px-space-1 py-0.5 text-micro text-brand hover:underline"
                        href={item.href}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid gap-space-3 medium:hidden">
        {Array.from({ length: end.getUTCDate() }, (_, index) => {
          const date = `${month}-${String(index + 1).padStart(2, '0')}`;
          const dayItems = byDate.get(date) ?? [];
          if (!dayItems.length) return null;
          return (
            <section
              className="grid gap-space-2 rounded-md border border-rule bg-surface p-space-4"
              key={date}
            >
              <h2 className="text-body-strong">
                {formatLocalizedDate(
                  new Date(`${date}T00:00:00Z`),
                  locale ?? 'en',
                  {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'UTC',
                  },
                )}
              </h2>
              {dayItems.map((item) => (
                <Link
                  className="grid gap-space-1 text-body-strong"
                  href={item.href}
                  key={`${item.source}-${item.item_id}`}
                >
                  <span className="text-caption text-brand">
                    {t(sourceLabels[item.source])}
                  </span>
                  <span>{item.title}</span>
                  <time className="text-caption font-normal text-ink-muted">
                    {formatLocalizedDateTime(
                      new Date(item.occurs_at),
                      locale ?? 'en',
                      { timeStyle: 'short', timeZone: 'Asia/Kolkata' },
                    )}
                  </time>
                </Link>
              ))}
            </section>
          );
        })}
        {!items.length ? (
          <p className="rounded-md border border-dashed border-rule bg-surface p-space-5 text-body text-ink-muted">
            {t('Nothing scheduled this month.')}
          </p>
        ) : null}
      </div>
    </section>
  );
}
