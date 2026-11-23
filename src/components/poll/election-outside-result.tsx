// Record a P46 election result created entirely outside the app.
'use client';

import { useId } from 'react';
import { savePollElectionOutsideAction } from '@/app/(admin)/admin/polls/elections/actions';
import { useUiTranslator } from '@/components/ui/language';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';

export function PollElectionOutsideForm({
  documents,
}: {
  documents: readonly { id: string; title: string }[];
}) {
  const { translate: t } = useUiTranslator();
  const id = useId();
  return (
    <ModuleActionForm
      action={savePollElectionOutsideAction}
      idempotent
      submitLabel={t('Record outside-app election')}
      input={(data) => ({
        title: data.get('title'),
        heldOn: data.get('heldOn'),
        posts: [
          {
            name: data.get('postName'),
            seats: 1,
            winnerName: data.get('winnerName'),
            votesCount: data.get('votesCount')
              ? Number(data.get('votesCount'))
              : null,
            documentId: data.get('documentId'),
          },
        ],
      })}
    >
      <TextInput
        id={`${id}-title`}
        name="title"
        label={t('Election title')}
        required
        maxLength={150}
      />
      <TextInput
        id={`${id}-held`}
        name="heldOn"
        label={t('Held on')}
        type="date"
        required
      />
      <TextInput
        id={`${id}-post`}
        name="postName"
        label={t('Post name')}
        required
        maxLength={120}
      />
      <TextInput
        id={`${id}-winner`}
        name="winnerName"
        label={t('Winner')}
        required
        maxLength={120}
      />
      <TextInput
        id={`${id}-votes`}
        name="votesCount"
        label={t('Votes (optional)')}
        type="number"
        min={0}
      />
      <SelectInput
        id={`${id}-document`}
        name="documentId"
        label={t('Evidence document')}
        required
        options={documents.map((document) => ({
          value: document.id,
          label: document.title,
        }))}
      />
    </ModuleActionForm>
  );
}
