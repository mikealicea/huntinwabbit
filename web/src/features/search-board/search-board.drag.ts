import { Accessibility } from '@dnd-kit/dom';
import {
  STAGE_LABELS,
  STAGES,
  type Stage,
} from '@/features/job-search/job-search.index';

function stageLabel(id: unknown): string | null {
  return STAGES.includes(id as Stage) ? STAGE_LABELS[id as Stage] : null;
}

const options: NonNullable<ConstructorParameters<typeof Accessibility>[1]> = {
  announcements: {
    dragstart({ operation: { source } }) {
      return source
        ? `Moving ${source.data.label}. Use arrow keys to choose a stage, Space to drop, or Escape to cancel.`
        : undefined;
    },
    dragover({ operation: { target } }) {
      const label = stageLabel(target?.id);
      return label
        ? `Over ${label}. Drop to move here.`
        : 'No stage selected. Release to cancel.';
    },
    dragend({ operation: { source, target }, canceled }) {
      const label = stageLabel(target?.id);
      return !canceled && source && label
        ? `${source.data.label} moved to ${label}.`
        : 'Move canceled. Stage unchanged.';
    },
  },
};

export const boardAccessibility = Accessibility.configure(options);
