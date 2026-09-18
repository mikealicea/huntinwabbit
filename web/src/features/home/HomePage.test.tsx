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
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
