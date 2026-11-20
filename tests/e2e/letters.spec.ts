// Verify letter preparation, preview, wording checks and in-browser PDF download on the synthetic letters fixture.
import { expect, test } from './fixtures';

test('a dues reminder is prefilled, previewed and downloaded', async ({
  page,
}) => {
  await page.goto('/fixtures/letters');
  await page.getByLabel('Letter type').selectOption({ label: 'Dues reminder' });
  await page.getByLabel('Bill').selectOption({ index: 1 });

  await expect(page.getByRole('textbox', { name: 'To' })).toHaveValue(
    /Unit A-101/,
  );
  await expect(page.getByLabel('Letter text')).toHaveValue(/Rs\. 2500\.00/);
  await expect(page.getByLabel('Letter text')).not.toHaveValue(
    /penalt|interest|legal/i,
  );

  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('article', { name: 'Letter preview' });
  await expect(preview).toContainText('Fixture Heights CHS');
  await expect(preview).toContainText(
    'Draft prepared in Homeish — review before sending',
  );

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  expect((await download).suggestedFilename()).toBe(
    'letter-dues-reminder-2026-11-20.pdf',
  );
  await expect(
    page.getByText('Letter downloaded. It was not sent or saved in Homeish.'),
  ).toBeVisible();
});

test('threatening wording is refused and missing records are explained', async ({
  page,
}) => {
  await page.goto('/fixtures/letters');
  await page.getByLabel('Letter type').selectOption({ label: 'Dues reminder' });
  await page.getByLabel('Bill').selectOption({ index: 1 });
  await page
    .getByLabel('Letter text')
    .fill('Pay now or we will take legal action against you.');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  await expect(page.getByText(/Keep this letter neutral/)).toBeVisible();
  await expect(page.getByText('Letter downloaded.')).toHaveCount(0);

  await page
    .getByLabel('Letter type')
    .selectOption({ label: 'Vendor work order' });
  await expect(page.getByText('Records unavailable')).toBeVisible();
});
