// Format the notice audience aggregate without exposing recipient identities.
import type { NoticeReach } from './validation';

type Translate = (
  source: string,
  values?: Record<string, string | number>,
) => string;

export function formatNoticeReach(
  reach: NoticeReach,
  scheduled: boolean,
  translate?: Translate,
): string {
  const source = scheduled
    ? 'Will reach {people} people in {flats} flats (as of now)'
    : 'Will reach {people} people in {flats} flats';
  if (translate) return translate(source, reach);
  return source
    .replace('{people}', String(reach.people))
    .replace('{flats}', String(reach.flats));
}
