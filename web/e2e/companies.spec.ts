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
