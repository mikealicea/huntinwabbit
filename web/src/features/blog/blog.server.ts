import 'server-only';
import { normalizePages } from 'nextra/normalize-pages';
import { getPageMap } from 'nextra/page-map';
import { importPage } from 'nextra/pages';
import type { BlogPostMetadata } from './blog.types';
import { parseBlogPostMetadata, sortBlogPosts } from './blog.utils';

export async function getBlogPosts() {
  const { directories } = normalizePages({
    list: await getPageMap('/blog'),
    route: '/blog',
    underCurrentDocsRoot: true,
  });
  return sortBlogPosts(directories);
}

export async function loadBlogPost(mdxPath: string[]) {
  return importPage(mdxPath);
}

export async function getBlogPostMetadata(
  mdxPath: string[],
): Promise<BlogPostMetadata> {
  const { metadata } = await importPage(mdxPath);

  return parseBlogPostMetadata(metadata);
}
