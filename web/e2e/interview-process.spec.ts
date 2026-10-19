import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';

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
    const stepOpener = board.getByRole('button', {
      name: 'Open Technical interview notes and details',
    });
    await stepOpener.click();
    const stepDialog = page.getByRole('dialog', {
      name: 'Technical interview',
      exact: true,
    });
    await expect(
      stepDialog.getByRole('button', { name: 'Close', exact: true }),
    ).toBeFocused();
    await expect(
      stepDialog.getByText(/60-minute pair programming/),
    ).toBeVisible();
    await stepDialog
      .getByRole('textbox', { name: 'Add a note', exact: true })
      .fill('**Prepare:** Explain testing decisions.');
    await stepDialog
      .getByRole('button', { name: 'Add comment', exact: true })
      .click();
    await expect(
      stepDialog.getByRole('article', { name: 'Comment', exact: true }),
    ).toHaveCount(1);
    await page.screenshot({
      path: info.outputPath(`stage-notes-${theme}-desktop.png`),
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await expect(stepDialog).not.toBeVisible();
    await expect(stepOpener).toBeFocused();
    const roleNotes = page.locator('#role-notes');
    await expect(
      roleNotes.getByRole('article', { name: 'Comment', exact: true }),
    ).toHaveCount(1);
    await roleNotes
      .getByRole('combobox', { name: 'Interview step', exact: true })
      .first()
      .selectOption('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    await roleNotes
      .getByRole('textbox', { name: 'Add a note', exact: true })
      .fill('Ask about code review culture.');
    await roleNotes
      .getByRole('button', { name: 'Add comment', exact: true })
      .click();
    await expect(
      roleNotes.getByRole('textbox', { name: 'Add a note', exact: true }),
    ).toHaveValue('');
    await page.reload();
    await stepOpener.click();
    await expect(
      stepDialog.getByRole('article', { name: 'Comment', exact: true }),
    ).toHaveCount(2);
    const firstComment = stepDialog
      .getByRole('article', { name: 'Comment', exact: true })
      .first();
    await firstComment
      .getByRole('button', { name: 'Edit comment', exact: true })
      .click();
    await firstComment
      .getByRole('textbox', { name: 'Edit comment', exact: true })
      .fill('Ask about code review and pairing.');
    await firstComment
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(
      firstComment.getByText('Ask about code review and pairing.', {
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(
      roleNotes.getByText('Ask about code review and pairing.', {
        exact: true,
      }),
    ).toBeVisible();
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
    await stepOpener.click();
    await expect(
      stepDialog.getByRole('article', { name: 'Comment', exact: true }),
    ).toHaveCount(2);
    await expect(stepDialog).toHaveCSS('opacity', '1');
    await page.screenshot({
      path: info.outputPath(`stage-notes-${theme}-mobile.png`),
      animations: 'disabled',
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await expect(
      stepDialog.getByRole('button', { name: 'Close', exact: true }),
    ).toBeVisible();
    expect(
      await stepDialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(stepOpener).toBeFocused();
    await page.evaluate(() => {
      document.documentElement.style.zoom = '';
    });
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
  await expect(handle).toBeFocused();
  await expect(async () => {
    await handle.press('Space');
    await expect(handle).toHaveAttribute('aria-pressed', 'true', {
      timeout: 300,
    });
  }).toPass({ timeout: 3000, intervals: [100] });
  await expect(async () => {
    await page.keyboard.press('Shift+ArrowLeft');
    expect(
      await page
        .getByText('Over Recruiter. Drop to select it.', { exact: true })
        .count(),
    ).toBe(1);
  }).toPass({ timeout: 3000, intervals: [100] });
  await page.keyboard.press('Space');
  await expect(move.locator('option:checked')).toHaveText('Recruiter');
  await page.reload();
  await expect(move.locator('option:checked')).toHaveText('Recruiter');
});

const prepText = {
  coding:
    'PREP-CODING: Implement a queue.\n```ts\nconst queue = ["λ"];\n```\nExplain time complexity.',
  prior: 'PREP-PRIOR: Recruiter described the fictional team.',
  email:
    'PREP-ROLE-EMAIL: Dear candidate,\nOur company interview includes pairing.\nRegards, Fictional recruiter',
  company: 'PREP-COMPANY: Saved employer research from page two.',
  history:
    'PREP-HISTORY-EMAIL: Please bring your editor to the fictional interview.',
  finding: 'PREP-FINDING: Page two generated observation.',
  source:
    'PREP-SOURCE: Original fictional listing.\n```html\n<div>Build accessible tools — λ</div>\n```',
  draft: 'PREP-UNSAVED: This draft must never be exported.',
};

async function seedPrepContext(page: Page) {
  const roleId = new URL(page.url()).pathname.split('/').at(-1);
  expect(roleId).toBeTruthy();
  const rolePath = `/api/job-postings/${roleId}`;
  const headers = { Origin: new URL(page.url()).origin };
  const readRole = async () => {
    const response = await page.request.get(rolePath);
    expect(response.ok()).toBe(true);
    return (await response.json()).item;
  };
  let role = await readRole();
  const currentStageId = randomUUID();
  const targetStageId = randomUUID();
  const saved = await page.request.patch(rolePath, {
    headers,
    data: {
      expectedApplicationVersion: role.applicationVersion,
      changes: {
        interviewProcess: {
          stages: [
            { id: currentStageId, name: 'Recruiter conversation' },
            {
              id: targetStageId,
              name: 'Coding preparation',
              context: prepText.coding,
            },
          ],
          currentStageId,
        },
      },
    },
  });
  expect(saved.ok()).toBe(true);
  role = await readRole();
  const source = await page.request.post(`${rolePath}/extraction`, {
    headers,
    data: {
      expectedGeneration: role.extraction.generation,
      expectedApplicationVersion: role.applicationVersion,
      operationId: randomUUID(),
      sourceText: prepText.source,
    },
  });
  expect(source.ok()).toBe(true);
  await expect
    .poll(async () => (await readRole()).extraction.status)
    .toBe('complete');
  role = await readRole();
  const companyId = role.companyAssociation.company.id as string;
  const companyPath = `/api/job-postings/companies/${companyId}`;
  // The fixture prepends writes: the first saved note is on the second page.
  for (let index = 0; index < 21; index++) {
    const roleNote = await page.request.post(`${rolePath}/notes`, {
      headers,
      data: {
        id: randomUUID(),
        body:
          index === 0
            ? prepText.email
            : index === 1
              ? prepText.prior
              : `Saved role preparation comment ${index}`,
        interviewStageId:
          index === 0 ? null : index === 1 ? currentStageId : targetStageId,
      },
    });
    expect(roleNote.ok()).toBe(true);
    const companyNote = await page.request.post(`${companyPath}/notes`, {
      headers,
      data: {
        id: randomUUID(),
        body:
          index === 0
            ? prepText.company
            : `Saved company preparation comment ${index}`,
      },
    });
    expect(companyNote.ok()).toBe(true);
  }
  await page.reload();
  return { roleId, rolePath, companyPath, currentStageId };
}

for (const theme of ['light', 'dark'] as const) {
  test(`exports complete saved prep documents and recovers without losing drafts in ${theme}`, async ({
    page,
    context,
  }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const { roleId, rolePath, companyPath, currentStageId } =
      await seedPrepContext(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: new URL(page.url()).origin,
    });
    const history = Array.from({ length: 6 }, (_, index) => ({
      id: randomUUID(),
      text: index === 5 ? prepText.history : `Saved update receipt ${index}`,
      createdAt: `2026-09-${String(20 - index).padStart(2, '0')}T12:00:00.000Z`,
      status: 'applied',
      changes: [],
      skipped: [],
      error: null,
      undoneAt: null,
    }));
    const findings = Array.from({ length: 21 }, (_, index) => ({
      category: 'requirement',
      label: index === 20 ? prepText.finding : `Saved finding ${index}`,
      qualifier: 'required',
      explanation: 'An existing generated interpretation, not new inference.',
      evidence: [
        {
          roleId,
          roleTitle: 'Fictional role',
          source: 'posting',
          excerpt: `Saved evidence ${index}`,
        },
      ],
    }));
    let analysisStarted = false;
    await page.route(
      (url) => url.pathname === `${companyPath}/analysis`,
      async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        const secondPage = new URL(route.request().url()).searchParams.has(
          'cursor',
        );
        await route.fulfill({
          json: {
            schemaVersion: 1,
            status: analysisStarted ? 'complete' : 'not-started',
            generation: analysisStarted
              ? '11111111-1111-4111-8111-111111111111'
              : null,
            stale: false,
            totalRoles: 1,
            analyzedRoles: analysisStarted ? 1 : 0,
            completedAt: analysisStarted ? '2026-09-22T12:00:00.000Z' : null,
            progress: analysisStarted ? 21 : 0,
            error: null,
            items: analysisStarted
              ? findings.slice(secondPage ? 20 : 0, secondPage ? 21 : 20)
              : [],
            nextCursor:
              analysisStarted && !secondPage ? 'analysis-page-2' : null,
          },
        });
      },
    );
    const historyUrl = (url: URL) => url.pathname === `${rolePath}/updates`;
    let releaseHistory!: () => void;
    const historyGate = new Promise<void>((resolve) => {
      releaseHistory = resolve;
    });
    await page.route(historyUrl, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await historyGate;
      const secondPage = new URL(route.request().url()).searchParams.has(
        'cursor',
      );
      await route.fulfill({
        json: {
          schemaVersion: 1,
          items: history.slice(secondPage ? 5 : 0, secondPage ? 6 : 5),
          nextCursor: secondPage ? null : 'history-page-2',
        },
      });
    });
    const opener = page.getByRole('button', {
      name: 'Open Coding preparation notes and details',
    });
    await opener.click();
    const dialog = page.getByRole('dialog', {
      name: 'Coding preparation',
      exact: true,
    });
    const close = dialog.getByRole('button', { name: 'Close', exact: true });
    await expect(close).toBeFocused();
    const draft = dialog.getByRole('textbox', {
      name: 'Add a note',
      exact: true,
    });
    await draft.fill(prepText.draft);
    const requests: { method: string; url: string }[] = [];
    page.on('request', (request) => {
      requests.push({ method: request.method(), url: request.url() });
    });
    await dialog
      .getByRole('button', { name: 'Export prep materials', exact: true })
      .press('Enter');
    await expect(
      dialog.getByText('Preparing export…', { exact: true }),
    ).toBeVisible();
    await expect(draft).toBeEnabled();
    await page.screenshot({
      path: info.outputPath(`prep-${theme}-loading.png`),
      animations: 'disabled',
    });
    releaseHistory();
    await expect(dialog.getByText('Three prep documents ready.')).toBeVisible();
    await dialog
      .getByRole('button', {
        name: 'Copy Markdown: company-context.md',
        exact: true,
      })
      .press('Enter');
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain('not-started');
    expect(requests.every((request) => request.method === 'GET')).toBe(true);

    analysisStarted = true;
    // Add a later-page failure over the successful route, then remove only it.
    const failingHistoryUrl = (url: URL) =>
      historyUrl(url) && url.searchParams.get('cursor') === 'history-page-2';
    await page.route(failingHistoryUrl, (route) =>
      route.fulfill({ status: 503, json: { message: 'Fictional outage' } }),
    );
    await dialog
      .getByRole('button', { name: 'Export again', exact: true })
      .press('Enter');
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(
      dialog.getByRole('button', {
        name: /Download all|Download Markdown|Copy Markdown/,
      }),
    ).toHaveCount(0);
    await expect(draft).toHaveValue(prepText.draft);
    await page.screenshot({
      path: info.outputPath(`prep-${theme}-failure.png`),
      animations: 'disabled',
    });
    await page.unroute(failingHistoryUrl);
    await dialog
      .getByRole('button', { name: 'Retry export', exact: true })
      .press('Enter');
    await expect(dialog.getByText('Three prep documents ready.')).toBeVisible();
    await expect(draft).toHaveValue(prepText.draft);
    const zipEvent = page.waitForEvent('download');
    await dialog
      .getByRole('button', { name: 'Download all (.zip)', exact: true })
      .press('Enter');
    const zipDownload = await zipEvent;
    expect(zipDownload.suggestedFilename()).toMatch(
      /^[a-z0-9-]+-prep-\d{4}-\d{2}-\d{2}\.zip$/,
    );
    const zipPath = info.outputPath(`prep-${theme}.zip`);
    await zipDownload.saveAs(zipPath);
    const archive = unzipSync(await readFile(zipPath));
    const filenames = [
      'job-listing.md',
      'company-context.md',
      'role-context.md',
    ];
    expect(Object.keys(archive).sort()).toEqual([...filenames].sort());
    const listing = strFromU8(archive['job-listing.md']);
    const company = strFromU8(archive['company-context.md']);
    const role = strFromU8(archive['role-context.md']);
    for (const [text, destination] of [
      [prepText.source, listing],
      [prepText.company, company],
      [prepText.finding, company],
      [prepText.coding, role],
      [prepText.prior, role],
      [prepText.email, role],
      [prepText.history, role],
    ]) {
      expect(destination).toContain(text);
      for (const other of [listing, company, role]) {
        if (other !== destination) expect(other).not.toContain(text);
      }
    }
    for (const text of [listing, company, role]) {
      expect(text).not.toContain(prepText.draft);
      expect(text.endsWith('\n')).toBe(true);
    }
    expect(role.indexOf(prepText.coding)).toBeLessThan(
      role.indexOf(prepText.prior),
    );
    for (const filename of filenames) {
      const downloadEvent = page.waitForEvent('download');
      await dialog
        .getByRole('button', {
          name: `Download Markdown: ${filename}`,
          exact: true,
        })
        .press('Enter');
      const download = await downloadEvent;
      expect(download.suggestedFilename()).toBe(
        `northstar-refreshed-product-engineer-${filename}`,
      );
      const path = info.outputPath(`${theme}-${filename}`);
      await download.saveAs(path);
      expect(new Uint8Array(await readFile(path))).toEqual(archive[filename]);
      await dialog
        .getByRole('button', {
          name: `Copy Markdown: ${filename}`,
          exact: true,
        })
        .press('Enter');
      await expect(
        dialog.getByText(`${filename} copied.`, { exact: true }),
      ).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        strFromU8(archive[filename]),
      );
    }
    const origin = new URL(page.url()).origin;
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(
      requests.every((request) => new URL(request.url).origin === origin),
    ).toBe(true);
    const exportReads = requests
      .map((request) => new URL(request.url))
      .filter((url) => url.pathname.startsWith('/api/job-postings'));
    const allowed: Record<string, true> = {
      [rolePath]: true,
      [`${rolePath}/source-text`]: true,
      [`${rolePath}/notes`]: true,
      [`${rolePath}/updates`]: true,
      [companyPath]: true,
      [`${companyPath}/notes`]: true,
      [`${companyPath}/analysis`]: true,
    };
    expect(exportReads.every((url) => allowed[url.pathname])).toBe(true);
    for (const path of [
      `${rolePath}/notes`,
      `${companyPath}/notes`,
      `${rolePath}/updates`,
      `${companyPath}/analysis`,
    ]) {
      expect(
        exportReads.some(
          (url) => url.pathname === path && url.searchParams.has('cursor'),
        ),
      ).toBe(true);
    }
    expect(
      exportReads
        .filter((url) => url.pathname === `${rolePath}/notes`)
        .every((url) => !url.searchParams.has('interviewStageId')),
    ).toBe(true);
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      for (const zoom of ['1', '2']) {
        await page.evaluate((value) => {
          document.documentElement.style.zoom = value;
        }, zoom);
        await dialog
          .getByRole('button', { name: 'Download all (.zip)', exact: true })
          .scrollIntoViewIfNeeded();
        expect(
          await dialog.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(
            `prep-${theme}-${viewport.width}-zoom-${zoom}.png`,
          ),
          animations: 'disabled',
        });
        for (const filename of filenames) {
          for (const action of ['Download Markdown', 'Copy Markdown']) {
            const button = dialog.getByRole('button', {
              name: `${action}: ${filename}`,
              exact: true,
            });
            await button.scrollIntoViewIfNeeded();
            const bounds = await button.evaluate((element) => {
              const rectangle = element.getBoundingClientRect();
              return {
                left: rectangle.left,
                right: rectangle.right,
                width: rectangle.width,
                viewportWidth: window.innerWidth,
              };
            });
            expect(bounds.width).toBeGreaterThan(0);
            expect(
              bounds.left,
              `${action}: ${filename} left edge`,
            ).toBeGreaterThanOrEqual(0);
            expect(
              bounds.right,
              `${action}: ${filename} right edge`,
            ).toBeLessThanOrEqual(bounds.viewportWidth);
          }
          const copy = dialog.getByRole('button', {
            name: `Copy Markdown: ${filename}`,
            exact: true,
          });
          await copy.scrollIntoViewIfNeeded();
          await copy.press('Enter');
          await expect(
            dialog.getByText(`${filename} copied.`, { exact: true }),
          ).toBeVisible();
          await page.screenshot({
            path: info.outputPath(
              `prep-${theme}-${viewport.width}-zoom-${zoom}-${filename}.png`,
            ),
            animations: 'disabled',
          });
        }
        await close.focus();
        await page.keyboard.press('Shift+Tab');
        // Native Chromium dialogs may traverse BODY at the browser focus boundary,
        // but must not focus any interactive content behind the modal.
        expect(
          await dialog.evaluate(
            (element) =>
              document.activeElement === document.body ||
              element.contains(document.activeElement),
          ),
        ).toBe(true);
        await page.keyboard.press('Tab');
        await expect(close).toBeFocused();
      }
    }
    await page.evaluate(() => {
      document.documentElement.style.zoom = '';
    });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    await expect(
      page.getByRole('combobox', { name: 'Move to stage', exact: true }),
    ).toHaveValue(currentStageId);
    const saved = await page.request.get(rolePath);
    expect(
      (await saved.json()).item.application.interviewProcess.currentStageId,
    ).toBe(currentStageId);
  });
}
