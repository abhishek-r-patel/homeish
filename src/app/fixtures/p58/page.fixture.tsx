// Render five synthetic close-ups for the P58 public homepage day story.
import { Brand } from '@/components/ui/brand';

const moments = [
  {
    time: '8:00 AM',
    title: 'Guest approved',
    detail: 'Asha is expected at B-304 today.',
    tone: 'bg-success-tint text-success',
    label: 'Visitor approved',
  },
  {
    time: '11:30 AM',
    title: 'Parcel at the gate',
    detail: 'Courier delivery recorded for Arjun, C-112.',
    tone: 'bg-info-tint text-info',
    label: 'Delivery recorded',
  },
  {
    time: '2:00 PM',
    title: 'Bill ready to view',
    detail: 'December society charges: Rs. 2,500.',
    tone: 'bg-brand-tint text-brand',
    label: 'Bill available',
  },
  {
    time: '5:00 PM',
    title: 'Request resolved',
    detail: 'The clubhouse water leak is now fixed.',
    tone: 'bg-warning-tint text-warning',
    label: 'Request updated',
  },
  {
    time: '7:00 PM',
    title: 'Notice read',
    detail: 'The monthly meeting note reached every selected flat.',
    tone: 'bg-neutral-tint text-neutral',
    label: 'Notice opened',
  },
] as const;

export default function P58Fixture() {
  return (
    <main className="grid min-h-screen grid-cols-1 content-start gap-space-5 bg-paper p-space-7 medium:grid-cols-2 expanded:grid-cols-3">
      {moments.map((moment) => (
        <article
          className="grid min-h-72 w-full max-w-md content-between gap-space-5 rounded-lg border border-rule bg-surface p-space-6 shadow-card"
          data-day-moment={moment.time}
          key={moment.time}
        >
          <div className="flex items-center justify-between gap-space-3">
            <Brand />
            <p className="text-caption font-semibold text-ink-muted">
              {moment.time}
            </p>
          </div>
          <div className="grid gap-space-4">
            <span
              aria-hidden="true"
              className={`flex size-12 items-center justify-center rounded-full text-title font-semibold ${moment.tone}`}
            >
              ✓
            </span>
            <div className="grid gap-space-2">
              <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
                {moment.label}
              </p>
              <h2 className="text-heading font-semibold">{moment.title}</h2>
              <p className="text-body text-ink-muted">{moment.detail}</p>
            </div>
          </div>
          <p className="border-t border-rule pt-space-3 text-caption text-ink-muted">
            Synthetic Homeish preview
          </p>
        </article>
      ))}
    </main>
  );
}
