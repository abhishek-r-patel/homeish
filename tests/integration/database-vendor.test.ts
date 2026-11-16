// Verify vendor privacy, ratings, the quote rule, separation of duties, approvals, expense drafts and files.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';
import {
  vendorApproveResultSchema,
  vendorDetailSchema,
  vendorRequestDetailSchema,
  vendorWorkspaceSchema,
} from '../../src/core/vendor/validation';

const ACTORS = [
  'admin',
  'admin2',
  'committee',
  'committee2',
  'guard',
  'resident',
  'foreignAdmin',
] as const;
type Actor = (typeof ACTORS)[number];

describe.skipIf(!hasDatabase)('vendor database contracts', () => {
  let database: TestDatabase;
  const users = new Map<Actor, string>();
  let society = '';
  let foreignSociety = '';

  const user = (actor: Actor) => {
    const id = users.get(actor);
    if (!id) throw new Error(`Missing synthetic ${actor}.`);
    return id;
  };
  const asActor = <T>(actor: Actor, run: (client: Client) => Promise<T>) =>
    database.asRole('authenticated', { sub: user(actor) }, run, {
      commit: true,
    });
  const call = async (actor: Actor, name: string, args: unknown[]) => {
    const placeholders = args.map((_, index) => `$${index + 1}`).join(',');
    const result = await asActor(actor, (client) =>
      client.query<{ value: unknown }>(
        `select public.${name}(${placeholders}) as value`,
        args,
      ),
    );
    return result.rows[0]?.value;
  };
  const code = async (action: Promise<unknown>) => (await dbError(action)).code;
  const superuser = <T>(run: (client: Client) => Promise<T>) =>
    database.asSuperuser(run);
  const setModule = (moduleKey: string, enabled: boolean) =>
    superuser((client) =>
      client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,$2,$3,'{}')
         on conflict(society_id,module_key) do update set enabled=excluded.enabled`,
        [society, moduleKey, enabled],
      ),
    );
  const setSettings = (threshold: number, quotes: number, approvals: number) =>
    call('admin', 'vendor_settings_update', [
      society,
      threshold,
      quotes,
      approvals,
      crypto.randomUUID(),
    ]);
  const createVendor = async (
    name: string,
    options: {
      gstin?: string | null;
      targetSociety?: string;
      actor?: Actor;
    } = {},
  ) =>
    (await call(options.actor ?? 'admin', 'vendor_save', [
      options.targetSociety ?? society,
      null,
      name,
      'Plumbing',
      'Synthetic Contact',
      '+91 98765 43210',
      'vendor@example.test',
      options.gstin ?? null,
      null,
      null,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ])) as string;
  const createRequest = async (
    actor: Actor,
    estimate: number,
    category: string | null = null,
  ) =>
    (await call(actor, 'vendor_request_save', [
      society,
      null,
      `Purchase ${crypto.randomUUID().slice(0, 6)}`,
      'Synthetic purchase',
      category,
      estimate,
      null,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ])) as string;
  const addQuote = async (
    actor: Actor,
    request: string,
    vendor: string,
    amount: number,
    filePath: string | null = null,
  ) =>
    (await call(actor, 'vendor_quote_add', [
      society,
      request,
      vendor,
      amount,
      null,
      filePath,
      crypto.randomUUID(),
      crypto.randomUUID(),
    ])) as string;
  const detail = async (request: string, actor: Actor = 'admin') =>
    vendorRequestDetailSchema.parse(
      await call(actor, 'vendor_request_get', [society, request]),
    );
  const select = async (actor: Actor, request: string, quote: string) =>
    call(actor, 'vendor_quote_select', [
      society,
      request,
      quote,
      (await detail(request)).request.version,
      crypto.randomUUID(),
    ]);
  const submit = async (actor: Actor, request: string, traceId?: string) =>
    call(actor, 'vendor_request_submit', [
      society,
      request,
      (await detail(request)).request.version,
      traceId ?? crypto.randomUUID(),
    ]);
  const approve = async (actor: Actor, request: string, traceId?: string) =>
    vendorApproveResultSchema.parse(
      await call(actor, 'vendor_request_approve', [
        society,
        request,
        traceId ?? crypto.randomUUID(),
      ]),
    );
  const notifications = (traceId: string) =>
    superuser(
      async (client) =>
        (
          await client.query<{
            user_id: string;
            type: string;
            entity_type: string;
          }>(
            'select user_id,type,entity_type from public.notifications where request_id=$1',
            [traceId],
          )
        ).rows,
    );
  const expensesFor = (request: string) =>
    superuser(
      async (client) =>
        (
          await client.query<{
            id: string;
            status: string;
            amount_paise: string;
            payee: string;
            payment_mode: string;
            category: string;
          }>(
            `select expense.id,expense.status,expense.amount_paise,expense.payee,
               expense.payment_mode,category.name as category
             from public.expenses as expense
             join public.expense_categories as category on category.id=expense.category_id
             where expense.society_id=$1 and expense.client_request_id=$2`,
            [society, request],
          )
        ).rows,
    );
  /** A request with one selected quote, ready to submit. */
  const readyRequest = async (
    actor: Actor,
    vendor: string,
    amount = 100_000,
  ) => {
    const request = await createRequest(actor, amount, 'Plumbing');
    const quote = await addQuote(actor, request, vendor, amount);
    await select(actor, request, quote);
    return request;
  };

  let plumber = '';

  beforeAll(async () => {
    database = await createTestDatabase();
    await superuser(async (client) => {
      for (const actor of ACTORS) {
        const email = `vendor-${actor.toLowerCase()}@example.test`;
        const id = await newAuthUser(client, email);
        users.set(actor, id);
        await client.query(
          `insert into public.profiles(id,email,full_name) values($1,$2,$3)
           on conflict(id) do update set full_name=excluded.full_name`,
          [id, email, `Synthetic ${actor}`],
        );
      }
      society = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by) values('Vendor A',$1) returning id`,
          [user('admin')],
        )
      ).rows[0]!.id;
      foreignSociety = (
        await client.query<{ id: string }>(
          `insert into public.societies(name,created_by) values('Vendor B',$1) returning id`,
          [user('foreignAdmin')],
        )
      ).rows[0]!.id;
      for (const actor of ACTORS) {
        const role =
          actor.startsWith('admin') || actor === 'foreignAdmin'
            ? 'admin'
            : actor.startsWith('committee')
              ? 'committee'
              : actor;
        await client.query(
          `insert into public.memberships(society_id,user_id,roles,status)
           values($1,$2,array[$3]::text[],'active')`,
          [
            actor === 'foreignAdmin' ? foreignSociety : society,
            user(actor),
            role,
          ],
        );
      }
      await client.query(
        `insert into public.module_configs(society_id,module_key,enabled,settings)
         values($1,'core',true,'{}'),($1,'vendor',true,'{}'),
           ($2,'core',true,'{}'),($2,'vendor',true,'{}'),($2,'expense',true,'{}')`,
        [society, foreignSociety],
      );
    });
    plumber = await createVendor('Synthetic Plumbers', {
      gstin: '27abcde1234f1z5',
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps tables private and limits access to admin and committee of the society', async () => {
    for (const table of [
      'vendors',
      'vendor_documents',
      'vendor_ratings',
      'vendor_purchase_requests',
      'vendor_quotes',
      'vendor_approvals',
    ]) {
      expect(
        await code(
          asActor('admin', (client) =>
            client.query(`select * from public.${table}`),
          ),
        ),
      ).toBe('42501');
    }
    const workspace = vendorWorkspaceSchema.parse(
      await call('committee', 'vendor_workspace_get', [society]),
    );
    expect(workspace.can_manage).toBe(false);
    expect(workspace.settings).toEqual({
      quote_threshold_paise: 2_500_000,
      quotes_above_threshold: 3,
      approvals_required: 1,
    });
    expect(workspace.vendors.map((vendor) => vendor.gstin)).toEqual([
      '27ABCDE1234F1Z5',
    ]);
    for (const actor of ['resident', 'guard', 'foreignAdmin'] as const) {
      expect(await code(call(actor, 'vendor_workspace_get', [society]))).toBe(
        '42501',
      );
      expect(await code(call(actor, 'vendor_get', [society, plumber]))).toBe(
        '42501',
      );
    }
    expect(
      await code(call('admin', 'vendor_get', [foreignSociety, plumber])),
    ).toBe('42501');
    const foreignVendor = await createVendor('Foreign Vendor', {
      targetSociety: foreignSociety,
      actor: 'foreignAdmin',
    });
    expect(
      await code(call('admin', 'vendor_get', [society, foreignVendor])),
    ).toBe('P0002');
    const request = await createRequest('admin', 1000);
    expect(
      await code(
        call('admin', 'vendor_quote_add', [
          society,
          request,
          foreignVendor,
          1000,
          null,
          null,
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('P0002');

    await setModule('vendor', false);
    try {
      expect(await code(call('admin', 'vendor_workspace_get', [society]))).toBe(
        '42501',
      );
      expect(await code(createVendor('Disabled Vendor'))).toBe('42501');
    } finally {
      await setModule('vendor', true);
    }
  });

  it('lets only administrators manage vendors and settings, and validates GSTIN', async () => {
    expect(
      await code(createVendor('Committee Vendor', { actor: 'committee' })),
    ).toBe('42501');
    expect(
      await code(createVendor('Bad GST', { gstin: '27ABCDE1234F1X5' })),
    ).toBe('22023');
    expect(await code(createVendor('synthetic plumbers'))).toBe('23505');
    const clientRequest = crypto.randomUUID();
    const args = [
      society,
      null,
      'Synthetic Electricals',
      'Electrical',
      null,
      null,
      null,
      null,
      null,
      null,
      clientRequest,
      crypto.randomUUID(),
    ];
    const electrician = await call('admin', 'vendor_save', args);
    expect(await call('admin', 'vendor_save', args)).toBe(electrician);
    let vendor = vendorDetailSchema.parse(
      await call('admin', 'vendor_get', [society, electrician]),
    );
    expect(vendor.can_manage).toBe(true);
    expect(
      await code(
        call('admin', 'vendor_set_active', [
          society,
          electrician,
          false,
          99,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('40001');
    await call('admin', 'vendor_set_active', [
      society,
      electrician,
      false,
      vendor.vendor.version,
      crypto.randomUUID(),
    ]);
    vendor = vendorDetailSchema.parse(
      await call('admin', 'vendor_get', [society, electrician]),
    );
    expect(vendor.vendor.active).toBe(false);
    const request = await createRequest('committee', 1000);
    expect(
      await code(addQuote('committee', request, String(electrician), 1000)),
    ).toBe('P0002');

    expect(await code(setSettings(-1, 3, 1))).toBe('22023');
    expect(await code(setSettings(1000, 6, 1))).toBe('22023');
    expect(
      await code(
        call('committee', 'vendor_settings_update', [
          society,
          1000,
          2,
          1,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('42501');
    await setSettings(5_000_000, 2, 2);
    const settings = await superuser(
      async (client) =>
        (
          await client.query<{ settings: unknown }>(
            `select settings from public.module_configs where society_id=$1 and module_key='vendor'`,
            [society],
          )
        ).rows[0]!.settings,
    );
    expect(settings).toEqual({
      quote_threshold_paise: 5_000_000,
      quotes_above_threshold: 2,
      approvals_required: 2,
    });
    await setSettings(2_500_000, 3, 1);
  });

  it('keeps one updatable rating per rater with an average and count', async () => {
    const rate = (actor: Actor, stars: number, comment: string | null = null) =>
      call(actor, 'vendor_rating_save', [
        society,
        plumber,
        stars,
        comment,
        crypto.randomUUID(),
      ]);
    await rate('admin', 4, 'Prompt');
    await rate('committee', 2);
    let vendor = vendorDetailSchema.parse(
      await call('committee', 'vendor_get', [society, plumber]),
    );
    expect([vendor.rating_average, vendor.rating_count]).toEqual([3, 2]);
    await rate('committee', 5, 'Better this time');
    vendor = vendorDetailSchema.parse(
      await call('committee', 'vendor_get', [society, plumber]),
    );
    expect([vendor.rating_average, vendor.rating_count]).toEqual([4.5, 2]);
    expect(vendor.my_rating).toEqual({ stars: 5, comment: 'Better this time' });
    expect(vendor.ratings.find((rating) => rating.mine)?.stars).toBe(5);
    expect(await code(rate('committee', 6))).toBe('22023');
    expect(await code(rate('resident', 3))).toBe('42501');
    const workspace = vendorWorkspaceSchema.parse(
      await call('admin', 'vendor_workspace_get', [society]),
    );
    expect(workspace.vendors.find((row) => row.id === plumber)).toMatchObject({
      rating_average: 4.5,
      rating_count: 2,
    });
  });

  it('applies the quote rule, the audited override and locks quotes after submission', async () => {
    const second = await createVendor('Second Supplier');
    const third = await createVendor('Third Supplier');
    const small = await readyRequest('committee', plumber, 2_499_999);
    expect((await detail(small)).rule).toMatchObject({
      quote_count: 1,
      quotes_required: 1,
      met: true,
    });
    await submit('committee', small);

    const large = await createRequest('committee', 3_000_000);
    const firstQuote = await addQuote('committee', large, plumber, 2_600_000);
    expect(await code(addQuote('committee', large, plumber, 2_700_000))).toBe(
      '23505',
    );
    expect(await code(submit('committee', large))).toBe('23514');
    await select('committee', large, firstQuote);
    expect((await detail(large)).rule).toMatchObject({
      basis_amount_paise: 2_600_000,
      quote_count: 1,
      quotes_required: 3,
      met: false,
    });
    expect(await code(submit('committee', large))).toBe('23514');
    await addQuote('committee', large, second, 2_800_000);
    await addQuote('admin', large, third, 2_900_000);
    expect((await detail(large)).rule).toMatchObject({
      quote_count: 3,
      met: true,
    });
    await submit('committee', large);
    expect(await code(addQuote('committee', large, plumber, 1))).toBe('23514');
    expect(
      await code(
        call('committee', 'vendor_quote_remove', [
          society,
          firstQuote,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('23514');

    // Choosing a cheaper quote below the threshold needs only one quote.
    const cheaper = await createRequest('committee', 3_000_000);
    const cheapQuote = await addQuote('committee', cheaper, plumber, 2_000_000);
    await select('committee', cheaper, cheapQuote);
    expect((await detail(cheaper)).rule).toMatchObject({
      quotes_required: 1,
      met: true,
    });

    // Removing the selected quote clears the selection.
    await call('committee', 'vendor_quote_remove', [
      society,
      cheapQuote,
      crypto.randomUUID(),
    ]);
    expect((await detail(cheaper)).request.selected_quote_id).toBeNull();
    expect((await detail(cheaper)).rule.quote_count).toBe(0);

    const overridden = await readyRequest('committee', plumber, 4_000_000);
    const override = async (
      actor: Actor,
      reason: string | null,
      traceId = crypto.randomUUID(),
    ) =>
      call(actor, 'vendor_quote_override', [
        society,
        overridden,
        reason,
        (await detail(overridden)).request.version,
        traceId,
      ]);
    expect(
      await code(override('committee', 'Only one supplier stocks this')),
    ).toBe('42501');
    expect(await code(override('admin', 'abc'))).toBe('22023');
    const trace = crypto.randomUUID();
    await override('admin', 'Only one supplier stocks this part', trace);
    const overriddenDetail = await detail(overridden);
    expect(overriddenDetail.rule).toMatchObject({
      quote_count: 1,
      quotes_required: 3,
      overridden: true,
      met: true,
    });
    expect(overriddenDetail.request.quote_override_by_name).toBe(
      'Synthetic admin',
    );
    const audit = await superuser(
      async (client) =>
        (
          await client.query<{ action: string; reason: string }>(
            'select action,reason from public.audit_logs where request_id=$1',
            [trace],
          )
        ).rows,
    );
    expect(audit).toEqual([
      {
        action: 'vendor.quote_rule.override',
        reason: 'Only one supplier stocks this part',
      },
    ]);
    await submit('committee', overridden);
    expect((await detail(overridden, 'committee')).request.status).toBe(
      'submitted',
    );
  });

  it('enforces separation of duties, distinct approvals and notifies approvers and requesters', async () => {
    await setSettings(2_500_000, 3, 2);
    const request = await readyRequest('committee', plumber);
    const submitTrace = crypto.randomUUID();
    await submit('committee', request, submitTrace);
    // Settings changes after submission do not move the goalposts.
    await setSettings(2_500_000, 3, 1);
    expect(
      (await notifications(submitTrace)).map((row) => row.user_id).sort(),
    ).toEqual([user('admin'), user('admin2'), user('committee2')].sort());
    expect((await notifications(submitTrace))[0]).toMatchObject({
      type: 'vendor_approval_needed',
      entity_type: 'vendor_purchase_request',
    });

    expect(await code(approve('committee', request))).toBe('42501');
    expect((await detail(request, 'committee')).can_approve).toBe(false);
    expect(
      await code(
        asActor('admin', (client) =>
          client.query(
            `insert into public.vendor_approvals(society_id,request_id,approver_id,approver_role)
             values($1,$2,$3,'committee')`,
            [society, request, user('committee')],
          ),
        ),
      ),
    ).toBe('42501');
    expect(await approve('admin', request)).toMatchObject({
      status: 'submitted',
      approvals: 1,
      approvals_required: 2,
    });
    expect(await code(approve('admin', request))).toBe('23505');
    expect((await detail(request)).can_approve).toBe(false);
    const approveTrace = crypto.randomUUID();
    expect(await approve('committee2', request, approveTrace)).toMatchObject({
      status: 'approved',
      approvals: 2,
      expense_draft_status: 'skipped_disabled',
    });
    expect(await notifications(approveTrace)).toEqual([
      {
        user_id: user('committee'),
        type: 'vendor_request_approved',
        entity_type: 'vendor_purchase_request',
      },
    ]);
    const approved = await detail(request);
    expect(approved.approvals.map((row) => row.approver_role)).toEqual([
      'admin',
      'committee',
    ]);
    expect(approved.request.expense_id).toBeNull();
    expect(await expensesFor(request)).toEqual([]);
    expect(await code(approve('admin2', request))).toBe('23505');
    expect(
      await code(
        call('committee', 'vendor_request_cancel', [
          society,
          request,
          null,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('23505');

    // Rejection needs a reason, cannot come from the requester and notifies them.
    const rejected = await readyRequest('committee', plumber);
    await submit('committee', rejected);
    const reject = (
      actor: Actor,
      reason: string,
      traceId = crypto.randomUUID(),
    ) =>
      call(actor, 'vendor_request_reject', [
        society,
        rejected,
        reason,
        traceId,
      ]);
    expect(await code(reject('committee2', '  '))).toBe('22023');
    expect(await code(reject('committee', 'Changed my mind'))).toBe('42501');
    const rejectTrace = crypto.randomUUID();
    await reject('committee2', 'Too expensive', rejectTrace);
    expect(
      (await notifications(rejectTrace)).map((row) => [row.user_id, row.type]),
    ).toEqual([[user('committee'), 'vendor_request_rejected']]);
    expect((await detail(rejected)).request).toMatchObject({
      status: 'rejected',
      rejection_reason: 'Too expensive',
      decided_by_name: 'Synthetic committee2',
    });
    expect(await code(approve('admin', rejected))).toBe('23505');

    // Only the requester or an administrator can cancel before approval.
    const cancelled = await readyRequest('committee', plumber);
    await submit('committee', cancelled);
    expect(
      await code(
        call('committee2', 'vendor_request_cancel', [
          society,
          cancelled,
          null,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('42501');
    await call('committee', 'vendor_request_cancel', [
      society,
      cancelled,
      'Not needed',
      crypto.randomUUID(),
    ]);
    expect((await detail(cancelled)).request).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'Not needed',
    });
    expect(await code(approve('admin', cancelled))).toBe('23505');
  });

  it('bars whoever submitted or overrode a request from deciding it', async () => {
    const saveDraft = async (
      actor: Actor,
      request: string,
      title: string,
      estimate: number,
    ) =>
      call(actor, 'vendor_request_save', [
        society,
        request,
        title,
        'Synthetic purchase',
        'Plumbing',
        estimate,
        (await detail(request)).request.version,
        null,
        crypto.randomUUID(),
      ]);
    const overrideRule = async (actor: Actor, request: string) =>
      call(actor, 'vendor_quote_override', [
        society,
        request,
        'Only one supplier stocks this part',
        (await detail(request)).request.version,
        crypto.randomUUID(),
      ]);
    const reject = (actor: Actor, request: string) =>
      call(actor, 'vendor_request_reject', [
        society,
        request,
        'Not this one',
        crypto.randomUUID(),
      ]);

    // An administrator who edits and submits someone else's draft cannot decide it.
    const edited = await readyRequest('committee', plumber);
    await saveDraft('admin', edited, 'Edited by the administrator', 100_000);
    await submit('admin', edited);
    expect(await code(approve('admin', edited))).toBe('42501');
    expect(await code(reject('admin', edited))).toBe('42501');
    const submitterView = await detail(edited, 'admin');
    expect(submitterView).toMatchObject({
      can_approve: false,
      can_reject: false,
    });
    expect(submitterView.approval_blocked_reason).toMatch(
      /^You submitted this request/,
    );
    expect((await detail(edited, 'admin2')).approval_blocked_reason).toBeNull();
    expect((await approve('admin2', edited)).status).toBe('approved');

    // The administrator who overrode the quote rule cannot approve, even directly.
    const overridden = await readyRequest('committee', plumber, 3_000_000);
    await overrideRule('admin2', overridden);
    await submit('committee', overridden);
    expect(await code(approve('admin2', overridden))).toBe('42501');
    expect(
      await code(
        asActor('admin2', (client) =>
          client.query(
            `insert into public.vendor_approvals(society_id,request_id,approver_id,approver_role)
             values($1,$2,$3,'admin')`,
            [society, overridden, user('admin2')],
          ),
        ),
      ),
    ).toBe('42501');
    expect(
      (await detail(overridden, 'admin2')).approval_blocked_reason,
    ).toMatch(/^You overrode its quote rule/);
    expect((await approve('admin', overridden)).status).toBe('approved');

    // With no approvals required, a different administrator must approve alone.
    await setSettings(2_500_000, 3, 0);
    try {
      const alone = await readyRequest('committee', plumber, 3_000_000);
      await overrideRule('admin', alone);
      await submit('committee', alone);
      expect(await code(approve('admin', alone))).toBe('42501');
      expect((await detail(alone, 'admin')).approval_blocked_reason).toMatch(
        /different administrator must approve it/,
      );
      expect((await approve('admin2', alone)).status).toBe('approved');
    } finally {
      await setSettings(2_500_000, 3, 1);
    }
  });

  it('clears a quote rule override when the estimate or quotes change', async () => {
    const second = await createVendor('Override Second');
    const third = await createVendor('Override Third');
    const request = await createRequest('committee', 3_000_000, 'Plumbing');
    const first = await addQuote('committee', request, plumber, 2_600_000);
    await select('committee', request, first);
    const overrideRule = async () =>
      call('admin', 'vendor_quote_override', [
        society,
        request,
        'Only one supplier stocks this part',
        (await detail(request)).request.version,
        crypto.randomUUID(),
      ]);
    const saveEstimate = async (estimate: number, title = 'Pump repair') =>
      call('committee', 'vendor_request_save', [
        society,
        request,
        title,
        'Synthetic purchase',
        'Plumbing',
        estimate,
        (await detail(request)).request.version,
        null,
        crypto.randomUUID(),
      ]);
    const expectCleared = async (cause: string) => {
      const view = await detail(request);
      expect(view.request.quote_override_reason).toBeNull();
      expect(view.request.quote_override_by_name).toBeNull();
      expect(view.rule).toMatchObject({ overridden: false, met: false });
      const audit = await superuser(
        async (client) =>
          (
            await client.query<{ cause: string; reason: string }>(
              `select "after"->>'cause' as cause,reason from public.audit_logs
               where entity_id=$1 and action='vendor.quote_rule.override_cleared'
               order by created_at desc, id desc limit 1`,
              [request],
            )
          ).rows,
      );
      expect(audit).toEqual([
        {
          cause,
          reason: 'The quotes or estimate changed after the override.',
        },
      ]);
    };

    await overrideRule();
    // Editing other details keeps the override.
    await saveEstimate(3_000_000, 'Pump repair, renamed');
    expect((await detail(request)).rule.overridden).toBe(true);
    await saveEstimate(3_200_000);
    await expectCleared('estimate_changed');
    expect(await code(submit('committee', request))).toBe('23514');

    await overrideRule();
    const secondQuote = await addQuote('committee', request, second, 2_800_000);
    await expectCleared('quote_added');

    await overrideRule();
    await select('committee', request, secondQuote);
    await expectCleared('quote_selected');

    await overrideRule();
    // Re-selecting the same quote is not a change.
    await select('committee', request, secondQuote);
    expect((await detail(request)).rule.overridden).toBe(true);
    await call('committee', 'vendor_quote_remove', [
      society,
      first,
      crypto.randomUUID(),
    ]);
    await expectCleared('quote_removed');

    await addQuote('committee', request, third, 2_900_000);
    await overrideRule();
    await submit('committee', request);
    expect((await detail(request)).request.status).toBe('submitted');
  });

  it('lets an administrator approve alone when no approvals are required, never their own request', async () => {
    await setSettings(2_500_000, 3, 0);
    try {
      const request = await readyRequest('committee', plumber);
      const trace = crypto.randomUUID();
      await submit('committee', request, trace);
      expect(
        (await notifications(trace)).map((row) => row.user_id).sort(),
      ).toEqual([user('admin'), user('admin2')].sort());
      expect((await detail(request, 'committee2')).can_approve).toBe(false);
      expect(await code(approve('committee2', request))).toBe('42501');
      const approveTrace = crypto.randomUUID();
      expect(await approve('admin', request, approveTrace)).toMatchObject({
        status: 'approved',
        approvals: 1,
        approvals_required: 0,
      });
      const audit = await superuser(
        async (client) =>
          (
            await client.query<{ action: string }>(
              `select action from public.audit_logs where request_id=$1 and action like 'vendor.request.%'`,
              [approveTrace],
            )
          ).rows,
      );
      expect(audit).toEqual([{ action: 'vendor.request.approve_alone' }]);

      const own = await readyRequest('admin', plumber);
      await submit('admin', own);
      expect(await code(approve('admin', own))).toBe('42501');
      expect((await approve('admin2', own)).status).toBe('approved');
    } finally {
      await setSettings(2_500_000, 3, 1);
    }
  });

  it('creates one pending expense draft per approved request when Expenses is on', async () => {
    await setModule('expense', true);
    const noAccount = await readyRequest('committee', plumber, 150_000);
    await submit('committee', noAccount);
    expect((await approve('admin', noAccount)).expense_draft_status).toBe(
      'skipped_no_account',
    );
    expect((await detail(noAccount)).can_retry_expense).toBe(true);
    expect(await expensesFor(noAccount)).toEqual([]);

    await superuser(async (client) => {
      await client.query(
        `insert into public.expense_accounts(society_id,name,account_type,opening_on,created_by)
         values($1,'Cash box','cash',current_date-10,$2),($1,'Main bank','bank',current_date-10,$2)`,
        [society, user('admin')],
      );
      await client.query(
        `insert into public.expense_categories(society_id,name,created_by)
         values($1,'Other',$2),($1,'plumbing',$2) on conflict do nothing`,
        [society, user('admin')],
      );
    });
    expect(
      await code(
        call('committee', 'vendor_expense_draft_retry', [
          society,
          noAccount,
          crypto.randomUUID(),
        ]),
      ),
    ).toBe('42501');
    const retryTrace = crypto.randomUUID();
    expect(
      await call('admin', 'vendor_expense_draft_retry', [
        society,
        noAccount,
        retryTrace,
      ]),
    ).toBe('created');
    expect(
      await call('admin', 'vendor_expense_draft_retry', [
        society,
        noAccount,
        crypto.randomUUID(),
      ]),
    ).toBe('created');
    const drafts = await expensesFor(noAccount);
    expect(drafts).toEqual([
      {
        id: expect.any(String),
        status: 'pending_approval',
        amount_paise: '150000',
        payee: 'Synthetic Plumbers',
        payment_mode: 'bank',
        category: expect.stringMatching(/^plumbing$/i),
      },
    ]);
    expect(
      (await notifications(retryTrace)).map((row) => row.type).sort(),
    ).toEqual(['expense_approval_needed', 'expense_approval_needed']);
    const linked = await detail(noAccount);
    expect(linked.request).toMatchObject({
      expense_id: drafts[0]!.id,
      expense_draft_status: 'created',
      expense_status: 'pending_approval',
    });
    expect(linked.can_retry_expense).toBe(false);

    // The approving member created the draft, so another committee member posts it.
    await asActor('committee2', (client) =>
      client.query('select public.expense_decide($1,$2,true,null,$3)', [
        society,
        drafts[0]!.id,
        'synthetic-trace',
      ]),
    );
    expect((await expensesFor(noAccount))[0]!.status).toBe('posted');

    const direct = await readyRequest('committee', plumber, 90_000);
    await submit('committee', direct);
    expect((await approve('admin', direct)).expense_draft_status).toBe(
      'created',
    );
    expect(await expensesFor(direct)).toHaveLength(1);
    expect(
      await code(
        superuser((client) =>
          client.query(
            `update public.vendor_purchase_requests set expense_id=$2 where id=$1`,
            [direct, drafts[0]!.id],
          ),
        ),
      ),
    ).toBe('23505');

    await setModule('expense', false);
    const off = await readyRequest('committee', plumber, 80_000);
    await submit('committee', off);
    expect((await approve('admin', off)).expense_draft_status).toBe(
      'skipped_disabled',
    );
    expect((await detail(off)).can_retry_expense).toBe(false);
    expect(await expensesFor(off)).toEqual([]);
  });

  it('caps approver notifications', async () => {
    await superuser(async (client) => {
      for (let index = 0; index < 55; index += 1) {
        const id = await newAuthUser(
          client,
          `vendor-bulk-${index}@example.test`,
        );
        await client.query(
          `insert into public.profiles(id,email,full_name) values($1,$2,'Synthetic bulk')`,
          [id, `vendor-bulk-${index}@example.test`],
        );
        await client.query(
          `insert into public.memberships(society_id,user_id,roles,status)
           values($1,$2,array['committee']::text[],'active')`,
          [society, id],
        );
      }
    });
    const request = await readyRequest('committee', plumber);
    const trace = crypto.randomUUID();
    await submit('committee', request, trace);
    expect(await notifications(trace)).toHaveLength(50);
  });

  it('stores vendor files privately with audited links and lists orphans for retention', async () => {
    const pathFor = (actor: Actor, extension = 'pdf') =>
      `${society}/vendors/${user(actor)}/${crypto.randomUUID()}.${extension}`;
    const upload = (actor: Actor, path: string, mimetype = 'application/pdf') =>
      asActor(actor, (client) =>
        client.query(
          `insert into storage.objects(bucket_id,name,metadata) values('vendor-files',$1,$2)`,
          [path, { mimetype, size: 2048 }],
        ),
      );
    const visible = (actor: Actor, path: string) =>
      asActor(
        actor,
        async (client) =>
          (
            await client.query(
              `select 1 from storage.objects where bucket_id='vendor-files' and name=$1`,
              [path],
            )
          ).rowCount,
      );

    expect(await code(upload('admin', pathFor('committee')))).toBe('42501');
    expect(await code(upload('resident', pathFor('resident')))).toBe('42501');
    const documentPath = pathFor('admin');
    await upload('admin', documentPath);
    expect(await visible('admin', documentPath)).toBe(1);
    expect(await visible('committee', documentPath)).toBe(0);
    const addDocument = (actor: Actor, path: string) =>
      call(actor, 'vendor_document_add', [
        society,
        plumber,
        'Trade licence',
        path,
        crypto.randomUUID(),
        crypto.randomUUID(),
      ]);
    expect(await code(addDocument('committee', documentPath))).toBe('42501');
    const mismatched = pathFor('admin', 'png');
    await upload('admin', mismatched);
    expect(await code(addDocument('admin', mismatched))).toBe('22023');
    const document = await addDocument('admin', documentPath);
    expect(await code(addDocument('admin', documentPath))).toBe('22023');

    const quotePath = pathFor('committee', 'jpg');
    await upload('committee', quotePath, 'image/jpeg');
    const request = await createRequest('committee', 1000);
    await addQuote('committee', request, plumber, 1000, quotePath);
    expect((await detail(request)).quotes[0]).toMatchObject({
      file_path: quotePath,
      file_content_type: 'image/jpeg',
    });

    expect(await visible('committee', documentPath)).toBe(0);
    const issued = await call('committee', 'vendor_file_issue', [
      society,
      documentPath,
      crypto.randomUUID(),
    ]);
    expect(issued).toMatchObject({
      path: documentPath,
      file_name: 'Trade licence.pdf',
    });
    expect(await visible('committee', documentPath)).toBe(1);
    expect(await visible('admin', quotePath)).toBe(0);
    await call('admin', 'vendor_file_issue', [
      society,
      quotePath,
      crypto.randomUUID(),
    ]);
    expect(await visible('admin', quotePath)).toBe(1);
    for (const actor of ['resident', 'guard', 'foreignAdmin'] as const) {
      expect(
        await code(
          call(actor, 'vendor_file_issue', [society, documentPath, 'x']),
        ),
      ).toBe('42501');
      expect(await visible(actor, documentPath)).toBe(0);
    }
    expect(
      await code(
        call('admin', 'vendor_file_issue', [society, mismatched, 'x']),
      ),
    ).toBe('P0002');

    await call('admin', 'vendor_document_archive', [
      society,
      document,
      crypto.randomUUID(),
    ]);
    const vendor = vendorDetailSchema.parse(
      await call('admin', 'vendor_get', [society, plumber]),
    );
    expect(
      vendor.documents.find((row) => row.id === document)?.archived_at,
    ).not.toBeNull();

    await superuser((client) =>
      client.query(
        `update storage.objects set created_at=now()-interval '2 days' where bucket_id='vendor-files'`,
      ),
    );
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(new Date());
    const listed = await database.asRole(
      'service_role',
      {},
      async (client) =>
        (
          await client.query<{ bucket: string; path: string }>(
            'select bucket,path from public.vendor_retention_files_list($1)',
            [today],
          )
        ).rows,
    );
    expect(listed).toEqual([{ bucket: 'vendor-files', path: mismatched }]);
    expect(
      await code(call('admin', 'vendor_retention_files_list', [today])),
    ).toBe('42501');
  });
});
