import 'nextra-theme-blog/style.css';
import type { ReactNode } from 'react';
import { PageShell } from '@/shared/shared.index';

export default function BlogLayout({ children }: { children: ReactNode }) {
  return <PageShell>{children}</PageShell>;
}
