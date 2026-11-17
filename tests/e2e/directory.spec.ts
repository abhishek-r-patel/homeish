// Verify privacy-filtered directory browsing, search, mobile layout and accessibility.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('resident searches visible names and units without searching phone numbers', async ({
  page,
}) => {
  await page.goto('/fixtures/directory');
  await expect(
    page.getByRole('heading', { name: 'Resident directory', exact: true }),
  ).toBeVisible();
  const entries = page
    .getByRole('list', { name: 'Residents' })
    .getByRole('listitem');
  const search = page.getByRole('searchbox', {
    name: 'Search by name or unit',
  });
  await expect(entries).toHaveCount(3);
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: 'Call Resident Bravo on +12025550123' }),
  ).toHaveAttribute('href', 'tel:+12025550123');

  await search.fill('  ALPHA  ');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Resident Alpha');
  await expect(entries.first().getByRole('link')).toHaveCount(0);
  await expect(
    page.getByText('1 directory entry matching your search'),
  ).toBeVisible();

  await search.fill('b-204');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Resident Bravo');

  await search.fill('+12025550123');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'No matching residents' }),
  ).toBeVisible();
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(entries).toHaveCount(3);
  await expect(search).toBeFocused();
});

test('directory browser remains accessible without horizontal overflow', async ({
  page,
}) => {
  await page.goto('/fixtures/directory');
  await expect(
    page.getByRole('heading', { name: 'Resident directory', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Use larger sample' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Pagination' }),
  ).toBeVisible();

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test('directory paging resets after search or page-size changes', async ({
  page,
}) => {
  await page.goto('/fixtures/directory');
  await page.getByRole('button', { name: 'Use larger sample' }).click();
  const entries = page
    .getByRole('list', { name: 'Residents' })
    .getByRole('listitem');
  const pager = page.getByRole('navigation', { name: 'Pagination' });
  const search = page.getByRole('searchbox', {
    name: 'Search by name or unit',
  });
  await expect(entries).toHaveCount(10);
  await expect(pager).toContainText('Page 1 of 5');
  await pager.getByRole('button', { name: 'Next page' }).click();
  await expect(pager).toContainText('Page 2 of 5');
  await expect(entries.first()).toContainText('Sample Resident 08');
  await pager.getByRole('button', { name: 'Previous page' }).click();
  await expect(pager).toContainText('Page 1 of 5');
  await pager.getByRole('button', { name: 'Last page' }).click();
  await expect(entries).toHaveCount(3);

  await search.fill('alpha');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Resident Alpha');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(entries).toHaveCount(10);
  await expect(pager).toContainText('Page 1 of 5');

  await pager.getByRole('button', { name: 'Next page' }).click();
  await pager.getByLabel('Rows per page').selectOption('25');
  await expect(entries).toHaveCount(25);
  await expect(pager).toContainText('Page 1 of 2');
  await pager.getByRole('button', { name: 'Last page' }).click();
  await expect(entries).toHaveCount(18);
  await expect(pager.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await pager.getByLabel('Rows per page').selectOption('50');
  await expect(entries).toHaveCount(43);
  await expect(pager).toBeVisible();
  await pager.getByLabel('Rows per page').selectOption('10');
  await expect(entries).toHaveCount(10);
  await page.getByRole('button', { name: 'Use small sample' }).click();
  await expect(entries).toHaveCount(3);
  await expect(pager).not.toBeVisible();
});

test('resident maintains only their records and retries a save with the same request ID', async ({
  page,
}) => {
  await page.goto('/fixtures/directory');
  await page
    .getByText('Test household and management workflows', { exact: true })
    .click();
  const workspace = page.getByRole('region', {
    name: 'Synthetic directory workflows',
  });
  const coOccupant = workspace
    .getByRole('listitem')
    .filter({ hasText: 'Co-occupant Contact' });
  await expect(
    coOccupant.getByText('Edit contact', { exact: true }),
  ).toHaveCount(0);
  await expect(coOccupant.getByRole('button')).toHaveCount(0);

  const vehicleForm = workspace.locator('form').filter({
    has: page.getByRole('button', { name: 'Add vehicle', exact: true }),
  });
  await vehicleForm
    .getByLabel('Household unit')
    .selectOption({ label: 'A-101' });
  await vehicleForm.getByLabel('Registration number').fill('MH02CD5678');
  await workspace.getByLabel('Simulate action failure').check();
  await vehicleForm
    .getByRole('button', { name: 'Add vehicle', exact: true })
    .click();
  await expect(vehicleForm.getByRole('status')).toContainText(
    'directory-fixture-reference',
  );
  const retryKey = await workspace
    .getByTestId('directory-request-id')
    .innerText();
  await workspace.getByLabel('Simulate action failure').uncheck();
  await vehicleForm
    .getByRole('button', { name: 'Add vehicle', exact: true })
    .click();
  await expect(workspace.getByTestId('directory-request-id')).toHaveText(
    retryKey,
  );
  const addedVehicle = workspace
    .getByRole('listitem')
    .filter({ hasText: 'MH02CD5678' });
  await expect(addedVehicle).toHaveCount(1);
  await addedVehicle.getByText('Edit vehicle', { exact: true }).click();
  await addedVehicle.getByLabel('Registration number').fill('MH02CD9999');
  await addedVehicle
    .getByRole('button', { name: 'Save vehicle', exact: true })
    .click();
  const editedVehicle = workspace
    .getByRole('listitem')
    .filter({ hasText: 'MH02CD9999' });
  await expect(editedVehicle).toContainText('awaiting verification');
  await editedVehicle
    .getByRole('button', { name: 'Deactivate vehicle' })
    .click();
  await expect(editedVehicle).toContainText('inactive');
  await expect(
    editedVehicle.getByText('Edit vehicle', { exact: true }),
  ).toHaveCount(0);

  await workspace.getByLabel('Share my phone number with residents').check();
  await workspace.getByRole('button', { name: 'Save visibility' }).click();
  await expect(workspace.getByTestId('directory-phone-preference')).toHaveText(
    'Phone sharing: enabled',
  );
  await expect(
    workspace.getByLabel('Share my phone number with residents'),
  ).toBeChecked();
  const contactForm = workspace.locator('form').filter({
    has: page.getByRole('button', {
      name: 'Add emergency contact',
      exact: true,
    }),
  });
  await contactForm.getByLabel('Contact name').fill('New Synthetic Contact');
  await contactForm.getByLabel('Relationship').fill('Friend');
  await contactForm.getByLabel('Phone number').fill('+12025550125');
  await contactForm
    .getByRole('button', { name: 'Add emergency contact', exact: true })
    .click();
  const addedContact = workspace
    .getByRole('listitem')
    .filter({ hasText: 'New Synthetic Contact' });
  await addedContact.getByText('Edit contact', { exact: true }).click();
  await addedContact
    .getByLabel('Contact name')
    .fill('Updated Synthetic Contact');
  await addedContact.getByRole('button', { name: 'Save contact' }).click();
  const editedContact = workspace
    .getByRole('listitem')
    .filter({ hasText: 'Updated Synthetic Contact' });
  await editedContact
    .getByRole('button', { name: 'Deactivate contact' })
    .click();
  await expect(editedContact).toHaveCount(0);
});

test('admin verifies and edits vehicles, committee stays read-only and guard sees only exact verified matches', async ({
  page,
}) => {
  await page.goto('/fixtures/directory');
  await page
    .getByText('Test household and management workflows', { exact: true })
    .click();
  const workspace = page.getByRole('region', {
    name: 'Synthetic directory workflows',
  });
  const role = workspace.getByLabel('Fixture role');
  await role.selectOption('guard');
  await workspace.getByLabel('Vehicle registration number').fill('MH01AB1234');
  await workspace.getByRole('button', { name: 'Look up vehicle' }).click();
  await expect(workspace.getByRole('status')).toContainText(
    'No verified active vehicle',
  );

  await role.selectOption('admin');
  const vehicle = workspace
    .getByRole('listitem')
    .filter({ hasText: 'MH01AB1234' });
  await vehicle
    .getByRole('button', { name: 'Verify vehicle', exact: true })
    .click();
  await expect(
    vehicle.getByRole('button', { name: 'Revoke verification' }),
  ).toBeVisible();
  await role.selectOption('guard');
  await workspace
    .getByLabel('Vehicle registration number')
    .fill('mh 01-ab 1234');
  await workspace.getByRole('button', { name: 'Look up vehicle' }).click();
  await expect(workspace.getByRole('status')).toContainText('car · Unit A-101');
  await expect(workspace.getByRole('status')).not.toContainText('MH01AB1234');
  await expect(workspace).not.toContainText('Synthetic Emergency Contact');
  await expect(workspace).not.toContainText('+12025550123');
  await workspace.getByLabel('Vehicle registration number').fill('MH01');
  await expect(
    workspace.getByText('Verified vehicle found', { exact: true }),
  ).toHaveCount(0);
  await workspace.getByRole('button', { name: 'Look up vehicle' }).click();
  await expect(workspace.getByRole('status')).toContainText(
    'No verified active vehicle',
  );

  await role.selectOption('admin');
  await vehicle.getByText('Edit vehicle', { exact: true }).click();
  await vehicle.getByLabel('Vehicle type').selectOption('two_wheeler');
  await vehicle.getByRole('button', { name: 'Save vehicle' }).click();
  await expect(vehicle).toContainText('awaiting verification');
  await role.selectOption('committee');
  await expect(
    workspace.getByText('Edit vehicle', { exact: true }),
  ).toHaveCount(0);
  await expect(
    workspace.getByText('Edit contact', { exact: true }),
  ).toHaveCount(0);
  await expect(
    workspace.getByRole('button', { name: /Verify|Deactivate|Save|Add/ }),
  ).toHaveCount(0);
  await expect(workspace).toContainText('+12025550123');
});

test('directory household, management and guard screens pass mobile and accessibility checks', async ({
  page,
}) => {
  await page.goto('/fixtures/directory');
  await page
    .getByText('Test household and management workflows', { exact: true })
    .click();
  const workspace = page.getByRole('region', {
    name: 'Synthetic directory workflows',
  });

  for (const role of ['resident', 'admin', 'committee', 'guard']) {
    await workspace.getByLabel('Fixture role').selectOption(role);
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  }
});

test('failed resident and manager reads remain retryable without showing an empty success state', async ({
  page,
}) => {
  await page.goto('/fixtures/directory');
  await page.getByLabel('Simulate directory read failure').check();
  await page
    .getByRole('searchbox', { name: 'Search by name or unit' })
    .fill('Alpha');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(
    page.getByRole('alert', { name: 'Could not load directory results' }),
  ).toContainText('directory-read-reference');
  await expect(
    page.getByText('No matching residents', { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Simulate directory read failure').uncheck();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'Residents' }).getByRole('listitem'),
  ).toHaveCount(1);
  await page
    .getByText('Test household and management workflows', { exact: true })
    .click();
  const workspace = page.getByRole('region', {
    name: 'Synthetic directory workflows',
  });
  await workspace.getByLabel('Fixture role').selectOption('admin');
  await workspace.getByLabel('Simulate action failure').check();
  await workspace.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(workspace.getByRole('alert')).toContainText(
    'Synthetic action failed',
  );
  await workspace.getByLabel('Simulate action failure').uncheck();
  await workspace.getByRole('button', { name: 'Retry directory read' }).click();
  await expect(workspace.getByRole('alert')).toHaveCount(0);
  await expect(
    workspace.getByRole('region', { name: 'Residents', exact: true }),
  ).toContainText('Resident Alpha');
});

test('Hindi directory workflows preserve entered identifiers and translate retry feedback', async ({
  page,
}) => {
  const serviceRequests: string[] = [];
  await page.route(/\/(?:auth|rest)\/v1\//, async (route) => {
    serviceRequests.push(route.request().url());
    await route.abort();
  });
  await page.goto('/fixtures/directory');
  await expect(
    page.getByRole('heading', { name: 'Resident directory', exact: true }),
  ).toBeVisible();
  await page
    .getByText('Test household and management workflows', { exact: true })
    .click();
  const workspace = page.getByRole('region', {
    name: 'Synthetic directory workflows',
  });
  const vehicleForm = workspace.locator('form').filter({
    has: page.getByRole('button', { name: 'Add vehicle', exact: true }),
  });
  await vehicleForm
    .getByLabel('Household unit')
    .selectOption({ label: 'A-101' });
  const selectedHouseholdValue = await vehicleForm
    .getByLabel('Household unit')
    .inputValue();
  await vehicleForm.getByLabel('Registration number').fill('MH02CD5678');
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('unsaved changes');
    await dialog.accept();
  });
  await page
    .getByRole('combobox', { name: 'Choose a language' })
    .selectOption('hi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(
    page.getByRole('heading', { name: 'निवासी डायरेक्टरी', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: 'Resident Bravo को +12025550123 पर कॉल करें',
    }),
  ).toHaveAttribute('href', 'tel:+12025550123');

  const hindiForm = workspace.locator('form').filter({
    has: page.getByRole('button', { name: 'वाहन जोड़ें', exact: true }),
  });
  await expect(hindiForm.getByLabel('पंजीकरण नंबर')).toHaveValue('MH02CD5678');
  await expect(hindiForm.getByLabel('परिवार की यूनिट')).toHaveValue(
    selectedHouseholdValue,
  );
  await workspace.getByLabel('Simulate action failure').check();
  await hindiForm
    .getByRole('button', { name: 'वाहन जोड़ें', exact: true })
    .click();
  await expect(hindiForm.getByRole('status')).toContainText(
    'नमूने की कार्रवाई असफल रही। फिर कोशिश करें।',
  );
  await expect(hindiForm.getByRole('status')).toContainText(
    'directory-fixture-reference',
  );
  await expect(hindiForm.getByLabel('पंजीकरण नंबर')).toHaveValue('MH02CD5678');
  await workspace.getByLabel('Simulate action failure').uncheck();
  await hindiForm
    .getByRole('button', { name: 'वाहन जोड़ें', exact: true })
    .click();
  const vehicle = workspace
    .getByRole('listitem')
    .filter({ hasText: 'MH02CD5678' });
  await expect(vehicle).toContainText('कार');
  await expect(vehicle).toContainText('सत्यापन बाकी');
  await expect(vehicle).toContainText('A-101');
  expect(serviceRequests).toEqual([]);
});
