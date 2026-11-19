// Verify letter text building, neutral wording guards, draft validation and PDF rendering.
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/core/errors';
import {
  buildLetterText,
  hasPlaceholders,
  type LetterSociety,
  type LetterSource,
} from '../../src/core/letters/content';
import { renderLetterPdf } from '../../src/core/letters/pdf';
import {
  LETTER_TYPES,
  LETTER_TYPE_CONFIG,
  findDiscouragedWording,
  letterDraftSchema,
} from '../../src/core/letters/validation';

const society: LetterSociety = {
  name: 'Synthetic Greens CHS',
  address: '1 Test Lane',
  city: 'Pune',
  contactEmail: 'office@example.test',
  contactPhone: null,
  timezone: 'Asia/Kolkata',
};

const bill: LetterSource = {
  type: 'billing_bill',
  id: '0b7a3c52-4d1e-4f8a-9b6c-2e5d7f9a1c30',
  unitNumber: 'A-101',
  title: 'Maintenance',
  periodStart: '2026-11-01',
  dueDate: '2026-11-15',
  totalPaise: 350000,
  paidPaise: 100000,
  waivedPaise: 0,
  outstandingPaise: 250000,
};

const booking: LetterSource = {
  type: 'amenity_booking',
  id: '6c1b1f8e-2f55-4f39-9a5f-0d9f3c1a7b21',
  date: '2026-11-21',
  unitNumber: 'B-202',
  amenityName: 'Community Hall',
  startsAt: '2026-11-21T12:30:00Z',
  endsAt: '2026-11-21T16:30:00Z',
  guestCount: 40,
  feePaise: 0,
  rulesSnapshot: 'Music must stop by 10 pm.',
};

const sampleSources: Record<string, LetterSource> = {
  billing_bill: bill,
  amenity_booking: booking,
  membership: {
    type: 'membership',
    id: '3f8e2d1c-5b4a-4c9d-8e7f-6a5b4c3d2e10',
    fullName: 'Asha Example',
    unitNumber: null,
  },
  service_request: {
    type: 'service_request',
    id: '9d2c4b6a-8e1f-4a3b-9c5d-7e6f5a4b3c21',
    unitNumber: 'C-303',
    categoryName: 'Plumbing',
    description: 'Kitchen tap is leaking.',
    createdAt: '2026-11-18T05:30:00Z',
    requesterName: null,
  },
  vendor_work_order: {
    type: 'vendor_work_order',
    id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    number: 'WO-0007',
    vendorName: 'Example Pumps',
    requestTitle: 'Pump repair',
    description: 'Repair the overhead tank pump.',
    valuePaise: 1250000,
    issuedOn: '2026-11-10',
    dueOn: null,
  },
};

function draft(overrides: Record<string, unknown> = {}) {
  return {
    letterType: 'circular',
    sourceId: null,
    sourceDate: null,
    letterDate: '2026-11-20',
    recipient: 'All Residents',
    subject: 'Water tank cleaning',
    body: 'Dear Residents,\n\nThe tank will be cleaned on Saturday.',
    ...overrides,
  };
}

describe('letter text', () => {
  it('fills dues letters with the saved bill figures and no threats', () => {
    for (const type of ['dues_reminder', 'dues_final_notice'] as const) {
      const text = buildLetterText(type, bill, society, '2026-11-20');
      expect(text.recipient).toContain('Unit A-101');
      expect(text.body).toContain('Outstanding: Rs. 2500.00');
      expect(text.body).toContain('Due date: 15 Nov 2026');
      expect(text.body).toContain('office@example.test');
      expect(findDiscouragedWording(`${text.subject}\n${text.body}`)).toEqual(
        [],
      );
    }
  });

  it('shows only the saved booking fee and rules, never a payment', () => {
    const text = buildLetterText(
      'hall_booking_confirmation',
      booking,
      society,
      '2026-11-20',
    );
    expect(text.body).toContain('Fee saved for this booking: None');
    expect(text.body).toContain('Music must stop by 10 pm.');
    expect(text.body).toContain('does not confirm any payment');
    expect(text.body).not.toMatch(/\b(received|refund(ed)?|deposit paid)\b/i);
  });

  it('builds neutral, valid drafts for every letter type', () => {
    for (const type of LETTER_TYPES) {
      const sourceType = LETTER_TYPE_CONFIG[type].sourceType;
      const source = sourceType ? sampleSources[sourceType]! : null;
      const text = buildLetterText(type, source, society, '2026-11-20');
      const parsed = letterDraftSchema.safeParse({
        letterType: type,
        sourceId: source?.id ?? null,
        sourceDate: source?.type === 'amenity_booking' ? source.date : null,
        letterDate: '2026-11-20',
        ...text,
      });
      expect(parsed.success, type).toBe(true);
    }
  });

  it('marks placeholder text that still needs editing', () => {
    const text = buildLetterText(
      'rule_violation_warning',
      null,
      society,
      '2026-11-20',
    );
    expect(hasPlaceholders(text.body)).toBe(true);
    expect(hasPlaceholders('Pay Rs. 100 by 15 Nov 2026.')).toBe(false);
  });
});

describe('neutral wording guard', () => {
  it('rejects threats, penalties and extra deadlines in dues and rule letters', () => {
    for (const body of [
      'A penalty will be added.',
      'Interest at 2% per month applies.',
      'We will take legal action.',
      'Pay within 7 days, failing which your water will be disconnected.',
    ]) {
      const result = letterDraftSchema.safeParse(
        draft({
          letterType: 'dues_reminder',
          sourceId: bill.id,
          body,
        }),
      );
      expect(result.success, body).toBe(false);
    }
    expect(
      findDiscouragedWording('Your name is on the defaulter list.'),
    ).not.toEqual([]);
  });

  it('allows factual bill names such as a late fee or fine', () => {
    const result = letterDraftSchema.safeParse(
      draft({
        letterType: 'dues_reminder',
        sourceId: bill.id,
        subject: 'Reminder: Late fee for Unit A-101',
        body: 'The fine bill for Unit A-101 is outstanding. Please pay or contact the office.',
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe('letter draft source rules', () => {
  it('needs a record for record-based letters and rejects one otherwise', () => {
    expect(
      letterDraftSchema.safeParse(draft({ letterType: 'dues_reminder' }))
        .success,
    ).toBe(false);
    expect(
      letterDraftSchema.safeParse(draft({ sourceId: bill.id })).success,
    ).toBe(false);
    expect(
      letterDraftSchema.safeParse(
        draft({
          letterType: 'hall_booking_confirmation',
          sourceId: booking.id,
        }),
      ).success,
    ).toBe(false);
    expect(letterDraftSchema.safeParse(draft()).success).toBe(true);
  });
});

describe('letter PDF', () => {
  it('renders the letterhead text and draft footer as a PDF', async () => {
    const parsed = letterDraftSchema.parse(draft());
    const bytes = await renderLetterPdf(parsed, society);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(document.getTitle()).toBe('Water tank cleaning');
  });

  it('adds pages for long letters', async () => {
    const parsed = letterDraftSchema.parse(
      draft({ body: Array(200).fill('A line of the circular.').join('\n') }),
    );
    const document = await PDFDocument.load(
      await renderLetterPdf(parsed, society),
    );
    expect(document.getPageCount()).toBeGreaterThan(1);
  });

  it('rejects characters the PDF font cannot draw', async () => {
    const parsed = letterDraftSchema.parse(draft({ subject: 'सूचना' }));
    await expect(renderLetterPdf(parsed, society)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
