import Link from 'next/link';
import { importPage } from 'nextra/pages';
import { formatDate, parseBlogPostMetadata } from './blog.utils';

export async function BlogPost({ mdxPath }: { mdxPath: string[] }) {
  const { default: MDXContent, metadata } = await importPage(mdxPath);
  const postMetadata = parseBlogPostMetadata(metadata);

  return (
    <article>
      <nav
        aria-label="Breadcrumb"
        className="text-base-content/70 mb-8 flex items-center gap-2 text-sm"
      >
        <Link href="/blog">Blog</Link>
        <span aria-hidden="true">/</span>
        <span>{postMetadata.title}</span>
      </nav>
      <header>
        <h1>{postMetadata.title}</h1>
        <p className="text-base-content/60 text-sm">
          {formatDate(new Date(postMetadata.date))}
        </p>
      </header>
      <MDXContent />
    </article>
  );
}
