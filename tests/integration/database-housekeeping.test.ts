// Verify append-only fractional inventory, historical balances, concurrency and access.
import { describe, expect, it } from 'vitest';
import {
  createTestDatabase,
  dbError,
  hasDatabase,
  newAuthUser,
} from './support/database';

describe.skipIf(!hasDatabase)('database housekeeping inventory', () => {
  it('preserves dated balances, rejects concurrent overspending and scopes reports', async () => {
    const database = await createTestDatabase();
    try {
      const fixture = await database.asSuperuser(async (client) => {
        const users = new Map<string, string>();
        for (const role of [
          'admin',
          'hk_supervisor',
          'committee',
          'resident',
        ]) {
          const id = await newAuthUser(
            client,
            `inventory-${role}@example.test`,
          );
          users.set(role, id);
          await client.query(
            `insert into public.profiles (id, email, full_name) values ($1, $2, $3)`,
            [id, `inventory-${role}@example.test`, `Inventory ${role}`],
          );
        }
        const societyId = (
          await client.query<{ id: string }>(
            `insert into public.societies (name, created_by) values ('Inventory Society', $1) returning id`,
            [users.get('admin')],
          )
        ).rows[0]!.id;
        for (const [role, id] of users) {
          await client.query(
            `insert into public.memberships (society_id, user_id, roles, status)
             values ($1, $2, $3, 'active')`,
            [societyId, id, [role]],
          );
        }
        await client.query(
          `insert into public.module_configs (society_id, module_key, enabled, settings)
           values ($1, 'core', true, '{}'), ($1, 'housekeeping', true, '{}')`,
          [societyId],
        );
        const dates = (
          await client.query<{
            today: string;
            earlier: string;
            middle: string;
          }>(
            `select private.housekeeping_local_date($1)::text as today,
              (private.housekeeping_local_date($1) - 3)::text as earlier,
              (private.housekeeping_local_date($1) - 2)::text as middle`,
            [societyId],
          )
        ).rows[0]!;
        return { users, societyId, ...dates };
      });
      const asUser = <T>(
        role: string,
        query: Parameters<typeof database.asSuperuser<T>>[0],
      ) => {
        const userId = fixture.users.get(role);
        if (!userId) throw new Error('Missing inventory fixture user.');
        return database.asRole('authenticated', { sub: userId }, query, {
          commit: true,
        });
      };
      const itemId = await asUser(
        'admin',
        async (client) =>
          (
            await client.query<{ id: string }>(
              `select public.housekeeping_item_save(
              $1, null, 'Cleaner', 'litres', 'cleaning', 1, true, null, 'inventory-item'
            ) as id`,
              [fixture.societyId],
            )
          ).rows[0]!.id,
      );
      const record = (
        kind: string,
        quantity: string,
        date: string,
        requestId = crypto.randomUUID(),
        role = 'hk_supervisor',
      ) =>
        asUser(
          role,
          async (client) =>
            (
              await client.query<{ id: string }>(
                `select public.housekeeping_stock_record(
                $1, $2, $3, $4, $5, 'Synthetic vendor', 'Stock usage',
                null, $6, 'inventory-stock'
              ) as id`,
                [fixture.societyId, itemId, kind, quantity, date, requestId],
              )
            ).rows[0]!.id,
        );
      await record('in', '5.125', fixture.earlier);
      await record('out', '5', fixture.middle);
      const retryId = crypto.randomUUID();
      const receipt = await record('in', '10', fixture.today, retryId);
      expect(await record('in', '10', fixture.today, retryId)).toBe(receipt);

      // Current stock is sufficient, but this date precedes the latest receipt.
      expect((await dbError(record('out', '1', fixture.middle))).code).toBe(
        '23514',
      );
      expect((await dbError(record('in', '0.0001', fixture.today))).code).toBe(
        '22023',
      );
      const future = new Date(`${fixture.today}T00:00:00Z`);
      future.setUTCDate(future.getUTCDate() + 1);
      expect(
        (await dbError(record('in', '1', future.toISOString().slice(0, 10))))
          .code,
      ).toBe('22023');
      expect(
        (
          await dbError(
            record('in', '1', fixture.today, crypto.randomUUID(), 'committee'),
          )
        ).code,
      ).toBe('42501');
      expect(
        (
          await dbError(
            asUser('resident', (client) =>
              client.query(`select public.housekeeping_items_list($1)`, [
                fixture.societyId,
              ]),
            ),
          )
        ).code,
      ).toBe('42501');

      const concurrent = await Promise.allSettled([
        record('out', '6', fixture.today),
        record('out', '6', fixture.today),
      ]);
      expect(
        concurrent.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        concurrent.filter(({ status }) => status === 'rejected'),
      ).toHaveLength(1);
      const items = await asUser(
        'committee',
        async (client) =>
          (
            await client.query<{ result: { stock: string }[] }>(
              `select public.housekeeping_items_list($1) as result`,
              [fixture.societyId],
            )
          ).rows[0]!.result,
      );
      expect(items[0]?.stock).toBe('4.125');
      expect(
        (
          await dbError(
            database.asSuperuser((client) =>
              client.query(
                `update public.housekeeping_transactions set quantity = 1 where id = $1`,
                [receipt],
              ),
            ),
          )
        ).code,
      ).toBe('23514');
      const alerts = await database.asSuperuser((client) =>
        client.query<{ count: string }>(
          `select count(*) from public.notifications where society_id = $1 and type = 'inventory_low_stock'`,
          [fixture.societyId],
        ),
      );
      expect(alerts.rows[0]?.count).toBe('2');
      const repeated = await database.asRole(
        'service_role',
        null,
        (client) =>
          client.query<{ count: number }>(
            `select public.housekeeping_low_stock_run($1, 'inventory-daily') as count`,
            [fixture.societyId],
          ),
        { commit: true },
      );
      expect(repeated.rows[0]?.count).toBe(0);
      await database.asSuperuser((client) =>
        client.query(
          `update public.module_configs set enabled = false where society_id = $1 and module_key = 'housekeeping'`,
          [fixture.societyId],
        ),
      );
      expect((await dbError(record('in', '1', fixture.today))).code).toBe(
        '42501',
      );
    } finally {
      await database.drop();
    }
  });
});
