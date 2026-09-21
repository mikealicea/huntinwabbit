import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Preserve cookie scope and the configured auth redirect origin.
  skipProxyUrlNormalize: true,
  logging: {
    incomingRequests: { ignore: [/^\/auth\/confirm(?:\?|$)/] },
  },
};

export default nextConfig;
