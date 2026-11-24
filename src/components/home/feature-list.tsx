// Render the read-only P55 module list and admin request controls.
'use client';

import { useState } from 'react';
import { createFeatureRequestAction } from '@/app/(admin)/admin/features/actions';
import { Button } from '@/components/ui/button';
import { Card, StatusChip } from '@/components/ui/data-display';
import { ModuleActionForm } from '@/components/ui/module-action-form';
import { TextAreaInput } from '@/components/ui/specialized-inputs';
import { useUiTranslator } from '@/components/ui/language';
import type { getFeatureList } from '@/core/home/feature-requests';

type FeatureData = Awaited<ReturnType<typeof getFeatureList>>;

export function FeatureList({ data }: { data: FeatureData }) {
  const { translate: t } = useUiTranslator();
  const [requesting, setRequesting] = useState<string | null>(null);
  return (
    <section className="grid gap-space-5">
      <header className="grid gap-space-2">
        <h1 className="text-title font-semibold">{t('Homeish features')}</h1>
        <p className="text-body text-ink-muted">
          {t(
            'Review what is available for this society. Asking for a feature never switches it on.',
          )}
        </p>
      </header>
      <ul className="grid gap-space-3">
        {data.features.map((feature) => (
          <li key={feature.key}>
            <Card
              title={feature.name}
              action={
                <StatusChip
                  status={feature.enabled ? 'module.on' : 'module.off'}
                />
              }
            >
              <div className="grid gap-space-3">
                <p className="text-body">{feature.description}</p>
                <p className="text-body text-ink-muted">
                  {feature.enabled
                    ? t('Available to permitted roles in this society.')
                    : t('Not switched on for this society.')}
                </p>
                {feature.request ? (
                  <p className="text-caption text-ink-muted">
                    {t('Latest request: {status}', {
                      status: t(feature.request.status),
                    })}
                  </p>
                ) : null}
                {!feature.enabled && data.canRequest ? (
                  requesting === feature.key ? (
                    <ModuleActionForm
                      action={async (source) => {
                        const input = JSON.parse(
                          String(source.get('input') ?? '{}'),
                        ) as { note?: string };
                        const formData = new FormData();
                        formData.set('moduleKey', feature.key);
                        formData.set('note', String(input.note ?? ''));
                        return createFeatureRequestAction(formData);
                      }}
                      input={(form) => ({ note: form.get('note') })}
                      submitLabel={t('Send request')}
                    >
                      <TextAreaInput
                        id={`feature-note-${feature.key}`}
                        label={t('Note (optional)')}
                        maxLength={500}
                        name="note"
                        rows={3}
                      />
                    </ModuleActionForm>
                  ) : (
                    <Button
                      onClick={() => setRequesting(feature.key)}
                      variant="secondary"
                    >
                      {t('Ask for this feature')}
                    </Button>
                  )
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
