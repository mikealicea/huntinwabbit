import type { Metadata } from 'next';
import { requireUser } from '@/features/auth/auth.server.index';
import { SearchBoardContainer } from '@/features/search-board/search-board.index';

export const metadata: Metadata = { title: 'Your search' };

export default async function SearchBoardPage() {
  await requireUser();
  return <SearchBoardContainer />;
}
