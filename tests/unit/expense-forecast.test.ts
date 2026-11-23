// Cover P40.9 repair forecast input boundaries.
import { describe, expect, it } from 'vitest';
import {
  expenseRepairForecastArchiveInputSchema,
  expenseRepairForecastItemInputSchema,
} from '../../src/core/expense/repair-forecast-validation';

const REQUEST_ID = '00000000-0000-4000-8000-000000000101';

function itemInput(overrides: Record<string, unknown> = {}) {
  return {
    itemId: null,
    name: 'Lift replacement',
    category: 'lifts',
    lastDoneYear: '2020',
    cycleYears: '20',
    manualNextDueYear: '',
    currentCostRupees: '1500000',
    inflationPercent: '7.5',
    notes: '',
    expectedUpdatedAt: null,
    clientRequestId: REQUEST_ID,
    ...overrides,
  };
}

describe('repair forecast input', () => {
  it('normalizes cost and inflation while deriving the next-due source', () => {
    const parsed = expenseRepairForecastItemInputSchema.parse(itemInput());
    expect(parsed.currentCostRupees).toBe(150_000_000);
    expect(parsed.inflationPercent).toBe(750);
    expect(parsed.lastDoneYear).toBe(2020);
    expect(parsed.manualNextDueYear).toBeNull();
  });

  it('accepts a manual due year only when the last-done year is unknown', () => {
    expect(
      expenseRepairForecastItemInputSchema.safeParse(
        itemInput({
          lastDoneYear: '',
          manualNextDueYear: String(new Date().getFullYear() + 2),
        }),
      ).success,
    ).toBe(true);
    expect(
      expenseRepairForecastItemInputSchema.safeParse(
        itemInput({ manualNextDueYear: '2035' }),
      ).success,
    ).toBe(false);
    expect(
      expenseRepairForecastItemInputSchema.safeParse(
        itemInput({ lastDoneYear: '', manualNextDueYear: '' }),
      ).success,
    ).toBe(false);
  });

  it('limits inflation, cycles and edit version consistency', () => {
    expect(
      expenseRepairForecastItemInputSchema.safeParse(
        itemInput({ inflationPercent: '20.01' }),
      ).success,
    ).toBe(false);
    expect(
      expenseRepairForecastItemInputSchema.safeParse(
        itemInput({ cycleYears: '51' }),
      ).success,
    ).toBe(false);
    expect(
      expenseRepairForecastItemInputSchema.safeParse(
        itemInput({
          itemId: '00000000-0000-4000-8000-000000000102',
        }),
      ).success,
    ).toBe(false);
  });

  it('requires a reason to archive and forbids one when restoring', () => {
    const common = {
      itemId: '00000000-0000-4000-8000-000000000102',
      expectedUpdatedAt: '2026-11-23T00:00:00.000Z',
      clientRequestId: REQUEST_ID,
    };
    expect(
      expenseRepairForecastArchiveInputSchema.safeParse({
        ...common,
        archive: true,
        reason: 'bad',
      }).success,
    ).toBe(false);
    expect(
      expenseRepairForecastArchiveInputSchema.safeParse({
        ...common,
        archive: true,
        reason: 'No longer planned',
      }).success,
    ).toBe(true);
    expect(
      expenseRepairForecastArchiveInputSchema.safeParse({
        ...common,
        archive: false,
        reason: 'Unexpected',
      }).success,
    ).toBe(false);
  });
});
