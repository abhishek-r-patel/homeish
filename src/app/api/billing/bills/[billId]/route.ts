// Download a bill as a PDF for an authorized viewer.
import { getBillingBill } from '../../../../../core/billing/operations';
import { renderBillPdf } from '../../../../../core/billing/documents';
import { runDownloadRoute } from '../../../../../core/files/download';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ billId: string }> },
) {
  return runDownloadRoute(request, '/api/billing/bills', async () => {
    const { billId } = await params;
    const bill = await getBillingBill(billId);
    return {
      body: await renderBillPdf(bill),
      contentType: 'application/pdf',
      fileName: `bill-${bill.unit_number}-${bill.period_start}-${bill.id.slice(0, 8)}.pdf`,
    };
  });
}
