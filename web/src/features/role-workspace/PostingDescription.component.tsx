import { SafeMarkdown } from '@/shared/shared.index';
export function PostingDescription({ description }: { description: string }) {
  return <SafeMarkdown text={description} />;
}
