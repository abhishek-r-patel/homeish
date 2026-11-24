// Start audited native, WhatsApp or email bill sharing without claiming delivery.
'use client';

import { useState } from 'react';
import type { ServerActionResult } from '@/core/actions/server-action';
import { publicEnvironment } from '@/core/config/public-env';
import type { BillingBillDetails } from '@/core/billing/validation';
import {
  formatBillingDate,
  formatBillingPeriod,
  formatRupees,
} from '@/core/billing/format';
import { useUiTranslator } from '@/components/ui/language';
import { Button } from '@/components/ui/button';
import { linkButtonClass } from './styles';

type ShareChannel = 'native' | 'whatsapp' | 'email';

export type RecordBillShareAction = (
  formData: FormData,
) => Promise<
  ServerActionResult<{ bill_id: string; text: string; url: string }>
>;

export function BillShare({
  action,
  bill,
}: {
  action: RecordBillShareAction;
  bill: BillingBillDetails;
}) {
  const { translate: t } = useUiTranslator();
  const [fallback, setFallback] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const loginUrl = new URL('/login', publicEnvironment.NEXT_PUBLIC_APP_URL);
  loginUrl.searchParams.set('next', `/bills/${bill.id}`);
  const summary = [
    `${bill.society_name} bill for ${bill.unit_label} ${bill.unit_number}.`,
    `Bill month: ${formatBillingPeriod(bill.period_start)}`,
    `Amount: ${formatRupees(bill.total_paise)}`,
    `Due date: ${formatBillingDate(bill.due_date)}`,
    `View bill (sign-in required): ${loginUrl.toString()}`,
  ].join('\n');

  async function audit(channel: ShareChannel) {
    try {
      const formData = new FormData();
      formData.set('billId', bill.id);
      formData.set('channel', channel);
      const result = await action(formData);
      if (!result.ok) {
        setMessage(result.message);
        return false;
      }
      setMessage(t('Share started.'));
      return true;
    } catch {
      setMessage(
        t(
          'The bill share could not be recorded. Reconnect before sharing again.',
        ),
      );
      return false;
    }
  }

  async function shareNative() {
    setMessage(null);
    if (!navigator.share) {
      setFallback(true);
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`/api/billing/bills/${bill.id}`);
      if (!response.ok) throw new Error('Bill PDF could not be downloaded.');
      const file = new File(
        [await response.blob()],
        `bill-${bill.unit_number}-${bill.period_start}.pdf`,
        { type: 'application/pdf' },
      );
      const data = { files: [file], title: bill.title, text: summary };
      if (!navigator.canShare?.(data)) {
        setFallback(true);
        return;
      }
      if (!(await audit('native'))) return;
      await navigator.share(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage(
        t('The bill share could not be opened. Use WhatsApp or email instead.'),
      );
      setFallback(true);
    } finally {
      setPending(false);
    }
  }

  async function shareFallback(
    event: React.MouseEvent<HTMLAnchorElement>,
    channel: 'whatsapp' | 'email',
    url: string,
  ) {
    event.preventDefault();
    const popup =
      channel === 'whatsapp' ? window.open('', '_blank', 'noopener') : null;
    if (popup) popup.opener = null;
    if (!(await audit(channel))) {
      popup?.close();
      return;
    }
    if (popup) {
      popup.location.href = url;
    } else {
      window.location.assign(url);
    }
  }

  const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(summary)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(bill.title)}&body=${encodeURIComponent(summary)}`;

  return (
    <div className="grid gap-space-3">
      <Button loading={pending} onClick={shareNative} variant="secondary">
        {t('Share')}
      </Button>
      {fallback ? (
        <div
          aria-label={t('Share bill with')}
          className="flex flex-wrap gap-space-3"
        >
          <a
            className={linkButtonClass}
            href={whatsAppUrl}
            onClick={(event) =>
              void shareFallback(event, 'whatsapp', whatsAppUrl)
            }
            rel="noreferrer"
            target="_blank"
          >
            {t('WhatsApp')}
          </a>
          <a
            className={linkButtonClass}
            href={emailUrl}
            onClick={(event) => void shareFallback(event, 'email', emailUrl)}
          >
            {t('Email')}
          </a>
        </div>
      ) : null}
      {message ? (
        <p className="text-caption text-ink-muted" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
