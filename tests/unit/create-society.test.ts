// Create-society script input validation, live guard, plan text and idempotent RPC orchestration.
import { describe, expect, it, vi } from 'vitest';
import {
  activationInstructions,
  applyOnboarding,
  assertTargetAllowed,
  buildPlan,
  describeTarget,
  parseOnboardingArgs,
} from '../../scripts/create-society.mjs';

const required = [
  '--slug',
  'Oak-Grove',
  '--name',
  "O'Brien Residency",
  '--address',
  '12 Example Road',
  '--city',
  'Pune',
  '--admin-email',
  'Admin@Example.test',
];

function parse(...extra: string[]) {
  return parseOnboardingArgs([...required, ...extra]);
}

function parsedInput(...extra: string[]) {
  const { input, errors } = parse(...extra);
  expect(errors).toEqual([]);
  if (!input) throw new Error('Expected valid input.');
  return input;
}

const testdb = describeTarget({
  NEXT_PUBLIC_SUPABASE_URL: 'https://oqyagsabodaueghtrocv.supabase.co',
  APP_BASE_DOMAIN: 'homeish.vercel.app',
});

describe('create-society input', () => {
  it('normalises valid input and defaults to a dry run', () => {
    const input = parsedInput();
    expect(input).toMatchObject({
      slug: 'oak-grove',
      adminEmail: 'admin@example.test',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      unitLabel: 'Unit',
      contactEmail: null,
      apply: false,
    });
  });

  it.each([
    [['--slug', 'bad-'], '--slug must be'],
    [['--slug', 'beta'], 'reserved'],
    [['--slug', 'a.b'], '--slug must be'],
    [['--name', 'X'], '--name must be'],
    [['--city', ' '], '--city is required'],
    [['--admin-email', 'not-an-email'], '--admin-email'],
    [['--contact-phone', '12345'], '--contact-phone'],
    [['--timezone', 'Mars/Base'], '--timezone'],
    [['--currency', 'inr'], '--currency'],
    [['--unit-label', 'Flat 1'], '--unit-label'],
    [['--society-id', 'abc'], '--society-id'],
    [['--apply'], '--developer-email'],
    [['--apply', '--dry-run', '--developer-email', 'd@example.test'], 'either'],
    [['--unknown'], 'Unknown option'],
  ])('rejects %j', (extra, message) => {
    const { input, errors } = parse(...extra);
    expect(input).toBeNull();
    expect(errors.join('\n')).toContain(message);
  });

  it('requires the address fields', () => {
    const { errors } = parseOnboardingArgs([
      '--slug',
      'oak',
      '--name',
      'Oak',
      '--admin-email',
      'a@example.test',
    ]);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('--address'),
        expect.stringContaining('--city'),
      ]),
    );
  });
});

describe('create-society target', () => {
  it('refuses homeish-live without --confirm-live', () => {
    const live = describeTarget({
      NEXT_PUBLIC_SUPABASE_URL: 'https://yhwadldjeyirkgbmoctb.supabase.co',
    });
    expect(live.isLive).toBe(true);
    expect(() => assertTargetAllowed(live, parsedInput())).toThrow(
      '--confirm-live',
    );
    expect(() =>
      assertTargetAllowed(live, parsedInput('--confirm-live')),
    ).not.toThrow();
    expect(
      describeTarget({
        NEXT_PUBLIC_SUPABASE_URL: 'https://oqyagsabodaueghtrocv.supabase.co',
        SUPABASE_DB_URL: 'postgresql://postgres.yhwadldjeyirkgbmoctb:x@host/db',
      }).isLive,
    ).toBe(true);
    expect(testdb.isLive).toBe(false);
    expect(() =>
      assertTargetAllowed(describeTarget({}), parsedInput()),
    ).toThrow('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('prints the plan and an escaped activation entry', () => {
    const input = parsedInput();
    const plan = buildPlan(input, testdb);
    expect(plan).toContain('dry run, nothing is written');
    expect(plan).toContain('oqyagsabodaueghtrocv');
    expect(plan).toContain('https://oak-grove.homeish.vercel.app');
    expect(plan).toContain('Leave every optional module disabled');
    expect(activationInstructions(input, testdb)).toContain(
      "{ slug: 'oak-grove', name: 'O\\'Brien Residency', status: 'active' },",
    );
  });
});

type Status = {
  society: null | {
    id: string;
    name: string;
    status: string;
    admins: { email: string; status: string }[];
    enabledModules: string[];
  };
  unaddressedNameMatches: { id: string }[];
};

function fakeRpc(states: Status[]) {
  const calls: string[] = [];
  let index = 0;
  const rpc = vi.fn(async (name: string) => {
    calls.push(name);
    if (name === 'developer_society_onboarding_status') {
      return states[Math.min(index++, states.length - 1)];
    }
    return null;
  });
  return { rpc, calls };
}

const created = (admins: { email: string; status: string }[] = []) => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: "O'Brien Residency",
  status: 'trial',
  admins,
  enabledModules: ['core'],
});

describe('create-society apply', () => {
  const run = (rpc: ReturnType<typeof fakeRpc>['rpc'], ...extra: string[]) =>
    applyOnboarding({
      rpc,
      input: parsedInput(...extra),
      requestId: 'request-1',
      log: () => {},
    });

  it('creates the society and invites the first admin once', async () => {
    const { rpc, calls } = fakeRpc([
      { society: null, unaddressedNameMatches: [] },
      { society: created(), unaddressedNameMatches: [] },
      {
        society: created([{ email: 'admin@example.test', status: 'invited' }]),
        unaddressedNameMatches: [],
      },
    ]);
    const outcome = await run(rpc);
    expect(outcome).toMatchObject({
      society: 'created',
      admin: 'invited',
      enabledModules: ['core'],
    });
    expect(calls).not.toContain('developer_toggle_module');
    expect(rpc).toHaveBeenCalledWith(
      'developer_create_society_with_slug',
      expect.objectContaining({ p_slug: 'oak-grove', p_contact_email: '' }),
    );
  });

  it('reuses an existing society and admin without writing', async () => {
    const { rpc, calls } = fakeRpc([
      {
        society: created([{ email: 'ADMIN@example.test', status: 'active' }]),
        unaddressedNameMatches: [],
      },
    ]);
    expect(await run(rpc)).toMatchObject({
      society: 'reused',
      admin: 'reused',
    });
    expect(calls).toEqual(['developer_society_onboarding_status']);
  });

  it('stops on a different admin, an unaddressed duplicate or a foreign id', async () => {
    await expect(
      run(
        fakeRpc([
          {
            society: created([
              { email: 'other@example.test', status: 'active' },
            ]),
            unaddressedNameMatches: [],
          },
        ]).rpc,
      ),
    ).rejects.toThrow('already has an administrator');
    await expect(
      run(
        fakeRpc([{ society: null, unaddressedNameMatches: [{ id: 'old-id' }] }])
          .rpc,
      ),
    ).rejects.toThrow('--society-id');
    await expect(
      run(
        fakeRpc([{ society: created(), unaddressedNameMatches: [] }]).rpc,
        '--society-id',
        '22222222-2222-4222-8222-222222222222',
      ),
    ).rejects.toThrow('already belongs');
  });

  it('adopts an unaddressed society by id', async () => {
    const { rpc } = fakeRpc([
      { society: null, unaddressedNameMatches: [] },
      {
        society: created([{ email: 'admin@example.test', status: 'invited' }]),
        unaddressedNameMatches: [],
      },
    ]);
    const outcome = await run(
      rpc,
      '--society-id',
      '11111111-1111-4111-8111-111111111111',
    );
    expect(outcome).toMatchObject({ society: 'adopted', admin: 'reused' });
    expect(rpc).toHaveBeenCalledWith(
      'developer_set_society_slug',
      expect.objectContaining({ p_slug: 'oak-grove' }),
    );
  });
});
