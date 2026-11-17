// Preview event contributions and RSVP windows the same way the database charges and closes them.
export type EventContributionType = 'none' | 'per_unit' | 'per_head';

export function contributionFor(
  type: EventContributionType,
  paise: number,
  headcount: number,
): number {
  if (type === 'none' || headcount <= 0) return 0;
  return type === 'per_unit' ? paise : paise * headcount;
}

export function rsvpWindow(
  deadline: string | null,
  startsAt: string,
  now: string | Date,
): { closesAt: string; open: boolean } {
  const closesAt = deadline ?? startsAt;
  const nowTime = (typeof now === 'string' ? new Date(now) : now).getTime();
  return { closesAt, open: nowTime < new Date(closesAt).getTime() };
}

// Parse a typed rupee amount (up to two decimals) into exact integer paise; null when invalid.
export function paiseFromRupeeText(value: string): number | null {
  const text = value.trim().replaceAll(',', '');
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole = '0', fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

// Positive change is added to the flat's bill; negative change is credited back.
export function rsvpChargePreview(
  type: EventContributionType,
  paise: number,
  currentChargePaise: number,
  next: { status: 'going' | 'not_going'; headcount: number },
): { chargePaise: number; changePaise: number } {
  const chargePaise =
    next.status === 'going' ? contributionFor(type, paise, next.headcount) : 0;
  return { chargePaise, changePaise: chargePaise - currentChargePaise };
}
