// Keep the PRD §8.2 full permission map in step with the module registry.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { MODULE_KEYS, MODULE_REGISTRY } from '../../src/core/modules';
import { SOCIETY_ROLES } from '../../src/core/permissions';

const PRD = new URL('../../docs/PRD.md', import.meta.url);
const START = '<!-- permission-map:start -->';
const END = '<!-- permission-map:end -->';

function generatedRows(): string[][] {
  const rows: string[][] = [];
  for (const moduleKey of MODULE_KEYS) {
    for (const [permission, roles] of Object.entries(
      MODULE_REGISTRY[moduleKey].permissions,
    )) {
      rows.push([
        `\`${moduleKey}\``,
        `\`${permission}\``,
        ...SOCIETY_ROLES.map((role) => (roles.includes(role) ? '✓' : '–')),
      ]);
    }
  }
  return rows;
}

function renderTable(rows: string[][]): string {
  const header = [
    'Module',
    'Permission',
    'Admin',
    'Committee',
    'Guard',
    'HK supervisor',
    'Resident',
  ];
  return [header, header.map(() => '---'), ...rows]
    .map((cells) => `| ${cells.join(' | ')} |`)
    .join('\n');
}

// Prettier pads table cells, so compare trimmed cells and skip the divider.
function parseRows(block: string): string[][] {
  return block
    .split('\n')
    .filter((line) => line.startsWith('|') && !/^\|[\s|:-]+\|$/.test(line))
    .slice(1)
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
}

it('documents every module permission and role exactly as the registry grants it', () => {
  const prd = readFileSync(PRD, 'utf8');
  const start = prd.indexOf(START);
  const end = prd.indexOf(END);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const rows = generatedRows();
  if (process.env.UPDATE_PERMISSION_DOCS === '1') {
    writeFileSync(
      PRD,
      `${prd.slice(0, start + START.length)}\n\n${renderTable(rows)}\n\n${prd.slice(end)}`,
    );
    return;
  }
  expect(
    parseRows(prd.slice(start + START.length, end)),
    'PRD §8.2 permission map is out of date; run UPDATE_PERMISSION_DOCS=1 npm run test -- tests/unit/permission-docs.test.ts',
  ).toEqual(rows);
});
