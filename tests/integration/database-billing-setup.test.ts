// Verify billing setup isolation, monetary constraints, audit and QR protection.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

type Details = {
  society_id: string;
  upi_id: string;
  payee_name: string;
  qr_path: string | null;
  updated_at: string;
  updated_by_name: string;
};
type Charge = {
  id: string;
  updated_at: string;
  active: boolean;
  amount_paise: number | null;
};

describe.skipIf(!hasDatabase)('database billing setup', () => {
  let database: TestDatabase;
  let societyId: string;
  let otherSocietyId: string;
  const users: Record<string, string> = {};

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.asSuperuser(async (client) => {
      for (const role of [
        'admin',
        'second-admin',
        'committee',
        'guard',
        'resident',
        'outsider',
      ]) {
        const id = await newAuthUser(client, `billing-${role}@example.test`);
        users[role] = id;
        await client.query(
          `insert into public.profiles (id, email, full_name)
           values ($1, $2, $3)`,
          [id, `billing-${role}@example.test`, `Billing ${role}`],
        );
      }
      const societies = await client.query<{ id: string }>(
        `insert into public.societies (name, created_by)
         values ('Billing Society', $1), ('Other Billing Society', $1) returning id`,
        [users.admin],
      );
      const first = societies.rows[0]?.id;
      const second = societies.rows[1]?.id;
      if (!first || !second)
        throw new Error('Billing societies were not created.');
      societyId = first;
      otherSocietyId = second;
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled, settings)
         values ($1, 'core', true, '{}'), ($1, 'billing', true, '{}'),
                ($2, 'core', true, '{}'), ($2, 'billing', true, '{}')`,
        [societyId, otherSocietyId],
      );
      for (const [role, id] of Object.entries(users)) {
        await client.query(
          `insert into public.memberships (society_id, user_id, roles, status)
           values ($1, $2, $3, 'active')`,
          [
            role === 'outsider' ? otherSocietyId : societyId,
            id,
            [
              role === 'second-admin'
                ? 'admin'
                : role === 'outsider'
                  ? 'resident'
                  : role,
            ],
          ],
        );
      }
    });
  });

  afterAll(async () => {
    await database?.drop();
  });

  async function saveCharge(
    name: string,
    method: string,
    amount: number | null,
    options: {
      id?: string;
      stamp?: string;
      active?: boolean;
      user?: string;
      society?: string;
    } = {},
  ): Promise<Charge> {
    return database.asRole(
      'authenticated',
      { sub: options.user ?? users.admin },
      async (client) => {
        const result = await client.query<{ charge: Charge }>(
          `select to_jsonb(charge) as charge from public.billing_charge_save(
          $1, $2, $3, $4, $5, $6, $7, 'billing-charge-test'
        ) charge`,
          [
            options.society ?? societyId,
            options.id ?? null,
            name,
            method,
            amount,
            options.active ?? true,
            options.stamp ?? null,
          ],
        );
        const charge = result.rows[0]?.charge;
        if (!charge) throw new Error('The saved charge was not returned.');
        return charge;
      },
      { commit: true },
    );
  }

  async function paymentDetails(): Promise<Details | null> {
    return database.asRole(
      'authenticated',
      { sub: users.admin },
      async (client) =>
        (
          await client.query<{ details: Details | null }>(
            'select public.billing_payment_details_get($1) as details',
            [societyId],
          )
        ).rows[0]?.details ?? null,
    );
  }

  async function updateDetails(
    upiId: string,
    stamp: string | null,
    options: {
      user?: string;
      society?: string;
      qrPath?: string | null;
      requestId?: string;
    } = {},
  ): Promise<Details> {
    return database.asRole(
      'authenticated',
      { sub: options.user ?? users.admin },
      async (client) => {
        const result = await client.query<{ details: Details }>(
          `select public.billing_payment_details_update(
          $1, $2, 'Synthetic Test Society', $3, $4, $5
        ) as details`,
          [
            options.society ?? societyId,
            upiId,
            options.qrPath ?? null,
            stamp,
            options.requestId ?? 'billing-payment-details-test',
          ],
        );
        const details = result.rows[0]?.details;
        if (!details) throw new Error('Payment details were not returned.');
        return details;
      },
      { commit: true },
    );
  }

  it('creates and edits all charge methods, rejects invalid money and preserves stale edits', async () => {
    const fixed = await saveCharge('Monthly maintenance', 'fixed', 123456);
    expect(fixed.amount_paise).toBe(123456);
    expect(
      (await saveCharge('Area maintenance', 'per_sqft', 125)).amount_paise,
    ).toBe(125);
    expect(
      (await saveCharge('Custom charge', 'custom', null)).amount_paise,
    ).toBeNull();
    for (const [method, amount] of [
      ['fixed', null],
      ['per_sqft', 0],
      ['custom', 100],
      ['unknown', 100],
      ['fixed', 9007199254740992],
    ] as const) {
      expect(
        (
          await dbError(
            saveCharge(`Invalid ${method} ${amount}`, method, amount),
          )
        ).code,
      ).toBe('23514');
    }
    expect(
      (await dbError(saveCharge('Monthly maintenance', 'fixed', 100))).code,
    ).toBe('23505');
    const changed = await saveCharge('Monthly maintenance', 'fixed', 200000, {
      id: fixed.id,
      stamp: fixed.updated_at,
    });
    const inactive = await saveCharge('Monthly maintenance', 'fixed', 200000, {
      id: fixed.id,
      stamp: changed.updated_at,
      active: false,
    });
    expect(inactive.id).toBe(fixed.id);
    expect(inactive.active).toBe(false);
    expect(
      (
        await dbError(
          saveCharge('Stale edit', 'fixed', 300000, {
            id: fixed.id,
            stamp: fixed.updated_at,
          }),
        )
      ).code,
    ).toBe('23505');
    const audit = await database.asSuperuser((client) =>
      client.query<{ action: string }>(
        `select action from public.audit_logs where entity_id = $1 order by created_at`,
        [fixed.id],
      ),
    );
    expect(audit.rows.map(({ action }) => action)).toEqual([
      'billing.charges.create',
      'billing.charges.update',
      'billing.charges.deactivate',
    ]);
  });

  it('permits committee reads but denies non-admin writes, cross-society access and counter access', async () => {
    const read = await database.asRole(
      'authenticated',
      { sub: users.committee },
      (client) =>
        client.query('select * from public.billing_charges_list($1)', [
          societyId,
        ]),
    );
    expect(read.rows.length).toBeGreaterThan(0);
    for (const role of ['committee', 'guard', 'resident', 'outsider']) {
      expect(
        (
          await dbError(
            saveCharge(`Forbidden ${role}`, 'fixed', 100, {
              user: users[role],
            }),
          )
        ).code,
      ).toBe('42501');
    }
    for (const role of ['guard', 'resident', 'outsider']) {
      const rows = await database.asRole(
        'authenticated',
        { sub: users[role] },
        (client) =>
          client.query(
            'select id from public.billing_charge_types where society_id = $1',
            [societyId],
          ),
      );
      expect(rows.rows).toEqual([]);
    }
    expect(
      (
        await dbError(
          saveCharge('Other society', 'fixed', 100, {
            society: otherSocietyId,
          }),
        )
      ).code,
    ).toBe('42501');
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: users.admin }, (client) =>
            client.query('select * from public.billing_receipt_counters'),
          ),
        )
      ).code,
    ).toBe('42501');
    expect(
      (
        await dbError(
          database.asRole('anon', null, (client) =>
            client.query('select public.billing_payment_details_get($1)', [
              societyId,
            ]),
          ),
        )
      ).code,
    ).toBe('42501');
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: users.admin }, (client) =>
            client.query(
              "update public.billing_charge_types set name = 'Direct edit'",
            ),
          ),
        )
      ).code,
    ).toBe('42501');
  });

  it('audits old and new UPI details and notifies every active admin and committee member once', async () => {
    expect(await paymentDetails()).toBeNull();
    const first = await updateDetails('homeish-test@example', null, {
      requestId: 'billing-upi-first',
    });
    expect(first.updated_by_name).toBe('Billing admin');
    const second = await updateDetails(
      'homeish-updated@example',
      first.updated_at,
      {
        user: users['second-admin'],
        requestId: 'billing-upi-second',
      },
    );
    expect(second.updated_by_name).toBe('Billing second-admin');
    expect(
      (await dbError(updateDetails('homeish-stale@example', first.updated_at)))
        .code,
    ).toBe('23505');
    expect(
      (await dbError(updateDetails('homeish-concurrent@example', null))).code,
    ).toBe('23505');
    await updateDetails(second.upi_id, second.updated_at, {
      requestId: 'billing-upi-noop',
    });
    const records = await database.asSuperuser(async (client) => ({
      audit: (
        await client.query<{ before: Details; after: Details }>(
          `select "before", "after" from public.audit_logs where request_id = 'billing-upi-second'`,
        )
      ).rows,
      notifications: (
        await client.query<{ user_id: string; body: string }>(
          `select user_id, body from public.notifications where request_id = 'billing-upi-second'`,
        )
      ).rows,
      noops: (
        await client.query(
          `select id from public.notifications where request_id = 'billing-upi-noop'`,
        )
      ).rows,
    }));
    expect(records.audit).toHaveLength(1);
    expect(records.audit[0]?.before.upi_id).toBe(first.upi_id);
    expect(records.audit[0]?.after.upi_id).toBe(second.upi_id);
    expect(records.notifications.map(({ user_id }) => user_id).sort()).toEqual(
      [users.admin, users['second-admin'], users.committee].sort(),
    );
    expect(
      records.notifications.every(({ body }) => !body.includes('@example')),
    ).toBe(true);
    expect(records.noops).toEqual([]);
    for (const role of ['resident', 'guard', 'committee']) {
      const details = await database.asRole(
        'authenticated',
        { sub: users[role] },
        (client) =>
          client.query<{ details: Details }>(
            'select public.billing_payment_details_get($1) as details',
            [societyId],
          ),
      );
      expect(details.rows[0]?.details.upi_id).toBe(second.upi_id);
      expect(
        (
          await dbError(
            updateDetails('forbidden@example', second.updated_at, {
              user: users[role],
            }),
          )
        ).code,
      ).toBe('42501');
    }
    expect(
      (await dbError(updateDetails('invalid upi', second.updated_at))).code,
    ).toBe('23514');
    expect(
      (
        await dbError(
          updateDetails('cross-society@example', null, {
            society: otherSocietyId,
          }),
        )
      ).code,
    ).toBe('42501');
  });

  it('enforces module-disabled, suspended and archived states at the database boundary', async () => {
    const current = await paymentDetails();
    if (!current) throw new Error('Payment setup is missing.');
    try {
      await database.asSuperuser((client) =>
        client.query(
          "update public.module_configs set enabled = false where society_id = $1 and module_key = 'billing'",
          [societyId],
        ),
      );
      expect((await dbError(saveCharge('Disabled', 'fixed', 100))).code).toBe(
        '42501',
      );
      expect((await dbError(paymentDetails())).code).toBe('42501');
      expect(
        (await dbError(updateDetails('disabled@example', current.updated_at)))
          .code,
      ).toBe('42501');
      const hidden = await database.asRole(
        'authenticated',
        { sub: users.admin },
        (client) =>
          client.query('select * from public.billing_payment_details'),
      );
      expect(hidden.rows).toEqual([]);
      await database.asSuperuser(async (client) => {
        await client.query(
          "update public.module_configs set enabled = true where society_id = $1 and module_key = 'billing'",
          [societyId],
        );
        await client.query(
          "update public.societies set status = 'suspended' where id = $1",
          [societyId],
        );
      });
      expect((await paymentDetails())?.upi_id).toBe(current.upi_id);
      expect((await dbError(saveCharge('Suspended', 'fixed', 100))).code).toBe(
        '42501',
      );
      expect(
        (await dbError(updateDetails('suspended@example', current.updated_at)))
          .code,
      ).toBe('42501');
      await database.asSuperuser((client) =>
        client.query(
          "update public.societies set status = 'archived' where id = $1",
          [societyId],
        ),
      );
      expect((await dbError(paymentDetails())).code).toBe('42501');
      const archived = await database.asRole(
        'authenticated',
        { sub: users.admin },
        (client) => client.query('select * from public.billing_charge_types'),
      );
      expect(archived.rows).toEqual([]);
    } finally {
      await database.asSuperuser(async (client) => {
        await client.query(
          "update public.societies set status = 'trial' where id = $1",
          [societyId],
        );
        await client.query(
          "update public.module_configs set enabled = true where society_id = $1 and module_key = 'billing'",
          [societyId],
        );
      });
    }
  });

  it('validates configured late fees, reminders and integer day settings in PostgreSQL', async () => {
    const valid = [
      {},
      { late_fee: null },
      { late_fee: { type: 'percent', value: 2.55 } },
      { late_fee: { type: 'percent', value: 100 } },
      { late_fee: { type: 'flat', value: 125 } },
    ];
    const invalid = [
      { late_fee: { type: 'percent', value: 100.01 } },
      { late_fee: { type: 'percent', value: 2.555 } },
      { late_fee: { type: null, value: 1 } },
      { late_fee: { type: 'flat', value: 1.5 } },
      { due_day_of_month: 32 },
      { grace_days: -1 },
      { pending_confirmation_alert_days: 0 },
      {
        reminders: { before_due_days: 3, on_due: true, overdue_every_days: 0 },
      },
      { upi_id: 'not-a-setting@example' },
    ];
    for (const settings of valid) {
      await database.asSuperuser((client) =>
        client.query(
          "update public.module_configs set settings = $2 where society_id = $1 and module_key = 'billing'",
          [societyId, JSON.stringify(settings)],
        ),
      );
    }
    for (const settings of invalid) {
      expect(
        (
          await dbError(
            database.asSuperuser((client) =>
              client.query(
                "update public.module_configs set settings = $2 where society_id = $1 and module_key = 'billing'",
                [societyId, JSON.stringify(settings)],
              ),
            ),
          )
        ).code,
      ).toBe('23514');
    }
  });

  it('protects unpublished and attached QR images and rechecks file ownership and metadata', async () => {
    const path = `${societyId}/billing-qr/9e4d44d0-76a7-45e8-bfa8-83b8e3f8637a.png`;
    const fakePath = `${societyId}/billing-qr/ae4d44d0-76a7-45e8-bfa8-83b8e3f8637a.png`;
    const current = await paymentDetails();
    if (!current) throw new Error('Payment setup is missing.');
    await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query(
          `insert into storage.objects (bucket_id, name, metadata)
         values ('society-assets', $1, '{"mimetype":"image/png","size":1200}')`,
          [path],
        ),
      { commit: true },
    );
    const unpublished = await database.asRole(
      'authenticated',
      { sub: users.resident },
      (client) =>
        client.query('select name from storage.objects where name = $1', [
          path,
        ]),
    );
    expect(unpublished.rows).toEqual([]);
    expect(
      (
        await dbError(
          updateDetails(current.upi_id, current.updated_at, {
            qrPath: fakePath,
          }),
        )
      ).code,
    ).toBe('22023');
    await database.asSuperuser((client) =>
      client.query(
        `insert into storage.objects (bucket_id, name, metadata)
         values ('society-assets', $1, '{"mimetype":"image/png","size":5242881}')`,
        [fakePath],
      ),
    );
    expect(
      (
        await dbError(
          updateDetails(current.upi_id, current.updated_at, {
            qrPath: fakePath,
          }),
        )
      ).code,
    ).toBe('22023');
    await database.asSuperuser((client) =>
      client.query(
        `update storage.objects set metadata = '{"mimetype":"application/pdf","size":1200}' where name = $1`,
        [fakePath],
      ),
    );
    expect(
      (
        await dbError(
          updateDetails(current.upi_id, current.updated_at, {
            qrPath: fakePath,
          }),
        )
      ).code,
    ).toBe('22023');
    const saved = await updateDetails(current.upi_id, current.updated_at, {
      qrPath: path,
    });
    const published = await database.asRole(
      'authenticated',
      { sub: users.resident },
      (client) =>
        client.query('select name from storage.objects where name = $1', [
          path,
        ]),
    );
    expect(published.rows).toEqual([{ name: path }]);
    const mutation = await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query(
          "update storage.objects set metadata = '{}' where name = $1 returning name",
          [path],
        ),
    );
    expect(mutation.rows).toEqual([]);
    const deletion = await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query(
          'delete from storage.objects where name = $1 returning name',
          [path],
        ),
    );
    expect(deletion.rows).toEqual([]);
    expect(
      (
        await dbError(
          database.asRole('authenticated', { sub: users.resident }, (client) =>
            client.query(
              "insert into storage.objects (bucket_id, name) values ('society-assets', $1)",
              [fakePath],
            ),
          ),
        )
      ).code,
    ).toBe('42501');
    await updateDetails(saved.upi_id, saved.updated_at);
    const unused = await database.asRole(
      'authenticated',
      { sub: users.admin },
      (client) =>
        client.query(
          'delete from storage.objects where name = $1 returning name',
          [path],
        ),
    );
    expect(unused.rows).toEqual([{ name: path }]);
  });

  it('allows only one concurrent first save and records one complete audit and notification set', async () => {
    const raceSocietyId = await database.asSuperuser(async (client) => {
      const id = (
        await client.query<{ id: string }>(
          `insert into public.societies (name, created_by)
         values ('Concurrent Billing Society', $1) returning id`,
          [users.admin],
        )
      ).rows[0]?.id;
      if (!id) throw new Error('The concurrency fixture was not created.');
      await client.query(
        `insert into public.module_configs (society_id, module_key, enabled)
         values ($1, 'billing', true)`,
        [id],
      );
      await client.query(
        `insert into public.memberships (society_id, user_id, roles, status)
         values ($1, $2, ARRAY['admin']::text[], 'active'),
                ($1, $3, ARRAY['admin']::text[], 'active')`,
        [id, users.admin, users['second-admin']],
      );
      return id;
    });
    const outcomes = await Promise.allSettled([
      updateDetails('first-draft@example', null, {
        society: raceSocietyId,
        user: users.admin,
        requestId: 'billing-concurrent-first',
      }),
      updateDetails('second-draft@example', null, {
        society: raceSocietyId,
        user: users['second-admin'],
        requestId: 'billing-concurrent-first',
      }),
    ]);
    expect(
      outcomes.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(
      rejected?.status === 'rejected' ? rejected.reason : null,
    ).toMatchObject({ code: '23505' });
    const counts = await database.asSuperuser(async (client) => ({
      audits: (
        await client.query(
          `select id from public.audit_logs where society_id = $1 and action = 'billing.paymentDetails.update'`,
          [raceSocietyId],
        )
      ).rowCount,
      notifications: (
        await client.query(
          'select id from public.notifications where society_id = $1',
          [raceSocietyId],
        )
      ).rowCount,
    }));
    expect(counts).toEqual({ audits: 1, notifications: 2 });
  });
});
