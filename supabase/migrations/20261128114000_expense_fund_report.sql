-- Add the approved partial P40.8 fund balance and monthly movement report.
CREATE FUNCTION private.expense_fund_balance(
  p_society_id uuid,
  p_fund_id uuid,
  p_as_of date
)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT latest.amount_paise
    FROM public.expense_fund_openings AS opening
    JOIN public.expense_fund_opening_allocations AS latest
      ON latest.society_id = opening.society_id
      AND latest.opening_id = opening.id
      AND latest.fund_id = p_fund_id
      AND latest.allocation_version_id =
        private.expense_fund_latest_opening_version(opening.id)
    WHERE opening.society_id = p_society_id
  ), 0)::bigint
  + COALESCE((
    SELECT sum(CASE entry.direction WHEN 'in'
      THEN allocation.amount_paise ELSE -allocation.amount_paise END)
    FROM public.expense_fund_entry_allocations AS allocation
    JOIN public.expense_book_entries AS entry
      ON entry.society_id = allocation.society_id AND entry.id = allocation.entry_id
    WHERE allocation.society_id = p_society_id
      AND allocation.fund_id = p_fund_id
      AND entry.entry_date <= p_as_of
      AND allocation.allocation_version_id =
        private.expense_fund_latest_allocation_version(entry.id)
  ), 0)::bigint
  + COALESCE((
    SELECT sum(CASE
      WHEN transfer.from_fund_id = p_fund_id THEN -transfer.amount_paise
      WHEN transfer.to_fund_id = p_fund_id THEN transfer.amount_paise
      ELSE 0 END)
    FROM public.expense_fund_transfers AS transfer
    WHERE transfer.society_id = p_society_id
      AND transfer.transfer_on <= p_as_of
      AND (
        transfer.from_fund_id = p_fund_id OR transfer.to_fund_id = p_fund_id
      )
  ), 0)::bigint
$$;
REVOKE ALL ON FUNCTION private.expense_fund_balance(uuid, uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.expense_fund_report(
  p_society_id uuid,
  p_from date,
  p_to date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  opening public.expense_fund_openings;
  accounts_total bigint;
  named_total bigint;
BEGIN
  PERFORM private.expense_authorize(p_society_id, 'read');
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to
    OR p_to - p_from > 731
  THEN
    RAISE EXCEPTION 'Choose a valid fund report range of up to two years.'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO opening FROM public.expense_fund_openings
  WHERE society_id = p_society_id;
  IF opening.id IS NULL THEN
    RAISE EXCEPTION 'Activate fund tracking first.' USING ERRCODE = '23514';
  END IF;
  accounts_total := private.expense_accounts_total(p_society_id, p_to);
  SELECT COALESCE(sum(
    private.expense_fund_balance(p_society_id, fund.id, p_to)
  ), 0)::bigint INTO named_total
  FROM public.expense_funds AS fund
  WHERE fund.society_id = p_society_id;
  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'accounts_total_paise', accounts_total,
    'named_funds_total_paise', named_total,
    'unallocated_paise', accounts_total - named_total,
    'funds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'fund_id', fund.id,
        'fund_name', fund.name,
        'balance_paise', private.expense_fund_balance(
          p_society_id, fund.id, p_to
        ),
        'months', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'month', month.month,
            'entry_in_paise', month.entry_in_paise,
            'entry_out_paise', month.entry_out_paise,
            'transfer_in_paise', month.transfer_in_paise,
            'transfer_out_paise', month.transfer_out_paise,
            'net_paise', month.entry_in_paise - month.entry_out_paise
              + month.transfer_in_paise - month.transfer_out_paise
          ) ORDER BY month.month)
          FROM (
            SELECT dates.month,
              COALESCE((
                SELECT sum(allocation.amount_paise)
                FROM public.expense_fund_entry_allocations AS allocation
                JOIN public.expense_book_entries AS entry
                  ON entry.society_id = allocation.society_id
                  AND entry.id = allocation.entry_id
                WHERE allocation.society_id = p_society_id
                  AND allocation.fund_id = fund.id
                  AND allocation.allocation_version_id =
                    private.expense_fund_latest_allocation_version(entry.id)
                  AND entry.direction = 'in'
                  AND entry.entry_date BETWEEN p_from AND p_to
                  AND date_trunc('month', entry.entry_date)::date = dates.month
              ), 0)::bigint AS entry_in_paise,
              COALESCE((
                SELECT sum(allocation.amount_paise)
                FROM public.expense_fund_entry_allocations AS allocation
                JOIN public.expense_book_entries AS entry
                  ON entry.society_id = allocation.society_id
                  AND entry.id = allocation.entry_id
                WHERE allocation.society_id = p_society_id
                  AND allocation.fund_id = fund.id
                  AND allocation.allocation_version_id =
                    private.expense_fund_latest_allocation_version(entry.id)
                  AND entry.direction = 'out'
                  AND entry.entry_date BETWEEN p_from AND p_to
                  AND date_trunc('month', entry.entry_date)::date = dates.month
              ), 0)::bigint AS entry_out_paise,
              COALESCE((
                SELECT sum(transfer.amount_paise)
                FROM public.expense_fund_transfers AS transfer
                WHERE transfer.society_id = p_society_id
                  AND transfer.to_fund_id = fund.id
                  AND transfer.transfer_on BETWEEN p_from AND p_to
                  AND date_trunc('month', transfer.transfer_on)::date = dates.month
              ), 0)::bigint AS transfer_in_paise,
              COALESCE((
                SELECT sum(transfer.amount_paise)
                FROM public.expense_fund_transfers AS transfer
                WHERE transfer.society_id = p_society_id
                  AND transfer.from_fund_id = fund.id
                  AND transfer.transfer_on BETWEEN p_from AND p_to
                  AND date_trunc('month', transfer.transfer_on)::date = dates.month
              ), 0)::bigint AS transfer_out_paise
            FROM generate_series(
              date_trunc('month', p_from)::date,
              date_trunc('month', p_to)::date,
              interval '1 month'
            ) AS dates(month)
          ) AS month
        ), '[]'::jsonb)
      ) ORDER BY lower(fund.name))
      FROM public.expense_funds AS fund
      WHERE fund.society_id = p_society_id
    ), '[]'::jsonb),
    'unreconciled_deposits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'deposit_id', deposit.id,
        'bank_name', deposit.bank_name,
        'fund_name', fund.name,
        'account_balance_paise', CASE WHEN deposit.account_id IS NULL THEN NULL ELSE
          private.expense_balance(p_society_id, deposit.account_id, p_to) END,
        'principal_paise', deposit.principal_paise
      ) ORDER BY deposit.maturity_on, deposit.id)
      FROM public.expense_fixed_deposits AS deposit
      JOIN public.expense_funds AS fund
        ON fund.society_id = deposit.society_id AND fund.id = deposit.fund_id
      WHERE deposit.society_id = p_society_id
        AND deposit.deposit_on <= p_to
        AND (
          deposit.account_id IS NULL
          OR deposit.id = (
            SELECT latest.id
            FROM public.expense_fixed_deposits AS latest
            WHERE latest.society_id = deposit.society_id
              AND latest.account_id = deposit.account_id
              AND latest.deposit_on <= p_to
            ORDER BY latest.deposit_on DESC, latest.id DESC
            LIMIT 1
          )
        )
        AND (
          deposit.account_id IS NULL
          OR deposit.principal_paise IS NULL
          OR private.expense_balance(
            p_society_id, deposit.account_id, p_to
          ) <> deposit.principal_paise
        )
    ), '[]'::jsonb),
    'missing_data', CASE WHEN EXISTS (
      SELECT 1 FROM public.expense_fixed_deposits
      WHERE society_id = p_society_id
        AND (principal_paise IS NULL OR account_id IS NULL)
    ) THEN true ELSE false END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.expense_fund_report(uuid, date, date)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.expense_fund_report(uuid, date, date)
  TO authenticated;
