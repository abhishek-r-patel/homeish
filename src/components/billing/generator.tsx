// Preview and confirm society bills without calculating money in the browser.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  generateBillingBillsAction,
  previewBillingBillsAction,
} from '@/app/(admin)/admin/billing/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import type { ChargeType } from '@/core/billing/validation';
import { rupeesFromPaise } from '@/core/billing/validation';
import type { BillingPreview } from '@/core/billing/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Banner } from '@/components/ui/feedback';

type GeneratorUnit = {
  id: string;
  number: string;
  areaSqft: string | null;
};
type GeneratorInput = {
  periodStart: string;
  unitIds: string[];
  chargeTypeIds: string[];
  customAmounts: {
    unitId: string;
    chargeTypeId: string;
    amountRupees: string;
  }[];
};
type PreviewAction = (
  data: FormData,
) => Promise<ServerActionResult<BillingPreview>>;
type GenerateAction = (data: FormData) => Promise<
  ServerActionResult<{
    job_id: string;
    period_start: string;
    due_date: string;
    generated_bill_count: number;
    generated_line_count: number;
    already_generated_count: number;
    total_paise: string;
  }>
>;

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function actionMessage(result: ServerActionResult<unknown> | null) {
  if (!result) return null;
  return (
    <Banner tone={result.ok ? 'success' : 'danger'}>
      <p>{result.message}</p>
      {!result.ok && result.fieldErrors ? (
        <ul className="mt-space-2 list-inside list-disc">
          {Object.entries(result.fieldErrors).map(([field, message]) => (
            <li key={field}>
              {field}: {message}
            </li>
          ))}
        </ul>
      ) : null}
      {!result.ok && result.code === 'CONFLICT' ? (
        <p>Refresh the preview and verify the bill details before retrying.</p>
      ) : null}
    </Banner>
  );
}

export function BillingGenerator({
  charges,
  units,
  rounding,
  previewAction = previewBillingBillsAction,
  generateAction = generateBillingBillsAction,
}: {
  charges: ChargeType[];
  units: GeneratorUnit[];
  rounding: 'paise' | 'rupee';
  previewAction?: PreviewAction;
  generateAction?: GenerateAction;
}) {
  const router = useRouter();
  const [periodStart, setPeriodStart] = useState(currentPeriod);
  const [unitIds, setUnitIds] = useState<string[]>([]);
  const [chargeTypeIds, setChargeTypeIds] = useState<string[]>(
    charges.map(({ id }) => id),
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    {},
  );
  const [step, setStep] = useState(1);
  const [input, setInput] = useState<GeneratorInput | null>(null);
  const [preview, setPreview] = useState<BillingPreview | null>(null);
  const [result, setResult] = useState<ServerActionResult<unknown> | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleValue(
    value: string,
    current: string[],
    setCurrent: (next: string[]) => void,
  ) {
    setCurrent(
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
    setPreview(null);
    setInput(null);
    setResult(null);
  }

  function selectedInput(): GeneratorInput {
    return {
      periodStart,
      unitIds,
      chargeTypeIds,
      customAmounts: unitIds.flatMap((unitId) =>
        chargeTypeIds.flatMap((chargeTypeId) => {
          const charge = charges.find((item) => item.id === chargeTypeId);
          const amountRupees = customAmounts[`${unitId}:${chargeTypeId}`] ?? '';
          return charge?.method === 'custom' && amountRupees !== ''
            ? [{ unitId, chargeTypeId, amountRupees }]
            : [];
        }),
      ),
    };
  }

  function showPreview() {
    if (pending) return;
    const nextInput = selectedInput();
    const formData = new FormData();
    formData.set('input', JSON.stringify(nextInput));
    setResult(null);
    startTransition(async () => {
      try {
        const next = await previewAction(formData);
        setResult(next);
        if (next.ok && next.data) {
          setInput(nextInput);
          setPreview(next.data);
          setStep(3);
        }
      } catch {
        setResult({
          ok: false,
          code: 'INTEGRATION_FAILED',
          message:
            'The preview could not be loaded. Check your connection and retry.',
        });
      }
    });
  }

  function generate() {
    if (!input || !preview || pending) return;
    const formData = new FormData();
    formData.set('input', JSON.stringify(input));
    formData.set('previewHash', preview.preview_hash);
    setConfirming(false);
    startTransition(async () => {
      try {
        const next = await generateAction(formData);
        setResult(next);
        if (next.ok) {
          setPreview(null);
          setInput(null);
          setStep(1);
          router.refresh();
        } else {
          setStep(3);
        }
      } catch {
        setResult({
          ok: false,
          code: 'INTEGRATION_FAILED',
          message:
            'Bill generation could not be confirmed. Refresh and review before retrying.',
        });
        setStep(3);
      }
    });
  }

  const selectedCustomCharges = charges.filter(
    (charge) => chargeTypeIds.includes(charge.id) && charge.method === 'custom',
  );

  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">Generate bills</h1>
        <p className="text-body text-ink-muted">
          Review every amount before publishing. Published bills are immutable;
          corrections use ledger entries.
        </p>
      </header>
      {actionMessage(result)}
      <ol aria-label="Bill generation steps" className="grid gap-space-2">
        {['Billing period', 'Units and charges', 'Review', 'Generate'].map(
          (label, index) => (
            <li
              aria-current={step === index + 1 ? 'step' : undefined}
              className={
                step === index + 1 ? 'font-semibold text-ink' : 'text-ink-muted'
              }
              key={label}
            >
              {index + 1}. {label}
            </li>
          ),
        )}
      </ol>
      {step === 1 ? (
        <Card
          description="A billing period is one calendar month."
          title="1. Choose a billing period"
        >
          <label className="grid max-w-sm gap-space-1 text-body-strong">
            Billing month
            <input
              className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body"
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (/^\d{4}-\d{2}$/.test(value)) {
                  setPeriodStart(`${value}-01`);
                  setPreview(null);
                  setInput(null);
                }
              }}
              type="month"
              value={periodStart.slice(0, 7)}
            />
          </label>
          <Button
            className="mt-space-4"
            onClick={() => setStep(2)}
            type="button"
          >
            Choose Units and Charges
          </Button>
        </Card>
      ) : null}
      {step === 2 ? (
        <Card
          description="Select active units and charge types. Custom charges need an amount for each selected unit."
          title="2. Select units and charges"
        >
          <div className="grid gap-space-4">
            <fieldset className="grid gap-space-2">
              <legend className="text-body-strong">Units</legend>
              <div className="flex flex-wrap gap-space-2">
                <Button
                  onClick={() => {
                    setUnitIds(units.map(({ id }) => id));
                    setPreview(null);
                    setInput(null);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Select All Units
                </Button>
                <Button
                  onClick={() => {
                    setUnitIds([]);
                    setPreview(null);
                    setInput(null);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Clear Units
                </Button>
              </div>
              {units.length ? (
                <ul className="grid gap-space-2 sm:grid-cols-2">
                  {units.map((unit) => (
                    <li key={unit.id}>
                      <label className="flex min-h-12 items-center gap-space-2">
                        <input
                          checked={unitIds.includes(unit.id)}
                          onChange={() =>
                            toggleValue(unit.id, unitIds, setUnitIds)
                          }
                          type="checkbox"
                        />
                        {unit.number}
                        {unit.areaSqft ? ` - ${unit.areaSqft} sq ft` : ''}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-ink-muted">
                  No active units are available.
                </p>
              )}
            </fieldset>
            <fieldset className="grid gap-space-2">
              <legend className="text-body-strong">Charge types</legend>
              {charges.length ? (
                <ul className="grid gap-space-2 sm:grid-cols-2">
                  {charges.map((charge) => (
                    <li key={charge.id}>
                      <label className="flex min-h-12 items-center gap-space-2">
                        <input
                          checked={chargeTypeIds.includes(charge.id)}
                          onChange={() =>
                            toggleValue(
                              charge.id,
                              chargeTypeIds,
                              setChargeTypeIds,
                            )
                          }
                          type="checkbox"
                        />
                        {charge.name} ({charge.method.replace('_', ' ')})
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-ink-muted">
                  Add an active charge type before generating bills.
                </p>
              )}
            </fieldset>
            {selectedCustomCharges.length ? (
              <fieldset className="grid gap-space-3">
                <legend className="text-body-strong">
                  Custom amounts (INR)
                </legend>
                {selectedCustomCharges.map((charge) =>
                  unitIds.map((unitId) => {
                    const unit = units.find((item) => item.id === unitId);
                    const key = `${unitId}:${charge.id}`;
                    return (
                      <label
                        className="grid max-w-sm gap-space-1 text-body-strong"
                        key={key}
                      >
                        {charge.name} - Unit {unit?.number ?? ''}
                        <input
                          className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3 text-body"
                          inputMode="decimal"
                          onChange={(event) => {
                            setCustomAmounts((current) => ({
                              ...current,
                              [key]: event.currentTarget.value,
                            }));
                            setPreview(null);
                            setInput(null);
                          }}
                          value={customAmounts[key] ?? ''}
                        />
                      </label>
                    );
                  }),
                )}
              </fieldset>
            ) : null}
            <Button
              disabled={!units.length || !charges.length}
              onClick={() => setStep(1)}
              type="button"
              variant="secondary"
            >
              Back to Period
            </Button>
            <Button
              disabled={
                pending || unitIds.length === 0 || chargeTypeIds.length === 0
              }
              loading={pending}
              onClick={showPreview}
              type="button"
            >
              Preview Bills
            </Button>
          </div>
        </Card>
      ) : null}
      {preview && step === 3 ? (
        <Card
          description="Review the due date and exact calculated amounts. Already-generated charges are excluded from the new total."
          title="3. Review bill preview"
        >
          <dl className="mb-space-4 grid gap-space-2 text-body">
            <div>
              <dt className="inline font-semibold">Billing period: </dt>
              <dd className="inline">{preview.period_start}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Due date: </dt>
              <dd className="inline">{preview.due_date}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Selected units: </dt>
              <dd className="inline">{preview.unit_count}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">New charges: </dt>
              <dd className="inline">
                {preview.new_line_count} line(s), INR{' '}
                {rupeesFromPaise(preview.new_total_paise)}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">Area rounding: </dt>
              <dd className="inline">Nearest {rounding}, half up</dd>
            </div>
          </dl>
          <ul className="grid gap-space-2">
            {preview.lines.map((line) => (
              <li
                className="flex flex-wrap justify-between gap-space-2 border-b border-rule py-space-2"
                key={`${line.unit_id}:${line.charge_type_id}`}
              >
                <span>
                  {line.unit_number} - {line.charge_name}
                  {line.already_generated ? ' (already generated)' : ''}
                </span>
                <span>INR {rupeesFromPaise(line.amount_paise)}</span>
              </li>
            ))}
          </ul>
          {preview.new_line_count === 0 ? (
            <Banner tone="info">
              All selected unit and charge combinations already have bills.
            </Banner>
          ) : (
            <div className="mt-space-4 flex flex-wrap gap-space-2">
              <Button
                onClick={() => setStep(2)}
                type="button"
                variant="secondary"
              >
                Back to Units and Charges
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  setStep(4);
                  setConfirming(true);
                }}
                type="button"
              >
                Review and Generate
              </Button>
            </div>
          )}
        </Card>
      ) : null}
      <ConfirmDialog
        actionLabel="Generate Bills"
        description={
          preview
            ? `${preview.new_line_count} new charge line(s), totaling INR ${rupeesFromPaise(preview.new_total_paise)}, due on ${preview.due_date}. Residents in selected units will be notified.`
            : 'Review the bill preview before generating.'
        }
        id="billing-generate-confirm"
        loading={pending}
        onConfirm={generate}
        onOpenChange={setConfirming}
        open={confirming}
        title="Publish these bills?"
        variant="primary"
      />
    </section>
  );
}
