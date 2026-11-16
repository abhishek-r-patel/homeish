// Human labels and formatting for Guard Patrol screens.
import type { PatrolCategory, PatrolSeverity } from './validation';

export const PATROL_CATEGORY_LABELS: Record<PatrolCategory, string> = {
  suspicious_activity: 'Suspicious activity',
  unauthorised_entry: 'Unauthorised entry',
  theft: 'Theft',
  fire_safety: 'Fire or safety hazard',
  medical: 'Medical',
  property_damage: 'Property damage',
  dispute: 'Dispute',
  other: 'Other',
};

export const PATROL_SEVERITY_LABELS: Record<PatrolSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

/** Shows a 6-character code as two groups of three so it is easier to read aloud. */
export function formatPatrolCode(code: string) {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/** Formats an HH:MM 24-hour value as a 12-hour time. */
export function formatClockTime(value: string) {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function formatInterval(minutes: number) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? 'every hour' : `every ${hours} hours`;
  }
  return `every ${minutes} minutes`;
}

export function formatPatrolTime(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

export function formatPatrolClock(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value);
}
