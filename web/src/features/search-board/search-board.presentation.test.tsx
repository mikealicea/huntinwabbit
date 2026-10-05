/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Opportunity } from '@/features/job-search/job-search.index';
import { BoardColumn } from './BoardColumn.component';
import { RoleCard } from './RoleCard.component';
import { DragPreview, SearchBoard } from './SearchBoard.component';

const role: Opportunity = {
  id: 'saved',
  sourceUrl: 'https://example.com/job',
  posting: null,
  companyId: null,
  stage: 'collected',
  interest: 'not-set',
  priority: 'not-set',
  notes: '',
  tasks: [],
  followUpOn: null,
  plannedResumeId: null,
  submittedMaterial: null,
};

describe('board presentation without providers', () => {
  it('renders supplied role context and connects separate drag and navigation targets', () => {
    const cardRef = vi.fn();
    const dragHandleRef = vi.fn();
    render(
      <RoleCard
        role={role}
        title="Saved opening"
        company="Company unknown"
        next={{ label: 'Due today', due: true }}
        isDragging
        cardRef={cardRef}
        dragHandleRef={dragHandleRef}
      />,
    );
    const article = screen.getByRole('article', {
      name: 'Saved opening at Company unknown',
    });
    expect(article).toHaveClass('opacity-50');
    expect(cardRef).toHaveBeenCalledWith(article);
    expect(dragHandleRef).toHaveBeenCalledWith(
      screen.getByRole('button', {
        name: 'Move Saved opening at Company unknown',
      }),
    );
    expect(
      screen.getByRole('link', {
        name: 'Open Saved opening at Company unknown',
      }),
    ).toHaveAttribute('href', '/app/roles/saved');
    expect(screen.getByText('Salary not listed')).toBeVisible();
    expect(screen.getByText(/Source: example.com/)).toBeVisible();
    expect(screen.getByText('Due today')).toBeVisible();
    expect(screen.getByText('Moved: Not recorded')).toBeVisible();
  });

  it('shows the saved stage-entry date beneath company and controls, before the role heading', () => {
    render(
      <RoleCard
        role={{ ...role, stageEnteredAt: '2026-10-05T12:00:00.000Z' }}
        title="Saved opening"
        company="Company unknown"
        next={{ label: 'No next action set', due: false }}
        isDragging={false}
        cardRef={null}
        dragHandleRef={null}
      />,
    );
    const date = screen.getByText('Oct 5, 2026');
    expect(date).toHaveAttribute('datetime', '2026-10-05T12:00:00.000Z');
    expect(date.parentElement).toHaveTextContent('Moved: Oct 5, 2026');
    expect(
      screen.getByText('Company unknown').compareDocumentPosition(date) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: /^Move / })
        .compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      date.compareDocumentPosition(screen.getByRole('heading')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders empty and populated columns using supplied card slots', () => {
    const view = render(
      <BoardColumn
        stage="offer"
        roleCount={0}
        isDropTarget={false}
        dropRef={null}
      >
        {null}
      </BoardColumn>,
    );
    expect(screen.getByText('No roles here yet')).toBeVisible();
    view.rerender(
      <BoardColumn stage="offer" roleCount={1} isDropTarget dropRef={null}>
        <article>Supplied card</article>
      </BoardColumn>,
    );
    expect(screen.queryByText('No roles here yet')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Offer' })).toHaveClass(
      'border-primary',
    );
    expect(screen.getByRole('article')).toHaveTextContent('Supplied card');
  });

  it('keeps capture available in an empty board without creating connected children', () => {
    render(
      <SearchBoard
        activeCount={0}
        totalCount={0}
        capture={<button type="button">Capture slot</button>}
      >
        <p>Columns slot</p>
        <DragPreview label="Moving role" />
      </SearchBoard>,
    );
    expect(screen.getByRole('button', { name: 'Capture slot' })).toBeEnabled();
    expect(
      screen.getByText(/Your next opportunity starts with a link/),
    ).toBeVisible();
    expect(screen.getByText('Columns slot')).toBeVisible();
    expect(screen.getByText('Moving role')).toBeVisible();
  });
});
