// Show that developer audit rows stay hidden until one society is selected.
import { Card } from '@/components/ui/data-display';

export function DeveloperAuditSocietyPrompt() {
  return (
    <Card
      title="Choose one society"
      description="No audit entries are shown until a society is selected."
    >
      <p className="text-body text-ink-muted">
        Pick the society first, then apply any date or action filters.
      </p>
    </Card>
  );
}
