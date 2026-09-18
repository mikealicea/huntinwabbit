/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Opportunity } from '@/features/job-search/job-search.index';
import { ApplicationMaterials } from './ApplicationMaterials.component';
import { CompanyContext } from './CompanyContext.component';
import { RoleWorkspace } from './RoleWorkspace.component';

function sampleRole(): Opportunity {
  return {
    id: 'example',
    sourceUrl: 'https://example.com/job',
    posting: null,
    companyId: null,
    stage: 'collected',
    interest: 'not-set',
    priority: 'not-set',
    notes: '',
    followUpOn: null,
    plannedResumeId: null,
    submittedMaterial: null,
    tasks: [
      {
        id: 'referral',
        kind: 'referral',
        label: 'Find referral',
        completed: false,
      },
    ],
  };
}

describe('workspace presentation without providers', () => {
  it('emits independent application and task intents and renders supplied sections', () => {
    const role = sampleRole();
    const onApplicationChange = vi.fn();
    const onTaskCompletionChange = vi.fn();
    render(
      <RoleWorkspace
        role={role}
        roleName="Supplied title"
        companyLabel="Supplied company"
        nextActionLabel="Supplied next action"
        onApplicationChange={onApplicationChange}
        onTaskCompletionChange={onTaskCompletionChange}
        materials={<p>Materials slot</p>}
        company={<p>Company slot</p>}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Supplied title' }),
    ).toBeVisible();
    expect(screen.getByText('Next: Supplied next action')).toBeVisible();
    expect(screen.getByText('Materials slot')).toBeVisible();
    expect(screen.getByText('Company slot')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Stage'), {
      target: { value: 'applied' },
    });
    fireEvent.change(screen.getByLabelText('Interest'), {
      target: { value: 'throwaway' },
    });
    fireEvent.change(screen.getByLabelText('Priority'), {
      target: { value: 'low' },
    });
    fireEvent.change(screen.getByLabelText('Next follow-up'), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(screen.getByLabelText('Prep & interview notes'), {
      target: { value: 'Fictional note' },
    });
    expect(onApplicationChange.mock.calls).toEqual([
      [{ stage: 'applied' }],
      [{ interest: 'throwaway' }],
      [{ priority: 'low' }],
      [{ followUpOn: '2026-10-01' }],
      [{ notes: 'Fictional note' }],
    ]);
    fireEvent.click(
      screen.getByRole('checkbox', { name: role.tasks[0].label }),
    );
    expect(onTaskCompletionChange).toHaveBeenCalledWith(role.tasks[0].id, true);
  });

  it('emits resume choices without changing the displayed submitted snapshot', () => {
    const role = {
      ...sampleRole(),
      submittedMaterial: {
        fileName: 'submitted.pdf',
        resumeLabel: 'Submitted version',
        submittedOn: '2026-09-01',
      },
    };
    const onResumeChange = vi.fn();
    render(
      <ApplicationMaterials
        role={role}
        resumes={[{ id: 'alternate', label: 'Alternate version' }]}
        onResumeChange={onResumeChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Planned resume'), {
      target: { value: 'alternate' },
    });
    fireEvent.change(screen.getByLabelText('Planned resume'), {
      target: { value: '' },
    });
    expect(onResumeChange.mock.calls).toEqual([['alternate'], [null]]);
    expect(screen.getByText('submitted.pdf')).toBeVisible();
    expect(screen.getByText(/Submitted version/)).toBeVisible();
  });

  it('renders honest missing company details, then supplied shared research', () => {
    const view = render(<CompanyContext company={undefined} roleCount={0} />);
    expect(screen.getByText(/Company unknown/)).toBeVisible();
    view.rerender(
      <CompanyContext
        company={{
          id: 'example',
          name: 'Example',
          contacts: [],
          research: null,
          interviewLoop: null,
        }}
        roleCount={2}
      />,
    );
    expect(screen.getByText('Company research not started.')).toBeVisible();
    expect(screen.getByText('No contacts saved yet.')).toBeVisible();
    expect(screen.getByText('2 saved roles at this company')).toBeVisible();
  });
});
