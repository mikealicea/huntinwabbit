import { BlogPost } from './BlogPost.component';
import { loadBlogPost } from './blog.server';
import { formatDate, parseBlogPostMetadata } from './blog.utils';

export async function BlogPostContainer({ mdxPath }: { mdxPath: string[] }) {
  const { default: MDXContent, metadata } = await loadBlogPost(mdxPath);
  const postMetadata = parseBlogPostMetadata(metadata);

  return (
    <BlogPost
      title={postMetadata.title}
      date={formatDate(new Date(postMetadata.date))}
    >
      <MDXContent />
    </BlogPost>
  );
}
