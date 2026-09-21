/** @vitest-environment jsdom */

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderContainer } from './Header.container';

const mocks = vi.hoisted(() => ({
  setTheme: vi.fn(),
}));

vi.mock('next-themes', () => {
  function MockThemeProvider({ children }: { children: ReactNode }) {
    return children;
  }

  function useTheme() {
    return {
      resolvedTheme: 'light',
      setTheme: mocks.setTheme,
    };
  }

  return {
    ThemeProvider: MockThemeProvider,
    useTheme,
  };
});

describe('site header', () => {
  beforeEach(() => {
    mocks.setTheme.mockClear();
  });

  it('links the application brand to the protected application', () => {
    render(
      <HeaderContainer
        signOutAction={async () => ({ status: 'idle', message: '' })}
      />,
    );

    const navigation = screen.getByRole('navigation', {
      name: 'Primary navigation',
    });

    expect(
      within(navigation).getByRole('link', {
        name: 'huntinwabbit-boilerplate',
      }),
    ).toHaveAttribute('href', '/app');
    expect(
      within(navigation).queryByRole('link', { name: 'Blog' }),
    ).not.toBeInTheDocument();
  });

  it('switches from the light theme to the dark theme', () => {
    render(
      <HeaderContainer
        signOutAction={async () => ({ status: 'idle', message: '' })}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    );

    expect(mocks.setTheme).toHaveBeenCalledWith('dark');
  });
});
