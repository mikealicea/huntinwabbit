'use client';
import { Accessibility } from '@dnd-kit/dom';
import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
} from '@dnd-kit/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  type InterviewProcess as Process,
  type SavedPosting,
  type UpdateMessage,
  useSendRoleUpdateMutation,
  useUpdatePostingMutation,
} from '@/features/job-api/job-api.index';
import {
  InterviewCard,
  InterviewColumn,
  InterviewProcess,
} from './InterviewProcess.component';
import { InterviewSetup } from './InterviewSetup.component';
import { InterviewStage } from './InterviewStage.component';

function InterviewCardContainer({
  title,
  company,
  busy,
}: {
  title: string;
  company: string;
  busy: boolean;
}) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: 'interview-card',
    disabled: busy,
  });
  return (
    <InterviewCard
      title={title}
      company={company}
      busy={busy}
      dragging={isDragging}
      cardRef={ref}
      handleRef={handleRef}
    />
  );
}
function InterviewColumnContainer({
  id,
  name,
  selected,
  children,
  busy,
  onOpen,
}: {
  id: string;
  name: string;
  selected: boolean;
  children: ReactNode;
  busy: boolean;
  onOpen: () => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id,
    disabled: busy,
    data: { label: name },
  });
  return (
    <InterviewColumn
      onOpen={onOpen}
      stageId={id}
      name={name}
      selected={selected}
      active={isDropTarget}
      dropRef={ref}
    >
      {children}
    </InterviewColumn>
  );
}
const accessibilityOptions: NonNullable<
  ConstructorParameters<typeof Accessibility>[1]
> = {
  announcements: {
    dragstart: () =>
      'Moving interview card. Use arrow keys to choose a stage, Space to drop, or Escape to cancel.',
    dragover: ({ operation: { target } }) =>
      target
        ? `Over ${target.data.label}. Drop to select it.`
        : 'No stage selected.',
    dragend: ({ canceled, operation: { target } }) =>
      canceled || !target
        ? 'Move canceled.'
        : `Dropped on ${target.data.label}.`,
  },
};
const accessibility = Accessibility.configure(accessibilityOptions);

export function InterviewProcessContainer({
  posting,
  title,
  company,
  disabled = false,
  renderStageNotes,
}: {
  posting: SavedPosting;
  title: string;
  company: string;
  disabled?: boolean;
  renderStageNotes?: (stageId: string) => ReactNode;
}) {
  const process = posting.application.interviewProcess ?? null;
  const [update, saving] = useUpdatePostingMutation();
  const [send, sending] = useSendRoleUpdateMutation();
  const [editor, setEditor] = useState<{
    process: Process | null;
    version: number;
  } | null>(null);
  const [openStage, setOpenStage] = useState<string | null>(null);
  const stageOpener = useRef<HTMLElement | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const attempt = useRef<UpdateMessage | null>(null);
  const board = useRef<HTMLElement>(null);
  const pending = !!posting.edits?.pending;
  const busy = disabled || saving.isLoading || sending.isLoading || pending;
  useEffect(() => {
    if (!process) return;
    const column = board.current?.querySelector<HTMLElement>(
      `[data-stage-id="${process.currentStageId ?? 'unassigned'}"]`,
    );
    if (column && board.current) board.current.scrollLeft = column.offsetLeft;
  }, [process]);
  function close() {
    setEditor(null);
    setError('');
    requestAnimationFrame(() =>
      document.getElementById('interview-setup')?.focus(),
    );
  }
  async function save(value: Process | null, version: number) {
    if (busy) return false;
    setError('');
    setMessage('');
    try {
      await update({
        id: posting.id,
        expectedApplicationVersion: version,
        changes: { interviewProcess: value },
      }).unwrap();
      setMessage('Interview stages saved.');
      return true;
    } catch (cause) {
      setError(
        typeof cause === 'object' &&
          cause &&
          'status' in cause &&
          cause.status === 409
          ? 'This role changed. Close and reopen the editor to review the latest stages, or try your move again.'
          : 'The save could not be confirmed. Your last saved position is shown; review it before retrying.',
      );
      return false;
    }
  }
  async function move(id: string) {
    if (
      !process ||
      id === process.currentStageId ||
      !process.stages.some((stage) => stage.id === id)
    )
      return;
    await save({ ...process, currentStageId: id }, posting.applicationVersion);
  }
  async function transcript(text: string) {
    if (busy) return;
    setError('');
    if (attempt.current?.text !== text)
      attempt.current = {
        text,
        intent: 'interview-process',
        operationId: crypto.randomUUID(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    try {
      await send({ id: posting.id, ...attempt.current }).unwrap();
      attempt.current = null;
      close();
      setMessage(
        'Transcript accepted. You can leave and return; results and Undo appear in Update history.',
      );
    } catch {
      setError(
        'The transcript submission could not be confirmed. Your draft is preserved; retry to check the same submission.',
      );
    }
  }
  return (
    <InterviewProcess
      process={process}
      busy={busy}
      message={
        pending
          ? 'Updating interview stages… You can leave and return.'
          : saving.isLoading
            ? 'Saving interview stages…'
            : message
      }
      error={editor ? '' : error}
      onSetup={() => {
        setError('');
        setEditor({ process, version: posting.applicationVersion });
      }}
      onMove={(id) => {
        void move(id);
      }}
      setup={
        <>
          {openStage && (
            <InterviewStage
              stage={process?.stages.find((stage) => stage.id === openStage)}
              notes={renderStageNotes?.(openStage)}
              onClose={() => {
                setOpenStage(null);
                requestAnimationFrame(() => {
                  if (stageOpener.current?.isConnected)
                    stageOpener.current.focus();
                  else document.getElementById('interview-setup')?.focus();
                });
              }}
            />
          )}
          {editor && (
            <InterviewSetup
              initial={editor.process}
              busy={busy}
              error={error}
              onClose={close}
              onSave={async (value) => {
                if (await save(value, editor.version)) close();
              }}
              onTranscript={transcript}
            />
          )}
        </>
      }
    >
      {process && (
        <DragDropProvider
          plugins={(defaults) =>
            defaults.map((plugin) =>
              plugin === Accessibility ? accessibility : plugin,
            )
          }
          onDragEnd={async (event) => {
            const target = event.operation.target?.id;
            if (!event.canceled && typeof target === 'string')
              await move(target);
            requestAnimationFrame(() =>
              document.getElementById('interview-move')?.focus(),
            );
          }}
        >
          <section
            ref={board}
            className="relative flex min-w-0 gap-3 overflow-x-auto pb-3"
            aria-label="Interview stages"
          >
            {!process.currentStageId && (
              <InterviewColumn
                stageId="unassigned"
                name="Choose current stage"
                selected
                active={false}
                dropRef={null}
              >
                <InterviewCardContainer
                  title={title}
                  company={company}
                  busy={busy}
                />
              </InterviewColumn>
            )}
            {process.stages.map((stage) => (
              <InterviewColumnContainer
                key={stage.id}
                onOpen={() => {
                  stageOpener.current =
                    document.activeElement instanceof HTMLElement
                      ? document.activeElement
                      : null;
                  setOpenStage(stage.id);
                }}
                id={stage.id}
                name={stage.name}
                selected={stage.id === process.currentStageId}
                busy={busy}
              >
                {stage.id === process.currentStageId && (
                  <InterviewCardContainer
                    title={title}
                    company={company}
                    busy={busy}
                  />
                )}
              </InterviewColumnContainer>
            ))}
          </section>
          <DragOverlay dropAnimation={null}>
            {() => (
              <div className="w-52 rounded-lg border border-base-300 bg-base-100 p-3 shadow-lg">
                {title}
              </div>
            )}
          </DragOverlay>
        </DragDropProvider>
      )}
    </InterviewProcess>
  );
}
