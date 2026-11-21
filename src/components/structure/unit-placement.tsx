// Let admins put a unit on a free spot in a building layout, or take it off its spot.
'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { placeBuildingUnitAction } from '@/app/(admin)/admin/structure/actions';
import {
  BuildingDrawing,
  LayoutLegend,
  useLayoutNames,
} from '@/components/structure/building-drawing';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/data-display';
import { Dialog } from '@/components/ui/dialog';
import { useUiTranslator } from '@/components/ui/language';
import { SelectInput } from '@/components/ui/select-input';
import {
  draftFromLayout,
  type BuildingLayout,
} from '@/core/structure/building-layout';
import type { UnitRecords } from '@/core/structure/unit-records';

export function UnitPlacement({
  unitId,
  placement,
  layout,
  canWrite,
}: {
  unitId: string;
  placement: UnitRecords['placement'];
  layout: BuildingLayout;
  canWrite: boolean;
}) {
  const { t, floorName, spaceName } = useLayoutNames();
  const { translateFeedback } = useUiTranslator();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<{
    floorKey: string;
    spaceKey: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);
  const retry = useRef<{ key: string; id: string } | null>(null);

  const building = layout.buildings.find(({ id }) => id === layout.selected);
  const floors = building
    ? draftFromLayout(building.name, layout.floors).floors
    : [];
  const floor = floors.find(({ key }) => key === choice?.floorKey);
  const space = floor?.spaces.find(({ key }) => key === choice?.spaceKey);
  const current = placement
    ? t('{building}, {floor}, spot {spot}', {
        building: placement.block,
        floor: floorName({
          label: placement.label ?? '',
          level: placement.level,
        }),
        spot: placement.position,
      })
    : null;

  function send(
    spaceId: string | null,
    blockId: string,
    version: string | null,
  ) {
    const payload = { blockId, spaceId, version };
    const key = JSON.stringify(payload);
    const id =
      retry.current?.key === key ? retry.current.id : crypto.randomUUID();
    retry.current = { key, id };
    startTransition(async () => {
      const result = await placeBuildingUnitAction(unitId, id, payload);
      if (!result.ok) {
        const field = result.fieldErrors
          ? Object.values(result.fieldErrors)[0]
          : '';
        setFeedback({
          tone: 'danger',
          text: translateFeedback(field || result.message),
        });
        return;
      }
      retry.current = null;
      setChoice(null);
      setFeedback({ tone: 'success', text: t('Unit placement saved.') });
      router.refresh();
    });
  }

  return (
    <Card title={t('Place in building layout')}>
      <div className="grid gap-space-4">
        <p className="text-body">
          {current
            ? t('Current spot: {label}', { label: current })
            : t('This unit is not placed on a building layout yet.')}
        </p>
        {feedback && !choice ? (
          <p
            role={feedback.tone === 'danger' ? 'alert' : 'status'}
            className={`text-caption ${feedback.tone === 'danger' ? 'text-danger' : 'text-success'}`}
          >
            {feedback.text}
          </p>
        ) : null}
        {canWrite && placement ? (
          <div>
            <Button
              variant="secondary"
              loading={pending}
              onClick={() => send(null, placement.block_id, null)}
            >
              {t('Remove from spot')}
            </Button>
          </div>
        ) : null}
        {canWrite ? (
          <>
            {layout.buildings.length ? (
              <div className="w-full max-w-sm">
                <SelectInput
                  id="placement-building"
                  label={t('Building')}
                  value={layout.selected ?? ''}
                  options={layout.buildings.map(({ id, name }) => ({
                    value: id,
                    label: name,
                  }))}
                  onChange={(event) => {
                    setFeedback(null);
                    router.push(
                      `/admin/structure/units/${unitId}?building=${event.currentTarget.value}`,
                    );
                  }}
                />
              </div>
            ) : null}
            {building && floors.length ? (
              <>
                <p className="text-caption text-ink-muted">
                  {t(
                    'Choose a free unit spot. Placing the unit also sets its building and floor.',
                  )}
                </p>
                <BuildingDrawing
                  name={building.name}
                  floors={floors}
                  mode="pick"
                  currentUnitId={unitId}
                  selectedFloor={choice?.floorKey}
                  selectedSpace={choice?.spaceKey}
                  onSpace={(floorKey, spaceKey) => {
                    const target = floors
                      .find(({ key }) => key === floorKey)
                      ?.spaces.find(({ key }) => key === spaceKey);
                    if (target?.unit?.id === unitId) return;
                    setFeedback(null);
                    setChoice({ floorKey, spaceKey });
                  }}
                />
                <LayoutLegend />
              </>
            ) : (
              <p className="text-body">
                {t(
                  'This building has no layout yet. Draw it on the Structure screen first.',
                )}
              </p>
            )}
          </>
        ) : null}
      </div>
      <Dialog
        id="placement-confirm"
        open={Boolean(floor && space)}
        onOpenChange={(open) => (open ? null : setChoice(null))}
        title={t('Place unit here?')}
        description={
          floor && space && building
            ? t('{building}, {floor}: {space}', {
                building: building.name,
                floor: floorName(floor),
                space: spaceName(space),
              })
            : undefined
        }
      >
        <div className="grid gap-space-4">
          <p className="text-body">
            {t('The unit’s building and floor will change to match this spot.')}
          </p>
          {feedback && choice ? (
            <p
              role={feedback.tone === 'danger' ? 'alert' : 'status'}
              className={`text-body ${feedback.tone === 'danger' ? 'text-danger' : 'text-success'}`}
            >
              {feedback.text}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-space-2 medium:flex-row medium:justify-end">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setChoice(null)}
            >
              {t('Cancel')}
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                space?.id && building
                  ? send(space.id, building.id, layout.version)
                  : undefined
              }
            >
              {t('Place unit')}
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
