// Verify the message catalog fails clearly when Hindi copy is missing.
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  HINDI_MESSAGES,
  translateFeedbackMessage,
  translateMessage,
} from '../../src/core/i18n/messages';
import { MODULE_REGISTRY } from '../../src/core/modules';
import { ERROR_MESSAGES } from '../../src/core/errors';
import { ANALYTICS_METRICS } from '../../src/core/analytics/catalogue';
import {
  formatLocalizedCurrency,
  formatLocalizedDate,
  formatLocalizedDateTime,
  formatLocalizedNumber,
  formatLocalizedTime,
} from '../../src/core/i18n/format';
import { todayInIndia } from '../../src/lib/india-time';
import { localTimeToIso } from '../../src/lib/local-time';

function localizedSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return localizedSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')
      ? [path]
      : [];
  });
}

function literalMessagesIn(source: ts.SourceFile): string[] {
  const messages: string[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      [
        't',
        'translate',
        'translateMessage',
        'translateFeedback',
        'translateFeedbackMessage',
      ].includes(node.expression.text)
    ) {
      function collectStrings(argument: ts.Node) {
        if (ts.isStringLiteralLike(argument)) {
          messages.push(argument.text);
          return;
        }
        if (ts.isConditionalExpression(argument)) {
          collectStrings(argument.whenTrue);
          collectStrings(argument.whenFalse);
          return;
        }
        if (
          ts.isBinaryExpression(argument) &&
          [
            ts.SyntaxKind.BarBarToken,
            ts.SyntaxKind.QuestionQuestionToken,
          ].includes(argument.operatorToken.kind)
        ) {
          collectStrings(argument.left);
          collectStrings(argument.right);
          return;
        }
      }
      const sourceMessage =
        node.arguments[
          ['translateMessage', 'translateFeedbackMessage'].includes(
            node.expression.text,
          )
            ? 1
            : 0
        ];
      if (sourceMessage) collectStrings(sourceMessage);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return messages;
}

describe('interface translations', () => {
  it('uses the India calendar day and clock at midnight without moving the instant', () => {
    const before = new Date('2026-01-31T18:29:59Z');
    const midnight = new Date('2026-01-31T18:30:00Z');
    expect(todayInIndia(before)).toBe('2026-01-31');
    expect(todayInIndia(midnight)).toBe('2026-02-01');
    expect(formatLocalizedDateTime(midnight, 'en')).toMatch(
      /1 Feb 2026.*12:00 am/i,
    );
    expect(
      formatLocalizedTime(midnight, 'en', { timeZone: undefined }),
    ).toMatch(/12:00 am/i);
    expect(localTimeToIso('2026-02-01T00:00', 'Asia/Kolkata')).toBe(
      midnight.toISOString(),
    );
  });
  it('provides non-empty Hindi messages for the current common catalog', () => {
    expect(Object.keys(HINDI_MESSAGES).length).toBeGreaterThan(0);
    expect(Object.values(HINDI_MESSAGES).every(Boolean)).toBe(true);
  });

  it('keeps English copy unchanged', () => {
    expect(translateMessage('en', 'Language')).toBe('Language');
  });

  it('fails explicitly when a Hindi message is missing', () => {
    expect(() => translateMessage('hi', 'Uncatalogued message')).toThrow(
      'Missing Hindi translation for: Uncatalogued message',
    );
    expect(() => translateMessage('hi', 'toString')).toThrow(
      'Missing Hindi translation for: toString',
    );
  });

  it('translates every registered society navigation label and section', () => {
    for (const definition of Object.values(MODULE_REGISTRY)) {
      for (const items of Object.values(definition.navigation)) {
        for (const item of items ?? []) {
          expect(() => translateMessage('hi', item.label)).not.toThrow();
          const section = item.section;
          if (section) {
            expect(() => translateMessage('hi', section)).not.toThrow();
          }
        }
      }
    }
  });

  it('localizes standard action errors and dynamic analytics headings', () => {
    const sources = [
      ...Object.values(ERROR_MESSAGES),
      ...ANALYTICS_METRICS.flatMap(({ label, description }) => [
        label,
        description,
      ]),
    ];
    const missing = sources.filter(
      (source) => !Object.hasOwn(HINDI_MESSAGES, source),
    );
    expect(missing).toEqual([]);
  });

  it('localizes actual validation issues without changing bounds or input', () => {
    const cases = [
      { schema: z.string().min(3), input: '', expected: 'कम से कम 3 अक्षर' },
      {
        schema: z.string().max(120),
        input: 'x'.repeat(121),
        expected: 'अधिकतम 120 अक्षर',
      },
      { schema: z.number().positive(), input: 0, expected: '0 से बड़ी' },
      { schema: z.number().max(25), input: 26, expected: '25 या उससे छोटी' },
      {
        schema: z.array(z.string()).min(2),
        input: [],
        expected: 'कम से कम 2 विकल्प',
      },
      { schema: z.enum(['a', 'b']), input: 'c', expected: 'उपलब्ध विकल्पों' },
      { schema: z.email(), input: 'invalid', expected: 'सही ईमेल' },
    ];
    for (const { schema, input, expected } of cases) {
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      const message = result.error!.issues[0]!.message;
      expect(translateFeedbackMessage('hi', message)).toContain(expected);
      expect(translateFeedbackMessage('en', message)).toBe(message);
    }
    expect(translateFeedbackMessage('hi', 'Choose your flat.')).toContain(
      'flat',
    );
    expect(() =>
      translateFeedbackMessage('hi', 'Uncatalogued action message'),
    ).toThrow('Missing Hindi translation');
  });

  it('localizes dynamic action summaries and preserves amounts and error references', () => {
    expect(
      translateFeedbackMessage(
        'hi',
        '1 charge added to 1 bill (₹1,234.50). 2 waiting for a rate. Run again to bill the rest.',
      ),
    ).toBe(
      '1 बिल में 1 शुल्क जोड़े गए (₹1,234.50)। 2 शुल्क दर के इंतज़ार में हैं। बाकी के बिल बनाने के लिए फिर चलाएं।',
    );
    expect(
      translateFeedbackMessage(
        'hi',
        '2000 charges added to 1000 bills (₹1,23,456.78).',
      ),
    ).toBe('1,000 बिल में 2,000 शुल्क जोड़े गए (₹1,23,456.78)।');
    expect(translateFeedbackMessage('hi', 'Use up to 1000 characters.')).toBe(
      'अधिकतम 1,000 अक्षर भरें।',
    );
    const referenced = translateFeedbackMessage(
      'hi',
      `${ERROR_MESSAGES.FORBIDDEN} Reference: ERR-A1B2C3D4E5`,
    );
    expect(referenced).toContain(
      translateMessage('hi', ERROR_MESSAGES.FORBIDDEN),
    );
    expect(referenced).toContain('ERR-A1B2C3D4E5');
    expect(referenced).not.toContain('Reference:');
    expect(translateFeedbackMessage('hi', 'Failed to fetch')).toBe(
      translateMessage(
        'hi',
        'Could not reach the server. Your details remain here; reconnect and retry.',
      ),
    );
    for (const source of [
      'signal timed out',
      'The operation was aborted due to timeout',
      'The operation timed out.',
    ]) {
      expect(translateFeedbackMessage('hi', source)).toBe(
        translateMessage('hi', 'The request timed out. Retry.'),
      );
      expect(translateFeedbackMessage('en', source)).toBe(source);
    }
  });

  it('handles event and meeting outcome combinations without changing counts or money', () => {
    const cases = [
      ['RSVP saved: 1 going.', 'जवाब सहेजा गया: 1 आ रहे हैं।'],
      [
        'RSVP saved: 2 going. ₹123456.78 is on your flat’s bill.',
        'जवाब सहेजा गया: 2 आ रहे हैं। आपके फ़्लैट के बिल में ₹1,23,456.78 है।',
      ],
      [
        'Event published and 1 person notified.',
        'कार्यक्रम प्रकाशित हुआ और 1 व्यक्ति को सूचना दी गई।',
      ],
      [
        'Changes saved. 2 flats were withdrawn and 1 refunded.',
        'बदलाव सहेजे गए। 2 फ़्लैट के जवाब वापस लिए गए और 1 को राशि वापस समायोजित हुई।',
      ],
      [
        'Meeting scheduled and invitees notified. Notice is shorter than the society’s 7-day rule.',
        'सूचना अवधि सोसायटी के 7 दिन के नियम से कम है।',
      ],
    ];
    for (const [source, expected] of cases) {
      expect(translateFeedbackMessage('hi', source!)).toContain(expected);
      expect(translateFeedbackMessage('en', source!)).toBe(source);
    }
  });

  it('preserves existing IST clock times, private notes and supplied names', () => {
    for (const source of [
      'Listing renewed until 17 Nov 2026, 6:00 pm IST.',
      'Muted until 17 Nov 2026, 6:00 pm IST. The resident was told.',
    ]) {
      const translated = translateFeedbackMessage('hi', source);
      expect(translated).toContain('17 नव');
      expect(translated).toContain('2026, 6:00 pm IST');
      expect(translated).not.toContain('Nov');
    }
    const detail = 'Synthetic note (leave this unchanged)';
    expect(
      translateFeedbackMessage(
        'hi',
        `An administrator has paused your posting in Community (${detail}). You can still read posts and listings.`,
      ),
    ).toContain(`(${detail})`);
    expect(translateFeedbackMessage('hi', 'Tower {A} recorded.')).toBe(
      'Tower {A} दर्ज हुआ।',
    );
    expect(translateFeedbackMessage('hi', 'Handled by Test {Guard}.')).toBe(
      'संभालने वाला: Test {Guard}।',
    );
  });

  it('localizes billing and vendor feedback while rejecting an unknown approval suffix', () => {
    expect(translateFeedbackMessage('hi', '1 bill generated.')).toBe(
      '1 बिल बनाया गया।',
    );
    expect(translateFeedbackMessage('hi', '1000 bills generated.')).toBe(
      '1,000 बिल बनाए गए।',
    );
    expect(translateFeedbackMessage('hi', 'Export ready with 2 rows.')).toBe(
      '2 पंक्तियों वाला निर्यात तैयार है।',
    );
    expect(translateFeedbackMessage('hi', 'Approval recorded: 1 of 2.')).toBe(
      'मंज़ूरी दर्ज हुई: 2 में से 1।',
    );
    expect(
      translateFeedbackMessage(
        'hi',
        'Request approved. The requester has been notified. No expense draft: the Expenses module is off.',
      ),
    ).toBe(
      'अनुरोध मंज़ूर हुआ। अनुरोधकर्ता को सूचना दी गई। खर्च का मसौदा नहीं बना: खर्च मॉड्यूल बंद है।',
    );
    expect(() =>
      translateFeedbackMessage(
        'hi',
        'Request approved. The requester has been notified. Unexpected vendor outcome.',
      ),
    ).toThrow('Missing Hindi translation');
  });

  it.each(
    readdirSync(resolve('src'), { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() ||
          (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')),
      )
      .map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
      })),
  )(
    'catalogs every literal message used by localized source files in $name',
    ({ name, isDirectory }) => {
      const sourceRoot = resolve('src');
      const path = resolve(sourceRoot, name);
      const paths = isDirectory ? localizedSourceFiles(path) : [path];
      const missing = paths.flatMap((sourcePath) => {
        const content = readFileSync(sourcePath, 'utf8');
        if (
          !/(useUiTranslator|useLanguage|useOptionalLanguage|translateMessage|createComponentTranslator)/.test(
            content,
          )
        )
          return [];
        const source = ts.createSourceFile(
          sourcePath,
          content,
          ts.ScriptTarget.Latest,
          false,
          sourcePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        return literalMessagesIn(source)
          .filter((message) => !Object.hasOwn(HINDI_MESSAGES, message))
          .map((message) => `${relative(sourceRoot, sourcePath)}: ${message}`);
      });

      expect(missing).toEqual([]);
    },
  );

  it('preserves placeholders in every translated message', () => {
    const placeholders = (message: string) =>
      [...message.matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
        .map((match) => match[1])
        .sort();
    const mismatches = Object.entries(HINDI_MESSAGES)
      .filter(
        ([source, translated]) =>
          JSON.stringify(placeholders(source)) !==
          JSON.stringify(placeholders(translated)),
      )
      .map(([source]) => source);
    expect(mismatches).toEqual([]);
  });

  it('substitutes every required interpolation value', () => {
    expect(translateMessage('hi', 'Hello {name}', { name: 'Asha' })).toBe(
      'नमस्ते Asha',
    );
    expect(() => translateMessage('hi', 'Hello {name}', {})).toThrow(
      'Missing interpolation value "name" for: Hello {name}',
    );
    expect(() => translateMessage('hi', 'Hello {name}')).toThrow(
      'Missing interpolation value "name" for: Hello {name}',
    );
  });

  it('uses Latin digits and Indian grouping for Hindi numbers and rupees', () => {
    expect(formatLocalizedNumber(123456, 'hi')).toBe('1,23,456');
    expect(formatLocalizedCurrency(12345678, 'hi')).toBe('₹1,23,456.78');
  });

  it('formats large and negative paise exactly without floating-point rounding', () => {
    expect(formatLocalizedCurrency(9007199254740991, 'en')).toBe(
      '₹9,00,71,99,25,47,409.91',
    );
    expect(formatLocalizedCurrency('9007199255804991', 'hi')).toBe(
      '₹9,00,71,99,25,58,049.91',
    );
    expect(formatLocalizedCurrency(-5, 'en')).toBe('-₹0.05');
  });

  it('localizes month names and retains a 12-hour time in the requested zone', () => {
    const instant = new Date('2026-03-05T18:30:00.000Z');
    expect(
      formatLocalizedDate(instant, 'hi', {
        dateStyle: 'long',
        timeZone: 'UTC',
      }),
    ).toContain('मार्च');
    expect(
      formatLocalizedTime(instant, 'hi', {
        timeZone: 'UTC',
      }),
    ).toMatch(/6:30\s*pm/i);
  });
});
