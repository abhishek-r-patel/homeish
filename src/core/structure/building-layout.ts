// Shared building layout shapes, rules and pure edits for the designer, actions and RPC checks.
import { z } from 'zod';

export const MAX_FLOORS = 99;
export const MAX_BASEMENTS = 5;
export const MAX_SPACES = 20;

export const SPACE_KINDS = [
  'unit',
  'parking',
  'amenity',
  'shop',
  'service',
  'gap',
] as const;
export type SpaceKind = (typeof SPACE_KINDS)[number];
type Kind = SpaceKind | 'upper';
export const WHOLE_USES = ['parking', 'amenity', 'shop', 'service'] as const;
export type WholeUse = (typeof WHOLE_USES)[number];

export const KIND_NAMES: Record<SpaceKind, string> = {
  unit: 'Unit spot',
  parking: 'Parking',
  amenity: 'Amenity',
  shop: 'Shop / commercial',
  service: 'Service room',
  gap: 'Blank gap',
};

// Every template a rule or edit can return; translated by the caller with its values.
const TEXT = {
  name: 'Building name must be 1 to 60 characters.',
  floors: 'Floors must run without gaps and include Ground.',
  floorCount: 'A building can have up to {count} floors.',
  basementCount: 'A building can have up to {count} basements.',
  spaceCount: 'A floor can have 1 to {count} spaces.',
  whole: 'A whole floor must be one parking, amenity, shop or service space.',
  duplexLine:
    'A duplex needs a free unit spot directly above, in the same position.',
  floorAdded: 'Floor added.',
  basementAdded: 'Basement added.',
  spaceAdded: 'Unit spot added. No unit record created.',
  ground: 'Ground cannot be removed.',
  edgeFloor:
    'Only the top floor or the lowest basement can be removed, so floor numbers stay in order.',
  floorUnits: 'Move this floor’s units in Unit 360 first.',
  floorDuplex: 'Turn off the duplex on this floor first.',
  floorRemoved: 'Floor removed.',
  wholeBlocked:
    'Move this floor’s units and turn off duplexes before making it one whole space.',
  copyRange: 'Choose the first and last floor to copy to.',
  copyOther: 'Choose floors other than the one being copied.',
  copyBlocked:
    'A floor in that range has placed units or a duplex, so it cannot be overwritten.',
  copied: 'Layout copied to {count} floors. Units and duplexes are not copied.',
  placed: 'Unit {unit} is placed here. Move it in Unit 360 first.',
  duplexFirst: 'Turn off the duplex first.',
  moveBlocked:
    'Spots in line with a duplex cannot be moved. Turn off the duplex first.',
  oneSpace: 'A floor needs at least one space.',
  removeBlocked:
    'Removing this spot would shift a duplex out of line. Turn that duplex off first.',
  spaceRemoved: 'Spot removed.',
} as const;
export const BUILDING_LAYOUT_MESSAGES: readonly string[] = Object.values(TEXT);

export type Notice = {
  text: string;
  values?: Readonly<Record<string, string | number>>;
};
const notice = (text: string, values?: Notice['values']): Notice => ({
  text,
  values,
});

const id = z.uuid();
const placedUnit = z.object({ id, number: z.string() }).strict();
export const buildingLayoutSchema = z
  .object({
    buildings: z.array(z.object({ id, name: z.string() }).strict()),
    selected: id.nullable(),
    version: z.string().nullable(),
    floors: z.array(
      z
        .object({
          id,
          level: z.number().int(),
          label: z.string().nullable(),
          whole: z.boolean(),
          spaces: z.array(
            z
              .object({
                id,
                position: z.number().int(),
                kind: z.enum([...SPACE_KINDS, 'upper']),
                name: z.string().nullable(),
                duplex: z.boolean(),
                unit: placedUnit.nullable(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();
export type BuildingLayout = z.infer<typeof buildingLayoutSchema>;

export type LayoutSpace = {
  key: string;
  id: string | null;
  kind: Kind;
  name: string;
  duplex: boolean;
  unit: { id: string; number: string } | null;
};
// Floors are kept top floor first, matching how the building is drawn.
export type LayoutFloor = {
  key: string;
  level: number;
  label: string;
  whole: boolean;
  spaces: LayoutSpace[];
};
export type LayoutDraft = { name: string; floors: LayoutFloor[] };
export type EditResult =
  { draft: LayoutDraft; notice?: Notice } | { error: Notice };

let sequence = 0;
const newKey = () => `new-${(sequence += 1)}`;
const space = (kind: Kind, name = ''): LayoutSpace => ({
  key: newKey(),
  id: null,
  kind,
  name,
  duplex: false,
  unit: null,
});
const unitSpots = (count: number) =>
  Array.from({ length: count }, () => space('unit'));
const floorOf = (
  level: number,
  spaces: LayoutSpace[],
  whole = false,
): LayoutFloor => ({ key: newKey(), level, label: '', whole, spaces });
const wholeFloor = (level: number, use: WholeUse) =>
  floorOf(level, [space(use)], true);
const hasUnits = (floor: LayoutFloor) => floor.spaces.some(({ unit }) => unit);
const hasDuplex = (floor: LayoutFloor) =>
  floor.spaces.some(({ duplex, kind }) => duplex || kind === 'upper');
const clamp = (value: string, low: number, high: number) =>
  Math.min(high, Math.max(low, Math.trunc(Number(value)) || low));

export function draftFromLayout(
  name: string,
  floors: BuildingLayout['floors'],
): LayoutDraft {
  return {
    name,
    floors: floors.map((floor) => ({
      key: floor.id,
      level: floor.level,
      label: floor.label ?? '',
      whole: floor.whole,
      spaces: floor.spaces.map((item) => ({
        key: item.id,
        id: item.id,
        kind: item.kind,
        name: item.name ?? '',
        duplex: item.duplex,
        unit: item.unit,
      })),
    })),
  };
}

export function createDraft(setup: {
  name: string;
  floors: string;
  basements: string;
  spaces: string;
  ground: 'parking' | 'units' | 'shop';
}): LayoutDraft {
  const above = clamp(setup.floors, 0, MAX_FLOORS);
  const below = clamp(setup.basements, 0, MAX_BASEMENTS);
  const width = clamp(setup.spaces, 1, MAX_SPACES);
  return {
    name: setup.name.trim(),
    floors: [
      ...Array.from({ length: above }, (_, index) =>
        floorOf(above - index, unitSpots(width)),
      ),
      setup.ground === 'parking'
        ? wholeFloor(0, 'parking')
        : floorOf(
            0,
            setup.ground === 'shop'
              ? Array.from({ length: width }, () => space('shop'))
              : unitSpots(width),
          ),
      ...Array.from({ length: below }, (_, index) =>
        wholeFloor(-(index + 1), 'parking'),
      ),
    ],
  };
}

export function updateFloor(
  draft: LayoutDraft,
  floorKey: string,
  update: (floor: LayoutFloor) => LayoutFloor,
): LayoutDraft {
  return {
    ...draft,
    floors: draft.floors.map((floor) =>
      floor.key === floorKey ? update(floor) : floor,
    ),
  };
}

function locate(draft: LayoutDraft, floorKey: string, spaceKey?: string) {
  const floorIndex = draft.floors.findIndex(({ key }) => key === floorKey);
  const floor = draft.floors[floorIndex];
  const spaceIndex =
    floor?.spaces.findIndex(({ key }) => key === spaceKey) ?? -1;
  return {
    floorIndex,
    floor,
    spaceIndex,
    space: floor?.spaces[spaceIndex],
  };
}

export function columnsOf(floors: LayoutFloor[]) {
  return Math.max(
    1,
    ...floors.filter(({ whole }) => !whole).map(({ spaces }) => spaces.length),
  );
}

export function addFloor(draft: LayoutDraft, top: boolean): EditResult {
  const levels = draft.floors.map(({ level }) => level);
  if (top && levels.filter((level) => level > 0).length >= MAX_FLOORS)
    return { error: notice(TEXT.floorCount, { count: MAX_FLOORS }) };
  if (!top && levels.filter((level) => level < 0).length >= MAX_BASEMENTS)
    return { error: notice(TEXT.basementCount, { count: MAX_BASEMENTS }) };
  const edge = top ? draft.floors[0] : draft.floors.at(-1);
  const level = top
    ? Math.max(0, (edge?.level ?? -1) + 1)
    : Math.min(0, edge?.level ?? 1) - 1;
  const added = top
    ? floorOf(
        level,
        unitSpots(
          edge && !edge.whole ? edge.spaces.length : columnsOf(draft.floors),
        ),
      )
    : wholeFloor(level, 'parking');
  return {
    draft: {
      ...draft,
      floors: top ? [added, ...draft.floors] : [...draft.floors, added],
    },
    notice: notice(top ? TEXT.floorAdded : TEXT.basementAdded),
  };
}

export function addSpace(draft: LayoutDraft, floorKey: string): EditResult {
  const { floor } = locate(draft, floorKey);
  if (!floor || floor.whole) return { draft };
  if (floor.spaces.length >= MAX_SPACES)
    return { error: notice(TEXT.spaceCount, { count: MAX_SPACES }) };
  return {
    draft: updateFloor(draft, floorKey, (item) => ({
      ...item,
      spaces: [...item.spaces, space('unit')],
    })),
    notice: notice(TEXT.spaceAdded),
  };
}

export function removeFloor(draft: LayoutDraft, floorKey: string): EditResult {
  const { floor, floorIndex } = locate(draft, floorKey);
  if (!floor) return { draft };
  if (floor.level === 0) return { error: notice(TEXT.ground) };
  if (floorIndex !== 0 && floorIndex !== draft.floors.length - 1)
    return { error: notice(TEXT.edgeFloor) };
  if (hasUnits(floor)) return { error: notice(TEXT.floorUnits) };
  if (hasDuplex(floor)) return { error: notice(TEXT.floorDuplex) };
  return {
    draft: {
      ...draft,
      floors: draft.floors.filter(({ key }) => key !== floorKey),
    },
    notice: notice(TEXT.floorRemoved),
  };
}

export function setFloorUse(
  draft: LayoutDraft,
  floorKey: string,
  use: WholeUse | 'separate',
): EditResult {
  const { floor } = locate(draft, floorKey);
  if (!floor) return { draft };
  if (use !== 'separate' && (hasUnits(floor) || hasDuplex(floor)))
    return { error: notice(TEXT.wholeBlocked) };
  if (use === 'separate' && !floor.whole) return { draft };
  const current = floor.whole ? floor.spaces[0] : undefined;
  return {
    draft: updateFloor(draft, floorKey, (item) =>
      use === 'separate'
        ? { ...item, whole: false, spaces: unitSpots(3) }
        : {
            ...item,
            whole: true,
            spaces: [
              current?.kind === use
                ? current
                : {
                    ...(current ?? space(use)),
                    kind: use,
                    name: '',
                  },
            ],
          },
    ),
  };
}

export function copyFloor(
  draft: LayoutDraft,
  floorKey: string,
  from: string,
  to: string,
): EditResult {
  const { floor } = locate(draft, floorKey);
  if (!floor) return { draft };
  if (from === '' || to === '') return { error: notice(TEXT.copyRange) };
  const low = Math.min(Number(from), Number(to));
  const high = Math.max(Number(from), Number(to));
  const targets = draft.floors.filter(
    (item) => item.key !== floorKey && item.level >= low && item.level <= high,
  );
  if (targets.length === 0) return { error: notice(TEXT.copyOther) };
  if (targets.some((item) => hasUnits(item) || hasDuplex(item)))
    return { error: notice(TEXT.copyBlocked) };
  const keys = new Set(targets.map(({ key }) => key));
  return {
    draft: {
      ...draft,
      floors: draft.floors.map((item) =>
        keys.has(item.key)
          ? {
              ...item,
              whole: floor.whole,
              spaces: floor.spaces.map((source) =>
                space(
                  source.kind === 'upper' ? 'unit' : source.kind,
                  source.name,
                ),
              ),
            }
          : item,
      ),
    },
    notice: notice(TEXT.copied, { count: targets.length }),
  };
}

export function setSpaceKind(
  draft: LayoutDraft,
  floorKey: string,
  spaceKey: string,
  kind: SpaceKind,
): EditResult {
  const { space: target } = locate(draft, floorKey, spaceKey);
  if (!target || target.kind === kind) return { draft };
  if (target.unit)
    return { error: notice(TEXT.placed, { unit: target.unit.number }) };
  if (target.duplex || target.kind === 'upper')
    return { error: notice(TEXT.duplexFirst) };
  return {
    draft: updateFloor(draft, floorKey, (floor) => ({
      ...floor,
      spaces: floor.spaces.map((item) =>
        item.key === spaceKey
          ? {
              ...item,
              kind,
              name: kind === 'unit' || kind === 'gap' ? '' : item.name,
            }
          : item,
      ),
    })),
  };
}

export function toggleDuplex(
  draft: LayoutDraft,
  floorKey: string,
  spaceKey: string,
  on: boolean,
): EditResult {
  const {
    floorIndex,
    spaceIndex,
    space: target,
  } = locate(draft, floorKey, spaceKey);
  if (!target || target.kind !== 'unit' || target.duplex === on)
    return { draft };
  const above = draft.floors[floorIndex - 1];
  const upper = above?.spaces[spaceIndex];
  if (
    on &&
    (!above ||
      above.whole ||
      !upper ||
      upper.kind !== 'unit' ||
      upper.unit ||
      upper.duplex)
  )
    return { error: notice(TEXT.duplexLine) };
  return {
    draft: {
      ...draft,
      floors: draft.floors.map((floor, index) =>
        index === floorIndex || index === floorIndex - 1
          ? {
              ...floor,
              spaces: floor.spaces.map((item, position) =>
                position !== spaceIndex
                  ? item
                  : index === floorIndex
                    ? { ...item, duplex: on }
                    : { ...item, kind: on ? 'upper' : 'unit' },
              ),
            }
          : floor,
      ),
    },
  };
}

// Duplex halves are matched by position, so anything that shifts positions is blocked.
function shiftsDuplex(draft: LayoutDraft, floorIndex: number, from: number) {
  const floor = draft.floors[floorIndex];
  const below = draft.floors[floorIndex + 1];
  return Boolean(
    floor?.spaces
      .slice(from)
      .some(({ duplex, kind }) => duplex || kind === 'upper') ||
    below?.spaces.slice(from).some(({ duplex }) => duplex),
  );
}

export function moveSpace(
  draft: LayoutDraft,
  floorKey: string,
  spaceKey: string,
  step: -1 | 1,
): EditResult {
  const { floor, floorIndex, spaceIndex } = locate(draft, floorKey, spaceKey);
  const target = spaceIndex + step;
  if (!floor || spaceIndex < 0 || !floor.spaces[target]) return { draft };
  if (shiftsDuplex(draft, floorIndex, Math.min(spaceIndex, target)))
    return { error: notice(TEXT.moveBlocked) };
  return {
    draft: updateFloor(draft, floorKey, (item) => {
      const spaces = [...item.spaces];
      [spaces[spaceIndex], spaces[target]] = [
        spaces[target]!,
        spaces[spaceIndex]!,
      ];
      return { ...item, spaces };
    }),
  };
}

export function removeSpace(
  draft: LayoutDraft,
  floorKey: string,
  spaceKey: string,
): EditResult {
  const {
    floor,
    floorIndex,
    spaceIndex,
    space: target,
  } = locate(draft, floorKey, spaceKey);
  if (!floor || !target) return { draft };
  if (target.unit)
    return { error: notice(TEXT.placed, { unit: target.unit.number }) };
  if (floor.spaces.length === 1) return { error: notice(TEXT.oneSpace) };
  if (shiftsDuplex(draft, floorIndex, spaceIndex))
    return { error: notice(TEXT.removeBlocked) };
  return {
    draft: updateFloor(draft, floorKey, (item) => ({
      ...item,
      spaces: item.spaces.filter(({ key }) => key !== spaceKey),
    })),
    notice: notice(TEXT.spaceRemoved),
  };
}

const optionalText = (limit: number) =>
  z
    .string()
    .trim()
    .max(limit)
    .nullable()
    .transform((value) => value || null);
const payloadFloors = z
  .array(
    z
      .object({
        level: z.number().int().min(-MAX_BASEMENTS).max(MAX_FLOORS),
        label: optionalText(30),
        whole: z.boolean(),
        spaces: z
          .array(
            z
              .object({
                id: id.nullable(),
                kind: z.enum([...SPACE_KINDS, 'upper']),
                name: optionalText(40),
                duplex: z.boolean(),
              })
              .strict(),
          )
          .min(1)
          .max(MAX_SPACES),
      })
      .strict(),
  )
  .min(1)
  .max(MAX_FLOORS + MAX_BASEMENTS + 1);
type PayloadFloor = z.infer<typeof payloadFloors>[number];

// Mirrors the building_layout_save checks so admins see the actual rule before saving.
function floorsProblem(floors: readonly PayloadFloor[]): Notice | null {
  const levels = floors.map(({ level }) => level);
  if (
    !levels.includes(0) ||
    levels.some((level, index) => index > 0 && level !== levels[index - 1]! - 1)
  )
    return notice(TEXT.floors);
  for (const floor of floors) {
    if (floor.spaces.length < 1 || floor.spaces.length > MAX_SPACES)
      return notice(TEXT.spaceCount, { count: MAX_SPACES });
    if (
      floor.whole &&
      (floor.spaces.length !== 1 ||
        !(WHOLE_USES as readonly string[]).includes(floor.spaces[0]!.kind))
    )
      return notice(TEXT.whole);
  }
  const byLevel = new Map(floors.map((floor) => [floor.level, floor]));
  for (const floor of floors) {
    for (const [index, item] of floor.spaces.entries()) {
      const above = byLevel.get(floor.level + 1);
      const below = byLevel.get(floor.level - 1);
      if (
        (item.duplex &&
          (item.kind !== 'unit' ||
            !above ||
            above.whole ||
            above.spaces[index]?.kind !== 'upper')) ||
        (item.kind === 'upper' && !below?.spaces[index]?.duplex)
      )
        return notice(TEXT.duplexLine);
    }
  }
  return null;
}

export function toSavePayload(draft: LayoutDraft, version: string | null) {
  return {
    name: draft.name.trim(),
    version,
    floors: draft.floors.map((floor) => ({
      level: floor.level,
      label: floor.label.trim() || null,
      whole: floor.whole,
      spaces: floor.spaces.map((item) => ({
        id: item.id,
        kind: item.kind,
        name:
          item.kind === 'unit' || item.kind === 'upper' || item.kind === 'gap'
            ? null
            : item.name.trim() || null,
        duplex: item.duplex,
      })),
    })),
  };
}

export function layoutProblem(draft: LayoutDraft): Notice | null {
  const name = draft.name.trim();
  if (name.length < 1 || name.length > 60) return notice(TEXT.name);
  const payload = toSavePayload(draft, null);
  if (payload.floors.filter(({ level }) => level > 0).length > MAX_FLOORS)
    return notice(TEXT.floorCount, { count: MAX_FLOORS });
  if (payload.floors.filter(({ level }) => level < 0).length > MAX_BASEMENTS)
    return notice(TEXT.basementCount, { count: MAX_BASEMENTS });
  return floorsProblem(payload.floors);
}

export const buildingLayoutInput = z
  .object({
    name: z.string().trim().min(1, TEXT.name).max(60, TEXT.name),
    version: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .nullable(),
    floors: payloadFloors,
  })
  .strict()
  .superRefine(({ floors }, ctx) => {
    const problem = floorsProblem(floors);
    if (problem)
      ctx.addIssue({
        code: 'custom',
        // Server-side messages stay template-free so translateFeedback can match them.
        message: problem.values ? TEXT.floors : problem.text,
      });
  });

export const buildingPlacementInput = z
  .object({
    blockId: id,
    spaceId: id.nullable(),
    version: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .nullable(),
  })
  .strict();
