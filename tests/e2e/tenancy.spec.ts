// Verify synthetic moving journeys, private files, role projections and accessible screen states.
import AxeBuilder from '@axe-core/playwright';
import { z } from 'zod';
import { expect, test, type Page, type Route } from './fixtures';

const SOCIETY_ID = 'c0d55fc3-0751-4b79-86c1-5b3e25942392';
const OTHER_MOVE_ID = 'f0d55fc3-0751-4b79-86c1-5b3e25942392';
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'PUT, GET, OPTIONS',
  'access-control-allow-headers': 'content-type, x-upsert, cache-control',
};
const proof = {
  name: 'synthetic-agreement.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 synthetic proof'),
};
const uploadInputSchema = z
  .object({
    bucket: z.literal('tenancy-files'),
    moveId: z.uuid(),
    kind: z.enum(['rental_agreement', 'police_verification']),
    contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(5 * 1024 * 1024),
  })
  .strict();
const unwantedNetwork = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const unexpected: string[] = [];
  unwantedNetwork.set(page, unexpected);
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      request.headers()['next-action'] ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    ) {
      unexpected.push(`${request.method()} ${url.pathname}`);
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') });
});
test.afterEach(async ({ page }) => {
  expect(
    unwantedNetwork.get(page),
    'Fixtures must not call real Server Actions or hosted services',
  ).toEqual([]);
});

async function open(page: Page) {
  await page.goto('/fixtures/tenancy?fileTransport=intercepted');
  await expect(page.getByLabel('Fixture role')).toBeVisible();
  const origin = await page.locator('main').getAttribute('data-storage-origin');
  if (!origin) throw new Error('Missing synthetic Storage origin.');
  return origin;
}
async function expectLayout(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}
async function expectTimeValuesFit(page: Page, width: number) {
  const controls = page
    .getByRole('group', { name: /^Move (start|end) time \(required\)$/ })
    .locator('select');
  await expect(controls).toHaveCount(6);
  const sizes = await controls.evaluateAll((elements) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot measure selected time text.');
    return elements.map((element) => {
      if (!(element instanceof HTMLSelectElement))
        throw new Error('Expected a time select.');
      const text = element.selectedOptions[0]?.text;
      if (!text) throw new Error('The selected time is missing.');
      const style = getComputedStyle(element);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return {
        text,
        available:
          element.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight),
        required: context.measureText(text).width,
      };
    });
  });
  for (const size of sizes) {
    expect(
      size.available,
      `Selected time ${size.text} must be readable at ${width}px`,
    ).toBeGreaterThanOrEqual(size.required);
  }
}
async function files(page: Page, origin: string) {
  const requests: z.infer<typeof uploadInputSchema>[] = [];
  await page.route('**/api/files/upload-url', async (route) => {
    const parsed = uploadInputSchema.parse(route.request().postDataJSON());
    requests.push(parsed);
    const path = `${SOCIETY_ID}/moves/${parsed.moveId}/${parsed.kind}/${crypto.randomUUID()}.pdf`;
    await route.fulfill({
      json: {
        ok: true,
        data: {
          path,
          signedUrl: `${origin}/storage/v1/object/upload/sign/tenancy-files/${path}?token=fixture`,
        },
      },
    });
  });
  await page.route(`${origin}/storage/v1/object/upload/sign/**`, (route) =>
    route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : 200,
      headers: corsHeaders,
      body: '',
    }),
  );
  await page.route('**/api/files/url', async (route) => {
    const { path } = z
      .object({ bucket: z.literal('tenancy-files'), path: z.string() })
      .strict()
      .parse(route.request().postDataJSON());
    await route.fulfill({
      json: {
        ok: true,
        data: {
          signedUrl: `${origin}/storage/v1/object/sign/tenancy-files/${path}?token=fixture`,
          expiresIn: 300,
        },
      },
    });
  });
  return requests;
}
async function prepareCreate(page: Page) {
  await page
    .getByRole('combobox', { name: /Tenant or invitation/ })
    .fill('Synthetic');
  await page
    .getByRole('listbox')
    .getByRole('option', { name: 'Synthetic Tenant', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Create Move Request', exact: true }),
  ).toBeDisabled();
  const native = page.locator('input[type="date"]').last();
  if (await native.isVisible()) await native.fill('2026-11-30');
  else {
    await page.getByRole('button', { name: /Rental agreement expiry/ }).click();
    await page
      .getByRole('dialog', { name: 'Choose a date' })
      .getByRole('button', { name: /30 November.*2026/ })
      .click();
  }
}
async function create(page: Page) {
  await prepareCreate(page);
  await page
    .getByRole('button', { name: 'Create Move Request', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Move-in: Flat A-101', exact: true }),
  ).toBeVisible();
}
async function confirm(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: label, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: label, exact: true }).click();
}
async function check(page: Page, label: string) {
  const control = page.getByRole('checkbox', { name: label, exact: true });
  await expect(control).not.toBeChecked();
  await control.focus();
  await control.press('Space');
  await expect(control).toBeChecked();
}
function proofInput(page: Page, label = 'Rental agreement') {
  return page
    .locator('input[type="file"]')
    .and(page.getByLabel(label, { exact: true }));
}
function occupancy(page: Page) {
  return page
    .getByRole('status')
    .filter({ hasText: 'Synthetic Core tenant occupancy:' });
}
async function attach(page: Page, label = 'Rental agreement') {
  await proofInput(page, label).setInputFiles(proof);
  await expect(
    page.getByText(
      'Uploaded privately. Attach the proof below to save it to this request.',
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: `Attach ${label}`, exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: `View ${label}`, exact: true }),
  ).toBeVisible();
}

for (const width of [390, 1280]) {
  test(`move-in preserves retry identity and changes access only on actual completion at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const origin = await open(page);
    await files(page, origin);
    await check(page, 'Lose first creation response');
    await prepareCreate(page);
    await page
      .getByRole('button', { name: 'Create Move Request', exact: true })
      .click();
    await expect(page.locator('main').getByRole('alert')).toContainText(
      'Could not reach the server',
    );
    await expect(occupancy(page)).toContainText(
      'Creation attempts: 1. Unique creation keys: 1.',
    );
    await page
      .getByRole('button', { name: 'Create Move Request', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Move-in: Flat A-101', exact: true }),
    ).toBeVisible();
    await expect(occupancy(page)).toContainText(
      'Creation attempts: 2. Unique creation keys: 1.',
    );
    await expect(occupancy(page)).toContainText('not active');
    await expect(
      page.getByRole('button', { name: 'Approve Schedule', exact: true }),
    ).toHaveCount(0);
    await attach(page);
    await page.getByLabel('Fixture role').selectOption('owner');
    await confirm(page, 'Give Owner Consent');
    await expect(
      page.getByText('Consent from an active owner is recorded.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(occupancy(page)).toContainText('not active');
    await page.getByLabel('Fixture role').selectOption('admin');
    await confirm(page, 'Approve Schedule');
    await expect(
      page.getByText('Scheduled, not completed', { exact: true }),
    ).toBeVisible();
    await expect(occupancy(page)).toContainText('not active');
    await confirm(page, 'Confirm Actual Move-in');
    await expect(
      page.getByText(
        'Core tenant occupancy was activated when this move was completed.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(occupancy(page)).toContainText('occupancy: active.');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('move-out blocks positive dues, retains failures for retry, and expires private NOC links', async ({
  page,
}) => {
  const origin = await open(page);
  await files(page, origin);
  await page.getByLabel('Fixture scenario').selectOption('move_out');
  const details = page.getByRole('region', { name: 'Request details' });
  await expect(details.getByText('No NOC available')).toBeVisible();
  await expect(
    page.getByText('Dues: Not checked', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Fixture dues').selectOption('pending');
  await confirm(page, 'Approve Schedule');
  await expect(
    page.getByRole('button', { name: 'Confirm Actual Move-out', exact: true }),
  ).toHaveCount(0);
  await expect(occupancy(page)).toContainText('occupancy: active.');
  await page.getByLabel('Fixture dues').selectOption('cleared');
  await check(page, 'Fail next financial check');
  await confirm(page, 'Confirm Actual Move-out');
  const completion = page.getByRole('dialog', {
    name: 'Confirm Actual Move-out',
    exact: true,
  });
  await expect(completion.getByRole('alert')).toContainText(
    'The move was not completed',
  );
  await expect(completion.getByRole('alert')).toContainText('ERR-F1A2B3C4D5');
  await expect(occupancy(page)).toContainText('occupancy: active.');
  await completion
    .getByRole('button', { name: 'Confirm Actual Move-out', exact: true })
    .click();
  await expect(
    page.getByText(
      'Core tenant occupancy was ended when this move was completed.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel('Fixture dues').selectOption('pending');
  await expect(
    page.getByRole('button', { name: 'Issue Move-out NOC', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Fixture dues').selectOption('not_checked');
  await check(page, 'Fail next financial check');
  await confirm(page, 'Issue Move-out NOC');
  const issue = page.getByRole('dialog', {
    name: 'Issue Move-out NOC',
    exact: true,
  });
  await expect(issue.getByRole('alert')).toContainText('No NOC was issued');
  await expect(
    page.getByRole('button', { name: 'View Move-out NOC', exact: true }),
  ).toHaveCount(0);
  await issue
    .getByRole('button', { name: 'Issue Move-out NOC', exact: true })
    .click();
  await expect(
    details.getByText('Available in private documents'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'View Move-out NOC', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: /^Open Move-out NOC/ }),
  ).toHaveAttribute('rel', 'noopener noreferrer');
  await page.clock.fastForward(300_001);
  await expect(
    page.getByRole('link', { name: /^Open Move-out NOC/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      'The private link expired. Request a new link to open this document.',
      { exact: true },
    ),
  ).toBeVisible();
});

test('police-proof opt-in is confirmed and gates owner consent without collecting identity categories', async ({
  page,
}) => {
  const origin = await open(page);
  await files(page, origin);
  await check(page, 'Require police-verification proof');
  await confirm(page, 'Save Proof Requirement');
  await create(page);
  await attach(page);
  await page.getByLabel('Fixture role').selectOption('owner');
  const details = page.getByRole('region', { name: 'Request details' });
  await expect(details.getByText('Rental agreement expiry')).toBeVisible();
  await expect(
    details.getByText(
      'Required for this request; no retained proof is available.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Give Owner Consent', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel(/Aadhaar|government ID/, { exact: true }),
  ).toHaveCount(0);
  await attach(page, 'Police-verification proof');
  await expect(details.getByText('Proof attached')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Give Owner Consent', exact: true }),
  ).toBeVisible();
});

test('proof upload limits, Storage retries and attachment retries never imply premature success', async ({
  page,
}) => {
  const origin = await open(page);
  const requests = await files(page, origin);
  await create(page);
  const picker = proofInput(page);
  await picker.setInputFiles({
    name: 'wrong.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a proof'),
  });
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'Choose a file in one of these formats',
  );
  await picker.setInputFiles({
    ...proof,
    name: 'too-large.pdf',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'or smaller',
  );
  await picker.setInputFiles({
    ...proof,
    name: 'empty.pdf',
    buffer: Buffer.alloc(0),
  });
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'Choose a non-empty',
  );
  expect(requests).toHaveLength(0);
  await page
    .getByRole('button', { name: 'Remove empty.pdf', exact: true })
    .click();
  const pattern = `${origin}/storage/v1/object/upload/sign/**`;
  const failPut = (route: Route) =>
    route.fulfill({ status: 503, headers: corsHeaders, body: '' });
  await page.route(pattern, failPut);
  await check(page, 'Fail next proof attachment');
  await picker.setInputFiles({
    ...proof,
    buffer: Buffer.alloc(5 * 1024 * 1024, 37),
  });
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'The file could not be uploaded',
  );
  await expect(
    page.getByRole('button', { name: 'Attach Rental agreement', exact: true }),
  ).toBeDisabled();
  await page.unroute(pattern, failPut);
  await page
    .getByRole('button', { name: `Retry ${proof.name}`, exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Attach Rental agreement', exact: true }),
  ).toBeEnabled();
  expect(requests.at(-1)?.sizeBytes).toBe(5 * 1024 * 1024);
  await expect(
    page.getByText('No retained documents are attached.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Attach Rental agreement', exact: true })
    .click();
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'uploaded but not attached',
  );
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'ERR-A1B2C3D4E5',
  );
  const signedRequests = requests.length;
  await page
    .getByRole('button', { name: 'Attach Rental agreement', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'View Rental agreement', exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(signedRequests);
});

for (const fault of ['scope', 'origin', 'url-path', 'url-encoding'] as const) {
  test(`rejects a ${fault} mismatch before sending a private proof`, async ({
    page,
  }) => {
    const origin = await open(page);
    await create(page);
    let puts = 0;
    await page.route(
      `${origin}/storage/v1/object/upload/sign/**`,
      async (route) => {
        puts += 1;
        await route.fulfill({ headers: corsHeaders, body: '' });
      },
    );
    await page.route('**/api/files/upload-url', async (route) => {
      const request = uploadInputSchema.parse(route.request().postDataJSON());
      const path = `${SOCIETY_ID}/moves/${fault === 'scope' ? OTHER_MOVE_ID : request.moveId}/${request.kind}/${crypto.randomUUID()}.pdf`;
      const urlPath =
        fault === 'url-path'
          ? path.replace(request.moveId, OTHER_MOVE_ID)
          : fault === 'url-encoding'
            ? `${path}%`
            : path;
      await route.fulfill({
        json: {
          ok: true,
          data: {
            path,
            signedUrl: `${fault === 'origin' ? 'https://outside.example' : origin}/storage/v1/object/upload/sign/tenancy-files/${urlPath}?token=fixture`,
          },
        },
      });
    });
    await proofInput(page).setInputFiles(proof);
    await expect(page.locator('main').getByRole('alert')).toContainText(
      fault === 'scope' ? 'different request' : 'private file link is invalid',
    );
    await expect(
      page.getByRole('button', {
        name: 'Attach Rental agreement',
        exact: true,
      }),
    ).toBeDisabled();
    expect(puts).toBe(0);
  });
}

test('guard and committee schedules stay status-only through filtering and responsive layouts', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Fixture scenario').selectOption('scheduled');
  const main = page.locator('main');
  for (const role of ['guard', 'committee']) {
    await page.getByLabel('Fixture role').selectOption(role);
    await expect(
      main.getByText('Synthetic Tenant', { exact: true }),
    ).toHaveCount(0);
    await expect(main.getByRole('link')).toHaveCount(0);
    await expect(main.getByText('Rental agreement expiry')).toHaveCount(0);
    await expect(main.getByText('Police-verification proof')).toHaveCount(0);
    await expect(
      main.getByRole('button', {
        name: /Create Move Request|View Rental agreement|Approve Schedule/,
      }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page
      .getByLabel('Move status', { exact: true })
      .selectOption('completed');
    await page.keyboard.press('Escape');
    await expect(
      main.getByText('No matching move requests', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Clear Filters', exact: true })
      .click();
    await expect(main.getByText('A-101', { exact: true })).toBeVisible();
    for (const width of [320, 390, 768, 1280]) {
      await expectLayout(page, width);
    }
  }
});

test('read-only history, private-link denial and every standard route state stay explicit', async ({
  page,
}) => {
  const origin = await open(page);
  await files(page, origin);
  await page.getByLabel('Fixture scenario').selectOption('scheduled');
  await check(page, 'Read-only society');
  await expect(
    page.getByRole('button', { name: 'Create Move Request', exact: true }),
  ).toHaveCount(0);
  await page
    .locator('main')
    .getByRole('link')
    .filter({ hasText: 'A-101' })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Confirm Actual Move-in', exact: true }),
  ).toHaveCount(0);
  await page.route('**/api/files/url', (route) =>
    route.fulfill({
      status: 403,
      json: {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message:
            'This private file is unavailable. Refresh or ask an administrator.',
          referenceId: 'ERR-F1A2B3C4D5',
        },
      },
    }),
  );
  await page
    .getByRole('button', { name: 'View Rental agreement', exact: true })
    .click();
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'ERR-F1A2B3C4D5',
  );
  await expect(
    page.getByRole('link', { name: /^Open Rental agreement/ }),
  ).toHaveCount(0);
  for (const state of [
    'loading',
    'empty',
    'error',
    'disabled',
    'denied',
    'not_found',
    'invalid_filters',
  ]) {
    await page.getByLabel('Fixture scenario').selectOption(state);
    await page.setViewportSize({ width: 390, height: 900 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    if (state === 'loading')
      await expect(
        page.getByRole('status', { name: 'Loading moving requests' }),
      ).toBeVisible();
    else if (state === 'empty')
      await expect(
        page.getByText('No move requests yet', { exact: true }),
      ).toBeVisible();
    else if (state === 'error') {
      await expect(
        page.getByText('ERR-F1A2B3C4D5', { exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(
        page.getByText('No move requests yet', { exact: true }),
      ).toBeVisible();
    } else
      await expect(
        page.locator('main').getByRole('heading', { level: 1 }),
      ).toBeVisible();
  }
});

test('a late response for a removed proof cannot replace or upload over the newer selection', async ({
  page,
}) => {
  const origin = await open(page);
  await files(page, origin);
  await create(page);
  const storedPaths: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT')
      storedPaths.push(new URL(request.url()).pathname);
  });
  await page.evaluate(() => {
    const original = window.fetch;
    let first = true;
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (args[0] !== '/api/files/upload-url' || !first) return response;
      first = false;
      const detached = new Response(await response.arrayBuffer(), {
        status: response.status,
        headers: response.headers,
      });
      await new Promise<void>((resolve) => {
        window.addEventListener('release-tenancy-signer', () => resolve(), {
          once: true,
        });
        document.documentElement.dataset.tenancySignerReady = 'true';
      });
      document.documentElement.dataset.tenancySignerReleased = 'true';
      return detached;
    };
  });
  await proofInput(page).setInputFiles({ ...proof, name: 'old.pdf' });
  await expect(page.locator('html')).toHaveAttribute(
    'data-tenancy-signer-ready',
    'true',
  );
  await page
    .getByRole('button', { name: 'Remove old.pdf', exact: true })
    .click();
  await proofInput(page).setInputFiles({ ...proof, name: 'new.pdf' });
  await expect(
    page.getByText(
      'Uploaded privately. Attach the proof below to save it to this request.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new Event('release-tenancy-signer')),
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-tenancy-signer-released',
    'true',
  );
  await expect(page.getByText('new.pdf', { exact: true })).toBeVisible();
  await expect(page.getByText('old.pdf', { exact: true })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Attach Rental agreement', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'View Rental agreement', exact: true })
    .click();
  expect(storedPaths).toHaveLength(1);
  await expect(
    page.getByRole('link', { name: /^Open Rental agreement/ }),
  ).toHaveAttribute(
    'href',
    `${origin}${storedPaths[0]!.replace('/upload/sign/', '/sign/')}?token=fixture`,
  );
});

test('the default manual fixture keeps file operations in memory without any file HTTP', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/files/') || path.startsWith('/storage/v1/'))
      requests.push(path);
  });
  await page.goto('/fixtures/tenancy');
  await create(page);
  await attach(page);
  await page
    .getByRole('button', { name: 'View Rental agreement', exact: true })
    .click();
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'does not issue real file links',
  );
  await expect(
    page.getByRole('link', { name: /^Open Rental agreement/ }),
  ).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('create and private details remain accessible and reflow at every supported width', async ({
  page,
}) => {
  await open(page);
  for (const stage of ['create', 'private']) {
    if (stage === 'private') await create(page);
    for (const width of [320, 390, 768, 1280]) {
      await expectLayout(page, width);
      if (stage === 'create') await expectTimeValuesFit(page, width);
    }
  }
});

test('schedule pagination preserves exact totals and resets offsets for page-size and status changes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  await page.getByLabel('Fixture role').selectOption('committee');
  await page.getByLabel('Fixture scenario').selectOption('pagination');
  const pagination = page.getByRole('navigation', { name: 'Pagination' });
  const rows = page
    .getByRole('table', { name: 'Moving schedule' })
    .getByRole('row');
  await expect(pagination).toContainText('Page 1 of 3');
  await expect(pagination).toContainText('27 results');
  await expect(rows).toHaveCount(11);
  await pagination
    .getByRole('button', { name: 'Next page', exact: true })
    .click();
  await expect(pagination).toContainText('Page 2 of 3');
  await expect(rows).toHaveCount(11);
  await pagination
    .getByRole('button', { name: 'Next page', exact: true })
    .click();
  await expect(pagination).toContainText('Page 3 of 3');
  await expect(rows).toHaveCount(8);
  await page.getByLabel('Rows per page', { exact: true }).selectOption('25');
  await expect(pagination).toContainText('Page 1 of 2');
  await expect(rows).toHaveCount(26);
  await pagination
    .getByRole('button', { name: 'Next page', exact: true })
    .click();
  await expect(rows).toHaveCount(3);
  await expect(
    pagination.getByRole('button', { name: 'Next page', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page
    .getByLabel('Move status', { exact: true })
    .selectOption('approved');
  await page.keyboard.press('Escape');
  await expect(pagination).toContainText('Page 1 of 1');
  await expect(pagination).toContainText('14 results');
  await expect(rows).toHaveCount(15);
});
