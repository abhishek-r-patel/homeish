// Let admins draw and save building layouts; committee members see the same drawing read-only.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import {
  saveBuildingLayoutAction,
  setBlockActiveAction,
} from '@/app/(admin)/admin/structure/actions';
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
import { TextInput } from '@/components/ui/text-input';
import type { ServerActionResult } from '@/core/actions/server-action';
import {
  MAX_BASEMENTS,
  MAX_FLOORS,
  MAX_SPACES,
  SPACE_KINDS,
  addFloor,
  addSpace,
  copyFloor,
  createDraft,
  draftFromLayout,
  layoutProblem,
  moveSpace,
  removeFloor,
  removeSpace,
  setFloorUse,
  setSpaceKind,
  toSavePayload,
  toggleDuplex,
  updateFloor,
  type BuildingLayout,
  type EditResult,
  type LayoutDraft,
  type Notice,
  type SpaceKind,
  type WholeUse,
} from '@/core/structure/building-layout';

type Feedback = { tone: 'success' | 'danger'; text: string } | null;

function failureText(
  result: Extract<ServerActionResult<unknown>, { ok: false }>,
  translateFeedback: (source: string) => string,
) {
  const field = result.fieldErrors ? Object.values(result.fieldErrors)[0] : '';
  return translateFeedback(field || result.message);
}

export function BuildingLayoutDesigner({
  layout,
  canEdit,
  canOpenUnits,
  basePath,
}: {
  layout: BuildingLayout;
  canEdit: boolean;
  canOpenUnits: boolean;
  basePath: string;
}) {
  const { t, floorName, defaultFloorName, kindName, spaceName } =
    useLayoutNames();
  const { translateFeedback } = useUiTranslator();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<LayoutDraft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selection, setSelection] = useState<{
    floorKey: string;
    spaceKey?: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [setup, setSetup] = useState({
    name: '',
    floors: '10',
    basements: '0',
    spaces: '4',
    ground: 'parking' as 'parking' | 'units' | 'shop',
  });
  const [copyRange, setCopyRange] = useState({ from: '', to: '' });
  const [feedback, setFeedback] = useState<Feedback>(null);
  const retry = useRef<{ key: string; id: string } | null>(null);

  const saved = layout.buildings.find(({ id }) => id === layout.selected);
  const editing = draft !== null;
  const shown =
    draft ?? (saved ? draftFromLayout(saved.name, layout.floors) : null);
  const floors = shown?.floors ?? [];
  const floorIndex = floors.findIndex(({ key }) => key === selection?.floorKey);
  const floor = floors[floorIndex];
  const spaceIndex =
    floor?.spaces.findIndex(({ key }) => key === selection?.spaceKey) ?? -1;
  const space = floor?.spaces[spaceIndex];
  const assigned = floors
    .flatMap(({ spaces }) => spaces)
    .filter(({ unit }) => unit).length;

  const say = (item: Notice) => t(item.text, item.values);
  function notify(text: string, tone: 'success' | 'danger' = 'success') {
    setFeedback(text ? { tone, text } : null);
  }
  function apply(result: EditResult) {
    if ('error' in result) return notify(say(result.error), 'danger');
    setDraft(result.draft);
    notify(result.notice ? say(result.notice) : '');
  }
  function closeEditor() {
    setSelection(null);
    if (feedback?.tone === 'danger') setFeedback(null);
  }

  function startEditing() {
    if (!saved) return;
    setDraft(
      layout.floors.length
        ? draftFromLayout(saved.name, layout.floors)
        : {
            ...createDraft({
              name: saved.name,
              floors: '0',
              basements: '0',
              spaces: '4',
              ground: 'units',
            }),
          },
    );
    setIsNew(false);
    notify('');
  }

  function cancelEditing() {
    setDraft(null);
    setIsNew(false);
    setSelection(null);
    retry.current = null;
    notify(t('Changes discarded.'));
  }

  function saveEditing() {
    if (!draft) return;
    const problem = layoutProblem(draft);
    if (problem) return notify(say(problem), 'danger');
    const name = draft.name.trim().toLowerCase();
    if (
      layout.buildings.some(
        (item) =>
          (isNew || item.id !== layout.selected) &&
          item.name.toLowerCase() === name,
      )
    )
      return notify(t('A block with this name already exists.'), 'danger');
    const target = isNew ? null : layout.selected;
    const payload = toSavePayload(draft, isNew ? null : layout.version);
    const key = JSON.stringify([target, payload]);
    const id =
      retry.current?.key === key ? retry.current.id : crypto.randomUUID();
    retry.current = { key, id };
    startTransition(async () => {
      const result = await saveBuildingLayoutAction(target, id, payload);
      if (!result.ok)
        return notify(failureText(result, translateFeedback), 'danger');
      retry.current = null;
      setDraft(null);
      setIsNew(false);
      setSelection(null);
      notify(t('Building layout saved.'));
      router.push(`${basePath}?building=${result.data}`);
      router.refresh();
    });
  }

  function createBuilding() {
    const next = createDraft(setup);
    setDraft({
      ...next,
      name:
        next.name ||
        t('Building {number}', { number: layout.buildings.length + 1 }),
    });
    setIsNew(true);
    setCreating(false);
    setSelection(null);
    notify(t('Building drafted. Adjust it, then save.'));
  }

  function archiveBuilding() {
    if (!saved) return;
    if (assigned > 0)
      return notify(
        t('Move this building’s placed units in Unit 360 first.'),
        'danger',
      );
    const form = new FormData();
    form.set('blockId', saved.id);
    form.set('active', 'false');
    startTransition(async () => {
      const result = await setBlockActiveAction(form);
      if (!result.ok)
        return notify(failureText(result, translateFeedback), 'danger');
      notify(t('Building archived.'));
      router.push(basePath);
      router.refresh();
    });
  }

  const dialogFeedback =
    feedback && selection ? (
      <p
        role={feedback.tone === 'danger' ? 'alert' : 'status'}
        className={`text-body ${feedback.tone === 'danger' ? 'text-danger' : 'text-success'}`}
      >
        {feedback.text}
      </p>
    ) : null;
  const readOnlyNote = (
    <>
      <p className="text-body">
        {canEdit
          ? t('Choose Edit layout to change this layout.')
          : t('You can view this layout but not change it.')}
      </p>
      <div className="flex justify-end">
        <Button onClick={closeEditor}>{t('Done')}</Button>
      </div>
    </>
  );

  return (
    <Card title={t('Building layout')}>
      <div className="grid gap-space-4">
        <div className="flex flex-wrap items-end gap-space-3">
          <div className="w-full max-w-sm">
            {draft ? (
              <TextInput
                id="designer-building-name"
                label={t('Building name')}
                maxLength={60}
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.currentTarget.value })
                }
              />
            ) : layout.buildings.length ? (
              <SelectInput
                id="designer-building"
                label={t('Building')}
                value={layout.selected ?? ''}
                options={layout.buildings.map(({ id, name }) => ({
                  value: id,
                  label: name,
                }))}
                onChange={(event) => {
                  setSelection(null);
                  notify('');
                  router.push(
                    `${basePath}?building=${event.currentTarget.value}`,
                  );
                }}
              />
            ) : null}
          </div>
          {canEdit && editing ? (
            <div className="flex flex-wrap gap-space-2">
              <Button onClick={saveEditing} loading={pending}>
                {t('Save building')}
              </Button>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={cancelEditing}
              >
                {t('Cancel')}
              </Button>
            </div>
          ) : null}
          {canEdit && !editing ? (
            <div className="flex flex-wrap gap-space-2">
              <Button onClick={startEditing} disabled={!saved || pending}>
                {t('Edit layout')}
              </Button>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  setCreating(true);
                  notify('');
                }}
              >
                {t('Add building')}
              </Button>
              <Button
                variant="tertiary"
                disabled={!saved}
                loading={pending}
                onClick={archiveBuilding}
              >
                {t('Archive building')}
              </Button>
            </div>
          ) : null}
        </div>
        {editing ? (
          <p className="text-caption text-ink-muted">
            {t(
              'Use + on the roof to add a floor, + at the end of a floor to add a unit spot, and + under the building to add a basement. Select a floor name or any spot to edit it. A new spot is an empty position, not a unit record.',
            )}
          </p>
        ) : null}
        {feedback && !selection ? (
          <p
            role={feedback.tone === 'danger' ? 'alert' : 'status'}
            className={`text-caption ${feedback.tone === 'danger' ? 'text-danger' : 'text-success'}`}
          >
            {feedback.text}
          </p>
        ) : null}
        {shown && floors.length ? (
          <BuildingDrawing
            name={shown.name}
            floors={floors}
            mode={editing ? 'edit' : 'view'}
            selectedFloor={selection?.floorKey}
            selectedSpace={selection?.spaceKey}
            onFloor={(floorKey) => {
              setSelection({ floorKey });
              setCopyRange({ from: '', to: '' });
              notify('');
            }}
            onSpace={(floorKey, spaceKey) => {
              setSelection({ floorKey, spaceKey });
              notify('');
            }}
            onAddFloor={() => draft && apply(addFloor(draft, true))}
            onAddBasement={() => draft && apply(addFloor(draft, false))}
            onAddSpace={(floorKey) => draft && apply(addSpace(draft, floorKey))}
          />
        ) : saved ? (
          <p className="text-body">
            {canEdit
              ? t(
                  'This building has no layout yet. Choose Edit layout to draw it.',
                )
              : t('This building has no layout yet.')}
          </p>
        ) : (
          <p className="text-body">
            {canEdit
              ? t('No buildings yet. Add one to start.')
              : t('No buildings yet.')}
          </p>
        )}
        <LayoutLegend />
      </div>

      <Dialog
        id="designer-floor"
        open={Boolean(floor && !space)}
        onOpenChange={(open) => (open ? null : closeEditor())}
        title={floor ? floorName(floor) : t('Floor')}
        description={
          floor
            ? `${floor.whole ? t('Whole floor: {use}', { use: spaceName(floor.spaces[0]!) }) : t('{count} spaces', { count: floor.spaces.length })} · ${t('{count} units placed', { count: floor.spaces.filter(({ unit }) => unit).length })}`
            : undefined
        }
      >
        {floor && !space ? (
          <div className="grid gap-space-4">
            {draft ? (
              <>
                <TextInput
                  id="floor-label"
                  label={t('Floor name')}
                  maxLength={30}
                  placeholder={defaultFloorName(floor.level)}
                  helpText={t(
                    'Leave blank for the automatic name. Use it for refuge floors, podiums or skipped numbers.',
                  )}
                  value={floor.label}
                  onChange={(event) => {
                    const label = event.currentTarget.value;
                    setDraft(
                      updateFloor(draft, floor.key, (item) => ({
                        ...item,
                        label,
                      })),
                    );
                  }}
                />
                <SelectInput
                  id="floor-use"
                  label={t('Floor use')}
                  value={floor.whole ? floor.spaces[0]!.kind : 'separate'}
                  options={[
                    { value: 'separate', label: t('Separate spaces') },
                    { value: 'parking', label: t('Whole floor: Parking') },
                    { value: 'amenity', label: t('Whole floor: Amenity') },
                    {
                      value: 'shop',
                      label: t('Whole floor: Shop / commercial'),
                    },
                    {
                      value: 'service',
                      label: t('Whole floor: Service room'),
                    },
                  ]}
                  onChange={(event) =>
                    apply(
                      setFloorUse(
                        draft,
                        floor.key,
                        event.currentTarget.value as WholeUse | 'separate',
                      ),
                    )
                  }
                />
                {floor.whole ? (
                  <TextInput
                    id="floor-whole-name"
                    label={t('Name shown on the layout')}
                    maxLength={40}
                    placeholder={
                      floor.spaces[0]!.kind === 'upper'
                        ? undefined
                        : kindName(floor.spaces[0]!.kind)
                    }
                    value={floor.spaces[0]!.name}
                    onChange={(event) => {
                      const name = event.currentTarget.value;
                      setDraft(
                        updateFloor(draft, floor.key, (item) => ({
                          ...item,
                          spaces: [{ ...item.spaces[0]!, name }],
                        })),
                      );
                    }}
                  />
                ) : null}
                <fieldset className="grid gap-space-3 rounded-md border border-rule p-space-3">
                  <legend className="px-space-1 text-body-strong">
                    {t('Copy this floor’s layout')}
                  </legend>
                  <div className="grid gap-space-3 medium:grid-cols-2">
                    {(['from', 'to'] as const).map((end) => (
                      <SelectInput
                        key={end}
                        id={`copy-${end}`}
                        label={t(end === 'from' ? 'From floor' : 'To floor')}
                        value={copyRange[end]}
                        options={[
                          { value: '', label: t('Choose a floor') },
                          ...[...floors].reverse().map((item) => ({
                            value: String(item.level),
                            label: floorName(item),
                          })),
                        ]}
                        onChange={(event) =>
                          setCopyRange({
                            ...copyRange,
                            [end]: event.currentTarget.value,
                          })
                        }
                      />
                    ))}
                  </div>
                  <p className="text-caption text-ink-muted">
                    {t(
                      'Floors with placed units or duplexes are never overwritten.',
                    )}
                  </p>
                  <div>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        apply(
                          copyFloor(
                            draft,
                            floor.key,
                            copyRange.from,
                            copyRange.to,
                          ),
                        )
                      }
                    >
                      {t('Copy layout to floors')}
                    </Button>
                  </div>
                </fieldset>
                {dialogFeedback}
                <div className="flex flex-wrap justify-between gap-space-2">
                  <Button
                    variant="tertiary"
                    onClick={() => {
                      const result = removeFloor(draft, floor.key);
                      apply(result);
                      if (!('error' in result)) setSelection(null);
                    }}
                  >
                    {t('Remove floor')}
                  </Button>
                  <Button onClick={closeEditor}>{t('Done')}</Button>
                </div>
              </>
            ) : (
              readOnlyNote
            )}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        id="designer-space"
        open={Boolean(floor && space)}
        onOpenChange={(open) => (open ? null : closeEditor())}
        title={
          floor && space
            ? t('{floor} · spot {spot}', {
                floor: floorName(floor),
                spot: spaceIndex + 1,
              })
            : t('Spot')
        }
        description={
          floor && space
            ? space.duplex
              ? t('Duplex with {floor}, {space}', {
                  floor: floorName(floors[floorIndex - 1] ?? floor),
                  space: spaceName(space),
                })
              : spaceName(space)
            : undefined
        }
      >
        {floor && space ? (
          <div className="grid gap-space-4">
            {space.unit ? (
              <>
                <p className="text-caption text-ink-muted">
                  {t(
                    'This unit was placed in Unit 360. Move it there before changing or removing this spot.',
                  )}
                </p>
                {canOpenUnits && !draft ? (
                  <Link
                    className="inline-flex min-h-11 items-center justify-self-start text-brand underline"
                    href={`/admin/structure/units/${space.unit.id}`}
                  >
                    {t('Open Unit 360')}
                  </Link>
                ) : null}
              </>
            ) : null}
            {draft ? (
              <>
                <SelectInput
                  id="space-kind"
                  label={t('Space type')}
                  value={space.kind === 'upper' ? 'unit' : space.kind}
                  options={SPACE_KINDS.map((kind) => ({
                    value: kind,
                    label: kindName(kind),
                  }))}
                  onChange={(event) =>
                    apply(
                      setSpaceKind(
                        draft,
                        floor.key,
                        space.key,
                        event.currentTarget.value as SpaceKind,
                      ),
                    )
                  }
                />
                {space.kind !== 'unit' &&
                space.kind !== 'upper' &&
                space.kind !== 'gap' ? (
                  <TextInput
                    id="space-name"
                    label={t('Name shown on the layout')}
                    maxLength={40}
                    placeholder={kindName(space.kind)}
                    value={space.name}
                    onChange={(event) => {
                      const name = event.currentTarget.value;
                      setDraft(
                        updateFloor(draft, floor.key, (item) => ({
                          ...item,
                          spaces: item.spaces.map((current) =>
                            current.key === space.key
                              ? { ...current, name }
                              : current,
                          ),
                        })),
                      );
                    }}
                  />
                ) : null}
                {space.kind === 'unit' ? (
                  <label className="flex items-start gap-space-2 text-body">
                    <input
                      type="checkbox"
                      className="mt-space-1 size-5"
                      checked={space.duplex}
                      onChange={(event) =>
                        apply(
                          toggleDuplex(
                            draft,
                            floor.key,
                            space.key,
                            event.currentTarget.checked,
                          ),
                        )
                      }
                    />
                    {t(
                      'Duplex: this unit also uses the same spot on the floor above',
                    )}
                  </label>
                ) : null}
                <div className="flex flex-wrap gap-space-2">
                  <Button
                    variant="secondary"
                    disabled={spaceIndex === 0}
                    onClick={() =>
                      apply(moveSpace(draft, floor.key, space.key, -1))
                    }
                  >
                    {t('Move left')}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={spaceIndex === floor.spaces.length - 1}
                    onClick={() =>
                      apply(moveSpace(draft, floor.key, space.key, 1))
                    }
                  >
                    {t('Move right')}
                  </Button>
                </div>
                {dialogFeedback}
                <div className="flex flex-wrap justify-between gap-space-2">
                  <Button
                    variant="tertiary"
                    onClick={() => {
                      const result = removeSpace(draft, floor.key, space.key);
                      apply(result);
                      if (!('error' in result)) setSelection(null);
                    }}
                  >
                    {t('Remove spot')}
                  </Button>
                  <Button onClick={closeEditor}>{t('Done')}</Button>
                </div>
              </>
            ) : (
              readOnlyNote
            )}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        id="designer-add-building"
        open={creating}
        onOpenChange={setCreating}
        title={t('Add building')}
        description={t(
          'Start with a regular shape, then adjust single floors and spots on the drawing.',
        )}
      >
        <div className="grid gap-space-4">
          <TextInput
            id="setup-name"
            label={t('Building name')}
            maxLength={60}
            value={setup.name}
            onChange={(event) =>
              setSetup({ ...setup, name: event.currentTarget.value })
            }
          />
          <SelectInput
            id="setup-ground"
            label={t('Ground floor')}
            value={setup.ground}
            options={[
              { value: 'parking', label: t('Parking (whole floor)') },
              { value: 'units', label: t('Unit spots') },
              { value: 'shop', label: t('Shops') },
            ]}
            onChange={(event) =>
              setSetup({
                ...setup,
                ground: event.currentTarget.value as typeof setup.ground,
              })
            }
          />
          <div className="grid gap-space-3 medium:grid-cols-3">
            <TextInput
              id="setup-floors"
              label={t('Floors (0–99)')}
              inputMode="numeric"
              type="number"
              min={0}
              max={MAX_FLOORS}
              value={setup.floors}
              onChange={(event) =>
                setSetup({ ...setup, floors: event.currentTarget.value })
              }
            />
            <TextInput
              id="setup-spaces"
              label={t('Spots per floor')}
              inputMode="numeric"
              type="number"
              min={1}
              max={MAX_SPACES}
              value={setup.spaces}
              onChange={(event) =>
                setSetup({ ...setup, spaces: event.currentTarget.value })
              }
            />
            <TextInput
              id="setup-basements"
              label={t('Basements (0–5)')}
              inputMode="numeric"
              type="number"
              min={0}
              max={MAX_BASEMENTS}
              value={setup.basements}
              onChange={(event) =>
                setSetup({ ...setup, basements: event.currentTarget.value })
              }
            />
          </div>
          <div className="flex flex-col-reverse gap-space-2 medium:flex-row medium:justify-end">
            <Button variant="secondary" onClick={() => setCreating(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={createBuilding}>{t('Create draft layout')}</Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
