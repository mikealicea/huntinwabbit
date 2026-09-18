/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock('./auth.session', () => ({ serverIdentity: mocks.identity }));
vi.mock('./auth.actions', () => ({ submitAuth: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));

import { AuthConfirmationPageContainer } from './AuthConfirmationPage.container';
import { AuthPageContainer } from './AuthPage.container';
import { AuthUnavailablePageContainer } from './AuthUnavailablePage.container';

beforeEach(() => {
  mocks.identity.mockResolvedValue({ status: 'anonymous' });
});

describe('server auth pages', () => {
  it.each(['login', 'signup', 'forgot-password'] as const)(
    'renders anonymous %s',
    async (mode) => {
      render(
        await AuthPageContainer({ mode, searchParams: Promise.resolve({}) }),
      );
      expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
      expect(screen.getByLabelText('Email')).toBeVisible();
    },
  );
  it('offers a new recovery request for a missing session', async () => {
    render(
      await AuthPageContainer({
        mode: 'reset-password',
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getByRole('heading', { name: 'Request a new reset link' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Send reset email' }),
    ).toBeVisible();
  });
  it('renders password update for a verified session', async () => {
    mocks.identity.mockResolvedValue({
      status: 'authenticated',
      userId: 'fictional',
    });
    render(
      await AuthPageContainer({
        mode: 'reset-password',
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Save new password' }),
    ).toBeVisible();
  });
  it.each(['login', 'signup'] as const)(
    'redirects authenticated %s visitors safely',
    async (mode) => {
      mocks.identity.mockResolvedValue({
        status: 'authenticated',
        userId: 'fictional',
      });
      await expect(
        AuthPageContainer({
          mode,
          searchParams: Promise.resolve({ next: '/app/roles/example' }),
        }),
      ).rejects.toThrow('REDIRECT:/app/roles/example');
    },
  );
  it('allows recovery requests while authenticated', async () => {
    mocks.identity.mockResolvedValue({
      status: 'authenticated',
      userId: 'fictional',
    });
    render(
      await AuthPageContainer({
        mode: 'forgot-password',
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Send reset email' }),
    ).toBeVisible();
  });
  it('redirects verification outages to the retry page', async () => {
    mocks.identity.mockResolvedValue({ status: 'unavailable' });
    await expect(
      AuthPageContainer({ mode: 'login', searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('REDIRECT:/auth/unavailable?next=/login');
  });
  it.each([
    'password-changed',
    'password-changed-signout-incomplete',
    'signed-out',
    'signout-incomplete',
  ])('renders known notice %s', async (notice) => {
    render(
      await AuthPageContainer({
        mode: 'login',
        searchParams: Promise.resolve({ notice }),
      }),
    );
    expect(screen.getAllByRole('status')[0]).not.toBeEmptyDOMElement();
  });
  it('does not render arbitrary notice text', async () => {
    render(
      await AuthPageContainer({
        mode: 'login',
        searchParams: Promise.resolve({ notice: 'untrusted text' }),
      }),
    );
    expect(screen.queryByText('untrusted text')).not.toBeInTheDocument();
  });
  it.each([
    { type: 'email', token_hash: 'a'.repeat(64) },
    { type: 'recovery', token_hash: 'b'.repeat(64) },
    {},
    { type: ['email'], token_hash: ['token'] },
  ])('renders confirmation without consuming tokens %j', async (params) => {
    render(
      await AuthConfirmationPageContainer({
        searchParams: Promise.resolve(params),
      }),
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      params.type === 'recovery' ? 'Reset your password' : 'Confirm your email',
    );
    expect(
      screen.getByRole('button', { name: /Confirm email|Continue to reset/ }),
    ).toBeVisible();
  });
  it.each([
    ['/login', '/login'],
    ['/app/roles/example', '/app/roles/example'],
    ['//evil.test', '/app'],
    [undefined, '/app'],
  ])('limits retry destination %s to %s', async (next, expected) => {
    render(
      await AuthUnavailablePageContainer({
        searchParams: Promise.resolve({ next }),
      }),
    );
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      expected,
    );
  });
});
