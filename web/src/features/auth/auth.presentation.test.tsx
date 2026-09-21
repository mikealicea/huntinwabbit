/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AuthForm } from './AuthForm.component';
import { AuthFrame } from './AuthFrame.component';
import { initialAuthState } from './auth.types';
import { ConfirmForm } from './ConfirmForm.component';
import { SignOutButton } from './SignOutButton.component';

it('renders local input state and supplied pending feedback without an action adapter', () => {
  const props = {
    mode: 'login' as const,
    state: initialAuthState,
    dispatch: vi.fn(),
    pending: false,
    resendState: initialAuthState,
    resendDispatch: vi.fn(),
    resending: false,
    signOut: null,
    next: '/app',
    notice: 'Supplied notice',
  };
  const view = render(
    <AuthFrame
      title="Test login"
      description="Test description"
      themeSwitch={<button type="button">Theme slot</button>}
    >
      <AuthForm {...props} />
    </AuthFrame>,
  );
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'fictional@example.com' },
  });
  expect(screen.getByLabelText('Email')).toHaveValue('fictional@example.com');
  expect(screen.getByRole('button', { name: 'Theme slot' })).toBeVisible();
  expect(screen.getByText('Supplied notice')).toBeVisible();
  view.rerender(<AuthForm {...props} pending />);
  expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Resend confirmation email' }),
  ).toBeDisabled();
  expect(screen.getByText('Submitting…')).toBeVisible();
});

it('renders confirmation and sign-out statuses directly from props', () => {
  const view = render(
    <ConfirmForm
      dispatch={vi.fn()}
      pending
      message="Supplied confirmation status"
      token="fictional-token"
      type="recovery"
      isRecovery
    />,
  );
  expect(screen.getByRole('button', { name: 'Verifying…' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Supplied confirmation status',
  );
  expect(
    screen.getByRole('link', { name: 'Request a new email' }),
  ).toHaveAttribute('href', '/forgot-password');
  view.rerender(
    <SignOutButton
      dispatch={vi.fn()}
      pending
      message="Supplied sign-out status"
    />,
  );
  expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Supplied sign-out status',
  );
});
