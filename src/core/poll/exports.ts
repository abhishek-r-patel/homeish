// Render completed poll snapshots as protected CSV and paginated A4 PDF files.
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import { ValidationError } from '../errors';
import { toCsv } from '../csv/serialize';
import { projectPollResults } from './results';
import type { PollExport, PollResults } from './validation';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const BOTTOM = 42;
const LINE_GAP = 5;

export function pollExportFileName(
  voteId: string,
  format: 'csv' | 'pdf',
): string {
  return `homeish-poll-${voteId}.${format}`;
}

function percentage(value: number | null) {
  return value === null ? 'Not available' : `${value.toFixed(1)}%`;
}

function formatIst(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function pollResultSnapshot(exportData: PollExport): PollResults {
  return {
    voteId: exportData.vote.id,
    votingType: exportData.vote.votingType,
    status: 'completed',
    selectionMode: exportData.vote.selectionMode,
    eligible: exportData.eligible,
    submitted: exportData.submitted,
    options: exportData.options,
    offices: exportData.offices,
    responses: exportData.responses,
  };
}

export function pollExportCsv(exportData: PollExport): string {
  const projection = projectPollResults(pollResultSnapshot(exportData));
  type CsvValue = string | number | null;
  const rows: CsvValue[][] = [];
  const addRow = (
    section: CsvValue,
    item: CsvValue = null,
    count: CsvValue = null,
    submittedShare: CsvValue = null,
    eligibleShare: CsvValue = null,
    unit: CsvValue = null,
    representative: CsvValue = null,
    choices: CsvValue = null,
  ) => {
    rows.push([
      section,
      item,
      count,
      submittedShare,
      eligibleShare,
      unit,
      representative,
      choices,
    ]);
  };
  addRow('Report', exportData.vote.title);
  addRow('Society', exportData.societyName);
  addRow('Voting type', exportData.vote.votingType);
  addRow('Opening (Asia/Kolkata)', formatIst(exportData.vote.opensAt));
  addRow('Closing (Asia/Kolkata)', formatIst(exportData.vote.closesAt));
  addRow('Completed (Asia/Kolkata)', formatIst(exportData.vote.completedAt));
  addRow('Completion mode', exportData.vote.completionMode);
  addRow('Eligible units', exportData.eligible);
  addRow('Submitted units', exportData.submitted);
  addRow('Turnout', percentage(projection.turnoutPercent));

  if (projection.votingType === 'public') {
    addRow('Section', 'Option totals');
    addRow(
      'Column',
      'Option',
      'Selections',
      'Submitted share',
      'Eligible share',
    );
    for (const option of projection.options) {
      addRow(
        'Option',
        option.label,
        option.count,
        percentage(option.submittedPercent),
        percentage(option.eligiblePercent),
      );
    }
    addRow('Outcome', projection.outcome.kind);
    if (projection.outcome.kind === 'winner')
      addRow('Winner', projection.outcome.label);
    if (projection.outcome.kind === 'tie')
      addRow('Tied leaders', projection.outcome.labels.join('; '));
    addRow('Section', 'Named responses');
    addRow(
      'Column',
      'Named response',
      null,
      null,
      null,
      'Unit',
      'Representative',
      'Selections',
    );
    const optionLabels = new Map(
      (exportData.options ?? []).map(({ id, label }) => [id, label]),
    );
    for (const response of exportData.responses ?? []) {
      addRow(
        'Response',
        null,
        null,
        null,
        null,
        response.unitLabel,
        response.representativeName,
        response.optionIds
          .map((optionId) => optionLabels.get(optionId))
          .filter((label): label is string => label !== undefined)
          .join('; '),
      );
    }
    if (exportData.responses === null)
      addRow('Named responses', 'No longer retained');
  } else {
    addRow('Section', 'Election results');
    addRow(
      'Column',
      'Office and candidate',
      'Selections',
      'Submitted share',
      'Eligible share',
    );
    for (const office of projection.offices) {
      for (const candidate of office.candidates) {
        addRow(
          'Candidate',
          `${office.name}: ${candidate.name}`,
          candidate.count,
          percentage(candidate.submittedPercent),
          percentage(candidate.eligiblePercent),
        );
      }
      addRow(
        'Candidate',
        `${office.name}: None of the above`,
        office.notaCount,
        percentage(office.notaSubmittedPercent),
        percentage(office.notaEligiblePercent),
      );
      addRow(`Outcome: ${office.name}`, office.outcome.kind);
      if (office.outcome.kind === 'winner')
        addRow(`Winner: ${office.name}`, office.outcome.name);
      if (office.outcome.kind === 'tie')
        addRow(`Tied leaders: ${office.name}`, office.outcome.names.join('; '));
    }
    addRow('Section', 'Separate submitted-voter roster');
    addRow(
      'Column',
      'Submitted voter',
      null,
      null,
      null,
      'Unit',
      'Representative',
    );
    for (const voter of exportData.roster ?? []) {
      addRow(
        'Voter',
        null,
        null,
        null,
        null,
        voter.unitLabel,
        voter.representativeName,
      );
    }
    if (exportData.roster === null)
      addRow('Voter roster', 'No longer retained');
  }
  return `\uFEFF${toCsv(
    [
      'Section',
      'Item',
      'Count',
      'Submitted share',
      'Eligible share',
      'Unit',
      'Representative',
      'Choices',
    ],
    rows,
  )}`;
}

type PdfWriter = {
  document: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
};

function assertSupportedText(text: string, font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  if (
    [...text].some((character) => !supported.has(character.codePointAt(0)!))
  ) {
    throw new ValidationError({
      export:
        'This report contains text the PDF format cannot display. Use the CSV export instead.',
    });
  }
}

function nextPage(writer: PdfWriter) {
  writer.page = writer.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  writer.y = PAGE_HEIGHT - MARGIN;
}

function splitLongWord(
  word: string,
  font: PDFFont,
  size: number,
  width: number,
) {
  const parts: string[] = [];
  let part = '';
  for (const character of word) {
    const next = part + character;
    if (part && font.widthOfTextAtSize(next, size) > width) {
      parts.push(part);
      part = character;
    } else {
      part = next;
    }
  }
  if (part) parts.push(part);
  return parts;
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const rawWord of paragraph.split(/\s+/).filter(Boolean)) {
      const words =
        font.widthOfTextAtSize(rawWord, size) > width
          ? splitLongWord(rawWord, font, size, width)
          : [rawWord];
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(next, size) > width) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
    }
    lines.push(line);
  }
  return lines;
}

function writeText(
  writer: PdfWriter,
  text: string,
  options: { bold?: boolean; size?: number; indent?: number } = {},
) {
  const size = options.size ?? 10;
  const font = options.bold ? writer.bold : writer.regular;
  const indent = options.indent ?? 0;
  const width = PAGE_WIDTH - MARGIN * 2 - indent;
  const lineHeight = size + LINE_GAP;
  for (const line of wrapText(text, font, size, width)) {
    if (writer.y - lineHeight < BOTTOM) nextPage(writer);
    writer.page.drawText(line, {
      x: MARGIN + indent,
      y: writer.y,
      size,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    writer.y -= lineHeight;
  }
}

function writeSection(writer: PdfWriter, title: string) {
  writer.y -= LINE_GAP;
  writeText(writer, title, { bold: true, size: 12 });
}

function formatOutcome(
  outcome:
    | { kind: 'no_votes' }
    | { kind: 'no_winner' }
    | { kind: 'tie'; labels: string[] }
    | { kind: 'tie'; names: string[] }
    | { kind: 'winner'; label: string }
    | { kind: 'winner'; name: string },
) {
  if (outcome.kind === 'no_votes') return 'No votes were submitted.';
  if (outcome.kind === 'no_winner')
    return 'No candidate received a vote. None of the above does not win.';
  if (outcome.kind === 'tie')
    return `Tie: ${'labels' in outcome ? outcome.labels.join(', ') : outcome.names.join(', ')}`;
  return `Winner: ${'label' in outcome ? outcome.label : outcome.name}`;
}

export async function pollExportPdf(
  exportData: PollExport,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(exportData.vote.title);
  document.setProducer('Homeish');
  document.setCreator('Homeish');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const projection = projectPollResults(pollResultSnapshot(exportData));

  const text = [
    exportData.societyName,
    exportData.vote.title,
    exportData.vote.votingType,
    exportData.vote.opensAt ?? '',
    exportData.vote.closesAt ?? '',
    exportData.vote.completedAt ?? '',
    exportData.vote.completionMode ?? '',
    ...(projection.votingType === 'public'
      ? [
          ...projection.options.map(({ label }) => label),
          ...(exportData.responses ?? []).flatMap((response) => [
            response.unitLabel,
            response.representativeName,
            ...response.optionIds.map(
              (id) =>
                exportData.options?.find((option) => option.id === id)?.label ??
                '',
            ),
          ]),
        ]
      : projection.offices.flatMap((office) => [
          office.name,
          ...office.candidates.map(({ name }) => name),
          ...(exportData.roster ?? []).flatMap(
            ({ unitLabel, representativeName }) => [
              unitLabel,
              representativeName,
            ],
          ),
        ])),
  ];
  for (const value of text) assertSupportedText(value, regular);

  const writer: PdfWriter = {
    document,
    page: document.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    regular,
    bold,
    y: PAGE_HEIGHT - MARGIN,
  };
  writeText(writer, exportData.societyName, { bold: true, size: 16 });
  writeText(writer, exportData.vote.title, { bold: true, size: 13 });
  writeText(
    writer,
    `${exportData.vote.votingType === 'public' ? 'Public poll' : 'Private election'} · Completed ${formatIst(exportData.vote.completedAt) ?? 'date unavailable'} (Asia/Kolkata)`,
  );
  writeText(
    writer,
    `Opening: ${formatIst(exportData.vote.opensAt) ?? 'Not scheduled'} · Closing: ${formatIst(exportData.vote.closesAt) ?? 'Not available'} (Asia/Kolkata)`,
  );
  writeSection(writer, 'Participation');
  writeText(writer, `Eligible units: ${exportData.eligible}`);
  writeText(writer, `Submitted ballots: ${exportData.submitted}`);
  writeText(writer, `Turnout: ${percentage(projection.turnoutPercent)}`);

  if (projection.votingType === 'public') {
    writeSection(writer, 'Option totals');
    for (const option of projection.options) {
      writeText(
        writer,
        `${option.label}: ${option.count} selections · ${percentage(option.submittedPercent)} of submitted · ${percentage(option.eligiblePercent)} of eligible`,
        { indent: 8 },
      );
    }
    writeText(writer, formatOutcome(projection.outcome), { bold: true });
    writeSection(writer, 'Named responses');
    const labels = new Map(
      (exportData.options ?? []).map(({ id, label }) => [id, label]),
    );
    for (const response of exportData.responses ?? []) {
      const choices = response.optionIds
        .map((id) => labels.get(id))
        .filter((label): label is string => label !== undefined);
      writeText(
        writer,
        `${response.unitLabel} · ${response.representativeName} · ${choices.join(', ')}`,
        { indent: 8 },
      );
    }
    if (exportData.responses === null)
      writeText(writer, 'Named responses are no longer retained.');
  } else {
    writeSection(writer, 'Election results');
    for (const office of projection.offices) {
      writeText(writer, office.name, { bold: true });
      for (const candidate of office.candidates) {
        writeText(
          writer,
          `${candidate.name}: ${candidate.count} · ${percentage(candidate.submittedPercent)} of submitted · ${percentage(candidate.eligiblePercent)} of eligible`,
          { indent: 8 },
        );
      }
      writeText(
        writer,
        `None of the above: ${office.notaCount} · ${percentage(office.notaSubmittedPercent)} of submitted · ${percentage(office.notaEligiblePercent)} of eligible`,
        { indent: 8 },
      );
      writeText(writer, formatOutcome(office.outcome), { bold: true });
    }
    nextPage(writer);
    writeSection(writer, 'Submitted-voter roster');
    writeText(
      writer,
      'This roster is separate from results and contains no choices or submission times.',
    );
    for (const voter of exportData.roster ?? []) {
      writeText(writer, `${voter.unitLabel} · ${voter.representativeName}`, {
        indent: 8,
      });
    }
    if (exportData.roster === null)
      writeText(writer, 'The voter roster is no longer retained.');
  }
  return document.save();
}
