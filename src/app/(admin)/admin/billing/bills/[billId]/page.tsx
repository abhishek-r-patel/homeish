// Admin bill detail with PDF download and audited waive or cancel actions.
import { notFound } from 'next/navigation';
import { BillAdminActions } from '@/components/billing/admin-panels';
import { BillDetail } from '@/components/billing/bill-detail';
import { isUuid, todayInTimeZone } from '@/core/billing/format';
import {
  getBillingAdminContext,
  getBillingBill,
} from '@/core/billing/operations';
import { getRequestLocale } from '@/core/i18n/request-locale';
import { translateMessage } from '@/core/i18n/messages';
import { recordBillShareAction } from '../../actions';

export const metadata = {
  title: 'Bill | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminBillPage({
  params,
}: {
  params: Promise<{ billId: string }>;
}) {
  const locale = await getRequestLocale();
  const { billId } = await params;
  if (!isUuid(billId)) notFound();
  const [admin, bill] = await Promise.all([
    getBillingAdminContext(),
    getBillingBill(billId),
  ]);
  return (
    <BillDetail
      backHref="/admin/billing?tab=bills"
      backLabel={translateMessage(locale, 'Bills')}
      bill={bill}
      ledgerHref={`/admin/billing/units/${bill.unit_id}`}
      shareAction={recordBillShareAction}
      today={todayInTimeZone(admin.timezone)}
    >
      {admin.canManage ? <BillAdminActions bill={bill} /> : null}
    </BillDetail>
  );
}
