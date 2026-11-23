// Exercise billing setup with in-memory synthetic data, never a bank or database.
'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BillingSetup } from '@/components/billing/setup';
import { BillDetail } from '@/components/billing/bill-detail';
import { Banner } from '@/components/ui/feedback';
import {
  billingSettingsUpdateInputSchema,
  chargeFormSchema,
  DEFAULT_BILLING_SETTINGS,
  paymentDetailsInputSchema,
  type BillingSettings,
  type ChargeType,
  type PaymentDetails,
} from '@/core/billing/validation';

const societyId = '4a696d6f-774c-41d1-ae47-6254d4a8f4cf';
const initialDetails: PaymentDetails = {
  society_id: societyId,
  upi_id: 'homeish-fixture@example',
  payee_name: 'Synthetic Society',
  qr_path: null,
  updated_at: '2026-11-10T12:00:00.000Z',
  updated_by: societyId,
  updated_by_name: 'Synthetic Administrator',
};

function Fixture() {
  const params = useSearchParams();
  const [charges, setCharges] = useState<ChargeType[]>([]);
  const [details, setDetails] = useState<PaymentDetails>(initialDetails);
  const [settings, setSettings] = useState<BillingSettings>(
    DEFAULT_BILLING_SETTINGS,
  );
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState(
    '2026-11-10T12:00:00.000Z',
  );
  const readOnly = params.get('role') === 'committee';

  if (params.get('view') === 'bill') {
    return (
      <main className="mx-auto min-h-dvh px-space-4 py-space-6">
        <BillDetail
          backHref="/fixtures/billing"
          backLabel="Bills"
          bill={{
            id: societyId,
            society_id: societyId,
            related_bill_id: null,
            cancelled_by: null,
            cancel_reason: null,
            created_at: '2026-11-10T12:00:00.000Z',
            created_by: societyId,
            unit_id: societyId,
            unit_number: 'A-101',
            unit_label: 'Unit',
            kind: 'regular',
            title: 'Society charges - Nov 2026',
            period_start: '2026-11-01',
            due_date: '2026-11-10',
            total_paise: 250000,
            paid_paise: 0,
            waived_paise: 0,
            status: 'due',
            cancelled_at: null,
            outstanding_paise: 250000,
            society_name: 'Synthetic Society',
            society_address: 'Synthetic City',
            lines: [
              {
                id: societyId,
                charge_type_id: null,
                description: 'Monthly maintenance',
                amount_paise: 250000,
              },
            ],
          }}
          shareAction={async () => ({
            ok: true,
            data: {
              bill_id: societyId,
              text: 'Synthetic bill share.',
              url: 'https://homeish.test/login',
            },
            message: 'Share started.',
          })}
          today="2026-11-09"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-content-default gap-space-5 px-space-4 py-space-6 text-ink">
      <Banner title="Synthetic billing fixture" tone="info">
        Development-only in-memory data. These accounts cannot be used to pay.
        No money moves and no database records are written. Reload to reset.
      </Banner>
      <BillingSetup
        canManage={!readOnly}
        chargeAction={async (formData) => {
          const parsed = chargeFormSchema.parse({
            id: formData.get('id') || null,
            name: formData.get('name'),
            method: formData.get('method'),
            amountRupees: formData.get('amountRupees'),
            eligibility: formData.get('eligibility'),
            percentRate: formData.get('percentRate') ?? '',
            baseChargeTypeId: formData.get('baseChargeTypeId') || null,
            active: formData.get('active') === 'true',
            expectedUpdatedAt: formData.get('expectedUpdatedAt') || null,
          });
          const charge: ChargeType = {
            id: parsed.id ?? crypto.randomUUID(),
            society_id: societyId,
            name: parsed.name,
            method: parsed.method,
            amount_paise: parsed.amountPaise,
            eligibility: parsed.eligibility,
            percent_basis_points: parsed.percentBasisPoints,
            base_charge_type_id: parsed.baseChargeTypeId,
            active: parsed.active,
            updated_at: new Date().toISOString(),
          };
          setCharges((current) => [
            ...current.filter(({ id }) => id !== charge.id),
            charge,
          ]);
          return { ok: true, data: charge, message: 'Synthetic charge saved.' };
        }}
        charges={charges}
        paymentAction={async (formData) => {
          if (params.get('fail') === 'payment') {
            return {
              ok: false,
              code: 'INTERNAL_ERROR',
              message: 'The synthetic payment settings could not be saved.',
              referenceId: 'fixture-reference',
            };
          }
          const input = paymentDetailsInputSchema.parse({
            upiId: formData.get('upiId'),
            payeeName: formData.get('payeeName'),
            qrPath: formData.get('qrPath') || null,
            expectedUpdatedAt: formData.get('expectedUpdatedAt') || null,
          });
          const updated: PaymentDetails = {
            ...initialDetails,
            upi_id: input.upiId,
            payee_name: input.payeeName,
            qr_path: input.qrPath,
            updated_at: new Date().toISOString(),
          };
          setDetails(updated);
          return {
            ok: true,
            data: updated,
            message:
              'Synthetic payment details saved and the society team notified.',
          };
        }}
        paymentDetails={details}
        pendingQrPaths={[]}
        qrUrl={null}
        settings={settings}
        settingsUpdatedAt={settingsUpdatedAt}
        settingsAction={async (formData) => {
          const parsed = billingSettingsUpdateInputSchema.parse({
            dueDay: formData.get('dueDay'),
            rounding: formData.get('rounding'),
            billEmailOnPublish: formData.get('billEmailOnPublish') === 'true',
            expectedUpdatedAt: formData.get('expectedUpdatedAt'),
          });
          const nextSettings = {
            ...settings,
            due_day_of_month: parsed.dueDay,
            rounding: parsed.rounding,
            bill_email_on_publish: parsed.billEmailOnPublish,
          };
          const updatedAt = new Date().toISOString();
          setSettings(nextSettings);
          setSettingsUpdatedAt(updatedAt);
          return {
            ok: true,
            data: { settings: nextSettings, updated_at: updatedAt },
            message: 'Synthetic society billing preferences saved.',
          };
        }}
        societyId={societyId}
        suspended={false}
        timezone="Asia/Kolkata"
      />
    </main>
  );
}

export default function BillingFixturePage() {
  return (
    <Suspense fallback={<p>Loading billing fixture...</p>}>
      <Fixture />
    </Suspense>
  );
}
