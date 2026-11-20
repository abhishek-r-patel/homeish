// Let admins and committee prepare, preview and download an unsaved letter from a chosen record.
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, ListItem } from '@/components/ui/data-display';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { useUiTranslator } from '@/components/ui/language';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import { formatBillingDate } from '@/core/billing/format';
import {
  buildLetterText,
  hasPlaceholders,
  letterheadLines,
  letterSourceLabel,
  type LetterSociety,
  type LetterSource,
} from '@/core/letters/content';
import {
  LETTER_FOOTER,
  LETTER_LIMITS,
  LETTER_SOURCE_LABELS,
  LETTER_TYPE_CONFIG,
  isLetterType,
  letterDraftSchema,
  letterFileName,
  type LetterDraft,
  type LetterGenerationLog,
  type LetterSourceType,
  type LetterType,
} from '@/core/letters/validation';

export type LettersWorkspaceData = {
  today: string;
  amenityDate: string;
  society: LetterSociety;
  letterTypes: readonly LetterType[];
  sources: Readonly<Record<LetterSourceType, readonly LetterSource[] | null>>;
  recentLogs: readonly LetterGenerationLog[];
};

export type LetterDownloadResult =
  | { ok: true; blob: Blob; fileName: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

type FieldErrors = Partial<Record<string, string>>;

function draftErrors(draft: unknown): FieldErrors {
  const result = letterDraftSchema.safeParse(draft);
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? 'form');
    errors[field] ??= issue.message;
  }
  return errors;
}

async function downloadFromServer(
  draft: LetterDraft,
): Promise<LetterDownloadResult> {
  const response = await fetch('/api/letters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  if (response.ok) {
    return {
      ok: true,
      blob: await response.blob(),
      fileName: letterFileName(draft.letterType, draft.letterDate),
    };
  }
  const envelope = (await response.json().catch(() => null)) as {
    error?: { message?: string; fieldErrors?: Record<string, string> };
  } | null;
  return {
    ok: false,
    message: envelope?.error?.message ?? 'The letter could not be downloaded.',
    fieldErrors: envelope?.error?.fieldErrors,
  };
}

function formatLogDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(new Date(value));
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function LettersWorkspace({
  workspace,
  initialType,
  initialSourceId,
  onDownload = downloadFromServer,
  onAmenityDateChange,
}: {
  workspace: LettersWorkspaceData;
  initialType?: string;
  initialSourceId?: string;
  onDownload?: (draft: LetterDraft) => Promise<LetterDownloadResult>;
  onAmenityDateChange?: (date: string) => void;
}) {
  const { translate: t, translateFeedback } = useUiTranslator();
  const router = useRouter();
  const startType =
    isLetterType(initialType) && workspace.letterTypes.includes(initialType)
      ? initialType
      : '';
  const [initial] = useState(() =>
    startType ? startingText(startType, initialSourceId) : null,
  );
  const [letterType, setLetterType] = useState<LetterType | ''>(startType);
  const [sourceId, setSourceId] = useState(initial?.sourceId ?? '');
  const [letterDate, setLetterDate] = useState(workspace.today);
  const [recipient, setRecipient] = useState(initial?.text?.recipient ?? '');
  const [subject, setSubject] = useState(initial?.text?.subject ?? '');
  const [body, setBody] = useState(initial?.text?.body ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const config = letterType ? LETTER_TYPE_CONFIG[letterType] : null;
  const sourceType = config?.sourceType ?? null;
  const sources = sourceType ? workspace.sources[sourceType] : null;
  const selectedSource = useMemo(
    () => sources?.find((source) => source.id === sourceId) ?? null,
    [sources, sourceId],
  );
  const ready = Boolean(letterType && (!sourceType || selectedSource));

  // A type with a source starts empty until a record is chosen; deep links may preselect one.
  function startingText(type: LetterType, preferredSourceId?: string) {
    const typeSourceType = LETTER_TYPE_CONFIG[type].sourceType;
    const source = typeSourceType
      ? (workspace.sources[typeSourceType]?.find(
          (item) => item.id === preferredSourceId,
        ) ?? null)
      : null;
    return {
      sourceId: source?.id ?? '',
      text:
        !typeSourceType || source
          ? buildLetterText(type, source, workspace.society, workspace.today)
          : null,
    };
  }

  function fill(type: LetterType, source: LetterSource | null) {
    const text = buildLetterText(type, source, workspace.society, letterDate);
    setRecipient(text.recipient);
    setSubject(text.subject);
    setBody(text.body);
    setErrors({});
    setMessage(null);
    setPreviewing(false);
  }

  function chooseType(value: string) {
    setSourceId('');
    if (!isLetterType(value)) {
      setLetterType('');
      return;
    }
    setLetterType(value);
    const start = startingText(value);
    setRecipient(start.text?.recipient ?? '');
    setSubject(start.text?.subject ?? '');
    setBody(start.text?.body ?? '');
    setErrors({});
    setMessage(null);
    setPreviewing(false);
  }

  function chooseSource(value: string) {
    setSourceId(value);
    const source = sources?.find((item) => item.id === value) ?? null;
    if (letterType && source) fill(letterType, source);
  }

  function currentDraft() {
    return {
      letterType,
      sourceId: sourceType ? sourceId || null : null,
      sourceDate:
        sourceType === 'amenity_booking' ? workspace.amenityDate : null,
      letterDate,
      recipient,
      subject,
      body,
    };
  }

  function preview() {
    const found = draftErrors(currentDraft());
    setErrors(found);
    setMessage(null);
    setPreviewing(Object.keys(found).length === 0);
  }

  async function download() {
    const draft = currentDraft();
    const found = draftErrors(draft);
    setErrors(found);
    if (Object.keys(found).length) {
      setPreviewing(false);
      return;
    }
    setDownloading(true);
    setMessage(null);
    try {
      const result = await onDownload(letterDraftSchema.parse(draft));
      if (result.ok) {
        saveBlob(result.blob, result.fileName);
        setMessage({
          tone: 'success',
          text: t('Letter downloaded. It was not sent or saved in Homeish.'),
        });
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage({ tone: 'danger', text: translateFeedback(result.message) });
      }
    } catch (error) {
      setMessage({
        tone: 'danger',
        text: translateFeedback(
          error instanceof Error
            ? error.message
            : 'The letter could not be downloaded.',
        ),
      });
    } finally {
      setDownloading(false);
    }
  }

  function changeAmenityDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    if (onAmenityDateChange) {
      onAmenityDateChange(value);
      return;
    }
    router.replace(
      `?${new URLSearchParams({ type: 'hall_booking_confirmation', date: value })}`,
    );
  }

  const typeOptions = workspace.letterTypes.map((type) => ({
    value: type,
    label: t(LETTER_TYPE_CONFIG[type].label),
  }));
  const placeholdersLeft = hasPlaceholders(`${recipient}\n${subject}\n${body}`);

  return (
    <div className="grid min-w-0 gap-space-5 expanded:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card title={t('Prepare a letter')}>
        <div className="grid gap-space-4">
          <SelectInput
            id="letter-type"
            label={t('Letter type')}
            options={typeOptions}
            placeholder={t('Choose a letter type')}
            value={letterType}
            onChange={(event) => chooseType(event.target.value)}
          />
          {sourceType === 'amenity_booking' ? (
            <TextInput
              id="letter-booking-date"
              label={t('Booking date')}
              type="date"
              defaultValue={workspace.amenityDate}
              onChange={(event) => changeAmenityDate(event.target.value)}
            />
          ) : null}
          {sourceType ? (
            sources === null ? (
              <Banner tone="warning" title={t('Records unavailable')}>
                {t(
                  'You cannot open these records, or their module is turned off.',
                )}
              </Banner>
            ) : sources.length === 0 ? (
              <Banner tone="info" title={t('No records to use')}>
                {t('There are no matching records for this letter type.')}
              </Banner>
            ) : (
              <SelectInput
                id="letter-source"
                label={t(LETTER_SOURCE_LABELS[sourceType])}
                options={sources.map((source) => ({
                  value: source.id,
                  label: letterSourceLabel(source, workspace.society.timezone),
                }))}
                placeholder={t('Choose a record')}
                value={sourceId}
                error={errors.sourceId}
                onChange={(event) => chooseSource(event.target.value)}
              />
            )
          ) : null}
          {ready ? (
            <>
              <p className="text-caption text-ink-muted">
                {t(
                  'Letters are in English. Edit the text, preview it, then download the PDF. Changing the type or record replaces the text.',
                )}
              </p>
              <TextInput
                id="letter-date"
                label={t('Letter date')}
                type="date"
                value={letterDate}
                error={errors.letterDate}
                onChange={(event) => setLetterDate(event.target.value)}
              />
              <TextAreaInput
                id="letter-recipient"
                label={t('To')}
                rows={3}
                maxLength={LETTER_LIMITS.recipient}
                value={recipient}
                error={errors.recipient}
                onChange={(event) => setRecipient(event.target.value)}
              />
              <TextInput
                id="letter-subject"
                label={t('Subject')}
                maxLength={LETTER_LIMITS.subject}
                value={subject}
                error={errors.subject}
                onChange={(event) => setSubject(event.target.value)}
              />
              <TextAreaInput
                id="letter-body"
                label={t('Letter text')}
                rows={14}
                maxLength={LETTER_LIMITS.body}
                value={body}
                error={errors.body}
                onChange={(event) => setBody(event.target.value)}
              />
              {message ? (
                <Banner
                  tone={message.tone}
                  title={
                    message.tone === 'success'
                      ? t('Downloaded')
                      : t('Could not download')
                  }
                >
                  {message.text}
                </Banner>
              ) : null}
              <div className="flex flex-wrap gap-space-3">
                <Button variant="secondary" onClick={preview}>
                  {t('Preview')}
                </Button>
                <Button loading={downloading} onClick={download}>
                  {t('Download PDF')}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </Card>
      <div className="grid min-w-0 content-start gap-space-5">
        {previewing && letterType ? (
          <Card title={t('Preview')}>
            <article
              aria-label={t('Letter preview')}
              className="grid gap-space-3 rounded-md border border-rule bg-surface p-space-5 [overflow-wrap:anywhere]"
            >
              <header className="grid gap-space-1 border-b border-rule pb-space-3">
                <p className="text-subheading font-semibold">
                  {workspace.society.name}
                </p>
                {letterheadLines(workspace.society).map((line) => (
                  <p key={line} className="text-caption text-ink-muted">
                    {line}
                  </p>
                ))}
              </header>
              <p className="text-right">
                {t('Date: {date}', { date: formatBillingDate(letterDate) })}
              </p>
              <p className="whitespace-pre-wrap">{`To,\n${recipient}`}</p>
              <p className="font-semibold">{`Subject: ${subject}`}</p>
              <p className="whitespace-pre-wrap">{body}</p>
              <footer className="border-t border-rule pt-space-2 text-caption text-ink-muted">
                {LETTER_FOOTER}
              </footer>
            </article>
            {placeholdersLeft ? (
              <Banner tone="warning" title={t('Placeholders left')}>
                {t(
                  'Replace the text in [square brackets] before sending this letter.',
                )}
              </Banner>
            ) : null}
          </Card>
        ) : null}
        <Card
          title={t('Recent letters')}
          description={t(
            'Downloads are logged. The PDFs themselves are not stored.',
          )}
        >
          {workspace.recentLogs.length ? (
            <div className="grid">
              {workspace.recentLogs.map((log) => (
                <ListItem
                  key={log.id}
                  title={
                    isLetterType(log.letter_type)
                      ? t(LETTER_TYPE_CONFIG[log.letter_type].label)
                      : log.letter_type
                  }
                  secondary={t('{person} · {date}', {
                    person: log.generated_by_name ?? t('Unknown member'),
                    date: formatLogDate(
                      log.generated_at,
                      workspace.society.timezone,
                    ),
                  })}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('No letters yet')}
              description={t('Letters you download will be listed here.')}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
