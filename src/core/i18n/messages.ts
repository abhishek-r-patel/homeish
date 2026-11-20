// Combine draft Hindi message sets for the client and static coverage tests.
import { HI_ADMIN } from './catalogs/hi-admin';
import { HI_AUTH } from './catalogs/hi-auth';
import { HI_COMMON } from './catalogs/hi-common';
import { HI_COMMUNICATION } from './catalogs/hi-communication';
import { HI_COMPONENTS } from './catalogs/hi-components';
import { HI_ENGAGEMENT } from './catalogs/hi-engagement';
import { HI_GUARD } from './catalogs/hi-guard';
import { HI_HELP_LETTERS } from './catalogs/hi-help-letters';
import { HI_MANAGEMENT } from './catalogs/hi-management';
import { HI_OPERATIONS } from './catalogs/hi-operations';
import { HI_RESIDENT } from './catalogs/hi-resident';
import { HI_TOOLKIT } from './catalogs/hi-toolkit';
import { HI_UI } from './catalogs/hi-ui';
import { formatLocalizedDate, formatLocalizedNumber } from './format';

const ENGLISH_SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
];

function localizeCommunityWallTime(value: string) {
  const parts =
    /^(\d{1,2}) ([A-Za-z]+) (\d{4}), (\d{1,2}:\d{2})\s*([ap]m)$/i.exec(value);
  const month = parts
    ? ENGLISH_SHORT_MONTHS.findIndex(
        (name) =>
          name.toLowerCase() === parts[2]!.toLowerCase() ||
          (name === 'Sept' && parts[2]!.toLowerCase() === 'sep'),
      )
    : -1;
  if (!parts || month < 0) {
    throw new Error(`Unsupported community feedback date: ${value}`);
  }
  const day = new Date(Date.UTC(Number(parts[3]), month, Number(parts[1])));
  return `${formatLocalizedDate(day, 'hi', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}, ${parts[4]} ${parts[5]!.toLowerCase()}`;
}

export const HINDI_MESSAGES: Readonly<Record<string, string>> = {
  ...HI_COMMON,
  ...HI_COMPONENTS,
  ...HI_ENGAGEMENT,
  ...HI_MANAGEMENT,
  ...HI_AUTH,
  ...HI_RESIDENT,
  ...HI_ADMIN,
  ...HI_OPERATIONS,
  ...HI_GUARD,
  ...HI_UI,
  ...HI_TOOLKIT,
  ...HI_HELP_LETTERS,
  ...HI_COMMUNICATION,
};

export type MessageValues = Readonly<Record<string, string | number>>;

export function translateMessage(
  locale: 'en' | 'hi',
  source: string,
  values?: MessageValues,
): string {
  const message =
    locale === 'en'
      ? source
      : Object.hasOwn(HINDI_MESSAGES, source)
        ? HINDI_MESSAGES[source]
        : undefined;
  if (message === undefined) {
    throw new Error(`Missing Hindi translation for: ${source}`);
  }
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = values?.[key];
    if (value === undefined) {
      throw new Error(`Missing interpolation value "${key}" for: ${source}`);
    }
    return String(value);
  });
}

export function translateFeedbackMessage(
  locale: 'en' | 'hi',
  source: string,
): string {
  if (!source || locale === 'en') return source;
  if (Object.hasOwn(HINDI_MESSAGES, source))
    return translateMessage(locale, source);
  if (
    [
      'Failed to fetch',
      'fetch failed',
      'Load failed',
      'NetworkError when attempting to fetch resource.',
    ].includes(source)
  ) {
    return translateMessage(
      locale,
      'Could not reach the server. Your details remain here; reconnect and retry.',
    );
  }
  if (
    [
      'signal timed out',
      'The operation was aborted due to timeout',
      'The operation timed out.',
    ].includes(source)
  ) {
    return translateMessage(locale, 'The request timed out. Retry.');
  }
  const referenced = /^(.+) Reference: ([a-zA-Z0-9_-]{1,128})$/.exec(source);
  if (referenced) {
    return `${translateFeedbackMessage(locale, referenced[1]!)} ${translateMessage(locale, 'Reference: {id}', { id: referenced[2]! })}`;
  }

  const tenantMove =
    /^Confirm the actual tenant move-in date for (.+) before applying occupancy rules\.$/.exec(
      source,
    );
  if (tenantMove)
    return translateMessage(
      locale,
      'Confirm the actual tenant move-in date for {unit} before applying occupancy rules.',
      { unit: tenantMove[1]! },
    );
  const missingBase =
    /^No base charge is available for (.+) this month\. Include the base charge in the run\.$/.exec(
      source,
    );
  if (missingBase)
    return translateMessage(
      locale,
      'No base charge is available for {unit} this month. Include the base charge in the run.',
      { unit: missingBase[1]! },
    );
  const missingCustom = /^Enter the custom amount for (.+) on (.+)\.$/.exec(
    source,
  );
  if (missingCustom)
    return translateMessage(
      locale,
      'Enter the custom amount for {charge} on {unit}.',
      { charge: missingCustom[1]!, unit: missingCustom[2]! },
    );

  const stringBound =
    /^Too (small|big): expected string to have (>=|<=)(\d+) characters$/.exec(
      source,
    );
  if (stringBound) {
    return translateMessage(
      locale,
      stringBound[1] === 'small'
        ? 'Enter at least {count} characters.'
        : 'Enter no more than {count} characters.',
      { count: formatLocalizedNumber(BigInt(stringBound[3]!), locale) },
    );
  }
  const arrayBound =
    /^Too (small|big): expected array to have (>=|<=)(\d+) items$/.exec(source);
  if (arrayBound) {
    return translateMessage(
      locale,
      arrayBound[1] === 'small'
        ? 'Select at least {count} items.'
        : 'Select no more than {count} items.',
      { count: formatLocalizedNumber(BigInt(arrayBound[3]!), locale) },
    );
  }
  const numberBound =
    /^Too (?:small|big): expected (?:number|int|bigint) to be (>=|>|<=|<)(-?\d+(?:\.\d+)?)$/.exec(
      source,
    );
  if (numberBound) {
    const labels: Readonly<Record<string, string>> = {
      '>=': 'Enter a number greater than or equal to {value}.',
      '>': 'Enter a number greater than {value}.',
      '<=': 'Enter a number less than or equal to {value}.',
      '<': 'Enter a number less than {value}.',
    };
    return translateMessage(locale, labels[numberBound[1]!]!, {
      value: numberBound[2]!,
    });
  }
  if (
    /^Invalid input: expected [a-z]+, received [a-z]+$/.test(source) ||
    source === 'Invalid input'
  ) {
    return translateMessage(locale, 'Enter a valid value.');
  }
  if (/^Invalid option: expected (?:one of |)/.test(source)) {
    return translateMessage(locale, 'Choose one of the available options.');
  }
  if (/^Unrecognized keys?: /.test(source)) {
    return translateMessage(
      locale,
      'Remove unsupported form fields and retry.',
    );
  }
  if (
    /^Invalid string: must (?:match pattern|start with|end with|include) /.test(
      source,
    )
  ) {
    return translateMessage(locale, 'Enter a value in the required format.');
  }
  const multiple =
    /^Invalid number: must be a multiple of (\d+(?:\.\d+)?)$/.exec(source);
  if (multiple) {
    return translateMessage(locale, 'Enter a multiple of {value}.', {
      value: multiple[1]!,
    });
  }
  const unitChoice = /^Choose your (.+)\.$/.exec(source);
  if (unitChoice) {
    return translateMessage(locale, 'Choose your {unit}.', {
      unit: unitChoice[1]!,
    });
  }
  const noteLimit = /^Keep the note under (\d+) characters\.$/.exec(source);
  if (noteLimit) {
    return translateMessage(locale, 'Keep the note under {count} characters.', {
      count: noteLimit[1]!,
    });
  }
  const rsvp =
    /^RSVP saved: (\d+) going\.(?: ₹(\d+)\.(\d{2}) is on your flat’s bill\.)?$/.exec(
      source,
    );
  if (rsvp) {
    const saved = translateMessage(locale, 'RSVP saved: {count} going.', {
      count: formatLocalizedNumber(BigInt(rsvp[1]!), locale),
    });
    return rsvp[2]
      ? `${saved} ${translateMessage(
          locale,
          '{amount} is on your flat’s bill.',
          {
            amount: `₹${formatLocalizedNumber(BigInt(rsvp[2]), locale)}.${rsvp[3]}`,
          },
        )}`
      : saved;
  }
  const eventChanges =
    /^(Changes saved(?: and invited homes notified)?\.) (.+)$/.exec(source);
  if (eventChanges) {
    return `${translateMessage(locale, eventChanges[1]!)} ${translateFeedbackMessage(locale, eventChanges[2]!)}`;
  }
  const withdrawn =
    /^(\d+) (flat|flats) (?:was|were) withdrawn and (\d+) refunded\.$/.exec(
      source,
    );
  if (withdrawn) {
    return translateMessage(
      locale,
      withdrawn[2] === 'flat'
        ? '{count} flat was withdrawn and {refunded} refunded.'
        : '{count} flats were withdrawn and {refunded} refunded.',
      {
        count: formatLocalizedNumber(BigInt(withdrawn[1]!), locale),
        refunded: formatLocalizedNumber(BigInt(withdrawn[3]!), locale),
      },
    );
  }
  const shortNotice =
    /^(Changes saved(?: and invitees notified)?\.|Meeting scheduled and invitees notified\.) Notice is shorter than the society’s (\d+)-day rule\.$/.exec(
      source,
    );
  if (shortNotice) {
    return `${translateMessage(locale, shortNotice[1]!)} ${translateMessage(
      locale,
      'Notice is shorter than the society’s {count}-day rule.',
      {
        count: formatLocalizedNumber(BigInt(shortNotice[2]!), locale),
      },
    )}`;
  }
  const listingRenewed = /^Listing renewed until (.+) IST\.$/.exec(source);
  const mutedUntil = /^Muted until (.+) IST\. The resident was told\.$/.exec(
    source,
  );
  const communityDate = listingRenewed?.[1] ?? mutedUntil?.[1];
  if (communityDate) {
    return translateMessage(
      locale,
      listingRenewed
        ? 'Listing renewed until {date} IST.'
        : 'Muted until {date} IST. The resident was told.',
      { date: localizeCommunityWallTime(communityDate) },
    );
  }
  const muted =
    /^An administrator has paused your posting in Community \(([\s\S]*)\)\. You can still read posts and listings\.$/.exec(
      source,
    );
  if (muted) {
    return translateMessage(
      locale,
      'An administrator has paused your posting in Community ({details}). You can still read posts and listings.',
      { details: muted[1]! },
    );
  }
  const checkpoint = /^([\s\S]+) recorded\.$/.exec(source);
  if (checkpoint) {
    return translateMessage(locale, '{name} recorded.', {
      name: checkpoint[1]!,
    });
  }
  const approvals = /^Approval recorded: (\d+) of (\d+)\.$/.exec(source);
  if (approvals) {
    return translateMessage(
      locale,
      'Approval recorded: {count} of {required}.',
      {
        count: formatLocalizedNumber(BigInt(approvals[1]!), locale),
        required: formatLocalizedNumber(BigInt(approvals[2]!), locale),
      },
    );
  }
  const approved =
    /^Request approved\. The requester has been notified\. (.+)$/.exec(source);
  const expenseDraftMessages = [
    'Expense draft created and waiting for committee approval.',
    'No expense draft: the Expenses module is off.',
    'No expense draft yet: add an active bank or cash account in Expenses, then retry.',
    'No expense draft yet: add an expense category in Expenses, then retry.',
    'No expense draft yet: this month is closed in Expenses. Reopen it, then retry.',
  ];
  if (approved && expenseDraftMessages.includes(approved[1]!)) {
    return `${translateMessage(locale, 'Request approved. The requester has been notified.')} ${translateMessage(locale, approved[1]!)}`;
  }
  const handledBy = /^Handled by ([\s\S]+)\.$/.exec(source);
  if (handledBy) {
    return translateMessage(locale, 'Handled by {name}.', {
      name: handledBy[1]!,
    });
  }
  const countMessages: ReadonlyArray<readonly [RegExp, string]> = [
    [/^(\d+) bill generated\.$/, '{count} bill generated.'],
    [/^(\d+) bills generated\.$/, '{count} bills generated.'],
    [/^Export ready with (\d+) row\.$/, 'Export ready with {count} row.'],
    [/^Export ready with (\d+) rows\.$/, 'Export ready with {count} rows.'],
    [
      /^Event published and (\d+) person notified\.$/,
      'Event published and {count} person notified.',
    ],
    [
      /^Event published and (\d+) people notified\.$/,
      'Event published and {count} people notified.',
    ],
    [
      /^Event cancelled, invited homes notified and (\d+) flat credited\.$/,
      'Event cancelled, invited homes notified and {count} flat credited.',
    ],
    [
      /^Event cancelled, invited homes notified and (\d+) flats credited\.$/,
      'Event cancelled, invited homes notified and {count} flats credited.',
    ],
    [
      /^(\d+) flat no longer invited was refunded\.$/,
      '{count} flat no longer invited was refunded.',
    ],
    [
      /^(\d+) flats no longer invited were refunded\.$/,
      '{count} flats no longer invited were refunded.',
    ],
    [/^(\d+) flat was withdrawn\.$/, '{count} flat was withdrawn.'],
    [/^(\d+) flats were withdrawn\.$/, '{count} flats were withdrawn.'],
    [
      /^(\d+) person found\. Choose an owner below\.$/,
      '{count} person found. Choose an owner below.',
    ],
    [
      /^(\d+) people found\. Choose an owner below\.$/,
      '{count} people found. Choose an owner below.',
    ],
    [/^Use up to (\d+) characters\.$/, 'Use up to {count} characters.'],
    [
      /^Keep photos for at least (\d+) day\.$/,
      'Keep photos for at least {count} day.',
    ],
    [
      /^Keep photos for at most (\d+) days\.$/,
      'Keep photos for at most {count} days.',
    ],
    [
      /^A visitor pass can last at most (\d+) hours\.$/,
      'A visitor pass can last at most {count} hours.',
    ],
    [
      /^You can send (\d+) wrong-parking reports an hour\. Try again later\.$/,
      'You can send {count} wrong-parking reports an hour. Try again later.',
    ],
    [
      /^A rejection reason needs at least (\d+) characters\.$/,
      'A rejection reason needs at least {count} characters.',
    ],
    [
      /^Keep the reason within (\d+) characters\.$/,
      'Keep the reason within {count} characters.',
    ],
    [
      /^Give a reason of at least (\d+) characters\.$/,
      'Give a reason of at least {count} characters.',
    ],
  ];
  for (const [pattern, message] of countMessages) {
    const match = pattern.exec(source);
    if (match) {
      return translateMessage(locale, message, {
        count: formatLocalizedNumber(BigInt(match[1]!), locale),
      });
    }
  }
  const meterBilling =
    /^(\d+) charges? added to (\d+) bills? \(([^)]+)\)\.(?: (\d+) waiting for a rate\.)?( Run again to bill the rest\.)?$/.exec(
      source,
    );
  if (meterBilling) {
    const parts = [
      translateMessage(
        locale,
        '{charges} charges added to {bills} bills ({amount}).',
        {
          charges: formatLocalizedNumber(BigInt(meterBilling[1]!), locale),
          bills: formatLocalizedNumber(BigInt(meterBilling[2]!), locale),
          amount: meterBilling[3]!,
        },
      ),
    ];
    if (meterBilling[4]) {
      parts.push(
        translateMessage(locale, '{count} waiting for a rate.', {
          count: formatLocalizedNumber(BigInt(meterBilling[4]), locale),
        }),
      );
    }
    if (meterBilling[5])
      parts.push(translateMessage(locale, 'Run again to bill the rest.'));
    return parts.join(' ');
  }
  return translateMessage(locale, source);
}
