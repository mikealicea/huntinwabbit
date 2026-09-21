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
    .getByRole('textbox', { name: 'Prep & interview notes' })
    .fill('Questions for the recruiter.');
  await page.getByRole('button', { name: 'Save notes' }).click();
  await expect(page.getByText('Notes saved.', { exact: true })).toBeVisible();
  await page.getByLabel('Next follow-up').fill('2026-10-01');
  await expect(page.getByLabel('Next follow-up')).toBeEnabled();
  await page.getByRole('link', { name: 'Search board', exact: true }).click();
  const moved = page
    .getByRole('region', { name: 'Applied', exact: true })
    .getByRole('article', { name: 'Saved opening at Company unknown' });
  await expect(moved).toBeVisible();
  await expect(moved).toContainText('Oct 1, 2026');
  await page.goBack();
  await expect(
    page.getByRole('textbox', { name: 'Prep & interview notes' }),
  ).toHaveValue('Questions for the recruiter.');
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'Prep & interview notes' }),
  ).toHaveValue('Questions for the recruiter.');
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
