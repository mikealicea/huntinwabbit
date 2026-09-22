import { expect, type Page, test } from '@playwright/test';

async function login(
  page: Page,
  email = 'workspace@example.test',
  password = 'fictional-password',
) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

test('home redirects by verified session and requires cache revalidation', async ({
  page,
  context,
}) => {
  const response = await page.request.get('/', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(
    new URL(response.headers().location, 'http://127.0.0.1:3100').pathname,
  ).toBe('/login');
  // Next's development server replaces Cache-Control with its no-cache policy.
  expect(response.headers()['cache-control']).toContain('no-cache');
  expect(response.headers().pragma).toBe('no-cache');
  await page.goto('/');
  await expect(page).toHaveURL('/login');
  const session = await (
    await page.request.post('http://127.0.0.1:3101/__test/session', {
      data: { email: 'workspace@example.test' },
    })
  ).json();
  await context.addCookies([
    {
      name: 'huntinwabbit-auth',
      value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto('/');
  await expect(page).toHaveURL('/app');
});

test('protects deep links, persists sessions, redirects authenticated visitors, and signs out', async ({
  page,
  context,
}) => {
  await page.goto('/app/roles/00000000-0000-4000-8000-000000000004');
  await expect(page).toHaveURL(
    '/login?next=%2Fapp%2Froles%2F00000000-0000-4000-8000-000000000004',
  );
  await login(page);
  await expect(page).toHaveURL(
    '/app/roles/00000000-0000-4000-8000-000000000004',
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Platform Engineer' }),
  ).toBeVisible();
  const cookies = await context.cookies();
  expect(
    cookies
      .filter((cookie) => cookie.name.startsWith('huntinwabbit-auth'))
      .every((cookie) => cookie.httpOnly && cookie.sameSite === 'Lax'),
  ).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    'huntinwabbit-auth',
  );
  await page.goto('/signup');
  await expect(page).toHaveURL('/app');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/login?notice=signed-out');
  await page.goto('/app');
  await expect(page).toHaveURL('/login?next=%2Fapp');
});

test('validates input, handles credentials and rate limits, and rejects external return URLs', async ({
  page,
}) => {
  await page.goto('/login?next=https://evil.example');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await login(page, 'missing@example.test');
  await expect(page.getByText('Email or password is incorrect.')).toBeVisible();
  await login(page, 'rate-limit@example.test');
  await expect(page.getByText(/Too many attempts/)).toBeVisible();
  await login(page);
  await expect(page).toHaveURL('/app');
});

test('signs up, resends confirmation, and confirms in a fresh browser without consuming previewed links', async ({
  page,
  request,
  browser,
}) => {
  const email = 'signup-flow@example.test';
  await page.goto('/signup');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page
    .getByLabel('New password', { exact: true })
    .fill('fictional-password');
  await page.getByLabel('Confirm password', { exact: true }).fill('different');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByText('Passwords must match.')).toBeVisible();
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('fictional-password');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByText(/If this address is eligible/)).toBeVisible();
  await page.getByRole('button', { name: 'Resend confirmation email' }).click();
  await expect(page.getByText(/If this address is eligible/)).toHaveCount(2);
  const { link } = await (
    await request.post('http://127.0.0.1:3101/__test/message', {
      data: { email, type: 'email' },
    })
  ).json();
  const preview = await request.get(link);
  expect(preview.status()).toBe(200);
  const fresh = await browser.newContext();
  const otherPage = await fresh.newPage();
  await otherPage.goto(link);
  await otherPage
    .getByRole('button', { name: 'Confirm email', exact: true })
    .click();
  await expect(otherPage).toHaveURL('http://127.0.0.1:3100/app');
  await otherPage.goto(link);
  await otherPage
    .getByRole('button', { name: 'Confirm email', exact: true })
    .click();
  await expect(otherPage.getByText(/invalid or has expired/)).toBeVisible();
  await fresh.close();
});

test('recovers a password in a new browser and requires the new password afterward', async ({
  page,
  request,
  browser,
}) => {
  const email = 'recovery-flow@example.test';
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email },
  });
  await page.goto('/forgot-password');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset email' }).click();
  await expect(page.getByText(/If this address is eligible/)).toBeVisible();
  const { link } = await (
    await request.post('http://127.0.0.1:3101/__test/message', {
      data: { email, type: 'recovery' },
    })
  ).json();
  const fresh = await browser.newContext();
  const otherPage = await fresh.newPage();
  await otherPage.goto(link);
  await otherPage
    .getByRole('button', { name: 'Continue to reset password' })
    .click();
  await expect(otherPage).toHaveURL('http://127.0.0.1:3100/reset-password');
  await otherPage
    .getByLabel('New password', { exact: true })
    .fill('updated-fictional-password');
  await otherPage
    .getByLabel('Confirm password', { exact: true })
    .fill('updated-fictional-password');
  await otherPage.getByRole('button', { name: 'Save new password' }).click();
  await expect(otherPage).toHaveURL(
    'http://127.0.0.1:3100/login?notice=password-changed',
  );
  await login(otherPage, email);
  await expect(
    otherPage.getByText('Email or password is incorrect.'),
  ).toBeVisible();
  await login(otherPage, email, 'updated-fictional-password');
  await expect(otherPage).toHaveURL('http://127.0.0.1:3100/app');
  await fresh.close();
});

test('handles unconfirmed accounts, invalid links, and missing recovery sessions', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email: 'unconfirmed@example.test', confirmed: false },
  });
  await page.goto('/login');
  await login(page, 'unconfirmed@example.test');
  await expect(
    page.getByText(/Confirm your email before logging in/),
  ).toBeVisible();
  await page.goto(`/auth/confirm?token_hash=${'a'.repeat(56)}&type=recovery`);
  await page
    .getByRole('button', { name: 'Continue to reset password' })
    .click();
  await expect(page.getByText(/invalid or has expired/)).toBeVisible();
  await page.goto('/reset-password');
  await expect(
    page.getByRole('heading', { name: 'Request a new reset link' }),
  ).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('absent@example.test');
  await page.getByRole('button', { name: 'Send reset email' }).click();
  await expect(page.getByText(/If this address is eligible/)).toBeVisible();
});

test('retains password success after failed provider logout and removes browser credentials', async ({
  page,
  request,
  context,
}) => {
  const email = 'logout-failure@example.test';
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email, logoutFailure: true },
  });
  await page.goto('/login');
  await login(page, email);
  await expect(page).toHaveURL('/app');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/login?notice=signout-incomplete');
  await login(page, email);
  await expect(page).toHaveURL('/app');
  await page.goto('/reset-password');
  await page
    .getByLabel('New password', { exact: true })
    .fill('updated-fictional-password');
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('updated-fictional-password');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page).toHaveURL(
    '/login?notice=password-changed-signout-incomplete',
  );
  await expect(
    page.getByText(/Your password has been changed and this browser/),
  ).toBeVisible();
  expect(
    (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith('huntinwabbit-auth'),
    ),
  ).toHaveLength(0);
});

test('refreshes an expired cookie through the real SDK and rejects a forged session', async ({
  page,
  request,
  context,
}) => {
  const response = await request.post('http://127.0.0.1:3101/__test/session', {
    data: { email: 'workspace@example.test' },
  });
  const session = await response.json();
  session.expires_at = 1;
  const encode = (value: unknown) =>
    `base64-${Buffer.from(JSON.stringify(value)).toString('base64url')}`;
  await context.addCookies([
    {
      name: 'huntinwabbit-auth',
      value: encode(session),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto('/');
  await expect(page).toHaveURL('/app');
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === 'huntinwabbit-auth',
    )?.value,
  ).not.toBe(encode(session));
  await context.clearCookies();
  await context.addCookies([
    {
      name: 'huntinwabbit-auth',
      value: encode({
        ...session,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        access_token: 'forged',
      }),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  await page.goto('/');
  await expect(page).toHaveURL('/login');
});

test('auth forms reflow on mobile in both themes with keyboard focus and enlarged text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/signup');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'emerald');
});

test('fails closed during a verification outage and recovers without a login loop', async ({
  page,
  request,
}) => {
  const email = 'lookup-outage@example.test';
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email, lookupFailure: true },
  });
  await page.goto('/login');
  await login(page, email);
  await expect(
    page.getByRole('heading', { name: 'Unable to connect' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add job links' })).toHaveCount(
    0,
  );
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email, lookupFailure: false },
  });
  await page.getByRole('link', { name: 'Try again' }).click();
  await expect(page).toHaveURL('/app');
  await expect(
    page.getByRole('button', { name: 'Add job links' }),
  ).toBeVisible();
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email, lookupFailure: true },
  });
  await page.goto('/');
  await expect(page).toHaveURL('/auth/unavailable?next=%2F');
});

test('captures account pages for visual review at desktop and mobile sizes', async ({
  page,
}, testInfo) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    for (const path of ['/login', '/signup', '/forgot-password']) {
      await page.goto(path);
      await page.screenshot({
        path: testInfo.outputPath(`${path.slice(1)}-${width}-light.png`),
        fullPage: true,
        caret: 'initial',
      });
    }
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await page.screenshot({
      path: testInfo.outputPath(`forgot-password-${width}-dark.png`),
      fullPage: true,
      caret: 'initial',
    });
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
  }
});
