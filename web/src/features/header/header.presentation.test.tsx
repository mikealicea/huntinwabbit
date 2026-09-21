/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Header } from './Header.component';

it('renders supplied controls without theme or auth providers', () => {
  render(
    <Header
      themeSwitch={<button type="button">Theme slot</button>}
      actions={<button type="button">Sign-out slot</button>}
    />,
  );
  expect(
    screen.getByRole('link', { name: 'huntinwabbit-boilerplate' }),
  ).toHaveAttribute('href', '/app');
  expect(screen.getByRole('button', { name: 'Theme slot' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Sign-out slot' })).toBeVisible();
});
