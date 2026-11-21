// Resolve the 6-month, 12-month and financial-year (April to March) report periods shared by P43 reports (client-safe).
export const REPORT_PERIODS = ['6m', '12m', 'fy'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];
export const DEFAULT_REPORT_PERIOD: ReportPeriod = '12m';

export type ReportPeriodRange = {
  /** First day of the first month in the period. */
  from: string;
  /** First day of the current month: the last month that can have bills. */
  toMonth: string;
  /** Last day of the period: the current month's end, or 31 March for the financial year. */
  to: string;
};

function isoDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

export function readReportPeriod(value: unknown): ReportPeriod {
  const text = Array.isArray(value) ? value[0] : value;
  return (
    REPORT_PERIODS.find((period) => period === text) ?? DEFAULT_REPORT_PERIOD
  );
}

export function reportPeriodRange(
  period: ReportPeriod,
  today: string,
): ReportPeriodRange {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const toMonth = isoDate(year, month, 1);
  if (period === 'fy') {
    const startYear = month >= 3 ? year : year - 1;
    return {
      from: isoDate(startYear, 3, 1),
      toMonth,
      to: isoDate(startYear + 1, 2, 31),
    };
  }
  const months = period === '6m' ? 6 : 12;
  return {
    from: isoDate(year, month - (months - 1), 1),
    toMonth,
    to: isoDate(year, month + 1, 0),
  };
}
