// Verify the signed-out language preference, unsaved-form guard, and local font.
import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test('saves the signed-out language choice and serves the Hindi font locally', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByLabel('Choose a language')).toHaveValue('en');

  await page.getByLabel('Choose a language').selectOption('hi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.getByLabel('भाषा चुनें')).toHaveValue('hi');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.getByLabel('भाषा चुनें')).toHaveValue('hi');
  expect(
    (
      await page.request.get('/fonts/noto-sans-devanagari-variable.ttf')
    ).status(),
  ).toBe(200);
});

test('keeps the previous language when a dirty form change is cancelled', async ({
  page,
}) => {
  await page.goto('/login');
  const email = page.getByLabel('Email address');
  await email.fill('resident@example.test');

  const dialogPromise = page.waitForEvent('dialog');
  const changePromise = page.getByLabel('Choose a language').selectOption('hi');
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain('unsaved');
  await dialog.dismiss();
  await changePromise;

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(email).toHaveValue('resident@example.test');
});

test('keeps form input when the user confirms a language change', async ({
  page,
}) => {
  await page.goto('/login');
  const email = page.getByLabel('Email address');
  await email.fill('resident@example.test');

  const dialogPromise = page.waitForEvent('dialog');
  const changePromise = page.getByLabel('Choose a language').selectOption('hi');
  await (await dialogPromise).accept();
  await changePromise;

  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.locator('#sign-in-email')).toHaveValue(
    'resident@example.test',
  );
});

test('only confirms edits to a newly rendered prefilled select', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Choose a language').selectOption('hi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await page.evaluate(() => {
    const form = document.createElement('form');
    const select = document.createElement('select');
    select.id = 'synthetic-prefilled-select';
    select.append(
      new Option('Pending', 'pending'),
      new Option('Approved', 'approved'),
    );
    select.value = 'approved';
    form.append(select);
    document.body.append(form);
  });
  const prompts: string[] = [];
  page.on('dialog', async (dialog) => {
    prompts.push(dialog.message());
    await dialog.accept();
  });
  await page.getByLabel('भाषा चुनें').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(prompts).toEqual([]);
  const select = page.locator('#synthetic-prefilled-select');
  await expect(select).toHaveValue('approved');
  await select.focus();
  await select.selectOption('pending');
  await page.getByLabel('Choose a language').selectOption('hi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  expect(prompts).toHaveLength(1);
  await expect(select).toHaveValue('pending');
});

test('keeps the previous language and reports a failed save', async ({
  page,
}) => {
  await page.goto('/login');
  await page.route('**/login', async (route) => {
    if (route.request().headers()['next-action']) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await page.getByLabel('Choose a language').selectOption('hi');
  await expect(page.getByRole('status')).toContainText(
    'The language could not be saved. Your previous choice is still active.',
  );
  await expect(page.getByLabel('Choose a language')).toHaveValue('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.unrouteAll({ behavior: 'wait' });
  await page.reload();
  await expect(page.getByLabel('Choose a language')).toHaveValue('en');
});

test('keeps files distinct across selection batches and removal', async ({
  page,
}) => {
  await page.goto('/fixtures/foundation');
  await page.evaluate(() => {
    Date.now = () => 1_800_000_000_000;
  });
  const upload = page.locator('#fixture-upload');
  await expect(upload).toBeEnabled();
  for (const [index, name] of ['first.pdf', 'second.pdf'].entries()) {
    await upload.evaluate((element: HTMLInputElement, fileName) => {
      const selected = new DataTransfer();
      selected.items.add(
        new File(['synthetic file'], fileName, {
          type: 'application/pdf',
          lastModified: 1_800_000_000_000,
        }),
      );
      element.files = selected.files;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, name);
    await expect(
      page.getByLabel('Selected files').getByRole('listitem'),
    ).toHaveCount(index + 1);
  }
  await page
    .getByRole('button', { name: 'Remove first.pdf', exact: true })
    .click();
  await expect(
    page.getByLabel('Selected files').getByRole('listitem'),
  ).toHaveCount(1);
  await expect(page.getByLabel('Selected files')).toContainText('second.pdf');
});

test('updates existing file validation feedback after a language switch', async ({
  page,
}) => {
  await page.goto('/fixtures/foundation');
  const upload = page.locator('#fixture-upload');
  await expect(upload).toBeEnabled();
  await upload.setInputFiles({
    name: 'unsupported.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('synthetic unsupported upload'),
  });
  const feedback = page
    .getByRole('alert')
    .filter({ hasText: 'unsupported.txt' });
  await expect(feedback).toContainText('Choose a file');
  await page.getByLabel('Choose a language').selectOption('hi');
  await expect(feedback).toContainText(
    'unsupported.txt: इनमें से किसी फ़ॉर्मैट की फ़ाइल चुनें',
  );
  await expect(feedback).not.toContainText('Choose a file');
});

test('confirms an SOS draft language change without losing the note or emergency category', async ({
  page,
}) => {
  await page.goto('/fixtures/sos');
  await page.getByRole('radio', { name: 'Medical', exact: true }).check();
  await page
    .getByLabel('Short note (optional)')
    .fill('Keep this synthetic note.');
  const prompts: string[] = [];
  page.on('dialog', async (dialog) => {
    prompts.push(dialog.message());
    await dialog.accept();
  });
  await page.getByLabel('Choose a language').selectOption('hi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  expect(prompts).toHaveLength(1);
  await expect(page.getByLabel('छोटी टिप्पणी (वैकल्पिक)')).toHaveValue(
    'Keep this synthetic note.',
  );
  await expect(
    page.getByRole('radio', { name: 'चिकित्सा', exact: true }),
  ).toBeChecked();
});

test('reflows longer Hindi controls at 320px and 200 percent zoom with keyboard access', async ({
  page,
}) => {
  await page.goto('/fixtures/foundation');
  await page.getByLabel('Choose a language').selectOption('hi');
  for (const { width, zoom } of [
    { width: 320, zoom: '1' },
    { width: 640, zoom: '2' },
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((value) => {
      document.documentElement.style.zoom = value;
    }, zoom);
    await expect(
      page.getByText('JPG, PNG या PDF', { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'फ़ाइल चुनें', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByLabel('भाषा चुनें').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('localizes critical SOS labels and keeps alert names and notes unchanged', async ({
  page,
}) => {
  await page.goto('/fixtures/sos');
  await page.getByLabel('Choose a language').selectOption('hi');
  await expect(
    page.getByRole('heading', { name: 'आपातकालीन SOS', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'SOS भेजें', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('यूनिट A-101 से चिकित्सा SOS', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Asha Rao', { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText('Elderly resident has fallen near the lift.', { exact: false })
      .first(),
  ).toBeVisible();
  await page.getByLabel('Fixture scenario').selectOption('denied');
  await expect(
    page.getByRole('heading', {
      name: 'आपातकालीन स्क्रीन की अनुमति सीमित है',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: '112 पर कॉल करें', exact: true }).last(),
  ).toHaveAttribute('href', 'tel:112');
});
