-- Restore database-wide foreign-key indexes missed by the P46 and P50 foundations.
DO $$
DECLARE
  missing_fk record;
  index_columns text;
  index_name text;
BEGIN
  FOR missing_fk IN
    SELECT
      tbl.relname AS table_name,
      fk.conname AS constraint_name,
      fk.conkey AS column_numbers,
      fk.conrelid AS table_oid
    FROM pg_catalog.pg_constraint AS fk
    JOIN pg_catalog.pg_class AS tbl
      ON tbl.oid = fk.conrelid
    JOIN pg_catalog.pg_namespace AS ns
      ON ns.oid = tbl.relnamespace
    WHERE ns.nspname = 'public'
      AND fk.contype = 'f'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_index AS idx
        WHERE idx.indrelid = tbl.oid
          AND idx.indisvalid
          AND idx.indisready
          AND idx.indislive
          AND idx.indnkeyatts >= cardinality(fk.conkey)
          AND (
            SELECT array_agg(idx_col.attnum ORDER BY idx_col.position)
            FROM unnest(idx.indkey) WITH ORDINALITY
              AS idx_col(attnum, position)
            WHERE idx_col.position <= cardinality(fk.conkey)
          ) = fk.conkey
          AND (
            idx.indpred IS NULL
            OR regexp_replace(
              pg_catalog.pg_get_expr(idx.indpred, idx.indrelid),
              '[()]',
              '',
              'g'
            ) = (
              SELECT string_agg(
                pg_catalog.format('%I IS NOT NULL', fk_attr.attname),
                ' AND '
                ORDER BY fk_column.position
              )
              FROM unnest(fk.conkey) WITH ORDINALITY
                AS fk_column(attnum, position)
              JOIN pg_catalog.pg_attribute AS fk_attr
                ON fk_attr.attrelid = fk.conrelid
                AND fk_attr.attnum = fk_column.attnum
            )
          )
      )
  LOOP
    SELECT string_agg(
      pg_catalog.format('%I', fk_attr.attname),
      ', '
      ORDER BY fk_column.position
    )
    INTO index_columns
    FROM unnest(missing_fk.column_numbers) WITH ORDINALITY
      AS fk_column(attnum, position)
    JOIN pg_catalog.pg_attribute AS fk_attr
      ON fk_attr.attrelid = missing_fk.table_oid
      AND fk_attr.attnum = fk_column.attnum;

    index_name := 'idx_'
      || left(
        md5(missing_fk.table_name || ':' || missing_fk.constraint_name),
        12
      )
      || '_'
      || left(missing_fk.constraint_name, 43);

    EXECUTE format(
      'CREATE INDEX %I ON public.%I (%s)',
      index_name,
      missing_fk.table_name,
      index_columns
    );
  END LOOP;
END
$$;
