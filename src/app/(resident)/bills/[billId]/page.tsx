// Resident bill detail with line items and PDF download.
import { notFound } from 'next/navigation';
import { BillDetail } from '@/components/billing/bill-detail';
import { isUuid, todayInTimeZone } from '@/core/billing/format';
import { getBillingBill, getResidentBilling } from '@/core/billing/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { recordBillShareAction } from '../actions';

export const metadata = {
  title: 'Bill | Homeish',
  robots: { index: false, follow: false },
};

export default async function ResidentBillPage({
  params,
}: {
  params: Promise<{ billId: string }>;
}) {
  const locale = await getRequestLocale();
  const { billId } = await params;
  if (!isUuid(billId)) notFound();
  const [billing, bill] = await Promise.all([
    getResidentBilling(),
    getBillingBill(billId),
  ]);
  if (!billing.units.some((unit) => unit.id === bill.unit_id)) notFound();
  return (
    <BillDetail
      backHref="/bills"
      backLabel={translateMessage(locale, 'Bills')}
      bill={bill}
      ledgerHref="/bills?tab=ledger"
      shareAction={recordBillShareAction}
      today={todayInTimeZone(billing.timezone)}
    />
  );
}
