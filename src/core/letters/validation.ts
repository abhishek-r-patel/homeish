// Letter types, their source records and the validated draft a user downloads as a PDF.
import { z } from 'zod';
import type { ModuleKey } from '../permissions';

export const LETTER_TYPES = [
  'dues_reminder',
  'dues_final_notice',
  'member_welcome',
  'complaint_acknowledgement',
  'rule_violation_warning',
  'hall_booking_confirmation',
  'vendor_work_order',
  'utility_shutdown',
  'circular',
  'event_announcement',
  'annual_newsletter',
] as const;
export type LetterType = (typeof LETTER_TYPES)[number];

export const LETTER_SOURCE_TYPES = [
  'billing_bill',
  'membership',
  'service_request',
  'amenity_booking',
  'vendor_work_order',
] as const;
export type LetterSourceType = (typeof LETTER_SOURCE_TYPES)[number];

export interface LetterTypeConfig {
  label: string;
  module: ModuleKey;
  sourceType: LetterSourceType | null;
  // Dues and rule letters must stay neutral: facts and a request to pay, comply or contact the office.
  neutralWording: boolean;
}

export const LETTER_TYPE_CONFIG: Readonly<
  Record<LetterType, LetterTypeConfig>
> = {
  dues_reminder: {
    label: 'Dues reminder',
    module: 'billing',
    sourceType: 'billing_bill',
    neutralWording: true,
  },
  dues_final_notice: {
    label: 'Dues final notice',
    module: 'billing',
    sourceType: 'billing_bill',
    neutralWording: true,
  },
  member_welcome: {
    label: 'Member welcome',
    module: 'core',
    sourceType: 'membership',
    neutralWording: false,
  },
  complaint_acknowledgement: {
    label: 'Complaint acknowledgement',
    module: 'service_request',
    sourceType: 'service_request',
    neutralWording: false,
  },
  rule_violation_warning: {
    label: 'Rule reminder',
    module: 'core',
    sourceType: null,
    neutralWording: true,
  },
  hall_booking_confirmation: {
    label: 'Hall booking confirmation',
    module: 'amenity',
    sourceType: 'amenity_booking',
    neutralWording: false,
  },
  vendor_work_order: {
    label: 'Vendor work order',
    module: 'vendor',
    sourceType: 'vendor_work_order',
    neutralWording: false,
  },
  utility_shutdown: {
    label: 'Utility shutdown notice',
    module: 'core',
    sourceType: null,
    neutralWording: false,
  },
  circular: {
    label: 'Circular',
    module: 'core',
    sourceType: null,
    neutralWording: false,
  },
  event_announcement: {
    label: 'Event announcement',
    module: 'core',
    sourceType: null,
    neutralWording: false,
  },
  annual_newsletter: {
    label: 'Annual newsletter',
    module: 'core',
    sourceType: null,
    neutralWording: false,
  },
};

export const LETTER_SOURCE_LABELS: Readonly<Record<LetterSourceType, string>> =
  {
    billing_bill: 'Bill',
    membership: 'Member',
    service_request: 'Service request',
    amenity_booking: 'Amenity booking',
    vendor_work_order: 'Work order',
  };

export const LETTER_FOOTER =
  'Draft prepared in Homeish — review before sending';

export const LETTER_LIMITS = {
  recipient: 400,
  subject: 200,
  body: 12000,
} as const;

// Matches threats and pressure only, so a bill's own title such as "Late fee" or "Fine" stays allowed.
const DISCOURAGED_PATTERNS: readonly RegExp[] = [
  /\bpenalt(?:y|ies)\b/i,
  /\b(?:be|been|get|gets) fined\b/i,
  /\b(?:impose|levy|charge) (?:a )?fines?\b/i,
  /\binterest (?:at|on|of \d|charges?|will)\b/i,
  /\d+(?:\.\d+)?\s*%\s*(?:interest|per (?:month|annum))/i,
  /\blegal\b/i,
  /\bcourts?\b/i,
  /\b(?:lawyers?|advocates?|solicitors?)\b/i,
  /\bpolice\b/i,
  /\bdisconnect(?:ed|ion)?\b/i,
  /\bcut off\b/i,
  /\bdefaulters?\b/i,
  /\bblacklist(?:ed)?\b/i,
  /\bseiz(?:e|ed|ure)\b/i,
  /\bevict(?:ed|ion)?\b/i,
  /\brecovery (?:action|proceedings)\b/i,
  /\b(?:strict|necessary|appropriate|further) action\b/i,
  /\bconsequences?\b/i,
  /\bfailing which\b/i,
  /\bwithin \d+ (?:hours?|days?|weeks?)\b/i,
  /\bdeadline\b/i,
  /\bultimatum\b/i,
];

export function findDiscouragedWording(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of DISCOURAGED_PATTERNS) {
    const match = pattern.exec(text);
    if (match) found.add(match[0].toLowerCase());
  }
  return [...found];
}

export function neutralWordingMessage(terms: readonly string[]) {
  return `Keep this letter neutral. Remove: ${terms.join(', ')}. State the facts and ask the reader to pay, follow the rule or contact the office.`;
}

const draftText = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'Enter this part of the letter.')
    .max(max, `Keep this under ${max} characters.`);

export const letterDraftSchema = z
  .object({
    letterType: z.enum(LETTER_TYPES),
    sourceId: z.uuid().nullable(),
    sourceDate: z.iso.date().nullable(),
    letterDate: z.iso.date(),
    recipient: draftText(LETTER_LIMITS.recipient),
    subject: draftText(LETTER_LIMITS.subject),
    body: draftText(LETTER_LIMITS.body),
  })
  .strict()
  .superRefine((draft, issues) => {
    const config = LETTER_TYPE_CONFIG[draft.letterType];
    if (config.sourceType && !draft.sourceId) {
      issues.addIssue({
        code: 'custom',
        path: ['sourceId'],
        message: `Choose the ${LETTER_SOURCE_LABELS[config.sourceType].toLowerCase()} this letter is about.`,
      });
    }
    if (!config.sourceType && draft.sourceId) {
      issues.addIssue({
        code: 'custom',
        path: ['sourceId'],
        message: 'This letter type is not linked to a record.',
      });
    }
    if (config.sourceType === 'amenity_booking' && !draft.sourceDate) {
      issues.addIssue({
        code: 'custom',
        path: ['sourceDate'],
        message: 'Choose the booking date.',
      });
    }
    if (config.neutralWording) {
      for (const field of ['subject', 'body'] as const) {
        const terms = findDiscouragedWording(draft[field]);
        if (terms.length) {
          issues.addIssue({
            code: 'custom',
            path: [field],
            message: neutralWordingMessage(terms),
          });
        }
      }
    }
  });

export type LetterDraft = z.infer<typeof letterDraftSchema>;

export const letterGenerationLogSchema = z.object({
  id: z.uuid(),
  letter_type: z.string(),
  source_type: z.string().nullable(),
  source_id: z.uuid().nullable(),
  generated_by_name: z.string().nullable(),
  generated_at: z.string(),
});
export type LetterGenerationLog = z.infer<typeof letterGenerationLogSchema>;

export function isLetterType(value: unknown): value is LetterType {
  return (
    typeof value === 'string' &&
    (LETTER_TYPES as readonly string[]).includes(value)
  );
}

export function letterFileName(type: LetterType, letterDate: string) {
  return `letter-${type.replace(/_/g, '-')}-${letterDate}.pdf`;
}
