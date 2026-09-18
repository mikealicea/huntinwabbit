import { BlogIndex } from './BlogIndex.component';
import { getBlogPosts } from './blog.server';
import { formatDate } from './blog.utils';

export async function BlogIndexContainer() {
  const posts = await getBlogPosts();

  return (
    <BlogIndex
      posts={posts.map((post) => ({
        route: post.route,
        title: post.title,
        date: post.frontMatter.date
          ? formatDate(new Date(post.frontMatter.date))
          : null,
      }))}
    />
  );
}
