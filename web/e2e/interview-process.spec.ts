import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page, request }, info) => {
  const email = `interviews-${info.testId}-${info.retry}@example.test`;
  await request.post('http://127.0.0.1:3101/__test/account', {
    data: { email },
  });
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('fictional-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page
    .getByRole('link', { name: 'Open Senior Product Engineer at Northstar' })
    .click();
  await page
    .getByRole('combobox', { name: 'Stage', exact: true })
    .selectOption('interviewing');
  await expect(
    page.getByRole('button', { name: 'Set up interview stages' }),
  ).toBeEnabled();
});

for (const theme of ['light', 'dark'] as const) {
  test(`sets up a full transcript, moves the card, and preserves the process on mobile in ${theme}`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.getByRole('button', { name: 'Set up interview stages' }).click();
    const dialog = page.getByRole('dialog', {
      name: 'Set up interview stages',
    });
    await dialog
      .getByLabel('Recruiter transcript')
      .fill('Fictional recruiter conversation. '.repeat(1000));
    await dialog
      .getByRole('button', { name: 'Extract interview stages' })
      .click();
    await expect(dialog).not.toBeVisible();
    const board = page.getByRole('region', {
      name: 'Interview process',
      exact: true,
    });
    const move = board.getByRole('combobox', { name: 'Move to stage' });
    await expect(move).toHaveValue('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    const controls = await page
      .getByRole('combobox', { name: 'Priority', exact: true })
      .boundingBox();
    const boardBox = await board.boundingBox();
    const details = await page
      .getByRole('region', { name: 'Job details', exact: true })
      .boundingBox();
    expect(boardBox?.y).toBeGreaterThan(
      (controls?.y ?? 0) + (controls?.height ?? 0),
    );
    expect(details?.y).toBeGreaterThan(
      (boardBox?.y ?? 0) + (boardBox?.height ?? 0),
    );
    await page.screenshot({
      path: info.outputPath(`interviews-${theme}-desktop.png`),
      fullPage: true,
    });
    await move.selectOption('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    await expect(move).toBeEnabled();
    await page.reload();
    await expect(move).toHaveValue('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    await page
      .getByRole('combobox', { name: 'Stage', exact: true })
      .selectOption('offer');
    await expect(board).not.toBeVisible();
    await expect(
      page.getByRole('combobox', { name: 'Stage', exact: true }),
    ).toBeEnabled();
    await page
      .getByRole('combobox', { name: 'Stage', exact: true })
      .selectOption('interviewing');
    await expect(move).toHaveValue('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    await page.setViewportSize({ width: 390, height: 844 });
    await move.selectOption('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    await expect(move).toBeEnabled();
    await page
      .getByRole('button', { name: 'Edit stages', exact: true })
      .click();
    const editor = page.getByRole('dialog', { name: 'Edit interview stages' });
    await editor
      .getByRole('textbox', { name: 'Stage 1' })
      .fill('Recruiter screen');
    await editor.getByRole('button', { name: 'Save stages' }).click();
    await expect(editor).not.toBeVisible();
    await expect(
      board.getByRole('heading', { name: 'Recruiter screen' }),
    ).toBeVisible();
    await expect(
      board.getByRole('article', { name: 'Current interview card' }),
    ).toHaveCount(1);
    await page.screenshot({
      path: info.outputPath(`interviews-${theme}-mobile.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole('button', { name: 'Edit stages', exact: true })
      .click();
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Edit stages', exact: true }),
    ).toBeFocused();
  });
}

test('manual setup supports pointer dragging, cancel, and keyboard movement', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Set up interview stages' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Enter stages manually' }).click();
  for (const [i, name] of ['Recruiter', 'Technical', 'Final'].entries()) {
    await dialog.getByRole('button', { name: 'Add stage' }).click();
    await dialog.getByRole('textbox', { name: `Stage ${i + 1}` }).fill(name);
  }
  await dialog
    .getByRole('combobox', { name: 'Current stage' })
    .selectOption({ label: 'Recruiter' });
  await dialog.getByRole('button', { name: 'Save stages' }).click();
  await expect(dialog).not.toBeVisible();
  const board = page.getByRole('region', {
    name: 'Interview process',
    exact: true,
  });
  const handle = board.getByRole('button', { name: 'Move interview card' });
  const target = board.getByRole('heading', { name: 'Technical', exact: true });
  await handle.scrollIntoViewIfNeeded();
  const start = await handle.boundingBox();
  const end = await target.boundingBox();
  if (!start || !end) throw new Error('Missing board geometry');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + 15, start.y, { steps: 5 });
  await page.mouse.move(end.x + 40, end.y + 70, { steps: 15 });
  await page.mouse.up();
  const move = board.getByRole('combobox', { name: 'Move to stage' });
  await expect(move.locator('option:checked')).toHaveText('Technical');
  await expect(handle).toBeFocused();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(move.locator('option:checked')).toHaveText('Technical');
  await expect(handle).toHaveAttribute('aria-pressed', 'false');
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  for (let step = 0; step < 5; step++)
    await page.keyboard.press('Shift+ArrowLeft');
  await expect(
    page.getByText('Over Recruiter. Drop to select it.', { exact: true }),
  ).toBeAttached();
  await page.keyboard.press('Space');
  await expect(move.locator('option:checked')).toHaveText('Recruiter');
  await page.reload();
  await expect(move.locator('option:checked')).toHaveText('Recruiter');
});
