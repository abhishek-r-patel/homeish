// Build editable letter text from a chosen record using only saved values and neutral wording.
import {
  formatBillingDate,
  formatBillingPeriod,
  formatRupees,
} from '../billing/format';
import type { LetterSourceType, LetterType } from './validation';

export interface LetterSociety {
  name: string;
  address: string | null;
  city: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  timezone: string;
}

export type LetterSource =
  | {
      type: 'billing_bill';
      id: string;
      unitNumber: string;
      title: string;
      periodStart: string;
      dueDate: string;
      totalPaise: number;
      paidPaise: number;
      waivedPaise: number;
      outstandingPaise: number;
    }
  | {
      type: 'membership';
      id: string;
      fullName: string;
      unitNumber: string | null;
    }
  | {
      type: 'service_request';
      id: string;
      unitNumber: string | null;
      categoryName: string;
      description: string;
      createdAt: string;
      requesterName: string | null;
    }
  | {
      type: 'amenity_booking';
      id: string;
      date: string;
      unitNumber: string;
      amenityName: string;
      startsAt: string;
      endsAt: string;
      guestCount: number;
      feePaise: number;
      rulesSnapshot: string;
    }
  | {
      type: 'vendor_work_order';
      id: string;
      number: string;
      vendorName: string;
      requestTitle: string;
      description: string;
      valuePaise: number;
      issuedOn: string;
      dueOn: string | null;
    };

export interface LetterText {
  recipient: string;
  subject: string;
  body: string;
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
    timeZone,
  }).format(new Date(value));
}

function excerpt(text: string, limit = 400) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > limit
    ? `${clean.slice(0, limit - 1).trimEnd()}…`
    : clean;
}

function signOff(society: LetterSociety) {
  return `Regards,\nManaging Committee\n${society.name}`;
}

function contactLine(society: LetterSociety) {
  const contacts = [society.contactPhone, society.contactEmail].filter(Boolean);
  return contacts.length
    ? `please contact the society office (${contacts.join(', ')})`
    : 'please contact the society office';
}

export function letterSourceLabel(
  source: LetterSource,
  timeZone: string,
): string {
  switch (source.type) {
    case 'billing_bill':
      return `Unit ${source.unitNumber} · ${source.title} · ${formatRupees(source.outstandingPaise)} outstanding · due ${formatBillingDate(source.dueDate)}`;
    case 'membership':
      return source.unitNumber
        ? `${source.fullName} · Unit ${source.unitNumber}`
        : source.fullName;
    case 'service_request':
      return `${source.categoryName}${source.unitNumber ? ` · Unit ${source.unitNumber}` : ''} · ${formatBillingDate(source.createdAt)} · ${excerpt(source.description, 60)}`;
    case 'amenity_booking':
      return `${source.amenityName} · Unit ${source.unitNumber} · ${formatTime(source.startsAt, timeZone)}`;
    case 'vendor_work_order':
      return `${source.number} · ${source.vendorName} · ${source.requestTitle}`;
  }
}

function duesFigures(source: Extract<LetterSource, { type: 'billing_bill' }>) {
  return [
    `Bill: ${source.title}`,
    `Period: ${formatBillingPeriod(source.periodStart.slice(0, 7))}`,
    `Bill amount: ${formatRupees(source.totalPaise)}`,
    `Paid so far: ${formatRupees(source.paidPaise)}`,
    ...(source.waivedPaise > 0
      ? [`Waived: ${formatRupees(source.waivedPaise)}`]
      : []),
    `Outstanding: ${formatRupees(source.outstandingPaise)}`,
    `Due date: ${formatBillingDate(source.dueDate)}`,
  ].join('\n');
}

export function buildLetterText(
  type: LetterType,
  source: LetterSource | null,
  society: LetterSociety,
  letterDate: string,
): LetterText {
  const sourceOf = <T extends LetterSourceType>(expected: T) => {
    if (source?.type !== expected) {
      throw new Error(`Letter type ${type} needs a ${expected} record.`);
    }
    return source as Extract<LetterSource, { type: T }>;
  };
  const contact = contactLine(society);
  switch (type) {
    case 'dues_reminder': {
      const bill = sourceOf('billing_bill');
      return {
        recipient: `The Resident\nUnit ${bill.unitNumber}`,
        subject: `Reminder: ${bill.title} for Unit ${bill.unitNumber}`,
        body: `Dear Resident,\n\nThis is a reminder that the following bill for Unit ${bill.unitNumber} has an amount outstanding as per the society records:\n\n${duesFigures(bill)}\n\nWe request you to pay the outstanding amount. If you have any questions about this bill, ${contact}. If you have already paid, please share the payment details with the office and ignore this reminder.\n\n${signOff(society)}`,
      };
    }
    case 'dues_final_notice': {
      const bill = sourceOf('billing_bill');
      return {
        recipient: `The Resident\nUnit ${bill.unitNumber}`,
        subject: `Final notice: ${bill.title} for Unit ${bill.unitNumber}`,
        body: `Dear Resident,\n\nAs per the society records, the following bill for Unit ${bill.unitNumber} remains outstanding:\n\n${duesFigures(bill)}\n\nWe request you to pay the outstanding amount at the earliest. If you would like to discuss this bill, ${contact}. If you have already paid, please share the payment details with the office.\n\n${signOff(society)}`,
      };
    }
    case 'member_welcome': {
      const member = sourceOf('membership');
      return {
        recipient: member.unitNumber
          ? `${member.fullName}\nUnit ${member.unitNumber}`
          : member.fullName,
        subject: `Welcome to ${society.name}`,
        body: `Dear ${member.fullName},\n\nWelcome to ${society.name}. We are glad to have you as a member${member.unitNumber ? ` of Unit ${member.unitNumber}` : ''}.\n\nYou can use Homeish to read society notices and use the services your society offers. For any help, ${contact}.\n\n${signOff(society)}`,
      };
    }
    case 'complaint_acknowledgement': {
      const request = sourceOf('service_request');
      const name = request.requesterName ?? 'Resident';
      return {
        recipient: request.unitNumber
          ? `${name}\nUnit ${request.unitNumber}`
          : name,
        subject: `Acknowledgement of your request: ${request.categoryName}`,
        body: `Dear ${name},\n\nWe acknowledge your request raised on ${formatBillingDate(request.createdAt)} under "${request.categoryName}":\n\n"${excerpt(request.description)}"\n\nYour request has been recorded and will be looked into. You can follow its status in Homeish. For any questions, ${contact}.\n\n${signOff(society)}`,
      };
    }
    case 'rule_violation_warning':
      return {
        recipient: 'The Resident\nUnit [unit number]',
        subject: 'Request to follow society rules',
        body: `Dear Resident,\n\nIt has been observed that [describe the issue observed, with the date and place].\n\nThis is not in line with the society rule: [quote the relevant rule].\n\nWe request you to follow this rule. If you have any questions, or believe this note is mistaken, ${contact}.\n\n${signOff(society)}`,
      };
    case 'hall_booking_confirmation': {
      const booking = sourceOf('amenity_booking');
      const rules = booking.rulesSnapshot.trim();
      return {
        recipient: `The Resident\nUnit ${booking.unitNumber}`,
        subject: `Booking confirmation: ${booking.amenityName}`,
        body: `Dear Resident,\n\nThis letter confirms the booking of ${booking.amenityName} for Unit ${booking.unitNumber}.\n\nFrom: ${formatTime(booking.startsAt, society.timezone)}\nTo: ${formatTime(booking.endsAt, society.timezone)}\nGuests: ${booking.guestCount}\nFee saved for this booking: ${booking.feePaise > 0 ? formatRupees(booking.feePaise) : 'None'}\n\nRules saved with this booking:\n${rules || 'No rules were saved with this booking.'}\n\nThis letter records the booking only and does not confirm any payment. For any questions, ${contact}.\n\n${signOff(society)}`,
      };
    }
    case 'vendor_work_order': {
      const order = sourceOf('vendor_work_order');
      return {
        recipient: order.vendorName,
        subject: `Work order ${order.number}: ${order.requestTitle}`,
        body: `Dear ${order.vendorName},\n\nThe society has issued work order ${order.number} for the following work:\n\n${order.description.trim() || order.requestTitle}\n\nOrder value: ${formatRupees(order.valuePaise)}\nIssued on: ${formatBillingDate(order.issuedOn)}\nComplete by: ${order.dueOn ? formatBillingDate(order.dueOn) : 'Not set'}\n\nPlease confirm the schedule and arrange site access with the society office.\n\n${signOff(society)}`,
      };
    }
    case 'utility_shutdown':
      return {
        recipient: 'All Residents',
        subject: 'Planned [water / electricity / lift] shutdown on [date]',
        body: `Dear Residents,\n\nThere will be a planned shutdown of the [water / electricity / lift] supply on [date] from [start time] to [end time] for [reason].\n\nPlease plan your use accordingly. We regret the inconvenience. For any questions, ${contact}.\n\n${signOff(society)}`,
      };
    case 'circular':
      return {
        recipient: 'All Residents',
        subject: 'Circular: [subject]',
        body: `Dear Residents,\n\n[Write the circular here.]\n\nFor any questions, ${contact}.\n\n${signOff(society)}`,
      };
    case 'event_announcement':
      return {
        recipient: 'All Residents',
        subject: '[Event name] on [date]',
        body: `Dear Residents,\n\nWe are happy to invite you to [event name] on [date] at [time] at [venue].\n\n[Add the programme details.]\n\nAll residents and their families are welcome.\n\n${signOff(society)}`,
      };
    case 'annual_newsletter':
      return {
        recipient: 'All Residents',
        subject: `${society.name} newsletter ${letterDate.slice(0, 4)}`,
        body: `Dear Residents,\n\nHere is a summary of the year at ${society.name}.\n\nHighlights:\n- [Add a highlight]\n- [Add a highlight]\n\nWork completed:\n- [Add an item]\n\nLooking ahead:\n- [Add a plan]\n\nThank you for your support through the year.\n\n${signOff(society)}`,
      };
  }
}

export function letterheadLines(society: LetterSociety): string[] {
  const address = [society.address, society.city].filter(Boolean).join(', ');
  const contacts = [society.contactPhone, society.contactEmail]
    .filter(Boolean)
    .join(' · ');
  return [address, contacts].filter((line) => line.length > 0);
}

export function hasPlaceholders(text: string) {
  return /\[[^\]\n]{1,80}\]/.test(text);
}
