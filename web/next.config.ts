import type { NextConfig } from 'next';
import nextra from 'nextra';

const withNextra = nextra({
  contentDirBasePath: '/blog',
});

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Preserve loopback hostnames and the configured auth redirect origin.
  skipProxyUrlNormalize: true,
  logging: {
    incomingRequests: { ignore: [/^\/auth\/confirm(?:\?|$)/] },
  },
  turbopack: {
    resolveAlias: {
      'next-mdx-import-source-file':
        './src/features/blog/blog.mdx-components.tsx',
    },
  },
};

export default withNextra(nextConfig);
