// Verify building layout edit rules and that their messages are translated.
import { describe, expect, it } from 'vitest';
import { translateMessage } from '../../src/core/i18n/messages';
import {
  BUILDING_LAYOUT_MESSAGES,
  KIND_NAMES,
  MAX_BASEMENTS,
  addFloor,
  buildingLayoutInput,
  copyFloor,
  createDraft,
  layoutProblem,
  removeFloor,
  removeSpace,
  setFloorUse,
  setSpaceKind,
  toSavePayload,
  toggleDuplex,
  type EditResult,
  type LayoutDraft,
} from '../../src/core/structure/building-layout';

const draftOf = (result: EditResult) => {
  if ('error' in result) throw new Error(result.error.text);
  return result.draft;
};
const errorOf = (result: EditResult) =>
  'error' in result ? result.error.text : null;

function tower(): LayoutDraft {
  return createDraft({
    name: ' Tower A ',
    floors: '3',
    basements: '1',
    spaces: '2',
    ground: 'parking',
  });
}

function withUnit(draft: LayoutDraft, level: number, position: number) {
  return {
    ...draft,
    floors: draft.floors.map((floor) =>
      floor.level !== level
        ? floor
        : {
            ...floor,
            spaces: floor.spaces.map((space, index) =>
              index === position
                ? { ...space, unit: { id: 'unit-1', number: '101' } }
                : space,
            ),
          },
    ),
  };
}

describe('building layout drafts', () => {
  it('creates a regular building top floor first that the server accepts', () => {
    const draft = tower();
    expect(draft.floors.map(({ level }) => level)).toEqual([3, 2, 1, 0, -1]);
    expect(draft.floors[3]).toMatchObject({ whole: true });
    expect(layoutProblem(draft)).toBeNull();
    const parsed = buildingLayoutInput.parse(toSavePayload(draft, null));
    expect(parsed.name).toBe('Tower A');
  });

  it('leaves new non-unit spaces unnamed so the translated type shows', () => {
    const base = tower();
    const draft = draftOf(setFloorUse(base, base.floors[0]!.key, 'shop'));
    const shop = createDraft({
      name: 'Arcade',
      floors: '0',
      basements: '0',
      spaces: '2',
      ground: 'shop',
    });
    const names = [...tower().floors, ...shop.floors]
      .filter(({ level }) => level <= 0)
      .flatMap(({ spaces }) => spaces.map(({ name }) => name));
    expect(names).toEqual(['', '', '', '']);
    expect(draft.floors[0]!.spaces[0]).toMatchObject({
      kind: 'shop',
      name: '',
    });
    expect(
      toSavePayload(tower(), null).floors.flatMap(({ spaces }) =>
        spaces.map(({ name }) => name),
      ),
    ).not.toContain('');
  });

  it('adds floors on top with the top floor width and caps basements', () => {
    const added = draftOf(addFloor(tower(), true));
    expect(added.floors[0]).toMatchObject({ level: 4, whole: false });
    expect(added.floors[0]!.spaces).toHaveLength(2);
    let draft = tower();
    for (let count = 1; count < MAX_BASEMENTS; count++)
      draft = draftOf(addFloor(draft, false));
    expect(errorOf(addFloor(draft, false))).toBe(
      'A building can have up to {count} basements.',
    );
  });

  it('only removes empty edge floors other than Ground', () => {
    const draft = tower();
    const key = (level: number) =>
      draft.floors.find((floor) => floor.level === level)!.key;
    expect(errorOf(removeFloor(draft, key(0)))).toBe(
      'Ground cannot be removed.',
    );
    expect(errorOf(removeFloor(draft, key(2)))).toMatch(/^Only the top floor/);
    expect(errorOf(removeFloor(withUnit(draft, 3, 0), key(3)))).toBe(
      'Move this floor’s units in Unit 360 first.',
    );
    expect(draftOf(removeFloor(draft, key(3))).floors[0]!.level).toBe(2);
  });

  it('protects placed units from kind changes, whole-floor use and copies', () => {
    const draft = withUnit(tower(), 2, 0);
    const floor2 = draft.floors.find(({ level }) => level === 2)!;
    const floor1 = draft.floors.find(({ level }) => level === 1)!;
    expect(
      errorOf(setSpaceKind(draft, floor2.key, floor2.spaces[0]!.key, 'shop')),
    ).toBe('Unit {unit} is placed here. Move it in Unit 360 first.');
    expect(errorOf(setFloorUse(draft, floor2.key, 'parking'))).toMatch(
      /^Move this floor’s units/,
    );
    expect(errorOf(copyFloor(draft, floor1.key, '2', '3'))).toMatch(
      /has placed units or a duplex/,
    );
  });

  it('keeps duplex halves in line and valid for saving', () => {
    const draft = tower();
    const floor1 = draft.floors.find(({ level }) => level === 1)!;
    const top = draft.floors.find(({ level }) => level === 3)!;
    expect(
      errorOf(toggleDuplex(draft, top.key, top.spaces[0]!.key, true)),
    ).toBe(
      'A duplex needs a free unit spot directly above, in the same position.',
    );
    const duplex = draftOf(
      toggleDuplex(draft, floor1.key, floor1.spaces[0]!.key, true),
    );
    expect(
      duplex.floors.find(({ level }) => level === 2)!.spaces[0]!.kind,
    ).toBe('upper');
    expect(layoutProblem(duplex)).toBeNull();
    expect(
      errorOf(removeSpace(duplex, floor1.key, floor1.spaces[0]!.key)),
    ).toMatch(/^Removing this spot would shift a duplex/);
  });

  it('rejects a layout whose floors skip a level', () => {
    const draft = tower();
    const broken = {
      ...draft,
      floors: draft.floors.filter(({ level }) => level !== 2),
    };
    expect(layoutProblem(broken)?.text).toBe(
      'Floors must run without gaps and include Ground.',
    );
    expect(
      buildingLayoutInput.safeParse(toSavePayload(broken, null)).success,
    ).toBe(false);
  });

  it('has Hindi text for every rule message and space type', () => {
    for (const message of [
      ...BUILDING_LAYOUT_MESSAGES,
      ...Object.values(KIND_NAMES),
    ]) {
      expect(() =>
        translateMessage('hi', message, { count: 1, unit: '101' }),
      ).not.toThrow();
    }
  });
});
