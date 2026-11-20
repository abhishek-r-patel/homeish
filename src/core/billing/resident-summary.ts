// Keep household bill totals exact across resident screens.
export type ResidentUnitOutstanding = {
  unit_id: string;
  outstanding_paise: string;
  next_due_date: string;
};

export function residentOutstandingTotal(
  units: readonly ResidentUnitOutstanding[],
): bigint {
  return units.reduce(
    (total, unit) => total + BigInt(unit.outstanding_paise),
    BigInt(0),
  );
}

export function residentNextDueDate(
  units: readonly ResidentUnitOutstanding[],
): string | null {
  return (
    units
      .map((unit) => unit.next_due_date)
      .sort((a, b) => a.localeCompare(b))[0] ?? null
  );
}
