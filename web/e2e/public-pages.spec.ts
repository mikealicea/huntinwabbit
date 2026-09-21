import { expect, test } from '@playwright/test';

test('renders the public blog through server loaders and navigates a generated post', async ({
  page,
}) => {
  await page.goto('/blog');
  await expect(
    page.getByRole('heading', { name: 'Blog', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Hello, World', exact: true }).click();
  await expect(page).toHaveURL('/blog/hello-world');
  await expect(
    page.getByRole('heading', { name: 'Hello, World', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Jul 28, 2026', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Hello, world.', { exact: true }).first(),
  ).toBeVisible();
  await expect(page).toHaveTitle('Hello, World · huntinwabbit');
  await page.reload();
  await page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link', { name: 'Blog', exact: true })
    .click();
  await expect(page).toHaveURL('/blog');
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
});
