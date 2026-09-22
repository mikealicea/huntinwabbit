/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  mockPostingApi,
  postingFixtures,
} from '@/features/job-api/job-api.test-support';
import { StoreProvider } from '@/state/state.index';
import { ChangeCompanyContainer } from './ChangeCompany.container';
import { CompanyWorkspaceContainer } from './CompanyWorkspace.container';

const company = {
  id: '00000000-0000-4000-8000-000000000050',
  name: 'Northstar',
  website: null,
  createdAt: '2026-09-22T00:00:00.000Z',
  updatedAt: '2026-09-22T00:00:00.000Z',
};
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => vi.unstubAllGlobals());
function boundary(mode = 'roles') {
  const api = mockPostingApi();
  api.companies.add(company.id);
  const original = api.fetcher.getMockImplementation();
  const roles = postingFixtures()
    .slice(0, 2)
    .map((item) => ({
      ...item,
      companyAssociation: {
        company: { id: company.id, name: company.name, website: null },
        mode: 'automatic' as const,
        revision: 0,
      },
    }));
  roles[1].application.stage = 'closed';
  let fail = mode === 'partial';
  api.fetcher.mockImplementation(async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.pathname.includes('/notes') && original) return original(req);
    if (url.pathname.endsWith('/company')) {
      const body = await req.json();
      if (mode === 'conflict') return Response.json({}, { status: 409 });
      return Response.json({
        schemaVersion: 1,
        item: {
          ...roles[0],
          recordVersion: 1,
          companyAssociation: {
            company: body.selection
              ? { id: company.id, name: company.name, website: company.website }
              : null,
            mode: 'manual',
            revision: 1,
          },
        },
      });
    }
    if (url.pathname.endsWith('/analysis'))
      return Response.json({
        schemaVersion: 1,
        status: 'disabled',
        generation: null,
        stale: false,
        totalRoles: 0,
        analyzedRoles: 0,
        completedAt: null,
        progress: 0,
        error: null,
        items: [],
        nextCursor: null,
      });
    if (url.pathname.includes('/companies')) {
      if (mode === 'missing') return Response.json({}, { status: 404 });
      if (url.pathname.endsWith(company.id))
        return Response.json({ schemaVersion: 1, item: company });
      if (!url.pathname.endsWith('/roles'))
        return Response.json({
          schemaVersion: 1,
          items: [company],
          nextCursor: null,
        });
      if (mode === 'empty')
        return Response.json({ schemaVersion: 1, items: [], nextCursor: null });
      if (url.searchParams.has('cursor')) {
        if (fail) {
          fail = false;
          return Response.json({}, { status: 503 });
        }
        return Response.json({
          schemaVersion: 1,
          items: [roles[1]],
          nextCursor: null,
        });
      }
      return Response.json({
        schemaVersion: 1,
        items: [roles[0]],
        nextCursor: 'next',
      });
    }
    if (!original) throw new Error('Missing boundary');
    return original(req);
  });
  return { api, roles };
}
it('shows all company roles across pages including Closed, links to roles, and offers actions without dragging', async () => {
  boundary();
  render(
    <StoreProvider>
      <CompanyWorkspaceContainer companyId={company.id} />
    </StoreProvider>,
  );
  expect(await screen.findByText('2 roles')).toBeVisible();
  expect(
    screen.getByRole('heading', { name: 'Northstar', level: 1 }),
  ).toBeVisible();
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getByText('Closed')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /Move / }),
  ).not.toBeInTheDocument();
  const card = screen.getAllByRole('article')[0];
  expect(within(card).getByRole('link', { name: /Open / })).toHaveAttribute(
    'href',
    `/app/roles/${postingFixtures()[0].id}`,
  );
  expect(within(card).getByLabelText('Posting actions')).toBeVisible();
});
it.each(['empty', 'missing'])(
  'shows the %s company state truthfully',
  async (mode) => {
    boundary(mode);
    render(
      <StoreProvider>
        <CompanyWorkspaceContainer companyId={company.id} />
      </StoreProvider>,
    );
    expect(
      await screen.findByText(
        mode === 'empty'
          ? 'No roles at this company yet.'
          : 'Company not found',
      ),
    ).toBeVisible();
  },
);
it('retains earlier roles on page failure and retries the failed page', async () => {
  boundary('partial');
  render(
    <StoreProvider>
      <CompanyWorkspaceContainer companyId={company.id} />
    </StoreProvider>,
  );
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getAllByRole('article')).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('2 roles')).toBeVisible();
});
it.each(['roles', 'conflict'])(
  'selects a company through a real store and handles %s outcome',
  async (mode) => {
    const { roles } = boundary(mode);
    render(
      <StoreProvider>
        <ChangeCompanyContainer posting={roles[0]} />
      </StoreProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Change company' }));
    await user.click(await screen.findByRole('radio', { name: 'Northstar' }));
    await user.click(screen.getByRole('button', { name: 'Save company' }));
    if (mode === 'conflict') {
      expect(await screen.findByText(/Close this dialog/)).toBeVisible();
      expect(
        screen.getByRole('button', { name: 'Save company' }),
      ).toBeDisabled();
    } else
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
  },
);

it('keeps create and clear choices as explicit presentation callbacks', async () => {
  const { ChangeCompany } = await import('./ChangeCompany.component');
  const save = vi.fn(async () => true);
  const search = vi.fn();
  const close = vi.fn();
  const view = render(
    <ChangeCompany
      companies={[]}
      pending={false}
      complete
      feedback={null}
      onSearch={search}
      onSave={save}
      onClose={close}
    />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByRole('searchbox'), 'Studio');
  expect(search).toHaveBeenLastCalledWith('Studio');
  await user.click(screen.getByRole('radio', { name: 'Create a company' }));
  expect(screen.getByLabelText('Company name')).toHaveValue('Studio');
  await user.type(
    screen.getByLabelText('Website (optional)'),
    'https://studio.example',
  );
  await user.click(screen.getByRole('button', { name: 'Save company' }));
  expect(save).toHaveBeenLastCalledWith({
    create: { name: 'Studio', website: 'https://studio.example' },
  });
  expect(close).toHaveBeenCalledOnce();
  view.unmount();
  render(
    <ChangeCompany
      companies={[]}
      pending={false}
      complete
      feedback={null}
      onSearch={search}
      onSave={save}
      onClose={close}
    />,
  );
  await user.click(screen.getByRole('radio', { name: 'Leave unassigned' }));
  await user.click(screen.getByRole('button', { name: 'Save company' }));
  expect(save).toHaveBeenLastCalledWith(null);
});
