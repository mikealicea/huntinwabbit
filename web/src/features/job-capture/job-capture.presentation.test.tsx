/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { JobCapture } from './JobCapture.component';

it('renders supplied capture validation and emits row intents without a store', () => {
  const onUrlChange = vi.fn();
  const onInterestChange = vi.fn();
  const onSubmit = vi.fn((event) => event.preventDefault());
  const onClose = vi.fn();
  const onToggle = vi.fn();
  render(
    <JobCapture
      isOpen
      rows={[{ id: 7, url: 'invalid', interest: 'not-set' }]}
      errors={{ 7: 'Use an HTTP or HTTPS link.' }}
      notice=""
      id="capture-test"
      toggleRef={null}
      registerInput={vi.fn()}
      onToggle={onToggle}
      onClose={onClose}
      onSubmit={onSubmit}
      onUrlChange={onUrlChange}
      onInterestChange={onInterestChange}
    />,
  );
  expect(screen.getByLabelText('Job link 1')).toHaveAccessibleDescription(
    'Use an HTTP or HTTPS link.',
  );
  fireEvent.change(screen.getByLabelText('Job link 1'), {
    target: { value: 'https://example.com/job' },
  });
  fireEvent.change(screen.getByRole('combobox'), {
    target: { value: 'interested' },
  });
  expect(onUrlChange).toHaveBeenCalledWith(7, 'https://example.com/job');
  expect(onInterestChange).toHaveBeenCalledWith(7, 'interested');
  fireEvent.click(screen.getByRole('button', { name: 'Save to Collected' }));
  expect(onSubmit).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Add job links' }));
  expect(onToggle).toHaveBeenCalledOnce();
});
