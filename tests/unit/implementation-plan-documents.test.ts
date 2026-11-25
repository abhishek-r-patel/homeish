import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PLAN = readFileSync(
  new URL('../../docs/IMPLEMENTATION_PLAN.md', import.meta.url),
  'utf8',
);
const PRD = readFileSync(new URL('../../docs/PRD.md', import.meta.url), 'utf8');

function decisionIds(prd: string): Set<string> {
  const ids = new Set<string>();
  const definitionPatterns = [
    /^\|\s*(?:<a id="d-(\d+)"><\/a>)?D-(\d+)\s*\|/gm,
    /^\*\*(?:<a id="d-(\d+)"><\/a>)?D-(\d+)\s+—/gm,
  ];

  for (const pattern of definitionPatterns) {
    for (const match of prd.matchAll(pattern)) {
      ids.add(match[2]);
    }
  }
  return ids;
}

function replacementErrors(prd: string): string[] {
  const definitions = new Map<string, string>();
  const lines = prd.split('\n');

  for (const line of lines) {
    const tableDecision = line.match(
      /^\|\s*(?:<a id="d-(\d+)"><\/a>)?D-(\d+)\s*\|/,
    );
    const proseDecision = line.match(
      /^\*\*(?:<a id="d-(\d+)"><\/a>)?D-(\d+)\s+—/,
    );
    const decision = tableDecision ?? proseDecision;
    if (decision) definitions.set(decision[2], line);
  }

  const errors: string[] = [];
  for (const [newId, line] of definitions) {
    const replaced = line.match(
      /\*\*Replaces:\*\*\s*\[D-(\d+):[^\]]+\]\(#d-\1\)/,
    );
    if (!replaced) continue;

    const oldId = replaced[1];
    if (!definitions.has(oldId)) {
      errors.push(`${newId} replaces missing decision ${oldId}`);
      continue;
    }
    const backlink = new RegExp(
      `\\*\\*Replaced(?: in part)? by:\\*\\*\\s*\\[D-${newId}:[^\\]]+\\]\\(#d-${newId}\\)`,
    );
    if (!backlink.test(definitions.get(oldId) ?? '')) {
      errors.push(`${oldId} does not link back to replacement ${newId}`);
    }
  }
  return errors;
}

function cellsForPhase(plan: string, phaseId: string): string[] {
  const row = plan
    .split('\n')
    .find((line) => line.startsWith(`| [${phaseId}](`));
  if (!row) throw new Error(`Missing overview row for ${phaseId}`);
  return row
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

describe('implementation plan documentation', () => {
  it('references decision IDs that exist in the PRD decision register', () => {
    const knownIds = decisionIds(PRD);
    const referencedIds = new Set(
      [...PLAN.matchAll(/\bD-(\d+)\b/g)].map((match) => match[1]),
    );
    const missingIds = [...referencedIds].filter((id) => !knownIds.has(id));

    expect(missingIds).toEqual([]);
  });

  it('uses valid decision anchors for descriptive PRD links', () => {
    const anchors = new Set(
      [...PRD.matchAll(/<a id="d-(\d+)"><\/a>/g)].map((match) => match[1]),
    );
    const linkedIds = [
      ...PLAN.matchAll(/\[D-(\d+):[^\]]+\]\(\.\/PRD\.md#d-(\d+)\)/g),
    ];

    expect(linkedIds.length).toBeGreaterThan(0);
    for (const [, labelId, targetId] of linkedIds) {
      expect(labelId).toBe(targetId);
      expect(anchors.has(targetId)).toBe(true);
    }
  });

  it('keeps new decision replacements linked from both decisions', () => {
    const oldDecision =
      '| <a id="d-61"></a>D-61 | Meetings and AGM | **Replaced in part by:** [D-99: Updated meeting attendance rules](#d-99) — attendance only. |';
    const newDecision =
      '**<a id="d-99"></a>D-99 — Updated meeting attendance rules. **Replaces:** [D-61: Meetings and AGM](#d-61) — attendance only.';

    expect(replacementErrors(`${oldDecision}\n${newDecision}`)).toEqual([]);
    expect(
      replacementErrors(
        `${oldDecision.replace('D-99:', 'D-98:')}\n${newDecision}`,
      ),
    ).toEqual(['61 does not link back to replacement 99']);
  });

  it('shows P44 beta status separately from its blocked and deferred exceptions', () => {
    const status = cellsForPhase(PLAN, 'P44')[8];

    expect(status.split('<br>')).toEqual([
      '🟠 On Beta/TestDB',
      '🚧 Rule publication: legal review',
      '💤 Deferred: [P44.4](#p44-4)/[P44.7](#p44-7) (Pro)',
    ]);
  });

  it('keeps other deferred and blocked phase exceptions visible', () => {
    expect(cellsForPhase(PLAN, 'P36')[8]).toContain(
      '💤 Deferred: [P36.6](#p36-6)/[P36.8](#p36-8)',
    );
    expect(cellsForPhase(PLAN, 'P51')[8]).toContain('🚧 Legal review pending');
    expect(cellsForPhase(PLAN, 'P57')[8]).toContain(
      '🚧 Blocked: [P57.6](#p57-6) until demo setup [P61.7](#p61-7)',
    );
  });

  it('links P44 requirements and prerequisites to their source sections', () => {
    const cells = cellsForPhase(PLAN, 'P44');
    const requirementCell = cells[3];
    const buildsOnCell = cells[6];
    const planAnchors = new Set(
      [...PLAN.matchAll(/<a id="([^"]+)"><\/a>/g)].map((match) => match[1]),
    );
    const prerequisiteIds = [
      ...buildsOnCell.matchAll(/\b(P\d+(?:\.\d+)?)\b/g),
    ].map((match) => match[1]);
    const linkedPrerequisiteIds = [
      ...buildsOnCell.matchAll(
        /\[(P\d+(?:\.\d+)?)(?![A-Za-z0-9])[^\]]*\]\(#p\d+(?:-[^)]*)?\)/g,
      ),
    ].map((match) => match[1]);

    expect(requirementCell).toContain('[DOC-5–DOC-9](./PRD.md#prd-document)');
    expect(PRD).toContain('<a id="prd-document"></a>');
    expect(linkedPrerequisiteIds).toEqual(prerequisiteIds);
    for (const [, anchor] of buildsOnCell.matchAll(/\]\(#([^)]*)\)/g)) {
      expect(planAnchors.has(anchor)).toBe(true);
    }
  });

  it('links requirements and prerequisites for every later phase', () => {
    const planAnchors = new Set(
      [...PLAN.matchAll(/<a id="([^"]+)"><\/a>/g)].map((match) => match[1]),
    );
    const prdAnchors = new Set(
      [...PRD.matchAll(/<a id="([^"]+)"><\/a>/g)].map((match) => match[1]),
    );

    for (let number = 35; number <= 61; number += 1) {
      const phase = `P${number}`;
      const cells = cellsForPhase(PLAN, phase);
      const requirementCell = cells[3];
      const buildsOnCell = cells[6];
      const status = cells[8];

      expect(requirementCell, `${phase} requirements`).toMatch(
        /\]\(\.\/PRD\.md#/,
      );
      expect(buildsOnCell, `${phase} prerequisites`).toMatch(/\]\(#p/);
      expect(status.split('<br>')[0], `${phase} status`).toMatch(
        /^(🔵 In Progress|🟠 On Beta\/TestDB|🟡 Verified Locally|⬜ Planned)$/,
      );

      for (const [, anchor] of requirementCell.matchAll(
        /\]\(\.\/PRD\.md#([^)]*)\)/g,
      )) {
        expect(prdAnchors.has(anchor), `${phase} PRD anchor ${anchor}`).toBe(
          true,
        );
      }

      for (const [, anchor] of buildsOnCell.matchAll(/\]\(#([^)]*)\)/g)) {
        expect(planAnchors.has(anchor), `${phase} prerequisite ${anchor}`).toBe(
          true,
        );
      }

      const prerequisiteIds = [
        ...buildsOnCell.matchAll(/\b(P\d+(?:\.\d+)?)\b/g),
      ].map((match) => match[1]);
      const linkedPrerequisiteIds = [
        ...buildsOnCell.matchAll(
          /\[(P\d+(?:\.\d+)?)(?![A-Za-z0-9])[^\]]*\]\(#p\d+(?:-[^)]*)?\)/g,
        ),
      ].map((match) => match[1]);
      expect(linkedPrerequisiteIds, `${phase} linked prerequisite IDs`).toEqual(
        prerequisiteIds,
      );
    }
  });

  it('replaces date-only kickoff approvals with named decision links', () => {
    for (const [phase, decision] of [
      ['P22', 'D-60'],
      ['P23', 'D-61'],
      ['P24', 'D-54'],
      ['P25', 'D-55'],
      ['P26', 'D-56'],
      ['P27', 'D-62'],
    ]) {
      const section = PLAN.split(`<a id="${phase.toLowerCase()}"></a>`)[1];
      expect(section).toContain(`[${decision}:`);
      expect(section).not.toMatch(
        /Kickoff decisions:\*\* approved \d{4}-\d{2}-\d{2}/,
      );
    }
  });
});
