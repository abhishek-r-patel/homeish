// Shared Parking labels, time formatting and pass-window helpers for screens and fixtures.
import {
  PARKING_PASS_MAX_HOURS,
  type ParkingAllocation,
  type ParkingConditionStatus,
  type ParkingSlotType,
} from './validation';

export const PARKING_TIME_ZONE = 'Asia/Kolkata';

export const PARKING_SLOT_TYPE_LABELS: Record<ParkingSlotType, string> = {
  car: 'Car',
  two_wheeler: 'Two-wheeler',
  ev: 'EV (electric car)',
  visitor: 'Visitor',
};

export const PARKING_CONDITION_LABELS: Record<ParkingConditionStatus, string> =
  {
    available: 'Available',
    needs_attention: 'Needs attention',
    out_of_service: 'Out of service',
  };

export const PARKING_REQUEST_STATUS_LABELS = {
  waiting: 'Waiting',
  fulfilled: 'Slot allocated',
  cancelled: 'Cancelled',
} as const;

export const PARKING_REPORT_STATUS_LABELS = {
  open: 'Open',
  resolved: 'Resolved',
} as const;

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  car: 'Car',
  two_wheeler: 'Two-wheeler',
  other: 'Other four-wheeler',
};

export function parkingVehicleTypeLabel(value: string) {
  return VEHICLE_TYPE_LABELS[value] ?? value.replaceAll('_', ' ');
}

export function formatParkingTime(value: string, timeZone = PARKING_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value));
}

export function formatParkingWindow(
  startsAt: string,
  endsAt: string,
  timeZone = PARKING_TIME_ZONE,
) {
  return `${formatParkingTime(startsAt, timeZone)} to ${formatParkingTime(endsAt, timeZone)}`;
}

export function parkingQueueText(position: number | null) {
  if (position === null) return null;
  return position === 1 ? 'Next in line' : `Number ${position} in line`;
}

/** Duration choices for a visitor pass, in hours, capped at the 24-hour maximum. */
export const PARKING_PASS_DURATIONS = [1, 2, 4, 8, 12, PARKING_PASS_MAX_HOURS];

export function parkingPassEnd(startsAt: string, hours: number) {
  if (!Number.isInteger(hours) || hours < 1 || hours > PARKING_PASS_MAX_HOURS)
    throw new RangeError(
      `Choose a duration of 1 to ${PARKING_PASS_MAX_HOURS} hours.`,
    );
  return new Date(Date.parse(startsAt) + hours * 3_600_000).toISOString();
}

export function parkingPassState(
  pass: { status: 'active' | 'cancelled'; starts_at: string; ends_at: string },
  now = Date.now(),
): 'cancelled' | 'upcoming' | 'current' | 'ended' {
  if (pass.status === 'cancelled') return 'cancelled';
  if (Date.parse(pass.ends_at) <= now) return 'ended';
  return Date.parse(pass.starts_at) > now ? 'upcoming' : 'current';
}

export const PARKING_PASS_STATE_LABELS = {
  cancelled: 'Cancelled',
  upcoming: 'Upcoming',
  current: 'Active now',
  ended: 'Ended',
} as const;

export function parkingLinkedVehicles(allocation: ParkingAllocation) {
  return allocation.vehicles.filter((vehicle) => vehicle.linked);
}
