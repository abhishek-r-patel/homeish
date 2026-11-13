// Onboard a society onto its own host: plan by default, then create it and invite its first admin with --apply.
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export const LIVE_PROJECT_REF = 'yhwadldjeyirkgbmoctb';
export const RESERVED_SLUGS = ['www', 'demo', 'beta', 'admin', 'api'];
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const USAGE = `Usage: node scripts/with-env.mjs <profile> node scripts/create-society.mjs [options]
       npm run society:create -- [options]   (testdb profile)

Required:
  --slug <slug>              Host address name, e.g. oak-grove -> oak-grove.<APP_BASE_DOMAIN>
  --name <name>              Society name (2-120 characters)
  --address <address>        Street address (up to 120 characters)
  --city <city>              City (up to 120 characters)
  --admin-email <email>      First admin, invited by email
Optional:
  --contact-email <email>    Society office email
  --contact-phone <phone>    10-15 digits, optional leading +
  --timezone <zone>          Default Asia/Kolkata
  --currency <code>          Default INR
  --unit-label <label>       Default Unit (letters and spaces)
  --plan <plan>              Free-text plan label
  --society-id <uuid>        Adopt an existing society that has no address yet
  --developer-email <email>  Developer account that signs in (needed with --apply)
Mode:
  --dry-run                  Print the plan only (default)
  --apply                    Sign in as the developer and make the changes
  --confirm-live             Required to target homeish-live`;

const OPTIONS = {
  slug: { type: 'string' },
  name: { type: 'string' },
  address: { type: 'string' },
  city: { type: 'string' },
  'admin-email': { type: 'string' },
  'contact-email': { type: 'string' },
  'contact-phone': { type: 'string' },
  timezone: { type: 'string', default: 'Asia/Kolkata' },
  currency: { type: 'string', default: 'INR' },
  'unit-label': { type: 'string', default: 'Unit' },
  plan: { type: 'string' },
  'society-id': { type: 'string' },
  'developer-email': { type: 'string' },
  'dry-run': { type: 'boolean', default: false },
  apply: { type: 'boolean', default: false },
  'confirm-live': { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
};

export class OnboardingError extends Error {}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isTimeZone(value) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Mirrors the developer console's society and first-admin rules (src/core/developer/console.ts).
export function parseOnboardingArgs(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, strict: true });
  } catch (error) {
    return { help: false, errors: [error.message], input: null };
  }
  const values = parsed.values;
  if (values.help) return { help: true, errors: [], input: null };

  const errors = [];
  const input = {
    slug: text(values.slug).toLowerCase(),
    name: text(values.name),
    address: text(values.address),
    city: text(values.city),
    adminEmail: text(values['admin-email']).toLowerCase(),
    contactEmail: text(values['contact-email']).toLowerCase() || null,
    contactPhone: text(values['contact-phone']) || null,
    timezone: text(values.timezone),
    currency: text(values.currency),
    unitLabel: text(values['unit-label']),
    plan: text(values.plan) || null,
    societyId: text(values['society-id']).toLowerCase() || null,
    developerEmail: text(values['developer-email']).toLowerCase() || null,
    apply: values.apply,
    confirmLive: values['confirm-live'],
  };

  if (values.apply && values['dry-run']) {
    errors.push('Choose either --dry-run or --apply, not both.');
  }
  if (!SLUG_PATTERN.test(input.slug)) {
    errors.push(
      '--slug must be 1-63 lowercase letters, digits or hyphens, not starting or ending with a hyphen.',
    );
  } else if (RESERVED_SLUGS.includes(input.slug)) {
    errors.push(`--slug "${input.slug}" is reserved for Homeish itself.`);
  }
  if (input.name.length < 2 || input.name.length > 120) {
    errors.push('--name must be 2-120 characters.');
  }
  for (const [flag, value] of [
    ['--address', input.address],
    ['--city', input.city],
  ]) {
    if (value.length < 1 || value.length > 120) {
      errors.push(`${flag} is required and must be at most 120 characters.`);
    }
  }
  if (!EMAIL_PATTERN.test(input.adminEmail) || input.adminEmail.length > 254) {
    errors.push('--admin-email must be a valid email address.');
  }
  if (
    input.contactEmail &&
    (!EMAIL_PATTERN.test(input.contactEmail) || input.contactEmail.length > 254)
  ) {
    errors.push('--contact-email must be a valid email address.');
  }
  if (input.contactPhone && !/^\+?[0-9]{10,15}$/.test(input.contactPhone)) {
    errors.push('--contact-phone must be 10-15 digits with an optional +.');
  }
  if (
    input.timezone.length < 1 ||
    input.timezone.length > 64 ||
    !isTimeZone(input.timezone)
  ) {
    errors.push('--timezone must be an IANA time zone such as Asia/Kolkata.');
  }
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    errors.push('--currency must be a three-letter code such as INR.');
  }
  if (
    input.unitLabel.length < 1 ||
    input.unitLabel.length > 24 ||
    !/^[\p{L} ]+$/u.test(input.unitLabel)
  ) {
    errors.push('--unit-label must be 1-24 letters or spaces.');
  }
  if (input.plan && input.plan.length > 120) {
    errors.push('--plan must be at most 120 characters.');
  }
  if (input.societyId && !UUID_PATTERN.test(input.societyId)) {
    errors.push('--society-id must be a society UUID.');
  }
  if (
    input.apply &&
    (!input.developerEmail || !EMAIL_PATTERN.test(input.developerEmail))
  ) {
    errors.push('--apply needs --developer-email for the developer account.');
  }
  return { help: false, errors, input: errors.length ? null : input };
}

export function describeTarget(env) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const urlRef = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(supabaseUrl);
  const dbRef = /postgres(?:ql)?:\/\/postgres\.([a-z0-9]+)[:@]/.exec(
    env.SUPABASE_DB_URL ?? '',
  );
  const projectRef = urlRef?.[1] ?? null;
  const isLive =
    projectRef === LIVE_PROJECT_REF ||
    dbRef?.[1] === LIVE_PROJECT_REF ||
    env.NEXT_PUBLIC_APP_ENV === 'production';
  return {
    supabaseUrl,
    projectRef,
    isLive,
    baseDomain: env.APP_BASE_DOMAIN || 'homeish.vercel.app',
  };
}

// Live holds real societies: refuse unless the operator says so explicitly.
export function assertTargetAllowed(target, input) {
  if (!target.supabaseUrl) {
    throw new OnboardingError(
      'NEXT_PUBLIC_SUPABASE_URL is not set. Run through a profile, e.g. node scripts/with-env.mjs testdb ...',
    );
  }
  if (target.isLive && !input.confirmLive) {
    throw new OnboardingError(
      'This profile targets homeish-live. Re-run with --confirm-live only from an approved production operator session.',
    );
  }
}

function quoteTs(value) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

export function activationInstructions(input, target) {
  const entry = `  { slug: ${quoteTs(input.slug)}, name: ${quoteTs(input.name)}, status: 'active' },`;
  return [
    `To open https://${input.slug}.${target.baseDomain}, edit src/core/config/societies.ts so reservedSocieties contains:`,
    '',
    entry,
    '',
    `(If "${input.slug}" is already reserved with status: 'disabled', change only its status to 'active'.)`,
    'Then run npm run check and release the change through beta -> main (docs/OPERATIONS.md, Society onboarding).',
  ].join('\n');
}

export function buildPlan(input, target) {
  const label = target.projectRef ?? target.supabaseUrl;
  const societyStep = input.societyId
    ? `Assign address "${input.slug}" to existing society ${input.societyId} (developer_set_society_slug; audited developer.societies.setSlug), unless a society already has that address.`
    : `Reuse the society whose address is "${input.slug}", or create "${input.name}" with that address in one transaction (developer_create_society_with_slug; audited developer.societies.create and developer.societies.setSlug). Stops if a society with this name exists without an address.`;
  return [
    `Create-society plan (${input.apply ? 'apply' : 'dry run, nothing is written'})`,
    `Target Supabase project: ${label}${target.isLive ? ' (homeish-live)' : ''}`,
    `Society: ${input.name}, ${input.address}, ${input.city}`,
    `  timezone ${input.timezone}, currency ${input.currency}, unit label ${input.unitLabel}` +
      `${input.plan ? `, plan ${input.plan}` : ''}` +
      `${input.contactEmail ? `, contact ${input.contactEmail}` : ''}` +
      `${input.contactPhone ? ` ${input.contactPhone}` : ''}`,
    `Host: https://${input.slug}.${target.baseDomain}`,
    'Steps:',
    `  1. Sign in as developer ${input.developerEmail ?? '<--developer-email>'} with password and authenticator code (same MFA session rules as the developer console).`,
    `  2. ${societyStep}`,
    `  3. Invite first admin ${input.adminEmail} (developer_create_first_admin; audited developer.members.createFirstAdmin), unless that admin is already invited. Stops if a different admin exists.`,
    '  4. Leave every optional module disabled (only core is on); enable modules later in the developer console.',
    '  5. Print the code change that activates the host.',
  ].join('\n');
}

function societyOf(status) {
  return status && typeof status === 'object' ? (status.society ?? null) : null;
}

// Idempotent onboarding through the developer RPCs; `rpc` throws on database errors.
export async function applyOnboarding({ rpc, input, requestId, log }) {
  const outcome = { societyId: null, society: 'reused', admin: 'reused' };
  const readStatus = () =>
    rpc('developer_society_onboarding_status', {
      p_slug: input.slug,
      p_name: input.name,
    });

  let status = await readStatus();
  let society = societyOf(status);
  if (society) {
    if (input.societyId && input.societyId !== society.id) {
      throw new OnboardingError(
        `Address "${input.slug}" already belongs to society ${society.id}, not ${input.societyId}.`,
      );
    }
    if (society.name !== input.name) {
      log(
        `Note: the existing society is named "${society.name}"; the name was not changed.`,
      );
    }
  } else if (input.societyId) {
    await rpc('developer_set_society_slug', {
      p_society_id: input.societyId,
      p_slug: input.slug,
      p_request_id: requestId,
    });
    outcome.society = 'adopted';
  } else {
    const matches = status?.unaddressedNameMatches ?? [];
    if (matches.length > 0) {
      throw new OnboardingError(
        `A society named "${input.name}" already exists without an address: ${matches
          .map(({ id }) => id)
          .join(', ')}. Re-run with --society-id <id> to adopt it.`,
      );
    }
    await rpc('developer_create_society_with_slug', {
      p_slug: input.slug,
      p_name: input.name,
      p_address: input.address,
      p_city: input.city,
      p_contact_email: input.contactEmail ?? '',
      p_contact_phone: input.contactPhone ?? '',
      p_timezone: input.timezone,
      p_currency: input.currency,
      p_unit_label: input.unitLabel,
      p_plan: input.plan ?? '',
      p_request_id: requestId,
    });
    outcome.society = 'created';
  }
  if (outcome.society !== 'reused') {
    status = await readStatus();
    society = societyOf(status);
    if (!society) {
      throw new OnboardingError('The society address was not saved.');
    }
  }
  outcome.societyId = society.id;
  if (society.status === 'suspended' || society.status === 'archived') {
    log(`Note: the society status is ${society.status}.`);
  }

  const admins = society.admins ?? [];
  const sameAdmin = admins.find(
    ({ email }) => String(email).toLowerCase() === input.adminEmail,
  );
  if (!sameAdmin && admins.length > 0) {
    throw new OnboardingError(
      `The society already has an administrator (${admins
        .map(({ email, status: state }) => `${email}, ${state}`)
        .join('; ')}); no other first admin was invited.`,
    );
  }
  if (!sameAdmin) {
    await rpc('developer_create_first_admin', {
      p_society_id: society.id,
      p_email: input.adminEmail,
      p_request_id: requestId,
    });
    outcome.admin = 'invited';
    society = societyOf(await readStatus()) ?? society;
  }

  outcome.enabledModules = society.enabledModules ?? [];
  const optional = outcome.enabledModules.filter((key) => key !== 'core');
  if (optional.length > 0) {
    log(
      `Note: optional modules already enabled and left unchanged: ${optional.join(', ')}.`,
    );
  }
  return outcome;
}

async function prompt(question, { hidden = false } = {}) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  let muted = false;
  if (hidden) {
    const write = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (chunk) => {
      if (!muted) write(chunk);
    };
  }
  try {
    const answer = rl.question(question);
    muted = hidden;
    return (await answer).trim();
  } finally {
    if (hidden) process.stdout.write('\n');
    rl.close();
  }
}

function databaseError(name, error) {
  const failure = new OnboardingError(
    `${name} failed${error.code ? ` (${error.code})` : ''}: ${error.message}`,
  );
  failure.code = error.code;
  return failure;
}

// Same sign-in as the developer console: password, verified TOTP factor, then record_developer_mfa.
async function signInDeveloper(env, email) {
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new OnboardingError('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.');
  }
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const password = await prompt(`Password for ${email}: `, { hidden: true });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    throw new OnboardingError('Developer sign-in failed.');
  }
  const access = await client.rpc('session_developer_access');
  if (access.error || !access.data?.[0]?.is_developer_account) {
    await client.auth.signOut({ scope: 'local' });
    throw new OnboardingError('This account is not a developer account.');
  }
  const factors = await client.auth.mfa.listFactors();
  const factor = factors.data?.totp?.[0];
  if (factors.error || !factor) {
    await client.auth.signOut({ scope: 'local' });
    throw new OnboardingError(
      'No verified authenticator. Sign in to the developer console once to enrol it.',
    );
  }
  const code = await prompt('Authenticator code: ');
  const challenge = await client.auth.mfa.challenge({ factorId: factor.id });
  const verified = challenge.error
    ? challenge
    : await client.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.data.id,
        code,
      });
  const recorded = verified.error
    ? verified
    : await client.rpc('record_developer_mfa');
  if (recorded.error) {
    await client.auth.signOut({ scope: 'local' });
    throw new OnboardingError('Authenticator verification failed.');
  }
  return client;
}

async function main() {
  const { help, errors, input } = parseOnboardingArgs(process.argv.slice(2));
  if (help) {
    console.log(USAGE);
    return;
  }
  if (errors.length > 0) {
    throw new OnboardingError(`${errors.join('\n')}\n\n${USAGE}`);
  }
  const target = describeTarget(process.env);
  assertTargetAllowed(target, input);
  console.log(buildPlan(input, target));
  if (!input.apply) {
    console.log('\nNothing was written. Re-run with --apply to make changes.');
    console.log(`\n${activationInstructions(input, target)}`);
    return;
  }
  if (!process.stdin.isTTY) {
    throw new OnboardingError(
      '--apply needs an interactive terminal for the password and authenticator code.',
    );
  }
  const client = await signInDeveloper(process.env, input.developerEmail);
  const requestId = randomUUID();
  try {
    const outcome = await applyOnboarding({
      input,
      requestId,
      log: (line) => console.log(line),
      rpc: async (name, args) => {
        const { data, error } = await client.rpc(name, args);
        if (error) throw databaseError(name, error);
        return data;
      },
    });
    console.log(
      `\nDone (request ${requestId}). Society ${outcome.societyId}: ${outcome.society}; ` +
        `first admin ${input.adminEmail}: ${outcome.admin}; ` +
        `enabled modules: ${outcome.enabledModules.join(', ') || 'none'}.`,
    );
    console.log(`\n${activationInstructions(input, target)}`);
  } finally {
    await client.auth.signOut({ scope: 'local' });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      error instanceof OnboardingError
        ? error.message
        : 'Create-society failed unexpectedly.',
    );
    if (!(error instanceof OnboardingError) && error instanceof Error) {
      console.error(error.message);
    }
    process.exitCode = 1;
  });
}
