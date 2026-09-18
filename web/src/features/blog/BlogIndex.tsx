import Link from 'next/link';
import { normalizePages } from 'nextra/normalize-pages';
import { getPageMap } from 'nextra/page-map';
import { formatDate } from './blog.utils';

async function getBlogPosts() {
  const { directories } = normalizePages({
    list: await getPageMap('/blog'),
    route: '/blog',
    underCurrentDocsRoot: true,
  });

  return directories
    .filter((post) => post.name !== 'index')
    .sort((firstPost, secondPost) => {
      const firstDate = new Date(firstPost.frontMatter.date || '').getTime();
      const secondDate = new Date(secondPost.frontMatter.date || '').getTime();

      return secondDate - firstDate;
    });
}

export async function BlogIndex() {
  const posts = await getBlogPosts();

  return (
    <section>
      <h1>Blog</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.route}>
            <Link href={post.route}>{post.title}</Link>
            {post.frontMatter.date ? (
              <span className="text-base-content/60 ml-2 text-sm">
                {formatDate(new Date(post.frontMatter.date))}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
