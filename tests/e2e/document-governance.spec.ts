// Exercise P44's synthetic create, locked publication and committee read-only journeys.
import { expect, test } from './fixtures';

test('creates a factual governance record from paginated local sources', async ({
  page,
}) => {
  await page.goto('/fixtures/document?governanceKind=validity');
  await expect(
    page.getByRole('heading', { name: 'Document governance records' }),
  ).toBeVisible();
  await page.getByLabel('Record title').fill('Synthetic validity record');
  await page.getByLabel('Issuing authority (optional)').fill('Registrar');
  await page.getByLabel('Reference (optional)').fill('REG-TEST');
  await page
    .getByLabel('Document version evidence (optional for drafts)')
    .selectOption('f2d55fc3-0751-4b79-86c1-5b3e25942392');
  await page.getByRole('button', { name: 'Add record' }).click();
  await expect(page.getByText('Governance record saved.')).toBeVisible();
});

test('keeps house-rule publication locked and committee controls read-only', async ({
  page,
}) => {
  await page.goto(
    '/fixtures/document?governanceKind=house_rule&governanceSourceKind=document_version',
  );
  await expect(
    page.getByRole('heading', { name: 'Add governance record' }),
  ).toBeVisible();
  await expect(
    page.getByText('Publishing is locked', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Qualified legal review/)).toBeVisible();

  await page.getByLabel('Viewer').selectOption('committee');
  await expect(
    page.getByRole('heading', { name: 'Add governance record' }),
  ).toHaveCount(0);
  await expect(page.getByText('Read-only view')).toBeVisible();
});
