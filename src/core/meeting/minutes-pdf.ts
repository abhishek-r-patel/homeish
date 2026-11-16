// Render published meeting minutes as a paginated A4 PDF for the Documents copy.
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import { ValidationError } from '../errors';
import { computeQuorum } from './quorum';
import type { MeetingAdminDetail, MeetingType } from './validation';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const BOTTOM = 42;
const LINE_GAP = 5;

type PdfWriter = {
  document: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
};

export const MEETING_TYPE_LABELS: Readonly<Record<MeetingType, string>> = {
  agm: 'Annual general meeting',
  sgm: 'Special general meeting',
  committee: 'Committee meeting',
};

const OUTCOME_LABELS = {
  pending: 'Pending',
  passed: 'Passed',
  failed: 'Failed',
  deferred: 'Deferred',
} as const;

const MODE_LABELS = {
  in_person: 'In person',
  online: 'Online',
  proxy: 'Proxy',
  self: 'Self check-in',
} as const;

export function meetingMinutesFileName(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `minutes-${slug || 'meeting'}.pdf`;
}

function formatIst(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function cleanText(text: string) {
  return text.replace(/\t/g, '    ').replace(/\r/g, '');
}

// Reject rather than silently replace characters the standard PDF font cannot draw.
function assertSupportedText(text: string, font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  const unsupported = [...cleanText(text)].some(
    (character) =>
      character !== '\n' && !supported.has(character.codePointAt(0)!),
  );
  if (unsupported) {
    throw new ValidationError(
      {
        minutes:
          'These minutes contain characters the PDF copy cannot display, such as emoji or non-Latin script.',
      },
      'The minutes PDF could not be created.',
    );
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
  for (const paragraph of cleanText(text).split('\n')) {
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

export async function meetingMinutesPdf(
  detail: MeetingAdminDetail,
): Promise<Uint8Array> {
  const { meeting, minutes } = detail;
  if (!minutes) {
    throw new ValidationError(
      { minutes: 'Write the minutes first.' },
      'There are no minutes to export.',
    );
  }
  const document = await PDFDocument.create();
  document.setTitle(`Minutes: ${meeting.title}`);
  document.setProducer('Homeish');
  document.setCreator('Homeish');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  const text = [
    meeting.title,
    meeting.venue ?? '',
    meeting.onlineUrl ?? '',
    minutes.body,
    ...detail.agenda.flatMap((item) => [item.title, item.description ?? '']),
    ...detail.attendance.flatMap((row) => [row.label, row.proxyName ?? '']),
    ...detail.resolutions.flatMap((resolution) => [
      resolution.title,
      resolution.body ?? '',
      resolution.poll?.title ?? '',
    ]),
    ...detail.actions.flatMap((action) => [action.title, action.ownerName]),
  ];
  for (const value of text) assertSupportedText(value, regular);

  const writer: PdfWriter = {
    document,
    page: document.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    regular,
    bold,
    y: PAGE_HEIGHT - MARGIN,
  };
  writeText(writer, `Minutes: ${meeting.title}`, { bold: true, size: 16 });
  writeText(writer, MEETING_TYPE_LABELS[meeting.meetingType]);
  writeText(
    writer,
    `Held: ${formatIst(meeting.startsAt) ?? 'Date not set'} to ${formatIst(meeting.endsAt) ?? 'not set'} (India time)`,
  );
  if (meeting.venue) writeText(writer, `Venue: ${meeting.venue}`);
  if (meeting.onlineUrl) writeText(writer, `Online link: ${meeting.onlineUrl}`);
  if (minutes.publishedAt) {
    writeText(writer, `Published: ${formatIst(minutes.publishedAt)}`);
  }

  const quorum = computeQuorum(
    detail.quorum.invited,
    detail.quorum.present,
    detail.quorum.percent,
  );
  const invitedLabel =
    meeting.meetingType === 'committee' ? 'members' : 'units';
  writeSection(writer, 'Attendance');
  writeText(
    writer,
    `Present: ${quorum.present} of ${quorum.invited} invited ${invitedLabel}.`,
  );
  writeText(
    writer,
    quorum.percent === null
      ? 'Quorum: not set.'
      : `Quorum (${quorum.percent}%): ${quorum.met ? 'met' : 'not met'}.`,
  );
  for (const row of detail.attendance) {
    const proxy = row.proxyName ? ` (${row.proxyName})` : '';
    writeText(writer, `${row.label}: ${MODE_LABELS[row.mode]}${proxy}`, {
      indent: 8,
    });
  }

  if (detail.agenda.length > 0) {
    writeSection(writer, 'Agenda');
    detail.agenda.forEach((item, index) => {
      writeText(writer, `${index + 1}. ${item.title}`, { indent: 8 });
      if (item.description) {
        writeText(writer, item.description, { indent: 20 });
      }
    });
  }

  if (detail.resolutions.length > 0) {
    writeSection(writer, 'Resolutions');
    detail.resolutions.forEach((resolution, index) => {
      writeText(writer, `${index + 1}. ${resolution.title}`, {
        bold: true,
        indent: 8,
      });
      if (resolution.body) writeText(writer, resolution.body, { indent: 20 });
      const counts = [
        resolution.votesFor === null ? null : `for ${resolution.votesFor}`,
        resolution.votesAgainst === null
          ? null
          : `against ${resolution.votesAgainst}`,
        resolution.votesAbstain === null
          ? null
          : `abstain ${resolution.votesAbstain}`,
      ].filter((value): value is string => value !== null);
      writeText(
        writer,
        `Outcome: ${OUTCOME_LABELS[resolution.outcome]}${counts.length > 0 ? ` (${counts.join(', ')})` : ''}`,
        { indent: 20 },
      );
      if (resolution.poll) {
        writeText(writer, `Linked poll: ${resolution.poll.title}`, {
          indent: 20,
        });
      }
    });
  }

  writeSection(writer, 'Minutes');
  writeText(writer, minutes.body);

  if (detail.actions.length > 0) {
    writeSection(writer, 'Action items');
    for (const action of detail.actions) {
      writeText(
        writer,
        `${action.title} · Owner: ${action.ownerName} · Due ${formatDate(action.dueOn)} · ${action.status === 'done' ? 'Done' : 'Open'}`,
        { indent: 8 },
      );
    }
  }
  return document.save();
}
