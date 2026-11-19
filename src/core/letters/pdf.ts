// Render an edited letter draft on a text letterhead as an A4 PDF that is never stored.
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import { formatBillingDate } from '../billing/format';
import { ValidationError } from '../errors';
import { letterheadLines, type LetterSociety } from './content';
import { LETTER_FOOTER, type LetterDraft } from './validation';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const FOOTER_SPACE = 48;
const LINE_GAP = 5;

type PdfWriter = {
  document: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
};

function cleanText(text: string) {
  return text.replace(/\t/g, '    ').replace(/\r/g, '');
}

function unsupportedCharacters(text: string, font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  return [...cleanText(text)].some(
    (character) =>
      character !== '\n' && !supported.has(character.codePointAt(0)!),
  );
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

function nextPage(writer: PdfWriter) {
  writer.page = writer.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  writer.y = PAGE_HEIGHT - MARGIN;
}

function writeText(
  writer: PdfWriter,
  text: string,
  options: { bold?: boolean; size?: number; align?: 'left' | 'right' } = {},
) {
  const size = options.size ?? 11;
  const font = options.bold ? writer.bold : writer.regular;
  const width = PAGE_WIDTH - MARGIN * 2;
  const lineHeight = size + LINE_GAP;
  for (const line of wrapText(text, font, size, width)) {
    if (writer.y - lineHeight < FOOTER_SPACE + MARGIN / 2) nextPage(writer);
    const x =
      options.align === 'right'
        ? PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(line, size)
        : MARGIN;
    writer.page.drawText(line, {
      x,
      y: writer.y,
      size,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    writer.y -= lineHeight;
  }
}

export async function renderLetterPdf(
  draft: LetterDraft,
  society: LetterSociety,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(draft.subject);
  document.setProducer('Homeish');
  document.setCreator('Homeish');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  const fieldErrors: Record<string, string> = {};
  const checks = {
    recipient: draft.recipient,
    subject: draft.subject,
    body: draft.body,
  };
  for (const [field, value] of Object.entries(checks)) {
    if (unsupportedCharacters(value, regular)) {
      fieldErrors[field] =
        'The PDF cannot show some characters here, such as emoji or non-Latin script. Use English text.';
    }
  }
  const letterhead = [society.name, ...letterheadLines(society)];
  if (letterhead.some((line) => unsupportedCharacters(line, regular))) {
    fieldErrors.letterhead =
      'The society name or address has characters the PDF cannot show. Ask an administrator to use English text in the society details.';
  }
  if (Object.keys(fieldErrors).length) {
    throw new ValidationError(fieldErrors, 'The letter PDF could not be made.');
  }

  const writer: PdfWriter = {
    document,
    page: document.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    regular,
    bold,
    y: PAGE_HEIGHT - MARGIN,
  };
  writeText(writer, society.name, { bold: true, size: 16 });
  for (const line of letterheadLines(society)) {
    writeText(writer, line, { size: 9 });
  }
  writer.page.drawLine({
    start: { x: MARGIN, y: writer.y + 2 },
    end: { x: PAGE_WIDTH - MARGIN, y: writer.y + 2 },
    thickness: 0.8,
    color: rgb(0.6, 0.6, 0.6),
  });
  writer.y -= 18;
  writeText(writer, `Date: ${formatBillingDate(draft.letterDate)}`, {
    align: 'right',
  });
  writer.y -= 6;
  writeText(writer, 'To,');
  writeText(writer, draft.recipient);
  writer.y -= 10;
  writeText(writer, `Subject: ${draft.subject}`, { bold: true });
  writer.y -= 10;
  writeText(writer, draft.body);

  const pages = document.getPages();
  pages.forEach((page, index) => {
    const footer =
      pages.length > 1
        ? `${LETTER_FOOTER} · Page ${index + 1} of ${pages.length}`
        : LETTER_FOOTER;
    page.drawText(footer, {
      x: MARGIN,
      y: MARGIN / 2,
      size: 8,
      font: regular,
      color: rgb(0.4, 0.4, 0.4),
    });
  });
  return document.save();
}
