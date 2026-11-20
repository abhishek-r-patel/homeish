// Group active units by recorded block and floor without inferring placement.
type LayoutUnit = {
  id: string;
  block_id: string | null;
  floor: number | null;
  number: string;
  active: boolean;
};

export function groupUnitLayout(
  blocks: readonly { id: string; name: string }[],
  units: readonly LayoutUnit[],
  locale: string,
) {
  const grouped = new Map<string | null, Map<number | null, LayoutUnit[]>>();
  for (const unit of units) {
    if (!unit.active) continue;
    const floors = grouped.get(unit.block_id) ?? new Map();
    const floorUnits = floors.get(unit.floor) ?? [];
    floorUnits.push(unit);
    floors.set(unit.floor, floorUnits);
    grouped.set(unit.block_id, floors);
  }
  const names = new Map(blocks.map(({ id, name }) => [id, name]));
  const order = new Intl.Collator(locale, { numeric: true });
  return [...grouped]
    .map(([id, floors]) => ({
      id,
      name: id === null ? null : (names.get(id) ?? null),
      floors: [...floors]
        .sort(([a], [b]) =>
          a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b,
        )
        .map(([floor, members]) => ({
          floor,
          units: members.sort((a, b) => order.compare(a.number, b.number)),
        })),
    }))
    .sort((a, b) =>
      a.name === b.name
        ? 0
        : a.name === null
          ? 1
          : b.name === null
            ? -1
            : order.compare(a.name, b.name),
    );
}
