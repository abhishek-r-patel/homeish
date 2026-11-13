// Convert a datetime-local form value in the society time zone to an ISO instant.
import { ValidationError } from '@/core/errors';

export function localTimeToIso(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new ValidationError({ time: 'Enter a valid local time.' });
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const target = Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
    Number(hourText),
    Number(minuteText),
  );
  let timestamp = target;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  function part(date: Date, type: Intl.DateTimeFormatPartTypes) {
    return Number(
      formatter.formatToParts(date).find((item) => item.type === type)?.value,
    );
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const represented = Date.UTC(
      part(new Date(timestamp), 'year'),
      part(new Date(timestamp), 'month') - 1,
      part(new Date(timestamp), 'day'),
      part(new Date(timestamp), 'hour'),
      part(new Date(timestamp), 'minute'),
    );
    timestamp += target - represented;
  }
  const result = new Date(timestamp);
  if (
    !Number.isFinite(result.getTime()) ||
    part(result, 'year') !== Number(yearText) ||
    part(result, 'month') !== Number(monthText) ||
    part(result, 'day') !== Number(dayText) ||
    part(result, 'hour') !== Number(hourText) ||
    part(result, 'minute') !== Number(minuteText)
  ) {
    throw new ValidationError({
      time: 'That local time does not exist in the society time zone.',
    });
  }
  return result.toISOString();
}
