import { expect, type Page, test } from '@playwright/test';

test.beforeEach(async ({ page, request }, testInfo) => {
  const email = `workspace-${testInfo.testId}-${testInfo.retry}@example.test`;
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email },
  });
  await page.clock.setFixedTime(new Date('2026-09-18T16:00:00Z'));
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('fictional-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL('/app');
  await expect(
    page.getByRole('link', {
      name: 'Open Senior Product Engineer at Northstar',
    }),
  ).toBeVisible();
});

async function moveProductRole(page: Page, targetStage: string) {
  const handle = page.getByRole('button', {
    name: 'Move Senior Product Engineer at Northstar',
    exact: true,
  });
  const target = page.getByRole('region', { name: targetStage, exact: true });
  const handleBox = await handle.boundingBox();
  const targetBox = await target.boundingBox();
  if (!handleBox || !targetBox)
    throw new Error('Expected visible drag handle and column');
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 15,
    handleBox.y + handleBox.height / 2,
    { steps: 5 },
  );
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 65, {
    steps: 15,
  });
  await page.mouse.up();
  await expect(
    target.getByRole('link', {
      name: 'Open Senior Product Engineer at Northstar',
    }),
  ).toBeVisible();
  // Moving across columns remounts the handle; wait for the promised focus restoration
  // before starting another pointer or keyboard interaction.
  await expect(handle).toBeFocused();
  await expect(handle).toHaveAttribute('aria-pressed', 'false');
}

for (const scheme of ['light', 'dark'] as const) {
  test(`job details are ordered and readable on desktop and mobile in ${scheme}`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page
      .getByRole('link', { name: 'Open Senior Product Engineer at Northstar' })
      .click();
    const details = page.getByRole('region', {
      name: 'Job details',
      exact: true,
    });
    const overview = details.getByLabel('Job overview');
    await expect(overview).toContainText('170,000–210,000 USD / year');
    await expect(overview).toContainText('Full time');
    await expect(overview).toContainText('Remote');
    await expect(details.getByRole('heading', { level: 3 })).toHaveText([
      'Requirements',
      'Tech stack',
      'Responsibilities',
      'Full job details',
      'Compensation details',
    ]);
    await expect(
      details.getByRole('heading', { name: 'About the role', level: 4 }),
    ).toBeVisible();
    await expect(
      details.getByText('TypeScript (required)', { exact: true }),
    ).toBeVisible();
    await expect(
      details.getByText('PostgreSQL (preferred)', { exact: true }),
    ).toBeVisible();
    for (const [name, width] of [
      ['desktop', 1280],
      ['mobile', 390],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        scheme === 'dark' ? 'forest' : 'emerald',
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`job-details-${name}-${scheme}.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`job-details-zoom-${scheme}.png`),
      fullPage: true,
    });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '';
    });
    await page.reload();
    await expect(
      details.getByRole('heading', { name: 'About the role' }),
    ).toBeVisible();
  });
}

test('landing entry, capture, role editing, navigation, and reload recovery', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Open app' }).click();
  await expect(page).toHaveURL('/app');
  await page.screenshot({
    path: testInfo.outputPath('board-desktop.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Add job links' }).click();
  await page
    .getByRole('textbox', { name: 'Job link 1' })
    .fill('https://jobs.example.org/first');
  await page
    .getByRole('combobox', { name: /Interest.*for job link 1/ })
    .selectOption('highly-interested');
  await page.getByRole('textbox', { name: 'Job link 2' }).fill('not a URL');
  await page.getByRole('button', { name: 'Save to Collected' }).click();
  await expect(page.getByRole('textbox', { name: 'Job link 2' })).toBeFocused();
  await expect(
    page.getByRole('link', { name: 'Open Saved opening at Company unknown' }),
  ).toHaveCount(0);
  await page
    .getByRole('textbox', { name: 'Job link 2' })
    .fill('https://jobs.example.org/second');
  await page.getByRole('button', { name: 'Save to Collected' }).click();
  await expect(page.getByRole('textbox', { name: 'Job link 1' })).toBeFocused();
  await page
    .getByRole('link', { name: 'Open Saved opening at Company unknown' })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/roles\//);
  await page.screenshot({
    path: testInfo.outputPath('role-desktop.png'),
    fullPage: true,
  });
  const temporaryRoleUrl = page.url();
  await expect(
    page.getByText(
      /Job title, company, location, and posting details have not/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Interest', exact: true }),
  ).toHaveValue('highly-interested');
  await page
    .getByRole('combobox', { name: 'Stage', exact: true })
    .selectOption('applied');
  await page
    .getByRole('combobox', { name: 'Priority', exact: true })
    .selectOption('high');
  await page
    .getByRole('textbox', { name: 'Add a note' })
    .fill('Questions for the recruiter.');
  await page.getByRole('button', { name: 'Add comment' }).click();
  await expect(page.getByText('Comment saved.', { exact: true })).toBeVisible();
  await page.getByLabel('Next follow-up').fill('2026-10-01');
  await expect(page.getByLabel('Next follow-up')).toBeEnabled();
  await page.getByRole('link', { name: 'Search board', exact: true }).click();
  const moved = page
    .getByRole('region', { name: 'Applied', exact: true })
    .getByRole('article', { name: 'Saved opening at Company unknown' });
  await expect(moved).toBeVisible();
  await expect(moved).toContainText('Oct 1, 2026');
  await page.goBack();
  await expect(page.getByRole('textbox', { name: 'Add a note' })).toHaveValue(
    '',
  );
  await expect(
    page.getByRole('article', { name: 'Comment', exact: true }),
  ).toContainText('Questions for the recruiter.');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Add a note' })).toHaveValue(
    '',
  );
  await expect(
    page.getByRole('article', { name: 'Comment', exact: true }),
  ).toContainText('Questions for the recruiter.');
  expect(page.url()).toBe(temporaryRoleUrl);
  await expect(
    page.getByRole('combobox', { name: 'Stage', exact: true }),
  ).toHaveValue('applied');
});

test('drag moves to populated and empty columns, and Escape cancels', async ({
  page,
}) => {
  await page.goto('/app');
  await moveProductRole(page, 'Applied');
  await moveProductRole(page, 'Offer');
  const handle = page.getByRole('button', {
    name: 'Move Senior Product Engineer at Northstar',
    exact: true,
  });
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(
    page
      .getByRole('region', { name: 'Offer', exact: true })
      .getByRole('link', { name: 'Open Senior Product Engineer at Northstar' }),
  ).toBeVisible();
  await expect(handle).toBeFocused();
  await page
    .getByRole('link', { name: 'Open Senior Product Engineer at Northstar' })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Stage', exact: true }),
  ).toHaveValue('offer');
  await expect(
    page.getByRole('combobox', { name: 'Interest', exact: true }),
  ).toHaveValue('highly-interested');
  await expect(
    page.getByRole('combobox', { name: 'Priority', exact: true }),
  ).toHaveValue('high');
});

test('keyboard dragging changes stage and returns focus to the moved role', async ({
  page,
}) => {
  await page.goto('/app');
  const handle = page.getByRole('button', {
    name: 'Move Senior Product Engineer at Northstar',
    exact: true,
  });
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  for (let step = 0; step < 5; step++)
    await page.keyboard.press('Shift+ArrowRight');
  await expect(
    page.getByText('Over Applied. Drop to move here.', { exact: true }),
  ).toBeAttached();
  await page.keyboard.press('Space');
  await expect(
    page
      .getByRole('region', { name: 'Applied', exact: true })
      .getByRole('link', { name: 'Open Senior Product Engineer at Northstar' }),
  ).toBeVisible();
  await expect(handle).toBeFocused();
});

test('dropping outside the board keeps the original stage', async ({
  page,
}) => {
  await page.goto('/app');
  const handle = page.getByRole('button', {
    name: 'Move Senior Product Engineer at Northstar',
    exact: true,
  });
  const bounds = await handle.boundingBox();
  if (!bounds) throw new Error('Expected a visible drag handle');
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 20 });
  await expect(
    page.getByText('No stage selected. Release to cancel.', { exact: true }),
  ).toBeAttached();
  await page.mouse.up();
  await expect(
    page
      .getByRole('region', { name: 'Collected', exact: true })
      .getByRole('link', { name: 'Open Senior Product Engineer at Northstar' }),
  ).toBeVisible();
});

test.describe('touch interaction', () => {
  test.use({ hasTouch: true, viewport: { width: 900, height: 1000 } });

  test('touch dragging moves a role without opening it', async ({
    page,
    context,
  }) => {
    await page.goto('/app');
    const handle = page.getByRole('button', {
      name: 'Move Senior Product Engineer at Northstar',
      exact: true,
    });
    const target = page.getByRole('region', { name: 'Applied', exact: true });
    const start = await handle.boundingBox();
    const end = await target.boundingBox();
    if (!start || !end) throw new Error('Expected visible drag controls');
    const client = await context.newCDPSession(page);
    const x = start.x + start.width / 2;
    const y = start.y + start.height / 2;
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    await expect(handle).toHaveAttribute('aria-pressed', 'true');
    for (let step = 1; step <= 12; step++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: x + ((end.x + end.width / 2 - x) * step) / 12,
            y: y + ((end.y + 65 - y) * step) / 12,
          },
        ],
      });
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect(
      target.getByRole('link', {
        name: 'Open Senior Product Engineer at Northstar',
      }),
    ).toBeVisible();
    await expect(page).toHaveURL('/app');
  });
});

test('unfinished sections have no fictional materials or contacts', async ({
  page,
}) => {
  await page.goto('/app/roles/00000000-0000-4000-8000-000000000004');
  await expect(
    page.getByText('Not available yet', { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole('combobox', { name: 'Planned resume' }),
  ).toHaveCount(0);
  await expect(page.getByText('platform-engineering-v2.pdf')).toHaveCount(0);
});

test('mobile capture and workspace reflow in both themes', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/app');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'emerald');
  await page.screenshot({
    path: testInfo.outputPath('board-mobile-light.png'),
  });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');
  await page.getByRole('button', { name: 'Add job links' }).click();
  await page
    .getByRole('textbox', { name: 'Job link 1' })
    .fill(`https://example.org/${'long-posting-path-'.repeat(12)}`);
  await page.getByRole('button', { name: 'Save to Collected' }).click();
  await page
    .getByRole('link', { name: 'Open Saved opening at Company unknown' })
    .click();
  await expect(page).toHaveURL(/\/app\/roles\//);
  await expect(
    page.getByRole('heading', { name: 'Saved opening', level: 1 }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('role-mobile-dark.png'),
    fullPage: true,
  });
  const fitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fitsViewport).toBe(true);
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'emerald');
  await page.screenshot({
    path: testInfo.outputPath('role-mobile-light.png'),
    fullPage: true,
  });
});

test('refresh retains facts and drafts on failure, then replaces facts on explicit retry', async ({
  page,
}) => {
  await page
    .getByRole('link', { name: 'Open Senior Product Engineer at Northstar' })
    .click();
  const notes = page.getByRole('textbox', { name: 'Add a note' });
  await notes.fill('Keep my unsaved preparation');
  await page.getByLabel('Posting actions').click();
  await page
    .getByRole('button', { name: 'Refresh posting', exact: true })
    .click();
  await expect(
    page.getByText('Waiting to refresh posting details…'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Senior Product Engineer',
  );
  await expect(
    page.getByText(
      'Refresh could not finish. Your previous details are still shown.',
    ),
  ).toBeVisible({ timeout: 10000 });
  await expect(notes).toHaveValue('Keep my unsaved preparation');
  await page.getByLabel('Posting actions').click();
  await page.getByRole('button', { name: 'Retry extraction' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Refreshed Product Engineer',
    { timeout: 10000 },
  );
  await expect(notes).toHaveValue('Keep my unsaved preparation');
  await page.getByRole('button', { name: 'Add comment' }).click();
  await expect(page.getByText('Comment saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(notes).toHaveValue('');
  await expect(
    page.getByRole('article', { name: 'Comment', exact: true }),
  ).toContainText('Keep my unsaved preparation');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Refreshed Product Engineer',
  );
});

test('delete confirmation works by keyboard and removes the posting across reloads', async ({
  page,
}, testInfo) => {
  await page
    .getByRole('link', { name: 'Open Senior Product Engineer at Northstar' })
    .click();
  await expect(page).toHaveURL(/\/app\/roles\//);
  const original = page.url();
  const source = await page
    .getByRole('link', { name: /Open original posting/ })
    .getAttribute('href');
  const opener = page.getByLabel('Posting actions');
  const deleteAction = page.getByRole('button', {
    name: 'Delete posting',
    exact: true,
  });
  await opener.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Refresh posting', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await expect(deleteAction).not.toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.dropdown-content')).toHaveCSS('opacity', '1');
  await page.screenshot({
    path: testInfo.outputPath('actions-desktop.png'),
    animations: 'disabled',
  });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(deleteAction).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Delete posting?' });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    dialog.getByRole('button', { name: 'Delete permanently' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expect(dialog.locator('.modal-box')).toHaveCSS('opacity', '1');
  await expect(dialog.getByRole('heading')).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath('delete-desktop.png'),
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [scheme, theme] of [
    ['light', 'emerald'],
    ['dark', 'forest'],
  ] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await opener.click();
    await expect(page.locator('.dropdown-content')).toHaveCSS('opacity', '1');
    const menuBounds = await page.locator('.dropdown-content').boundingBox();
    expect(menuBounds?.x).toBeGreaterThanOrEqual(0);
    expect((menuBounds?.x ?? 0) + (menuBounds?.width ?? 0)).toBeLessThanOrEqual(
      390,
    );
    await page.screenshot({
      path: testInfo.outputPath(`actions-mobile-${scheme}.png`),
      animations: 'disabled',
    });
    await page.getByRole('heading', { level: 1 }).click();
    await expect(deleteAction).not.toBeVisible();
    await opener.click();
    await deleteAction.click();
    await expect(dialog).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`delete-mobile-${scheme}.png`),
      animations: 'disabled',
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  }
  await opener.click();
  await deleteAction.click();
  let failDelete = true;
  await page.route('**/api/job-postings/*', async (route) => {
    if (failDelete && route.request().method() === 'DELETE') {
      failDelete = false;
      return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
    }
    return route.continue();
  });
  await dialog.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Deletion could not be confirmed. Try again.',
  );
  await dialog.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page).toHaveURL('/app');
  await expect(
    page.getByRole('link', {
      name: 'Open Senior Product Engineer at Northstar',
    }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('link', {
      name: 'Open Senior Product Engineer at Northstar',
    }),
  ).toHaveCount(0);
  await page.goto(original);
  await expect(
    page.getByRole('heading', { name: 'Role not found' }),
  ).toBeVisible();
  await page.goto('/app');
  await page.getByRole('button', { name: 'Add job links' }).click();
  await page.getByRole('textbox', { name: 'Job link 1' }).fill(source ?? '');
  await page.getByRole('button', { name: 'Save to Collected' }).click();
  await page
    .getByRole('link', { name: 'Open Saved opening at Company unknown' })
    .click();
  expect(page.url()).not.toBe(original);
});

for (const theme of ['light', 'dark']) {
  test(`role chat persists updates, protects refresh, and undoes in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' });
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      theme === 'dark' ? 'forest' : 'emerald',
    );
    await page
      .getByRole('link', { name: 'Open Senior Product Engineer at Northstar' })
      .click();
    const chat = page.getByRole('region', { name: 'Update role', exact: true });
    await chat
      .getByRole('textbox', { name: 'Your update' })
      .fill(
        'Set title to Staff Product Engineer and priority high; salary is unclear',
      );
    await chat.getByRole('button', { name: 'Send', exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole('heading', {
        name: 'Staff Product Engineer',
        exact: true,
      }),
    ).toBeVisible();
    await expect(chat.getByText('Some changes saved')).toBeVisible();
    await expect(
      chat.getByText('Not changed: The salary is unclear.'),
    ).toBeVisible();
    await page.getByLabel('Posting actions').click();
    await page
      .getByRole('button', { name: 'Refresh posting', exact: true })
      .click();
    await expect(
      page.getByText(
        'Refresh could not finish. Your previous details are still shown.',
      ),
    ).toBeVisible();
    await page.getByLabel('Posting actions').click();
    await page
      .getByRole('button', { name: 'Retry extraction', exact: true })
      .click();
    await expect(
      page.getByText(
        'Your corrections are preserved when posting details refresh.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Staff Product Engineer',
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`role-chat-${theme}.png`),
      fullPage: true,
    });
    await chat.getByRole('button', { name: 'Undo changes' }).click();
    await expect(chat.getByText('Changes undone')).toBeVisible();
    await page.reload();
    await expect(chat.getByText('Changes undone')).toBeVisible();
  });
  test(`mobile role chat supports keyboard, retry and close in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' });
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      theme === 'dark' ? 'forest' : 'emerald',
    );
    await page
      .getByRole('link', { name: 'Open Senior Product Engineer at Northstar' })
      .click();
    const opener = page.getByRole('button', {
      name: 'Update role',
      exact: true,
    });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Update role' });
    const input = dialog.getByRole('textbox', { name: 'Your update' });
    await expect(input).toBeFocused();
    await input.fill('simulate failure');
    await input.press('Shift+Enter');
    await expect(input).toHaveValue('simulate failure\n');
    await input.press('Enter');
    await expect(
      dialog.getByText('Update failed', { exact: true }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Retry update' }).click();
    await expect(
      dialog.getByText('Changes saved', { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`role-chat-mobile-${theme}.png`),
      fullPage: false,
    });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    await page.reload();
    await opener.click();
    await expect(
      dialog.getByText('Changes saved', { exact: true }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(opener).toBeFocused();
  });
}

test('card actions refresh and delete in place without starting a drag', async ({
  page,
}, testInfo) => {
  const card = page.getByRole('article', {
    name: 'Senior Product Engineer at Northstar',
    exact: true,
  });
  const opener = card.getByLabel('Posting actions');
  await opener.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(
    card.getByRole('button', { name: 'Refresh posting', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const actionBounds = await opener.boundingBox();
      const moveBounds = await card
        .getByRole('button', { name: /^Move / })
        .boundingBox();
      expect(
        (actionBounds?.x ?? 0) + (actionBounds?.width ?? 0),
      ).toBeLessThanOrEqual(moveBounds?.x ?? 0);
      await opener.click();
      const menu = card.locator('.dropdown-content');
      await expect(menu).toHaveCSS('opacity', '1');
      const bounds = await menu.boundingBox();
      expect(bounds?.x).toBeGreaterThanOrEqual(0);
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
        width,
      );
      await page.screenshot({
        path: testInfo.outputPath(`card-actions-${width}-${scheme}.png`),
        animations: 'disabled',
      });
      await page.keyboard.press('Escape');
    }
  }
  await opener.click();
  await card
    .getByRole('button', { name: 'Refresh posting', exact: true })
    .click();
  await expect(card.getByText('Refresh queued…')).toBeVisible();
  await expect(page).toHaveURL('/app');
  await expect(card.getByText('Refresh queued…')).not.toBeVisible({
    timeout: 10000,
  });
  await opener.click();
  await card.getByRole('button', { name: 'Retry extraction' }).click();
  const refreshed = page.getByRole('article', {
    name: 'Refreshed Product Engineer at Northstar',
    exact: true,
  });
  await expect(refreshed).toBeVisible({ timeout: 10000 });
  const refreshedOpener = refreshed.getByLabel('Posting actions');
  await refreshedOpener.click();
  await refreshed
    .getByRole('button', { name: 'Delete posting', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Delete posting?' });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(refreshedOpener).toBeFocused();
  await refreshedOpener.click();
  await refreshed
    .getByRole('button', { name: 'Delete posting', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(refreshed).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Your search' }),
  ).toBeFocused();
  await expect(page).toHaveURL('/app');
  await page.reload();
  await expect(refreshed).toHaveCount(0);
  await expect(
    page.getByText('4 active roles', { exact: false }),
  ).toBeVisible();
});

for (const viewport of [
  { name: 'desktop light', width: 1440, height: 1000, scheme: 'light' },
  { name: 'mobile dark', width: 390, height: 844, scheme: 'dark' },
]) {
  test(`board status keeps layout steady during loading and errors on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({
      colorScheme: viewport.scheme as 'light' | 'dark',
      reducedMotion: 'reduce',
    });
    let finishRequest: () => void = () => {};
    let fail = false;
    await page.route('**/api/job-postings?*', async (route) => {
      await new Promise<void>((resolve) => {
        finishRequest = resolve;
      });
      if (fail) await route.fulfill({ status: 503, json: {} });
      else await route.continue();
    });
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Your search' }),
    ).toBeVisible();
    const positions = async () =>
      Promise.all(
        [
          page.getByRole('heading', { name: 'Your search' }),
          page.getByRole('button', { name: 'Add job links' }),
          page.getByRole('region', { name: 'Collected', exact: true }),
        ].map(async (locator) => (await locator.boundingBox())?.y),
      );
    const loadingPositions = await positions();
    await page.screenshot({
      path: testInfo.outputPath('status-loading.png'),
      fullPage: true,
    });
    finishRequest();
    await expect(
      page.getByRole('link', {
        name: 'Open Senior Product Engineer at Northstar',
      }),
    ).toBeVisible();
    expect(await positions()).toEqual(loadingPositions);
    await expect(page.getByRole('status', { name: 'Board status' })).toHaveText(
      'Board up to date',
    );
    await page.screenshot({
      path: testInfo.outputPath('status-idle.png'),
      fullPage: true,
    });

    fail = true;
    await page.reload();
    await expect(page.getByRole('status', { name: 'Board status' })).toHaveText(
      'Loading your saved roles…',
    );
    const pendingPositions = await positions();
    finishRequest();
    const error = page.getByRole('button', {
      name: 'Board request failed. Show details',
    });
    await expect(error).toBeVisible();
    expect(await positions()).toEqual(pendingPositions);
    await error.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'We could not complete that request',
    );
    expect(await positions()).toEqual(pendingPositions);
    await page.screenshot({
      path: testInfo.outputPath('status-error.png'),
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(error).toBeFocused();
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
    await error.click();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('status', { name: 'Board status' })).toHaveText(
      'Loading your saved roles…',
    );
    finishRequest();
    await expect(page.getByRole('status', { name: 'Board status' })).toHaveText(
      'Board up to date',
    );
    expect(await positions()).toEqual(pendingPositions);
    await page.unroute('**/api/job-postings?*');
    if (viewport.width > 1000) {
      await page.route('**/api/job-postings/*', async (route) => {
        if (route.request().method() === 'PATCH') {
          await new Promise<void>((resolve) => {
            finishRequest = resolve;
          });
        }
        await route.continue();
      });
      const moving = moveProductRole(page, 'Applied');
      await expect(
        page.getByRole('status', { name: 'Board status' }),
      ).toHaveText('Saving stage…');
      expect(await positions()).toEqual(pendingPositions);
      finishRequest();
      await moving;
      await expect(
        page.getByRole('status', { name: 'Board status' }),
      ).toHaveText('Board up to date');
      expect(await positions()).toEqual(pendingPositions);
    }
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`notes support Markdown, editing and deletion on desktop and mobile in ${scheme}`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page
      .getByRole('link', { name: 'Open Senior Product Engineer at Northstar' })
      .click();
    const section = page.getByRole('region', { name: 'Notes', exact: true });
    await expect(
      section.getByText('No comments yet. Add your first note above.'),
    ).toBeVisible();
    await section
      .getByRole('textbox', { name: 'Add a note' })
      .fill(
        '## Interview prep\n\n- **Ask about the team**\n- Review the [role](https://example.com/role)\n\n<script>inert</script>\n![blocked](https://example.com/image.png)',
      );
    await section.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(
      section.getByRole('region', { name: 'Add a note preview' }),
    ).toContainText('Ask about the team');
    await expect(section.locator('img')).toHaveCount(0);
    await section.getByRole('button', { name: 'Write', exact: true }).click();
    const composer = section.getByRole('textbox', { name: 'Add a note' });
    const draft = await composer.inputValue();
    await composer.press('ControlOrMeta+End');
    await composer.press('Enter');
    await expect(composer).toHaveValue(`${draft}\n`);
    await expect(
      section.getByRole('article', { name: 'Comment', exact: true }),
    ).toHaveCount(0);
    await composer.press('Meta+Enter');
    await expect(
      section.getByText('Comment saved.', { exact: true }),
    ).toBeVisible();
    await expect(
      section.getByRole('textbox', { name: 'Add a note' }),
    ).toHaveValue('');
    await page.reload();
    const entry = section.getByRole('article', {
      name: 'Comment',
      exact: true,
    });
    await expect(entry).toContainText('Interview prep');
    await entry.getByRole('button', { name: 'Edit comment' }).click();
    await entry
      .getByRole('textbox', { name: 'Edit comment' })
      .fill(
        'Updated **interview prep**\n\n' +
          'Long fictional preparation text. '.repeat(10),
      );
    await entry
      .getByRole('textbox', { name: 'Edit comment' })
      .press('Meta+Enter');
    await expect(entry).toContainText('Edited');
    await page.screenshot({
      path: testInfo.outputPath(`notes-desktop-${scheme}.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`notes-mobile-${scheme}.png`),
      fullPage: true,
    });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await expect(
      section.getByRole('button', { name: 'Add comment' }),
    ).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.zoom = '';
    });
    await entry.getByRole('button', { name: 'Delete comment' }).click();
    await expect(
      entry.getByRole('button', { name: 'Cancel deletion' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      entry.getByRole('button', { name: 'Delete comment' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(entry).toHaveCount(0);
    await page.reload();
    await expect(
      section.getByText('No comments yet. Add your first note above.'),
    ).toBeVisible();
  });
}
