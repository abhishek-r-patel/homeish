// Preview and confirm society bills without calculating money in the browser.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  generateBillingBillsAction,
  previewBillingBillsAction,
} from '@/app/(admin)/admin/billing/actions';
import type { ServerActionResult } from '@/core/actions/server-action';
import type { ChargeType } from '@/core/billing/validation';
import type { BillingPreview } from '@/core/billing/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Banner } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import { billingDate, billingMoney, billingPeriod } from './presentation';
import { ActionResult } from './action-state';

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

function GeneratorMessage({
  result,
}: {
  result: ServerActionResult<unknown> | null;
}) {
  const { translate: t } = useUiTranslator();
  return (
    <>
      <ActionResult result={result} />
      {result && !result.ok && result.code === 'CONFLICT' ? (
        <Banner tone="danger">
          {t(
            'Refresh the preview and verify the bill details before retrying.',
          )}
        </Banner>
      ) : null}
    </>
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
  const { locale, translate: t } = useUiTranslator();
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
        <h1 className="text-title font-semibold">{t('Generate bills')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Review every amount before publishing. Published bills are immutable; corrections use ledger entries.',
          )}
        </p>
      </header>
      <GeneratorMessage result={result} />
      <ol aria-label={t('Bill generation steps')} className="grid gap-space-2">
        {['Billing period', 'Units and charges', 'Review', 'Generate'].map(
          (label, index) => (
            <li
              aria-current={step === index + 1 ? 'step' : undefined}
              className={
                step === index + 1 ? 'font-semibold text-ink' : 'text-ink-muted'
              }
              key={label}
            >
              {index + 1}. {t(label)}
            </li>
          ),
        )}
      </ol>
      {step === 1 ? (
        <Card
          description={t('A billing period is one calendar month.')}
          title={t('1. Choose a billing period')}
        >
          <label className="grid max-w-sm gap-space-1 text-body-strong">
            {t('Billing month')}
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
            {t('Choose Units and Charges')}
          </Button>
        </Card>
      ) : null}
      {step === 2 ? (
        <Card
          description={t(
            'Select active units and charge types. Custom charges need an amount for each selected unit.',
          )}
          title={t('2. Select units and charges')}
        >
          <div className="grid gap-space-4">
            <fieldset className="grid gap-space-2">
              <legend className="text-body-strong">{t('Units')}</legend>
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
                  {t('Select All Units')}
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
                  {t('Clear Units')}
                </Button>
              </div>
              {units.length ? (
                <ul className="grid gap-space-2 sm:grid-cols-2">
                  {units.map((unit) => (
                    <li
                      key={unit.id}
                      className="flex flex-wrap items-center justify-between gap-space-2"
                    >
                      <label className="flex min-h-12 items-center gap-space-2">
                        <input
                          checked={unitIds.includes(unit.id)}
                          onChange={() =>
                            toggleValue(unit.id, unitIds, setUnitIds)
                          }
                          type="checkbox"
                        />
                        {unit.number}
                        {unit.areaSqft
                          ? t(' - {area} sq ft', { area: unit.areaSqft })
                          : ''}
                      </label>
                      <Link
                        className="inline-flex min-h-12 items-center text-body text-brand underline"
                        href={`/admin/billing/units/${unit.id}`}
                        target="_blank"
                        rel="noopener"
                        aria-label={t(
                          'Review move-in dates for {unit} (opens in a new tab)',
                          { unit: unit.number },
                        )}
                      >
                        {t('Move-in dates')}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-ink-muted">
                  {t('No active units are available.')}
                </p>
              )}
            </fieldset>
            <fieldset className="grid gap-space-2">
              <legend className="text-body-strong">{t('Charge types')}</legend>
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
                        {charge.name} (
                        {t(
                          {
                            fixed: 'Fixed per unit',
                            per_sqft: 'Per square foot',
                            custom: 'Custom per unit',
                            percent_of_charge: 'Percentage of Maintenance',
                          }[charge.method],
                        )}
                        )
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-ink-muted">
                  {t('Add an active charge type before generating bills.')}
                </p>
              )}
            </fieldset>
            {selectedCustomCharges.length ? (
              <fieldset className="grid gap-space-3">
                <legend className="text-body-strong">
                  {t('Custom amounts (INR)')}
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
                        {t('{charge} - Unit {unit}', {
                          charge: charge.name,
                          unit: unit?.number ?? '',
                        })}
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
              {t('Back to Period')}
            </Button>
            <Button
              disabled={
                pending || unitIds.length === 0 || chargeTypeIds.length === 0
              }
              loading={pending}
              onClick={showPreview}
              type="button"
            >
              {t('Preview Bills')}
            </Button>
          </div>
        </Card>
      ) : null}
      {preview && step === 3 ? (
        <Card
          description={t(
            'Review the due date and exact calculated amounts. Already-generated charges are excluded from the new total.',
          )}
          title={t('3. Review bill preview')}
        >
          <dl className="mb-space-4 grid gap-space-2 text-body">
            <div>
              <dt className="inline font-semibold">{t('Billing period')}: </dt>
              <dd className="inline">
                {billingPeriod(preview.period_start, locale)}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">{t('Due date')}: </dt>
              <dd className="inline">
                {billingDate(preview.due_date, locale)}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">{t('Selected units')}: </dt>
              <dd className="inline">{preview.unit_count}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">{t('New charges')}: </dt>
              <dd className="inline">
                {t(
                  preview.new_line_count === 1
                    ? '{count} line, {amount}'
                    : '{count} lines, {amount}',
                  {
                    count: preview.new_line_count,
                    amount: billingMoney(preview.new_total_paise, locale),
                  },
                )}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">{t('Area rounding')}: </dt>
              <dd className="inline">
                {t(
                  rounding === 'rupee'
                    ? 'Nearest rupee, half up'
                    : 'Nearest paise, half up',
                )}
              </dd>
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
                  {line.already_generated ? t(' (already generated)') : ''}
                </span>
                <span>{billingMoney(line.amount_paise, locale)}</span>
              </li>
            ))}
          </ul>
          {preview.skipped.length ? (
            <div className="mt-space-4">
              <h3 className="text-body-strong">{t('Omitted charges')}</h3>
              <ul className="grid gap-space-2">
                {preview.skipped.map((line) => (
                  <li key={`${line.unit_id}:${line.charge_type_id}`}>
                    {line.unit_number} - {line.charge_name}:{' '}
                    {t(
                      {
                        not_eligible: 'Occupancy does not match',
                        not_applicable: 'Base charge does not apply',
                        rounds_to_zero: 'Rounds to zero',
                      }[line.reason],
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {preview.new_line_count === 0 ? (
            <Banner tone="info">
              {t(
                preview.skipped.length
                  ? 'There are no new charges to bill for this selection.'
                  : 'All selected unit and charge combinations already have bills.',
              )}
            </Banner>
          ) : null}
          <div className="mt-space-4 flex flex-wrap gap-space-2">
            <Button
              onClick={() => setStep(2)}
              type="button"
              variant="secondary"
            >
              {t('Back to Units and Charges')}
            </Button>
            {preview.new_line_count ? (
              <Button
                disabled={pending}
                onClick={() => {
                  setStep(4);
                  setConfirming(true);
                }}
                type="button"
              >
                {t('Review and Generate')}
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}
      <ConfirmDialog
        actionLabel={t('Generate Bills')}
        description={
          preview
            ? t(
                '{count} new charge lines, totaling {amount}, due on {date}. Residents in selected units will be notified.',
                {
                  count: preview.new_line_count,
                  amount: billingMoney(preview.new_total_paise, locale),
                  date: billingDate(preview.due_date, locale),
                },
              )
            : t('Review the bill preview before generating.')
        }
        id="billing-generate-confirm"
        loading={pending}
        onConfirm={generate}
        onOpenChange={setConfirming}
        open={confirming}
        title={t('Publish these bills?')}
        variant="primary"
      />
    </section>
  );
}
