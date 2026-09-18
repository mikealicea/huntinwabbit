import Link from 'next/link';
import type { ReactNode } from 'react';
export interface BlogIndexProps {
  posts: { route: string; title: ReactNode; date: string | null }[];
}
export function BlogIndex({ posts }: BlogIndexProps) {
  return (
    <section>
      <h1>Blog</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.route}>
            <Link href={post.route}>{post.title}</Link>
            {post.date ? (
              <span className="text-base-content/60 ml-2 text-sm">
                {post.date}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
