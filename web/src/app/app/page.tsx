import type { Metadata } from 'next';
import { SearchBoard } from '@/features/search-board/search-board.index';

export const metadata: Metadata = { title: 'Your search' };

export default function SearchBoardPage() {
  return <SearchBoard />;
}
