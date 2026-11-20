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
      pan?: string | null;
      paymentTermsDays?: number | null;
      onboardedDate?: string | null;
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
      options.pan ?? null,
      options.paymentTermsDays ?? null,
      options.onboardedDate ?? null,
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

  it('lets only administrators manage vendor details and settings', async () => {
    expect(
      await code(createVendor('Committee Vendor', { actor: 'committee' })),
    ).toBe('42501');
    expect(
      await code(createVendor('Bad GST', { gstin: '27ABCDE1234F1X5' })),
    ).toBe('22023');
    expect(await code(createVendor('Bad PAN', { pan: 'not-a-pan' }))).toBe(
      '22023',
    );
    expect(
      await code(createVendor('Bad Terms', { paymentTermsDays: 366 })),
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
      'abcde1234f',
      0,
      '2026-01-15',
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
    expect(vendor.vendor).toMatchObject({
      pan: 'ABCDE1234F',
      payment_terms_days: 0,
      onboarded_date: '2026-01-15',
      blacklisted: false,
      blacklist_reason: null,
    });
    const committeeVendor = vendorDetailSchema.parse(
      await call('committee', 'vendor_get', [society, electrician]),
    );
    expect(committeeVendor.vendor.pan).toBeNull();
    expect(committeeVendor.vendor.payment_terms_days).toBe(0);
    await call('admin', 'vendor_save', [
      society,
      electrician,
      'Synthetic Electricals Updated',
      'Electrical',
      null,
      null,
      null,
      null,
      null,
      vendor.vendor.version,
      null,
      crypto.randomUUID(),
    ]);
    vendor = vendorDetailSchema.parse(
      await call('admin', 'vendor_get', [society, electrician]),
    );
    expect(vendor.vendor).toMatchObject({
      name: 'Synthetic Electricals Updated',
      pan: 'ABCDE1234F',
      payment_terms_days: 0,
      onboarded_date: '2026-01-15',
    });
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

  it('audits blacklist changes without blocking quotes or changing old records', async () => {
    const vendorId = await createVendor('Blacklisted Plumbers', {
      pan: 'ABCDE1234F',
    });
    await call('admin', 'vendor_rating_save', [
      society,
      vendorId,
      4,
      'Synthetic rating',
      crypto.randomUUID(),
    ]);
    const request = await createRequest('committee', 1_000);
    const existingQuoteId = await addQuote('committee', request, vendorId, 900);
    const initial = vendorDetailSchema.parse(
      await call('admin', 'vendor_get', [society, vendorId]),
    );
    expect([initial.rating_average, initial.rating_count]).toEqual([4, 1]);
    const setBlacklisted = (
      actor: Actor,
      blacklisted: boolean,
      version: number,
      reason: string,
    ) =>
      call(actor, 'vendor_set_blacklisted', [
        society,
        vendorId,
        blacklisted,
        version,
        reason,
        crypto.randomUUID(),
      ]);

    expect(
      await code(setBlacklisted('admin', true, initial.vendor.version, '')),
    ).toBe('22023');
    expect(
      await code(
        setBlacklisted(
          'committee',
          true,
          initial.vendor.version,
          'Repeated missed appointments.',
        ),
      ),
    ).toBe('42501');
    await setBlacklisted(
      'admin',
      true,
      initial.vendor.version,
      'Repeated missed appointments.',
    );

    const blacklisted = vendorDetailSchema.parse(
      await call('committee', 'vendor_get', [society, vendorId]),
    );
    expect(blacklisted.vendor).toMatchObject({
      pan: null,
      blacklisted: true,
      blacklist_reason: 'Repeated missed appointments.',
    });
    expect([blacklisted.rating_average, blacklisted.rating_count]).toEqual([
      4, 1,
    ]);
    expect((await detail(request)).quotes).toMatchObject([
      {
        id: existingQuoteId,
        vendor_id: vendorId,
        amount_paise: 900,
        blacklisted: true,
      },
    ]);
    const newRequest = await createRequest('committee', 1_000);
    await addQuote('committee', newRequest, vendorId, 850);
    expect((await detail(newRequest)).quotes[0]).toMatchObject({
      amount_paise: 850,
      blacklisted: true,
    });

    await setBlacklisted(
      'admin',
      false,
      blacklisted.vendor.version,
      'The vendor has resolved the outstanding issues.',
    );
    const restored = vendorDetailSchema.parse(
      await call('admin', 'vendor_get', [society, vendorId]),
    );
    expect(restored.vendor).toMatchObject({
      blacklisted: false,
      blacklist_reason: null,
    });
    expect([restored.rating_average, restored.rating_count]).toEqual([4, 1]);
    expect((await detail(request)).quotes).toMatchObject([
      {
        id: existingQuoteId,
        vendor_id: vendorId,
        amount_paise: 900,
        blacklisted: false,
      },
    ]);
    expect((await detail(newRequest)).quotes).toHaveLength(1);
    const audits = await superuser((client) =>
      client.query<{ action: string; reason: string }>(
        `select action, reason from public.audit_logs
         where society_id=$1 and entity_type='vendor' and entity_id=$2
           and action in ('vendor.blacklist.add','vendor.blacklist.remove')
         order by created_at, id`,
        [society, vendorId],
      ),
    );
    expect(audits.rows).toEqual([
      {
        action: 'vendor.blacklist.add',
        reason: 'Repeated missed appointments.',
      },
      {
        action: 'vendor.blacklist.remove',
        reason: 'The vendor has resolved the outstanding issues.',
      },
    ]);
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

  describe('P47 registers', () => {
    type Row = Record<string, unknown> & { id: string; version: number };
    let today = '';
    let agency = '';
    let supplies = '';
    const shift = (days: number, from = today) => {
      const date = new Date(`${from}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };
    const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
    const find = (rows: unknown, id: string) => {
      const row = (rows as Row[]).find((item) => item.id === id);
      if (!row) throw new Error(`Missing row ${id}.`);
      return row;
    };
    const saveContract = (
      vendor: string,
      start: string,
      end: string,
      options: {
        id?: string;
        version?: number;
        notice?: number | null;
        annual?: number;
        sanctioned?: number | null;
        rate?: number | null;
        actor?: Actor;
      } = {},
    ) =>
      call(options.actor ?? 'admin', 'vendor_contract_save', [
        society,
        options.id ?? null,
        vendor,
        'Housekeeping staff',
        start,
        end,
        options.annual ?? 1_200_000,
        'monthly',
        false,
        options.notice ?? null,
        null,
        options.sanctioned ?? null,
        options.rate ?? null,
        options.version ?? null,
        crypto.randomUUID(),
        crypto.randomUUID(),
      ]) as Promise<string>;
    const contracts = async (actor: Actor = 'admin', vendor = agency) =>
      (await call(actor, 'vendor_contracts_get', [society, vendor])) as {
        can_manage: boolean;
        contracts: Row[];
      };
    const terminate = async (id: string, reason: string | null = 'Ended') =>
      call('admin', 'vendor_contract_terminate', [
        society,
        id,
        today,
        reason,
        find((await contracts()).contracts, id).version,
        crypto.randomUUID(),
      ]);
    const runReminders = (trace: string) =>
      database.asRole(
        'service_role',
        {},
        async (client) =>
          (
            await client.query<{ sent: number }>(
              'select public.vendor_contract_reminders_run($1,$2) as sent',
              [society, trace],
            )
          ).rows[0]!.sent,
        { commit: true },
      );

    beforeAll(async () => {
      today = await superuser(
        async (client) =>
          (
            await client.query<{ today: string }>(
              'select private.housekeeping_local_date($1)::text as today',
              [society],
            )
          ).rows[0]!.today,
      );
      agency = await createVendor('P47 Agency', { paymentTermsDays: 10 });
      supplies = await createVendor('P47 Supplies');
    });

    it('bands contracts, renews successors and reminds before the notice deadline', async () => {
      const urgent = await saveContract(agency, shift(-10), shift(30));
      const dueSoon = await saveContract(agency, shift(-10), shift(60));
      const active = await saveContract(agency, shift(-10), shift(61));
      const upcoming = await saveContract(agency, shift(5), shift(100));
      const expired = await saveContract(agency, shift(-100), shift(-1));
      const ended = await saveContract(agency, shift(-10), shift(20));
      const noticed = await saveContract(agency, shift(-10), shift(40), {
        notice: 33,
      });
      expect(await code(terminate(ended, null))).toBe('22023');
      await terminate(ended);
      expect(await code(terminate(ended))).toBe('22023');

      expect(
        await code(
          saveContract(agency, shift(-10), shift(30), { actor: 'committee' }),
        ),
      ).toBe('42501');
      const committeeView = await contracts('committee');
      expect(committeeView.can_manage).toBe(false);
      const status = (id: string) =>
        find(committeeView.contracts, id).status as string;
      expect(
        [urgent, dueSoon, active, upcoming, expired, ended].map(status),
      ).toEqual([
        'urgent',
        'due_soon',
        'active',
        'upcoming',
        'expired',
        'terminated',
      ]);
      expect(find(committeeView.contracts, noticed)).toMatchObject({
        notice_days: 33,
        notice_deadline: shift(7),
      });

      const renew = (predecessor: string) =>
        call('admin', 'vendor_contract_renew', [
          society,
          predecessor,
          'Housekeeping staff',
          shift(31),
          shift(400),
          1_300_000,
          'quarterly',
          true,
          null,
          null,
          null,
          null,
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]) as Promise<string>;
      const successor = await renew(urgent);
      expect(await code(renew(urgent))).toBe('23505');
      expect(await code(renew(ended))).toBe('22023');
      const renewed = await contracts();
      expect(find(renewed.contracts, urgent).successor_id).toBe(successor);
      expect(find(renewed.contracts, successor)).toMatchObject({
        predecessor_id: urgent,
        vendor_id: agency,
        status: 'upcoming',
        auto_renew: true,
      });

      // Due Soon at 60 days and a notice deadline 7 days out each remind every active manager.
      const managers = await superuser(async (client) =>
        (
          await client.query<{ user_id: string }>(
            `select user_id from public.memberships
               where society_id=$1 and status='active' and roles && array['admin','committee']::text[]`,
            [society],
          )
        ).rows.map((row) => row.user_id),
      );
      expect(managers).toEqual(
        expect.arrayContaining([user('admin'), user('committee')]),
      );
      const trace = crypto.randomUUID();
      expect(await runReminders(trace)).toBe(managers.length * 2);
      const sent = await notifications(trace);
      expect(new Set(sent.map((row) => row.type))).toEqual(
        new Set(['vendor_contract_expiry']),
      );
      expect(new Set(sent.map((row) => row.entity_type))).toEqual(
        new Set(['vendor_contract']),
      );
      expect(sent.map((row) => row.user_id).sort()).toEqual(
        [...managers, ...managers].sort(),
      );
      expect(await runReminders(crypto.randomUUID())).toBe(0);
      await saveContract(agency, shift(-10), shift(59), {
        id: active,
        version: find((await contracts()).contracts, active).version,
      });
      expect(await runReminders(crypto.randomUUID())).toBe(managers.length);
      expect(
        await code(
          call('admin', 'vendor_contract_reminders_run', [society, 'x']),
        ),
      ).toBe('42501');
      expect(
        await code(
          call('foreignAdmin', 'vendor_contracts_get', [society, null]),
        ),
      ).toBe('42501');
    });

    it('works out staff-day deductions, payable amounts and flags with audited edits', async () => {
      const contract = await saveContract(agency, shift(-60), shift(300), {
        sanctioned: 26,
        rate: 50_000,
      });
      const save = (
        options: {
          id?: string;
          version?: number;
          month?: string | null;
          sanctioned?: number | null;
          actual?: number;
          rate?: number | null;
          manual?: number | null;
          manualReason?: string | null;
          billRaised?: number | null;
          editReason?: string | null;
          actor?: Actor;
          trace?: string;
        } = {},
      ) =>
        call(options.actor ?? 'admin', 'vendor_staff_day_check_save', [
          society,
          options.id ?? null,
          options.id ? null : contract,
          options.month === undefined ? monthStart(today) : options.month,
          options.sanctioned ?? null,
          options.actual ?? 23,
          3_000_000,
          options.rate === undefined ? 50_000 : options.rate,
          options.manual ?? null,
          options.manualReason ?? null,
          options.billRaised === undefined ? 2_900_000 : options.billRaised,
          options.editReason ?? null,
          options.version ?? null,
          crypto.randomUUID(),
          options.trace ?? crypto.randomUUID(),
        ]) as Promise<string>;
      const checks = async (actor: Actor = 'admin') =>
        (
          (await call(actor, 'vendor_staff_day_checks_get', [
            society,
            agency,
          ])) as { checks: Row[] }
        ).checks;

      const current = await save({ month: shift(0) });
      expect(find(await checks('committee'), current)).toMatchObject({
        month: monthStart(today),
        sanctioned_days: 26,
        actual_days: 23,
        shortfall_days: 3,
        deduction_paise: 150_000,
        payable_paise: 2_850_000,
        variance_paise: 50_000,
        flagged: true,
      });
      expect(await code(save())).toBe('23505');
      expect(await code(save({ month: shift(400) }))).toBe('22023');
      expect(await code(save({ actor: 'committee', month: shift(-30) }))).toBe(
        '42501',
      );

      const version = find(await checks(), current).version;
      expect(
        await code(save({ id: current, version, actual: 0, rate: 200_000 })),
      ).toBe('22023');
      const editTrace = crypto.randomUUID();
      await save({
        id: current,
        version,
        actual: 0,
        rate: 200_000,
        billRaised: 0,
        editReason: 'Agency attendance corrected',
        trace: editTrace,
      });
      expect(find(await checks(), current)).toMatchObject({
        shortfall_days: 26,
        deduction_paise: 3_000_000,
        payable_paise: 0,
        variance_paise: 0,
        flagged: false,
      });
      const audit = await superuser(
        async (client) =>
          (
            await client.query<{
              reason: string;
              before: { actual_days: number };
              after: { actual_days: number };
            }>(
              `select reason,before,after from public.audit_logs
               where action='vendor.staff_day_check.update' and request_id=$1`,
              [editTrace],
            )
          ).rows,
      );
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        reason: 'Agency attendance corrected',
        before: { actual_days: 23 },
        after: { actual_days: 0 },
      });

      const previous = monthStart(shift(-30, monthStart(today)));
      expect(
        await code(save({ month: previous, rate: null, manual: 100_000 })),
      ).toBe('22023');
      expect(
        await code(
          save({ month: previous, manual: 100_000, manualReason: 'Late' }),
        ),
      ).toBe('22023');
      const manual = await save({
        month: previous,
        rate: null,
        manual: 100_000,
        manualReason: 'Two guards left early',
        billRaised: null,
      });
      expect(find(await checks(), manual)).toMatchObject({
        rate_paise: null,
        deduction_paise: 100_000,
        payable_paise: 2_900_000,
        variance_paise: null,
        flagged: false,
      });
    });

    it('numbers work orders per year and only moves them forward', async () => {
      await setSettings(2_500_000, 3, 1);
      const approved = async () => {
        const request = await readyRequest('committee', agency);
        await submit('committee', request);
        expect((await approve('admin', request)).status).toBe('approved');
        return request;
      };
      const create = (
        request: string,
        issuedOn: string | null,
        dueOn: string | null,
        options: { actor?: Actor; description?: string; value?: number } = {},
      ) =>
        call(options.actor ?? 'admin', 'vendor_work_order_create', [
          society,
          request,
          options.description ?? null,
          options.value ?? null,
          issuedOn,
          dueOn,
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]) as Promise<string>;
      const orders = async (actor: Actor = 'admin') =>
        (await call(actor, 'vendor_work_orders_get', [society, agency])) as {
          can_manage: boolean;
          work_orders: Row[];
          approved_requests: Row[];
        };
      const order = async (id: string) =>
        find((await orders()).work_orders, id);
      const setStatus = async (
        id: string,
        status: string,
        completedOn: string | null = null,
        reason: string | null = null,
      ) =>
        call('admin', 'vendor_work_order_set_status', [
          society,
          id,
          status,
          completedOn,
          reason,
          (await order(id)).version,
          crypto.randomUUID(),
        ]);
      const update = async (
        id: string,
        description: string,
        dueOn: string | null,
      ) =>
        call('admin', 'vendor_work_order_update', [
          society,
          id,
          description,
          dueOn,
          (await order(id)).version,
          crypto.randomUUID(),
        ]);

      const submitted = await readyRequest('committee', agency);
      await submit('committee', submitted);
      expect(await code(create(submitted, today, today))).toBe('22023');

      const [first, second, third, fourth] = [
        await approved(),
        await approved(),
        await approved(),
        await approved(),
      ];
      expect((await orders()).approved_requests.map((row) => row.id)).toEqual(
        expect.arrayContaining([first, second, third, fourth]),
      );
      expect(
        await code(
          create(first, '2031-12-31', '2032-01-10', { actor: 'committee' }),
        ),
      ).toBe('42501');
      const lateYear = await create(first, '2031-12-31', '2032-01-10');
      expect(await order(lateYear)).toMatchObject({
        number: 'WO-2031-0001',
        purchase_request_id: first,
        vendor_id: agency,
        value_paise: 100_000,
        status: 'issued',
      });
      expect(await code(create(first, '2031-12-31', '2032-01-10'))).toBe(
        '23505',
      );
      const midYear = await create(second, '2031-06-01', '2031-06-30');
      const nextYear = await create(third, '2032-01-01', '2032-01-05');
      expect((await order(midYear)).number).toBe('WO-2031-0002');
      expect((await order(nextYear)).number).toBe('WO-2032-0001');

      expect(await code(setStatus(lateYear, 'cancelled'))).toBe('22023');
      await setStatus(lateYear, 'cancelled', null, 'Vendor unavailable');
      expect(await order(lateYear)).toMatchObject({
        status: 'cancelled',
        cancel_reason: 'Vendor unavailable',
        days_open: null,
      });
      const reissued = await create(first, '2031-12-31', '2032-01-10');
      expect((await order(reissued)).number).toBe('WO-2031-0003');
      expect(await code(update(lateYear, 'Too late', '2032-02-01'))).toBe(
        '22023',
      );

      expect(await code(create(fourth, today, shift(-1)))).toBe('22023');
      const running = await create(fourth, shift(-10), shift(-5), {
        description: 'Fix pump',
        value: 90_000,
      });
      await setStatus(running, 'in_progress');
      expect(await code(setStatus(running, 'issued'))).toBe('22023');
      expect(await code(setStatus(running, 'completed'))).toBe('22023');
      expect(await code(setStatus(running, 'completed', shift(1)))).toBe(
        '22023',
      );
      expect(await order(running)).toMatchObject({
        days_open: 10,
        delay_days: 5,
      });
      await setStatus(running, 'completed', shift(-2));
      expect(await order(running)).toMatchObject({
        status: 'completed',
        completed_on: shift(-2),
        days_open: 8,
        delay_days: 3,
      });
      expect(await code(setStatus(running, 'cancelled', null, 'No'))).toBe(
        '22023',
      );
      expect(await code(update(running, 'Edited', today))).toBe('22023');

      await update(midYear, 'Replace two valves', '2031-07-15');
      expect(await order(midYear)).toMatchObject({
        description: 'Replace two valves',
        due_on: '2031-07-15',
        issued_on: '2031-06-01',
        value_paise: 100_000,
        status: 'issued',
      });

      // The due date is optional: an undated order never shows a delay.
      const undated = await create(await approved(), shift(-3), null);
      expect(await order(undated)).toMatchObject({
        due_on: null,
        days_open: 3,
        delay_days: null,
      });
      await setStatus(undated, 'completed', today);
      expect(await order(undated)).toMatchObject({
        status: 'completed',
        days_open: 3,
        delay_days: null,
      });
      await update(midYear, 'Replace two valves', null);
      expect(await order(midYear)).toMatchObject({
        due_on: null,
        delay_days: null,
      });
      expect((await orders('committee')).can_manage).toBe(false);
    });

    it('tracks bills against linked cash-book payments without touching the books', async () => {
      const setup = await superuser(async (client) => {
        const account = (
          await client.query<{ id: string }>(
            `insert into public.expense_accounts(society_id,name,account_type,opening_on,created_by)
             values($1,'P47 bank','bank',$2,$3) returning id`,
            [society, shift(-400), user('admin')],
          )
        ).rows[0]!.id;
        const category = (
          await client.query<{ id: string }>(
            `insert into public.expense_categories(society_id,name,created_by)
             values($1,'P47 supplies',$2) returning id`,
            [society, user('admin')],
          )
        ).rows[0]!.id;
        return { account, category };
      });
      // Linking must never add, change or remove cash-book entries.
      const bookEntries = () =>
        superuser(
          async (client) =>
            (
              await client.query<{ count: string }>(
                'select count(*)::text as count from public.expense_book_entries where society_id=$1',
                [society],
              )
            ).rows[0]!.count,
        );
      const startingEntries = await bookEntries();
      const expenseEntry = (amount: number, posted = true) =>
        superuser(async (client) => {
          const expense = (
            await client.query<{ id: string }>(
              `insert into public.expenses(society_id,account_id,category_id,spent_on,payee,amount_paise,
                 payment_mode,approval_required,status,client_request_id,created_by)
               values($1,$2,$3,$4,'P47 Supplies',$5,'bank',$6,$7,$8,$9) returning id`,
              [
                society,
                setup.account,
                setup.category,
                shift(-1),
                amount,
                !posted,
                posted ? 'posted' : 'pending_approval',
                crypto.randomUUID(),
                user('admin'),
              ],
            )
          ).rows[0]!.id;
          return (
            await client.query<{ id: string }>(
              `insert into public.expense_book_entries(society_id,account_id,entry_date,direction,amount_paise,
                 source,expense_id,category_id,counterparty,created_by)
               values($1,$2,$3,'out',$4,'expense',$5,$6,'P47 Supplies',$7) returning id`,
              [
                society,
                setup.account,
                shift(-1),
                amount,
                expense,
                setup.category,
                user('admin'),
              ],
            )
          ).rows[0]!.id;
        });
      const reverse = (entry: string, amount: number) =>
        superuser((client) =>
          client.query(
            `insert into public.expense_book_entries(society_id,account_id,entry_date,direction,amount_paise,
               source,reverses_entry_id,counterparty,client_request_id,description,created_by)
             values($1,$2,$3,'in',$4,'reversal',$5,'P47 Supplies',$6,'Entered twice',$7)`,
            [
              society,
              setup.account,
              today,
              amount,
              entry,
              crypto.randomUUID(),
              user('admin'),
            ],
          ),
        );
      const bills = async (
        actor: Actor = 'admin',
        vendor: string | null = null,
      ) =>
        (await call(actor, 'vendor_bills_get', [society, vendor])) as {
          can_manage: boolean;
          bills: (Row & { payments: Row[] })[];
          linkable_entries: Row[] | null;
        };
      const bill = async (id: string) => find((await bills()).bills, id);
      const saveBill = (
        vendor: string,
        invoice: string,
        invoiceDate: string,
        amount: number,
        options: { id?: string; version?: number; actor?: Actor } = {},
      ) =>
        call(options.actor ?? 'admin', 'vendor_bill_save', [
          society,
          options.id ?? null,
          vendor,
          invoice,
          invoiceDate,
          amount,
          options.version ?? null,
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]) as Promise<string>;
      const link = (
        billId: string,
        entry: string,
        amount: number,
        actor: Actor = 'admin',
      ) =>
        call(actor, 'vendor_bill_payment_link', [
          society,
          billId,
          entry,
          amount,
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]);
      const cancel = async (id: string, reason: string | null) =>
        call('admin', 'vendor_bill_cancel', [
          society,
          id,
          reason,
          (await bill(id)).version,
          crypto.randomUUID(),
        ]);

      const overdue = await saveBill(agency, 'INV-1', shift(-20), 100_000);
      expect(await bill(overdue)).toMatchObject({
        effective_terms_days: 10,
        due_date: shift(-10),
        payment_status: 'pending',
        due_state: 'overdue',
        outstanding_paise: 100_000,
      });
      await superuser((client) =>
        client.query(
          'update public.vendors set payment_terms_days=30 where id=$1',
          [agency],
        ),
      );
      await saveBill(agency, 'INV-1', shift(-20), 120_000, {
        id: overdue,
        version: (await bill(overdue)).version,
      });
      expect(await bill(overdue)).toMatchObject({
        amount_paise: 120_000,
        effective_terms_days: 10,
        due_date: shift(-10),
      });

      const split = await saveBill(supplies, 'inv-9', shift(-2), 50_000);
      expect(await bill(split)).toMatchObject({
        effective_terms_days: 5,
        due_date: shift(3),
        due_state: 'due_soon',
      });
      expect(await code(saveBill(supplies, ' INV-9 ', today, 1_000))).toBe(
        '23505',
      );
      await saveBill(agency, 'INV-9', today, 1_000);
      const edge = await saveBill(supplies, 'EDGE-1', shift(1), 1_000);
      const outside = await saveBill(supplies, 'EDGE-2', shift(2), 1_000);
      expect((await bill(edge)).due_state).toBe('due_soon');
      expect((await bill(outside)).due_state).toBeNull();

      const shared = await expenseEntry(80_000);
      expect(await code(link(overdue, shared, 1_000, 'committee'))).toBe(
        '42501',
      );
      await link(overdue, shared, 50_000);
      await link(split, shared, 30_000);
      expect(await code(link(edge, shared, 1))).toBe('22023');
      expect(await bill(overdue)).toMatchObject({
        paid_paise: 50_000,
        outstanding_paise: 70_000,
        payment_status: 'partly_paid',
        due_state: 'overdue',
      });
      const extra = await expenseEntry(200_000);
      expect(await code(link(split, extra, 20_001))).toBe('22023');
      await link(split, extra, 20_000);
      expect(await code(link(split, extra, 1))).toBe('23505');
      expect(await bill(split)).toMatchObject({
        paid_paise: 50_000,
        outstanding_paise: 0,
        payment_status: 'paid',
        due_state: null,
      });
      expect(
        (await bills()).linkable_entries?.find((row) => row.id === extra),
      ).toMatchObject({ unlinked_paise: 180_000 });
      expect(
        (await bills()).linkable_entries?.some((row) => row.id === shared),
      ).toBe(false);

      const pending = await expenseEntry(5_000, false);
      expect(await code(link(edge, pending, 1_000))).toBe('22023');
      const reversed = await expenseEntry(5_000);
      await reverse(reversed, 5_000);
      expect(await code(link(edge, reversed, 1_000))).toBe('22023');
      const income = await superuser(
        async (client) =>
          (
            await client.query<{ id: string }>(
              `insert into public.expense_book_entries(society_id,account_id,entry_date,direction,amount_paise,
                 source,income_kind,counterparty,client_request_id,created_by)
               values($1,$2,$3,'in',5000,'income','donation','Synthetic donor',$4,$5) returning id`,
              [
                society,
                setup.account,
                shift(-1),
                crypto.randomUUID(),
                user('admin'),
              ],
            )
          ).rows[0]!.id,
      );
      expect(await code(link(edge, income, 1_000))).toBe('22023');

      expect(
        await code(
          saveBill(agency, 'INV-1', shift(-20), 130_000, {
            id: overdue,
            version: (await bill(overdue)).version,
          }),
        ),
      ).toBe('22023');
      expect(await code(cancel(overdue, 'Duplicate'))).toBe('22023');
      expect(await code(cancel(edge, null))).toBe('22023');

      const refunded = await expenseEntry(1_000);
      await link(edge, refunded, 1_000);
      expect((await bill(edge)).payment_status).toBe('paid');
      await reverse(refunded, 1_000);
      const afterReversal = await bill(edge);
      expect(afterReversal).toMatchObject({
        paid_paise: 0,
        outstanding_paise: 1_000,
        payment_status: 'pending',
      });
      expect(afterReversal.payments).toEqual([
        expect.objectContaining({ entry_id: refunded, counting: false }),
      ]);
      await cancel(edge, 'Raised in error');
      expect(await bill(edge)).toMatchObject({
        cancel_reason: 'Raised in error',
      });
      expect(await code(link(edge, extra, 100))).toBe('22023');
      const again = await saveBill(supplies, 'edge-1', shift(1), 1_000);
      expect((await bill(again)).invoice_number).toBe('edge-1');

      const unlink = (
        paymentId: string,
        reason: string | null,
        actor: Actor = 'admin',
        trace: string = crypto.randomUUID(),
      ) =>
        call(actor, 'vendor_bill_payment_unlink', [
          society,
          paymentId,
          reason,
          trace,
        ]);
      const extraUnlinked = async () =>
        (await bills()).linkable_entries?.find((row) => row.id === extra)
          ?.unlinked_paise;
      await link(again, extra, 1_000);
      expect(await extraUnlinked()).toBe(179_000);
      const wrongLink = ((await bill(again)).payments as Row[])[0]!.id;
      expect(await code(unlink(wrongLink, 'Wrong bill', 'committee'))).toBe(
        '42501',
      );
      expect(await code(unlink(wrongLink, null))).toBe('22023');
      expect(await code(unlink(wrongLink, '   '))).toBe('22023');
      const unlinkTrace = crypto.randomUUID();
      await unlink(
        wrongLink,
        ' Linked to the wrong bill ',
        'admin',
        unlinkTrace,
      );
      const afterUnlink = await bill(again);
      expect(afterUnlink).toMatchObject({
        paid_paise: 0,
        outstanding_paise: 1_000,
        payment_status: 'pending',
      });
      expect(afterUnlink.payments).toEqual([
        expect.objectContaining({
          id: wrongLink,
          entry_id: extra,
          counting: false,
          unlink_reason: 'Linked to the wrong bill',
          unlinked_by_name: 'Synthetic admin',
          unlinked_at: expect.any(String),
        }),
      ]);
      expect(await extraUnlinked()).toBe(180_000);
      expect(await code(unlink(wrongLink, 'Again'))).toBe('22023');
      expect(
        await superuser(
          async (client) =>
            (
              await client.query<{ action: string; reason: string }>(
                'select action,reason from public.audit_logs where request_id=$1',
                [unlinkTrace],
              )
            ).rows,
        ),
      ).toEqual([
        {
          action: 'vendor.bill.payment_unlink',
          reason: 'Linked to the wrong bill',
        },
      ]);
      // Nothing counts any more, so the bill is editable again.
      await saveBill(supplies, 'edge-1', shift(1), 1_000, {
        id: again,
        version: afterUnlink.version as number,
      });
      await link(again, extra, 1_000);
      expect((await bill(again)).payment_status).toBe('paid');
      expect((await bill(again)).payments).toHaveLength(2);

      expect(
        await code(
          asActor('admin', (client) =>
            client.query(
              'update public.vendor_bills set amount_paise=1 where id=$1',
              [split],
            ),
          ),
        ),
      ).toBe('42501');
      const committeeView = await bills('committee');
      expect(committeeView.can_manage).toBe(false);
      expect(committeeView.linkable_entries).toEqual([]);
      expect(
        (await bills('admin', supplies)).bills.every(
          (row) => row.vendor_id === supplies,
        ),
      ).toBe(true);
      expect(
        await code(call('foreignAdmin', 'vendor_bills_get', [society, null])),
      ).toBe('42501');
      const foreignVendor = await createVendor('P47 Foreign', {
        targetSociety: foreignSociety,
        actor: 'foreignAdmin',
      });
      const foreignBill = (await call('foreignAdmin', 'vendor_bill_save', [
        foreignSociety,
        null,
        foreignVendor,
        'F-1',
        today,
        1_000,
        null,
        crypto.randomUUID(),
        crypto.randomUUID(),
      ])) as string;
      expect(
        await code(
          call('foreignAdmin', 'vendor_bill_payment_link', [
            foreignSociety,
            foreignBill,
            extra,
            100,
            crypto.randomUUID(),
            crypto.randomUUID(),
          ]),
        ),
      ).toBe('P0002');
      expect(Number(await bookEntries()) - Number(startingEntries)).toBe(8);
    });

    it('summarises one vendor and the whole society', async () => {
      await setModule('amc', true);
      try {
        const vendor = await createVendor('P47 Summary Vendor');
        await saveContract(vendor, shift(-10), shift(20), {
          annual: 1_000_000,
        });
        const ended = await saveContract(vendor, shift(-10), shift(200), {
          annual: 500_000,
        });
        await call('admin', 'vendor_contract_terminate', [
          society,
          ended,
          today,
          'Closed early',
          1,
          crypto.randomUUID(),
        ]);
        const amc = await asActor(
          'admin',
          async (client) =>
            (
              await client.query<{ id: string }>(
                "select public.amc_contract_save($1,null,'Lift','p47 summary VENDOR','Contact',$2,$3,120000,'Annual','Quarterly',null,null,null,$4,'p47-summary') as id",
                [society, shift(-100), shift(40), crypto.randomUUID()],
              )
            ).rows[0]!.id,
        );
        const updatedAt = (
          await asActor(
            'admin',
            async (client) =>
              (
                await client.query<{
                  value: { contracts: { id: string; updated_at: string }[] };
                }>('select public.amc_workspace($1) as value', [society])
              ).rows[0]!.value,
          )
        ).contracts.find((row) => row.id === amc)!.updated_at;
        await asActor('admin', (client) =>
          client.query(
            "select public.amc_schedule_save($1,$2,null,null,4,$3,'p47-summary')",
            [society, amc, updatedAt],
          ),
        );
        await superuser((client) =>
          client.query(
            `insert into public.amc_visits(society_id,contract_id,visit_date,summary,technician,created_by,updated_by,client_request_id)
             values($1,$2,$3,'Service','Synthetic technician',$4,$4,$5)`,
            [society, amc, shift(-100), user('admin'), crypto.randomUUID()],
          ),
        );
        await setSettings(2_500_000, 3, 1);
        const request = await readyRequest('committee', vendor, 40_000);
        await submit('committee', request);
        await approve('admin', request);
        await call('admin', 'vendor_work_order_create', [
          society,
          request,
          null,
          null,
          today,
          shift(5),
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]);
        await call('admin', 'vendor_bill_save', [
          society,
          null,
          vendor,
          'SUM-1',
          today,
          70_000,
          null,
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]);

        expect(
          await call('committee', 'vendor_summary_get', [society, vendor]),
        ).toEqual({
          vendor_id: vendor,
          active_vendors: null,
          active_contract_value_paise: 1_000_000,
          renewals_due: 2,
          renewals_due_general: 1,
          renewals_due_amc: 1,
          rating_average: null,
          rating_count: 0,
          open_work_orders: 1,
          overdue_amc_services: 1,
          bills_owed_paise: 70_000,
          bills_owed_count: 1,
        });
        const expected = await superuser(
          async (client) =>
            (
              await client.query<{
                active_vendors: number;
                open_work_orders: number;
              }>(
                `select
                   (select count(*)::int from public.vendors
                    where society_id=$1 and active and not blacklisted) as active_vendors,
                   (select count(*)::int from public.vendor_work_orders
                    where society_id=$1 and status in ('issued','in_progress')) as open_work_orders`,
                [society],
              )
            ).rows[0]!,
        );
        const whole = (await call('admin', 'vendor_summary_get', [
          society,
          null,
        ])) as Record<string, unknown>;
        expect(whole).toMatchObject({ vendor_id: null, ...expected });
        expect(whole.overdue_amc_services).toBe(1);
        expect(Number(whole.bills_owed_paise)).toBeGreaterThan(70_000);
        expect(
          await code(call('resident', 'vendor_summary_get', [society, null])),
        ).toBe('42501');
        expect(
          await code(
            call('foreignAdmin', 'vendor_summary_get', [society, vendor]),
          ),
        ).toBe('42501');
      } finally {
        await setModule('amc', false);
      }
    });
  });
});
