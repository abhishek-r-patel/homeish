// Build synthetic building layouts for local fixtures; no real society data.
import type { BuildingLayout } from '@/core/structure/building-layout';

export const FIXTURE_UNIT_ID = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const buildings = [
  { id: 'a1000000-0000-4000-8000-000000000001', name: 'Tower A' },
  { id: 'a1000000-0000-4000-8000-000000000002', name: 'Shopping arcade' },
];
const hex = (value: number) => value.toString(16).padStart(12, '0');

function towerFloors(): BuildingLayout['floors'] {
  const floors: BuildingLayout['floors'] = [];
  let serial = 0;
  const spaceId = () => `b2000000-0000-4000-8000-${hex(++serial)}`;
  for (let level = 4; level >= -1; level--) {
    const floorId = `f3000000-0000-4000-8000-${hex(level + 10)}`;
    if (level <= 0) {
      floors.push({
        id: floorId,
        level,
        label: null,
        whole: true,
        spaces: [
          {
            id: spaceId(),
            position: 1,
            kind: level === 0 ? 'parking' : 'service',
            name: level === 0 ? 'Stilt parking' : 'Pump room',
            duplex: false,
            unit: null,
          },
        ],
      });
      continue;
    }
    floors.push({
      id: floorId,
      level,
      label: level === 4 ? 'Refuge floor' : null,
      whole: false,
      spaces: [1, 2, 3].map((position) => ({
        id: spaceId(),
        position,
        kind: level === 2 && position === 3 ? 'amenity' : 'unit',
        name: level === 2 && position === 3 ? 'Gym' : null,
        duplex: false,
        unit:
          level === 1 && position === 1
            ? { id: FIXTURE_UNIT_ID, number: '101' }
            : level === 3 && position === 2
              ? { id: 'c0d55fc3-0751-4b79-86c1-000000000302', number: '302' }
              : null,
      })),
    });
  }
  return floors;
}

export function fixtureLayout(
  building: unknown,
  empty = false,
): BuildingLayout {
  const selected =
    buildings.find(({ id }) => id === building)?.id ?? buildings[0]!.id;
  return {
    buildings: empty ? [] : buildings,
    selected: empty ? null : selected,
    version: '123456789012345678901234567890ab',
    floors: empty || selected !== buildings[0]!.id ? [] : towerFloors(),
  };
}
