// Edit a P42.5 budget draft with explicit monthly phasing.
'use client';

import { useId, useState } from 'react';
import { saveExpenseBudgetDraftAction } from '@/app/(admin)/admin/expenses/actions';
import { useUiTranslator } from '@/components/ui/language';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput } from '@/components/ui/specialized-inputs';
import {
  EXPENSE_BUDGET_MONTHS,
  EXPENSE_BUDGET_PHASINGS,
  type ExpenseBudget,
  type ExpenseBudgetCopyPreview,
  spreadExpenseBudgetAmount,
} from '@/core/expense/budget-validation';
import {
  nonnegativeRupeesSchema,
  rupeesFromPaise,
} from '@/core/billing/validation';

const PHASING_LABELS = {
  equal_monthly: 'Equal monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half-yearly',
  first_month: 'First month',
  custom: 'Month by month',
} as const;

type DraftRow = {
  categoryId: string | null;
  incomeType: ExpenseBudget['heads'][number]['income_type'];
  name: string;
  kind: 'income' | 'spending';
  phasing: (typeof EXPENSE_BUDGET_PHASINGS)[number];
  annualRupees: string;
  monthRupees: string[];
};

function lineKey(head: {
  category_id: string | null;
  income_type: string | null;
}) {
  return head.category_id ?? `income:${head.income_type}`;
}

function paiseFromRupeesInput(value: string) {
  const parsed = nonnegativeRupeesSchema.safeParse(value);
  return parsed.success ? parsed.data : 0;
}

function stringsFromPaise(values: readonly number[]) {
  return values.map((value) => rupeesFromPaise(value));
}

function initialRows(
  workspace: ExpenseBudget,
  preview: ExpenseBudgetCopyPreview | null,
) {
  return workspace.heads.map((head): DraftRow => {
    const saved = workspace.lines.find(
      (line) => lineKey(line) === lineKey(head),
    );
    const copied = preview?.lines.find(
      (line) => lineKey(line) === lineKey(head),
    );
    const source = saved ?? copied;
    return {
      categoryId: head.category_id,
      incomeType: head.income_type,
      name: head.name,
      kind: head.kind,
      phasing: source?.phasing ?? 'equal_monthly',
      annualRupees: rupeesFromPaise(source?.annual_paise ?? 0),
      monthRupees: stringsFromPaise(
        source?.month_paise ?? Array.from({ length: 12 }, () => 0),
      ),
    };
  });
}

export function ExpenseBudgetDraftForm({
  workspace,
  preview = null,
  action = saveExpenseBudgetDraftAction,
}: {
  workspace: ExpenseBudget;
  preview?: ExpenseBudgetCopyPreview | null;
  action?: ModuleFormAction;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const [rows, setRows] = useState(() => initialRows(workspace, preview));

  function updateAnnual(index: number, value: string) {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const annualPaise = paiseFromRupeesInput(value);
        return {
          ...row,
          annualRupees: value,
          monthRupees:
            row.phasing === 'custom'
              ? row.monthRupees
              : stringsFromPaise(
                  spreadExpenseBudgetAmount(annualPaise, row.phasing),
                ),
        };
      }),
    );
  }
  function updatePhasing(index: number, phasing: DraftRow['phasing']) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              phasing,
              monthRupees: stringsFromPaise(
                spreadExpenseBudgetAmount(
                  paiseFromRupeesInput(row.annualRupees),
                  phasing,
                  row.monthRupees.map(paiseFromRupeesInput),
                ),
              ),
            }
          : row,
      ),
    );
  }
  function updateMonth(rowIndex: number, monthIndex: number, value: string) {
    setRows((current) =>
      current.map((row, index) => {
        if (index !== rowIndex) return row;
        const monthRupees = [...row.monthRupees];
        monthRupees[monthIndex] = value;
        const annualPaise = monthRupees.reduce(
          (total, month) => total + paiseFromRupeesInput(month),
          0,
        );
        return {
          ...row,
          monthRupees,
          annualRupees: rupeesFromPaise(annualPaise),
        };
      }),
    );
  }

  const copyPercent =
    preview !== null
      ? String(preview.percent_bp / 100)
      : workspace.budget?.copy_percent_bp != null
        ? String(workspace.budget.copy_percent_bp / 100)
        : null;
  return (
    <ModuleActionForm
      action={action}
      idempotent
      submitLabel={t('Save draft')}
      input={() => ({
        financialYear: workspace.financial_year,
        lines: rows.map((row) => ({
          categoryId: row.categoryId,
          incomeType: row.incomeType,
          annualRupees: row.annualRupees,
          phasing: row.phasing,
          monthRupees: row.monthRupees,
        })),
        copySourceYear:
          preview?.source_financial_year ??
          workspace.budget?.copy_source_year ??
          null,
        copyPercent,
        expectedVersion: workspace.budget?.version ?? null,
      })}
    >
      {(['income', 'spending'] as const).map((kind) => (
        <section className="grid min-w-0 gap-space-3" key={kind}>
          <h2 className="text-heading font-semibold">
            {t(kind === 'income' ? 'Money in' : 'Spending')}
          </h2>
          <div className="grid min-w-0 gap-space-4">
            {rows
              .filter((row) => row.kind === kind)
              .map((row) => {
                const index = rows.indexOf(row);
                return (
                  <div
                    className="grid min-w-0 gap-space-3 rounded-md border border-rule p-space-3"
                    key={`${row.categoryId ?? 'income'}:${row.incomeType ?? ''}`}
                  >
                    <div className="grid min-w-0 gap-space-3 medium:grid-cols-[minmax(0,1fr)_minmax(12rem,0.5fr)_minmax(12rem,0.5fr)]">
                      <div className="self-end font-semibold">{row.name}</div>
                      <AmountInput
                        id={`${id}-${index}-annual`}
                        label={t('Yearly amount')}
                        value={row.annualRupees}
                        readOnly={row.phasing === 'custom'}
                        onChange={(event) =>
                          updateAnnual(index, event.currentTarget.value)
                        }
                      />
                      <SelectInput
                        id={`${id}-${index}-phasing`}
                        label={t('Spread')}
                        value={row.phasing}
                        onChange={(event) =>
                          updatePhasing(
                            index,
                            event.currentTarget.value as DraftRow['phasing'],
                          )
                        }
                        options={EXPENSE_BUDGET_PHASINGS.map((value) => ({
                          value,
                          label: t(PHASING_LABELS[value]),
                        }))}
                      />
                    </div>
                    <div className="overflow-x-auto">
                      <div className="grid min-w-[52rem] grid-cols-[repeat(12,minmax(4rem,1fr))] gap-space-2">
                        {EXPENSE_BUDGET_MONTHS.map((month, monthIndex) => (
                          <AmountInput
                            id={`${id}-${index}-${monthIndex}`}
                            key={month}
                            label={t(month)}
                            value={row.monthRupees[monthIndex]}
                            readOnly={row.phasing !== 'custom'}
                            onChange={(event) =>
                              updateMonth(
                                index,
                                monthIndex,
                                event.currentTarget.value,
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </ModuleActionForm>
  );
}
