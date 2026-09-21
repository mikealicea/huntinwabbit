import { expect, test } from '@playwright/test';

test('public entry and authenticated API request, failure, retry and reload', async ({
  page,
  request,
}) => {
  const email = 'hello-flow@example.test';
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email },
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'huntinwabbit-boilerplate' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Open app' }).click();
  await expect(page).toHaveURL('/login?next=%2Fapp');
  expect((await request.get('/api/hello')).status()).toBe(401);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('fictional-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL('/app');
  await expect(page.getByText('No request yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Call API' }).click();
  await expect(page.getByRole('status', { name: 'API response' })).toHaveText(
    'Hello, world!',
  );
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email, helloFailure: true },
  });
  await page.getByRole('button', { name: 'Call API' }).click();
  await expect(page.getByRole('status', { name: 'API response' })).toHaveText(
    'Unable to reach the API. Please try again.',
  );
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email, helloFailure: false },
  });
  await page.getByRole('button', { name: 'Call API' }).click();
  await expect(page.getByRole('status', { name: 'API response' })).toHaveText(
    'Hello, world!',
  );
  await page.reload();
  await expect(page.getByText('No request yet.')).toBeVisible();
});

test('captures the public and signed-in pages at desktop/mobile widths in both themes', async ({
  page,
  request,
}, testInfo) => {
  const email = 'hello-visual@example.test';
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email },
  });
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('fictional-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL('/app');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(
        (value) => localStorage.setItem('theme', value),
        theme,
      );
      for (const path of ['/', '/app']) {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          theme === 'light' ? 'emerald' : 'forest',
        );
        if (path === '/app') {
          await page.getByRole('button', { name: 'Call API' }).click();
          await expect(
            page.getByRole('status', { name: 'API response' }),
          ).toHaveText('Hello, world!');
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(
            `${path === '/' ? 'home' : 'hello'}-${width}-${theme}.png`,
          ),
          fullPage: true,
        });
      }
    }
  }
});
