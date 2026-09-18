/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from './AppThemeProvider';
import { ThemeSwitch } from './ThemeSwitch';

let systemDark = false;
let systemListener: (event: { matches: boolean }) => void;

beforeEach(() => {
  localStorage.clear();
  systemDark = false;
  document.documentElement.removeAttribute('data-theme');
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: systemDark,
      addListener: (listener: typeof systemListener) => {
        systemListener = listener;
      },
      removeListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('theme browser adapter', () => {
  it('resolves system light, follows system changes and persists explicit choices', () => {
    render(
      <AppThemeProvider>
        <ThemeSwitch />
      </AppThemeProvider>,
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'emerald');
    act(() => {
      systemDark = true;
      systemListener({ matches: true });
    });
    expect(document.documentElement).toHaveAttribute('data-theme', 'forest');
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to light theme' }),
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'emerald');
    expect(localStorage.getItem('theme')).toBe('light');
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'forest');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('restores a persisted preference and responds to another tab', () => {
    localStorage.setItem('theme', 'dark');
    render(
      <AppThemeProvider>
        <ThemeSwitch />
      </AppThemeProvider>,
    );
    expect(
      screen.getByRole('button', { name: 'Switch to light theme' }),
    ).toBeEnabled();
    expect(document.documentElement).toHaveAttribute('data-theme', 'forest');
    fireEvent(
      window,
      new StorageEvent('storage', { key: 'theme', newValue: 'light' }),
    );
    expect(document.documentElement).toHaveAttribute('data-theme', 'emerald');
  });

  it('renders an honest disabled server state and hydrates without mismatches', async () => {
    const ui = (
      <AppThemeProvider>
        <ThemeSwitch />
      </AppThemeProvider>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(ui);
    const button = container.querySelector('button');
    expect(button).toHaveAttribute('aria-label', 'Theme loading');
    expect(button).toBeDisabled();
    document.body.append(container);
    const errors = vi.fn();
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, ui, { onRecoverableError: errors });
    });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-label', 'Switch to dark theme');
    expect(errors).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });
});
