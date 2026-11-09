// Remove secrets and personal data before errors or context reach any log sink.
export type ScrubbedValue =
  | string
  | number
  | boolean
  | null
  | ScrubbedValue[]
  | { [key: string]: ScrubbedValue };

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 8;
const MAX_STRING_LENGTH = 12_000;

const SENSITIVE_FIELD =
  /^(?:authorization|cookie|setcookie|headers|requestheaders|responseheaders|password|passcode|secret|token|apikey|clientsecret|privatekey|vapidprivatekey|otp|onetimecode|verificationcode|pin|pinhash|authsecret|p256dh|body|requestbody|responsebody|document|photo|image|file|dataurl|buffer|phone|mobile|email|upi|upiid|utr|paymentreference|name|fullname|firstname|lastname|address|ip|ipaddress|forwardedfor)$/;

const AUTH_ASSIGNMENT =
  /\b(authorization|cookie|set-cookie)\b\s*[:=]\s*(?:Bearer\s+)?("[^"]*"|'[^']*'|[^\s,;]+)/gi;
const SECRET_ASSIGNMENT =
  /\b(api[_-]?key|client[_-]?secret|password|passcode|secret|token|pin|utr|payment[-_ ]?reference)\b(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const CONTACT_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\b/gi;
const PHONE_NUMBER = /(?<!\w)(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;
const OTP_VALUE =
  /\b(otp|one[-_ ]?time(?:[-_ ]?(?:password|code))?|verification[-_ ]?code)\b\s*[:=]?\s*\d{4,8}\b/gi;

function scrubText(value: string): string {
  return value
    .replace(AUTH_ASSIGNMENT, '$1: [REDACTED]')
    .replace(SECRET_ASSIGNMENT, '$1$2[REDACTED]')
    .replace(OTP_VALUE, '$1: [REDACTED]')
    .replace(BEARER_TOKEN, 'Bearer [REDACTED]')
    .replace(CONTACT_ADDRESS, REDACTED)
    .replace(PHONE_NUMBER, REDACTED)
    .slice(0, MAX_STRING_LENGTH);
}

function normalizeFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function scrub(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): ScrubbedValue {
  if (value === null || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return scrubText(value);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value !== 'object') {
    return `[${typeof value}]`;
  }
  if (depth >= MAX_DEPTH) {
    return '[TRUNCATED]';
  }
  if (seen.has(value)) {
    return '[CIRCULAR]';
  }
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: scrubText(value.name),
      message: scrubText(value.message),
      ...(value.stack ? { stack: scrubText(value.stack) } : {}),
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, depth + 1, seen));
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? '[INVALID_DATE]'
      : value.toISOString();
  }

  const result: { [key: string]: ScrubbedValue } = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = SENSITIVE_FIELD.test(normalizeFieldName(key))
      ? REDACTED
      : scrub(item, depth + 1, seen);
  }
  return result;
}

export function scrubLogData(value: unknown): ScrubbedValue {
  return scrub(value, 0, new WeakSet());
}

export function scrubLogText(value: string): string {
  return scrubText(value);
}
