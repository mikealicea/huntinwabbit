import type { NextConfig } from 'next';
import nextra from 'nextra';

const withNextra = nextra({
  contentDirBasePath: '/blog',
});

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      'next-mdx-import-source-file':
        './src/features/blog/blog.mdx-components.tsx',
    },
  },
};

export default withNextra(nextConfig);
