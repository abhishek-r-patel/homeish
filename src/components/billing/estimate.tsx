// Preview recurring charges without creating a unit or bill.
'use client';

import type { FormEvent } from 'react';
import { estimateBillingAction } from '@/app/(admin)/admin/billing/actions';
import { Card } from '@/components/ui/data-display';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';
import { useUiTranslator } from '@/components/ui/language';
import type { ChargeType } from '@/core/billing/validation';
import { ActionResult, useBillingAction } from './action-state';
import { billingMoney } from './presentation';

export function BillingEstimatePanel({ charges }: { charges: ChargeType[] }) {
  const { translate: t, locale } = useUiTranslator();
  const estimate = useBillingAction(estimateBillingAction);
  const result = estimate.result?.ok ? estimate.result.data : undefined;
  const custom = charges.filter((charge) => charge.method === 'custom');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    estimate.run({
      input: JSON.stringify({
        areaSqft: data.get('areaSqft'),
        occupancy: data.get('occupancy'),
        customAmounts: custom.flatMap((charge) => {
          const amountRupees = data.get(charge.id);
          return typeof amountRupees === 'string' && amountRupees.trim()
            ? [{ chargeTypeId: charge.id, amountRupees }]
            : [];
        }),
      }),
    });
  }

  return (
    <Card
      title={t('Charge estimate')}
      description={t('An estimate only. No bill or unit is created.')}
    >
      {!charges.length ? (
        <p>{t('No active charge types.')}</p>
      ) : (
        <form
          className="grid gap-space-4"
          onSubmit={submit}
          onChange={estimate.reset}
        >
          <fieldset className="grid gap-space-4" disabled={estimate.pending}>
            <TextInput
              id="billing-estimate-area"
              label={t('Area (sq ft)')}
              name="areaSqft"
              inputMode="decimal"
              maxLength={9}
              required
            />
            <label className="grid gap-space-1 text-body-strong">
              {t('Occupancy')}
              <select
                className="min-h-12 rounded-md border border-rule-strong bg-surface px-space-3"
                name="occupancy"
              >
                <option value="owner">{t('Owner-occupied')}</option>
                <option value="tenant">{t('Tenant-occupied')}</option>
                <option value="vacant">{t('Vacant')}</option>
              </select>
            </label>
            {custom.length ? (
              <p>
                {t(
                  'Custom amounts are optional. Leave blank to exclude the charge.',
                )}
              </p>
            ) : null}
            {custom.map((charge) => (
              <TextInput
                key={charge.id}
                id={`billing-estimate-${charge.id}`}
                label={t('{charge} (INR)', { charge: charge.name })}
                name={charge.id}
                inputMode="decimal"
                maxLength={32}
              />
            ))}
          </fieldset>
          <div>
            <Button loading={estimate.pending} type="submit">
              {t('Calculate Estimate')}
            </Button>
          </div>
        </form>
      )}
      <div className="mt-space-4" aria-live="polite">
        <ActionResult result={estimate.result} />
        {result ? (
          <div className="grid gap-space-3">
            <h3 className="text-body-strong">
              {t('Estimated total')}: {billingMoney(result.total_paise, locale)}
            </h3>
            {!result.lines.length ? (
              <p>{t('No charges apply to this estimate.')}</p>
            ) : null}
            <ul className="grid gap-space-2">
              {result.lines.map((line) => (
                <li key={line.charge_type_id}>
                  {line.charge_name}: {billingMoney(line.amount_paise, locale)}
                </li>
              ))}
            </ul>
            {result.skipped.length ? (
              <div>
                <h3 className="text-body-strong">{t('Omitted charges')}</h3>
                <ul>
                  {result.skipped.map((line) => (
                    <li key={line.charge_type_id}>
                      {line.charge_name}:{' '}
                      {t(
                        {
                          not_eligible: 'Occupancy does not match',
                          not_applicable: 'Base charge does not apply',
                          rounds_to_zero: 'Rounds to zero',
                          no_amount: 'No custom amount entered',
                          base_excluded: 'Base charge was omitted',
                        }[line.reason],
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
