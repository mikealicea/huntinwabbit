/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mockPostingApi,
  postingFixtures,
} from '@/features/job-api/job-api.test-support';
import { StoreProvider } from '@/state/state.index';
import { RoleWorkspaceContainer } from './RoleWorkspace.container';

afterEach(() => vi.unstubAllGlobals());
describe('live role workspace', () => {
  it('persists independent choices and notes and displays unavailable sections honestly', async () => {
    const api = mockPostingApi();
    const item = postingFixtures()[0];
    const user = userEvent.setup();
    const ui = () => (
      <StoreProvider>
        <RoleWorkspaceContainer roleId={item.id} />
      </StoreProvider>
    );
    const view = render(ui());
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Stage' }),
      'offer',
    );
    await waitFor(() =>
      expect(api.records.get(item.id)?.application.stage).toBe('offer'),
    );
    expect(screen.getByRole('combobox', { name: 'Interest' })).toHaveValue(
      'highly-interested',
    );
    expect(
      screen.queryByRole('combobox', { name: 'Planned resume' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Not available yet')).toHaveLength(2);
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'Prep & interview notes' }),
      ).toBeEnabled(),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Prep & interview notes' }),
      'Fictional saved note',
    );
    expect(api.records.get(item.id)?.application.notes).toBe('');
    await user.click(screen.getByRole('button', { name: 'Save notes' }));
    await waitFor(() =>
      expect(api.records.get(item.id)?.application.notes).toBe(
        'Fictional saved note',
      ),
    );
    view.unmount();
    render(ui());
    expect(
      await screen.findByRole('textbox', { name: 'Prep & interview notes' }),
    ).toHaveValue('Fictional saved note');
  });
  it('shows 404 recovery only after the direct API lookup', async () => {
    mockPostingApi([]);
    render(
      <StoreProvider>
        <RoleWorkspaceContainer roleId="00000000-0000-4000-8000-999999999999" />
      </StoreProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Role not found' }),
    ).toBeInTheDocument();
  });
  it('preserves a note draft on a conflicting edit', async () => {
    const api = mockPostingApi();
    const item = postingFixtures()[0];
    const user = userEvent.setup();
    render(
      <StoreProvider>
        <RoleWorkspaceContainer roleId={item.id} />
      </StoreProvider>,
    );
    await user.type(
      await screen.findByRole('textbox', { name: 'Prep & interview notes' }),
      'My unsaved draft',
    );
    api.records.set(item.id, {
      ...item,
      applicationVersion: 1,
      application: { ...item.application, notes: 'Other tab' },
    });
    await user.click(screen.getByRole('button', { name: 'Save notes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'changed elsewhere',
    );
    expect(
      screen.getByRole('textbox', { name: 'Prep & interview notes' }),
    ).toHaveValue('My unsaved draft');
  });
});
