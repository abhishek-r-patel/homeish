// Verify the read-only integrity checker detects inconsistent billing data.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runIntegrityChecks } from '../../scripts/integrity-check.mjs';
import {
  createTestDatabase,
  hasDatabase,
  newAuthUser,
  type TestDatabase,
} from './support/database';

describe.skipIf(!hasDatabase)('database integrity checks', () => {
  let database: TestDatabase | undefined;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database?.drop();
  });

  function db(): TestDatabase {
    if (!database) {
      throw new Error('The test database was not created.');
    }
    return database;
  }

  it('passes a clean database and reports a corrupted bill line total', async () => {
    const cleanResults = await db().asSuperuser(runIntegrityChecks);
    expect(cleanResults.every(({ violations }) => violations === 0)).toBe(true);

    await db().asSuperuser(async (client) => {
      const userId = await newAuthUser(client);
      await client.query(
        `insert into public.profiles (id, email, full_name)
         values ($1, $2, $3)`,
        [userId, `${userId}@example.test`, 'Integrity Test User'],
      );
      const society = await client.query<{ id: string }>(
        `insert into public.societies (name, created_by)
         values ('Integrity Test Society', $1)
         returning id`,
        [userId],
      );
      const societyId = society.rows[0]?.id;
      if (!societyId) {
        throw new Error('The integrity test society was not created.');
      }

      const block = await client.query<{ id: string }>(
        `insert into public.blocks (society_id, created_by, name)
         values ($1, $2, 'A')
         returning id`,
        [societyId, userId],
      );
      const unit = await client.query<{ id: string }>(
        `insert into public.units (society_id, created_by, block_id, number)
         values ($1, $2, $3, '101')
         returning id`,
        [societyId, userId, block.rows[0]?.id],
      );
      const unitId = unit.rows[0]?.id;
      if (!unitId) {
        throw new Error('The integrity test unit was not created.');
      }

      const bill = await client.query<{ id: string }>(
        `insert into public.billing_bills (
           society_id, unit_id, title, period_start, due_date,
           total_paise, created_by
         )
         values ($1, $2, 'Maintenance', '2026-11-01', '2026-11-10', 1000, $3)
         returning id`,
        [societyId, unitId, userId],
      );
      const billId = bill.rows[0]?.id;
      if (!billId) {
        throw new Error('The integrity test bill was not created.');
      }
      await client.query(
        `insert into public.billing_bill_lines (
           society_id, bill_id, unit_id, period_start,
           description, amount_paise, created_by
         )
         values ($1, $2, $3, '2026-11-01', 'Maintenance', 900, $4)`,
        [societyId, billId, unitId, userId],
      );
      await client.query(
        `insert into public.billing_ledger_entries (
           society_id, unit_id, kind, direction, amount_paise, bill_id, created_by
         )
         values ($1, $2, 'bill', 'debit', 1000, $3, $4)`,
        [societyId, unitId, billId, userId],
      );
    });

    const failedResults = await db().asSuperuser(runIntegrityChecks);
    expect(
      failedResults.find(({ name }) => name === 'bill-line-total'),
    ).toEqual({ name: 'bill-line-total', violations: 1 });
    expect(
      failedResults
        .filter(({ name }) => name !== 'bill-line-total')
        .every(({ violations }) => violations === 0),
    ).toBe(true);
  });
});
