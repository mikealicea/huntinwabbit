import type { Metadata } from 'next';
import { generateStaticParamsFor } from 'nextra/pages';
import {
  BlogPost,
  type BlogRouteProps,
  getBlogPostMetadata,
} from '@/features/blog/blog.index';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

export async function generateMetadata({
  params,
}: BlogRouteProps): Promise<Metadata> {
  const { mdxPath } = await params;
  const metadata = await getBlogPostMetadata(mdxPath);

  return {
    title: metadata.title,
    description: metadata.description,
  };
}

export default async function BlogPostPage({ params }: BlogRouteProps) {
  const { mdxPath } = await params;

  return <BlogPost mdxPath={mdxPath} />;
}
