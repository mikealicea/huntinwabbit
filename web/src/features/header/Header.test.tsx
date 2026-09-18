/** @vitest-environment jsdom */

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

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

  it('links to every public page', () => {
    render(<Header />);

    const navigation = screen.getByRole('navigation', {
      name: 'Primary navigation',
    });

    expect(
      within(navigation).getByRole('link', { name: 'Home' }),
    ).toHaveAttribute('href', '/');
    expect(
      within(navigation).getByRole('link', { name: 'Blog' }),
    ).toHaveAttribute('href', '/blog');
  });

  it('switches from the light theme to the dark theme', () => {
    render(<Header />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    );

    expect(mocks.setTheme).toHaveBeenCalledWith('dark');
  });
});
