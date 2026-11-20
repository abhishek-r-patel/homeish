// Use India time for Homeish's business calendar and presentation.
export const INDIA_TIME_ZONE = 'Asia/Kolkata';

const indiaDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: INDIA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayInIndia(now = new Date()): string {
  return indiaDay.format(now);
}
