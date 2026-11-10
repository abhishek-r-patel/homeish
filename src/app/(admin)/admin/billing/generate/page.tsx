// Load the authorized charge and unit choices for the bill generator.
import { BillingGenerator } from '@/components/billing/generator';
import { getBillingGeneratorOptions } from '@/core/billing/operations';

export const metadata = {
  title: 'Generate bills | Homeish',
  robots: { index: false, follow: false },
};

export default async function BillingGeneratePage() {
  const options = await getBillingGeneratorOptions();
  return <BillingGenerator {...options} />;
}
