// Resident UPI pay screen: society payee details plus payment-detail submission.
'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { submitBillingPaymentAction } from '@/app/(resident)/bills/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { DatePicker } from '@/components/ui/date-time-inputs';
import { FileUpload, type UploadFile } from '@/components/ui/file-upload';
import { SelectInput } from '@/components/ui/select-input';
import { AmountInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { Banner } from '@/components/ui/feedback';
import { formatBillingTimestamp, formatRupees } from '@/core/billing/format';
import { rupeesFromPaise } from '@/core/billing/validation';
import { publicEnvironment } from '@/core/config/public-env';
import {
  ActionResult,
  type BillingFormAction,
  fieldError,
  useBillingAction,
} from './action-state';
import { primaryLinkClass } from './styles';

const uploadResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({ path: z.string(), signedUrl: z.url() }),
});

type PayUnit = { id: string; number: string; outstandingPaise: number };

type PayFormProps = {
  details: { upi_id: string; payee_name: string; updated_at: string };
  initialAmountPaise: number | null;
  initialUnitId: string;
  qrUrl: string | null;
  resubmitReason: string | null;
  timezone: string;
  today: string;
  unitLabel: string;
  units: readonly PayUnit[];
  onSubmitted?: () => void;
  submitAction?: BillingFormAction<unknown>;
};

function upiLink(upiId: string, payee: string, amount: string) {
  const query = new URLSearchParams({ pa: upiId, pn: payee, cu: 'INR' });
  if (/^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0) {
    query.set('am', Number(amount).toFixed(2));
  }
  return `upi://pay?${query.toString()}`;
}

function uploadProof(
  file: File,
  signedUrl: string,
  onProgress: (value: number) => void,
  xhrRef: { current: XMLHttpRequest | null },
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('PUT', signedUrl);
    xhr.timeout = 60_000;
    xhr.setRequestHeader('content-type', file.type);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error('The screenshot could not be uploaded. Retry.'));
    xhr.onerror = () =>
      reject(
        new Error(
          'The screenshot could not be uploaded. Check your connection and retry.',
        ),
      );
    xhr.ontimeout = () =>
      reject(new Error('The screenshot upload timed out. Retry.'));
    xhr.onabort = () =>
      reject(new Error('The screenshot upload was cancelled.'));
    xhr.send(file);
  });
}

export function BillingPayForm({
  details,
  initialAmountPaise,
  initialUnitId,
  qrUrl,
  resubmitReason,
  timezone,
  today,
  unitLabel,
  units,
  onSubmitted,
  submitAction,
}: PayFormProps) {
  const router = useRouter();
  const submit = useBillingAction<unknown>(
    submitAction ?? submitBillingPaymentAction,
  );
  const [unitId, setUnitId] = useState(initialUnitId);
  const unit = units.find((item) => item.id === unitId);
  const [amount, setAmount] = useState(() => {
    const paise = initialAmountPaise ?? unit?.outstandingPaise ?? 0;
    return paise > 0 ? rupeesFromPaise(paise) : '';
  });
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [requestId] = useState(() => crypto.randomUUID());
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => () => xhrRef.current?.abort(), []);

  function changeUnit(next: string) {
    xhrRef.current?.abort();
    setUnitId(next);
    setFiles([]);
    setProofPath(null);
    setUploadMessage(null);
    const nextUnit = units.find((item) => item.id === next);
    setAmount(
      nextUnit && nextUnit.outstandingPaise > 0
        ? rupeesFromPaise(nextUnit.outstandingPaise)
        : '',
    );
  }

  async function startUpload(upload: UploadFile) {
    if (!unitId) {
      setUploadMessage('Choose a unit before attaching a screenshot.');
      return;
    }
    setUploading(true);
    setUploadMessage(null);
    setProofPath(null);
    const update = (patch: Partial<UploadFile>) =>
      setFiles((current) =>
        current.map((item) =>
          item.id === upload.id ? { ...item, ...patch } : item,
        ),
      );
    update({ error: undefined, progress: 0 });
    try {
      const response = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: 'payment-proofs',
          contentType: upload.file.type,
          sizeBytes: upload.file.size,
          unitId,
        }),
      });
      const result = uploadResponseSchema.safeParse(await response.json());
      if (!response.ok || !result.success) {
        throw new Error(
          'The screenshot upload link could not be issued. Retry, or submit without a screenshot.',
        );
      }
      const { path, signedUrl } = result.data.data;
      if (
        new URL(signedUrl).origin !==
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      ) {
        throw new Error('The screenshot upload link is invalid.');
      }
      await uploadProof(
        upload.file,
        signedUrl,
        (progress) => update({ progress }),
        xhrRef,
      );
      setProofPath(path);
      update({ progress: 100 });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The screenshot could not be uploaded.';
      setUploadMessage(message);
      update({ error: message });
    } finally {
      xhrRef.current = null;
      setUploading(false);
    }
  }

  function changeFiles(next: readonly UploadFile[]) {
    if (uploading) {
      setUploadMessage('Wait for the current upload to finish.');
      return;
    }
    const added = next.find((item) => !files.some(({ id }) => id === item.id));
    setFiles([...next]);
    if (next.length === 0) {
      setProofPath(null);
      setUploadMessage(null);
      return;
    }
    if (added) void startUpload(added);
  }

  async function copyUpiId() {
    try {
      await navigator.clipboard.writeText(details.upi_id);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  }

  return (
    <div className="grid gap-space-5">
      {resubmitReason ? (
        <Banner title="Previous submission rejected" tone="warning">
          <p>{resubmitReason}</p>
          <p className="mt-space-1">
            Check the reason, then submit the corrected payment details.
          </p>
        </Banner>
      ) : null}
      <Card
        description="Pay the society directly with any UPI app. Homeish never receives or holds the money."
        title="Pay to"
      >
        <div className="grid gap-space-3">
          <p className="text-body-strong">{details.payee_name}</p>
          <div className="flex flex-wrap items-center gap-space-3">
            <span className="break-all text-body">{details.upi_id}</span>
            <Button onClick={() => void copyUpiId()} variant="secondary">
              Copy UPI ID
            </Button>
            <span aria-live="polite" className="text-caption text-ink-muted">
              {copied === 'copied'
                ? 'UPI ID copied.'
                : copied === 'failed'
                  ? 'Copy failed. Select the UPI ID and copy it manually.'
                  : ''}
            </span>
          </div>
          {qrUrl ? (
            <Image
              alt={`UPI QR code for ${details.payee_name}`}
              className="size-56 rounded-md border border-rule object-contain p-space-2"
              height={224}
              src={qrUrl}
              unoptimized
              width={224}
            />
          ) : null}
          <div>
            <a
              className={primaryLinkClass}
              href={upiLink(details.upi_id, details.payee_name, amount)}
            >
              Pay with UPI App
            </a>
          </div>
          <p className="text-caption text-ink-muted">
            UPI details last changed on{' '}
            <time dateTime={details.updated_at}>
              {formatBillingTimestamp(details.updated_at, timezone)}
            </time>
            . If they look unfamiliar, confirm with the society office before
            paying.
          </p>
        </div>
      </Card>
      <Card
        description="After paying, enter the UPI reference so the society can match it with its account."
        title="Submit payment details"
      >
        <form
          className="grid max-w-content-narrow gap-space-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (uploading) {
              setUploadMessage('Wait for the screenshot upload to finish.');
              return;
            }
            submit.run(
              {
                input: JSON.stringify({
                  unitId,
                  amountRupees: amount,
                  reference,
                  paidOn,
                  proofPath,
                  clientRequestId: requestId,
                }),
              },
              () =>
                onSubmitted
                  ? onSubmitted()
                  : router.push('/bills?tab=payments'),
            );
          }}
        >
          {units.length > 1 ? (
            <SelectInput
              error={fieldError(submit.result, 'unitId', 'unit_id')}
              id="billing-pay-unit"
              label={unitLabel}
              onChange={(event) => changeUnit(event.currentTarget.value)}
              options={units.map((item) => ({
                label: `${item.number} · ${formatRupees(item.outstandingPaise)} due`,
                value: item.id,
              }))}
              required
              value={unitId}
            />
          ) : null}
          <AmountInput
            error={fieldError(submit.result, 'amountRupees', 'amount_paise')}
            helpText={
              unit && unit.outstandingPaise > 0
                ? `Outstanding for ${unitLabel.toLowerCase()} ${unit.number}: ${formatRupees(unit.outstandingPaise)}`
                : undefined
            }
            id="billing-pay-amount"
            label="Amount paid"
            onChange={(event) => setAmount(event.currentTarget.value)}
            required
            value={amount}
          />
          <TextInput
            autoCapitalize="characters"
            autoComplete="off"
            error={fieldError(submit.result, 'reference')}
            helpText="The UPI transaction or UTR number from your UPI app (6 to 30 letters or numbers)."
            id="billing-pay-reference"
            label="UPI reference number"
            maxLength={30}
            onChange={(event) =>
              setReference(
                event.currentTarget.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, ''),
              )
            }
            required
            value={reference}
          />
          <DatePicker
            error={fieldError(submit.result, 'paidOn', 'paid_on')}
            id="billing-pay-date"
            label="Paid on"
            max={today}
            onChange={setPaidOn}
            required
            value={paidOn}
          />
          <FileUpload
            acceptedTypes={['image/jpeg', 'image/png']}
            files={files}
            helpText="Optional payment screenshot, JPG or PNG up to 5 MB. Only society administrators can view it."
            id="billing-pay-proof"
            label="Payment screenshot"
            maxFileBytes={5 * 1024 * 1024}
            maxFiles={1}
            onFilesChange={changeFiles}
            onRetry={(upload) => void startUpload(upload)}
          />
          {uploadMessage ? (
            <p className="text-caption text-danger" role="alert">
              {uploadMessage}
            </p>
          ) : null}
          <ActionResult result={submit.result} />
          <div>
            <Button disabled={uploading} loading={submit.pending} type="submit">
              Submit Payment Details
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
