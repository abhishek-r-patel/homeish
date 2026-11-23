// Upload optional private evidence and raise a P46 voter dispute.
'use client';

import { useId, useRef, useState } from 'react';
import { raisePollElectionDisputeAction } from '@/app/(resident)/polls/actions';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { publicEnvironment } from '@/core/config/public-env';
import type { PollElectionDetail } from '@/core/poll/election-read-model';

type UploadEnvelope = {
  ok: boolean;
  data?: { path?: string; signedUrl?: string };
};

export function PollElectionDisputeForm({
  election,
}: {
  election: PollElectionDetail;
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const response = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bucket: 'poll-dispute-files',
          contentType: file.type,
          sizeBytes: file.size,
          electionId: election.id,
        }),
      });
      const result = (await response.json()) as UploadEnvelope;
      const signedUrl = result.data?.signedUrl;
      const uploadedPath = result.data?.path;
      if (!response.ok || !result.ok || !signedUrl || !uploadedPath) {
        throw new Error('The dispute upload link could not be issued.');
      }
      if (
        new URL(signedUrl).origin !==
        new URL(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL).origin
      ) {
        throw new Error('The dispute upload link is invalid.');
      }
      const uploadResult = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'content-type': file.type,
          'cache-control': 'max-age=3600',
          'x-upsert': 'false',
        },
        body: file,
      });
      if (!uploadResult.ok)
        throw new Error('The dispute file could not be uploaded.');
      setPath(uploadedPath);
      setMessage('Private file uploaded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }
  return (
    <ModuleActionForm
      action={raisePollElectionDisputeAction}
      idempotent
      submitLabel={t('Raise dispute')}
      input={(data) => ({
        electionId: election.id,
        text: data.get('text'),
        filePath: path,
      })}
    >
      <TextAreaInput
        id={`${id}-text`}
        name="text"
        label={t('Dispute')}
        required
        maxLength={2000}
      />
      <input
        name="uploadPending"
        type="hidden"
        value={uploading ? 'true' : 'false'}
      />
      <label className="grid gap-space-1" htmlFor={`${id}-file`}>
        {t('Private evidence (optional)')}
        <input
          ref={fileRef}
          id={`${id}-file`}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(event) => void upload(event.currentTarget.files?.[0])}
          className="min-h-12 rounded-md border border-rule px-space-3 py-space-2"
        />
      </label>
      {message ? (
        <p role="status" className="text-caption">
          {t(message)}
        </p>
      ) : null}
    </ModuleActionForm>
  );
}
