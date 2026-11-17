// Summarise a resident's per-flat replies and an admin edit result in plain words.
import type {
  EventMemberListItem,
  EventRsvpStatus,
  EventUpdateResult,
} from './validation';

type MyRsvp = EventMemberListItem['myRsvps'][number];

function people(count: number) {
  return `${count} ${count === 1 ? 'person' : 'people'}`;
}

function flats(count: number) {
  return `${count} ${count === 1 ? 'flat' : 'flats'}`;
}

function replyText(rsvp: MyRsvp) {
  if (rsvp.status === 'going') return `Going · ${people(rsvp.headcount ?? 0)}`;
  if (rsvp.status === 'not_going') return 'Not going';
  return 'No RSVP yet';
}

export function memberRsvpSummary(
  item: Pick<EventMemberListItem, 'status' | 'myRsvps'>,
): string {
  if (item.status === 'cancelled') return 'Cancelled';
  if (item.myRsvps.length === 0) return 'No RSVP yet';
  if (item.myRsvps.length === 1) return replyText(item.myRsvps[0]!);
  return item.myRsvps
    .map((rsvp) => `${rsvp.label}: ${replyText(rsvp)}`)
    .join('; ');
}

// Going if any flat is going; not going only once every flat has said so.
export function memberRsvpStatus(
  myRsvps: readonly MyRsvp[],
): EventRsvpStatus | null {
  if (myRsvps.some((rsvp) => rsvp.status === 'going')) return 'going';
  if (
    myRsvps.length > 0 &&
    myRsvps.every((rsvp) => rsvp.status === 'not_going')
  ) {
    return 'not_going';
  }
  return null;
}

export function eventUpdateMessage(
  result: Pick<
    EventUpdateResult,
    'notified' | 'withdrawnUnits' | 'refundedUnits'
  >,
): string {
  const base = result.notified
    ? 'Changes saved and invited homes notified.'
    : 'Changes saved.';
  if (result.withdrawnUnits === 0 && result.refundedUnits === 0) return base;
  if (result.withdrawnUnits === 0) {
    return `${base} ${flats(result.refundedUnits)} no longer invited ${result.refundedUnits === 1 ? 'was' : 'were'} refunded.`;
  }
  const withdrawn = `${flats(result.withdrawnUnits)} ${result.withdrawnUnits === 1 ? 'was' : 'were'} withdrawn`;
  return result.refundedUnits === 0
    ? `${base} ${withdrawn}.`
    : `${base} ${withdrawn} and ${result.refundedUnits} refunded.`;
}
