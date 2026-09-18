/** @vitest-environment jsdom */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StoreProvider } from '@/state/state.index';
import { RoleWorkspaceContainer } from './RoleWorkspace.container';

describe('role workspace', () => {
  it('edits application choices independently and preserves submitted materials', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider>
        <RoleWorkspaceContainer roleId="northstar-platform" />
      </StoreProvider>,
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Stage' }),
      'offer',
    );
    expect(screen.getByRole('combobox', { name: 'Interest' })).toHaveValue(
      'highly-interested',
    );
    expect(screen.getByRole('combobox', { name: 'Priority' })).toHaveValue(
      'high',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Planned resume' }),
      'general-v5',
    );
    expect(screen.getByText('platform-engineering-v2.pdf')).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Prep & interview notes' }),
      'Practice explaining tradeoffs.',
    );
    expect(
      screen.getByRole('textbox', { name: 'Prep & interview notes' }),
    ).toHaveValue('Practice explaining tradeoffs.');
    await user.click(
      screen.getByRole('checkbox', { name: 'Prepare for technical screen' }),
    );
    expect(screen.getByText('Next: No next action set')).toBeInTheDocument();
    const company = screen.getByRole('region', { name: 'Northstar · Company' });
    expect(
      within(company).getByText('2 saved roles at this company'),
    ).toBeInTheDocument();
    expect(within(company).getByText('Alex')).toBeInTheDocument();
  });

  it('offers recovery for an unknown or expired sample role', () => {
    render(
      <StoreProvider>
        <RoleWorkspaceContainer roleId="missing" />
      </StoreProvider>,
    );
    expect(
      screen.getByRole('heading', { name: 'Role not found' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Return to search board' }),
    ).toHaveAttribute('href', '/app');
  });
});
