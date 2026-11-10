// Admin bill detail with PDF download and audited waive or cancel actions.
import { notFound } from 'next/navigation';
import { BillAdminActions } from '@/components/billing/admin-panels';
import { BillDetail } from '@/components/billing/bill-detail';
import { isUuid, todayInTimeZone } from '@/core/billing/format';
import {
  getBillingAdminContext,
  getBillingBill,
} from '@/core/billing/operations';

export const metadata = {
  title: 'Bill | Homeish',
  robots: { index: false, follow: false },
};

export default async function AdminBillPage({
  params,
}: {
  params: Promise<{ billId: string }>;
}) {
  const { billId } = await params;
  if (!isUuid(billId)) notFound();
  const [admin, bill] = await Promise.all([
    getBillingAdminContext(),
    getBillingBill(billId),
  ]);
  return (
    <BillDetail
      backHref="/admin/billing?tab=bills"
      backLabel="Bills"
      bill={bill}
      ledgerHref={`/admin/billing/units/${bill.unit_id}`}
      today={todayInTimeZone(admin.timezone)}
    >
      {admin.canManage ? <BillAdminActions bill={bill} /> : null}
    </BillDetail>
  );
}
