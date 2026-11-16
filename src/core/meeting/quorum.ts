// Pure quorum and notice-period helpers that mirror the database rules for on-screen previews.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type QuorumResult = {
  invited: number;
  present: number;
  percent: number | null;
  met: boolean;
  needed: number | null;
};

export type NoticeResult = {
  requiredDays: number;
  givenDays: number;
  short: boolean;
};

function wholeCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function computeQuorum(
  invited: number,
  present: number,
  percent: number | null,
): QuorumResult {
  const invitedCount = wholeCount(invited);
  const presentCount = Math.min(wholeCount(present), invitedCount);
  if (percent === null || !Number.isFinite(percent) || percent <= 0) {
    return {
      invited: invitedCount,
      present: presentCount,
      percent: null,
      met: false,
      needed: null,
    };
  }
  const needed = Math.ceil((percent * invitedCount) / 100);
  return {
    invited: invitedCount,
    present: presentCount,
    percent,
    met: invitedCount > 0 && presentCount * 100 >= percent * invitedCount,
    needed: invitedCount > 0 ? Math.max(needed, 1) : null,
  };
}

function istDayNumber(value: Date | string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.floor((time + IST_OFFSET_MS) / DAY_MS);
}

// Whole days are counted between India calendar dates, so 23:00 to 01:00 next day is one day.
export function noticeCheck(
  scheduledAt: Date | string,
  startsAt: Date | string,
  requiredDays: number,
): NoticeResult | null {
  const scheduledDay = istDayNumber(scheduledAt);
  const startDay = istDayNumber(startsAt);
  if (scheduledDay === null || startDay === null) return null;
  const required = wholeCount(requiredDays);
  const givenDays = startDay - scheduledDay;
  return { requiredDays: required, givenDays, short: givenDays < required };
}
