import type { ReactNode } from 'react';
import { RequestStatus } from '@/shared/shared.index';

export function BoardStatus({
  busy,
  failed,
  message,
  feedback,
}: {
  busy: boolean;
  failed: boolean;
  message: string;
  feedback: ReactNode;
}) {
  return (
    <RequestStatus
      busy={busy}
      failed={failed}
      label={
        busy ? message : failed ? 'Board request failed' : 'Board up to date'
      }
      statusLabel="Board status"
      expandable={failed && !busy}
      feedback={feedback}
    />
  );
}
