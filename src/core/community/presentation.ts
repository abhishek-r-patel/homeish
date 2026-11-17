// Derive Community & Marketplace labels, listing state, mute wording and India-time formatting for screens.
import type {
  CommunityItemStatus,
  CommunityListingType,
  CommunityModerationAction,
  CommunityMute,
  CommunityMuteDuration,
  CommunityReportReason,
  CommunityTargetType,
} from './validation';

export const COMMUNITY_LISTING_TYPE_LABELS: Readonly<
  Record<CommunityListingType, string>
> = {
  sale: 'For sale',
  give_away: 'Free to a good home',
  wanted: 'Wanted',
  lost: 'Lost',
  found: 'Found',
};

export const COMMUNITY_REPORT_REASON_LABELS: Readonly<
  Record<CommunityReportReason, string>
> = {
  spam: 'Spam or advertising',
  offensive: 'Offensive or abusive',
  scam: 'Looks like a scam',
  other: 'Something else',
};

export const COMMUNITY_MUTE_DURATION_LABELS: Readonly<
  Record<CommunityMuteDuration, string>
> = {
  '7d': '7 days',
  '30d': '30 days',
  until_lifted: 'Until I lift it',
};

export const COMMUNITY_TARGET_LABELS: Readonly<
  Record<CommunityTargetType, string>
> = {
  post: 'Post',
  listing: 'Listing',
  reply: 'Reply',
};

export const COMMUNITY_MODERATION_LABELS: Readonly<
  Record<CommunityModerationAction, string>
> = {
  approve: 'Approve',
  reject: 'Reject',
  remove: 'Remove',
  restore: 'Restore',
};

export type CommunityListingState =
  CommunityItemStatus | 'live' | 'closed' | 'expired';

// Mirrors the database: approved listings are closed when closedAt is set, expired once expiresAt has passed.
export function listingState(
  listing: {
    status: CommunityItemStatus;
    expiresAt: string | null;
    closedAt: string | null;
  },
  now: Date | string,
): CommunityListingState {
  if (listing.status !== 'approved') return listing.status;
  if (listing.closedAt) return 'closed';
  const nowTime = (typeof now === 'string' ? new Date(now) : now).getTime();
  if (listing.expiresAt && new Date(listing.expiresAt).getTime() < nowTime) {
    return 'expired';
  }
  return 'live';
}

export function canRenewListing(state: CommunityListingState) {
  return state === 'live' || state === 'expired';
}

// Uses the database's expired/closed flags so server and browser render the same state.
export function listingStateFromFlags(listing: {
  status: CommunityItemStatus;
  expired: boolean;
  closed: boolean;
}): CommunityListingState {
  if (listing.status !== 'approved') return listing.status;
  if (listing.closed) return 'closed';
  return listing.expired ? 'expired' : 'live';
}

export function formatCommunityDateTime(value: string | null | undefined) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function muteEndsText(mute: CommunityMute) {
  if (mute.untilLifted || !mute.mutedUntil) {
    return 'until an administrator lifts it';
  }
  return `until ${formatCommunityDateTime(mute.mutedUntil)} IST`;
}

export function isMuteActive(mute: CommunityMute | null, now: Date | string) {
  if (!mute) return false;
  if (mute.untilLifted || !mute.mutedUntil) return true;
  const nowTime = (typeof now === 'string' ? new Date(now) : now).getTime();
  return new Date(mute.mutedUntil).getTime() > nowTime;
}

// Indian digit grouping, for example ₹1,25,000 or ₹499.50.
export function formatCommunityPrice(paise: number | null) {
  if (paise === null) return null;
  if (paise === 0) return 'Free';
  const rupees = Math.floor(paise / 100);
  const remainder = paise % 100;
  const grouped = new Intl.NumberFormat('en-IN').format(rupees);
  return remainder === 0
    ? `₹${grouped}`
    : `₹${grouped}.${String(remainder).padStart(2, '0')}`;
}

// Parse a typed rupee amount (up to two decimals) into exact integer paise; null when invalid.
export function paiseFromRupeeText(value: string): number | null {
  const text = value.trim().replaceAll(',', '');
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole = '0', fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function rupeeTextFromPaise(paise: number | null) {
  if (paise === null) return '';
  const remainder = paise % 100;
  return remainder === 0
    ? String(Math.floor(paise / 100))
    : `${Math.floor(paise / 100)}.${String(remainder).padStart(2, '0')}`;
}

export function authorLine(name: string, unitLabel: string | null) {
  return unitLabel ? `${name} · Flat ${unitLabel}` : name;
}

export function excerpt(text: string, max = 200) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
