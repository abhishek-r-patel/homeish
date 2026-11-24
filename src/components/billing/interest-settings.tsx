// Gate and display append-only annual interest settings.
'use client';

import { useId, useState, useTransition } from 'react';
import {
  acknowledgeBillingInterestAction,
  saveBillingInterestRateAction,
} from '@/app/(admin)/admin/billing/actions';
import type { BillingInterestSettings } from '@/core/billing/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { TextInput } from '@/components/ui/text-input';

export function BillingInterestSettings({
  interest,
}: {
  interest: BillingInterestSettings;
}) {
  const id = useId();
  const { translate: t, translateFeedback } = useUiTranslator();
  const [acknowledged, setAcknowledged] = useState(
    interest.acknowledged_at !== null,
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Card title={t('Interest on overdue bills')}>
      <div className="grid gap-space-4">
        <p className="text-body">
          {t(
            'Interest is not legal, tax or accounting advice. Review the rate and treatment with an accountant before live use.',
          )}
        </p>
        {!acknowledged ? (
          <div className="grid gap-space-2">
            <p className="text-caption text-ink-muted">
              {t(
                'Off by default. A society administrator must acknowledge this warning before selecting interest.',
              )}
            </p>
            {interest.can_manage ? (
              <Button
                loading={pending}
                onClick={() =>
                  startTransition(async () => {
                    setMessage(null);
                    const result = await acknowledgeBillingInterestAction();
                    if (result.ok) {
                      setAcknowledged(true);
                      setMessage(
                        result.message ?? 'Interest warning acknowledged.',
                      );
                    } else {
                      setMessage(result.message);
                    }
                  })
                }
                variant="secondary"
              >
                {t('Acknowledge interest warning')}
              </Button>
            ) : null}
            {message ? (
              <p className="text-caption text-ink-muted" role="status">
                {translateFeedback(message)}
              </p>
            ) : null}
          </div>
        ) : interest.can_manage ? (
          <ModuleActionForm
            action={saveBillingInterestRateAction}
            idempotent
            input={(form) => ({
              mode: form.get('mode'),
              ratePercent: String(form.get('ratePercent') ?? '').trim() || null,
              effectiveDate: form.get('effectiveDate'),
            })}
            submitLabel={t('Save interest mode and rate')}
          >
            <label className="grid gap-space-1">
              {t('Overdue charge mode')}
              <select
                className="min-h-12 rounded-md border border-rule px-space-3"
                defaultValue={interest.current?.mode ?? 'late_fee'}
                name="mode"
              >
                <option value="late_fee">{t('Late fee only')}</option>
                <option value="interest">{t('Interest only')}</option>
                <option value="both">{t('Late fee and interest')}</option>
              </select>
            </label>
            <TextInput
              defaultValue={
                interest.current?.rate_basis_points === null ||
                interest.current?.rate_basis_points === undefined
                  ? ''
                  : (interest.current.rate_basis_points / 100).toFixed(2)
              }
              id={`${id}-rate`}
              label={t('Yearly interest rate (%)')}
              name="ratePercent"
              inputMode="decimal"
            />
            <TextInput
              id={`${id}-effective`}
              label={t('Effective date')}
              name="effectiveDate"
              required
              type="date"
            />
            <p className="text-caption text-ink-muted">
              {t(
                'Above 0% and at most 24%. This is an app safety limit, not a statement of the lawful rate. Leave the rate blank for Late fee only.',
              )}
            </p>
          </ModuleActionForm>
        ) : (
          <p>
            {interest.current
              ? t('Current mode: {mode}.', {
                  mode:
                    interest.current.mode === 'late_fee'
                      ? 'Late fee only'
                      : interest.current.mode === 'interest'
                        ? 'Interest only'
                        : 'Late fee and interest',
                })
              : t('Current mode: Late fee only.')}
          </p>
        )}
        <div className="grid gap-space-2">
          <h3 className="font-semibold">{t('Rate history')}</h3>
          {interest.history.length === 0 ? (
            <p>{t('No interest settings have been recorded.')}</p>
          ) : (
            <ul className="grid gap-space-2">
              {interest.history.map((rate) => (
                <li
                  className="rounded-md border border-rule p-space-3"
                  key={rate.id}
                >
                  <p>
                    {rate.mode === 'late_fee'
                      ? t('Late fee only')
                      : `${(rate.rate_basis_points! / 100).toFixed(2)}% · ${t(
                          rate.mode === 'both'
                            ? 'Late fee and interest'
                            : 'Interest only',
                        )}`}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {rate.effective_on} · {rate.created_by_name}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
