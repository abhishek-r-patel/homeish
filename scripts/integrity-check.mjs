// Read-only integrity checks for post-restore and monthly operations.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const CHECKS = [
  {
    name: 'bill-paid-allocation',
    sql: `
      SELECT count(*)::integer AS violations
      FROM public.billing_bills AS bill
      LEFT JOIN public.billing_payment_allocations AS allocation
        ON allocation.society_id = bill.society_id
        AND allocation.bill_id = bill.id
      GROUP BY bill.id, bill.paid_paise
      HAVING bill.paid_paise <> coalesce(sum(allocation.amount_paise), 0)
    `,
    aggregate: true,
  },
  {
    name: 'payment-allocation-limit',
    sql: `
      SELECT count(*)::integer AS violations
      FROM public.billing_payments AS payment
      LEFT JOIN public.billing_payment_allocations AS allocation
        ON allocation.society_id = payment.society_id
        AND allocation.payment_id = payment.id
      GROUP BY payment.id, payment.amount_paise
      HAVING coalesce(sum(allocation.amount_paise), 0) > payment.amount_paise
    `,
    aggregate: true,
  },
  {
    name: 'bill-line-total',
    sql: `
      SELECT count(*)::integer AS violations
      FROM public.billing_bills AS bill
      LEFT JOIN public.billing_bill_lines AS line
        ON line.society_id = bill.society_id
        AND line.bill_id = bill.id
      GROUP BY bill.id, bill.total_paise
      HAVING bill.total_paise <> coalesce(sum(line.amount_paise), 0)
    `,
    aggregate: true,
  },
  {
    name: 'unit-ledger-balance',
    sql: `
      WITH bill_totals AS (
        SELECT society_id, unit_id,
          sum(total_paise)::numeric AS billed,
          sum(waived_paise)::numeric AS waived
        FROM public.billing_bills
        GROUP BY society_id, unit_id
      ),
      payment_totals AS (
        SELECT society_id, unit_id, sum(amount_paise)::numeric AS paid
        FROM public.billing_payments
        WHERE status = 'confirmed'
        GROUP BY society_id, unit_id
      ),
      adjustment_totals AS (
        SELECT society_id, unit_id,
          sum(CASE direction
            WHEN 'debit' THEN amount_paise
            ELSE -amount_paise
          END)::numeric AS adjusted
        FROM public.billing_ledger_entries
        WHERE kind = 'adjustment'
        GROUP BY society_id, unit_id
      ),
      ledger_totals AS (
        SELECT society_id, unit_id,
          sum(CASE direction
            WHEN 'debit' THEN amount_paise
            ELSE -amount_paise
          END)::numeric AS balance
        FROM public.billing_ledger_entries
        GROUP BY society_id, unit_id
      )
      SELECT count(*)::integer AS violations
      FROM public.units AS unit
      LEFT JOIN bill_totals AS bills
        ON bills.society_id = unit.society_id AND bills.unit_id = unit.id
      LEFT JOIN payment_totals AS payments
        ON payments.society_id = unit.society_id
        AND payments.unit_id = unit.id
      LEFT JOIN adjustment_totals AS adjustments
        ON adjustments.society_id = unit.society_id
        AND adjustments.unit_id = unit.id
      LEFT JOIN ledger_totals AS ledger
        ON ledger.society_id = unit.society_id AND ledger.unit_id = unit.id
      WHERE coalesce(ledger.balance, 0) <>
        coalesce(bills.billed, 0) - coalesce(payments.paid, 0)
        - coalesce(bills.waived, 0) + coalesce(adjustments.adjusted, 0)
    `,
  },
  {
    name: 'confirmed-payment-attribution',
    sql: `
      SELECT count(*)::integer AS violations
      FROM public.billing_payments
      WHERE status = 'confirmed'
        AND (receipt_no IS NULL OR confirmed_by IS NULL OR confirmed_at IS NULL)
    `,
  },
  {
    name: 'active-primary-occupant',
    sql: `
      SELECT count(*)::integer AS violations
      FROM (
        SELECT unit_id
        FROM public.unit_occupants
        WHERE status = 'active' AND is_primary
        GROUP BY unit_id
        HAVING count(*) > 1
      ) AS duplicate_primaries
    `,
  },
  {
    name: 'membership-identity',
    sql: `
      SELECT count(*)::integer AS violations
      FROM public.memberships AS membership
      WHERE (
        membership.user_id IS NULL
        AND (
          membership.invited_email IS NULL
          OR char_length(btrim(membership.invited_email::text)) = 0
        )
      ) OR (
        membership.user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.profiles AS profile
          WHERE profile.id = membership.user_id
        )
      )
    `,
  },
  {
    name: 'bill-line-society',
    sql: `
      SELECT count(*)::integer AS violations
      FROM public.billing_bill_lines AS line
      JOIN public.billing_bills AS bill ON bill.id = line.bill_id
      WHERE line.society_id <> bill.society_id
    `,
  },
  {
    name: 'ledger-payment-parent',
    sql: `
      SELECT count(*)::integer AS violations
      FROM public.billing_ledger_entries AS entry
      WHERE entry.kind = 'payment'
        AND NOT EXISTS (
          SELECT 1
          FROM public.billing_payments AS payment
          WHERE payment.id = entry.payment_id
            AND payment.society_id = entry.society_id
            AND payment.unit_id = entry.unit_id
        )
    `,
  },
  {
    name: 'stored-file-reference',
    sql: `
      WITH stored_paths(bucket_id, path) AS (
        SELECT 'visitor-photos', photo_path
        FROM public.visitor_entries
        WHERE photo_path IS NOT NULL
        UNION ALL
        SELECT 'delivery-photos', photo_path
        FROM public.delivery_entries
        WHERE photo_path IS NOT NULL
        UNION ALL
        SELECT 'request-files', storage_path
        FROM public.service_request_attachments
        UNION ALL
        SELECT 'payment-proofs', proof_path
        FROM public.billing_payments
        WHERE proof_path IS NOT NULL
        UNION ALL
        SELECT 'society-assets', logo_path
        FROM public.societies
        WHERE logo_path IS NOT NULL
        UNION ALL
        SELECT 'society-assets', qr_path
        FROM public.billing_payment_details
        WHERE qr_path IS NOT NULL
      )
      SELECT count(*)::integer AS violations
      FROM stored_paths AS reference
      WHERE NOT EXISTS (
        SELECT 1
        FROM storage.objects AS object
        WHERE object.bucket_id = reference.bucket_id
          AND object.name = reference.path
      )
    `,
  },
  {
    name: 'orphaned-storage-object',
    sql: `
      WITH stored_paths(bucket_id, path) AS (
        SELECT 'visitor-photos', photo_path
        FROM public.visitor_entries
        WHERE photo_path IS NOT NULL
        UNION ALL
        SELECT 'delivery-photos', photo_path
        FROM public.delivery_entries
        WHERE photo_path IS NOT NULL
        UNION ALL
        SELECT 'request-files', storage_path
        FROM public.service_request_attachments
        UNION ALL
        SELECT 'payment-proofs', proof_path
        FROM public.billing_payments
        WHERE proof_path IS NOT NULL
        UNION ALL
        SELECT 'society-assets', logo_path
        FROM public.societies
        WHERE logo_path IS NOT NULL
        UNION ALL
        SELECT 'society-assets', qr_path
        FROM public.billing_payment_details
        WHERE qr_path IS NOT NULL
      )
      SELECT count(*)::integer AS violations
      FROM storage.objects AS object
      WHERE object.bucket_id IN (
        'visitor-photos', 'delivery-photos', 'request-files',
        'payment-proofs', 'society-assets'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM stored_paths AS reference
        WHERE reference.bucket_id = object.bucket_id
          AND reference.path = object.name
      )
    `,
  },
  {
    name: 'unmapped-profile-photo-path',
    sql: `
      SELECT count(*)::integer AS violations
      FROM public.profiles
      WHERE photo_path IS NOT NULL
    `,
  },
];

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function queryCount(client, sql) {
  const result = await client.query(sql);
  if (result.rows.length !== 1) {
    throw new Error('An integrity check returned an invalid result.');
  }
  const violations = Number(result.rows[0]?.violations);
  if (!Number.isSafeInteger(violations) || violations < 0) {
    throw new Error('An integrity check returned an invalid violation count.');
  }
  return violations;
}

async function countGroupMismatches(client) {
  const constraints = await client.query(`
    SELECT
      child_namespace.nspname AS child_schema,
      child_table.relname AS child_table,
      parent_namespace.nspname AS parent_schema,
      parent_table.relname AS parent_table,
      max(child_column.attname::text) FILTER (
        WHERE child_column.attname = 'society_id'
      ) AS child_society_column,
      max(parent_column.attname::text) FILTER (
        WHERE parent_column.attname = 'society_id'
      ) AS parent_society_column,
      array_agg(child_column.attname::text ORDER BY pair.ordinality) FILTER (
        WHERE child_column.attname <> 'society_id'
          AND parent_column.attname <> 'society_id'
      ) AS child_join_columns,
      array_agg(parent_column.attname::text ORDER BY pair.ordinality) FILTER (
        WHERE child_column.attname <> 'society_id'
          AND parent_column.attname <> 'society_id'
      ) AS parent_join_columns
    FROM pg_catalog.pg_constraint AS constraint_row
    JOIN pg_catalog.pg_class AS child_table
      ON child_table.oid = constraint_row.conrelid
    JOIN pg_catalog.pg_namespace AS child_namespace
      ON child_namespace.oid = child_table.relnamespace
    JOIN pg_catalog.pg_class AS parent_table
      ON parent_table.oid = constraint_row.confrelid
    JOIN pg_catalog.pg_namespace AS parent_namespace
      ON parent_namespace.oid = parent_table.relnamespace
    CROSS JOIN LATERAL unnest(
      constraint_row.conkey, constraint_row.confkey
    ) WITH ORDINALITY AS pair(child_attnum, parent_attnum, ordinality)
    JOIN pg_catalog.pg_attribute AS child_column
      ON child_column.attrelid = child_table.oid
      AND child_column.attnum = pair.child_attnum
    JOIN pg_catalog.pg_attribute AS parent_column
      ON parent_column.attrelid = parent_table.oid
      AND parent_column.attnum = pair.parent_attnum
    WHERE constraint_row.contype = 'f'
      AND child_namespace.nspname = 'public'
      AND parent_namespace.nspname = 'public'
    GROUP BY
      constraint_row.oid,
      child_namespace.nspname,
      child_table.relname,
      parent_namespace.nspname,
      parent_table.relname
    HAVING bool_or(
      child_column.attname = 'society_id'
      AND parent_column.attname = 'society_id'
    )
      AND count(*) FILTER (
        WHERE child_column.attname <> 'society_id'
          AND parent_column.attname <> 'society_id'
      ) > 0
  `);

  let violations = 0;
  for (const constraint of constraints.rows) {
    const childColumns = constraint.child_join_columns;
    const parentColumns = constraint.parent_join_columns;
    if (
      !Array.isArray(childColumns) ||
      !Array.isArray(parentColumns) ||
      childColumns.length === 0 ||
      childColumns.length !== parentColumns.length
    ) {
      throw new Error(
        `Tenant foreign key ${constraint.child_schema}.${constraint.child_table} -> ${constraint.parent_schema}.${constraint.parent_table} has invalid join columns.`,
      );
    }

    const join = childColumns
      .map(
        (column, index) =>
          `child.${quoteIdentifier(column)} = parent.${quoteIdentifier(parentColumns[index])}`,
      )
      .join(' AND ');
    const query = `
      SELECT count(*)::integer AS violations
      FROM ${quoteIdentifier(constraint.child_schema)}.${quoteIdentifier(constraint.child_table)} AS child
      JOIN ${quoteIdentifier(constraint.parent_schema)}.${quoteIdentifier(constraint.parent_table)} AS parent
        ON ${join}
      WHERE child.${quoteIdentifier(constraint.child_society_column)}
        IS DISTINCT FROM parent.${quoteIdentifier(constraint.parent_society_column)}
    `;
    violations += await queryCount(client, query);
  }
  return violations;
}

export async function runIntegrityChecks(client) {
  const results = [];
  for (const check of CHECKS) {
    const violations = check.aggregate
      ? (await client.query(check.sql)).rows.length
      : await queryCount(client, check.sql);
    if (!Number.isSafeInteger(violations) || violations < 0) {
      throw new Error(
        `Integrity check "${check.name}" returned an invalid count.`,
      );
    }
    results.push({ name: check.name, violations });
  }
  results.push({
    name: 'same-society-foreign-keys',
    violations: await countGroupMismatches(client),
  });
  return results;
}

function requiredDatabaseUrl(environment = process.env) {
  const value = environment.SUPABASE_DB_URL?.trim();
  if (!value) {
    throw new Error('Missing required database setting: SUPABASE_DB_URL.');
  }
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('SUPABASE_DB_URL must use the PostgreSQL protocol.');
  }
  return url;
}

async function main() {
  const databaseUrl = requiredDatabaseUrl();
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(
    databaseUrl.hostname,
  );
  for (const parameter of [
    'sslmode',
    'sslcert',
    'sslkey',
    'sslrootcert',
    'sslpassword',
  ]) {
    databaseUrl.searchParams.delete(parameter);
  }
  databaseUrl.searchParams.set('sslmode', isLocal ? 'disable' : 'verify-full');
  const pool = new Pool({
    connectionString: databaseUrl.toString(),
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query('SET default_transaction_read_only = on');
      await client.query("SET statement_timeout = '2min'");
      const results = await runIntegrityChecks(client);
      for (const result of results) {
        const status = result.violations === 0 ? 'PASS' : 'FAIL';
        console.info(`${status} ${result.name}: ${result.violations}`);
      }
      if (results.some(({ violations }) => violations > 0)) {
        process.exitCode = 1;
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Integrity checks failed.',
    );
    process.exitCode = 1;
  });
}
