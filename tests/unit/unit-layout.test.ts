// Verify the admin layout uses only active units and recorded floors.
import { describe, expect, it } from 'vitest';
import { groupUnitLayout } from '../../src/core/structure/unit-layout';

describe('groupUnitLayout', () => {
  it('keeps negative, ground, irregular and unknown floors distinct', () => {
    const make = (
      number: string,
      floor: number | null,
      block_id: string | null = 'a',
      active = true,
    ) => ({ id: number, number, floor, block_id, active });
    const layout = groupUnitLayout(
      [{ id: 'a', name: 'Wing A' }],
      [
        make('1201', 12),
        make('G12', 0),
        make('G2', 0),
        make('B1', -1),
        make('777', null),
        make('501', 5, null),
        make('801', 8, 'a', false),
      ],
      'en',
    );
    expect(
      layout.map(({ name, floors }) => ({
        name,
        floors: floors.map(({ floor, units }) => [
          floor,
          units.map(({ number }) => number),
        ]),
      })),
    ).toEqual([
      {
        name: 'Wing A',
        floors: [
          [-1, ['B1']],
          [0, ['G2', 'G12']],
          [12, ['1201']],
          [null, ['777']],
        ],
      },
      { name: null, floors: [[5, ['501']]] },
    ]);
  });
});
