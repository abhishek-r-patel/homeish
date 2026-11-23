// Verify P40.9 and P50.1 controls at supported widths and accessibility states.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('repair forecast and project controls stay usable on phones', async ({
  page,
}) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/fixtures/major-works');

  const forecast = page.getByRole('region', { name: 'Repair forecast item' });
  await forecast.getByLabel('Inflation', { exact: false }).fill('7.50');
  await forecast.getByRole('button', { name: 'Save forecast item' }).click();
  await expect(forecast.getByRole('status')).toContainText(
    'Repair forecast item saved',
  );

  const project = page.getByRole('region', { name: 'Repair project' });
  await project.getByLabel('Progress %').fill('25');
  await project.getByRole('button', { name: 'Save repair project' }).click();
  await expect(project.getByRole('status')).toContainText(
    'Repair project saved',
  );

  const status = page.getByRole('region', { name: 'Project status' });
  await status.getByLabel('Next status').selectOption('approved');
  await status.getByLabel('Approved by').selectOption('committee');
  await status.getByLabel('Approval date').fill('2026-11-20');
  await status
    .getByLabel('Passed meeting resolution')
    .selectOption({ label: 'Approve lift work (2026-11-20)' });
  await status.getByRole('button', { name: 'Change project status' }).click();
  await expect(status.getByRole('status')).toContainText(
    'Repair project status updated',
  );

  const budget = page.getByRole('region', { name: 'Project budget' });
  await budget.getByRole('button', { name: 'Save project budget' }).click();
  await expect(budget.getByRole('status')).toContainText(
    'Repair project budget source updated',
  );

  const spend = page.getByRole('region', { name: 'Project spend' });
  await spend.getByLabel('Accounts expense').selectOption({
    label: '2026-11-10 - Synthetic lift contractor - 500000.00 available',
  });
  await spend.getByLabel('Amount to tag').fill('25000');
  await spend.getByRole('button', { name: 'Tag Accounts expense' }).click();
  await expect(spend.getByRole('status')).toContainText(
    'Accounts expense tagged',
  );
  const audit = page.getByRole('region', { name: 'Structural audit' });
  await audit
    .getByLabel('Findings summary')
    .fill('Synthetic audit findings were reviewed.');
  await audit.getByRole('button', { name: 'Save structural audit' }).click();
  await expect(
    audit.getByRole('status').filter({ hasText: 'saved' }),
  ).toContainText('Structural audit saved');
  const quote = page.getByRole('region', { name: 'Quote entry' });
  await quote.getByLabel('Vendor name').fill('Synthetic vendor B');
  await quote.getByLabel('Quote amount').fill('90000');
  await quote.getByLabel('Scope note').fill('Synthetic like-for-like scope.');
  await quote.getByLabel('Like-for-like scope').check();
  await quote.getByRole('button', { name: 'Add quote' }).click();
  await expect(
    quote.getByRole('status').filter({ hasText: 'Quote' }),
  ).toContainText('Quote added');
  const criteria = page.getByRole('region', { name: 'Scoring criteria' });
  await criteria.getByLabel('Criterion 1').fill('Price');
  await criteria.getByLabel('Criterion 2').fill('Quality');
  await criteria.getByRole('button', { name: 'Save scoring criteria' }).click();
  await expect(criteria.getByRole('status').first()).toContainText(
    'Scoring criteria saved',
  );
  await criteria.getByLabel('Scoring action').selectOption('open');
  await criteria.getByRole('button', { name: 'Update scoring state' }).click();
  await expect(criteria.getByRole('status').nth(1)).toContainText(
    'Scoring state updated',
  );
  const privateScores = page.getByRole('region', { name: 'Private scoring' });
  await privateScores.getByLabel('Price (0 to 10)').fill('9');
  await privateScores.getByLabel('Quality (0 to 10)').fill('8');
  await privateScores
    .getByRole('button', { name: 'Save private scores' })
    .click();
  await expect(privateScores.getByRole('status')).toContainText(
    'Private scores saved',
  );
  const chosen = page.getByRole('region', { name: 'Chosen quote' });
  await chosen
    .getByLabel('Society decision reason')
    .fill('Committee approved this quote.');
  await chosen.getByRole('button', { name: 'Record chosen quote' }).click();
  await expect(chosen.getByRole('status')).toContainText(
    'Chosen quote recorded',
  );
  const scenario = page.getByRole('region', { name: 'Funding scenario' });
  await scenario.getByLabel('Scenario name').fill('Equal funding option');
  await scenario.getByLabel('Unit split').selectOption('equal');
  await scenario.getByRole('button', { name: 'Add scenario' }).click();
  await expect(scenario.getByRole('status')).toContainText(
    'What-if funding scenario saved',
  );
  const proposal = page.getByRole('region', {
    name: 'Redevelopment proposal',
  });
  await proposal
    .getByRole('button', { name: 'Save redevelopment proposal' })
    .click();
  await expect(proposal.getByRole('status').first()).toContainText(
    'Redevelopment proposal saved',
  );
  await proposal.getByLabel('Next stage').selectOption('under_review');
  await proposal.getByRole('button', { name: 'Change proposal stage' }).click();
  await expect(proposal.getByRole('status').nth(1)).toContainText(
    'Redevelopment proposal stage updated',
  );
  const consent = page.getByRole('region', { name: 'Consent controls' });
  await consent
    .getByLabel(/Our bye-laws and applicable rules allow this consent method/)
    .check();
  await consent.getByRole('button', { name: 'Save consent method' }).click();
  await expect(consent.getByRole('status').first()).toContainText(
    'Consent method updated',
  );
  await consent.getByRole('button', { name: 'Record unit consent' }).click();
  await expect(
    consent.getByRole('status').filter({ hasText: 'Owner-unit' }),
  ).toContainText('Owner-unit consent recorded');
  await consent
    .getByLabel(/Our bye-laws and applicable rules allow this consent poll/)
    .check();
  await consent
    .getByRole('button', { name: 'Create draft consent poll' })
    .click();
  await expect(
    consent.getByRole('status').filter({ hasText: 'Draft consent poll' }),
  ).toContainText('Draft consent poll created');
  const milestone = page.getByRole('region', {
    name: 'Redevelopment milestone',
  });
  await milestone.getByLabel('Milestone title').fill('Approve draft terms');
  await milestone.getByLabel('Order').fill('1');
  await milestone.getByRole('button', { name: 'Add milestone' }).click();
  await expect(milestone.getByRole('status').first()).toContainText(
    'Redevelopment milestone saved',
  );
  await page.getByRole('button', { name: 'Archive proposal' }).click();
  await expect(
    page.getByRole('region', { name: 'Proposal archive' }).getByRole('status'),
  ).toContainText('Proposal archived');
  await expect(
    page.getByText('Major works summary', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Structural audit overdue')).toBeVisible();

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
