// Download a confirmed payment receipt as a PDF for an authorized viewer.
import { getBillingReceipt } from '../../../../../core/billing/operations';
import { renderReceiptPdf } from '../../../../../core/billing/documents';
import { runDownloadRoute } from '../../../../../core/files/download';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  return runDownloadRoute(request, '/api/billing/receipts', async () => {
    const { paymentId } = await params;
    const receipt = await getBillingReceipt(paymentId);
    return {
      body: await renderReceiptPdf(receipt),
      contentType: 'application/pdf',
      fileName: `receipt-${receipt.receipt_no}.pdf`,
    };
  });
}
