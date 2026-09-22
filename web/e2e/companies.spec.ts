import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page, request }, info) => {
  const email = `companies-${info.testId}-${info.retry}@example.test`;
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email },
  });
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('fictional-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL('/app');
});
for (const theme of ['light', 'dark'] as const) {
  test(`company navigation, membership corrections and card actions in ${theme}`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page
      .getByRole('link', { name: 'View Northstar company' })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Northstar', level: 1 }),
    ).toBeVisible();
    const companyUrl = page.url();
    await expect(page.getByRole('button', { name: /Move / })).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`company-desktop-${theme}.png`),
      fullPage: true,
    });
    await page
      .getByRole('link', { name: /Open Senior Product Engineer/ })
      .click();
    await page
      .getByRole('textbox', { name: 'Add a note' })
      .fill('Ask about the fictional team.');
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(
      page.getByText('Comment saved.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Change company' }).click();
    const dialog = page.getByRole('dialog', { name: 'Change company' });
    await expect(dialog.getByRole('searchbox')).toBeFocused();
    await dialog.getByRole('radio', { name: 'Create a company' }).check();
    await dialog
      .getByLabel('Company name', { exact: true })
      .fill('Fictional Studio');
    await dialog.getByRole('button', { name: 'Save company' }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Change company' }),
    ).toBeFocused();
    await page.reload();
    await expect(
      page.getByRole('article', { name: 'Comment', exact: true }),
    ).toContainText('Ask about the fictional team.');
    await page
      .getByRole('link', { name: 'View Fictional Studio company' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Fictional Studio', level: 1 }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText('1 role', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
    await page.screenshot({
      path: info.outputPath(`company-mobile-${theme}.png`),
      fullPage: true,
    });
    const card = page.getByRole('article');
    await card.getByLabel('Posting actions').click();
    await page.keyboard.press('Escape');
    await expect(card.getByLabel('Posting actions')).toBeFocused();
    await card.getByLabel('Posting actions').click();
    await card.getByRole('button', { name: 'Refresh posting' }).click();
    await expect(
      card
        .getByRole('status')
        .filter({ hasText: /Refresh queued|Refreshing posting/ }),
    ).toBeVisible();
    await expect(
      card
        .getByRole('status')
        .filter({ hasText: /Refresh queued|Refreshing posting/ }),
    ).toBeHidden({ timeout: 15000 });
    await card.getByLabel('Posting actions').click();
    await card.getByRole('button', { name: 'Delete posting' }).click();
    await page
      .getByRole('dialog', { name: 'Delete posting?' })
      .getByRole('button', { name: 'Delete permanently' })
      .click();
    await expect(page.getByText('No roles at this company yet.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Fictional Studio', level: 1 }),
    ).toBeFocused();
    await page.goto(companyUrl);
    await expect(
      page.getByRole('heading', { name: 'Northstar', level: 1 }),
    ).toBeVisible();
  });
}
test('moving another role to a company shows all cards and persists across reload', async ({
  page,
}) => {
  await page
    .getByRole('link', { name: /Open Senior Product Engineer at Northstar/ })
    .click();
  await expect(page).toHaveURL(/\/app\/roles\//);
  const northstar = await page
    .getByRole('link', { name: 'View Northstar company' })
    .getAttribute('href');
  await page.getByRole('link', { name: 'Search board', exact: true }).click();
  const other = page
    .getByRole('link', { name: /^Open / })
    .filter({ hasText: /./ })
    .nth(1);
  await other.click();
  await page.getByRole('button', { name: 'Change company' }).click();
  await page
    .getByRole('dialog')
    .getByRole('radio', { name: /^Northstar/ })
    .check();
  await page.getByRole('button', { name: 'Save company' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goto(northstar as string);
  await expect(page.getByRole('article')).toHaveCount(3);
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(3);
});

test('company picker clears assignments and long company names reflow at enlarged text', async ({
  page,
}, info) => {
  await page
    .getByRole('link', { name: 'Open Senior Product Engineer at Northstar' })
    .click();
  await expect(page).toHaveURL(/\/app\/roles\//);
  await page.getByRole('button', { name: 'Change company' }).click();
  await page.getByRole('radio', { name: 'Leave unassigned' }).check();
  await page.getByRole('button', { name: 'Save company' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(
    page.getByText('Company unknown', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Change company' }).click();
  await page.getByRole('radio', { name: 'Create a company' }).check();
  const name = 'Fictional International Research and Development Cooperative';
  await page.getByLabel('Company name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save company' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('link', { name: `View ${name} company` }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({
    path: info.outputPath('company-long-name-mobile.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('company-zoom.png'),
    fullPage: true,
  });
});

test('company analysis initializes, shows evidence, refreshes and survives reload', async ({
  page,
}, info) => {
  await page
    .getByRole('link', { name: 'View Northstar company' })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Shared requirements' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Common tech stack' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'TypeScript', exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByText('Supporting evidence for TypeScript').focus();
  await page.keyboard.press('Enter');
  await expect(
    page
      .getByRole('region', { name: 'Common tech stack' })
      .getByRole('link')
      .first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Refresh analysis' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Analyzing saved information' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'TypeScript', exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.screenshot({
    path: info.outputPath('company-analysis-desktop.png'),
    fullPage: true,
  });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
    await page.screenshot({
      path: info.outputPath(`company-analysis-${theme}.png`),
      fullPage: true,
    });
  }
});

test('an analysis read failure keeps company roles available and can be retried', async ({
  page,
}) => {
  await page.route('**/api/job-postings/companies/*/analysis*', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await page
    .getByRole('link', { name: 'View Northstar company' })
    .first()
    .click();
  await expect(
    page.getByRole('region', { name: 'Across your roles' }).getByRole('alert'),
  ).toContainText('Your saved roles are still available');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.unroute('**/api/job-postings/companies/*/analysis*');
  await page.getByRole('button', { name: 'Reload analysis' }).click();
  await expect(
    page.getByRole('heading', { name: 'TypeScript', exact: true }),
  ).toBeVisible({ timeout: 15000 });
});

test('company header counts down scheduled analysis and Analyze now skips the wait', async ({
  page,
}, info) => {
  let requested = false;
  let requestCount = 0;
  const scheduledFor = new Date(Date.now() + 60000).toISOString();
  await page.clock.install();
  await page.route(
    '**/api/job-postings/companies/*/analysis*',
    async (route) => {
      if (route.request().method() === 'POST') {
        expect(route.request().postDataJSON().intent).toBe('refresh');
        requestCount++;
        requested = true;
      }
      if (requested) return route.continue();
      return route.fulfill({
        json: {
          schemaVersion: 1,
          status: 'scheduled',
          scheduledFor,
          generation: null,
          stale: false,
          totalRoles: 2,
          analyzedRoles: 0,
          completedAt: null,
          progress: 0,
          error: null,
          items: [],
          nextCursor: null,
        },
      });
    },
  );
  await page
    .getByRole('link', { name: 'View Northstar company' })
    .first()
    .click();
  const header = page.locator('header').filter({
    has: page.getByRole('heading', { name: 'Northstar', level: 1 }),
  });
  const status = header.getByRole('status', {
    name: 'Company analysis status',
  });
  await expect(status).toHaveText('Analysis scheduled');
  await expect(header.getByRole('timer')).toContainText('Starts in about');
  const headerBox = await header.boundingBox();
  const indicatorBox = await header
    .getByRole('button', { name: 'Analysis scheduled. Show details' })
    .boundingBox();
  if (!headerBox || !indicatorBox)
    throw new Error('Company header status is missing');
  expect(
    Math.abs(
      headerBox.x + headerBox.width - (indicatorBox.x + indicatorBox.width),
    ),
  ).toBeLessThan(2);
  await page.screenshot({
    path: info.outputPath('company-scheduled-desktop.png'),
    fullPage: true,
  });
  for (const theme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
    await page.screenshot({
      path: info.outputPath(`company-scheduled-${theme}.png`),
      fullPage: true,
    });
  }
  await page.reload();
  await expect(status).toHaveText('Analysis scheduled');
  await page.clock.fastForward(61000);
  await expect(status).toHaveText('Waiting to start');
  await expect(header.getByRole('timer')).toHaveCount(0);
  await header
    .getByRole('button', { name: 'Waiting to start. Show details' })
    .focus();
  await page.keyboard.press('Enter');
  await expect(header.getByText(/countdown is approximate/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    header.getByRole('button', { name: 'Waiting to start. Show details' }),
  ).toBeFocused();
  await header.getByRole('button', { name: 'Analyze now' }).focus();
  await page.keyboard.press('Enter');
  await expect(status).toHaveText('Analyzing…');
  await expect(
    header.getByRole('button', { name: 'Analyze now' }),
  ).toBeDisabled();
  await expect(status).toHaveText('Analysis up to date', { timeout: 15000 });
  expect(requestCount).toBe(1);
});
