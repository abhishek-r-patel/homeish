// Render the P46 election summary without voter names or ballot choices.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatBillingDate } from '../billing/format';
import { rupeesFromPaise } from '../billing/validation';
import { pdfSafeText } from '../billing/documents';
import type { PollElectionDetail } from './election-read-model';

export async function pollElectionSummaryPdf(
  societyName: string,
  election: PollElectionDetail,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(pdfSafeText(`${societyName} official election summary`));
  document.setProducer('Homeish');
  document.setCreator('Homeish');
  let page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let y = 795;
  const line = (text: string, value = '', strong = false) => {
    if (y < 50) {
      page = document.addPage([595.28, 841.89]);
      y = 795;
    }
    const safeText = pdfSafeText(text).slice(0, 90);
    const font = strong ? bold : regular;
    page.drawText(safeText, {
      x: 48,
      y,
      size: strong ? 12 : 10,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    if (value) {
      const safeValue = pdfSafeText(value);
      page.drawText(safeValue, {
        x: 547 - regular.widthOfTextAtSize(safeValue, 10),
        y,
        size: 10,
        font: regular,
        color: rgb(0.1, 0.1, 0.1),
      });
    }
    y -= 18;
  };
  line(societyName, '', true);
  line(election.title, '', true);
  line(`Official election · ${election.legal_type}`);
  line(`Stage: ${election.stage}`);
  line(
    'Homeish records the society confirmation; this summary is not legal certification.',
  );
  y -= 8;
  line('Result', '', true);
  for (const post of election.results) {
    line(
      post.post_name,
      post.winners
        .map((winner) => winner.candidate_name ?? 'Not declared')
        .join(', ') || 'Not declared',
    );
  }
  line(
    'Turnout',
    `${election.participation_count} of ${election.voter_count} listed units`,
  );
  y -= 8;
  line('Timeline', '', true);
  if (election.nominations_open_at)
    line('Nominations opened', formatBillingDate(election.nominations_open_at));
  if (election.nominations_close_at)
    line(
      'Nominations closed',
      formatBillingDate(election.nominations_close_at),
    );
  if (election.voting_opens_at)
    line('Voting opened', formatBillingDate(election.voting_opens_at));
  if (election.voting_closes_at)
    line('Voting closed', formatBillingDate(election.voting_closes_at));
  if (election.declared_at)
    line('Declared', formatBillingDate(election.declared_at));
  line('Disputes', String(election.dispute_count));
  line(
    'Total linked election cost',
    `Rs. ${rupeesFromPaise(election.total_cost_paise)}`,
  );
  y -= 10;
  line(
    'This summary does not contain voter names, who voted or how anyone voted.',
    '',
    true,
  );
  return document.save();
}
