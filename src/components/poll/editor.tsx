// Let administrators edit all mutable draft settings and ballot configuration.
'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckboxInput } from '@/components/ui/choice-controls';
import { Card } from '@/components/ui/data-display';
import {
  ModuleActionForm,
  type ModuleFormAction,
} from '@/components/ui/module-action-form';
import { SelectInput } from '@/components/ui/select-input';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { TextInput } from '@/components/ui/text-input';
import {
  pollDraftInputSchema,
  pollDraftSaveInputSchema,
  type PollAdminVote,
} from '@/core/poll/validation';
import { PollDateTimePicker } from './admin';

type OfficeDraft = { name: string; candidates: string[] };

function ballotDraftFormValue(form: FormData, offices: readonly OfficeDraft[]) {
  const opensAt = String(form.get('opensAt') ?? '');
  const closesAt = String(form.get('closesAt') ?? '');
  const override = form.get('tenantVotingOverride');
  const selectionMode = form.get('selectionMode') ?? 'single';
  const rawLimit = String(form.get('selectionLimit') ?? '');
  return pollDraftInputSchema.parse({
    title: String(form.get('title') ?? ''),
    instructions: String(form.get('instructions') ?? '') || null,
    opensAt: opensAt || null,
    closesAt: closesAt || null,
    selectionMode,
    selectionLimit:
      selectionMode === 'single'
        ? 1
        : rawLimit === ''
          ? null
          : Number(rawLimit),
    tenantVotingOverride: override === 'default' ? null : override === 'true',
    blockIds: form.getAll('blockId').map(String),
    options: form
      .getAll('option')
      .map((label) => String(label).trim())
      .filter(Boolean)
      .map((label) => ({ label })),
    offices: offices
      .map((office, index) => ({
        name: String(form.get(`office-${index}`) ?? ''),
        candidates: form
          .getAll(`candidate-${index}`)
          .map((name) => String(name).trim())
          .filter(Boolean)
          .map((name) => ({ name })),
      }))
      .filter((office) => office.name || office.candidates.length > 0),
  });
}

export function PollDraftEditor({
  detail,
  blocks,
  action,
}: {
  detail: PollAdminVote;
  blocks: readonly { id: string; name: string }[];
  action: ModuleFormAction;
}) {
  const { vote } = detail;
  const id = useId();
  const [optionRows, setOptionRows] = useState(
    vote.votingType === 'public'
      ? detail.options.map(({ label }) => label)
      : ['', ''],
  );
  const [offices, setOffices] = useState<OfficeDraft[]>(
    vote.votingType === 'private'
      ? detail.offices.map((office) => ({
          name: office.name,
          candidates: office.candidates.map(({ name }) => name),
        }))
      : [{ name: '', candidates: [''] }],
  );
  const [selectionMode, setSelectionMode] = useState(vote.selectionMode);
  const [tenantOverride, setTenantOverride] = useState(
    vote.tenantVotingOverride === null
      ? 'default'
      : String(vote.tenantVotingOverride),
  );
  return (
    <section className="grid gap-space-4">
      <Link
        className="text-brand underline focus-visible:outline-2 focus-visible:outline-focus"
        href={`/admin/polls/${vote.id}`}
      >
        Back to poll details
      </Link>
      <Card
        title="Edit poll draft"
        description="A draft can be changed until it is scheduled or opened. The voter list is frozen when voting is scheduled or opened."
      >
        <ModuleActionForm
          action={action}
          submitLabel="Save draft"
          input={(form) =>
            pollDraftSaveInputSchema.parse({
              voteId: vote.id,
              expectedRevision: vote.revision,
              draft: ballotDraftFormValue(form, offices),
            })
          }
        >
          <TextInput
            id={`${id}-title`}
            name="title"
            label="Poll title"
            defaultValue={vote.title}
            maxLength={150}
          />
          <TextAreaInput
            id={`${id}-instructions`}
            name="instructions"
            label={`Instructions${vote.votingType === 'private' ? ' (required before opening)' : ' (optional)'}`}
            defaultValue={vote.instructions ?? ''}
            maxLength={2000}
          />
          <PollDateTimePicker
            key={`open-${vote.opensAt ?? ''}`}
            id={`${id}-opens`}
            label="Planned opening"
            value={vote.opensAt}
            fieldName="opensAt"
          />
          <PollDateTimePicker
            key={`close-${vote.closesAt ?? ''}`}
            id={`${id}-closes`}
            label="Closing"
            value={vote.closesAt}
            fieldName="closesAt"
          />
          <SelectInput
            id={`${id}-tenant`}
            name="tenantVotingOverride"
            label="Tenant voting for this poll"
            value={tenantOverride}
            onChange={(event) => setTenantOverride(event.currentTarget.value)}
            options={[
              { value: 'default', label: 'Use society default' },
              { value: 'false', label: 'Owners only' },
              { value: 'true', label: 'Owners and tenants' },
            ]}
          />
          {vote.votingType === 'public' ? (
            <>
              <SelectInput
                id={`${id}-selection-mode`}
                name="selectionMode"
                label="How residents can vote"
                value={selectionMode}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  if (value === 'single' || value === 'multiple')
                    setSelectionMode(value);
                }}
                options={[
                  { value: 'single', label: 'Choose one option' },
                  { value: 'multiple', label: 'Choose multiple options' },
                ]}
              />
              {selectionMode === 'multiple' ? (
                <TextInput
                  id={`${id}-selection-limit`}
                  name="selectionLimit"
                  label="Maximum selections (optional)"
                  inputMode="numeric"
                  type="number"
                  min={2}
                  max={100}
                  defaultValue={
                    vote.selectionMode === 'multiple'
                      ? (vote.selectionLimit ?? '')
                      : ''
                  }
                />
              ) : (
                <input type="hidden" name="selectionLimit" value="1" />
              )}
              <fieldset className="grid gap-space-2 border-0 p-0">
                <legend className="text-body-strong">Poll options</legend>
                {optionRows.map((label, index) => (
                  <div
                    className="flex min-w-0 items-end gap-space-2"
                    key={`option-${index}`}
                  >
                    <TextInput
                      id={`${id}-option-${index}`}
                      name="option"
                      label={`Option ${index + 1}`}
                      value={label}
                      onChange={(event) =>
                        setOptionRows((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? event.currentTarget.value
                              : item,
                          ),
                        )
                      }
                      maxLength={200}
                    />
                    {optionRows.length > 2 ? (
                      <Button
                        aria-label={`Remove option ${index + 1}`}
                        onClick={() =>
                          setOptionRows((current) =>
                            current.filter(
                              (_, optionIndex) => optionIndex !== index,
                            ),
                          )
                        }
                        type="button"
                        variant="tertiary"
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))}
                {optionRows.length < 100 ? (
                  <Button
                    onClick={() => setOptionRows((current) => [...current, ''])}
                    type="button"
                    variant="secondary"
                  >
                    Add option
                  </Button>
                ) : null}
              </fieldset>
            </>
          ) : (
            <div className="grid gap-space-3">
              <p className="text-caption text-ink-muted">
                Private elections are single-select and include None of the
                above for every office.
              </p>
              {offices.map((office, officeIndex) => (
                <fieldset
                  className="grid gap-space-2 rounded-md border border-rule p-space-3"
                  key={`office-${officeIndex}`}
                >
                  <legend className="px-space-1 text-body-strong">
                    Office {officeIndex + 1}
                  </legend>
                  <TextInput
                    id={`${id}-office-${officeIndex}`}
                    name={`office-${officeIndex}`}
                    label="Office name"
                    value={office.name}
                    onChange={(event) =>
                      setOffices((current) =>
                        current.map((item, index) =>
                          index === officeIndex
                            ? { ...item, name: event.currentTarget.value }
                            : item,
                        ),
                      )
                    }
                    maxLength={120}
                  />
                  {office.candidates.map((candidate, candidateIndex) => (
                    <div
                      className="flex min-w-0 items-end gap-space-2"
                      key={`candidate-${candidateIndex}`}
                    >
                      <TextInput
                        id={`${id}-candidate-${officeIndex}-${candidateIndex}`}
                        name={`candidate-${officeIndex}`}
                        label={`Candidate ${candidateIndex + 1}`}
                        value={candidate}
                        onChange={(event) =>
                          setOffices((current) =>
                            current.map((item, index) =>
                              index === officeIndex
                                ? {
                                    ...item,
                                    candidates: item.candidates.map(
                                      (candidateName, itemIndex) =>
                                        itemIndex === candidateIndex
                                          ? event.currentTarget.value
                                          : candidateName,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        maxLength={120}
                      />
                      {office.candidates.length > 1 ? (
                        <Button
                          aria-label={`Remove candidate ${candidateIndex + 1}`}
                          onClick={() =>
                            setOffices((current) =>
                              current.map((item, index) =>
                                index === officeIndex
                                  ? {
                                      ...item,
                                      candidates: item.candidates.filter(
                                        (_, candidateIndexToRemove) =>
                                          candidateIndexToRemove !==
                                          candidateIndex,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                          type="button"
                          variant="tertiary"
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {office.candidates.length < 50 ? (
                    <Button
                      onClick={() =>
                        setOffices((current) =>
                          current.map((item, index) =>
                            index === officeIndex
                              ? {
                                  ...item,
                                  candidates: [...item.candidates, ''],
                                }
                              : item,
                          ),
                        )
                      }
                      type="button"
                      variant="secondary"
                    >
                      Add candidate
                    </Button>
                  ) : null}
                  {offices.length > 1 ? (
                    <Button
                      onClick={() =>
                        setOffices((current) =>
                          current.filter((_, index) => index !== officeIndex),
                        )
                      }
                      type="button"
                      variant="tertiary"
                    >
                      Remove office
                    </Button>
                  ) : null}
                </fieldset>
              ))}
              {offices.length < 20 ? (
                <Button
                  onClick={() =>
                    setOffices((current) => [
                      ...current,
                      { name: '', candidates: [''] },
                    ])
                  }
                  type="button"
                  variant="secondary"
                >
                  Add office
                </Button>
              ) : null}
            </div>
          )}
          {blocks.length ? (
            <fieldset className="grid gap-space-2 border-0 p-0">
              <legend className="text-body-strong">Voting area</legend>
              <p className="text-caption text-ink-muted">
                Leave all blocks unchecked to include the whole society.
              </p>
              {blocks.map((block, index) => (
                <CheckboxInput
                  key={block.id}
                  id={`${id}-block-${index}`}
                  name="blockId"
                  value={block.id}
                  defaultChecked={vote.blockIds.includes(block.id)}
                  label={block.name}
                />
              ))}
            </fieldset>
          ) : (
            <p className="text-caption text-ink-muted">
              No active blocks are available; this poll covers the whole
              society.
            </p>
          )}
        </ModuleActionForm>
      </Card>
    </section>
  );
}
