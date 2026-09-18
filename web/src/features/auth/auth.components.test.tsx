/** @vitest-environment jsdom */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from './AuthForm';
import { AuthFrame } from './AuthFrame';
import type { AuthAction, AuthMode, AuthState } from './auth.types';
import { ConfirmForm } from './ConfirmForm';
import { PasswordField } from './PasswordField';
import { SignOutButton } from './SignOutButton';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));
const success: AuthState = { status: 'success', message: 'Check your email.' };
const action = vi.fn<AuthAction>();
const resendAction = vi.fn<AuthAction>();
const signOutAction = vi.fn<AuthAction>();
beforeEach(() => {
  vi.resetAllMocks();
  action.mockResolvedValue(success);
  resendAction.mockResolvedValue(success);
  signOutAction.mockResolvedValue({
    status: 'error',
    message: 'Try signing out again.',
  });
});
function renderForm(mode: AuthMode, notice?: string) {
  return render(
    <AuthForm
      mode={mode}
      action={action}
      resendAction={resendAction}
      signOutAction={signOutAction}
      notice={notice}
    />,
  );
}

describe('authentication components', () => {
  it('renders a page landmark, heading, home link and theme control', () => {
    render(
      <AuthFrame title="Log in" description="Your workspace">
        <p>Form content</p>
      </AuthFrame>,
    );
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { level: 1, name: 'Log in' }),
    );
    expect(screen.getByRole('link', { name: 'huntinwabbit' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getByRole('button', { name: 'Switch to dark theme' }),
    ).toBeVisible();
    expect(screen.getByText('Your workspace')).toBeVisible();
  });
  it('toggles password visibility and links field errors', async () => {
    const change = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <PasswordField
        name="password"
        label="Password"
        autoComplete="current-password"
        value="fictional"
        onChange={change}
        error="Password needed"
      />,
    );
    const input = screen.getByLabelText('Password', { exact: true });
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAccessibleDescription('Password needed');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.change(input, { target: { value: 'new' } });
    expect(change).toHaveBeenCalledWith('new');
    view.rerender(
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
        value=""
        onChange={change}
      />,
    );
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });
  it.each(['login', 'signup', 'forgot-password', 'reset-password'] as const)(
    'renders the appropriate %s fields and navigation',
    (mode) => {
      renderForm(mode);
      expect(screen.queryByLabelText('Email')).toBe(
        mode === 'reset-password' ? null : screen.getByLabelText('Email'),
      );
      if (mode === 'login') {
        expect(
          screen.getByLabelText('Password', { exact: true }),
        ).toHaveAttribute('autocomplete', 'current-password');
        expect(
          screen.getByRole('link', { name: 'Forgot password?' }),
        ).toHaveAttribute('href', '/forgot-password');
        expect(
          screen.getByRole('link', { name: 'Create an account' }),
        ).toHaveAttribute('href', '/signup');
      } else
        expect(
          screen.getByRole('link', { name: 'Back to log in' }),
        ).toHaveAttribute('href', '/login');
      if (mode === 'signup' || mode === 'reset-password') {
        expect(
          screen.getByLabelText('New password', { exact: true }),
        ).toHaveAttribute('autocomplete', 'new-password');
        expect(
          screen.getByLabelText('Confirm password', { exact: true }),
        ).toBeVisible();
      }
      if (mode === 'reset-password')
        expect(
          screen.getByRole('link', { name: 'Request a new reset email' }),
        ).toHaveAttribute('href', '/forgot-password');
      if (mode === 'forgot-password')
        expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    },
  );
  it('announces notices and focuses the first invalid field while retaining input', async () => {
    action.mockResolvedValue({
      status: 'error',
      message: 'Check the highlighted fields.',
      errors: { email: 'Invalid email', password: 'Password needed' },
    });
    renderForm('login', 'You have been signed out.');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'bad');
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'retained',
    );
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Invalid email',
    );
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue(
      'retained',
    );
    expect(screen.getByText('You have been signed out.')).toBeVisible();
  });
  it('handles provider errors without a field error and allows keyboard retry', async () => {
    action.mockResolvedValueOnce({
      status: 'error',
      message: 'Please try again.',
    });
    renderForm('login');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'fictional@example.test');
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'fictional{Enter}',
    );
    expect(await screen.findByText('Please try again.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Check your email.')).toBeVisible();
    expect(action).toHaveBeenCalledTimes(2);
  });
  it('disables competing submissions while login is pending', async () => {
    let finish!: (value: AuthState) => void;
    action.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderForm('login');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Resend confirmation email' }),
    ).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Please wait…' }));
    expect(action).toHaveBeenCalledOnce();
    await act(async () => finish(success));
  });
  it('clears new passwords after signup and provides another-address navigation', async () => {
    renderForm('signup');
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText('New password', { exact: true }),
      'fictional-password',
    );
    await user.type(
      screen.getByLabelText('Confirm password', { exact: true }),
      'fictional-password',
    );
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Check your email.')).toBeVisible();
    expect(
      screen.queryByLabelText('New password', { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Use another email address' }),
    ).toHaveAttribute('href', '/signup');
    expect(
      screen.queryByRole('button', { name: 'Create account' }),
    ).not.toBeInTheDocument();
  });
  it('announces confirmation-password errors', async () => {
    action.mockResolvedValue({
      status: 'error',
      message: 'Check fields',
      errors: { confirmPassword: 'Passwords must match.' },
    });
    renderForm('signup');
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' }),
    );
    expect(await screen.findByText('Passwords must match.')).toBeVisible();
    expect(
      screen.getByLabelText('Confirm password', { exact: true }),
    ).toHaveFocus();
  });
  it('resends using the entered address, reports validation, and blocks overlap while pending', async () => {
    let finish!: (value: AuthState) => void;
    resendAction.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderForm('signup');
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Resend confirmation email' }),
    );
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Create account' }),
    ).toBeDisabled();
    await act(async () =>
      finish({
        status: 'error',
        message: 'Check fields.',
        errors: { email: 'Invalid email' },
      }),
    );
    expect(screen.getByText(/Enter your email above first/)).toBeVisible();
    await user.type(screen.getByLabelText('Email'), 'fictional@example.test');
    await user.click(
      screen.getByRole('button', { name: 'Resend confirmation email' }),
    );
    expect(await screen.findByText('Check your email.')).toBeVisible();
    expect(resendAction.mock.calls[1][1].get('email')).toBe(
      'fictional@example.test',
    );
  });
  it('allows requesting a recovery email again after success', async () => {
    renderForm('forgot-password');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send reset email' }),
    );
    expect(await screen.findByText('Check your email.')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Send reset email' }),
    ).toBeEnabled();
  });
  it('offers sign-out retry, never another password update, after partial success', async () => {
    action.mockResolvedValue({
      status: 'success',
      message: 'Your password has been changed. Sign out below.',
    });
    renderForm('reset-password');
    await userEvent.click(
      screen.getByRole('button', { name: 'Save new password' }),
    );
    expect(
      await screen.findByText(/Your password has been changed/),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Save new password' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('Try signing out again.')).toBeVisible();
    expect(action).toHaveBeenCalledOnce();
  });
  it.each(['email', 'recovery'])(
    'requires an explicit button click to consume a %s token',
    async (type) => {
      let finish!: (value: AuthState) => void;
      action.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      render(
        <ConfirmForm action={action} token={'a'.repeat(64)} type={type} />,
      );
      expect(action).not.toHaveBeenCalled();
      expect(
        screen.getByRole('link', { name: 'Request a new email' }),
      ).toHaveAttribute(
        'href',
        type === 'recovery' ? '/forgot-password' : '/login',
      );
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('button', { name: 'Verifying…' })).toBeDisabled();
      await act(async () =>
        finish({ status: 'error', message: 'Link expired' }),
      );
      expect(screen.getByText('Link expired')).toBeVisible();
      expect(action.mock.calls[0][1].get('type')).toBe(type);
    },
  );
  it('shows pending sign out and lets a failed request be retried', async () => {
    let finish!: (value: AuthState) => void;
    action.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<SignOutButton action={action} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled();
    await act(async () => finish({ status: 'error', message: 'Try again' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(action).toHaveBeenCalledTimes(2);
  });
});
