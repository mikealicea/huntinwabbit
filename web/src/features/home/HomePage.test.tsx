/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '../../app/page';

describe('home page', () => {
  it('provides the landing page entry to the application', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'huntinwabbit' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open app' })).toHaveAttribute(
      'href',
      '/app',
    );
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'huntinwabbit' })).toHaveAttribute(
      'href',
      '/app',
    );
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });
});
